"""Frame extraction with FFmpeg, preserving real presentation timestamps (parsed from showinfo)."""
import re
import tempfile
from dataclasses import dataclass
from pathlib import Path

import cv2
import numpy as np

from ..services.validation import run_safe


@dataclass
class SampledFrame:
    index: int
    timestamp: float
    image_bgr: np.ndarray


class FrameExtractionError(RuntimeError):
    pass


def extract_frames(video: Path, interval: float, max_frames: int, duration: float) -> list[SampledFrame]:
    if interval <= 0:
        raise ValueError("interval must be positive")
    # Widen the interval if the cap would otherwise truncate the end of the video.
    interval = max(interval, duration / max_frames) if duration > 0 else interval
    with tempfile.TemporaryDirectory(prefix="tl_frames_") as tmp:
        pattern = str(Path(tmp) / "f_%05d.jpg")
        argv = [
            "ffmpeg", "-nostdin", "-v", "info", "-i", str(video), "-an", "-sn",
            "-vf", f"fps=1/{interval:.4f},showinfo", "-frames:v", str(max_frames), "-q:v", "2", pattern,
        ]
        r = run_safe(argv, timeout=300)
        if r.returncode != 0:
            raise FrameExtractionError("FFmpeg could not decode frames from this video.")
        stderr = r.stderr.decode("utf-8", "ignore")
        times = [float(m) for m in re.findall(r"pts_time:([0-9.]+)", stderr)]
        files = sorted(Path(tmp).glob("f_*.jpg"))
        frames: list[SampledFrame] = []
        for i, f in enumerate(files):
            img = cv2.imread(str(f))
            if img is None:
                continue
            ts = times[i] if i < len(times) else i * interval
            frames.append(SampledFrame(index=i, timestamp=round(ts, 3), image_bgr=img))
        return frames


def quality_metrics(frame_bgr: np.ndarray, face_box=None) -> dict:
    gray = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2GRAY)
    region = gray
    face_ratio = 0.0
    if face_box is not None:
        x, y, w, h = face_box
        region = gray[y : y + h, x : x + w] if w > 0 and h > 0 else gray
        face_ratio = (w * h) / float(gray.shape[0] * gray.shape[1])
    blur = float(cv2.Laplacian(region, cv2.CV_64F).var()) if region.size else 0.0
    return {"blur_var": round(blur, 2), "brightness": round(float(region.mean()), 1) if region.size else 0.0, "face_area_ratio": round(face_ratio, 4)}


def is_low_quality(q: dict, face_px: int | None) -> str | None:
    if q["blur_var"] < 15:
        return "very blurry"
    if q["brightness"] < 25:
        return "too dark"
    if q["brightness"] > 235:
        return "overexposed"
    if face_px is not None and face_px < 48:
        return "face too small"
    return None
