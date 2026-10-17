from fastapi import APIRouter, Depends, Request
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..config import get_settings
from ..db import get_db
from ..deps import ApiError, admin_user
from ..ml.base import ModelUnavailableError
from ..ml.registry import get_classifier
from ..models import Analysis, AuditEvent, JobStatus, Media, Role, User
from ..models import Session as DBSession
from ..services.audit import audit
from ..worker.runner import purge_expired

router = APIRouter(prefix="/api/admin", tags=["admin"])


@router.get("/stats")
def stats(admin: User = Depends(admin_user), db: Session = Depends(get_db)):
    by_status = {k.value: v for k, v in db.execute(select(Analysis.status, func.count()).group_by(Analysis.status)).all()}
    verdicts = {(k.value if k else "none"): v for k, v in db.execute(select(Analysis.verdict, func.count()).where(Analysis.status == JobStatus.completed).group_by(Analysis.verdict)).all()}
    return {"users": db.scalar(select(func.count()).select_from(User)), "analyses": by_status, "verdicts": verdicts,
            "queued": by_status.get("queued", 0) + by_status.get("processing", 0),
            "media_bytes": db.scalar(select(func.coalesce(func.sum(Media.size_bytes), 0)).where(Media.deleted_at.is_(None)))}


@router.get("/model-health")
def model_health(load: bool = False, admin: User = Depends(admin_user)):
    s = get_settings()
    clf = get_classifier()
    out = {"configured_model": s.model_id, "revision": s.model_revision, "device_setting": s.device, "loaded": clf.info.version != "unloaded",
           "info": clf.info.__dict__, "thresholds": {"manipulation": s.manipulation_threshold, "inconclusive_low": s.inconclusive_low},
           "audio_enabled": s.enable_audio and bool(s.audio_model_id), "error": None}
    if load and not out["loaded"]:
        try:
            clf.load()
            out["loaded"], out["info"] = True, clf.info.__dict__
        except ModelUnavailableError as e:
            out["error"] = str(e)
    return out


@router.get("/users")
def users(page: int = 1, admin: User = Depends(admin_user), db: Session = Depends(get_db)):
    rows = db.scalars(select(User).order_by(User.created_at.desc()).offset((max(page, 1) - 1) * 50).limit(50)).all()
    counts = dict(db.execute(select(Analysis.user_id, func.count()).group_by(Analysis.user_id)).all())
    return [{"id": u.id, "email": u.email, "role": u.role.value, "is_active": u.is_active, "email_verified": u.email_verified,
             "created_at": u.created_at, "analyses": counts.get(u.id, 0)} for u in rows]


@router.patch("/users/{user_id}")
def update_user(user_id: str, body: dict, request: Request, admin: User = Depends(admin_user), db: Session = Depends(get_db)):
    u = db.get(User, user_id)
    if not u:
        raise ApiError(404, "not_found", "User not found.")
    if u.id == admin.id:
        raise ApiError(409, "self_edit", "You cannot change your own role or status.")
    if "is_active" in body:
        u.is_active = bool(body["is_active"])
        if not u.is_active:
            for s in db.scalars(select(DBSession).where(DBSession.user_id == u.id)):
                s.revoked = True
    if body.get("role") in ("user", "admin"):
        u.role = Role(body["role"])
    db.commit()
    audit(db, "admin.user_update", admin.id, u.id, request, changes=sorted(k for k in body if k in ("is_active", "role")))
    return {"id": u.id, "role": u.role.value, "is_active": u.is_active}


@router.get("/audit")
def audit_log(limit: int = 100, admin: User = Depends(admin_user), db: Session = Depends(get_db)):
    rows = db.scalars(select(AuditEvent).order_by(AuditEvent.created_at.desc()).limit(min(limit, 500))).all()
    return [{"id": r.id, "user_id": r.user_id, "action": r.action, "target": r.target, "ip": r.ip, "meta": r.meta, "created_at": r.created_at} for r in rows]


@router.post("/purge")
def purge(request: Request, admin: User = Depends(admin_user), db: Session = Depends(get_db)):
    res = purge_expired()
    audit(db, "admin.purge", admin.id, request=request, **res)
    return res
