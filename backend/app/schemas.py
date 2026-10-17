from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class ORM(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class ErrorBody(BaseModel):
    code: str
    message: str
    details: Any | None = None


class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=10, max_length=128)
    display_name: str = Field(default="", max_length=120)


class LoginIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class EmailIn(BaseModel):
    email: EmailStr


class TokenIn(BaseModel):
    token: str = Field(min_length=10, max_length=200)


class ResetIn(TokenIn):
    password: str = Field(min_length=10, max_length=128)


class ChangePasswordIn(BaseModel):
    current_password: str
    new_password: str = Field(min_length=10, max_length=128)


class UserOut(ORM):
    id: str
    email: str
    display_name: str
    role: str
    email_verified: bool
    retention_days: int | None
    allow_model_improvement: bool
    created_at: datetime


class SettingsIn(BaseModel):
    display_name: str | None = Field(default=None, max_length=120)
    retention_days: int | None = Field(default=None, ge=1, le=365)
    allow_model_improvement: bool | None = None


class MediaOut(ORM):
    id: str
    original_filename: str
    size_bytes: int
    container: str
    duration_seconds: float
    width: int
    height: int
    fps: float
    codec: str
    has_audio: bool
    sha256: str
    created_at: datetime
    delete_after: datetime | None
    deleted_at: datetime | None


class FrameOut(ORM):
    id: str
    frame_index: int
    timestamp: float
    face_detected: bool
    face_box: list | None
    track_id: int | None
    score: float | None
    flagged: bool
    quality: dict
    note: str
    has_image: bool = False
    has_overlay: bool = False


class InferenceOut(ORM):
    model_name: str
    model_version: str
    modality: str
    device: str
    frames_analyzed: int
    mean_score: float | None
    max_score: float | None
    flagged_fraction: float | None
    duration_ms: int
    details: dict


class AnalysisSummary(ORM):
    id: str
    status: str
    verdict: str | None
    progress: float
    stage: str
    score: float | None
    created_at: datetime
    finished_at: datetime | None
    duration_ms: int | None
    filename: str
    media_deleted: bool


class AnalysisDetail(AnalysisSummary):
    explanation: str
    limitations: list[str]
    temporal: dict
    audio: dict
    config: dict
    error: str | None
    media: MediaOut
    inferences: list[InferenceOut]
    frames: list[FrameOut]
    score_note: str = "Uncalibrated model score; not a probability of manipulation."


class Page(BaseModel):
    items: list[AnalysisSummary]
    total: int
    page: int
    page_size: int


class AdminStats(BaseModel):
    users: int
    analyses: dict[str, int]
    verdicts: dict[str, int]
    queued: int
    media_bytes: int


class SignedUrl(BaseModel):
    url: str
    expires_at: int
