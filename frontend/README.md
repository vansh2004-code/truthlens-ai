# TruthLens AI frontend

React 18 + TypeScript (strict) + Vite, Tailwind 3.4, Radix-based shadcn-style components, Framer Motion, TanStack Query v5, React Router v6, React Hook Form + Zod, Recharts. Tests: Vitest + Testing Library.

## Scripts
| Command | What it does |
|---|---|
| `npm run dev` | Dev server on :5173, proxies `/api`, `/healthz`, `/readyz` to `http://localhost:8000` |
| `npm run build` | `tsc --noEmit` then production build into `dist/` |
| `npm run preview` | Serve the build locally |
| `npm run lint` | ESLint (flat config) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test -- --run` | Vitest once |

## Run against the backend
1. Start the backend on port 8000 (CORS origin `http://localhost:5173` is the backend default).
2. `npm install && npm run dev`, open http://localhost:5173.

Because the dev proxy makes `/api` same-origin, cookies work without CORS. To point at a different origin set `VITE_API_URL` (see `.env.example`); the backend must then allow that origin with credentials and a compatible `SameSite` cookie setting.

## How it talks to the API (`src/lib/api.ts`)
- Every request uses `credentials: 'include'`; tokens live in HttpOnly cookies and are never stored in JS or localStorage.
- Non-GET requests send `X-CSRF-Token` from the readable `tl_csrf` cookie.
- On 401 it calls `POST /api/auth/refresh` once (single-flight), retries, and otherwise redirects to `/login?next=...`.
- Errors are parsed from `{error:{code,message,details}}`; `message` is shown in the UI.
- Uploads use XHR for real progress events.

## Structure
- `src/lib/` constants (upload limits in one file), API client, auth context, queries, validation, verdict wording
- `src/components/ui/` design-system primitives; `components/analysis/` result tabs; `components/charts/`
- `src/pages/` route components (lazy-loaded in `src/routes.tsx`)
- `src/test/` unit and component tests

## Product wording rules
The score is shown as "Model score (uncalibrated)", a plain 0-1 number, never as a percentage or probability. Outcome labels are fixed in `src/lib/verdict.ts` and avoid "authentic", "real" and "safe".

## Docker
`docker build -t truthlens-frontend .` produces an nginx image serving the SPA with history fallback, proxying `/api/` to `http://backend:8000` and setting security headers (see `nginx.conf`, `security-headers.conf`). The CSP allows `style-src 'unsafe-inline'` because charting and UI libraries set inline style attributes; scripts are `'self'` only.

## Known gaps
- No Playwright/e2e tests (browser downloads not attempted).
- Face boxes are drawn from `face_box` over the frame image, which the backend already burns a box into, so both are visible and aligned.
- Failed or cancelled analyses can be retried from their page but cannot be deleted from the UI (delete is available on completed analyses).
