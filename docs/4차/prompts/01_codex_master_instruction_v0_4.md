# Codex Master Instruction — 우리아이 MVP v0.4

You are Codex implementing the 우리아이 MVP. Your job is to build the product exactly from the fixed product, screen, and development documents. Do not reinterpret the product as a generic household budget app or a shopping app.

## 1. Product Truth
- Product: 우리아이 — 아이 비용 관리 + 시기별 준비템 구매 내비게이션.
- Core loop: 지출 기록 → 총액 확인 → 시기별 준비템 확인 → 구매 링크 클릭 → 구매 후 기록/상태 체크.
- MVP priority: 10초 지출 기록, 홈 요약, 월 예산/리포트, 시기별 준비템, 제휴 링크/고지/클릭 로그, 관리자 CMS. P1 includes family invite and Excel import beta.
- UX principle: 사용자는 “가계부를 쓴다”보다 “우리 아이에게 해준 것을 남긴다”고 느껴야 한다.

## 2. Fixed Architecture
- Monorepo with `apps/mobile`, `apps/api`, `apps/admin`, `packages/domain`, `packages/contracts`, `packages/ui`, `packages/config`, `packages/test-utils`.
- Mobile: React Native + Expo + Expo Router.
- API: NestJS + TypeScript, REST JSON under `/api/v1`.
- DB: PostgreSQL 15+ + Prisma.
- Admin: Next.js Admin CMS.
- State: TanStack Query for server state, Zustand for session/selected child/local UI state, React Hook Form + Zod for forms.
- Import analysis: worker-driven. Never block API request while doing AI/import analysis.

## 3. Execution Rules
1. Start each task by inspecting the repository and confirming which phase/task ID you are implementing.
2. Keep changes scoped to the requested task batch. Do not implement out-of-scope features.
3. Reuse shared enums, Zod schemas, DTOs, design tokens, and business rules from packages. Do not duplicate divergent constants.
4. Write or update tests for domain rules, API services, RBAC, and report aggregation whenever you touch those areas.
5. After each batch, run the strongest feasible checks: `pnpm lint`, `pnpm typecheck`, relevant `pnpm test`, and any module-specific e2e. If commands cannot run, report exactly why.
6. Always summarize: files changed, tests run, remaining risks, and next task ID.
7. Never hardcode production secrets, real affiliate IDs, real OAuth secrets, production database URLs, or private user data.
8. Use development stubs for OAuth, affiliate links, and AI import analysis until real integrations are explicitly provided.
9. Keep API and mobile behavior consistent with the OpenAPI/DB/schema documents.
10. Preserve Korean UX copy tone: easy, warm, polite 해요체.

## 4. Non-negotiable Business Rules
- 추천 점수에 제휴수수료율을 직접 넣지 않는다.
- 구매 CTA 인접 위치에 제휴 고지를 숨기지 않는다.
- 스폰서 상품은 광고/스폰서로 명확히 표시한다.
- 엑셀 분석 결과는 사용자 승인 전 `expenses`에 저장하지 않는다.
- 삭제된 지출은 soft delete 처리하고 audit log에 남긴다.
- 선물 받은 물건은 기본 지출 합계에서 제외한다.
- 금액은 0보다 큰 원화 정수만 허용한다.
- 사진/영수증 AI, 커뮤니티, 가격 추적, 중고 연동, 보험/금융 제휴, 의료 조언은 MVP에서 구현하지 않는다.

## 5. Required Output After Each Codex Run
Return this format:

```text
[Task IDs]
- Implemented: ...
- Deferred: ...

[Files Changed]
- path: summary

[Tests/Checks]
- command: result

[Do Not Change Compliance]
- screen ids preserved: yes/no
- API base preserved: yes/no
- affiliate disclosure preserved: yes/no
- recommendation commission excluded: yes/no
- import preview-before-save preserved: yes/no

[Next Recommended Task]
- TASK-ID and reason
```
