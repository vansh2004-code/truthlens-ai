"""Face detection (OpenCV Haar cascade by default, shipped with opencv; no download) and IoU tracking."""
import cv2
import numpy as np

from .base import FaceDetector


class HaarFaceDetector(FaceDetector):
    def __init__(self):
        path = cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
        self.cascade = cv2.CascadeClassifier(path)
        if self.cascade.empty():
            raise RuntimeError("OpenCV Haar cascade could not be loaded")

    def detect(self, frame_bgr: np.ndarray) -> list[tuple[int, int, int, int]]:
        h, w = frame_bgr.shape[:2]
        scale = 640 / max(w, h) if max(w, h) > 640 else 1.0
        small = cv2.resize(frame_bgr, None, fx=scale, fy=scale) if scale != 1.0 else frame_bgr
        gray = cv2.equalizeHist(cv2.cvtColor(small, cv2.COLOR_BGR2GRAY))
        min_side = max(24, int(min(small.shape[:2]) * 0.06))
        faces = self.cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=6, minSize=(min_side, min_side))
        return [(int(x / scale), int(y / scale), int(fw / scale), int(fh / scale)) for x, y, fw, fh in faces]


def iou(a, b) -> float:
    ax, ay, aw, ah = a
    bx, by, bw, bh = b
    x1, y1 = max(ax, bx), max(ay, by)
    x2, y2 = min(ax + aw, bx + bw), min(ay + ah, by + bh)
    inter = max(0, x2 - x1) * max(0, y2 - y1)
    union = aw * ah + bw * bh - inter
    return inter / union if union else 0.0


class IouTracker:
    """Greedy IoU association across sampled frames. Because sampling is sparse (~1 fps), the
    threshold is deliberately loose; track IDs are indicative of identity continuity, not proof."""

    def __init__(self, threshold: float = 0.2):
        self.threshold = threshold
        self.tracks: dict[int, tuple] = {}
        self._next = 1

    def update(self, boxes: list[tuple]) -> list[int]:
        ids: list[int] = []
        used: set[int] = set()
        for b in boxes:
            best, best_iou = None, self.threshold
            for tid, tb in self.tracks.items():
                if tid in used:
                    continue
                v = iou(b, tb)
                if v > best_iou:
                    best, best_iou = tid, v
            if best is None:
                best = self._next
                self._next += 1
            used.add(best)
            self.tracks[best] = b
            ids.append(best)
        return ids


def crop_face(frame_bgr: np.ndarray, box, margin: float) -> tuple[np.ndarray, tuple[int, int, int, int]]:
    x, y, w, h = box
    H, W = frame_bgr.shape[:2]
    mx, my = int(w * margin), int(h * margin)
    x1, y1, x2, y2 = max(0, x - mx), max(0, y - my), min(W, x + w + mx), min(H, y + h + my)
    crop = cv2.cvtColor(frame_bgr[y1:y2, x1:x2], cv2.COLOR_BGR2RGB)
    return crop, (x1, y1, x2 - x1, y2 - y1)
