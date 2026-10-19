from fastapi.testclient import TestClient

from app.main import _mount_frontend, create_app


def test_spa_served_and_api_wins(tmp_path):
    (tmp_path / "assets").mkdir()
    (tmp_path / "index.html").write_text("<html>SPA</html>")
    (tmp_path / "assets" / "a.js").write_text("console.log(1)")
    (tmp_path.parent / "secret.txt").write_text("nope")
    app = create_app()
    _mount_frontend(app, tmp_path)
    c = TestClient(app)
    assert c.get("/").text == "<html>SPA</html>"
    assert c.get("/history/deep/link").text == "<html>SPA</html>"  # client-side route fallback
    assert c.get("/assets/a.js").text == "console.log(1)"
    assert c.get("/healthz").json() == {"status": "ok"}  # API not shadowed
    assert c.get("/api/auth/me").status_code == 401
    assert c.get("/api/nope").status_code == 404
    assert "secret" not in c.get("/..%2fsecret.txt").text and "nope" not in c.get("/../secret.txt").text  # no traversal
