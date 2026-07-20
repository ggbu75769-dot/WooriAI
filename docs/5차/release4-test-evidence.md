# Release 4 test evidence

Generated: 2026-07-16 KST.

| Command | Result | Detail |
| --- | --- | --- |
| `pnpm release:gate` | PASS | 11/11; tests, API E2E and all builds included; `latest-release-gate.json` |
| All package tests in gate | PASS | 655.381 s in the resource-contended local run |
| API E2E in gate | PASS | 18 E2E files; 266.504 s |
| Production builds in gate | PASS | 128.746 s |
| Direct mobile test run | PASS | 41 files / 275 tests after production-boundary changes |
| Direct API test run | PASS | 48 files / 223 tests |
| Direct contracts test run | PASS | 4 files / 38 tests |
| Report V2 E2E | PASS | period boundaries, totals/categories/series parity, access/range rejection, canonical item linkage |
| `pnpm release4:verify-db` | PASS | fresh and representative upgrade; 22 migrations |
| Prisma validation with local test URL | PASS | schema valid |
| `pnpm catalog:audit` | PASS structural | publication gate intentionally false |
| Catalog performance | PASS local | 100/100, p95 14.72 ms |
| `pnpm ux:contract --strict` | PASS shared checks | honest direct migration 0/37 |
| `pnpm typecheck:scripts` | PASS | provenance/build/contamination scripts included |
| `pnpm security:audit` | PASS at high threshold | 8 moderate vulnerabilities reported |
| `pnpm release4:contamination:export` | PASS | fresh Android HBC, 3,609,027 bytes, zero forbidden findings |
| Pre-remediation production APK contamination | **FAIL baseline** | old APK remains invalid and is not current source proof |
| API/Admin typecheck after Admin import slice | PASS | catalog import DTO/service/controller and Admin client/page |
| API production build after Admin import slice | PASS | main/publisher/worker bundles |
| Admin full test | PASS | 6 files / 31 tests |
| Catalog Admin PostgreSQL E2E | PASS | 4 tests: import, taxonomy and actionable queue/report/link retry contracts |
| API/Admin typecheck after taxonomy slice | PASS | taxonomy DTO/service/controller and Admin client/page |
| API production build after taxonomy slice | PASS | main/publisher/worker bundles |
| API/Admin typecheck after queue slice | PASS | typed queue rows, report batch DTO, outbox/handler and Admin detail UI |
| Queue report/link PostgreSQL verification | PASS | exact report set, duplicate/state conflict, deduped health outbox and offer sync |
| Admin production build | PASS | Next.js 15.5.20, 16 static pages; `/catalog` 10.3 kB |

The release gate initially exceeded the 15-minute command transport timeout, but
its scoped child process continued. Completion was accepted only after that
process exited and `docs/qa/evidence/latest-release-gate.json` was rewritten with
all 11 results as PASS at `2026-07-15T17:32:00.909Z`.

The Android Pixel Lock suite was not rerun after the final standalone build in
this pass. Older 9/9 Pixel evidence remains on disk but is not presented as fresh
proof for this APK.

The 11/11 release gate record predates the production-boundary changes. Fresh
post-change evidence is the mobile typecheck, 41-file mobile suite, scripts
typecheck, strict UX contract and the generated production HBC scan above; the
full release gate was not rerun.
