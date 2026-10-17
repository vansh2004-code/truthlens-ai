"""Download and validate the configured detection model into the cache. Requires network access to huggingface.co.
Usage: python scripts/download_model.py   (run from backend/)"""
import sys

sys.path.insert(0, str(__import__("pathlib").Path(__file__).resolve().parents[1]))
from app.ml.base import ModelUnavailableError  # noqa: E402
from app.ml.hf_classifier import HFImageClassifier  # noqa: E402

c = HFImageClassifier()
try:
    c.load()
except ModelUnavailableError as e:
    sys.exit(f"FAILED: {e}")
print("OK", c.info)
