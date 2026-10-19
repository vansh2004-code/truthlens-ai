# Testing
- Backend: `cd backend && pytest -q` (33 tests: auth/CSRF/lockout/reset/verification, upload validation, malformed media, full job lifecycle, report
  PDF/JSON, authorization boundaries, signed links, retention/deletion, account deletion, RBAC, temporal & tracker units, real HF adapter on a
  tiny **untrained** local ViT — plumbing only). Pipeline tests use a **test-only stub classifier**; they prove plumbing, not detection quality.
- Frontend: `cd frontend && npm run lint && npm run typecheck && npm test -- --run && npm run build` (43 tests).
- Not executed: Playwright e2e, Docker builds, load tests, any model accuracy evaluation.

## Model evaluation (reproducible, not yet run)
Lay out a dataset you are licensed to use as `<root>/{train,val,test}/{real,fake}/*.mp4`, then `cd backend && python scripts/evaluate.py <root>`.
The threshold is selected on `val` only; `test` is scored once. Output: precision, recall, F1, ROC-AUC, confusion matrix. Keep identities and source
videos disjoint across splits. Report results with the dataset name/licence; do not extrapolate them to other data.
