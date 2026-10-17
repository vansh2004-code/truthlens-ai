from fastapi import Depends, HTTPException, Request
from sqlalchemy.orm import Session

from .db import get_db
from .models import Role, User
from .security import ACCESS_COOKIE, CSRF_COOKIE, csrf_ok, decode_access_token

SAFE_METHODS = {"GET", "HEAD", "OPTIONS"}


class ApiError(HTTPException):
    def __init__(self, status: int, code: str, message: str, details=None):
        super().__init__(status_code=status, detail={"code": code, "message": message, "details": details})


def current_user(request: Request, db: Session = Depends(get_db)) -> User:
    token = request.cookies.get(ACCESS_COOKIE)
    if not token:
        auth = request.headers.get("authorization", "")
        if auth.lower().startswith("bearer "):
            token = auth[7:]
            bearer = True
        else:
            bearer = False
    else:
        bearer = False
    if not token:
        raise ApiError(401, "not_authenticated", "Sign in to continue.")
    data = decode_access_token(token)
    if not data:
        raise ApiError(401, "invalid_token", "Your session has expired. Please sign in again.")
    # CSRF: double-submit cookie required for state-changing requests authenticated by cookie.
    if not bearer and request.method not in SAFE_METHODS:
        if not csrf_ok(request.cookies.get(CSRF_COOKIE), request.headers.get("x-csrf-token")):
            raise ApiError(403, "csrf_failed", "Missing or invalid CSRF token.")
    user = db.get(User, data["sub"])
    if not user or not user.is_active:
        raise ApiError(401, "invalid_token", "Account not found or disabled.")
    return user


def verified_user(user: User = Depends(current_user)) -> User:
    from .config import get_settings

    if get_settings().require_email_verification and not user.email_verified:
        raise ApiError(403, "email_unverified", "Verify your email address to use this feature.")
    return user


def admin_user(user: User = Depends(current_user)) -> User:
    if user.role != Role.admin:
        raise ApiError(403, "forbidden", "Administrator access required.")
    return user
