# Architecture

```
Browser (React SPA) ──/api──> FastAPI ──> PostgreSQL (users, analyses, evidence, audit)
                                 │  └──> private media + frame storage (local volume; S3-compatible swap point: app/services/storage.py)
                                 └──enqueue──> Redis ──> Celery worker ──> pipeline ──> results persisted
```
Decisions: **Monorepo** (backend/, frontend/). **FastAPI + SQLAlchemy 2 + Alembic.** **Celery + Redis** for jobs
(`TL_RUN_JOBS_INLINE=true` uses a thread for dev/tests only). **Cookie auth** (HttpOnly access JWT, rotating hashed
refresh sessions, double-submit CSRF) so no tokens live in JS. **Argon2id** hashing. Frames are sampled with FFmpeg
(real PTS timestamps), faces found with an OpenCV Haar cascade (no download; replaceable via `FaceDetector`) and linked
with a greedy IoU tracker. Detection goes through the `FrameClassifier` adapter (`app/ml/base.py`); the default
`HFImageClassifier` loads any Hugging Face image-classification model and resolves the "manipulated" class from the model's
own labels, failing loudly if ambiguous.

## Pipeline (`app/ml/pipeline.py`)
probe/validate → extract frames (interval, cap) → detect largest face per frame → quality gate (blur, brightness, face size)
→ batch inference on usable crops → input-gradient saliency for top frames → temporal stats (intervals, spikes) →
optional audio → verdict.

Verdict rules (thresholds configurable, defaults 0.70 / 0.40): fewer than 3 usable frames → *Inconclusive*; median ≥ 0.70 or ≥ 50% of
frames above 0.70 → *Potential manipulation*; median < 0.40 and < 10% flagged → *No strong indicators*; else *Inconclusive*. These
thresholds are **heuristics, not validated or calibrated**; tune them only against a held-out dataset (docs/TESTING.md).

## Data model
users, sessions (hashed refresh tokens), one_time_tokens (hashed, single use), media (storage key only), analyses,
model_inferences, frame_evidence, reports, audit_events. Indexes on ownership, status, created_at.
