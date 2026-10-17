"""Upload validation: size, extension, magic bytes, then ffprobe on the stored file.
ffprobe/ffmpeg run via argv lists (no shell), with timeouts and resource limits."""
import json
import resource
import subprocess
from dataclasses import dataclass
from pathlib import Path

from ..config import get_settings

ALLOWED = {
    # ext: (container label, mime)
    ".mp4": ("mp4", "video/mp4"),
    ".mov": ("mov", "video/quicktime"),
    ".m4v": ("mp4", "video/x-m4v"),
    ".webm": ("webm", "video/webm"),
    ".mkv": ("matroska", "video/x-matroska"),
    ".avi": ("avi", "video/x-msvideo"),
}


class ValidationError(Exception):
    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code
        self.message = message


def sniff_container(head: bytes) -> str | None:
    """Detect container from magic bytes, independent of extension/MIME."""
    if len(head) >= 12 and head[4:8] == b"ftyp":
        brand = head[8:12]
        return "mov" if brand == b"qt  " else "mp4"
    if head.startswith(b"\x1a\x45\xdf\xa3"):
        return "webm_or_mkv"
    if head[:4] == b"RIFF" and head[8:12] == b"AVI ":
        return "avi"
    return None


def check_signature(filename: str, head: bytes) -> tuple[str, str]:
    ext = Path(filename).suffix.lower()
    if ext not in ALLOWED:
        raise ValidationError("unsupported_extension", f"Unsupported file type '{ext or 'none'}'. Allowed: {', '.join(sorted(ALLOWED))}")
    sniffed = sniff_container(head)
    if sniffed is None:
        raise ValidationError("bad_signature", "File content does not look like a supported video container.")
    label, mime = ALLOWED[ext]
    ok = {
        "mp4": {"mp4", "mov"}, "mov": {"mov", "mp4"},
        "webm": {"webm_or_mkv"}, "matroska": {"webm_or_mkv"}, "avi": {"avi"},
    }[label]
    if sniffed not in ok:
        raise ValidationError("signature_mismatch", "File extension does not match its actual content.")
    return ext, mime


def _limits():
    s = get_settings()
    resource.setrlimit(resource.RLIMIT_CPU, (s.ffmpeg_cpu_seconds, s.ffmpeg_cpu_seconds))
    mem = s.ffmpeg_mem_mb * 1024 * 1024
    try:
        resource.setrlimit(resource.RLIMIT_AS, (mem * 4, mem * 4))
    except (ValueError, OSError):
        pass


def run_safe(argv: list[str], timeout: int = 60) -> subprocess.CompletedProcess:
    """Run a subprocess without a shell, with timeout and rlimits."""
    return subprocess.run(argv, capture_output=True, timeout=timeout, preexec_fn=_limits, check=False, shell=False)


@dataclass
class ProbeResult:
    container: str
    duration: float
    width: int
    height: int
    fps: float
    codec: str
    has_audio: bool


def probe(path: Path) -> ProbeResult:
    s = get_settings()
    try:
        r = run_safe(["ffprobe", "-v", "error", "-print_format", "json", "-show_format", "-show_streams", str(path)], timeout=30)
    except subprocess.TimeoutExpired:
        raise ValidationError("probe_timeout", "Timed out while inspecting the video.")
    if r.returncode != 0:
        raise ValidationError("malformed_media", "The video could not be parsed and appears to be corrupt or unsupported.")
    try:
        info = json.loads(r.stdout or b"{}")
    except json.JSONDecodeError:
        raise ValidationError("malformed_media", "The video metadata is unreadable.")
    streams = info.get("streams", [])
    video = next((x for x in streams if x.get("codec_type") == "video" and not x.get("disposition", {}).get("attached_pic")), None)
    if not video:
        raise ValidationError("no_video_stream", "No video stream found in the file.")
    fmt = info.get("format", {})
    try:
        duration = float(fmt.get("duration") or video.get("duration") or 0)
    except ValueError:
        duration = 0.0
    if duration <= 0:
        raise ValidationError("no_duration", "Could not determine the video duration.")
    if duration > s.max_duration_seconds:
        raise ValidationError("too_long", f"Video is {duration:.0f}s; the maximum is {s.max_duration_seconds}s.")
    w, h = int(video.get("width") or 0), int(video.get("height") or 0)
    if w < 32 or h < 32 or w > 8192 or h > 8192:
        raise ValidationError("bad_dimensions", f"Unsupported video dimensions {w}x{h}.")
    num, _, den = (video.get("avg_frame_rate") or "0/1").partition("/")
    try:
        fps = float(num) / float(den or 1) if float(den or 1) else 0.0
    except ValueError:
        fps = 0.0
    return ProbeResult(
        container=(fmt.get("format_name") or "").split(",")[0], duration=duration, width=w, height=h,
        fps=round(fps, 3), codec=video.get("codec_name", ""), has_audio=any(x.get("codec_type") == "audio" for x in streams),
    )
