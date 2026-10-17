"""Job execution shared by Celery and inline mode. Persists results transactionally."""
import logging
import threading
from datetime import datetime, timezone

from sqlalchemy import select

from ..config import get_settings
from ..db import SessionLocal
from ..ml.base import ModelUnavailableError
from ..ml.pipeline import run_pipeline
from ..ml.registry import get_classifier, get_face_detector
from ..models import Analysis, FrameEvidence, JobStatus, Media, ModelInference, Verdict
from ..services import storage

log = logging.getLogger("truthlens.runner")


class Cancelled(Exception):
    pass


def _now():
    return datetime.now(timezone.utc)


def execute_analysis(analysis_id: str) -> None:
    db = SessionLocal()
    try:
        a = db.get(Analysis, analysis_id)
        if not a or a.status in (JobStatus.cancelled, JobStatus.completed):
            return
        media = db.get(Media, a.media_id)
        if not media or not media.storage_key or media.deleted_at:
            a.status, a.verdict, a.error, a.finished_at = JobStatus.failed, Verdict.failed, "The source video is no longer available.", _now()
            db.commit()
            return
        a.status, a.started_at, a.stage, a.progress, a.error = JobStatus.processing, _now(), "starting", 0.02, None
        db.commit()

        def progress(p: float, stage: str) -> None:
            db.refresh(a)
            if a.status == JobStatus.cancelled:
                raise Cancelled()
            a.progress, a.stage = round(p, 3), stage
            db.commit()

        path = storage.safe_path("media", media.storage_key)
        try:
            res = run_pipeline(a.id, path, media.duration_seconds, media.has_audio, get_classifier(), get_face_detector(), progress)
        except Cancelled:
            storage.delete_frames(a.id)
            log.info("analysis %s cancelled", a.id)
            return
        except ModelUnavailableError as e:
            _fail(db, a, f"Detection model unavailable: {e}")
            return
        except Exception:  # noqa: BLE001
            log.exception("analysis %s failed", a.id)
            _fail(db, a, "Analysis failed due to an internal processing error.")
            return

        db.refresh(a)
        if a.status == JobStatus.cancelled:
            storage.delete_frames(a.id)
            return
        a.frames.clear()
        for fr in res.frames:
            a.frames.append(FrameEvidence(
                frame_index=fr.index, timestamp=fr.timestamp, face_detected=fr.face_detected, face_box=fr.face_box, track_id=fr.track_id,
                score=fr.score, flagged=fr.flagged, quality=fr.quality, note=fr.note, image_key=fr.image_key, overlay_key=fr.overlay_key))
        scored = [f.score for f in res.frames if f.score is not None]
        a.inferences = [ModelInference(
            model_name=res.model["name"], model_version=res.model["version"], device=res.model["device"], frames_analyzed=len(scored),
            mean_score=round(sum(scored) / len(scored), 4) if scored else None, max_score=max(scored) if scored else None,
            flagged_fraction=round(sum(f.flagged for f in res.frames if f.score is not None) / len(scored), 4) if scored else None,
            duration_ms=res.inference_ms,
            details={"license": res.model["license"], "fake_label": res.model["fake_label"], "source": res.model["source"],
                     "frames_sampled": res.frames_total, "frames_usable": res.frames_usable})]
        a.status, a.verdict, a.score, a.explanation = JobStatus.completed, res.verdict, res.score, res.explanation
        a.limitations, a.temporal, a.audio, a.config = res.limitations, res.temporal, res.audio, res.config
        a.progress, a.stage, a.finished_at, a.duration_ms = 1.0, "done", _now(), res.duration_ms
        db.commit()
        log.info("analysis %s completed verdict=%s", a.id, res.verdict.value)
    finally:
        db.close()


def _fail(db, a: Analysis, msg: str) -> None:
    db.rollback()
    a = db.get(Analysis, a.id)
    a.status, a.verdict, a.error, a.stage, a.finished_at = JobStatus.failed, Verdict.failed, msg, "failed", _now()
    db.commit()


def enqueue(analysis_id: str) -> str | None:
    """Dispatch to Celery, or a daemon thread when TL_RUN_JOBS_INLINE=true (dev/tests only)."""
    s = get_settings()
    if s.run_jobs_inline:
        t = threading.Thread(target=execute_analysis, args=(analysis_id,), daemon=True, name=f"analysis-{analysis_id[:6]}")
        t.start()
        return None
    from .tasks import process_analysis

    return process_analysis.apply_async(args=[analysis_id], retry=False, expires=get_settings().job_timeout_seconds * 4).id


def purge_expired() -> dict:
    """Delete media (and derived frame images) past retention. Analysis result rows are kept."""
    db = SessionLocal()
    n = 0
    try:
        for m in db.scalars(select(Media).where(Media.delete_after.is_not(None), Media.delete_after < _now(), Media.deleted_at.is_(None))):
            storage.delete_media(m.id)
            m.storage_key, m.deleted_at = None, _now()
            for a in db.scalars(select(Analysis).where(Analysis.media_id == m.id)):
                storage.delete_frames(a.id)
                for f in a.frames:
                    f.image_key = f.overlay_key = None
            n += 1
        db.commit()
    finally:
        db.close()
    return {"purged_media": n}
