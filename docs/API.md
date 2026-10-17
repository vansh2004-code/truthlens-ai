# API
Interactive OpenAPI: `/api/docs` (Swagger) and `/api/openapi.json`. Errors: `{"error":{"code","message","details"}}`.
Auth is cookie-based; non-GET requests must send `X-CSRF-Token` equal to the `tl_csrf` cookie (Bearer tokens bypass CSRF).

| Group | Endpoints |
|---|---|
| Auth | `POST /api/auth/{register,login,refresh,logout,verify-email,resend-verification,forgot-password,reset-password,change-password}`, `GET /api/auth/me`, `GET /api/auth/google/{start,callback}` (optional) |
| Analyses | `POST /api/analyses` (multipart `file`), `GET /api/analyses` (q,status,verdict,sort,page,page_size), `GET /api/analyses/stats`, `GET/DELETE /api/analyses/{id}`, `POST …/{id}/{retry,cancel}`, `DELETE …/{id}/media`, `GET …/{id}/frames/{frame_id}/{image,overlay}`, `GET …/{id}/report.{pdf,json}`, `POST …/{id}/report-link/{fmt}` |
| Signed | `GET /api/signed/report/{id}.{fmt}?uid&exp&sig` (expiring, user-bound HMAC link) |
| Me | `PATCH /api/users/me`, `GET /api/users/me/export`, `POST /api/users/me/{delete-all-media,delete-account}` |
| Admin | `GET /api/admin/{stats,model-health,users,audit}`, `PATCH /api/admin/users/{id}`, `POST /api/admin/purge` |
| Ops | `GET /healthz`, `GET /readyz` |
