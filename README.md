# TruthLens AI — Deepfake Detection & Media Forensics

Upload a video; TruthLens samples frames, detects and tracks faces, scores each usable face crop with a pretrained
image classifier, analyses how scores vary over time, and produces evidence (frames, saliency overlays, timeline) plus
PDF/JSON reports. It is **decision support**: scores are *uncalibrated model outputs*, not probabilities, and the
absence of detected manipulation never means a video is authentic.

## Status (read this first)
| Area | State |
|---|---|
| Backend API, auth, jobs, reports, retention, RBAC | Implemented; 33 automated tests pass |
| Frontend (all pages) | Implemented; lint, typecheck, 43 tests, production build pass; manually exercised against the real API |
| Postgres + Redis + Celery worker | Verified end-to-end locally (upload → worker → persisted result → PDF) |
| **Pretrained detection model** | **Not yet verified.** Weights are downloaded from Hugging Face at first use; the development sandbox could not reach huggingface.co, so the configured model has *not* been run and no accuracy has been measured. See [docs/MODEL_SETUP.md](docs/MODEL_SETUP.md). If weights cannot load, analyses **fail with an explicit error**; nothing is faked. |
| Audio deepfake analysis | Optional, off by default; audiovisual sync is **not implemented** |
| Docker images / compose | Written, **not built** (no Docker daemon in the build sandbox); CI builds them |
| GitHub | Pushed; CI passes. UI-only preview on GitHub Pages (no backend there) |
| Backend hosting | **Not deployed.** Single-container image + Hugging Face Space script exist but are unrun; see [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) |
| Benchmarks (precision/recall/ROC-AUC) | **None executed.** Evaluation script exists; no dataset was available |

## Quick start (Docker)
```bash
cp .env.example .env            # set TL_SECRET_KEY and POSTGRES_PASSWORD
docker compose up --build       # UI http://localhost:8080  API http://localhost:8000/api/docs
docker compose exec backend python scripts/download_model.py   # needs network access to huggingface.co
```
The first registered user becomes admin **only outside production**; in production promote a user with SQL (see DEPLOYMENT).

## Local development (no Docker)
```bash
# backend
cd backend && python3 -m venv .venv && . .venv/bin/activate
pip install -r requirements-dev.txt            # needs ffmpeg on PATH
export TL_ENV=development TL_RUN_JOBS_INLINE=true TL_DATABASE_URL=sqlite:///./data/dev.db
alembic upgrade head && uvicorn app.main:app --reload
# frontend
cd frontend && npm install && npm run dev      # http://localhost:5173 (proxies /api to :8000)
```
Tests: `cd backend && pytest -q` · `cd frontend && npm run lint && npm run typecheck && npm test -- --run && npm run build`

## Docs
[Architecture](docs/ARCHITECTURE.md) · [API](docs/API.md) · [Model setup](docs/MODEL_SETUP.md) · [Deployment](docs/DEPLOYMENT.md) · [Security & privacy](docs/SECURITY.md) · [Testing](docs/TESTING.md)
