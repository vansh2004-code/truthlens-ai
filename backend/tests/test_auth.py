from fastapi.testclient import TestClient

from app.main import app
from tests.conftest import make_client_user


def test_register_login_me_logout(client):
    r = client.post("/api/auth/register", json={"email": "x@example.com", "password": "Str0ngPassw0rd"})
    assert r.status_code == 201 and r.json()["email"] == "x@example.com"
    assert "password" not in r.text
    assert client.get("/api/auth/me").status_code == 200
    client.headers["X-CSRF-Token"] = client.cookies.get("tl_csrf")
    assert client.post("/api/auth/logout").status_code == 204
    c2 = TestClient(app)
    assert c2.get("/api/auth/me").status_code == 401
    r = c2.post("/api/auth/login", json={"email": "x@example.com", "password": "Str0ngPassw0rd"})
    assert r.status_code == 200


def test_weak_password_rejected(client):
    r = client.post("/api/auth/register", json={"email": "w@example.com", "password": "alllowercase1"})
    assert r.status_code == 422 and r.json()["error"]["code"] == "weak_password"


def test_duplicate_email(client):
    body = {"email": "d@example.com", "password": "Str0ngPassw0rd"}
    assert client.post("/api/auth/register", json=body).status_code == 201
    assert TestClient(app).post("/api/auth/register", json=body).status_code == 409


def test_wrong_password_and_lockout():
    make_client_user("l@example.com")
    c = TestClient(app)
    for _ in range(8):
        assert c.post("/api/auth/login", json={"email": "l@example.com", "password": "wrong-Password1"}).status_code == 401
    r = c.post("/api/auth/login", json={"email": "l@example.com", "password": "Str0ngPassw0rd"})
    assert r.status_code == 429 and r.json()["error"]["code"] == "account_locked"


def test_csrf_required_for_cookie_auth(user_client):
    c = TestClient(app)
    c.cookies.update(user_client.cookies)
    r = c.patch("/api/users/me", json={"display_name": "x"})  # no X-CSRF-Token
    assert r.status_code == 403 and r.json()["error"]["code"] == "csrf_failed"


def test_unauthenticated_blocked():
    c = TestClient(app)
    for path in ("/api/analyses", "/api/analyses/stats", "/api/admin/stats"):
        assert c.get(path).status_code == 401


def test_refresh_rotation_and_reuse_detection(user_client):
    old = user_client.cookies.get("tl_refresh", path="/api/auth")
    assert user_client.post("/api/auth/refresh").status_code == 200
    thief = TestClient(app)
    thief.cookies.set("tl_refresh", old, path="/api/auth")
    thief.headers["X-CSRF-Token"] = "x"
    thief.cookies.set("tl_csrf", "x")
    assert thief.post("/api/auth/refresh").status_code == 401  # reused rotated token
    user_client.headers["X-CSRF-Token"] = user_client.cookies.get("tl_csrf")
    assert user_client.post("/api/auth/refresh").status_code == 401  # family revoked


def test_password_reset_flow(caplog):
    import logging
    import re

    make_client_user("r@example.com")
    c = TestClient(app)
    with caplog.at_level(logging.WARNING, logger="truthlens.email"):
        assert c.post("/api/auth/forgot-password", json={"email": "r@example.com"}).status_code == 204
        assert c.post("/api/auth/forgot-password", json={"email": "nobody@example.com"}).status_code == 204  # no enumeration
    token = re.findall(r"reset-password\?token=([A-Za-z0-9_-]+)", caplog.text)[-1]
    assert c.post("/api/auth/reset-password", json={"token": token, "password": "N3wStrongPassw0rd"}).status_code == 204
    assert c.post("/api/auth/reset-password", json={"token": token, "password": "An0therStrongPass"}).status_code == 400  # single use
    assert c.post("/api/auth/login", json={"email": "r@example.com", "password": "N3wStrongPassw0rd"}).status_code == 200


def test_email_verification_flow(caplog):
    import logging
    import re

    with caplog.at_level(logging.WARNING, logger="truthlens.email"):
        c = make_client_user("v@example.com")
    token = re.findall(r"verify-email\?token=([A-Za-z0-9_-]+)", caplog.text)[-1]
    assert c.get("/api/auth/me").json()["email_verified"] is False
    assert c.post("/api/auth/verify-email", json={"token": token}).status_code == 204
    assert c.get("/api/auth/me").json()["email_verified"] is True
    assert c.post("/api/auth/verify-email", json={"token": "bogus" * 5}).status_code == 400
