"""Process-wide model registry (lazy, cached). Tests can inject an adapter via set_classifier()."""
import threading

from .base import FaceDetector, FrameClassifier
from .faces import HaarFaceDetector
from .hf_classifier import HFImageClassifier

_lock = threading.Lock()
_classifier: FrameClassifier | None = None
_detector: FaceDetector | None = None


def get_classifier() -> FrameClassifier:
    global _classifier
    with _lock:
        if _classifier is None:
            _classifier = HFImageClassifier()
        return _classifier


def get_face_detector() -> FaceDetector:
    global _detector
    with _lock:
        if _detector is None:
            _detector = HaarFaceDetector()
        return _detector


def set_classifier(c: FrameClassifier | None) -> None:
    global _classifier
    _classifier = c


def set_face_detector(d: FaceDetector | None) -> None:
    global _detector
    _detector = d
