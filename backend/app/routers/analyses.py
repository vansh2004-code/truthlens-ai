import hashlib
import logging
import os
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, File, Request, UploadFile
from fastapi.responses import FileResponse, Response
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from ..config import get_settings
from ..db import get_db
from ..deps import ApiError, verified_user
from ..limiter import limiter
from ..models import Analysis, JobStatus, Media, User, Verdict
from ..schemas import AnalysisDetail, AnalysisSummary, FrameOut, Page, SignedUrl
from ..security import sign_download
from ..services import storage, validation
from ..services.audit import audit
from ..services.reports import build_json_report, build_pdf_report
from ..worker.runner import enqueue

log = logging.getLogger("truthlens.analyses")
router = APIRouter(prefix="/api/analyses", tags=["analyses"])


def _now():
    return datetime.now(timezone.utc)


def _owned(db: Session, user: User, analysis_id: str) -> Analysis:
    a = db.get(Analysis, analysis_id)
    # 404 (not 403) for other users' analyses so existence is not disclosed.
    if not a or a.user_id != user.id:
        raise ApiError(404, "not_found", "Analysis not found.")
    return a


def summary(a: Analysis) -> AnalysisSummary:
    return AnalysisSummary(
        id=a.id, status=a.status.value, verdict=a.verdict.value if a.verdict else None, progress=a.progress, stage=a.stage,
        score=a.score, created_at=a.created_at, finished_at=a.finished_at, duration_ms=a.duration_ms,
        filename=a.media.original_filename, media_deleted=a.media.deleted_at is not None)


def detail(a: Analysis) -> AnalysisDetail:
    base = summary(a).model_dump()
    frames = [FrameOut(id=f.id, frame_index=f.frame_index, timestamp=f.timestamp, face_detected=f.face_detected, face_box=f.face_box,
                       track_id=f.track_id, score=f.score, flagged=f.flagged, quality=f.quality, note=f.note,
                       has_image=bool(f.image_key), has_overlay=bool(f.overlay_key)) for f in a.frames]
    return AnalysisDetail(**base, explanation=a.explanation, limitations=a.limitations or [], temporal=a.temporal or {}, audio=a.audio or {},
                          config=a.config or {}, error=a.error, media=a.media, inferences=a.inferences, frames=frames)


@router.post("", response_model=AnalysisSummary, status_code=202)
@limiter.limit("20/hour")
async def create_analysis(request: Request, file: UploadFile = File(...), db: Session = Depends(get_db), user: User = Depends(verified_user)):
    s = get_settings()
    name = os.path.basename(file.filename or "video")[:200]
    head = await file.read(64)
    ext, mime = _wrap(lambda: validation.check_signature(name, head))
    declared = (file.content_type or "").lower()
    if declared and not declared.startswith(("video/", "application/octet-stream")):
        raise ApiError(415, "bad_mime", f"Content type '{declared}' is not accepted.")
    active = db.scalar(select(func.count()).select_from(Analysis).where(Analysis.user_id == user.id, Analysis.status.in_([JobStatus.queued, JobStatus.processing])))
    if active >= 3:
        raise ApiError(429, "too_many_active", "You already have 3 analyses in progress. Wait for one to finish.")

    media_id = uuid.uuid4().hex
    key, path = storage.media_path(media_id, ext)
    h, size = hashlib.sha256(), 0
    try:
        with open(path, "wb") as out:
            os.chmod(path, 0o600)
            out.write(head); h.update(head); size += len(head)
            while chunk := await file.read(1024 * 1024):
                size += len(chunk)
                if size > s.max_upload_bytes:
                    raise ApiError(413, "too_large", f"File exceeds the {s.max_upload_mb} MB limit.")
                h.update(chunk); out.write(chunk)
        if size < 1024:
            raise ApiError(422, "too_small", "File is too small to be a valid video.")
        info = _wrap(lambda: validation.probe(path))
    except Exception:
        storage.delete_media(media_id)
        raise
    ttl_days = user.retention_days or s.retention_days
    media = Media(id=media_id, user_id=user.id, storage_key=key, original_filename=name, sha256=h.hexdigest(), size_bytes=size,
                  container=info.container, mime_type=mime, duration_seconds=info.duration, width=info.width, height=info.height,
                  fps=info.fps, has_audio=info.has_audio, codec=info.codec, delete_after=_now() + timedelta(days=ttl_days))
    a = Analysis(user_id=user.id, media_id=media_id, config={"frame_interval_seconds": s.frame_interval_seconds})
    db.add_all([media, a])
    db.commit()
    try:
        a.task_id = enqueue(a.id)
        db.commit()
    except Exception:  # noqa: BLE001 - broker down
        log.exception("could not enqueue analysis %s", a.id)
        a.status, a.verdict, a.error = JobStatus.failed, Verdict.failed, "The processing queue is unavailable. Please retry shortly."
        db.commit()
    audit(db, "analysis.create", user.id, a.id, request, size=size)
    db.refresh(a)
    return summary(a)


def _wrap(fn):
    try:
        return fn()
    except validation.ValidationError as e:
        raise ApiError(422, e.code, e.message)


@router.get("", response_model=Page)
def list_analyses(q: str = "", status: str = "", verdict: str = "", sort: str = "newest", page: int = 1, page_size: int = 20,
                  db: Session = Depends(get_db), user: User = Depends(verified_user)):
    page, page_size = max(1, page), min(max(1, page_size), 100)
    stmt = select(Analysis).join(Media, Analysis.media_id == Media.id).where(Analysis.user_id == user.id)
    if q.strip():
        like = f"%{q.strip().lower()}%"
        stmt = stmt.where(or_(func.lower(Media.original_filename).like(like), Analysis.id.like(f"{q.strip().lower()}%")))
    if status:
        if status not in JobStatus.__members__:
            raise ApiError(422, "bad_filter", "Unknown status filter.")
        stmt = stmt.where(Analysis.status == JobStatus[status])
    if verdict:
        if verdict not in Verdict.__members__:
            raise ApiError(422, "bad_filter", "Unknown verdict filter.")
        stmt = stmt.where(Analysis.verdict == Verdict[verdict])
    total = db.scalar(select(func.count()).select_from(stmt.subquery()))
    order = {"newest": Analysis.created_at.desc(), "oldest": Analysis.created_at.asc(), "score": Analysis.score.desc().nulls_last()}.get(sort, Analysis.created_at.desc())
    rows = db.scalars(stmt.order_by(order).offset((page - 1) * page_size).limit(page_size)).all()
    return Page(items=[summary(a) for a in rows], total=total, page=page, page_size=page_size)


@router.get("/stats")
def my_stats(db: Session = Depends(get_db), user: User = Depends(verified_user)):
    rows = db.execute(select(Analysis.verdict, func.count()).where(Analysis.user_id == user.id, Analysis.status == JobStatus.completed).group_by(Analysis.verdict)).all()
    by_status = dict(db.execute(select(Analysis.status, func.count()).where(Analysis.user_id == user.id).group_by(Analysis.status)).all())
    recent = db.execute(select(func.date(Analysis.created_at), func.count()).where(Analysis.user_id == user.id, Analysis.created_at > _now() - timedelta(days=30)).group_by(func.date(Analysis.created_at)).order_by(func.date(Analysis.created_at))).all()
    return {"verdicts": {(k.value if k else "none"): v for k, v in rows}, "status": {k.value: v for k, v in by_status.items()},
            "total": sum(by_status.values()), "per_day": [{"date": str(d), "count": c} for d, c in recent]}


@router.get("/{analysis_id}", response_model=AnalysisDetail)
def get_analysis(analysis_id: str, db: Session = Depends(get_db), user: User = Depends(verified_user)):
    return detail(_owned(db, user, analysis_id))


@router.get("/{analysis_id}/frames/{frame_id}/{kind}")
def frame_image(analysis_id: str, frame_id: str, kind: str, db: Session = Depends(get_db), user: User = Depends(verified_user)):
    a = _owned(db, user, analysis_id)
    if kind not in ("image", "overlay"):
        raise ApiError(404, "not_found", "Not found.")
    f = next((x for x in a.frames if x.id == frame_id), None)
    key = (f.image_key if kind == "image" else f.overlay_key) if f else None
    if not key:
        raise ApiError(404, "not_found", "Image not available (it may have been deleted per your retention policy).")
    p = storage.safe_path("frames", key)
    if not p.exists():
        raise ApiError(404, "not_found", "Image not available.")
    return FileResponse(p, media_type="image/jpeg", headers={"Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff"})


@router.post("/{analysis_id}/retry", response_model=AnalysisSummary, status_code=202)
def retry(analysis_id: str, request: Request, db: Session = Depends(get_db), user: User = Depends(verified_user)):
    a = _owned(db, user, analysis_id)
    if a.status not in (JobStatus.failed, JobStatus.cancelled):
        raise ApiError(409, "not_retryable", "Only failed or cancelled analyses can be retried.")
    if a.media.deleted_at:
        raise ApiError(409, "media_deleted", "The source video has been deleted, so this analysis cannot be re-run.")
    a.status, a.verdict, a.error, a.progress, a.stage = JobStatus.queued, None, None, 0, "queued"
    db.commit()
    try:
        a.task_id = enqueue(a.id)
        db.commit()
    except Exception:  # noqa: BLE001
        a.status, a.verdict, a.error = JobStatus.failed, Verdict.failed, "The processing queue is unavailable."
        db.commit()
    audit(db, "analysis.retry", user.id, a.id, request)
    return summary(a)


@router.post("/{analysis_id}/cancel", response_model=AnalysisSummary)
def cancel(analysis_id: str, request: Request, db: Session = Depends(get_db), user: User = Depends(verified_user)):
    a = _owned(db, user, analysis_id)
    if a.status not in (JobStatus.queued, JobStatus.processing):
        raise ApiError(409, "not_cancellable", "This analysis is not running.")
    a.status, a.stage, a.finished_at = JobStatus.cancelled, "cancelled", _now()
    db.commit()
    audit(db, "analysis.cancel", user.id, a.id, request)
    return summary(a)


@router.delete("/{analysis_id}", status_code=204)
def delete_analysis(analysis_id: str, request: Request, db: Session = Depends(get_db), user: User = Depends(verified_user)):
    a = _owned(db, user, analysis_id)
    media = a.media
    storage.delete_frames(a.id)
    shared = db.scalar(select(func.count()).select_from(Analysis).where(Analysis.media_id == media.id, Analysis.id != a.id))
    db.delete(a)
    if not shared:
        storage.delete_media(media.id)
        db.delete(media)
    db.commit()
    audit(db, "analysis.delete", user.id, analysis_id, request)


@router.delete("/{analysis_id}/media", status_code=204)
def delete_media_only(analysis_id: str, request: Request, db: Session = Depends(get_db), user: User = Depends(verified_user)):
    """Delete the stored video and extracted face frames now, keeping the numeric results."""
    a = _owned(db, user, analysis_id)
    if a.status == JobStatus.processing:
        raise ApiError(409, "busy", "Cancel the running analysis first.")
    m = a.media
    storage.delete_media(m.id)
    storage.delete_frames(a.id)
    m.storage_key, m.deleted_at = None, _now()
    for f in a.frames:
        f.image_key = f.overlay_key = None
    db.commit()
    audit(db, "media.delete", user.id, a.id, request)


@router.get("/{analysis_id}/report.{fmt}")
def download_report(analysis_id: str, fmt: str, request: Request, db: Session = Depends(get_db), user: User = Depends(verified_user)):
    a = _owned(db, user, analysis_id)
    return _report_response(db, a, fmt, user, request)


@router.post("/{analysis_id}/report-link/{fmt}", response_model=SignedUrl)
def report_link(analysis_id: str, fmt: str, db: Session = Depends(get_db), user: User = Depends(verified_user)):
    _owned(db, user, analysis_id)
    if fmt not in ("pdf", "json"):
        raise ApiError(404, "not_found", "Unknown report format.")
    sig, exp = sign_download(f"report:{analysis_id}:{fmt}", user.id)
    return SignedUrl(url=f"/api/signed/report/{analysis_id}.{fmt}?uid={user.id}&exp={exp}&sig={sig}", expires_at=exp)


def _report_response(db: Session, a: Analysis, fmt: str, user: User, request: Request | None) -> Response:
    if a.status != JobStatus.completed:
        raise ApiError(409, "not_ready", "The analysis has not completed, so no report is available.")
    from ..models import Report

    if fmt == "json":
        body, media, fname = build_json_report(a), "application/json", f"truthlens-{a.id}.json"
    elif fmt == "pdf":
        body, media, fname = build_pdf_report(a), "application/pdf", f"truthlens-{a.id}.pdf"
    else:
        raise ApiError(404, "not_found", "Unknown report format.")
    db.add(Report(analysis_id=a.id, user_id=user.id, format=fmt))
    db.commit()
    audit(db, "report.download", user.id, a.id, request, format=fmt)
    return Response(body, media_type=media, headers={"Content-Disposition": f'attachment; filename="{fname}"', "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, noarchive"})
