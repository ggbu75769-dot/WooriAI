# Release 3 Test Evidence

Generated: 2026-07-15 (Asia/Seoul)

## Provenance

| Field | Value |
| --- | --- |
| Implementation source SHA | `f65b9375eae21a0846ea60a50403766898de9a54` |
| Branch | `codex/sprint2-catalog-payments` |
| Rollback point | `7721fc152ca23e848856eff00c495d56960d4437` |
| Migration head | `000012_release3_foundation` |
| OpenAPI | 33 paths; source SHA-256 `16a2937d20a01cf38b4777a968e4f08b42a93e194cdd4a9acd4340d41dba20cb` |
| Working tree at APK report | dirty only because documentation/user-preserved files were outside the implementation commit |

## Executed commands

| Command | Result | Count or note | Evidence |
| --- | --- | --- | --- |
| `pnpm release:gate` | PASS | 11/11 gates, 374.5s outer runtime | `docs/qa/evidence/latest-release-gate.{md,json}` |
| `pnpm test --concurrency=1 --force` | PASS | 555 tests; UI package command deferred with 0 tests | release-gate output/evidence |
| `pnpm --filter api test:e2e` | PASS | 15 files / 74 tests | release-gate output |
| clean PostgreSQL migration + seed | PASS | migrations `000001` through `000012` | this manifest and terminal evidence |
| `pnpm build --force` | PASS | 8/8 tasks; API 3 bundles, Admin 15 routes, Mobile 1 bundle/52 assets | release-gate evidence |
| `pnpm contracts:generate` | PASS | 33 paths | generated contract header |
| `pnpm peers check` | PASS | no peer issues | release-gate evidence |
| `pnpm security:secrets` | PASS | 5 high-confidence rules | terminal evidence |
| `pnpm security:audit` | PASS at high threshold | 0 high/critical; 8 moderate remain | terminal evidence |
| `pnpm release:config:fixture` | PASS | non-secret validation fixture only | `docs/qa/evidence/release3-production-config-fixture.*` |
| `pnpm release:config` | expected FAIL | 43 current production blockers | `docs/qa/evidence/release3-production-config-gate.*` |
| `pnpm android:build-aab` | expected FAIL | `ANDROID_APPROVED_IDENTITY_REQUIRED` | Android checklist |
| `pnpm pixel:android:build-apk` | PASS | source `f65b937…`; reproducible APK SHA | `artifacts/pixel-lock/android/reports/pixel-apk.json` |
| `pnpm pixel:android -- --force` | PASS | 9/9, Android 15, adb screencap | `artifacts/pixel-lock/android/reports/latest.{md,json}` |

The Pixel validation initially found a tool false positive: Android 15 `uiautomator` emitted `UiAutomationService already registered` as a helper-process `FATAL EXCEPTION`. The validator now ignores only that exact infrastructure exception and continues to fail on app, React Native, JS delivery, Metro, and other fatal errors. The corrected full run passed.

## Pixel scores

| Screen | Score | Result |
| --- | ---: | --- |
| SPL-001 | 0.0230 | PASS |
| HOME-001 | 0.0000 | PASS |
| EXP-001 | 0.0000 | PASS |
| ITEM-001 | 0.0000 | PASS |
| ITEM-002 | 0.0489 | PASS |
| REP-001 | 0.0397 | PASS |
| FAM-001 | 0.0363 | PASS |
| IMP-003 | 0.0459 | PASS |
| SET-001 | 0.0195 | PASS |

The three `0.0000` captures are not copied reference files: their raw adb screenshot SHA-256 values and byte sizes differ from the corresponding reference PNGs. The app tree contains real RN components and each capture passed accessibility sentinel validation.

## Artifact checksums

| Artifact | Bytes | SHA-256 |
| --- | ---: | --- |
| `apps/api/dist/main.cjs` | 833415 | `861ec50faffc4e1e2936077fd97afda1aa1e1e3ad3ea3b574efb5e74a9bcc8f7` |
| `apps/api/dist/publisher.cjs` | 833709 | `2ea2731148e56c91fb431035fbc25774cbb904c642934864daea9664d7590bb3` |
| `apps/api/dist/worker.cjs` | 835183 | `727e87d8342739ff41867c03991a28621e56f0a395d3e479e004a130136ca59b` |
| `apps/admin/.next/BUILD_ID` | 21 | `3909cc4587b69b55d9780ead9cdb36f21a6817bed2035d4e97c92b5b7e2a6a3c` |
| `apps/mobile/dist/metadata.json` | 3605 | `0abb4d065eb6d285783bf417b07ecaf2fc32c6d57fa51679e385e696c841093e` |
| Android Hermes `.hbc` | 3588287 | `3b4c01606eaa864d70f0323f42d07281556a35fa1be5c25cfdd626041e121378` |
| Pixel internal APK | 69365162 | `43cc47d4141de0c1856bbb98a660732a4307f9317e4581d0d367b7943ee31200` |

The Pixel APK was reproduced after the implementation commit with the same SHA-256. It is debug-internal-only (`com.anonymous.wooriai`, `0.0.0`) and is not a production AAB.

## Unexecuted validation

- real Redis worker/publisher crash-recovery integration; Docker daemon and Redis were unavailable.
- local Trivy container-image execution; CI job is defined, local Docker daemon was unavailable.
- real Kakao OAuth/unlink, S3 export, notification provider, and external alert delivery.
- production backup restore/rollback drill, staging E2E, Play internal-track install, and seven-day closed beta.
- signed AAB/AAB store provenance; approved identity/signing inputs are absent.

## Maturity

| Scope | Level | Reason |
| --- | --- | --- |
| Source/build/test | M2 | fresh automated suites and production builds pass |
| PostgreSQL migration/API | M2 | clean migration/seed and real-DB E2E pass |
| Android UI | M3 | installed APK plus adb screencaps pass |
| External providers | M1–M2 | adapter/mock/fail-closed tests only |
| Staging/closed beta/production | below M4 | no external deployment evidence |
