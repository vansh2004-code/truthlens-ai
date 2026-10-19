#!/usr/bin/env bash
# One-time Codespace setup: backend deps (CPU torch), frontend build, secret key, model download.
set -uo pipefail
cd "$(dirname "$0")/.."
ROOT="$PWD"

sudo apt-get update -qq && sudo apt-get install -y -qq ffmpeg libglib2.0-0 >/dev/null

cd "$ROOT/backend"
python -m venv .venv
.venv/bin/pip install -q --upgrade pip
.venv/bin/pip install -q --extra-index-url https://download.pytorch.org/whl/cpu -r requirements.txt || { echo "pip install failed"; exit 1; }

cd "$ROOT/frontend"
npm ci --no-audit --no-fund && npm run build || { echo "frontend build failed"; exit 1; }

# Per-codespace secret (kept out of git via .gitignore). Never commit this file.
cd "$ROOT/backend"
mkdir -p data
if [ ! -f data/.env.codespace ]; then
  cat > data/.env.codespace <<ENV
TL_SECRET_KEY=$(python -c 'import secrets;print(secrets.token_urlsafe(48))')
ENV
fi

# Model download (Codespaces can reach huggingface.co). Non-fatal: if it fails, analyses fail with an explicit error.
echo "Downloading detection model (check its licence/model card: docs/MODEL_SETUP.md)..."
.venv/bin/python scripts/download_model.py || echo "WARNING: model not downloaded; analyses will fail until it is."
echo "Setup finished."
