"""Environment-based configuration. All secrets come from environment variables."""
from functools import lru_cache
from pathlib import Path

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_prefix="TL_", extra="ignore")

    env: str = "development"  # development | test | production
    database_url: str = "postgresql+psycopg://truthlens:truthlens@localhost:5432/truthlens"
    redis_url: str = "redis://localhost:6379/0"

    # Auth
    secret_key: str = Field(default="", description="JWT signing key; REQUIRED in production")
    access_token_minutes: int = 30
    refresh_token_days: int = 14
    cookie_secure: bool = False
    cookie_samesite: str = "lax"
    cors_origins: str = "http://localhost:5173"
    frontend_url: str = "http://localhost:5173"
    require_email_verification: bool = False
    admin_emails: str = ""  # comma-separated; these emails become admin on registration (works in production)
    static_dir: Path | None = None  # if set, serve the built SPA from the API (single-container deployments)
    google_client_id: str = ""
    google_client_secret: str = ""

    # Email (SMTP). If unset, emails are written to the log in development only.
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    mail_from: str = "TruthLens AI <no-reply@localhost>"

    # Storage
    storage_dir: Path = Path("./data/media")
    frames_dir: Path = Path("./data/frames")
    max_upload_mb: int = 200
    max_duration_seconds: int = 300
    retention_days: int = 7
    signed_url_ttl_seconds: int = 300

    # Processing
    frame_interval_seconds: float = 1.0
    max_frames: int = 120
    face_margin: float = 0.25
    job_timeout_seconds: int = 900
    ffmpeg_cpu_seconds: int = 120
    ffmpeg_mem_mb: int = 2048
    run_jobs_inline: bool = False  # run in a thread instead of Celery (single-container/dev/test)
    static_dir: Path | None = None  # if set and present, serve the built frontend (single-container mode)

    # Model
    model_id: str = "prithivMLmods/Deep-Fake-Detector-v2-Model"
    model_revision: str = "3a99ae26f52c7ac7c3a53103b6cf3a8b617f7093"  # commit verified to load and run in CI
    model_cache_dir: Path = Path("./data/models")
    fake_label_keywords: str = "fake,deepfake,manipulated,synthetic"
    device: str = "auto"  # auto | cpu | cuda
    manipulation_threshold: float = 0.70
    inconclusive_low: float = 0.40
    enable_audio: bool = False
    audio_model_id: str = ""

    # Rate limits
    rate_limit_default: str = "120/minute"
    rate_limit_auth: str = "10/minute"

    @field_validator("cookie_samesite")
    @classmethod
    def _samesite(cls, v: str) -> str:
        v = v.lower()
        if v not in {"lax", "strict", "none"}:
            raise ValueError("cookie_samesite must be lax, strict or none")
        return v

    @property
    def admin_email_set(self) -> set[str]:
        return {e.strip().lower() for e in self.admin_emails.split(",") if e.strip()}

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def max_upload_bytes(self) -> int:
        return self.max_upload_mb * 1024 * 1024

    def validate_for_production(self) -> None:
        if self.env == "production":
            if len(self.secret_key) < 32:
                raise RuntimeError("TL_SECRET_KEY must be set to >=32 random characters in production")
            if not self.cookie_secure:
                raise RuntimeError("TL_COOKIE_SECURE must be true in production")
            if "*" in self.cors_origin_list:
                raise RuntimeError("Wildcard CORS is not allowed in production")


@lru_cache
def get_settings() -> Settings:
    s = Settings()
    if not s.secret_key and s.env != "production":
        # Ephemeral per-process key for dev/test only. Sessions reset on restart.
        import secrets

        s.secret_key = secrets.token_urlsafe(48)
    s.validate_for_production()
    return s
