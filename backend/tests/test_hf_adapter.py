"""Exercises the REAL HFImageClassifier code path (load, preprocess, torch inference, saliency) using a tiny,
randomly initialised, UNTRAINED ViT saved locally. Scores are meaningless; this only proves the plumbing works
offline. It is NOT a detection-quality test."""
import numpy as np
import pytest

from app.config import get_settings
from app.ml.hf_classifier import HFImageClassifier


@pytest.fixture(scope="module")
def tiny_model_dir(tmp_path_factory):
    from transformers import ViTConfig, ViTForImageClassification, ViTImageProcessor

    d = tmp_path_factory.mktemp("tinyvit")
    cfg = ViTConfig(image_size=32, patch_size=8, hidden_size=32, num_hidden_layers=2, num_attention_heads=2, intermediate_size=64,
                    num_labels=2, id2label={0: "Real", 1: "Fake"}, label2id={"Real": 0, "Fake": 1})
    ViTForImageClassification(cfg).save_pretrained(d)
    ViTImageProcessor(size={"height": 32, "width": 32}).save_pretrained(d)
    return str(d)


def test_real_adapter_inference_and_saliency(tiny_model_dir, monkeypatch):
    monkeypatch.setenv("HF_HUB_OFFLINE", "1")
    monkeypatch.setattr(get_settings(), "device", "cpu")
    c = HFImageClassifier(tiny_model_dir)
    c.load()
    assert c.info.fake_label == "Fake" and c.info.device == "cpu" and c.info.version
    rng = np.random.default_rng(0)
    faces = [rng.integers(0, 255, (60, 50, 3), dtype=np.uint8) for _ in range(3)]
    scores = c.predict(faces)
    assert len(scores) == 3 and all(0.0 <= s <= 1.0 for s in scores)
    assert c.predict(faces) == scores  # deterministic
    sal = c.saliency(faces[0])
    assert sal is not None and sal.shape == (60, 50) and 0 <= sal.min() and sal.max() <= 1
