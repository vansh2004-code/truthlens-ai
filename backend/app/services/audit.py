from fastapi import Request
from sqlalchemy.orm import Session

from ..models import AuditEvent


def audit(db: Session, action: str, user_id: str | None = None, target: str = "", request: Request | None = None, **meta) -> None:
    ip = request.client.host if request and request.client else ""
    # Never put secrets, tokens or filenames' content in meta. Keep it to identifiers.
    db.add(AuditEvent(user_id=user_id, action=action, target=target, ip=ip, meta=meta))
    db.commit()
