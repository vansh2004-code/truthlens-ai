"""Create/update a Hugging Face Docker Space from this repo. NOT yet executed (needs network access to huggingface.co).
Usage:  HF_TOKEN=hf_xxx python deploy/huggingface/deploy_space.py <your-hf-username>/truthlens-ai [TL_SECRET_KEY]
The token is read from the environment only. A write-scoped token is required. Never commit tokens."""
import os
import secrets
import sys
import tempfile
from pathlib import Path

from huggingface_hub import HfApi

FRONT_MATTER = "---\ntitle: TruthLens AI\nemoji: 🔍\ncolorFrom: blue\ncolorTo: purple\nsdk: docker\napp_port: 7860\npinned: false\n---\n\n"
ROOT = Path(__file__).resolve().parents[2]
IGNORE = ["**/node_modules/**", "**/.venv/**", "**/dist/**", "**/__pycache__/**", "backend/data/**", ".git/**", ".env", "docs/**/*.png"]

if len(sys.argv) < 2 or "HF_TOKEN" not in os.environ:
    sys.exit("usage: HF_TOKEN=... python deploy_space.py <user>/<space> [secret_key]")
repo_id = sys.argv[1]
secret = sys.argv[2] if len(sys.argv) > 2 else secrets.token_urlsafe(48)
api = HfApi(token=os.environ["HF_TOKEN"])
api.create_repo(repo_id, repo_type="space", space_sdk="docker", exist_ok=True)
api.add_space_secret(repo_id, "TL_SECRET_KEY", secret)
with tempfile.TemporaryDirectory() as tmp:
    (Path(tmp) / "README.md").write_text(FRONT_MATTER + (ROOT / "README.md").read_text())
    api.upload_file(path_or_fileobj=str(Path(tmp) / "README.md"), path_in_repo="README.md", repo_id=repo_id, repo_type="space")
api.upload_folder(folder_path=str(ROOT), repo_id=repo_id, repo_type="space", ignore_patterns=IGNORE + ["README.md"])
print(f"Deployed. Build logs and app: https://huggingface.co/spaces/{repo_id}  (direct URL: https://{repo_id.replace('/', '-').lower()}.hf.space)")
