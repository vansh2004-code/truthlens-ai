import os
import subprocess
import tempfile
from pathlib import Path

import pytest

_tmp = tempfile.mkdtemp(prefix="tl_test_")
os.environ.update({
    "TL_ENV": "test", "TL_DATABASE_URL": f"sqlite:///{_tmp}/test.db", "TL_STORAGE_DIR": f"{_tmp}/media",
    "TL_FRAMES_DIR": f"{_tmp}/frames", "TL_MODEL_CACHE_DIR": f"{_tmp}/models", "TL_RUN_JOBS_INLINE": "true",
    "TL_SECRET_KEY": "test-secret-key-test-secret-key-0123456789", "TL_RATE_LIMIT_AUTH": "1000/minute", "TL_RATE_LIMIT_DEFAULT": "100000/minute",
})

from fastapi.testclient import TestClient  # noqa: E402

from app.db import Base, engine  # noqa: E402
from app.main import app  # noqa: E402
from app.ml import registry  # noqa: E402
from app.ml.base import FaceDetector, FrameClassifier, ModelInfo  # noqa: E402


class StubClassifier(FrameClassifier):
    """TEST-ONLY adapter used to exercise pipeline plumbing. Never used outside the test suite."""
    def __init__(self, score=0.9):
        self.score = score
        self.info = ModelInfo(name="test-stub", version="0", device="cpu", fake_label="fake")

    def load(self): ...
    def predict(self, faces_rgb): return [self.score] * len(faces_rgb)


class FixedFaceDetector(FaceDetector):
    def detect(self, frame_bgr):
        h, w = frame_bgr.shape[:2]
        return [(w // 4, h // 4, w // 2, h // 2)]


@pytest.fixture(autouse=True)
def fresh_db():
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    registry.set_classifier(StubClassifier())
    registry.set_face_detector(FixedFaceDetector())
    yield


@pytest.fixture
def client():
    with TestClient(app, base_url="http://testserver") as c:
        yield c


def make_client_user(email="a@example.com", password="Str0ngPassw0rd"):
    c = TestClient(app)
    r = c.post("/api/auth/register", json={"email": email, "password": password, "display_name": "T"})
    assert r.status_code == 201, r.text
    c.headers["X-CSRF-Token"] = c.cookies.get("tl_csrf")
    return c


@pytest.fixture
def user_client():
    return make_client_user()


@pytest.fixture(scope="session")
def sample_video(tmp_path_factory) -> Path:
    """Real, decodable video generated with ffmpeg (synthetic moving pattern, 4 seconds)."""
    p = tmp_path_factory.mktemp("vid") / "sample.mp4"
    r = subprocess.run(["ffmpeg", "-y", "-v", "error", "-f", "lavfi", "-i", "testsrc2=size=320x240:rate=15:duration=4",
                        "-f", "lavfi", "-i", "sine=frequency=440:duration=4", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", str(p)],
                       capture_output=True)
    assert r.returncode == 0, r.stderr
    return p
