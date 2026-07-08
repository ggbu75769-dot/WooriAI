# 06. 요구사항 매트릭스

## 1. P0 기능 요구사항

| ID | 요구사항 | 우선순위 | 수용 기준 |
|---|---|---:|---|
| REQ-001 | 진단 결과에서 Proof Board 바로 생성 | P0 | 추가 질문 없이 `/proof/board` 진입 |
| REQ-002 | pilot-design questions 필수 경로 제거 | P0 | funnel test에서 questions route를 지나지 않음 |
| REQ-003 | 진단 결과 기반 WorkProfile 자동 생성 | P0 | workType/monthlyVolume/riskDomains default 생성 |
| REQ-004 | Board 상단 KPI 표시 | P0 | 처리/사용률/절감/위험/사람확인/신뢰도 표시 |
| REQ-005 | 텍스트 붙여넣기 입력 | P0 | 1건 입력 후 ResultCard 생성 |
| REQ-006 | CSV/XLSX 최소 업로드 | P0 | 5MB/50행 제한, content column detect |
| REQ-007 | ResultCard redesign | P0 | 요약/초안/누락정보/주의표현/사람확인/액션 표시 |
| REQ-008 | 1클릭 사용 여부 | P0 | copied_only/used_as_is/used_with_edits/not_used 저장 |
| REQ-009 | 위험표현 감지 | P0 | 가격/납기/계약/환불/보상/개인정보/자동발송 감지 |
| REQ-010 | PII 마스킹/차단 | P0 | 원문 저장 금지, 위험 이벤트 기록 |
| REQ-011 | ProofScore 계산 | P0 | adoption/efficiency/quality/contract/risk 점수 표시 |
| REQ-012 | Verdict 생성 | P0 | passed/conditional/retest/failed/data 부족 표시 |
| REQ-013 | 10일 결과표 | P0 | score, 숫자, 가능/제외 범위, 전환 CTA 표시 |
| REQ-014 | Admin report review/publish | P0 | draft/review/published/recheck 상태 관리 |
| REQ-015 | Conversion request | P0 | report context와 함께 저장 |
| REQ-016 | Access token scope guard | P0 | board_access/report_view 분리 |
| REQ-017 | Analytics funnel | P0 | 핵심 이벤트 비식별 저장 |
| REQ-018 | 1000명 부하 기본 설계 | P0 | indexes/rate limit/job 설계 포함 |

## 2. 비기능 요구사항

| ID | 요구사항 | 목표 |
|---|---|---:|
| NFR-001 | P95 text intake | 10초 이하 |
| NFR-002 | 첫 결과 카드 도달 시간 | 3분 이하 |
| NFR-003 | CSV 50행 처리 | 3분 이하, 비동기 권장 |
| NFR-004 | Edge 오류율 | 1% 이하 |
| NFR-005 | token leakage | 0건 |
| NFR-006 | analytics 개인정보 | 0건 |
| NFR-007 | 모바일 가로 스크롤 | 320px 이상 0건 |
| NFR-008 | a11y | 주요 CTA keyboard accessible |
| NFR-009 | data retention | raw file 기본 delete_after_parse |
| NFR-010 | test coverage | core/scoring/security/e2e 유지 |

## 3. 추적 매트릭스

| 요구사항 | 관련 문서 | 관련 파일 |
|---|---|---|
| REQ-001~003 | 04, 05, 08 | `SurveyResult.tsx`, `ProofPages.tsx`, `lib/proof.ts` |
| REQ-004~008 | 09, 13 | `ProofPages.tsx`, `styles/proof.module.css`, `lib/proof.ts` |
| REQ-009~012 | 16, 17 | `lib/proofCore.ts`, `lib/proof.ts`, tests |
| REQ-013~015 | 10, 23 | `lib/proofReport.ts`, `/proof/report`, admin reports |
| REQ-016 | 18 | `lib/proofAuth.ts`, Edge Function, migrations |
| REQ-017 | 20 | `lib/analytics.ts`, `lib/proof.ts` events |
| REQ-018 | 19, 22 | migrations, Edge Function, usage limits |

## 4. Completion checklist

- [ ] 중복 설문 없는 funnel E2E 통과
- [ ] Board 첫 화면에 KPI와 input이 모두 보임
- [ ] ResultCard 4버튼이 항상 접근 가능
- [ ] ProofScore가 Dashboard/Report에 연결됨
- [ ] Report에 월 19만 원 전환 근거가 표시됨
- [ ] Supabase summary read가 가능함
- [ ] localStorage는 cache/demo fallback으로만 사용됨
- [ ] security test에서 secret/token/raw text leakage 없음
- [ ] mobile 320/375/768/1440 캡처 통과


## Codex 실행 프롬프트

```text
당신은 agentproofKR/agentproofKR.github.io 저장소만 작업한다. 다른 프로젝트 구조나 다른 저장소 개념을 섞지 않는다.
작업 전 이 문서와 docs/agentproof-super-mvp-v1/00_README_FOR_CODEX.md를 읽고, 관련 현재 파일을 직접 확인한다.
변경은 작은 단위로 수행하고, TypeScript strict, 개인정보/토큰 비노출, 한국어 UI, 320px 이상 가로 스크롤 금지를 유지한다.
작업 후 pnpm lint, pnpm typecheck, pnpm test, 관련 Playwright/E2E 또는 security test를 실행하고 실패를 수정한다.
```
