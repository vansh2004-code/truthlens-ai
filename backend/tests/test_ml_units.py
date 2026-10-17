import pytest

from app.ml.base import ModelUnavailableError
from app.ml.faces import IouTracker, iou
from app.ml.hf_classifier import HFImageClassifier
from app.ml.temporal import analyze_temporal


def test_tracker_keeps_identity():
    t = IouTracker()
    assert t.update([(10, 10, 50, 50)]) == [1]
    assert t.update([(14, 12, 50, 50)]) == [1]
    assert t.update([(300, 300, 40, 40)]) == [2]
    assert iou((0, 0, 10, 10), (20, 20, 5, 5)) == 0


def test_temporal_intervals_and_spikes():
    pts = [{"timestamp": float(i), "score": s, "flagged": s >= 0.7} for i, s in enumerate([0.1, 0.1, 0.9, 0.95, 0.1, 0.1])]
    t = analyze_temporal(pts, 0.7)
    assert t["performed"] and t["suspicious_intervals"][0]["start"] == 2.0 and t["suspicious_intervals"][0]["end"] == 3.0
    assert t["spikes"] and t["pattern"] == "intermittent"
    assert analyze_temporal(pts[:1], 0.7)["performed"] is False


def test_fake_label_resolution_is_strict():
    c = HFImageClassifier("x/y")
    assert c.resolve_fake_index({0: "Realism", 1: "Deepfake"}) == 1
    with pytest.raises(ModelUnavailableError):
        c.resolve_fake_index({0: "A", 1: "B"})
    with pytest.raises(ModelUnavailableError):
        c.resolve_fake_index({0: "fake", 1: "deepfake"})


def test_missing_weights_raise_not_fake(tmp_path, monkeypatch):
    from app.config import get_settings

    monkeypatch.setenv("HF_HUB_OFFLINE", "1")
    monkeypatch.setattr(get_settings(), "model_cache_dir", tmp_path)
    with pytest.raises(ModelUnavailableError):
        HFImageClassifier("definitely-not/a-real-model").load()
