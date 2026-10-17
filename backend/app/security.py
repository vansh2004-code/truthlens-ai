"""Password hashing (Argon2id), JWT access tokens, hashed opaque refresh/one-time tokens, CSRF, signed URLs."""
import hashlib
import hmac
import secrets
import time
from datetime import datetime, timedelta, timezone

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError, VerifyMismatchError

from .config import get_settings

_ph = PasswordHasher()  # argon2id defaults
ALGO = "HS256"
ACCESS_COOKIE = "tl_access"
REFRESH_COOKIE = "tl_refresh"
CSRF_COOKIE = "tl_csrf"


def hash_password(password: str) -> str:
    return _ph.hash(password)


def verify_password(password: str, hashed: str | None) -> bool:
    if not hashed:
        return False
    try:
        return _ph.verify(hashed, password)
    except (VerifyMismatchError, VerificationError, InvalidHashError):
        return False


def needs_rehash(hashed: str) -> bool:
    return _ph.check_needs_rehash(hashed)


def validate_password_strength(password: str) -> list[str]:
    problems = []
    if len(password) < 10:
        problems.append("Use at least 10 characters.")
    if len(password) > 128:
        problems.append("Use at most 128 characters.")
    if password.lower() == password or password.upper() == password:
        problems.append("Mix upper and lower case letters.")
    if not any(c.isdigit() for c in password):
        problems.append("Include at least one digit.")
    return problems


def create_access_token(user_id: str, role: str) -> str:
    s = get_settings()
    now = datetime.now(timezone.utc)
    payload = {"sub": user_id, "role": role, "iat": now, "exp": now + timedelta(minutes=s.access_token_minutes), "typ": "access"}
    return jwt.encode(payload, s.secret_key, algorithm=ALGO)


def decode_access_token(token: str) -> dict | None:
    try:
        data = jwt.decode(token, get_settings().secret_key, algorithms=[ALGO])
    except jwt.PyJWTError:
        return None
    return data if data.get("typ") == "access" else None


def new_opaque_token() -> tuple[str, str]:
    """Return (raw_token, sha256_hash). Only the hash is persisted."""
    raw = secrets.token_urlsafe(48)
    return raw, hash_token(raw)


def hash_token(raw: str) -> str:
    return hashlib.sha256(raw.encode()).hexdigest()


def new_csrf_token() -> str:
    return secrets.token_urlsafe(32)


def csrf_ok(cookie_val: str | None, header_val: str | None) -> bool:
    return bool(cookie_val and header_val and hmac.compare_digest(cookie_val, header_val))


def sign_download(resource: str, user_id: str, ttl: int | None = None) -> tuple[str, int]:
    """Return (signature, expires_epoch) binding resource+user+expiry. Verified server-side."""
    s = get_settings()
    exp = int(time.time()) + (ttl or s.signed_url_ttl_seconds)
    msg = f"{resource}|{user_id}|{exp}".encode()
    sig = hmac.new(s.secret_key.encode(), msg, hashlib.sha256).hexdigest()
    return sig, exp


def verify_download(resource: str, user_id: str, exp: int, sig: str) -> bool:
    if exp < int(time.time()):
        return False
    msg = f"{resource}|{user_id}|{exp}".encode()
    expected = hmac.new(get_settings().secret_key.encode(), msg, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, sig)
