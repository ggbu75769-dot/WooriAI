# WooriAI Functional Verification Report

Generated: 2026-07-08
Scope: local MVP function verification after UI Pixel Lock/native-proof hardening

## Summary

Local functional verification is PASS for the MVP code paths covered by automated API, mobile contract, domain, and release-gate tests.

This report does not claim production release readiness or UI Pixel Lock completion. Production evidence still requires release-owner infrastructure and store/device artifacts. UI Pixel Lock remains FAIL under the strict `0.0500` mismatch threshold; see `docs/ui-pixel-lock/reports/ui-pixel-lock-final-report.md`.

## Commands Run

| Command | Result | Evidence |
| --- | --- | --- |
| `npm exec --yes pnpm@11.7.0 -- --filter api test:e2e` | PASS | 8 files, 15 tests passed |
| `npm exec --yes pnpm@11.7.0 -- --filter mobile test` | PASS | 7 files, 26 tests passed |
| `npm exec --yes pnpm@11.7.0 -- --filter @wooriai/domain test` | PASS | 4 files, 14 tests passed |
| `npm exec --yes pnpm@11.7.0 -- --filter @wooriai/test-utils test` | PASS | 2 files, 9 tests passed |
| `npm exec --yes pnpm@11.7.0 -- release:gate` | PASS | Install/env/Prisma/lint/typecheck/test/API e2e/build/peer checks passed; evidence regenerated at `docs/qa/evidence/latest-release-gate.md` |

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
| UI Pixel Lock automation | PASS for tooling, FAIL for visual threshold | `packages/test-utils/src/ui-pixel-lock-normalization.test.ts` confirms final-status evaluation and screenshot normalization behavior. `docs/ui-pixel-lock/reports/ui-pixel-lock-final-report.md` remains FAIL because 8 live screens exceed threshold. |
| Android native local proof | PARTIAL PASS | Local Android debug APK install and native screenshots are recorded in `docs/ui-pixel-lock/native-screenshots/manifest.json`. This is not EAS/internal release build proof. |

## Remaining Non-Functional Boundaries

- UI Pixel Lock is not complete: only More/settings passes the strict threshold.
- Production DB migration, production secrets, object storage, analytics, store listing, monitoring, and post-release metrics are not proven in this local workspace.
- Git metadata is not usable in this folder; turbo reports `fatal: not a git repository` warnings while commands still pass.
