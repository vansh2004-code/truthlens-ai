import time

from fastapi.testclient import TestClient

from app.main import app
from app.ml import registry
from tests.conftest import StubClassifier, make_client_user


def upload(c, path, name="clip.mp4", ctype="video/mp4"):
    with open(path, "rb") as f:
        return c.post("/api/analyses", files={"file": (name, f, ctype)})


def wait_done(c, aid, timeout=60):
    t0 = time.time()
    while time.time() - t0 < timeout:
        d = c.get(f"/api/analyses/{aid}").json()
        if d["status"] in ("completed", "failed", "cancelled"):
            return d
        time.sleep(0.3)
    raise AssertionError("analysis timed out")


def test_full_flow_persists_and_reports(user_client, sample_video):
    r = upload(user_client, sample_video)
    assert r.status_code == 202, r.text
    d = wait_done(user_client, r.json()["id"])
    assert d["status"] == "completed", d
    assert d["verdict"] == "potential_manipulation"  # stub scores 0.9 on every frame
    assert d["media"]["width"] == 320 and len(d["frames"]) >= 3
    assert d["frames"][0]["timestamp"] == 0.0 and d["audio"]["status"] == "not_performed"
    assert d["inferences"][0]["model_name"] == "test-stub" and d["limitations"]
    fr = next(f for f in d["frames"] if f["has_image"])
    img = user_client.get(f"/api/analyses/{d['id']}/frames/{fr['id']}/image")
    assert img.status_code == 200 and img.headers["content-type"] == "image/jpeg"
    pj = user_client.get(f"/api/analyses/{d['id']}/report.json")
    assert pj.status_code == 200 and pj.json()["analysis"]["id"] == d["id"] and "disclaimer" in pj.json()
    pdf = user_client.get(f"/api/analyses/{d['id']}/report.pdf")
    assert pdf.status_code == 200 and pdf.content.startswith(b"%PDF")
    assert user_client.get("/api/analyses").json()["total"] == 1
    assert user_client.get("/api/analyses?q=clip").json()["total"] == 1
    assert user_client.get("/api/analyses?q=zzz").json()["total"] == 0


def test_low_scores_never_claim_authentic(user_client, sample_video):
    registry.set_classifier(StubClassifier(score=0.05))
    d = wait_done(user_client, upload(user_client, sample_video).json()["id"])
    assert d["verdict"] == "no_strong_indicators"
    assert "authentic" not in d["explanation"].lower().replace("not prove", "")
    assert "does not prove" in d["explanation"]


def test_no_faces_is_inconclusive(user_client, sample_video):
    from app.ml.base import FaceDetector

    class NoFace(FaceDetector):
        def detect(self, f): return []

    registry.set_face_detector(NoFace())
    d = wait_done(user_client, upload(user_client, sample_video).json()["id"])
    assert d["status"] == "completed" and d["verdict"] == "inconclusive" and d["score"] is None


def test_model_unavailable_fails_honestly(user_client, sample_video):
    from app.ml.base import ModelUnavailableError

    class Broken(StubClassifier):
        def load(self): raise ModelUnavailableError("weights missing")

    registry.set_classifier(Broken())
    d = wait_done(user_client, upload(user_client, sample_video).json()["id"])
    assert d["status"] == "failed" and d["verdict"] == "failed" and "weights missing" in d["error"] and d["score"] is None
    assert user_client.get(f"/api/analyses/{d['id']}/report.json").status_code == 409


def test_upload_rejections(user_client, tmp_path):
    bad = tmp_path / "x.mp4"
    bad.write_bytes(b"hello world" * 500)
    assert upload(user_client, bad).json()["error"]["code"] == "bad_signature"
    exe = tmp_path / "x.exe"
    exe.write_bytes(b"MZ" * 800)
    assert upload(user_client, exe, "x.exe").json()["error"]["code"] == "unsupported_extension"
    corrupt = tmp_path / "c.mp4"
    corrupt.write_bytes(b"\x00\x00\x00\x18ftypisom" + b"\xff" * 4096)
    assert upload(user_client, corrupt).status_code == 422
    assert user_client.get("/api/analyses").json()["total"] == 0  # nothing persisted for rejected files


def test_size_limit(user_client, sample_video, monkeypatch):
    from app.config import get_settings

    monkeypatch.setattr(get_settings(), "max_upload_mb", 0)
    assert upload(user_client, sample_video).status_code == 413


def test_authorization_boundaries(user_client, sample_video):
    aid = wait_done(user_client, upload(user_client, sample_video).json()["id"])["id"]
    other = make_client_user("other@example.com")
    for path in (f"/api/analyses/{aid}", f"/api/analyses/{aid}/report.json", f"/api/analyses/{aid}/report.pdf"):
        assert other.get(path).status_code == 404
    assert other.delete(f"/api/analyses/{aid}").status_code == 404
    assert other.post(f"/api/analyses/{aid}/cancel").status_code == 404
    assert other.get("/api/analyses").json()["total"] == 0
    assert other.get("/api/admin/stats").status_code in (403,)


def test_signed_link_user_bound_and_tamper_proof(user_client, sample_video):
    aid = wait_done(user_client, upload(user_client, sample_video).json()["id"])["id"]
    link = user_client.post(f"/api/analyses/{aid}/report-link/json").json()["url"]
    anon = TestClient(app)
    assert anon.get(link).status_code == 200
    assert anon.get(link.replace("sig=", "sig=0")).status_code == 403
    assert anon.get(link.replace(".json", ".pdf")).status_code == 403


def test_media_deletion_and_retention(user_client, sample_video):
    from datetime import datetime, timedelta, timezone

    from app.db import SessionLocal
    from app.models import Media
    from app.services import storage
    from app.worker.runner import purge_expired

    aid = wait_done(user_client, upload(user_client, sample_video).json()["id"])["id"]
    db = SessionLocal()
    m = db.query(Media).one()
    path = storage.safe_path("media", m.storage_key)
    assert path.exists()
    m.delete_after = datetime.now(timezone.utc) - timedelta(minutes=1)
    db.commit()
    assert purge_expired()["purged_media"] == 1
    assert not path.exists()
    d = user_client.get(f"/api/analyses/{aid}").json()
    assert d["media_deleted"] and d["status"] == "completed"  # results survive, media gone
    user_client.delete(f"/api/analyses/{aid}")
    assert user_client.get("/api/analyses").json()["total"] == 0


def test_account_deletion_removes_data(user_client, sample_video):
    from app.db import SessionLocal
    from app.models import Media
    from app.services import storage

    wait_done(user_client, upload(user_client, sample_video).json()["id"])
    db = SessionLocal()
    mpath = storage.safe_path("media", db.query(Media).one().storage_key)
    db.close()
    assert mpath.exists()
    assert user_client.post("/api/users/me/delete-account", json={"password": "wrong"}).status_code == 400
    assert user_client.post("/api/users/me/delete-account", json={"password": "Str0ngPassw0rd"}).status_code == 204
    assert not mpath.exists() and not mpath.parent.exists()
    assert TestClient(app).post("/api/auth/login", json={"email": "a@example.com", "password": "Str0ngPassw0rd"}).status_code == 401
