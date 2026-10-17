from fastapi import APIRouter, Depends, Request, Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..db import get_db
from ..deps import ApiError, current_user
from ..models import Analysis, Media, User
from ..schemas import SettingsIn, UserOut
from ..security import verify_password
from ..services import storage
from ..services.audit import audit
from ..services.reports import report_dict

router = APIRouter(prefix="/api/users/me", tags=["users"])


@router.patch("", response_model=UserOut)
def update_settings(body: SettingsIn, request: Request, user: User = Depends(current_user), db: Session = Depends(get_db)):
    data = body.model_dump(exclude_unset=True)
    if "display_name" in data and data["display_name"] is not None:
        user.display_name = data["display_name"].strip()
    if "retention_days" in data:
        user.retention_days = data["retention_days"]
    if "allow_model_improvement" in data and data["allow_model_improvement"] is not None:
        user.allow_model_improvement = data["allow_model_improvement"]
    db.commit()
    audit(db, "user.settings", user.id, request=request, fields=sorted(data))
    return user


@router.get("/export")
def export_data(user: User = Depends(current_user), db: Session = Depends(get_db)):
    """Machine-readable export of the user's account and analysis results (no media)."""
    analyses = db.scalars(select(Analysis).where(Analysis.user_id == user.id).order_by(Analysis.created_at)).all()
    import json

    body = json.dumps({"account": UserOut.model_validate(user).model_dump(mode="json"), "analyses": [report_dict(a) for a in analyses if a.status.value == "completed"]}, indent=2)
    return Response(body, media_type="application/json", headers={"Content-Disposition": 'attachment; filename="truthlens-export.json"', "Cache-Control": "private, no-store"})


@router.post("/delete-all-media", status_code=204)
def delete_all_media(request: Request, user: User = Depends(current_user), db: Session = Depends(get_db)):
    from datetime import datetime, timezone

    n = 0
    for m in db.scalars(select(Media).where(Media.user_id == user.id, Media.deleted_at.is_(None))):
        storage.delete_media(m.id)
        m.storage_key, m.deleted_at = None, datetime.now(timezone.utc)
        n += 1
    for a in db.scalars(select(Analysis).where(Analysis.user_id == user.id)):
        storage.delete_frames(a.id)
        for f in a.frames:
            f.image_key = f.overlay_key = None
    db.commit()
    audit(db, "media.delete_all", user.id, request=request, count=n)


@router.post("/delete-account", status_code=204)
def delete_account(body: dict, request: Request, response: Response, user: User = Depends(current_user), db: Session = Depends(get_db)):
    pw = body.get("password", "") if isinstance(body, dict) else ""
    if not verify_password(str(pw), user.password_hash):
        raise ApiError(400, "invalid_credentials", "Password is incorrect.")
    for m in db.scalars(select(Media).where(Media.user_id == user.id)):
        storage.delete_media(m.id)
    for a in db.scalars(select(Analysis).where(Analysis.user_id == user.id)):
        storage.delete_frames(a.id)
    uid = user.id
    db.delete(user)  # cascades to sessions, analyses, media, tokens
    db.commit()
    audit(db, "user.delete_account", None, uid, request)
    from .auth import _clear_cookies

    _clear_cookies(response)
