import logging
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Request, Response
from sqlalchemy import select
from sqlalchemy.orm import Session as DBSession

from ..config import get_settings
from ..db import get_db
from ..deps import ApiError, current_user
from ..limiter import limiter
from ..models import OneTimeToken, Role, Session, User
from ..schemas import ChangePasswordIn, EmailIn, LoginIn, RegisterIn, ResetIn, TokenIn, UserOut
from ..security import (
    ACCESS_COOKIE,
    CSRF_COOKIE,
    REFRESH_COOKIE,
    create_access_token,
    hash_password,
    hash_token,
    needs_rehash,
    new_csrf_token,
    new_opaque_token,
    validate_password_strength,
    verify_password,
)
from ..services.audit import audit
from ..services.email import send_email

log = logging.getLogger("truthlens.auth")
router = APIRouter(prefix="/api/auth", tags=["auth"])
LOCK_AFTER, LOCK_MINUTES = 8, 15


def _now():
    return datetime.now(timezone.utc)


def _aware(dt: datetime) -> datetime:
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def _set_cookies(resp: Response, user: User, db: DBSession, request: Request) -> None:
    s = get_settings()
    raw, h = new_opaque_token()
    db.add(Session(user_id=user.id, token_hash=h, user_agent=request.headers.get("user-agent", "")[:300],
                   expires_at=_now() + timedelta(days=s.refresh_token_days)))
    db.commit()
    common = dict(secure=s.cookie_secure, samesite=s.cookie_samesite, path="/")
    resp.set_cookie(ACCESS_COOKIE, create_access_token(user.id, user.role.value), max_age=s.access_token_minutes * 60, httponly=True, **common)
    resp.set_cookie(REFRESH_COOKIE, raw, max_age=s.refresh_token_days * 86400, httponly=True, **{**common, "path": "/api/auth"})
    # CSRF cookie is readable by JS by design (double-submit); it carries no authority by itself.
    resp.set_cookie(CSRF_COOKIE, new_csrf_token(), max_age=s.refresh_token_days * 86400, httponly=False, **common)


def _clear_cookies(resp: Response) -> None:
    for name, path in ((ACCESS_COOKIE, "/"), (REFRESH_COOKIE, "/api/auth"), (CSRF_COOKIE, "/")):
        resp.delete_cookie(name, path=path)


def _issue_token(db: DBSession, user: User, purpose: str, hours: int) -> str:
    raw, h = new_opaque_token()
    db.add(OneTimeToken(user_id=user.id, purpose=purpose, token_hash=h, expires_at=_now() + timedelta(hours=hours)))
    db.commit()
    return raw


def _consume(db: DBSession, raw: str, purpose: str) -> User:
    t = db.scalar(select(OneTimeToken).where(OneTimeToken.token_hash == hash_token(raw), OneTimeToken.purpose == purpose))
    if not t or t.used or _aware(t.expires_at) < _now():
        raise ApiError(400, "invalid_token", "This link is invalid or has expired.")
    t.used = True
    user = db.get(User, t.user_id)
    db.commit()
    if not user:
        raise ApiError(400, "invalid_token", "This link is invalid or has expired.")
    return user


def _send_verification(db: DBSession, user: User) -> None:
    s = get_settings()
    raw = _issue_token(db, user, "verify_email", 48)
    send_email(user.email, "Verify your TruthLens AI email", f"Confirm your email:\n{s.frontend_url}/verify-email?token={raw}\n\nThis link expires in 48 hours.")


@router.post("/register", response_model=UserOut, status_code=201)
@limiter.limit(lambda: get_settings().rate_limit_auth)
def register(request: Request, body: RegisterIn, response: Response, db: DBSession = Depends(get_db)):
    problems = validate_password_strength(body.password)
    if problems:
        raise ApiError(422, "weak_password", "Password does not meet requirements.", problems)
    email = body.email.lower()
    if db.scalar(select(User).where(User.email == email)):
        # Same response shape as success would leak enumeration via status; we accept the 409 trade-off for UX
        # but rate-limit this endpoint. Documented in docs/SECURITY.md.
        raise ApiError(409, "email_taken", "An account with this email already exists.")
    first = db.scalar(select(User.id).limit(1)) is None
    user = User(email=email, password_hash=hash_password(body.password), display_name=body.display_name.strip() or email.split("@")[0],
                role=Role.admin if (first and get_settings().env != "production") or email in get_settings().admin_email_set else Role.user)
    db.add(user)
    db.commit()
    audit(db, "user.register", user.id, request=request)
    _send_verification(db, user)
    _set_cookies(response, user, db, request)
    return user


@router.post("/login", response_model=UserOut)
@limiter.limit(lambda: get_settings().rate_limit_auth)
def login(request: Request, body: LoginIn, response: Response, db: DBSession = Depends(get_db)):
    user = db.scalar(select(User).where(User.email == body.email.lower()))
    bad = ApiError(401, "invalid_credentials", "Incorrect email or password.")
    if not user:
        verify_password(body.password, "$argon2id$v=19$m=65536,t=3,p=4$c29tZXNhbHRzb21lc2FsdA$K7MnLwLpL3dPqbT3lQmV0y1Yb9d9kGZ3jv0bY2mEw5s")  # timing equalization
        raise bad
    if user.locked_until and _aware(user.locked_until) > _now():
        raise ApiError(429, "account_locked", "Too many failed attempts. Try again later.")
    if not verify_password(body.password, user.password_hash):
        user.failed_logins += 1
        if user.failed_logins >= LOCK_AFTER:
            user.locked_until = _now() + timedelta(minutes=LOCK_MINUTES)
            user.failed_logins = 0
            audit(db, "user.locked", user.id, request=request)
        db.commit()
        raise bad
    if not user.is_active:
        raise ApiError(403, "disabled", "This account is disabled.")
    user.failed_logins, user.locked_until = 0, None
    if needs_rehash(user.password_hash):
        user.password_hash = hash_password(body.password)
    db.commit()
    audit(db, "user.login", user.id, request=request)
    _set_cookies(response, user, db, request)
    return user


@router.post("/refresh", response_model=UserOut)
@limiter.limit("60/minute")
def refresh(request: Request, response: Response, db: DBSession = Depends(get_db)):
    from ..security import csrf_ok

    if not csrf_ok(request.cookies.get(CSRF_COOKIE), request.headers.get("x-csrf-token")):
        raise ApiError(403, "csrf_failed", "Missing or invalid CSRF token.")
    raw = request.cookies.get(REFRESH_COOKIE)
    sess = db.scalar(select(Session).where(Session.token_hash == hash_token(raw))) if raw else None
    if not sess or sess.revoked or _aware(sess.expires_at) < _now():
        if sess and sess.revoked:  # reuse of a rotated token -> revoke the family
            for s2 in db.scalars(select(Session).where(Session.user_id == sess.user_id)):
                s2.revoked = True
            db.commit()
        _clear_cookies(response)
        raise ApiError(401, "invalid_session", "Session expired. Please sign in again.")
    sess.revoked = True  # rotation
    db.commit()
    user = db.get(User, sess.user_id)
    if not user or not user.is_active:
        raise ApiError(401, "invalid_session", "Session expired.")
    _set_cookies(response, user, db, request)
    return user


@router.post("/logout", status_code=204)
def logout(request: Request, response: Response, db: DBSession = Depends(get_db)):
    raw = request.cookies.get(REFRESH_COOKIE)
    if raw:
        sess = db.scalar(select(Session).where(Session.token_hash == hash_token(raw)))
        if sess:
            sess.revoked = True
            db.commit()
    _clear_cookies(response)


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(current_user)):
    return user


@router.post("/verify-email", status_code=204)
@limiter.limit(lambda: get_settings().rate_limit_auth)
def verify_email(request: Request, body: TokenIn, db: DBSession = Depends(get_db)):
    user = _consume(db, body.token, "verify_email")
    user.email_verified = True
    db.commit()
    audit(db, "user.email_verified", user.id, request=request)


@router.post("/resend-verification", status_code=204)
@limiter.limit("3/minute")
def resend_verification(request: Request, user: User = Depends(current_user), db: DBSession = Depends(get_db)):
    if not user.email_verified:
        _send_verification(db, user)


@router.post("/forgot-password", status_code=204)
@limiter.limit(lambda: get_settings().rate_limit_auth)
def forgot_password(request: Request, body: EmailIn, db: DBSession = Depends(get_db)):
    # Always 204 so the endpoint does not reveal whether an account exists.
    user = db.scalar(select(User).where(User.email == body.email.lower()))
    if user and user.is_active:
        raw = _issue_token(db, user, "reset_password", 1)
        send_email(user.email, "Reset your TruthLens AI password",
                   f"Reset your password:\n{get_settings().frontend_url}/reset-password?token={raw}\n\nThis link expires in 1 hour. If you didn't request it, ignore this email.")
        audit(db, "user.password_reset_requested", user.id, request=request)


@router.post("/reset-password", status_code=204)
@limiter.limit(lambda: get_settings().rate_limit_auth)
def reset_password(request: Request, body: ResetIn, db: DBSession = Depends(get_db)):
    problems = validate_password_strength(body.password)
    if problems:
        raise ApiError(422, "weak_password", "Password does not meet requirements.", problems)
    user = _consume(db, body.token, "reset_password")
    user.password_hash = hash_password(body.password)
    user.failed_logins, user.locked_until = 0, None
    for s in db.scalars(select(Session).where(Session.user_id == user.id)):
        s.revoked = True  # sign out everywhere
    db.commit()
    audit(db, "user.password_reset", user.id, request=request)


@router.post("/change-password", status_code=204)
@limiter.limit("5/minute")
def change_password(request: Request, body: ChangePasswordIn, user: User = Depends(current_user), db: DBSession = Depends(get_db)):
    if not verify_password(body.current_password, user.password_hash):
        raise ApiError(400, "invalid_credentials", "Current password is incorrect.")
    problems = validate_password_strength(body.new_password)
    if problems:
        raise ApiError(422, "weak_password", "Password does not meet requirements.", problems)
    user.password_hash = hash_password(body.new_password)
    db.commit()
    audit(db, "user.password_changed", user.id, request=request)
