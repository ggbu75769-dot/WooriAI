# GitHub Integration Plan — 2026-07-24

## Current Context

- Repository: private `ggbu75769-dot/WooriAI`
- Default branch: `master`
- Working branch: `codex/sprint2-catalog-payments`
- Local comparison at final audit time: 65 commits ahead, 0 behind `master`
- Local state: dirty worktree with multiple completed workstreams mixed together
- Current local gates: `pnpm release:gate` PASS 15/15; Android Pixel Lock PASS 9/9
- Worktree snapshot: 156 tracked files changed, 44 untracked paths, 7,459 insertions, 2,321 deletions, staged files 0
- Current standalone APK: `artifacts/android/wooriai-0.0.0-release-standalone.apk`; the source-bound SHA-256 is recorded in `docs/qa/evidence/android-current-source-verification-2026-07-24.md`

This document prepares reviewable GitHub units. It does not authorize a commit, push, pull request, deployment, or store release.

## Execution Update — 2026-07-25

- The user explicitly authorized applying all current local development to GitHub and rebuilding the APK.
- The release gate was rerun after updating the patched `postcss` and `brace-expansion` dependency floors; all 15 checks passed.
- The current-source standalone APK was rebuilt directly at the project root and installed on the isolated Android emulator.
- Current APK SHA-256: `6C61371D4B20FFC49D39263C5FEB0A1A0B09A264D2740986B0CB0E633E6D7CC3`.
- Current source snapshot SHA-256: `4DE76B24F79C447DBDEB362A60526BF2497A4D756523518ECA8824CA220F35CF`.
- Current proof: `docs/qa/evidence/android-current-source-verification-2026-07-25.md`.

## Safety Rules

- Do not stage with `git add -A` or `git add .`.
- Do not stage, commit, or push a batch until its exact path list and diff have been reviewed.
- Preserve unrelated and pre-existing local changes.
- Keep generated runtime artifacts out of Git unless an existing repository contract explicitly tracks the evidence file.
- Run `git diff --check` for every batch.
- Re-run the batch tests before each commit and the full release gate after Batch 5.
- Re-compare the remote branch with `master` immediately before pushing.

## Batch 1 — Build, Test, And CI Reliability

Purpose: land dependency, test-partition, Android build-contract, database-start, release-gate, and CI changes before product behavior.

Candidate paths:

- `.github/workflows/ci.yml`
- `package.json`, `pnpm-workspace.yaml`, `pnpm-lock.yaml`
- `turbo.json`
- `apps/api/package.json`, `apps/api/vitest*.mts`
- `apps/mobile/package.json`
- `apps/api/src/nest11-migration-contract.test.ts`
- `apps/api/src/test-partition.test.ts`
- `scripts/android-build-contract.ts`
- `scripts/build-android-apk.ts`
- `scripts/lib/android-branding.ts`
- `scripts/db.ts`
- `scripts/release-gate.ts`
- `scripts/scan-secrets.ts`
- `packages/test-utils/src/release-gate-runner.test.ts`
- `packages/ui/package.json`, `packages/ui/src/index.test.ts`

Verification: lint, typecheck, test-utils tests, API partition tests, build-script contract tests, and a forced 8-package production build with zero false `no output files found` warnings.

Current local evidence:

- `packages/test-utils/src/release-gate-runner.test.ts`: PASS 16/16
- `pnpm mobile:deps:check`: PASS; Expo SDK native dependency versions match the installed SDK
- API Vitest configs use ESM `.mts`; the Vite CJS Node API deprecation warning is absent
- Secret scanning tolerates tracked-file renames/deletions and scans `.mts` files
- Production dependency audit: PASS with patched `postcss@8.5.12`
- `pnpm build --force`: PASS 8/8, false no-output warnings 0
- `pnpm release:gate`: PASS 15/15 in 869.921 seconds, including mobile 558/558, API E2E 125/125, and Admin browser E2E 9/9

## Batch 2 — Catalog Backend And Admin Operations

Purpose: land catalog ranking, editorial workflow, safety rules, admin error handling, and real-browser qualification together.

Candidate paths:

- `apps/admin/app/catalog/page.tsx`
- `apps/admin/src/**`
- `apps/api/prisma/seed.ts`
- `apps/api/src/catalog-v2/catalog-v2.service.ts`
- `apps/api/src/release5/release5-external.service.ts`
- `apps/api/test/admin-browser/**`
- `apps/api/test/catalog-v2.e2e.test.ts`
- `apps/api/test/release4-catalog.test.ts`
- `apps/api/test/seed-data.test.ts`
- `packages/domain/src/release4-catalog.ts`

Verification: admin unit tests, catalog API tests, seed tests, and all 9 Admin browser E2E tests.

## Batch 3 — Prepared-Items Product Experience

Purpose: land the standalone HTML parity implementation, practical-item grouping, ranking presentation, and the exact design references used to qualify it.

Candidate paths:

- `apps/mobile/app/(tabs)/items.tsx`
- `apps/mobile/src/preparation/**`
- `apps/mobile/src/html-redesign-parity.test.ts`
- `apps/mobile/src/pixel-lock-render-validation.test.ts`
- `docs/준비템 최종 (standalone).html`
- `docs/ui-pixel-lock/item-001-html-reference.json`
- `docs/ui-pixel-lock/reference-crops/2_png_recommendation_list.png`
- `scripts/pixel-lock/render-validation.ts`

Verification: preparation grouping, render parity, catalog ranking, source-quality, and ITEM-001 Android capture checks.

## Batch 4 — Mobile Runtime, Startup, And Pixel Lock

Purpose: land the Android startup icon/growth animation fix, mobile screen refinements, offline/runtime safety, and Pixel Lock tooling.

Candidate paths:

- `apps/mobile/app.json`
- `apps/mobile/app/launch-animation.tsx`
- `apps/mobile/assets/icon.png`
- `apps/mobile/assets/adaptive-icon.png`
- `apps/mobile/assets/splash-mark.png`
- `apps/mobile/assets/monochrome-icon.png`
- `apps/mobile/assets/notification-icon.png`
- `apps/mobile/assets/family-app-icon-master.png`
- `apps/mobile/app/profile.tsx`
- `apps/mobile/app/(tabs)/_layout.tsx`
- remaining changed `apps/mobile/app/**` routes
- `apps/mobile/assets/illustrations/growth_*.png`
- changed `apps/mobile/src/**` files not included in Batch 3
- `scripts/pixel-lock/android-pixel-lock.ts`
- `scripts/pixel-lock/build-pixel-apk.ts`

Verification: mobile tests, mobile typecheck, targeted ESLint, native splash and six-stage installed-app captures, Android standalone build, installed `base.apk` hash comparison, and Pixel Lock 9/9.

## Batch 5 — Evidence And Release Documentation

Purpose: land only evidence generated from the exact source state included in Batches 1–4, then update release status without overstating production readiness.

Candidate paths:

- `docs/qa/evidence/**`
- `docs/qa/functional-verification-report.md`
- `docs/qa/completion-audit.md`
- `docs/qa/release-checklist.md`
- `docs/qa/evidence/release-owner-evidence-template.md`
- `docs/qa/evidence/android-current-source-verification-2026-07-24.md`
- `docs/operations/github-integration-plan-2026-07-23.md`
- related locked-design status documents whose current statements were verified

Verification: release-readiness tests, `git diff --check`, `pnpm release:gate`, and evidence timestamps/hashes tied to source snapshot `E52FD2EB88B1FCB975DC35A4F0219E48574FFD0D8E5829E64E0A66F15CA75812`.

## Push And Pull Request Boundary

After all five batches are reviewed locally:

1. Confirm the branch still has no unexpected remote divergence.
2. Push only the reviewed commits.
3. Open one draft pull request against `master` with a batch-by-batch summary.
4. Attach the 15/15 release-gate report, the 9/9 Android Pixel Lock report, and the standalone installed-APK hash proof.
5. Mark production signing, real catalog publication, infrastructure credentials, physical-device/TalkBack, iOS, legal approval, and store submission as external follow-up—not completed work.
