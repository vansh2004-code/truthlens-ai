# Security & privacy

**Implemented:** Argon2id passwords; account lockout; HttpOnly+Secure(+SameSite) cookies; rotating refresh sessions with reuse detection;
double-submit CSRF; hashed single-use email/reset tokens; per-user ownership checks (other users' analyses return 404); admin RBAC;
rate limits (in-memory per process — use a shared store behind multiple replicas); upload validation (extension + magic bytes + MIME + size +
ffprobe duration/dimensions); FFmpeg/ffprobe via argv (no shell) with timeouts and rlimits; server-generated storage keys with path-escape checks;
private media (never served directly; only face-frame evidence JPEGs behind auth); expiring HMAC-signed report links; audit log; automatic
retention purge (default 7 days; user-configurable) and user-initiated media/analysis/account deletion; security headers; no query strings in logs;
secrets only from environment (production refuses to start with a weak key or insecure cookies). No uploaded video is used for training; the
opt-in flag exists but nothing consumes it.

**Privacy:** videos and extracted face crops are biometric-adjacent personal data. Process only with consent and a lawful basis. No third-party
service receives media by default (model weights are downloaded from Hugging Face; uploads are not sent anywhere). Reports contain a file hash and
frame scores, not video.

**Known limitations:** registration reveals whether an email exists (409); the Haar face detector is weak on profile/small/occluded faces; rate limiting
is per-process; media on a local volume is not encrypted at rest (use disk/object-store encryption); no antivirus scanning; Google OAuth is untested.
**Known dev-only advisories** (`npm audit`): Vitest/Vite dev-server and Tailwind build-chain packages; not shipped in the production image. Production
dependencies: 0 npm advisories at time of writing. `pip-audit` has not been run in the sandbox (CI runs it, non-blocking).
