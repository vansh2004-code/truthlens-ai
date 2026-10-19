# Model setup

**Current default:** `TL_MODEL_ID=prithivMLmods/Deep-Fake-Detector-v2-Model` (a ViT image classifier on Hugging Face).
**Status: loads and runs; accuracy unverified.** A GitHub Actions run (`.github/workflows/e2e-model.yml`) downloaded commit
`3a99ae26f52c7ac7c3a53103b6cf3a8b617f7093`, ran it on CPU through the full pipeline and produced a report. Labels: `0=Realism`, `1=Deepfake`. Model card licence tag: `apache-2.0` (base model `google/vit-base-patch16-224-in21k`); this is the card's metadata only,
the licences and provenance of its training data were **not** checked.
**Warning from that run:** on one genuine, unmanipulated photo (scikit-image's public-domain astronaut image rendered as an 8 s video) the model scored
0.67-0.72 "Deepfake" per frame, so some frames crossed the 0.70 review threshold. One image is not an evaluation, but it shows this model can raise false
alarms on real faces. Do not rely on its output without evaluating on data resembling yours. Before relying on it you must:
1. Read its model card for **license, training data, intended use and known limitations**, and confirm they suit your use.
2. Run `python scripts/download_model.py` (needs network). It loads the model and prints the resolved "manipulated" label; it
   exits non-zero if the labels are ambiguous. Pin `TL_MODEL_REVISION` to a commit hash for reproducibility.
3. Evaluate on a dataset you are licensed to use (docs/TESTING.md) and tune thresholds. Published/third-party accuracy claims do not transfer
   to your data; many public detectors generalise poorly to new generation methods and compressed video.

To use another model: any `AutoModelForImageClassification` works if exactly one label matches `TL_FAKE_LABEL_KEYWORDS`; otherwise
implement `FrameClassifier` (app/ml/base.py). Weights are cached under `TL_MODEL_CACHE_DIR`; they are never committed.
GPU: set `TL_DEVICE=cuda` and install a CUDA build of PyTorch. Offline: set `TL_MODEL_ID` to a local directory.
Audio (optional): set `TL_ENABLE_AUDIO=true` and `TL_AUDIO_MODEL_ID`; unavailable → reported as "not performed".
