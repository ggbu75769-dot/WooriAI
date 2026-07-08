# 우리아이 Phase 4 Codex Iteration Prompts v0.4

각 Batch는 `01_codex_master_instruction_v0_4.md`와 `04_do_not_change_v0_4.md`를 함께 제공한 뒤 실행합니다.

| Batch | Name | Prompt |
| --- | --- | --- |
| Batch 00 | Source Lock | 현재 리포지토리를 스캔하고 1~4차 문서 기준으로 docs/dev/source-lock.md, docs/dev/do-not-change.md, README의 구현 원칙 섹션을 생성해줘. 아직 기능 구현은 하지 말고 누락된 폴더/파일/스크립트 목록만 정리해줘. |
| Batch 01 | Repo Bootstrap | pnpm monorepo, turbo, Expo mobile, NestJS API, Next.js admin, packages/domain/contracts/ui/config/test-utils, docker compose, env check, CI skeleton을 만들어줘. 화면/기능은 아직 mock shell만 구현해줘. |
| Batch 02 | Domain & Contracts | packages/domain에 enum, stage calculator, money/date utils, recommendation score를 구현하고 unit test를 작성해줘. packages/contracts에는 공유 DTO/Zod schema skeleton을 만들어줘. |
| Batch 03 | DB & Seed | Phase 3 DB schema 기준으로 Prisma schema, migration, seed categories/item_templates/product_links를 구현해줘. seed는 재실행 가능해야 하고 실제 제휴 링크/secret은 넣지 마. |
| Batch 04 | API Foundation | NestJS /api/v1 prefix, validation, error filter, auth dev stub, JWT guard, household role guard, audit logger를 구현하고 API unit/e2e skeleton을 작성해줘. |
| Batch 05 | Auth & Onboarding | AUTH-001과 ONB-001~004 앱 화면, auth/consent/children/budget API 연결을 구현해줘. 신규 사용자가 홈까지 갈 수 있어야 해. |
| Batch 06 | Expense Home Report | EXP-001/003/004, HOME-001, BUD-001, REP-001/002를 구현해줘. 지출 저장 후 홈과 리포트가 즉시 같은 금액으로 갱신되어야 해. |
| Batch 07 | Items Commerce Affiliate | ITEM-001/002/003/004, recommendation, child item status, product links, affiliate_clicks, 제휴 고지 UI를 구현해줘. 추천 점수에는 수수료율을 넣지 마. |
| Batch 08 | Family Invite | FAM-001/002/003과 owner/co_parent/viewer 권한 테스트를 구현해줘. 공동부모 지출은 같은 아이 리포트에 반영되어야 해. |
| Batch 09 | Excel Import Beta | IMP-001~004, import_jobs/import_rows, xlsx/csv 제한, worker stub, preview confirm을 구현해줘. 승인 전 expenses 저장은 절대 금지야. |
| Batch 10 | Admin CMS Settings | ADM-001~004와 SET-001~004를 구현해줘. 관리자에서 준비템/상품 링크/고지 문구를 배포 없이 수정 가능하게 하고 삭제/탈퇴 플로우를 분리해줘. |
| Batch 11 | QA Release Hardening | QA Runbook 기준 회귀 테스트, 접근성, error/offline 상태, 릴리즈 체크리스트, 문서 업데이트를 완료해줘. |
