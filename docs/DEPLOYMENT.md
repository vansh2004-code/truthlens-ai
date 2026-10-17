# Deployment

**Status: not deployed.** No deployment credentials or authorization to incur cost were available in the build environment, and no live URL exists.
This document is the plan and the exact steps; nothing here has been executed against a cloud provider.

## Recommended architecture (and why)
| Component | Choice | Why |
|---|---|---|
| Frontend | Container (nginx) or static host (Cloudflare Pages/Vercel) | SPA; `/api` must reach the backend on the **same site** (cookies, CSRF) — easiest behind one domain/reverse proxy |
| API + worker | Container host with persistent processes (Fly.io, Render, Railway, ECS, a VM) | FastAPI + Celery need long-running processes, FFmpeg and PyTorch; **GitHub Pages / serverless functions cannot host this** |
| Database | Managed PostgreSQL | Durable state |
| Queue | Managed Redis | Celery broker/result backend |
| Media | Private volume or S3-compatible bucket | Never public. The shipped storage backend is a local volume (`TL_STORAGE_DIR`, `TL_FRAMES_DIR`); API and worker **must share it** (same volume/host) until an object-storage backend is implemented in `app/services/storage.py` |
| Compute | CPU instance, ≥ 4 GB RAM (≥ 8 GB comfortable) | ViT inference on CPU ≈ seconds per batch of frames; GPU optional |

Cost reality: free tiers generally lack persistent disk, enough RAM for PyTorch, or background workers. Expect a paid instance (~$10–40/month range) plus managed
Postgres/Redis. Nothing was subscribed to.

## Environment variables
See `.env.example`. Required in production: `TL_ENV=production`, `TL_SECRET_KEY` (≥ 32 random chars), `TL_COOKIE_SECURE=true`, `TL_DATABASE_URL`, `TL_REDIS_URL`,
`TL_CORS_ORIGINS`, `TL_FRONTEND_URL`, SMTP settings (else verification/reset emails cannot be sent). The app refuses to start in production with a weak key, insecure cookies, or wildcard CORS.

## Build / start / migrate / model
```bash
docker build -t truthlens-backend ./backend && docker build -t truthlens-frontend ./frontend
# API (runs `alembic upgrade head` on start):   uvicorn app.main:app --host 0.0.0.0 --port 8000 --proxy-headers
# Worker + scheduler (retention purge hourly):  celery -A app.worker.celery_app worker --concurrency=1 -B
# Model (once, with network access):            python scripts/download_model.py
# Promote first admin (production):             UPDATE users SET role='admin' WHERE email='you@example.com';
```
Run exactly **one** worker with `-B` (beat) or run beat separately; scale workers with `--concurrency` according to RAM (each loads the model).

## Health checks
`GET /healthz` (liveness) · `GET /readyz` (DB + Redis; 503 if degraded) · admin `GET /api/admin/model-health?load=true`.

## GitHub-based deploy
`.github/workflows/ci.yml` runs lint/type/test/build and Docker build validation. Add a deploy job for your provider using repository **secrets**
(never commit tokens). Smoke test after deploy: `/readyz`, register, upload a short clip, confirm completion, download the PDF, confirm another account gets 404.

## Troubleshooting
- Analysis fails with "Detection model unavailable": weights not downloaded or no access to Hugging Face; run the download script or point `TL_MODEL_ID` at a local directory.
- Frames/images 404 in the UI: API and worker are not sharing the same `TL_FRAMES_DIR`/`TL_STORAGE_DIR` volume.
- 403 `csrf_failed`: frontend and API are on different sites; serve both under one origin or configure `TL_COOKIE_SAMESITE=none` + `TL_COOKIE_SECURE=true` and exact CORS origins.
- Worker OOM: lower `--concurrency`, `TL_MAX_FRAMES`, or use a larger instance.

## Redeploy
Push to `main` → CI → rebuild images → deploy API/worker (migrations run on API start) → frontend.
