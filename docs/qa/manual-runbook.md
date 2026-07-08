# WooriAI Manual QA Runbook

Source: `docs/4차/prompts/06_qa_runbook_v0_4.md`  
Batch: 11 - QA Release Hardening

This runbook is the human QA companion to the automated release gate. Automated checks cover unit, API e2e, contract, lint, typecheck, build, Prisma validate/generate, env example, and peer dependency checks. Manual checks cover device UX, offline/error behavior, accessibility, store/build evidence, and release-owner operational evidence.

## Commands

| Name | Command | Expected |
| --- | --- | --- |
| Install | `pnpm install --frozen-lockfile` | workspace installs without lockfile drift |
| Env example | `pnpm check:env:example` | all required example variables are present |
| Prisma validate | `DATABASE_URL=... pnpm --filter api prisma:validate` | Prisma schema is valid |
| Prisma generate | `DATABASE_URL=... pnpm --filter api prisma:generate` | Prisma client generation succeeds |
| Lint | `pnpm lint` | all package lint scripts pass |
| Typecheck | `pnpm typecheck` | all TypeScript projects pass |
| Unit/e2e | `pnpm test` and `pnpm --filter api test:e2e` | core automated regression suites pass |
| Build | `pnpm build` | API, admin, mobile, packages compile |
| Peer deps | `pnpm peers check` | no peer dependency issues |
| Release gate | `pnpm release:gate` | writes `docs/qa/evidence/latest-release-gate.md` |

## Scenarios

| Run ID | Area | Steps | Expected Result | Evidence |
| --- | --- | --- | --- | --- |
| QR-00 | Environment | Install, copy `.env.example`, start DB/infra, run Prisma deploy/seed, start API/admin/mobile. | Local API, DB, admin, and mobile dev surfaces are running. | Automated commands plus release-owner infra evidence. |
| QR-01 | First signup | Dev login, accept required consents, complete `ONB-001` through `ONB-004`, land on `HOME-001`. | Home shows child stage, cumulative amount, budget, and preparation items. | `onboarding.e2e` plus mobile manual pass. |
| QR-02 | Quick expense | Create a 49,800 KRW expense from `EXP-001`. | Home and monthly report increase by 49,800 KRW. | `core-loop.e2e`, `expense-home-report.e2e`. |
| QR-03 | Expense edit/delete | Open `EXP-004`, edit amount, then delete. | Totals update; deleted expense is excluded and audit log is written. | `expense-home-report.e2e`. |
| QR-04 | Item status | Mark car seat prepared from `ITEM-001`. | Item leaves now-needed list and appears as prepared. | `items-commerce.e2e`. |
| QR-05 | Affiliate link | Open item detail, click an affiliate product link. | CTA-adjacent disclosure appears and affiliate click is saved. | `core-loop.e2e`, `items-commerce.e2e`. |
| QR-06 | Report aggregation | Compare `HOME-001`, `REP-001`, and `REP-002`. | Home monthly amount and report totals match; gifts/deleted records excluded. | `expense-home-report.e2e`. |
| QR-07 | Family invite | Owner invites co-parent; co-parent accepts and adds expense. | Owner report includes co-parent expense. | `family-invite.e2e`. |
| QR-08 | Permission restriction | Viewer attempts expense write and invite creation. | API returns 403; UI shows insufficient permission state. | `family-invite.e2e` plus mobile manual pass. |
| QR-09 | Excel import | Upload csv/xlsx, review preview, confirm selected rows. | Expenses stay at 0 before approval; only selected valid rows save after approval. | `import-excel.e2e`. |
| QR-10 | Excel exceptions | Upload invalid extension, oversized file, over-2,000-row file, and invalid-column fixture. | Clear pre-analysis or analysis error. | File type/size/row limits automated; invalid-column behavior needs real parser evidence after stub replacement. |
| QR-11 | Admin CMS | Change item, product link, and disclosure copy in `ADM-002`/`ADM-003`/`ADM-004`. | App APIs reflect updated values without mobile deploy. | `admin-settings.e2e`. |
| QR-12 | Privacy/delete | Use `SET-003`/`SET-004` for consent review, child delete, household leave, and account delete. | Flows are separated, show impact, require second-step confirmation, and block access after deletion. | `admin-settings.e2e` plus mobile manual pass. |
| QR-13 | Offline/error | Disable network while viewing home, records, and links. | Cached data or clear error/retry state appears; in-progress input is not silently lost. | Manual device evidence required. |
| QR-14 | Accessibility | Check touch target size, contrast, screen-reader labels, and numeric text around charts/totals. | Main UX meets accessibility checklist. | `docs/qa/accessibility-offline-checklist.md` plus manual pass. |
| QR-15 | Release gate | Run lint, typecheck, test, API e2e, build, admin build, Prisma validate/generate, peer checks. | All automated gates pass or a release-owner waiver exists. | `pnpm release:gate` evidence. |

## Bug Severity

| Severity | Criteria | Examples |
| --- | --- | --- |
| S0 Blocker | Data loss, login unavailable, missing payment/affiliate disclosure, privacy deletion unavailable. | Expense amount disappears after save; import saves rows before approval. |
| S1 Critical | Core loop failure, permission bypass, report total corruption. | Viewer creates expenses; deleted expenses stay in reports. |
| S2 Major | Workaround exists but major UX/API flow is broken. | Empty state missing for a major screen. |
| S3 Minor | Copy, spacing, or secondary visual issue. | Button label line break or minor spacing issue. |

## Local Environment Notes

- Docker/PostgreSQL is not available in this workspace, so DB migration deploy, seed, backup, and rollback commands require release-owner infrastructure evidence.
- Expo/EAS iOS/Android internal builds require credentials and install evidence outside this local workspace.
- Production secret scan, monitoring dashboard, store listing, and post-release metric checks require release-owner evidence.
