# Release 4C P0/P1 fix report

## Result

Initial audit: 4 P0 / 10 P1. Additional implementation audit: 1 P0 / 2 P1. Final open count: P0=0, P1=0.

| Finding group | Fix | Regression evidence |
| --- | --- | --- |
| Android provenance | final source/APK/bundle/certificate manifest and separate Pixel APK binding | provenance generator, fresh install captures, Pixel sentinel/render validation |
| Editorial/safety self approval | immutable revisions, content hash, active reviewer credentials, separated approvals and publisher CAS | `catalog-v2-admin.e2e.test.ts` |
| Item-plan authorization/privacy | owner/co_parent mutation only, household-scope validation, gift allowlist, report deny | `catalog-v2.e2e.test.ts`, `reports-v2.e2e.test.ts` |
| Item-plan concurrency | expectedVersion updateMany CAS and create-race normalization | parallel create/update E2E |
| Maternal lifecycle | child/maternal atomic update and non-pregnant deactivation | `onboarding.e2e.test.ts` |
| Catalog revision/taxonomy | server versions, revision history, complete ancestor mapping | Admin E2E |
| Preview isolation | public published-only; privileged explicit internal preview; production contamination gate | Catalog E2E/config tests |
| Bundles | explicit canonical members for 30 bundles | domain/API tests |
| CSV/XLSX/revision rollback | bounded parser, formula defense, dry-run, hash/revision binding, rollback as new revision | parser tests/Admin E2E |
| Coverage semantics | applicability/gapType/rationale and fail-closed review_needed | coverage matrix/audit |
| Offer freshness | observed timestamp, approval and comparison schemas | Admin/API/mobile tests |
| Node 20/gate | pnpm 10.28.1, deterministic build env, step diagnostics | release gate 11/11 |
| Scheduled publish | due-item revalidation and one-winner CAS | Admin E2E 10/10 and local publisher proof |
| Remote config | canonical `public_app_config` key | app-config E2E 2/2; two replica DB-source responses |

No security, validation, RBAC or content-approval rule was weakened to obtain a passing test.
