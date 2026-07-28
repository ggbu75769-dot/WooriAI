# WooriAI Release Checklist

Source: `docs/4차/prompts/07_release_checklist_v0_4.md`  
Batch: 11 - QA Release Hardening

## Local Verification Status

The local workspace can prove code, contract, and dry-run gates. It cannot prove production infrastructure, app-store assets, Expo/EAS internal installs, live monitoring, or post-release metrics without release-owner credentials and environment access.

| Checklist ID | Category | Item | Local verification status | Evidence |
| --- | --- | --- | --- | --- |
| REL-PRE-001 | Pre-release | Code freeze branch and release version confirmed | PARTIAL | GitHub remote branch `codex/sprint2-catalog-payments` exists and is ahead of `master`; the dirty local worktree still needs reviewed commits, an approved release version, and a tag. |
| REL-PRE-002 | Pre-release | Do Not Change contract final check | PASS | `docs/dev/do-not-change.md`, `docs/dev/source-lock.md`, full automated gates. |
| REL-PRE-003 | Legal | Privacy policy, terms, affiliate disclosure, child information, and medical expression review | Waiver required | Legal/PM review required outside local code verification. |
| REL-PRE-004 | Content | Seed items/product links contain no private production/test leaks | PASS for dev seeds | `seed-data.test.ts`; production content review still release-owner evidence. |
| REL-PRE-005 | Analytics | Event collection for onboarding, expense, product link click | Waiver required | Runtime analytics pipeline not connected in local MVP stub. |
| REL-INFRA-001 | Infra | Production env/secrets and secret scan | Waiver required | Production secrets unavailable; local `.env.example` passes. |
| REL-INFRA-002 | Infra | DB migration deploy dry-run plus backup/rollback scripts | Waiver required | Prisma validate/generate pass; deploy/backup needs PostgreSQL/Docker access. |
| REL-INFRA-003 | Infra | S3/MinIO bucket, CORS, retention policy | Waiver required | Object storage runtime not started locally. |
| REL-BUILD-001 | Build | API build/test/lint/typecheck pass | PASS | `pnpm release:gate`, `pnpm --filter api test:e2e`. |
| REL-BUILD-002 | Build | Mobile iOS/Android internal build and install check | PARTIAL PASS | Android emulator install and adb screenshot proof pass, including exact installed-APK hash parity. Physical Android, production signing/EAS, and iOS evidence still require the release owner. |
| REL-BUILD-003 | Build | Admin build/deploy smoke test pass | PASS for local build | `pnpm build`, `pnpm --filter admin test`; deployment smoke needs release-owner host. |
| REL-QA-001 | QA | QA Runbook QR-01 through QR-15 pass | PARTIAL PASS | Automated scenarios covered; QR-00, QR-13, QR-14, and external release evidence need manual pass. |
| REL-QA-002 | QA | Permission/delete/import/affiliate/report regression tests pass | PASS | API e2e suites: family, settings, import, commerce, report, core loop. |
| REL-STORE-001 | Store | App name, description, screenshots, privacy labels, review notes | Waiver required | Store metadata/assets require PM/Design evidence. |
| REL-LAUNCH-001 | Launch | Production deploy order: DB -> API -> Admin -> Mobile rollout | Waiver required | See `docs/qa/rollback-plan.md`; live execution is external. |
| REL-LAUNCH-002 | Launch | Monitoring dashboard for errors, latency, signup, expense, clicks | Waiver required | Monitoring backend/dashboard not connected locally. |
| REL-LAUNCH-003 | Launch | Rollback criteria: API 5xx > 2%, crash-free < 99%, critical data bug | PASS for documented plan | `docs/qa/rollback-plan.md`. |
| REL-POST-001 | Post-release | 24h/72h/7d metrics review and hotfix window | Waiver required | Post-release operational evidence required. |

## Release Decision

- Local RC code gate: PASS when `pnpm release:gate` exits 0 and writes `docs/qa/evidence/latest-release-gate.md`.
- Production release gate: NOT APPROVED from local evidence alone. Waiver required items must be completed or explicitly signed off by PM/Tech Lead/Release Manager.
- S0/S1 bug policy: any open S0 blocks release; any open S1 needs PM/Tech Lead explicit approval.
