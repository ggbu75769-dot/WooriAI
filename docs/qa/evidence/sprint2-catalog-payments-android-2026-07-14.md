# Sprint 2 Final Local Baseline Evidence

Generated: 2026-07-15 (Asia/Seoul)

## Verdict

Sprint 2 is a reproducible **local final baseline**. Catalog, payment methods, expense shortcuts, optional child gender/avatar behavior, compatibility paths, release gate, installed-app evidence, and Android Pixel Lock all pass from a clean checkout.

This is a local approval only. It does not claim a remote push, deployment, store release, or production verification. No Sprint 3 functionality is included.

## Source and commit boundary

- Branch: `codex/sprint2-catalog-payments`
- Sprint 1 base: `ca91a5c3b2cddb00272194f643956936347d1c78`
- Validated Sprint 2 source SHA: `378906b638b3b7bce902c5f03f8e28af6693dfca`
- Clean verification worktree: `F:\w2v` (detached at the validated source SHA)
- APK report recorded `dirty: false` before build.

Logical commits after the Sprint 1 base:

1. `8b0de80` `feat: complete sprint 2 catalog and payment flows`
2. `c0d2b99` `test: add sprint 2 closure verification`
3. `8945118` `fix: preserve quick expense UI contracts`
4. `378906b` `fix: bootstrap clean pixel APK builds`

The final Git bundle is written after the evidence-only commit to `artifacts/backups/wooriai-sprint2-final.bundle`.

## Catalog and commerce

`pnpm catalog:validate` and `pnpm catalog:coverage` pass.

- 160 unique reviewed/active items across all 10 required stages
- Commerce policy A
- 58 commerce-enabled items, 98 active links, 0 inactive links
- 40/40 core items have at least two links
- Link distribution by item: 102 with zero, 18 with one, 40 with two or more
- Platform distribution: custom 58, Naver 40
- Idempotent seed/import executed twice on both fresh and upgrade databases

Editorial details and concentration warnings are in `docs/qa/evidence/sprint2-catalog-quality-2026-07-14.md`.

## Database verification

`pnpm sprint2:verify-db` passed at the validated source SHA.

### Fresh path

- Empty PostgreSQL database
- Migrations `000001` through `000011` applied
- Seed/import executed twice
- Result: 160 catalog items, 98 active product links, 160 active reviewed items, 0 duplicate codes

### Sprint 1 upgrade path

- Migrations `000001` through `000008` applied first
- Legacy user, child, item, expense, status, and offline-compatible data inserted
- Migrations `000009` through `000011` applied
- Seed/import executed twice
- Legacy expense remains readable with nullable payment-method linkage
- Legacy item code/status linkage is preserved
- Concurrent default switching leaves exactly one active default
- Deactivated payment methods remain visible through historical expense linkage

### Code rollback compatibility

Sprint 1 code at `ca91a5c3b2cddb00272194f643956936347d1c78` was checked out separately and run against the latest 11-migration upgrade database. Its existing core-loop E2E passed 1/1, covering authentication, onboarding writes, expense write, home/report reads, item detail, and affiliate-click write. This proves basic Sprint 1 code read/write compatibility with the latest additive DB; it is not a DB-down-migration claim.

## Functional compatibility evidence

- Payment-method API focused E2E: 5/5, including per-user authorization, concurrent default switching, history preservation, and child-scoped shortcuts
- Mobile persistence/offline/sync focused checks: passed, including legacy outbox payloads without `paymentMethodId`
- Shortcuts never copy a prior amount and remain isolated per child
- Child gender remains optional/clearable and does not alter recommendation ranking
- API, RBAC, affiliate logging/ranking, Excel preview-before-save, and family RBAC contracts remain intact

## Release gate

`pnpm release:gate`: **PASS, 11/11**.

- Mobile suite: 34 files, 247 tests passed
- API suite: 35 files, 173 tests passed
- Separate API E2E gate: 15 files, 73 tests passed
- Install, env, Prisma validate/generate, DB start, lint, typecheck, build, and peer checks passed
- Canonical report: `docs/qa/evidence/latest-release-gate.md`

## Clean-source APK

- Command: `pnpm pixel:android:build-apk`
- Source commit: `378906b638b3b7bce902c5f03f8e28af6693dfca`
- Report dirty flag: `false`
- Package: `com.anonymous.wooriai`
- Size: 68,768,979 bytes
- SHA-256: `99ca5f9fcb902d2f3fb92667d76845fd794b86c07f17eb2f44661308f6712156`
- Preserved APK: `artifacts/pixel-lock/android/apks/wooriai-sprint2-378906b.apk`
- Build report: `artifacts/pixel-lock/android/reports/pixel-apk.json`

The APK contains an embedded JS bundle and was installed with adb before capture. Android cleartext policy is generated from a tracked Expo config plugin, not an ignored native-only file.

## Sprint 2 installed-app evidence

`pnpm sprint2:capture-evidence`: **PASS, 6/6** at 1080x2340.

| Evidence ID | Result | Purpose |
| --- | --- | --- |
| PAY-001 | PASS | Payment-method list and default state |
| PAY-002 | PASS | Add/edit and digit-sequence guard |
| EXP-PAY-001 | PASS | Expense payment-method selection |
| PROFILE-GENDER-001 | PASS | Optional gender and generated avatar |
| ITEM-CATALOG-001 | PASS | Real catalog-backed item cards |
| ITEM-COVERAGE-001 | PASS | Required stages are populated |

Evidence source is the installed Android app plus `adb shell screencap -p` and `adb pull`. Browser, Expo web, and Playwright screenshots were not used. Report: `artifacts/pixel-lock/android/reports/sprint2-evidence.json`.

## Android Pixel Lock

`pnpm pixel:android`: **PASS, 9/9** from the same installed APK.

- Device: `sdk_gphone64_x86_64`, Android 15
- Resolution: 1080x2340; density: 440
- Threshold: every screen `<= 0.0500`

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

Render validity passed for every capture. Report: `artifacts/pixel-lock/android/reports/latest.md`.
