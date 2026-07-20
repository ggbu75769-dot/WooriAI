# Test and gate evidence

## Focused regression coverage

- Domain: draft v3 default/reset/migration, explicit zero/custom/skip, readiness matrix, Seoul month, leap day, month-end date-only behavior.
- Mobile: 3/4-column policy, twelve unique valid glyphs, full-card selection, 320dp/font 1.5 contract, Android set/cancel/reopen, restart current-step routing, single-flight completion, failure draft retention, success ordering, human-readable report category labels.
- Contracts/API: starter preview and completion schemas, `YYYY-MM` parity, selected/none/skipped, invalid input, idempotent replay/conflict, concurrency, household isolation, auth expiry, rollback, response parity.

## Executed results

| Gate | Result |
| --- | --- |
| Domain suite | PASS, 12 files / 78 tests |
| Contracts suite | PASS, 5 files / 41 tests |
| Mobile suite | PASS, 76 files / 424 tests |
| API full suite | PASS, 65 files / 292 tests |
| API E2E | PASS, 22 files / 122 tests |
| PostgreSQL migrations | PASS, 41 migrations |
| Strict UX contract | PASS, 51 routes / 100%, raw color 0, unicode icon 0 |
| Mobile source quality | PASS, 14 files / 0 findings |
| Final `release:gate` | PASS, 11 / 11 |

The current release gate was generated at `2026-07-19T04:33:01.052Z`. It includes frozen install, env validation, Prisma validate/generate, DB start, lint, 8-package typecheck, forced single-concurrency all tests, API E2E, all production builds, and strict peer verification. Machine-readable evidence: `docs/qa/evidence/latest-release-gate.json`, SHA-256 `C26D6C889A2DA524247080B1146696353F6503EA04A78E36D3E4DEB5034D7E2B`.

Installed Android evidence is under `docs/MOD_V1/evidence/android`. The final fresh flow is `35` through `42`. The DB was stopped, font scale restored to 1.0, and accessibility services restored to disabled/null.

## 2026-07-19 category-label follow-up

- Failing reproduction: the starter preview returned `네이처러브 기저귀 팬티형`, `베이비 아기띠 힙시트`, and `도담도담 원목 블록 세트`.
- Fixed verification: mobile onboarding-hardening plus local-backend tests PASS, 2 files / 25 tests; mobile typecheck PASS.
- Installed verification: `43-category-only-starter-items.png/xml` contains `기저귀`, `아기띠`, `블록 세트` and none of the product-name tokens.
- Source snapshot: `306E95F606459277796BBEC1B59E00070F6139A84B56432C1E0DC89095E384C4`; clean source-bound APK SHA-256: `6173BBE234DE1D21DB18D6B294B7DBBB5612F90F8CD0F7C6E61AA7B1C8FD6FCB`.
- The full 11/11 release gate was rerun after this follow-up and the startup-crash fix; all checks passed on the current source.

## 2026-07-19 startup-crash regression

| Check | Current result |
| --- | --- |
| Mobile full suite | PASS, 77 files / 432 tests |
| Storage/session targeted suite | PASS, 18 tests |
| Source binding/snapshot targeted suite | PASS, 14 tests |
| Mobile typecheck | PASS |
| Scripts typecheck | PASS |
| Snapshot path filter | PASS, 10 tests |
| APK native libraries | PASS, 4 ABIs / 12 required entries |
| APK signature | PASS, APK Signature Scheme v2; debug/internal signer |
| Source binding | `VERIFIED_STABLE` and BOUND, `410DA0BB23625C7F6F251ACB1A696E0FB60058A85A9D058CFCE6A8F21E60139C` |
| Invalid persisted JSON injection | PASS, both invalid rows removed after hydration |
| Installed cold-start loop | PASS, 10/10 live foreground; 0 fatal/boot/link signatures |
| Current `release:gate` | PASS, 11/11 |

Final crash-fix APK SHA-256: `5EC5C3695A992F0520500D62F37FF56560DF9164102E288A8CBCBBE98387E32C`. The current binary was not rerun through the full onboarding/TalkBack journey, so those checks remain prior-baseline evidence rather than current-binary proof.
