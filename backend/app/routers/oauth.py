"""Optional Google OAuth (authorization-code flow, server-side exchange). Disabled unless
TL_GOOGLE_CLIENT_ID/SECRET are set. NOTE: not exercised in automated tests (needs real credentials)."""
import secrets
from urllib.parse import urlencode

import httpx
from fastapi import APIRouter, Depends, Request
from fastapi.responses import RedirectResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import get_settings
from ..db import get_db
from ..deps import ApiError
from ..models import User
from ..services.audit import audit
from .auth import _set_cookies

router = APIRouter(prefix="/api/auth/google", tags=["auth"])
STATE_COOKIE = "tl_oauth_state"


def _redirect_uri() -> str:
    return f"{get_settings().frontend_url.rstrip('/')}/api/auth/google/callback"


@router.get("/start")
def start():
    s = get_settings()
    if not (s.google_client_id and s.google_client_secret):
        raise ApiError(501, "oauth_not_configured", "Google sign-in is not configured on this server.")
    state = secrets.token_urlsafe(24)
    q = urlencode({"client_id": s.google_client_id, "redirect_uri": _redirect_uri(), "response_type": "code", "scope": "openid email profile", "state": state, "prompt": "select_account"})
    resp = RedirectResponse(f"https://accounts.google.com/o/oauth2/v2/auth?{q}")
    resp.set_cookie(STATE_COOKIE, state, max_age=600, httponly=True, secure=s.cookie_secure, samesite="lax", path="/api/auth/google")
    return resp


@router.get("/callback")
def callback(request: Request, code: str = "", state: str = "", db: Session = Depends(get_db)):
    s = get_settings()
    if not (s.google_client_id and s.google_client_secret):
        raise ApiError(501, "oauth_not_configured", "Google sign-in is not configured on this server.")
    cookie = request.cookies.get(STATE_COOKIE, "")
    if not code or not state or not secrets.compare_digest(cookie, state):
        raise ApiError(400, "oauth_state", "Sign-in could not be verified. Please try again.")
    with httpx.Client(timeout=10) as c:
        tok = c.post("https://oauth2.googleapis.com/token", data={"code": code, "client_id": s.google_client_id, "client_secret": s.google_client_secret, "redirect_uri": _redirect_uri(), "grant_type": "authorization_code"})
        if tok.status_code != 200:
            raise ApiError(400, "oauth_exchange", "Google sign-in failed.")
        info = c.get("https://openidconnect.googleapis.com/v1/userinfo", headers={"Authorization": f"Bearer {tok.json()['access_token']}"})
        if info.status_code != 200:
            raise ApiError(400, "oauth_exchange", "Google sign-in failed.")
    p = info.json()
    if not p.get("email") or not p.get("email_verified"):
        raise ApiError(400, "oauth_email", "Your Google account email is not verified.")
    email = p["email"].lower()
    user = db.scalar(select(User).where(User.google_sub == p["sub"])) or db.scalar(select(User).where(User.email == email))
    if user is None:
        user = User(email=email, google_sub=p["sub"], display_name=p.get("name", email.split("@")[0]), email_verified=True)
        db.add(user)
    else:
        user.google_sub, user.email_verified = user.google_sub or p["sub"], True
    db.commit()
    if not user.is_active:
        raise ApiError(403, "disabled", "This account is disabled.")
    audit(db, "user.login_google", user.id, request=request)
    resp = RedirectResponse(f"{s.frontend_url}/dashboard")
    _set_cookies(resp, user, db, request)
    resp.delete_cookie(STATE_COOKIE, path="/api/auth/google")
    return resp
