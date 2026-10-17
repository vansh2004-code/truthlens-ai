"""Private local storage. Keys are server-generated; paths never come from user input.
The interface is small so an S3-compatible backend can be swapped in (see docs/DEPLOYMENT.md)."""
import re
import shutil
from pathlib import Path

from ..config import get_settings

_KEY_RE = re.compile(r"^[a-f0-9]{32}(/[A-Za-z0-9_.-]{1,80})?$")


def _root(kind: str) -> Path:
    s = get_settings()
    root = s.storage_dir if kind == "media" else s.frames_dir
    root.mkdir(parents=True, exist_ok=True, mode=0o700)
    return root


def safe_path(kind: str, key: str) -> Path:
    if not _KEY_RE.match(key):
        raise ValueError("invalid storage key")
    root = _root(kind).resolve()
    p = (root / key).resolve()
    if root not in p.parents and p != root:
        raise ValueError("path escape")
    return p


def media_path(media_id: str, ext: str = ".bin") -> tuple[str, Path]:
    key = f"{media_id}/source{ext}"
    key_for_re = f"{media_id}/source{ext}"
    p = safe_path("media", key_for_re)
    p.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    return key, p


def frame_path(analysis_id: str, name: str) -> tuple[str, Path]:
    key = f"{analysis_id}/{name}"
    p = safe_path("frames", key)
    p.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    return key, p


def delete_media(media_id: str) -> None:
    root = _root("media").resolve()
    d = (root / media_id).resolve()
    if root in d.parents and d.exists():
        shutil.rmtree(d, ignore_errors=True)


def delete_frames(analysis_id: str) -> None:
    root = _root("frames").resolve()
    d = (root / analysis_id).resolve()
    if root in d.parents and d.exists():
        shutil.rmtree(d, ignore_errors=True)
