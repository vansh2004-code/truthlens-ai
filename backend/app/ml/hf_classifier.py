"""Hugging Face image-classification adapter (e.g. ViT-based deepfake detectors).

IMPORTANT: model provenance and license are the operator's responsibility. The default model ID in
config is a candidate and must be reviewed (see docs/MODEL_SETUP.md). The adapter never invents
scores: if weights cannot be loaded it raises ModelUnavailableError.
"""
import logging
import threading

import numpy as np

from ..config import get_settings
from .base import FrameClassifier, ModelInfo, ModelUnavailableError

log = logging.getLogger("truthlens.model")


class HFImageClassifier(FrameClassifier):
    def __init__(self, model_id: str | None = None, revision: str | None = None):
        s = get_settings()
        self.s = s
        self.model_id = model_id or s.model_id
        self.revision = revision or s.model_revision
        self._model = None
        self._processor = None
        self._lock = threading.Lock()
        self._fake_idx: int | None = None
        self.info = ModelInfo(name=self.model_id, version="unloaded", device="cpu", source=f"https://huggingface.co/{self.model_id}")

    # ---- loading ---------------------------------------------------------------------------
    def _pick_device(self) -> str:
        import torch

        if self.s.device == "cpu":
            return "cpu"
        if self.s.device == "cuda" or self.s.device == "auto":
            if torch.cuda.is_available():
                return "cuda"
            if self.s.device == "cuda":
                raise ModelUnavailableError("TL_DEVICE=cuda requested but CUDA is not available")
        return "cpu"

    def resolve_fake_index(self, id2label: dict) -> int:
        """Find which output class means 'manipulated' from the model's own config. Fail loudly if ambiguous."""
        kws = [k.strip().lower() for k in self.s.fake_label_keywords.split(",") if k.strip()]
        hits = [int(i) for i, lab in id2label.items() if any(k in str(lab).lower() for k in kws)]
        if len(hits) != 1:
            raise ModelUnavailableError(
                f"Cannot determine the manipulated-class label from model labels {dict(id2label)}. "
                "Set TL_FAKE_LABEL_KEYWORDS so exactly one label matches."
            )
        return hits[0]

    def load(self) -> None:
        with self._lock:
            if self._model is not None:
                return
            try:
                import torch
                from transformers import AutoImageProcessor, AutoModelForImageClassification

                self.s.model_cache_dir.mkdir(parents=True, exist_ok=True)
                kw = {"revision": self.revision, "cache_dir": str(self.s.model_cache_dir)}
                self._processor = AutoImageProcessor.from_pretrained(self.model_id, **kw)
                model = AutoModelForImageClassification.from_pretrained(self.model_id, **kw)
            except Exception as e:  # noqa: BLE001
                raise ModelUnavailableError(
                    f"Could not load model '{self.model_id}': {type(e).__name__}. Run scripts/download_model.py "
                    "with network access to Hugging Face, or set TL_MODEL_ID to a local directory."
                ) from e
            device = self._pick_device()
            model.to(device).eval()
            self._model = model
            self._fake_idx = self.resolve_fake_index(model.config.id2label)
            commit = getattr(model.config, "_commit_hash", None) or self.revision
            self.info = ModelInfo(
                name=self.model_id, version=str(commit), device=device, source=f"https://huggingface.co/{self.model_id}",
                license="unverified - see docs/MODEL_SETUP.md", labels=dict(model.config.id2label),
                fake_label=str(model.config.id2label[self._fake_idx]),
            )
            log.info("Loaded %s @ %s on %s (fake label=%s)", self.model_id, commit, device, self.info.fake_label)
            torch.set_num_threads(max(1, torch.get_num_threads()))

    # ---- inference -------------------------------------------------------------------------
    def predict(self, faces_rgb: list[np.ndarray], batch_size: int = 8) -> list[float]:
        import torch

        self.load()
        out: list[float] = []
        for i in range(0, len(faces_rgb), batch_size):
            batch = faces_rgb[i : i + batch_size]
            inputs = self._processor(images=batch, return_tensors="pt").to(self.info.device)
            with torch.inference_mode():
                logits = self._model(**inputs).logits
            probs = torch.softmax(logits.float(), dim=-1)[:, self._fake_idx]
            out.extend(float(p) for p in probs.cpu().numpy())
        return out

    def saliency(self, face_rgb: np.ndarray) -> np.ndarray | None:
        """Input-gradient saliency of the manipulated-class logit. Indicative only; not proof of a manipulation region."""
        import cv2
        import torch

        self.load()
        inputs = self._processor(images=[face_rgb], return_tensors="pt").to(self.info.device)
        pv = inputs["pixel_values"].clone().requires_grad_(True)
        with torch.enable_grad():
            logit = self._model(pixel_values=pv).logits[0, self._fake_idx]
            logit.backward()
        g = pv.grad.detach().abs().max(dim=1)[0][0].cpu().numpy()
        g = cv2.GaussianBlur(g, (0, 0), sigmaX=max(1.0, g.shape[0] / 48))
        g -= g.min()
        if g.max() <= 0:
            return None
        g /= g.max()
        return cv2.resize(g.astype(np.float32), (face_rgb.shape[1], face_rgb.shape[0]))
