# Release 4C baseline revalidation

## Final baseline result

The initial fresh baseline exposed Node 20/pnpm incompatibility, a non-deterministic aggregate gate and an unbound Android artifact. After Phase 3 fixes, the required local baseline is reproducible on Node `20.20.2` with pinned `pnpm 10.28.1`.

## Node 20 gate

`pnpm release:gate` completed **11/11 PASS** in 656.9 seconds. Evidence: `docs/qa/evidence/latest-release-gate.md` and `.json`.

| Gate | Final result |
| --- | --- |
| frozen install | PASS |
| env example | PASS |
| Prisma validate/generate | PASS |
| database start | PASS |
| lint | PASS |
| typecheck | PASS |
| all workspace tests | PASS |
| API E2E | PASS |
| API/Admin/Mobile production builds | PASS |
| strict peer dependency check | PASS |

The gate owns a non-secret HTTPS production fixture and continues to reject missing/HTTP production API URLs and test/Pixel contamination.

## Database/catalog/search/security

| Check | Result |
| --- | --- |
| Fresh DB | PASS through 31 migrations and seed |
| Previous snapshot upgrade | PASS through migration 31 |
| Prisma validate | PASS |
| Catalog audit | PASS: 24/120/360 taxonomy, 408 canonical, 3,278 aliases, orphan/duplicate/alias collision 0 |
| Publication safety | PASS fail-closed: in_review 408, published 0, unsafe published 0 |
| Coverage | 1,824 classified cells; unclassified 0; 1,200 review_needed |
| Search corpus | 200/200 |
| Search p95 | 200.94 ms, below 500 ms local threshold |
| UX strict source contract | PASS, runtime matrix still pending |
| Secret scan | PASS |
| Dependency audit | configured high threshold PASS; 8 moderate advisories remain |
| Production export contamination | PASS, 1,197 modules / 3.67 MB bundle |

## Android baseline replacement

The supplied baseline APK SHA-256 was `D4F981041FBE60083D8CA2F90E5A58342A5A8C9D6B7340849E66945A22529422`. Mobile source changed, so a new internal standalone APK was built.

- APK SHA-256: `08420343A9251E9667B72880560F57F29BAA944A54D4860BE14CA43F20AA3053`
- Size: 77,585,871 bytes
- Embedded Hermes: `C39A72869219B5449B72D0370EB6D031FEDDFD278BA63A41C1165680E2BCEF41`
- Profile: internal standalone, test login, debug certificate; not production
- Fresh install, clear-data/test-login/onboarding/home/preparation/report/process-restart: PASS
- Android 15 Pixel gate: valid adb captures, 9/9 PASS

## Boundary

This baseline proves local reproducibility and an internal installed build. It does not prove external staging, real OAuth/push/recall/merchant providers, production restore, production signing, Play beta or closed-beta stability.
