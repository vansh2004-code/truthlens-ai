"""Model adapter interfaces. Any compatible detector can be plugged in by implementing FrameClassifier."""
from abc import ABC, abstractmethod
from dataclasses import dataclass, field

import numpy as np


class ModelUnavailableError(RuntimeError):
    """Raised when weights cannot be loaded (missing, gated, offline). Never silently replaced by a fake."""


@dataclass
class ModelInfo:
    name: str
    version: str
    device: str
    source: str = ""
    license: str = "unverified"
    labels: dict = field(default_factory=dict)
    fake_label: str = ""


class FrameClassifier(ABC):
    """Scores face crops. predict() returns an UNCALIBRATED model score in [0,1] where higher means
    the model considers the crop more likely manipulated. It is not a calibrated probability."""

    info: ModelInfo

    @abstractmethod
    def load(self) -> None: ...

    @abstractmethod
    def predict(self, faces_rgb: list[np.ndarray]) -> list[float]: ...

    def saliency(self, face_rgb: np.ndarray) -> np.ndarray | None:
        """Optional HxW float map in [0,1]. Return None if unsupported."""
        return None


class FaceDetector(ABC):
    @abstractmethod
    def detect(self, frame_bgr: np.ndarray) -> list[tuple[int, int, int, int]]:
        """Return face boxes as (x, y, w, h) in pixels."""
