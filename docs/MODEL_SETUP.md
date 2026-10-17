# Model setup

**Current default:** `TL_MODEL_ID=prithivMLmods/Deep-Fake-Detector-v2-Model` (a ViT image classifier on Hugging Face).
**Status: unverified.** It was chosen as a candidate; in the build sandbox huggingface.co was unreachable, so it was never
downloaded or run here. Before relying on it you must:
1. Read its model card for **license, training data, intended use and known limitations**, and confirm they suit your use.
2. Run `python scripts/download_model.py` (needs network). It loads the model and prints the resolved "manipulated" label; it
   exits non-zero if the labels are ambiguous. Pin `TL_MODEL_REVISION` to a commit hash for reproducibility.
3. Evaluate on a dataset you are licensed to use (docs/TESTING.md) and tune thresholds. Published/third-party accuracy claims do not transfer
   to your data; many public detectors generalise poorly to new generation methods and compressed video.

To use another model: any `AutoModelForImageClassification` works if exactly one label matches `TL_FAKE_LABEL_KEYWORDS`; otherwise
implement `FrameClassifier` (app/ml/base.py). Weights are cached under `TL_MODEL_CACHE_DIR`; they are never committed.
GPU: set `TL_DEVICE=cuda` and install a CUDA build of PyTorch. Offline: set `TL_MODEL_ID` to a local directory.
Audio (optional): set `TL_ENABLE_AUDIO=true` and `TL_AUDIO_MODEL_ID`; unavailable → reported as "not performed".
