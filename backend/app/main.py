import json
import logging
import sys
import time
import uuid

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from .config import get_settings
from .limiter import limiter
from .routers import admin, analyses, auth, health, oauth, signed, users


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        d = {"ts": self.formatTime(record, "%Y-%m-%dT%H:%M:%S%z"), "level": record.levelname, "logger": record.name, "msg": record.getMessage()}
        if record.exc_info:
            d["exc"] = self.formatException(record.exc_info)
        for k in ("request_id", "path", "status", "ms"):
            if hasattr(record, k):
                d[k] = getattr(record, k)
        return json.dumps(d)


def setup_logging() -> None:
    h = logging.StreamHandler(sys.stdout)
    h.setFormatter(JsonFormatter())
    root = logging.getLogger()
    root.handlers = [h]
    root.setLevel(logging.INFO)


def err(status: int, code: str, message: str, details=None, headers=None) -> JSONResponse:
    return JSONResponse({"error": {"code": code, "message": message, "details": details}}, status_code=status, headers=headers)


def create_app() -> FastAPI:
    s = get_settings()
    setup_logging()
    log = logging.getLogger("truthlens.http")
    app = FastAPI(title="TruthLens AI API", version="1.0.0", description="Deepfake detection & media forensics. Scores are uncalibrated model outputs.",
                  docs_url="/api/docs", redoc_url="/api/redoc", openapi_url="/api/openapi.json")
    app.state.limiter = limiter
    app.add_middleware(SlowAPIMiddleware)
    app.add_middleware(CORSMiddleware, allow_origins=s.cors_origin_list, allow_credentials=True,
                       allow_methods=["GET", "POST", "PATCH", "DELETE"], allow_headers=["Content-Type", "X-CSRF-Token", "Authorization"])

    @app.middleware("http")
    async def security_and_logging(request: Request, call_next):
        rid = request.headers.get("x-request-id", uuid.uuid4().hex[:16])
        t0 = time.perf_counter()
        try:
            resp = await call_next(request)
        except Exception:  # noqa: BLE001
            log.exception("unhandled error", extra={"request_id": rid, "path": request.url.path})
            return err(500, "internal_error", "Something went wrong on our side.", headers={"X-Request-ID": rid})
        resp.headers.update({"X-Request-ID": rid, "X-Content-Type-Options": "nosniff", "X-Frame-Options": "DENY",
                             "Referrer-Policy": "no-referrer", "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
                             "X-Robots-Tag": "noindex, nofollow" if request.url.path.startswith("/api") else resp.headers.get("X-Robots-Tag", "")})
        if s.cookie_secure:
            resp.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        # Path only (never query strings, which may carry signed-link parameters).
        log.info("request", extra={"request_id": rid, "path": request.url.path, "status": resp.status_code, "ms": int((time.perf_counter() - t0) * 1000)})
        return resp

    @app.exception_handler(HTTPException)
    async def http_exc(_: Request, e: HTTPException):
        if isinstance(e.detail, dict) and "code" in e.detail:
            d = e.detail
            return err(e.status_code, d["code"], d["message"], d.get("details"))
        return err(e.status_code, "http_error", str(e.detail))

    @app.exception_handler(RequestValidationError)
    async def validation_exc(_: Request, e: RequestValidationError):
        fields = [{"field": ".".join(str(x) for x in er["loc"][1:]), "message": er["msg"]} for er in e.errors()]
        return err(422, "validation_error", "Some fields are invalid.", fields)

    @app.exception_handler(RateLimitExceeded)
    async def rate_exc(_: Request, e: RateLimitExceeded):
        return err(429, "rate_limited", "Too many requests. Please slow down.", headers={"Retry-After": "60"})

    for r in (health.router, auth.router, oauth.router, analyses.router, signed.router, users.router, admin.router):
        app.include_router(r)
    return app


app = create_app()
