from fastapi import APIRouter, Response
from sqlalchemy import text

from ..config import get_settings
from ..db import engine

router = APIRouter(tags=["health"])


@router.get("/healthz")
def healthz():
    return {"status": "ok"}


@router.get("/readyz")
def readyz(response: Response):
    checks = {}
    try:
        with engine.connect() as c:
            c.execute(text("SELECT 1"))
        checks["database"] = "ok"
    except Exception:  # noqa: BLE001
        checks["database"] = "error"
    s = get_settings()
    if s.run_jobs_inline:
        checks["queue"] = "inline"
    else:
        try:
            import redis

            redis.Redis.from_url(s.redis_url, socket_connect_timeout=2).ping()
            checks["queue"] = "ok"
        except Exception:  # noqa: BLE001
            checks["queue"] = "error"
    ok = all(v in ("ok", "inline") for v in checks.values())
    if not ok:
        response.status_code = 503
    return {"status": "ready" if ok else "degraded", "checks": checks}
