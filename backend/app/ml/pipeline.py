"""Orchestrates: probe -> frame extraction -> face detection/tracking -> quality gating -> model inference
-> temporal analysis -> evidence aggregation. No scores are ever fabricated: if the model cannot run, the
analysis FAILS with an explicit reason."""
import logging
import time
from dataclasses import dataclass, field
from pathlib import Path
from statistics import mean, median
from typing import Callable

import cv2
import numpy as np

from ..config import get_settings
from ..models import Verdict
from ..services import storage
from .audio import analyze_audio
from .base import FaceDetector, FrameClassifier
from .faces import IouTracker, crop_face
from .frames import extract_frames, is_low_quality, quality_metrics
from .temporal import analyze_temporal

log = logging.getLogger("truthlens.pipeline")
MAX_OVERLAYS = 8


@dataclass
class FrameResult:
    index: int
    timestamp: float
    face_detected: bool = False
    face_box: list | None = None
    track_id: int | None = None
    score: float | None = None
    flagged: bool = False
    quality: dict = field(default_factory=dict)
    note: str = ""
    image_key: str | None = None
    overlay_key: str | None = None


@dataclass
class PipelineResult:
    verdict: Verdict
    score: float | None
    explanation: str
    limitations: list[str]
    frames: list[FrameResult]
    temporal: dict
    audio: dict
    model: dict
    frames_total: int
    frames_usable: int
    duration_ms: int
    inference_ms: int
    config: dict


BASE_LIMITATIONS = [
    "Scores are uncalibrated outputs of a pretrained image classifier, not probabilities of manipulation.",
    "The model analyzes sampled frames of detected faces only; manipulations elsewhere in the frame, in audio, or between sampled frames are not assessed.",
    "Compression, low resolution, motion blur and lighting can cause both false positives and false negatives.",
    "The absence of detected manipulation does not establish that a video is authentic.",
    "Detectors can fail on manipulation methods not represented in their training data.",
]


def run_pipeline(
    analysis_id: str, video: Path, duration: float, has_audio: bool, classifier: FrameClassifier,
    detector: FaceDetector, progress: Callable[[float, str], None] | None = None,
) -> PipelineResult:
    s = get_settings()
    t0 = time.perf_counter()
    prog = progress or (lambda p, st: None)
    limitations = list(BASE_LIMITATIONS)

    prog(0.05, "loading_model")
    classifier.load()  # raises ModelUnavailableError -> analysis fails honestly
    prog(0.12, "extracting_frames")
    frames = extract_frames(video, s.frame_interval_seconds, s.max_frames, duration)
    if not frames:
        raise RuntimeError("No frames could be extracted from the video.")

    prog(0.25, "detecting_faces")
    tracker = IouTracker()
    results: list[FrameResult] = []
    crops: dict[int, np.ndarray] = {}
    for i, f in enumerate(frames):
        fr = FrameResult(index=f.index, timestamp=f.timestamp)
        boxes = detector.detect(f.image_bgr)
        if boxes:
            ids = tracker.update(boxes)
            # Analyze the largest face per frame; other faces are noted but not scored.
            k = int(np.argmax([b[2] * b[3] for b in boxes]))
            crop, cbox = crop_face(f.image_bgr, boxes[k], s.face_margin)
            fr.face_detected, fr.face_box, fr.track_id = True, list(map(int, cbox)), ids[k]
            fr.quality = quality_metrics(f.image_bgr, cbox)
            reason = is_low_quality(fr.quality, min(cbox[2], cbox[3]))
            if reason:
                fr.note = f"Excluded from scoring: {reason}."
            else:
                crops[f.index] = crop
            if len(boxes) > 1:
                fr.note = (fr.note + " " if fr.note else "") + f"{len(boxes)} faces detected; largest analyzed."
        else:
            fr.quality = quality_metrics(f.image_bgr)
            fr.note = "No face detected."
        results.append(fr)
        prog(0.25 + 0.15 * (i + 1) / len(frames), "detecting_faces")

    usable_idx = sorted(crops)
    t_inf = time.perf_counter()
    prog(0.42, "running_model")
    scores: list[float] = []
    if usable_idx:
        BATCH = 16
        for b in range(0, len(usable_idx), BATCH):
            ids_b = usable_idx[b : b + BATCH]
            scores.extend(classifier.predict([crops[i] for i in ids_b]))
            prog(0.42 + 0.35 * min(1.0, (b + BATCH) / len(usable_idx)), "running_model")
    inference_ms = int((time.perf_counter() - t_inf) * 1000)
    by_idx = {i: sc for i, sc in zip(usable_idx, scores)}
    for fr in results:
        if fr.index in by_idx:
            fr.score = round(by_idx[fr.index], 4)
            fr.flagged = fr.score >= s.manipulation_threshold

    # Evidence images + saliency overlays for the highest-scoring frames
    prog(0.8, "rendering_evidence")
    top = sorted((fr for fr in results if fr.score is not None), key=lambda x: -x.score)[:MAX_OVERLAYS]
    top_idx = {fr.index for fr in top}
    by_frame = {f.index: f for f in frames}
    for fr in results:
        img = by_frame[fr.index].image_bgr
        if fr.face_detected or fr.index in top_idx or fr.index < 24:
            h, w = img.shape[:2]
            sc = 960 / w if w > 960 else 1.0
            view = cv2.resize(img, None, fx=sc, fy=sc) if sc != 1.0 else img.copy()
            if fr.face_box:
                x, y, bw, bh = [int(v * sc) for v in fr.face_box]
                color = (60, 60, 235) if fr.flagged else (200, 160, 90)
                cv2.rectangle(view, (x, y), (x + bw, y + bh), color, 2)
            key, p = storage.frame_path(analysis_id, f"frame_{fr.index:04d}.jpg")
            cv2.imwrite(str(p), view, [cv2.IMWRITE_JPEG_QUALITY, 82])
            fr.image_key = key
    for fr in top:
        try:
            sal = classifier.saliency(crops[fr.index])
        except Exception:  # noqa: BLE001
            log.exception("saliency failed for frame %s", fr.index)
            sal = None
        if sal is None:
            continue
        crop_bgr = cv2.cvtColor(crops[fr.index], cv2.COLOR_RGB2BGR)
        heat = cv2.applyColorMap((sal * 255).astype(np.uint8), cv2.COLORMAP_INFERNO)
        over = cv2.addWeighted(crop_bgr, 0.55, heat, 0.45, 0)
        over = cv2.resize(over, (max(over.shape[1], 224), max(over.shape[0], 224)))
        key, p = storage.frame_path(analysis_id, f"overlay_{fr.index:04d}.jpg")
        cv2.imwrite(str(p), over, [cv2.IMWRITE_JPEG_QUALITY, 85])
        fr.overlay_key = key

    prog(0.9, "temporal_analysis")
    pts = [{"timestamp": fr.timestamp, "score": fr.score, "flagged": fr.flagged} for fr in results if fr.score is not None]
    temporal = analyze_temporal(pts, s.manipulation_threshold)

    prog(0.94, "audio")
    audio = analyze_audio(video, has_audio)

    n_total, n_usable = len(results), len(pts)
    n_face = sum(fr.face_detected for fr in results)
    if n_usable < 3:
        verdict, score = Verdict.inconclusive, (round(mean(p["score"] for p in pts), 4) if pts else None)
        explanation = (
            f"Only {n_usable} of {n_total} sampled frames had a detectable face of adequate quality, which is not enough "
            "for a reliable assessment. This does not indicate whether the video is authentic or manipulated."
        )
        if n_face == 0:
            limitations.append("No faces were detected; this analysis only covers facial manipulation.")
    else:
        sc_list = [p["score"] for p in pts]
        score = round(float(median(sc_list)), 4)
        frac = sum(p["flagged"] for p in pts) / n_usable
        if score >= s.manipulation_threshold or frac >= 0.5:
            verdict = Verdict.potential_manipulation
            explanation = (
                f"The model scored {int(round(frac * 100))}% of {n_usable} usable face frames above the review threshold "
                f"({s.manipulation_threshold:.2f}); the median score was {score:.2f}. This is a signal for human review, not a "
                "confirmed finding."
            )
        elif score < s.inconclusive_low and frac < 0.10:
            verdict = Verdict.no_strong_indicators
            explanation = (
                f"The model found no strong indicators of facial manipulation across {n_usable} usable frames (median score "
                f"{score:.2f}). This does not prove the video is genuine; it may contain manipulations this model cannot detect."
            )
        else:
            verdict = Verdict.inconclusive
            explanation = (
                f"Model scores were mixed (median {score:.2f}; {int(round(frac * 100))}% of {n_usable} usable frames above the "
                "review threshold). The evidence is not strong enough in either direction."
            )
    if n_usable and n_usable / n_total < 0.5:
        limitations.append(f"Only {n_usable} of {n_total} sampled frames were usable; confidence in the result is reduced.")
    if audio.get("status") != "performed":
        limitations.append("Audio was not analyzed.")

    info = classifier.info
    return PipelineResult(
        verdict=verdict, score=score, explanation=explanation, limitations=limitations, frames=results, temporal=temporal,
        audio=audio, frames_total=n_total, frames_usable=n_usable, inference_ms=inference_ms,
        duration_ms=int((time.perf_counter() - t0) * 1000),
        model={"name": info.name, "version": info.version, "device": info.device, "license": info.license,
               "fake_label": info.fake_label, "source": info.source},
        config={"frame_interval_seconds": s.frame_interval_seconds, "max_frames": s.max_frames,
                "manipulation_threshold": s.manipulation_threshold, "inconclusive_low": s.inconclusive_low,
                "face_detector": type(detector).__name__},
    )
