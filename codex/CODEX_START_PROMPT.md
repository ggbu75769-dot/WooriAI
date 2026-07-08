# CODEX START HERE — 우리아이 MVP 구현 지시문 v0.5

당신은 우리아이 MVP를 구현하는 Codex입니다. 이 패키지의 `docs/` 폴더가 구현의 단일 기준입니다. 임의로 제품 방향, 화면 구조, 기술 스택, MVP 범위를 재해석하지 마세요.

## 1. 먼저 읽을 문서

반드시 아래 순서로 읽은 뒤 구현을 시작하세요.

1. `docs/4차/prompts/01_codex_master_instruction_v0_4.md`
2. `docs/4차/prompts/04_do_not_change_v0_4.md`
3. `docs/4차/prompts/02_implementation_plan_v0_4.md`
4. `docs/4차/prompts/03_task_breakdown_v0_4.md`
5. `docs/4차/prompts/08_codex_iteration_prompts_v0_4.md`
6. `docs/4차/prompts/05_acceptance_criteria_v0_4.md`
7. `docs/4차/prompts/06_qa_runbook_v0_4.md`
8. `docs/4차/prompts/07_release_checklist_v0_4.md`

보조 기준 문서는 다음 순서로 참조하세요.

- 제품 방향/범위: `docs/1차/제품기획_문서/wooriai_product_docs_v0_1.docx`
- 화면/상태/디자인: `docs/2차/화면고정_문서/wooriai_phase2_screen_design_docs_v0_2.docx`
- 개발/DB/API/상태관리: `docs/3차/개발고정_문서/wooriai_phase3_dev_fixed_docs_v0_3.docx`
- DB 계약: `docs/3차/db_api/wooriai_phase3_schema_v0_3.sql`
- API 계약: `docs/3차/db_api/wooriai_phase3_openapi_v0_3.yaml`
- 프로젝트 구조 계약: `docs/3차/db_api/wooriai_phase3_project_structure_v0_3.md`

## 2. 충돌 시 우선순위

문서 간 충돌이 있으면 다음 우선순위를 따르세요.

1. `docs/4차/prompts/04_do_not_change_v0_4.md`
2. `docs/4차/contracts/do_not_change_contract_v0_4.yaml`
3. `docs/4차/prompts/05_acceptance_criteria_v0_4.md`
4. `docs/3차/db_api/wooriai_phase3_openapi_v0_3.yaml` 및 `wooriai_phase3_schema_v0_3.sql`
5. `docs/3차/개발고정_문서/wooriai_phase3_dev_fixed_docs_v0_3.docx`
6. `docs/2차/화면고정_문서/wooriai_phase2_screen_design_docs_v0_2.docx`
7. `docs/1차/제품기획_문서/wooriai_product_docs_v0_1.docx`
8. `docs/0_원본아이디어/아이_가계부_어플_설계.txt`

## 3. 제품 본질

우리아이는 일반 가계부 앱이 아닙니다. 다음 핵심 루프를 구현하는 아이 비용 관리 + 시기별 준비템 구매 내비게이션 앱입니다.

`지출 기록 → 총액 확인 → 시기별 준비템 확인 → 구매 링크 클릭 → 구매 후 기록/상태 체크`

사용자는 “가계부를 쓴다”가 아니라 “우리 아이에게 해준 것을 남긴다”고 느껴야 합니다.

## 4. 절대 변경 금지

아래 항목은 구현 중 임의 변경하지 마세요.

- 하단 탭은 `홈 / 기록 / 준비템 / 리포트` 4개를 유지합니다.
- 화면 ID는 2차 화면 정의 문서 기준을 유지합니다.
- 기술 스택은 React Native + Expo, NestJS, PostgreSQL + Prisma, TanStack Query + Zustand를 기준으로 합니다.
- API는 `/api/v1` 기반 REST JSON을 유지합니다.
- 추천 점수에 제휴수수료율을 직접 반영하지 않습니다.
- 구매 CTA 인접 위치에 제휴 고지를 반드시 표시합니다.
- 스폰서 상품은 광고/스폰서로 명확히 표시합니다.
- 엑셀 분석 결과는 사용자 승인 전 `expenses`에 저장하지 않습니다.
- 지출 삭제는 soft delete + audit log를 유지합니다.
- 선물 받은 물건은 기본 지출 합계에서 제외합니다.
- 금액은 0보다 큰 원화 정수만 허용합니다.
- 사진/영수증 AI, 커뮤니티, 가격 추적, 중고 연동, 보험/금융 제휴, 의료 조언은 MVP에서 구현하지 않습니다.

## 5. 실행 방식

`docs/4차/prompts/08_codex_iteration_prompts_v0_4.md`의 Batch 순서대로 실행하세요.

권장 순서:

- Batch 00: Source Lock
- Batch 01: Repo Bootstrap
- Batch 02: Domain & Contracts
- Batch 03: DB & Seed
- Batch 04: API Foundation
- Batch 05: Auth & Onboarding
- Batch 06: Expense Home Report
- Batch 07: Items Commerce Affiliate
- Batch 08: Family Invite
- Batch 09: Excel Import Beta
- Batch 10: Admin CMS Settings
- Batch 11: QA Release Hardening

각 Batch는 지정된 Task ID 범위만 구현하고, 다음 Batch 범위의 기능을 미리 구현하지 마세요.

## 6. 각 실행 후 반드시 보고할 형식

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

## 7. 시작 명령

이 지시문을 읽은 뒤 먼저 리포지토리와 문서 구조를 스캔하고, `Batch 00 — Source Lock`부터 시작하세요. 기능 구현은 Source Lock 산출물을 만든 뒤 진행합니다.
