# Release 4C instruction chain

- Captured: 2026-07-16 KST
- Repository: `F:\WooriAI`
- Branch: `codex/sprint2-catalog-payments`
- Source HEAD: `db7a7a455afec892b8fa1205e477dbe507a5931d`
- Upstream: none

## Discovery result

The repository contains one operative agent instruction file: root `AGENTS.md`. No `AGENTS.override.md`, nested `AGENTS.md`, `CLAUDE.md`, or `CONTRIBUTING*` file was found outside ignored dependency/build directories. The following context and runbook sources were found and read as governing or supporting material:

- `AGENTS.md`
- `CODEX_START_HERE.md`
- `README.md`
- `docs/dev/source-lock.md`
- `docs/dev/do-not-change.md`
- `docs/operations/release-runbook.md`
- `docs/operations/database-migrations.md`
- `docs/operations/database-backup-restore.md`
- `docs/operations/rollback.md`
- `docs/operations/release3-android-release-runbook.md`
- `docs/operations/release3-backup-restore-runbook.md`
- `docs/operations/release3-observability-runbook.md`
- `docs/qa/release-checklist.md`
- `docs/qa/manual-runbook.md`
- `docs/qa/rollback-plan.md`
- Release 4 audit, evidence, limitation, migration, report, Android, catalog, and Admin design documents under `docs/5차` and `docs/qa/evidence`

Earlier Release 4 reports are audit inputs, not current proof. Their counts, APK hash, test results, and maturity claims must be reproduced against the current working tree before reuse.

## Precedence and applied rules

1. System/developer instructions and the user's Release 4C instruction govern this run.
2. Root `AGENTS.md` applies to every repository path. It makes installed Android plus ADB `screencap` the final Pixel Lock evidence and preserves the nine screen IDs, four bottom tabs, MVP loop, affiliate disclosure, recommendation independence, Excel preview, and family RBAC.
3. `CODEX_START_HERE.md`, `docs/dev/source-lock.md`, and `docs/dev/do-not-change.md` preserve the documented v0.4 contracts and prohibit silent reinterpretation of locked scope.
4. Release 4C extends that scope only where the user explicitly requested it. For the DNC decision recorded before execution, price support is limited to manually entered or imported snapshots with observed timestamps; no automatic price tracking or scraping is authorized. Secondhand/rental work is limited to preference, eligibility, and safety state; no external marketplace integration is authorized.
5. Existing migrations are immutable. New schema work, if required, must use a new forward migration.
6. Existing tracked and untracked user work is preserved. No destructive Git, bulk staging, automatic commit, remote write, cloud deploy, store upload, self-approval, or automatic content publication is authorized.
7. Medical, medicine, supplement, newborn sleep, car-seat, choking, fall, burn, and recall assertions remain fail-closed without an attributable official/expert review.
8. Phase 0 through Phase 2 are evidence-only. Product source edits begin only after the independent audit and fresh baseline are recorded.

## Path-to-instruction mapping

| Target path | Applicable instruction chain | Release 4C consequence |
| --- | --- | --- |
| `apps/api/**` | root `AGENTS.md`; source lock; DNC; DB, migration, restore runbooks; Release 4C | Preserve auth/RBAC/API compatibility, use forward migrations, enforce server-side transition/CAS and fail-closed publication. |
| `apps/admin/**` | root `AGENTS.md`; source lock; DNC; Release 4C | Preserve Excel preview-before-save and RBAC; imports create review batches and never direct-publish. |
| `apps/mobile/**` | root `AGENTS.md`; source lock; DNC; Android runbook; Release 4C | Preserve four tabs and nine Pixel Lock IDs; test hooks must not enter production; final visual claims require installed-app ADB evidence. |
| `packages/contracts/**`, `packages/domain/**` | root `AGENTS.md`; source lock; DNC; Release 4C | Make contract evolution additive/compatible and keep shared enums/validators authoritative. |
| `scripts/**`, root package files | root `AGENTS.md`; release/checklist/runbook material; Release 4C | Gates must fail closed, report current evidence, and never convert missing external proof into a pass. |
| `apps/api/prisma/**` | root `AGENTS.md`; DB migration/backup/rollback runbooks; Release 4C | Do not alter existing migrations; validate fresh and upgrade paths and record restore evidence. |
| `docs/**`, `artifacts/**` | root `AGENTS.md`; documentation source lock; Release 4C | Separate implementation, local runtime, external staging, and production truth; link every claim to machine-readable evidence. |

## Start-state preservation

The protected baseline contains 152 status entries: 82 tracked modifications and 70 untracked status entries (93 individual untracked files). The binary tracked patch, untracked metadata/hashes, status record, and ownership map are stored under `artifacts/dev-snapshots/release4c-*`. Sensitive-content patterns are excluded from content copying; no matching untracked sensitive file was detected in this baseline.

