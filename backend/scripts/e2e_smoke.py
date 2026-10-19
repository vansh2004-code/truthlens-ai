"""End-to-end smoke test against a RUNNING server (real model, real HTTP, real DB).
Uses scikit-image's bundled public-domain 'astronaut' photo (a real, unmanipulated face) rendered to a short video.
This checks that the pipeline runs end to end with the real model. It is NOT an accuracy evaluation:
one genuine image says nothing about detection quality. Usage: python scripts/e2e_smoke.py [base_url]"""
import json
import subprocess
import sys
import tempfile
import time
from pathlib import Path

import cv2
import httpx
from skimage import data

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8000"
EMAIL, PW = "smoke@example.com", "Str0ngPassw0rd"


def note(msg: str) -> None:
    print(f"::notice title=E2E::{msg}", flush=True)


def fail(msg: str) -> None:
    print(f"::error title=E2E::{msg}", flush=True)
    sys.exit(1)


with tempfile.TemporaryDirectory() as tmp:
    png, mp4 = Path(tmp) / "face.png", Path(tmp) / "face.mp4"
    cv2.imwrite(str(png), cv2.cvtColor(data.astronaut(), cv2.COLOR_RGB2BGR))
    r = subprocess.run(["ffmpeg", "-y", "-v", "error", "-loop", "1", "-framerate", "15", "-i", str(png), "-t", "8",
                        "-vf", "scale=512:512,format=yuv420p", "-c:v", "libx264", str(mp4)], capture_output=True)
    if r.returncode:
        fail("could not build the test video: " + r.stderr.decode()[:200])
    c = httpx.Client(base_url=BASE, timeout=60)
    rr = c.post("/api/auth/register", json={"email": EMAIL, "password": PW, "display_name": "Smoke"})
    if rr.status_code != 201:
        fail(f"register failed {rr.status_code} {rr.text[:150]}")
    c.headers["X-CSRF-Token"] = c.cookies.get("tl_csrf")
    with open(mp4, "rb") as f:
        up = c.post("/api/analyses", files={"file": ("face.mp4", f, "video/mp4")})
    if up.status_code != 202:
        fail(f"upload failed {up.status_code} {up.text[:200]}")
    aid, t0, d = up.json()["id"], time.time(), {}
    while time.time() - t0 < 900:
        d = c.get(f"/api/analyses/{aid}").json()
        if d["status"] in ("completed", "failed", "cancelled"):
            break
        time.sleep(3)
    health = c.get("/api/admin/model-health").json()
    pdf = c.get(f"/api/analyses/{aid}/report.pdf")
    frames = d.get("frames", [])
    summary = {
        "status": d.get("status"), "verdict": d.get("verdict"), "score": d.get("score"), "error": d.get("error"),
        "frames_total": len(frames), "frames_with_face": sum(f["face_detected"] for f in frames),
        "frames_scored": sum(f["score"] is not None for f in frames),
        "frame_scores": [f["score"] for f in frames if f["score"] is not None][:12],
        "model": (d.get("inferences") or [{}])[0].get("model_name"), "model_version": (d.get("inferences") or [{}])[0].get("model_version"),
        "device": (d.get("inferences") or [{}])[0].get("device"), "fake_label": (health.get("info") or {}).get("fake_label"),
        "labels": (health.get("info") or {}).get("labels"), "duration_s": round(time.time() - t0, 1),
        "pdf_status": pdf.status_code, "pdf_is_pdf": pdf.content[:5] == b"%PDF-",
    }
    note(json.dumps(summary))
    print(json.dumps(summary, indent=2))
    if d.get("status") != "completed":
        fail(f"analysis did not complete: {d.get('status')} {d.get('error')}")
    if summary["frames_scored"] < 1:
        fail("no frame was scored (no usable face?) - see summary")
    sys.exit(0)
