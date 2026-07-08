# WooriAI Test Coverage Map

Batch: 11 - QA Release Hardening

## Batch 11 Task Coverage

| Task ID | Requirement | Evidence |
| --- | --- | --- |
| QA-001 | Unit tests for domain, API services, recommendation, RBAC. | `packages/domain/src/*.test.ts`, `apps/api/test/audit-logger.service.test.ts`, `apps/api/test/household-role.guard.test.ts`, `apps/api/test/db-contract.test.ts`, `apps/api/test/seed-data.test.ts`. |
| QA-002 | API e2e for auth -> onboarding -> expense -> report -> item click. | `apps/api/test/core-loop.e2e.test.ts`, plus `api-foundation`, `onboarding`, `expense-home-report`, `items-commerce`, `family-invite`, `import-excel`, `admin-settings` e2e suites. |
| QA-003 | Mobile manual QA script in `docs/qa`. | `docs/qa/manual-runbook.md`, `docs/qa/accessibility-offline-checklist.md`. |
| REL-001 | Version/env/migration/legal/analytics/rollback release checklist. | `docs/qa/release-checklist.md`, `docs/qa/rollback-plan.md`, `docs/qa/completion-audit.md`, `docs/qa/evidence/release-owner-evidence-template.md`, `scripts/release-gate.ts`, generated `docs/qa/evidence/latest-release-gate.md`. |

## Automated Regression Matrix

| Area | Test Command | Coverage |
| --- | --- | --- |
| Domain rules | `pnpm --filter @wooriai/domain test` | enums, child stage, money/date, recommendation trust rules. |
| Contracts | `pnpm --filter @wooriai/contracts test` | shared DTO schema validation. |
| API foundation | `pnpm --filter api test:e2e` | auth, onboarding, expense/report, commerce, family, import, admin/settings, core loop. |
| Mobile contracts | `pnpm --filter mobile test` | onboarding, home/expense/report, items/commerce, family, import, settings route/client contracts. |
| Admin shell | `pnpm --filter admin test` | admin CMS sections and internal token placeholder surfaced. |
| Release readiness docs | `pnpm --filter @wooriai/test-utils test` | release gate script, QA docs, checklist, rollback/accessibility docs, completion audit. |
| Full gate | `pnpm release:gate` | install, env, Prisma validate/generate, lint, typecheck, test, API e2e, build, peer dependencies. |

## Known Local Evidence Boundaries

- Docker/PostgreSQL migration deploy, seed, backup, and rollback are not proven locally because Docker/PostgreSQL is unavailable in this workspace.
- iOS/Android internal build and install evidence require Expo/EAS credentials and physical/simulator install proof.
- Production legal, analytics, monitoring, secret scan, app-store metadata, and post-release metrics require release-owner evidence collected in `docs/qa/evidence/release-owner-evidence-template.md`.
