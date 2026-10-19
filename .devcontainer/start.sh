#!/usr/bin/env bash
# Starts the single-process app (API + built UI + in-process jobs) on port 8000. Runs on every codespace start.
cd "$(dirname "$0")/../backend" || exit 1
VENV="${TL_VENV:-.venv}"
[ -x "$VENV/bin/uvicorn" ] || { echo "Not set up yet; run: bash .devcontainer/setup.sh"; exit 0; }
set -a; . data/.env.codespace 2>/dev/null; set +a
export TL_ENV=development TL_RUN_JOBS_INLINE=true TL_STATIC_DIR="$PWD/../frontend/dist" \
       TL_DATABASE_URL="sqlite:///$PWD/data/truthlens.db" TL_STORAGE_DIR="$PWD/data/media" TL_FRAMES_DIR="$PWD/data/frames" \
       TL_MODEL_CACHE_DIR="$PWD/data/models" TL_DEVICE=cpu TL_MAX_FRAMES=60 TL_MAX_UPLOAD_MB=100 TL_MAX_DURATION_SECONDS=120
pkill -f "[u]vicorn app.main" 2>/dev/null
"$VENV/bin/alembic" upgrade head >> data/server.log 2>&1
nohup "$VENV/bin/uvicorn" app.main:app --host 0.0.0.0 --port "${PORT:-8000}" --proxy-headers --forwarded-allow-ips='*' >> data/server.log 2>&1 &
echo "TruthLens AI starting on port ${PORT:-8000} (logs: backend/data/server.log)"
