# 우리아이 Source Lock

Batch: 00 - Source Lock  
Task IDs: BOOT-001, DOC-001  
Created: 2026-07-06  
Status: Source locked for Batch 01 bootstrap. No product feature implementation has been performed in this batch.

## 1. Purpose

This document fixes the implementation source of truth for the WooriAI MVP before repository bootstrap begins.

Batch 00 is documentation-only. It compares the current handoff package with the Phase 1-4 source documents and records missing folders, files, scripts, and contracts. Batch 01 must create the monorepo skeleton from this lock instead of reinterpreting product direction or scope.

## 2. Authoritative Priority

When documents conflict, use this order:

1. `docs/4차/prompts/04_do_not_change_v0_4.md`
2. `docs/4차/contracts/do_not_change_contract_v0_4.yaml`
3. `docs/4차/prompts/05_acceptance_criteria_v0_4.md`
4. `docs/3차/db_api/wooriai_phase3_openapi_v0_3.yaml` and `docs/3차/db_api/wooriai_phase3_schema_v0_3.sql`
5. `docs/3차/개발고정_문서/wooriai_phase3_dev_fixed_docs_v0_3.docx`
6. `docs/2차/화면고정_문서/wooriai_phase2_screen_design_docs_v0_2.docx`
7. `docs/1차/제품기획_문서/wooriai_product_docs_v0_1.docx`
8. `docs/0_원본아이디어/아이_가계부_어플_설계.txt`

## 3. Source File Hashes

SHA-256 hashes were generated from the current workspace on 2026-07-06.

| Path | SHA-256 |
| --- | --- |
| `AGENTS.md` | `6BC58A25293C529856C737996E258DE9D8794ED2DB25F98FF881FE41B3C53A3D` |
| `CODEX_START_HERE.md` | `6BC58A25293C529856C737996E258DE9D8794ED2DB25F98FF881FE41B3C53A3D` |
| `README.md` | `B82E417EA2524FCD24CFE6869685ECA0E87C1D6CC90266EEE81FC113963E9166` |
| `docs/4차/prompts/01_codex_master_instruction_v0_4.md` | `0118BAA7213EA452ACA14E9F2D9C55FD338F90C34D59582066207CB45F0A5515` |
| `docs/4차/prompts/04_do_not_change_v0_4.md` | `791BB6794993FA36E46B71720D9BE991765EBA4228BB02215A7ABD582808CD70` |
| `docs/4차/prompts/02_implementation_plan_v0_4.md` | `3ADDC922D7D678FC3C0B0E87092240D96E22C7084CC338922271F3376826E81D` |
| `docs/4차/prompts/03_task_breakdown_v0_4.md` | `0E06A3256E1144354F7D3D4EEC0945CFC13B066B214DFE9D7467E0C6BA971CDB` |
| `docs/4차/prompts/08_codex_iteration_prompts_v0_4.md` | `4EA53657A21E3349AA23401014AFB45FF7EC58988312E59D504D461568C9327F` |
| `docs/4차/prompts/05_acceptance_criteria_v0_4.md` | `FA96D5A86428726B98B716E9EA637139C0E405FDA010E6268F9869AFD9314806` |
| `docs/4차/prompts/06_qa_runbook_v0_4.md` | `4268547FBEBEC42689E7632FC0A2E178D14F3DA46C9A461882FF5F1CDE510394` |
| `docs/4차/prompts/07_release_checklist_v0_4.md` | `8F55D25C464750EA83030850AD72CB4EA67BC169980321526387A1A388DBBC9D` |
| `docs/4차/contracts/do_not_change_contract_v0_4.yaml` | `5AEDB94991F10507EEE8B690B0CA3685823203CD47C20CC1176544CE214F44C2` |
| `docs/4차/contracts/acceptance_criteria_contract_v0_4.yaml` | `C63820D61550979C40B951B3F06A34CA495F6E1E92FFBFB8551B52E74BEA74C1` |
| `docs/1차/제품기획_문서/wooriai_product_docs_v0_1.docx` | `E34A03270CA6AACC9D728E852D8B4EB9151CB5E2C50795E82378CDCF8BD8DEB5` |
| `docs/2차/화면고정_문서/wooriai_phase2_screen_design_docs_v0_2.docx` | `5077E9BD013AF70A57C801A83F3927E55BC41C744FE05E7847D6F0DA1F4B54C4` |
| `docs/3차/개발고정_문서/wooriai_phase3_dev_fixed_docs_v0_3.docx` | `B4F0D82C8C4A9FD2EB1056AE7031CF93A885FC7590CC693FC1A6DFE2D2544974` |
| `docs/3차/db_api/wooriai_phase3_schema_v0_3.sql` | `E12C6C5F688AE85921D4E7A99AB8B8938C2B663A1A7D1F43F8027EE3E0B82F0C` |
| `docs/3차/db_api/wooriai_phase3_openapi_v0_3.yaml` | `16A2937D20A01CF38B4777A968E4F08B42A93E194CDD4A9ACD4340D41DBA20CB` |
| `docs/3차/db_api/wooriai_phase3_project_structure_v0_3.md` | `E1336E8C38679A8F88E25F32F12D8395CDCABD6B76F3E48752160A4A1E5F11D7` |

## 4. Current Repository State

Batch 00 started from a handoff/document package, not an initialized implementation repo.

Batch 01 bootstrap update:

- Root files present: `AGENTS.md`, `CODEX_START_HERE.md`, `README.md`, `MANIFEST.csv`, `MANIFEST.json`.
- Source docs present under `docs/0_원본아이디어`, `docs/1차`, `docs/2차`, `docs/3차`, and `docs/4차`.
- Git metadata is absent: `git status --short` fails with `fatal: not a git repository`.
- Monorepo workspace files now exist: `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `tsconfig.base.json`, `tsconfig.json`.
- App shells now exist under `apps/mobile`, `apps/api`, and `apps/admin`.
- Shared package shells now exist under `packages/domain`, `packages/contracts`, `packages/ui`, `packages/config`, and `packages/test-utils`.
- Local infra/env skeletons now exist: `.env.example`, `scripts/check-env.ts`, `scripts/generate-openapi-types.ts`, and `infra/docker/docker-compose.yml`.
- `docs/dev` holds this Source Lock and the copied Do Not Change contract.

## 5. Locked Product Shape

WooriAI is not a generic household budget app, shopping mall, or community app.

Locked product loop:

`지출 기록 -> 총액 확인 -> 시기별 준비템 확인 -> 구매 링크 클릭 -> 구매 후 기록/상태 체크`

Locked user feeling:

Users should feel that they are leaving a record of what they have done for their child, not merely maintaining a household ledger.

Locked MVP/P1 boundaries:

- P0: onboarding, fast expense entry, home summary, budget/report, stage-based preparation items, affiliate/product links with disclosure, click logging, admin CMS.
- P1: family invite and Excel import beta.
- Out of scope for MVP: photo/receipt AI, community, price tracking, secondhand integration, insurance/finance affiliate, medical advice.

## 6. Locked Architecture

From Phase 3:

- Monorepo: `apps/mobile`, `apps/api`, `apps/admin`, `packages/domain`, `packages/contracts`, `packages/ui`, `packages/config`, `packages/test-utils`.
- Mobile: React Native + Expo + Expo Router.
- API: NestJS + TypeScript.
- Admin: Next.js Admin CMS.
- DB: PostgreSQL 15+ + Prisma.
- State: TanStack Query for server state, Zustand for session/selected child/local UI, React Hook Form + Zod for forms.
- API style: REST JSON under `/api/v1`; file upload may use `multipart/form-data`.
- Import analysis: worker-driven. API requests must not block while doing AI/import analysis.

## 7. Locked Screen IDs

Bottom tabs are fixed as `홈 / 기록 / 준비템 / 리포트`.

| Screen ID | Module | Screen | Priority |
| --- | --- | --- | --- |
| `SPL-001` | 공통 | 스플래시 성장 애니메이션 | P0 |
| `AUTH-001` | 인증 | 로그인/약관 동의 | P0 |
| `ONB-001` | 온보딩 | 아이 상태 선택 | P0 |
| `ONB-002` | 온보딩 | 아이 프로필 입력 | P0 |
| `ONB-003` | 온보딩 | 이미 준비한 물건 체크 | P0 |
| `ONB-004` | 온보딩 | 월 예산 설정 | P0 |
| `ONB-005` | 온보딩 | 알림 권한 안내 | P1 |
| `HOME-001` | 홈 | 홈 대시보드 | P0 |
| `EXP-001` | 기록 | 빠른 지출 기록 | P0 |
| `EXP-002` | 기록 | 품목/카테고리 선택 | P0 |
| `EXP-003` | 기록 | 지출 상세 수정 | P0 |
| `EXP-004` | 기록 | 기록 리스트 | P0 |
| `BUD-001` | 예산 | 월 예산 수정 | P0 |
| `ITEM-001` | 준비템 | 준비템 목록 | P0 |
| `ITEM-002` | 준비템 | 준비템 상세 | P0 |
| `ITEM-003` | 커머스 | 구매 링크 선택 바텀시트 | P0 |
| `ITEM-004` | 커머스 | 구매 후 기록 유도 | P1 |
| `REP-001` | 리포트 | 월별 리포트 | P0 |
| `REP-002` | 리포트 | 누적 리포트 | P0 |
| `REP-003` | 리포트 | 카테고리/가족별 리포트 | P1 |
| `FAM-001` | 가족 | 가족 관리 | P1 |
| `FAM-002` | 가족 | 초대 역할 선택 | P1 |
| `FAM-003` | 가족 | 초대 수락 | P1 |
| `IMP-001` | 엑셀 | 엑셀 업로드 시작 | P1 |
| `IMP-002` | 엑셀 | 분석 진행 | P1 |
| `IMP-003` | 엑셀 | 분석 미리보기 | P1 |
| `IMP-004` | 엑셀 | 가져오기 완료 | P1 |
| `SET-001` | 설정 | 설정 홈 | P0 |
| `SET-002` | 설정 | 아이/가구 프로필 설정 | P0 |
| `SET-003` | 설정 | 개인정보/동의 관리 | P0 |
| `SET-004` | 설정 | 데이터 삭제/탈퇴 | P0 |
| `ERR-001` | 공통 | 오류/오프라인 공통 화면 | P0 |
| `ADM-001` | 관리자 | 관리자 대시보드 | P0 내부 |
| `ADM-002` | 관리자 | 준비템 CMS | P0 내부 |
| `ADM-003` | 관리자 | 상품 링크 관리 | P0 내부 |
| `ADM-004` | 관리자 | 고지/정책 문구 관리 | P0 내부 |

### 7-1. 잠긴 표 이후 채번된 관리자 화면 ID (참고 · 잠금 대상 아님)

위 표는 DNC-004로 잠겨 있어 **행을 고치거나 지우지 않는다**. 다만 잠금 이후 관리자 앱에 화면이
더 생겼고, 그 화면들이 실제로 달고 있는 ID를 여기 모아 둔다 — 표와 코드가 어긋나 보이는 것을
없애기 위한 현황 기록이며, 새 잠금 계약이 아니다(FIX-121C/F9-b).

채번 규칙: **그 화면을 만든 티켓 ID가 있으면 그대로 재사용하고, 티켓 ID가 없는 화면만 다음 번호를
채번한다.** 잠긴 `ADM-001~004`는 어느 경우에도 재배정하지 않는다.

| Screen ID | Screen | 경로 (`apps/admin/app/`) | 출처 |
| --- | --- | --- | --- |
| `ADM-005` | 콘텐츠 검토 | `reviews/` | 티켓 ID 재사용 |
| `ADM-006` | 관리자 계정 (admin 전용) | `users/` | 티켓 ID 재사용 |
| `ADM-009` | 분석 (KPI 퍼널) | `analytics/` | 티켓 ID 재사용 |
| `ADM-010` | 클릭 통계 | `clicks/` | 신규 채번 (전용 티켓 없음 — 종전 `ADM-004` 오기 정정) |
| `ADM-113` | 감사 로그 (admin 전용) | `audit-logs/` | 티켓 ID 재사용 |

`ADM-007`(본인 비밀번호 변경 폼 — `src/components/AdminShell.tsx` 헤더에서 토글),
`ADM-008`(대시보드 요약 지표 — `ADM-001` 안에 렌더), `ADM-117`(감사 로그 CSV 내보내기 — `ADM-113`
안의 동작)은 **화면이 아니라 기능 티켓**이라 화면 ID를 갖지 않는다. 화면 ID의 실제 사용처는
`apps/admin/app/page.tsx`의 `SECTION_CARDS`다.

## 8. Locked Design Tokens

From Phase 2:

- Primary 500: `#FF8A7A`
- Primary 100: `#FFE6E0`
- Secondary 500: `#7DDCC7`
- Background: `#FFF8F1`
- Surface: white cards/input/bottom sheet surfaces
- Text Primary: `#242424`
- Text Secondary: `#7A7A7A`
- Success: `#3DBE7E`
- Warning: `#FFB020`
- Danger: `#EF4444`
- Primary CTA recommended height: `56px`
- Key touch targets: `44px+`
- Affiliate disclosure: caption near CTA, never hidden or minimized beyond usability.

## 9. Locked DB Contract Summary

Source: `docs/3차/db_api/wooriai_phase3_schema_v0_3.sql`

Enums:

- `auth_provider`: `kakao`, `apple`, `google`
- `user_status`: `active`, `withdrawn`, `blocked`
- `member_role`: `owner`, `co_parent`, `viewer`, `gift_participant`
- `member_status`: `pending`, `active`, `removed`, `left`
- `child_stage_mode`: `pregnant`, `born`, `manual`
- `child_stage_code`: `pregnancy_early`, `pregnancy_mid`, `pregnancy_late`, `newborn_0_3`, `infant_4_6`, `infant_7_12`, `toddler_1_3`, `kid_4_7`, `elementary`, `middle_school`
- `expense_source`: `manual`, `excel_import`, `purchase_followup`, `admin`
- `expense_type`: `expense`, `gift`, `refund`
- `payment_method`: `unknown`, `cash`, `card`, `transfer`, `mobile_pay`
- `necessity_level`: `essential`, `convenience`, `optional`
- `item_status`: `not_prepared`, `prepared`, `gifted`, `not_needed`, `interested`
- `product_platform`: `coupang`, `naver`, `custom`
- `import_status`: `uploaded`, `analyzing`, `preview_ready`, `confirmed`, `failed`, `cancelled`

Tables:

- `users`
- `user_devices`
- `households`
- `household_members`
- `household_invites`
- `children`
- `categories`
- `item_templates`
- `item_template_stages`
- `expenses`
- `budgets`
- `child_item_statuses`
- `product_links`
- `affiliate_clicks`
- `import_jobs`
- `import_rows`
- `consents`
- `attachments`
- `audit_logs`

Views:

- `v_child_monthly_expense_summary`
- `v_child_category_expense_summary`

Seed categories:

- 임신/산모
- 병원/검사
- 출산/조리원
- 기저귀/위생
- 수유/이유식
- 의류/세탁
- 수면/가구
- 외출/이동
- 장난감/책
- 돌봄/교육
- 보험/저축
- 기타

## 10. Locked API Contract Summary

Source: `docs/3차/db_api/wooriai_phase3_openapi_v0_3.yaml`

- OpenAPI: 3.1.0
- Contract version: 0.3.0
- Base URL: `/api/v1`
- Total paths: 33
- Total operations: 42

Operations:

- `POST /auth/oauth-login` - `oauthLogin`
- `POST /auth/refresh` - `refreshToken`
- `POST /auth/logout` - `logout`
- `GET /me` - `getMe`
- `POST /households` - `createHousehold`
- `GET /households/{householdId}/members` - `listMembers`
- `POST /households/{householdId}/invites` - `createInvite`
- `GET /invites/{token}` - `getInvite`
- `POST /invites/{token}/accept` - `acceptInvite`
- `GET /onboarding/status` - `getOnboardingStatus`
- `GET /children` - `listChildren`
- `POST /children` - `createChild`
- `GET /children/{childId}` - `getChild`
- `PATCH /children/{childId}` - `updateChild`
- `POST /children/{childId}/prepared-items` - `setPreparedItems`
- `GET /home` - `getHome`
- `GET /categories` - `listCategories`
- `GET /children/{childId}/expenses` - `listExpenses`
- `POST /children/{childId}/expenses` - `createExpense`
- `GET /expenses/{expenseId}` - `getExpense`
- `PATCH /expenses/{expenseId}` - `updateExpense`
- `DELETE /expenses/{expenseId}` - `deleteExpense`
- `GET /children/{childId}/budget` - `getBudget`
- `PUT /children/{childId}/budget` - `upsertBudget`
- `GET /children/{childId}/reports/monthly` - `getMonthlyReport`
- `GET /children/{childId}/reports/cumulative` - `getCumulativeReport`
- `GET /children/{childId}/reports/category` - `getCategoryReport`
- `GET /children/{childId}/items` - `listItems`
- `GET /children/{childId}/items/{itemTemplateId}` - `getItemDetail`
- `PATCH /children/{childId}/items/{itemTemplateId}/status` - `updateItemStatus`
- `POST /product-links/{productLinkId}/click` - `clickProductLink`
- `POST /children/{childId}/imports/excel` - `createExcelImport`
- `GET /imports/{importJobId}` - `getImportJob`
- `GET /imports/{importJobId}/rows` - `listImportRows`
- `PATCH /imports/{importJobId}/rows/{rowId}` - `updateImportRow`
- `POST /imports/{importJobId}/confirm` - `confirmImport`
- `GET /consents` - `listConsents`
- `PUT /consents` - `upsertConsents`
- `GET /admin/item-templates` - `adminListItemTemplates`
- `POST /admin/item-templates` - `adminCreateItemTemplate`
- `GET /admin/product-links` - `adminListProductLinks`
- `POST /admin/product-links` - `adminCreateProductLink`

Shared schemas include `ErrorResponse`, `MoneyKRW`, `User`, `TokenPair`, `Household`, `Child`, `Category`, `Expense`, `CreateExpenseRequest`, `Budget`, `HomeSummary`, `ItemSummary`, `ItemDetail`, `ProductLink`, `AffiliateClickResponse`, `ReportMonthly`, `ImportJob`, and `ImportRow`.

## 11. Bootstrap Path Status

The following expected Phase 3 paths were identified in Batch 00. Batch 01 resolved the bootstrap paths needed for BOOT-002 through BOOT-005.

| Path | Status |
| --- | --- |
| `package.json` | created in Batch 01 |
| `pnpm-workspace.yaml` | created in Batch 01 |
| `turbo.json` | created in Batch 01 |
| `.env.example` | created in Batch 01 |
| `apps/mobile` | mock shell created in Batch 01 |
| `apps/api` | mock shell created in Batch 01 |
| `apps/admin` | mock shell created in Batch 01 |
| `packages/contracts` | DTO/Zod schema skeleton implemented in Batch 02 |
| `packages/domain` | shared enums, stage, money/date, and recommendation rules implemented in Batch 02 |
| `packages/ui` | skeleton created in Batch 01; real UI components deferred to app batches |
| `packages/config` | skeleton created in Batch 01 |
| `packages/test-utils` | skeleton created in Batch 01 |
| `infra/docker/docker-compose.yml` | created in Batch 01 |
| `infra/db` | placeholder created in Batch 01; schema/migrations deferred to Batch 03 |
| `scripts/check-env.ts` | created in Batch 01 |
| `scripts/generate-openapi-types.ts` | placeholder created in Batch 01; real generation deferred to Batch 02 |
| `docs/qa` | deferred to Batch 11 |

## 12. Batch Boundary

Batch 00 completed scope:

- BOOT-001: current repo structure and Phase 3 deliverables compared; missing file/folder/script list recorded.
- DOC-001: Do Not Change contract copied into `docs/dev/do-not-change.md`; root README points to the implementation principles and lock docs.

Batch 00 deferred items addressed by Batch 01:

- `BOOT-002`: pnpm workspace, turbo, package scripts, tsconfig base.
- `BOOT-003`: docker compose skeleton.
- `BOOT-004`: `.env.example` and environment checker.
- `BOOT-005`: CI skeleton.

Batch 01 completed scope:

- `BOOT-002`: pnpm workspace, turbo, package scripts, base TypeScript config, and mock app/package shells.
- `BOOT-003`: local Docker Compose skeleton for Postgres, Redis, MinIO, and API placeholder service.
- `BOOT-004`: `.env.example`, runtime/example env checker, and clear missing-env errors.
- `BOOT-005`: CI skeleton for install, env-example check, lint, typecheck, test, and build dry-run.

Batch 02 completed scope:

- `DOMAIN-001`: shared enum constants/types for auth, household role/status, child stage, expense, item, product platform, and import status.
- `DOMAIN-002`: child stage calculator for pregnant, born, and manual stage modes with BR-002/003/004 tests.
- `DOMAIN-003`: recommendation score and trust-rule helpers with BR-301 through BR-305 tests; affiliate commission is ignored.
- `DOMAIN-004`: KRW money validation, Seoul date helper, month boundary helper, and future-date check.
- `DOMAIN-005`: shared Zod schema skeletons for OpenAPI DTOs including money, child, expense, item, product link, import row, home summary, and reports.

Deferred to Batch 03:

- `DB-001` through `DB-006`: Prisma schema, migration, seed categories/item templates/product links, and DB index/constraint verification.

No app/API feature flow was implemented in Batch 02.

Batch 03 completed scope:

- `DB-001`: `apps/api/prisma/schema.prisma` now maps the Phase 3 enums and tables for Prisma Client.
- `DB-002`: `apps/api/prisma/migrations/000001_init/migration.sql` now contains the initial PostgreSQL DDL, including FK constraints, check constraints, indexes, the soft-delete partial index, and reporting views.
- `DB-003`: `apps/api/prisma/seed-data.ts` defines the locked 12 system categories and `apps/api/prisma/seed.ts` writes them idempotently.
- `DB-004`: stage-based item template seed data covers essential, convenience, and optional levels, including skip guidance for non-essential items.
- `DB-005`: development-only product link seed data uses `example.com` URLs, contains no partner code or secret, and includes affiliate/sponsored flags for later UI/API testing.
- `DB-006`: DB contract tests verify the locked schema/migration tables, enums, unique constraints, soft delete fields, indexes, views, and seed invariants.

Batch 03 verification notes:

- `pnpm --filter api prisma:validate` passes when `DATABASE_URL` is supplied from `.env.example`.
- `pnpm --filter api prisma:generate`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, and `pnpm peers check` pass.
- Local `prisma:deploy` and `seed` database execution are blocked in this environment because Docker is not installed and localhost PostgreSQL is not reachable.

Deferred to Batch 04:

- `API-001` through `API-005`: NestJS API foundation, global validation/error shape, auth dev stub/token pair, `/me`, and household/child permission guard foundation.

No API endpoint or mobile/admin feature flow was implemented in Batch 03.

Batch 04 completed scope:

- `API-001`: Nest bootstrap now applies the fixed `/api/v1` global prefix, and `GET /api/v1/health` returns `{ status: "ok" }`.
- `API-002`: global validation and exception formatting now return OpenAPI-style `{ error: { code, message, details, requestId } }` responses for validation/auth/permission errors.
- `API-003`: `/api/v1/auth/oauth-login` now provides a development OAuth stub for `kakao`, `apple`, and `google`, returning a user, token pair, and `onboardingRequired`.
- `API-004`: refresh, logout, and JWT-style bearer auth guard foundation now exist for `/api/v1/auth/refresh`, `/api/v1/auth/logout`, and `/api/v1/me`.
- `API-005`: household role guard and `RequireHouseholdRoles` decorator now enforce owner/co_parent/viewer-style membership role checks at the guard layer.
- Audit logger foundation now records structured in-memory audit events for auth operations without requiring a live database.
- API unit/e2e skeleton now covers health prefix, validation errors, auth token flow, `/me`, audit logging, and household role checks.

Batch 04 verification notes:

- `pnpm --filter api test` passes 13 API tests across DB contract, seed data, audit logger, role guard, and API foundation e2e.
- `pnpm --filter api test:e2e` passes the Batch 04 API foundation e2e suite.
- `pnpm install --frozen-lockfile`, `pnpm check:env:example`, Prisma validate/generate with the dev `DATABASE_URL`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, and `pnpm peers check` pass.

Deferred to Batch 05:

- `API-006` through `API-008`: consents, children profile APIs, prepared items, and onboarding budget connections.
- `APP-001` through `APP-004`: mobile foundation, auth screen, onboarding screens, and mobile state stores.

No onboarding, expense, items, commerce, family, import, admin, or mobile feature flow was implemented in Batch 04.

Batch 05 completed scope:

- `API-006`: `/api/v1/consents` now lists fixed consent versions and stores required/optional consent decisions for the dev authenticated user.
- `API-007`: `/api/v1/children` and `/api/v1/children/{childId}` now create, list, read, and patch child profiles with shared child-stage calculation.
- `API-008`: `/api/v1/onboarding/status`, `/api/v1/children/{childId}/prepared-items`, and onboarding budget `PUT /api/v1/children/{childId}/budget` now connect the required onboarding steps through to `nextStep: "home"`.
- `APP-001`: Expo Router root now has TanStack Query provider setup, fixed theme tokens, and a fixed four-tab shell for `홈 / 기록 / 준비템 / 리포트`.
- `APP-002`: `AUTH-001` login/required consent screen now disables continuation until required consent checkboxes are selected, then calls the dev OAuth/consent APIs.
- `APP-003`: `ONB-001` through `ONB-004` route files now cover child status, child profile, prepared items, and first monthly budget.
- `APP-004`: mobile Zustand stores now cover persisted session, selected child, and onboarding progress.

Batch 05 verification notes:

- `pnpm --filter api test` passes 15 API tests including consent gating, child stage calculation, prepared items, and onboarding budget completion.
- `pnpm --filter api test:e2e` passes both API foundation and onboarding e2e suites.
- `pnpm --filter mobile test` passes the mobile onboarding contract suite.
- `pnpm install --frozen-lockfile`, `pnpm check:env:example`, Prisma validate/generate with the dev `DATABASE_URL`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, and `pnpm peers check` pass.

Batch 05 runtime notes:

- Onboarding API state is dev in-memory storage for this batch because local Docker/PostgreSQL is unavailable in the current environment. The routes and DTO behavior are tested, but durable Prisma-backed onboarding persistence is not claimed here.

Deferred to Batch 06:

- `EXPAPI-001` through `HOMEAPI-001`: expenses, budgets, reports, and home summary APIs.
- `APP-EXP-001` through `APP-HOME-001` and `APP-REP-001`: quick expense entry, expense list/detail, home dashboard, and report screens.

No expense, report, preparation-item recommendation, commerce, affiliate click, family, import, admin, or settings feature flow was implemented in Batch 05.

Batch 06 completed scope:

- `EXPAPI-001`: `/api/v1/children/{childId}/expenses` now creates manual expenses with positive KRW integer validation and future-date rejection.
- `EXPAPI-002`: `/api/v1/children/{childId}/expenses`, `/api/v1/expenses/{expenseId}`, `PATCH /api/v1/expenses/{expenseId}`, and `DELETE /api/v1/expenses/{expenseId}` now provide list/detail/update/soft delete behavior; soft delete writes an audit log entry and excludes the record from totals.
- `BUDAPI-001`: `GET /api/v1/children/{childId}/budget` and existing budget upsert now return Asia/Seoul month-normalized budget totals with used and remaining amounts.
- `REPAPI-001`: `/api/v1/children/{childId}/reports/monthly`, `/reports/cumulative`, and `/reports/category` now aggregate non-deleted expense records and exclude gift/refund records from default totals.
- `HOMEAPI-001`: `/api/v1/home?childId=...` now returns child summary, cumulative total, current month budget, recent records, and an empty recommended item list reserved for Batch 07.
- `APP-EXP-001`: `apps/mobile/app/expenses/new.tsx` implements `EXP-001` quick expense entry through the Batch 06 API client.
- `APP-EXP-002`: `apps/mobile/app/(tabs)/records.tsx` and `apps/mobile/app/expenses/[expenseId].tsx` implement `EXP-004` list and `EXP-003` detail edit/delete.
- `APP-HOME-001`: `apps/mobile/app/(tabs)/index.tsx` implements `HOME-001` home dashboard using the home summary API.
- `APP-REP-001`: `apps/mobile/app/(tabs)/reports.tsx` implements `REP-001` and `REP-002` report views.
- `BUD-001`: `apps/mobile/app/budget.tsx` implements the post-onboarding budget edit screen without changing the fixed onboarding budget step.

Batch 06 verification notes:

- `pnpm --filter api exec vitest run test/expense-home-report.e2e.test.ts` passes 2 Batch 06 API e2e tests.
- `pnpm --filter mobile exec vitest run src/expense-home-report-flow.test.ts` passes 2 Batch 06 mobile contract tests.
- `pnpm --filter api test`, `pnpm --filter api test:e2e`, and `pnpm --filter mobile test` pass with the Batch 06 suites included.
- `pnpm install --frozen-lockfile`, `pnpm check:env:example`, Prisma validate/generate with the dev `DATABASE_URL`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, and `pnpm peers check` pass.

Batch 06 runtime notes:

- Expense, budget, home, and report runtime state remains dev in-memory storage because local Docker/PostgreSQL is unavailable in the current environment. Durable Prisma-backed expense/report persistence is not claimed in this batch.
- Batch 07 preparation item commerce, product links, affiliate click logging, sponsored marking, and affiliate disclosure behavior were not implemented in Batch 06.

Deferred to Batch 07:

- `ITEMAPI-001` through `COMAPI-002`: preparation item list/detail/status APIs, product links, affiliate click logging, and disclosure/sponsored handling.
- `APP-ITEM-001` through `APP-ITEM-003`: preparation item list/detail, purchase link bottom sheet, and purchase follow-up prompt.

Batch 07 completed scope:

- `ITEMAPI-001`: `/api/v1/children/{childId}/items` now returns child-stage-matched preparation items for the `now` tab, ranked with the shared recommendation score helper and excluding prepared/gifted/not-needed statuses.
- `ITEMAPI-002`: `/api/v1/children/{childId}/items/{itemTemplateId}` and `PATCH /api/v1/children/{childId}/items/{itemTemplateId}/status` now provide item detail, product links, and child item status updates that immediately affect item lists and home recommendations.
- `COMAPI-001`: `/api/v1/product-links/{productLinkId}/click` now records a dev in-memory affiliate click entry with user, household, child, item template, product link, platform, referrer screen, and click time, then returns a redirect URL.
- `APP-ITEM-001`: `apps/mobile/app/(tabs)/items.tsx` implements `ITEM-001` preparation-item list/cards and prepared/not-needed status controls.
- `APP-ITEM-002`: `apps/mobile/app/items/[itemTemplateId].tsx` implements `ITEM-002` detail fields including why needed, when to skip, safety note, secondhand guidance, and product links.
- `APP-COM-001`: the item detail screen implements `ITEM-003` purchase link actions with affiliate/sponsored markers and CTA-adjacent disclosure text.
- `APP-COM-002`: the item detail screen implements `ITEM-004` purchase follow-up prompt with status update and expense-record navigation.
- `HOMEAPI-001` follow-up: home recommendations now use the same item recommendation/status state instead of returning an empty placeholder list.

Batch 07 verification notes:

- `pnpm --filter api exec vitest run test/items-commerce.e2e.test.ts` passes 2 Batch 07 API e2e tests covering recommendation ranking, prepared-status exclusion, home reflection, detail trust fields, affiliate/sponsored disclosure, redirect response, and click-log persistence.
- `pnpm --filter mobile exec vitest run src/items-commerce-flow.test.ts` passes 2 Batch 07 mobile contract tests.
- `pnpm --filter api test`, `pnpm --filter api test:e2e`, and `pnpm --filter mobile test` pass with the Batch 07 suites included.
- `pnpm install --frozen-lockfile`, `pnpm check:env:example`, Prisma validate/generate with the dev `DATABASE_URL`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, and `pnpm peers check` pass.

Batch 07 runtime notes:

- Item templates and product links are loaded from the existing development seed data; real affiliate partner codes, production URLs, and secrets remain absent.
- Item status and affiliate click state remain dev in-memory storage because local Docker/PostgreSQL is unavailable in the current environment. Durable Prisma-backed item status/click persistence is not claimed in this batch.
- Recommendation ranking continues to use `packages/domain/src/recommendation.ts`, which ignores affiliate commission rate.

Deferred to Batch 08:

- `FAMAPI-001` through `FAMAPI-003`: family member list, invites, invite lookup, and accept flows.
- `APP-FAM-001`: mobile family management and invite surface.

Batch 08 completed scope:

- `FAMAPI-001`: `/api/v1/households/{householdId}/members` now returns active/pending household members with roles and status for authenticated household members.
- `FAMAPI-002`: `/api/v1/households/{householdId}/invites`, `/api/v1/invites/{token}`, and `/api/v1/invites/{token}/accept` now create, preview, and accept invite tokens for `co_parent`, `viewer`, and `gift_participant` roles.
- `FAMAPI-003` / RBAC: owner-only invite creation is enforced; accepted `co_parent` users can add expenses to the shared child and those amounts appear in the owner's report; accepted `viewer` users can read reports but cannot add expenses or create invites.
- `FAMAPP-001`: `apps/mobile/app/family/index.tsx` and `apps/mobile/app/family/invite.tsx` implement `FAM-001` and `FAM-002` family member and invite surfaces.
- `FAMAPP-002`: `apps/mobile/app/family/accept/[token].tsx` implements `FAM-003` invite lookup and acceptance flow.
- Token enrichment now uses the dev household runtime store so accepted invite memberships are available on later authenticated API requests without requiring a live database.

Batch 08 verification notes:

- `pnpm --filter api exec vitest run test/family-invite.e2e.test.ts` passes 2 Batch 08 API e2e tests covering owner invites, co-parent acceptance, shared child expense/report reflection, viewer report-only access, and invite creation RBAC.
- `pnpm --filter mobile exec vitest run src/family-invite-flow.test.ts` passes 2 Batch 08 mobile contract tests.
- `pnpm --filter api test`, `pnpm --filter api test:e2e`, and `pnpm --filter mobile test` pass with the Batch 08 suites included.
- `pnpm install --frozen-lockfile`, `pnpm check:env:example`, Prisma validate/generate with the dev `DATABASE_URL`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, and `pnpm peers check` pass.

Batch 08 runtime notes:

- Household members and invite state remain dev in-memory storage because local Docker/PostgreSQL is unavailable in the current environment. Durable Prisma-backed household member/invite persistence is not claimed in this batch.
- Family deletion/removal UI is not in the Phase 3 OpenAPI path set and remains outside this batch; owner-only invite creation and role access rules are covered.

Batch 09 completed scope:

- `IMPAPI-001`: `/api/v1/children/{childId}/imports/excel` now accepts csv/xlsx import creation requests, enforces the 10MB and 2,000-row contract limits, and creates a dev import job.
- `IMPAPI-002`: import analysis is represented by a worker stub that creates `import_rows` preview data immediately with `preview_ready` status, default-selects only confidence >= 0.70 rows, and marks the low-confidence duplicate candidate row as unselected.
- `IMPAPI-003`: `/api/v1/imports/{importJobId}`, `/api/v1/imports/{importJobId}/rows`, `PATCH /api/v1/imports/{importJobId}/rows/{rowId}`, and `/api/v1/imports/{importJobId}/confirm` now expose job status, preview rows, row edits, and selected-row confirm.
- `IMPAPI-004`: confirm is the only code path that creates `expenses`, and confirmed expenses use `source: "excel_import"`; preview rows are kept outside expense totals until the user confirms selected rows.
- `IMPAPP-001`: `apps/mobile/app/import/index.tsx` implements `IMP-001` and `IMP-002` upload-start/progress entry with a privacy notice before upload.
- `IMPAPP-002`: `apps/mobile/app/import/[importJobId].tsx` implements `IMP-003` and `IMP-004` preview rows, selection toggles, and confirm for selected row IDs.

Batch 09 verification notes:

- `pnpm --filter api exec vitest run test/import-excel.e2e.test.ts` passes 1 Batch 09 API e2e test covering multipart import creation, preview rows, low-confidence default unselected behavior, duplicate candidate display, preview-before-save, confirm, expense creation, and report reflection.
- `pnpm --filter mobile exec vitest run src/import-flow.test.ts` passes 2 Batch 09 mobile contract tests.
- Focused `pnpm --filter api typecheck` and `pnpm --filter mobile typecheck` pass after the Batch 09 implementation.

Batch 09 runtime notes:

- Import jobs and rows remain dev in-memory storage because local Docker/PostgreSQL is unavailable in the current environment. Durable Prisma-backed import persistence is not claimed in this batch.
- The import analysis implementation is intentionally a worker stub for MVP beta; real Excel parsing and AI analysis remain outside this batch. The approval-before-expense-save boundary is covered by API e2e.

Batch 10 completed scope:

- `ADM-001`: `apps/admin/app/page.tsx` now provides a Next.js Admin CMS shell with an internal `x-admin-token` placeholder access model.
- `ADM-002`: `/api/v1/admin/item-templates` now lists, creates, and updates preparation item templates; non-essential items require skip guidance so "not needed" copy is not omitted.
- `ADM-003`: `/api/v1/admin/product-links` now lists, creates, and updates product links with affiliate/sponsored flags, URL fields, active state, and disclosure overrides.
- `ADM-004`: `/api/v1/admin/disclosures` and `/api/v1/admin/disclosures/{key}` now list/update affiliate, sponsored, and supplement disclosure copy; product links without per-link overrides use the managed disclosure text.
- Admin analytics support: `/api/v1/admin/affiliate-clicks/summary` now returns in-memory affiliate click totals by platform.
- `SET-001`/`SET-002`: `apps/mobile/app/settings/index.tsx` now provides a settings entry and child/household profile context without changing the fixed four bottom tabs.
- `SET-003`/`SET-004`: `/api/v1/settings/privacy`, child profile delete preview/confirm, household leave preview/confirm, and account delete preview/confirm now keep deletion flows separated with second-step confirmation text. Account deletion marks the user withdrawn and later bearer-token access is blocked.
- Mobile settings client functions and `apps/mobile/app/settings/privacy.tsx` now expose the privacy/deletion flows with preview-before-confirm UI.

Batch 10 verification notes:

- `pnpm --filter api exec vitest run test/admin-settings.e2e.test.ts` passes 2 Batch 10 API e2e tests covering admin token protection, preparation item skip-copy enforcement, item/product/disclosure update reflection in app APIs, separated privacy flows, child profile deletion, and post-account-delete access blocking.
- `pnpm --filter admin exec vitest run src/admin-cms.test.ts` passes 1 admin CMS contract test.
- `pnpm --filter mobile exec vitest run src/settings-flow.test.ts` passes 2 mobile settings contract tests.
- Focused `pnpm --filter api typecheck`, `pnpm --filter admin typecheck`, and `pnpm --filter mobile typecheck` pass after the Batch 10 implementation.

Batch 10 runtime notes:

- Admin CMS, disclosure, click summary, settings deletion, household leave, and account withdrawal state remain dev in-memory storage because local Docker/PostgreSQL is unavailable in the current environment. Durable Prisma-backed admin/settings persistence is not claimed in this batch.
- Admin auth is a documented placeholder using `x-admin-token`; production admin authentication remains a release-hardening concern.

Deferred to Batch 11:

- `QA-001` through `REL-001`: QA runbook automation, release checklist hardening, accessibility/manual QA evidence, and release gate documentation.

Batch 11 completed scope:

- `QA-001`: local unit/integration coverage is now tied to a release readiness evidence test and the root release gate.
- `QA-002`: `apps/api/test/core-loop.e2e.test.ts` covers the MVP loop from auth, onboarding, child setup, expense creation, home/report totals, prepared item browsing, affiliate disclosure, and product click logging.
- `QA-003`: `docs/qa/manual-runbook.md` now maps QR-00 through QR-15, severity classes, required commands, mobile/manual checks, and external evidence gaps.
- `REL-001`: `docs/qa/release-checklist.md`, `docs/qa/rollback-plan.md`, `docs/qa/accessibility-offline-checklist.md`, `docs/qa/test-coverage.md`, `docs/qa/completion-audit.md`, and `scripts/release-gate.ts` define the release checklist, rollback plan, accessibility/offline evidence, coverage map, completion audit, and automated release gate.

Batch 11 verification notes:

- `pnpm --filter @wooriai/test-utils test` passes the release readiness contract tests.
- `pnpm --filter api exec vitest run test/core-loop.e2e.test.ts` passes the Batch 11 core-loop e2e smoke test.
- `pnpm typecheck:scripts` passes for the release gate script.
- `pnpm release:gate` passes and generated `docs/qa/evidence/latest-release-gate.md` with passing install, env, Prisma validate/generate, lint, typecheck, all tests, API e2e, build, and peer dependency gates.

Batch 11 runtime and release notes:

- Local RC code gate evidence is green.
- Production release approval is not claimed from local evidence alone. Docker/PostgreSQL migration deploy/seed/backup evidence, Expo/EAS internal build evidence, production secret scan, monitoring dashboard, store listing, legal owner sign-off, launch watch, and post-release metrics remain release-owner evidence or waiver items, now tracked in `docs/qa/completion-audit.md` and `docs/qa/evidence/release-owner-evidence-template.md`.

Restart continuation notes:

- After the goal usage limit was reached, the current workspace was treated as authoritative and no prior changes were reverted.
- `docs/qa/evidence/release-owner-evidence-template.md` now gives the release owner a row-by-row intake path for every unresolved external release gate.
