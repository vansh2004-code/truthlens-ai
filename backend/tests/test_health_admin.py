from tests.conftest import make_client_user


def test_health(client):
    assert client.get("/healthz").json() == {"status": "ok"}
    r = client.get("/readyz")
    assert r.status_code == 200 and r.json()["checks"]["database"] == "ok"


def test_admin_rbac_and_security_headers():
    first = make_client_user("admin@example.com")  # first user is admin in non-production
    second = make_client_user("user@example.com")
    assert first.get("/api/admin/stats").status_code == 200
    assert second.get("/api/admin/users").status_code == 403
    assert first.get("/api/admin/model-health").json()["info"]["name"] == "test-stub"
    r = second.get("/api/auth/me")
    assert r.headers["x-content-type-options"] == "nosniff" and r.headers["x-frame-options"] == "DENY"
    uid = second.get("/api/auth/me").json()["id"]
    assert first.patch(f"/api/admin/users/{uid}", json={"is_active": False}).status_code == 200
    assert second.get("/api/auth/me").status_code == 401
    assert any(e["action"] == "admin.user_update" for e in first.get("/api/admin/audit").json())


def test_error_shape(client):
    r = client.post("/api/auth/login", json={"email": "bad"})
    assert r.status_code == 422 and r.json()["error"]["code"] == "validation_error"
