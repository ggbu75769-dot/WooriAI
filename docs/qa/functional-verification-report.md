# WooriAI Functional Verification Report

Generated: 2026-07-24
Scope: current local release-candidate verification after Android Pixel Lock and startup-screen hardening

## Summary

Local functional verification is PASS for the MVP code paths covered by automated API, mobile contract, domain, and release-gate tests.

This report does not claim production release readiness. Android Pixel Lock is PASS on the installed Android app: all 9 required screens passed the strict `0.0500` threshold. The current adb evidence is `artifacts/pixel-lock/android/reports/latest.json`. The standalone APK is still internal-only because it uses test login and debug signing.

## Commands Run

| Command | Result | Evidence |
| --- | --- | --- |
| `npm run release:gate` | PASS | 15/15: install, Expo SDK dependency compatibility, env, secret scan, dependency audit, Prisma, DB, lint, typecheck, all tests, API e2e, Admin browser e2e, production builds, and peer dependency checks passed. |
| `pnpm test:admin-browser -- --reporter=verbose` | PASS | 4 files and 9 real-browser tests passed. |
| `npm run pixel:android` | PASS | 9/9 installed-app adb screenshots passed; every score is `<= 0.0500`. |
| `pnpm --filter mobile exec vitest run src/ui-pixel-lock-flow.test.ts src/android-native-ui-quality.test.ts src/test-login-flow.test.ts` | PASS | Startup animation, native asset, and test-login boundary regressions passed. |
| Standalone APK install/pull hash check | PASS for internal artifact | Built and installed APK SHA-256 match exactly; cold-start process alive and fatal log matches 0. The source-bound hash is recorded in `docs/qa/evidence/android-current-source-verification-2026-07-24.md`. |

## Feature Verification Matrix

| Feature area | Local status | Automated evidence |
| --- | --- | --- |
| API base and health | PASS | `apps/api/test/api-foundation.e2e.test.ts` confirms `/api/v1` health, validation errors, dev OAuth token refresh, and protected `/me`. |
| Auth and onboarding | PASS | `apps/api/test/onboarding.e2e.test.ts` confirms required consent gate, child/prepared/budget completion, and positive KRW budget validation. `apps/mobile/src/onboarding-flow.test.ts` confirms route/store contracts and login error handling. |
| Expense, home, budget, report loop | PASS | `apps/api/test/expense-home-report.e2e.test.ts` confirms totals stay consistent through create/update/soft delete and that gift expenses are excluded from default totals. `apps/mobile/src/expense-home-report-flow.test.ts` confirms mobile route/API contracts. |
| Core MVP smoke loop | PASS | `apps/api/test/core-loop.e2e.test.ts` covers auth, onboarding, expense, report, item detail, and affiliate click in one flow. |
| Items, recommendations, product detail, affiliate | PASS | `apps/api/test/items-commerce.e2e.test.ts` confirms stage-matched recommendations, status updates, disclosure/sponsor fields, and affiliate click persistence. `packages/domain/src/recommendation.test.ts` confirms affiliate commission is not a score variable. |
| Family invite and RBAC | PASS | `apps/api/test/family-invite.e2e.test.ts` confirms owner invite, co-parent expense reflection in shared child report, viewer read access, and viewer write/invite blocking. |
| Excel import beta | PASS | `apps/api/test/import-excel.e2e.test.ts` confirms preview rows are not saved to expenses until user confirmation. `apps/mobile/src/import-flow.test.ts` confirms upload/progress/preview/confirm route contracts. |
| Admin CMS and settings | PASS | `apps/api/test/admin-settings.e2e.test.ts` confirms admins can update preparation items, product links, disclosure copy, and two-step deletion/leave flows. `apps/admin/src/admin-cms.test.ts` and `apps/mobile/src/settings-flow.test.ts` cover admin/mobile contracts. |
| Domain money/date/stage rules | PASS | `packages/domain/src/money-date.test.ts`, `stage.test.ts`, and `enums.test.ts` confirm positive KRW integer, Seoul-date, child-stage, and locked enum behavior. |
| Android Pixel Lock automation | PASS | `artifacts/pixel-lock/android/reports/latest.json` records 9/9 installed-app adb captures at or below the strict `0.0500` threshold. |
| Android native local proof | PARTIAL PASS | The current standalone APK was installed on an Android 15 emulator, exercised, pulled back, and byte-matched. It remains an internal test-login/debug-signing artifact, not EAS, Play Store, physical-device, or iOS release proof. |

## Remaining Non-Functional Boundaries

- Production DB migration, production secrets, object storage, analytics, store listing, monitoring, and post-release metrics are not proven in this local workspace.
- GitHub repository and remote branch exist, but the dirty local worktree has not been split into reviewed commits or frozen as a release version.
- Physical Android devices, TalkBack, iOS, production signing, and store-console submission remain unproven.
