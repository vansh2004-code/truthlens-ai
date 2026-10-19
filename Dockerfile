# Single-container build: React UI + FastAPI API + in-process jobs + SQLite. Suited to Hugging Face Spaces (Docker SDK)
# or any one-container host. For production-scale use, prefer docker-compose.yml (Postgres + Redis + Celery worker).
FROM node:22-slim AS web
WORKDIR /web
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg libglib2.0-0 curl && rm -rf /var/lib/apt/lists/*
RUN useradd -m -u 1000 user
WORKDIR /app
COPY backend/requirements.txt .
RUN pip install --extra-index-url https://download.pytorch.org/whl/cpu -r requirements.txt
COPY backend/ .
COPY --from=web /web/dist /app/static
RUN mkdir -p /home/user/data && chown -R user /home/user /app
USER user
# TL_SECRET_KEY must be provided at runtime (e.g. as a Space secret); the app refuses to start in production without it.
ENV TL_ENV=production TL_COOKIE_SECURE=true TL_STATIC_DIR=/app/static TL_RUN_JOBS_INLINE=true \
    TL_DATABASE_URL=sqlite:////home/user/data/truthlens.db TL_STORAGE_DIR=/home/user/data/media \
    TL_FRAMES_DIR=/home/user/data/frames TL_MODEL_CACHE_DIR=/home/user/data/models TL_DEVICE=cpu \
    TL_MAX_FRAMES=60 TL_MAX_UPLOAD_MB=100 TL_MAX_DURATION_SECONDS=120 HF_HOME=/home/user/data/hf
EXPOSE 7860
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD curl -fsS http://localhost:7860/healthz || exit 1
CMD ["sh", "-c", "alembic upgrade head && exec uvicorn app.main:app --host 0.0.0.0 --port 7860 --proxy-headers --forwarded-allow-ips='*'"]
