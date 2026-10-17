from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from ..db import get_db
from ..deps import ApiError
from ..models import Analysis, User
from ..security import verify_download
from .analyses import _report_response

router = APIRouter(prefix="/api/signed", tags=["signed"])


@router.get("/report/{name}")
def signed_report(name: str, uid: str, exp: int, sig: str, request: Request, db: Session = Depends(get_db)):
    """Expiring, user-bound link. Authorization comes from the HMAC signature; no cookies needed (e.g. open on another device)."""
    analysis_id, _, fmt = name.rpartition(".")
    if not verify_download(f"report:{analysis_id}:{fmt}", uid, exp, sig):
        raise ApiError(403, "bad_link", "This link is invalid or has expired.")
    a, user = db.get(Analysis, analysis_id), db.get(User, uid)
    if not a or not user or a.user_id != uid or not user.is_active:
        raise ApiError(404, "not_found", "Not found.")
    return _report_response(db, a, fmt, user, request)
