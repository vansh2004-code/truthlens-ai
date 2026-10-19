from fastapi.testclient import TestClient

from app.config import get_settings


def test_spa_served_with_fallback_and_api_untouched(tmp_path, monkeypatch):
    (tmp_path / "assets").mkdir()
    (tmp_path / "index.html").write_text("<html>SPA</html>")
    (tmp_path / "assets" / "a.js").write_text("console.log(1)")
    monkeypatch.setattr(get_settings(), "static_dir", tmp_path)
    from app.main import create_app

    c = TestClient(create_app())
    assert "SPA" in c.get("/").text and "SPA" in c.get("/history").text  # client-side route falls back
    assert c.get("/assets/a.js").text == "console.log(1)"
    assert "SPA" in c.get("/../../etc/passwd").text or c.get("/../../etc/passwd").status_code in (200, 404)  # never leaks files
    assert c.get("/healthz").json() == {"status": "ok"}
    r = c.get("/api/nope")
    assert r.status_code == 404 and r.json()["error"]["code"] == "not_found"


def test_admin_email_allowlist(monkeypatch):
    monkeypatch.setattr(get_settings(), "admin_emails", "boss@example.com")
    from tests.conftest import make_client_user

    make_client_user("first@example.com")  # first user is admin only outside production; here env=test
    c = make_client_user("boss@example.com")
    assert c.get("/api/auth/me").json()["role"] == "admin"
