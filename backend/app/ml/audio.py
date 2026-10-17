"""Optional audio-deepfake analysis. Runs ONLY if TL_ENABLE_AUDIO=true and TL_AUDIO_MODEL_ID is set and loads.
Audiovisual synchronization analysis is NOT implemented and is always reported as not performed."""
import logging
import tempfile
from pathlib import Path

import numpy as np

from ..config import get_settings
from ..services.validation import run_safe

log = logging.getLogger("truthlens.audio")

SYNC_NOTE = "Audiovisual synchronization analysis is not implemented in this version."


def not_performed(reason: str) -> dict:
    return {"status": "not_performed", "reason": reason, "sync": {"status": "not_performed", "reason": SYNC_NOTE}}


def analyze_audio(video: Path, has_audio: bool) -> dict:
    s = get_settings()
    if not s.enable_audio or not s.audio_model_id:
        return not_performed("Audio analysis is disabled (no audio model configured).")
    if not has_audio:
        return not_performed("The video has no audio track.")
    try:
        import torch
        from transformers import AutoFeatureExtractor, AutoModelForAudioClassification

        kw = {"cache_dir": str(s.model_cache_dir)}
        fe = AutoFeatureExtractor.from_pretrained(s.audio_model_id, **kw)
        model = AutoModelForAudioClassification.from_pretrained(s.audio_model_id, **kw).eval()
    except Exception as e:  # noqa: BLE001
        log.warning("Audio model unavailable: %s", type(e).__name__)
        return not_performed(f"Audio model could not be loaded ({type(e).__name__}).")
    kws = [k.strip().lower() for k in s.fake_label_keywords.split(",")]
    hits = [int(i) for i, lab in model.config.id2label.items() if any(k in str(lab).lower() for k in kws)]
    if len(hits) != 1:
        return not_performed("Audio model labels are ambiguous; cannot identify the manipulated class.")
    with tempfile.TemporaryDirectory(prefix="tl_audio_") as tmp:
        wav = Path(tmp) / "a.wav"
        r = run_safe(["ffmpeg", "-nostdin", "-v", "error", "-i", str(video), "-vn", "-ac", "1", "-ar",
                      str(fe.sampling_rate), "-t", "120", str(wav)], timeout=120)
        if r.returncode != 0 or not wav.exists():
            return not_performed("Audio could not be extracted.")
        import wave

        with wave.open(str(wav)) as w:
            audio = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32) / 32768.0
    seg = fe.sampling_rate * 5
    scores = []
    for i in range(0, max(len(audio) - seg // 2, 1), seg):
        chunk = audio[i : i + seg]
        if len(chunk) < fe.sampling_rate:
            continue
        inp = fe(chunk, sampling_rate=fe.sampling_rate, return_tensors="pt")
        with torch.inference_mode():
            p = torch.softmax(model(**inp).logits, dim=-1)[0, hits[0]].item()
        scores.append({"start": round(i / fe.sampling_rate, 2), "score": round(float(p), 4)})
    if not scores:
        return not_performed("Audio too short to analyze.")
    return {
        "status": "performed", "model": s.audio_model_id, "segments": scores,
        "mean_score": round(float(np.mean([x["score"] for x in scores])), 4),
        "note": "Uncalibrated model score on 5-second segments.", "sync": {"status": "not_performed", "reason": SYNC_NOTE},
    }
