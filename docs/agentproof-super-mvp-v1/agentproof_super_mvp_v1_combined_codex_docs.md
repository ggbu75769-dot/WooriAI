# AgentProof Super MVP v1 — Combined Codex Docs


---

<!-- 00_README_FOR_CODEX.md -->

# AgentProof Super MVP v1 — Codex 작업 문서 팩

작성일: 2026-07-07  
대상 저장소: `agentproofKR/agentproofKR.github.io`  
작업 원칙: **AgentProof 단독 분석/설계/구현. 다른 프로젝트 구조를 혼합하지 않는다.**

## 1. 이 문서 팩의 목적

이 문서 팩은 현재 AgentProof MVP를 **실제 서비스 가능한 Super MVP**로 개선하기 위한 Codex용 실행 지시서다. 목표는 단순 설명이 아니라 Codex가 바로 파일을 열고, 수정하고, 테스트하고, 검증할 수 있게 만드는 것이다.

## 2. 최종 제품 방향

AgentProof는 중소기업이 AI를 실제 업무에 써도 되는지 10일 동안 숫자로 증명하는 **AI 업무 검증 플랫폼**이다.

핵심 플로우는 다음 하나로 고정한다.

```txt
랜딩 → 무료 업무진단 → 진단 결과 → 10일 Proof Board 바로 생성 → 실제 업무 입력 → 결과 카드 → 사용 여부 피드백 → Proof Score/10일 결과표 → 월 19만 원 운영 전환 문의
```

## 3. 반드시 제거할 UX 문제

현재 10일 파일럿 내부에 `proofDesignQuestions` 기반 추가 설문 흐름이 있다. Super MVP에서는 필수 경로에서 제거한다.

```txt
금지: 진단 완료 후 또 업무 파악 설문을 요구한다.
허용: 진단 결과 기반으로 WorkProfile/WorkContract를 자동 생성하고, 고급 설정에서만 수정하게 한다.
```

## 4. Codex 문서 읽기 순서

1. `00_README_FOR_CODEX.md`
2. `01_PRODUCT_DEFINITION.md`
3. `02_CURRENT_SOURCE_AUDIT.md`
4. `03_SUPER_MVP_STRATEGY.md`
5. `04_USER_JOURNEY_AND_FUNNEL.md`
6. `05_INFORMATION_ARCHITECTURE_AND_ROUTES.md`
7. `06_REQUIREMENTS_MATRIX.md`
8. `07_FUNCTIONAL_SPEC.md`
9. `08~11_SCREEN_SPEC_*`
10. `12_BRAND_DESIGN_SYSTEM.md`
11. `13_UI_COMPONENT_SYSTEM.md`
12. `14_DATA_MODEL_SUPABASE.md`
13. `15_API_EDGE_FUNCTION_CONTRACTS.md`
14. `16_STATE_MACHINE_AND_SCORING.md`
15. `24_QA_TEST_STRATEGY.md`
16. `29_CODEX_EXECUTION_PROTOCOL.md`
17. `31_BACKLOG_TASK_PACKETS.md`
18. `codex-prompts/`의 해당 작업 프롬프트

## 5. 구현 전 반드시 확인할 현재 파일

| 영역 | 파일 |
|---|---|
| 랜딩/히어로 | `components/home/HomeHero.tsx`, `styles/landing.module.css` |
| 무료 진단 결과 | `app/survey/result/page.tsx`, `components/survey/SurveyResult.tsx` |
| Proof 제품 화면 | `app/proof/board/page.tsx`, `app/proof/dashboard/page.tsx`, `app/proof/report/page.tsx`, `components/proof/ProofPages.tsx` |
| Proof 도메인 | `lib/proof.ts`, `lib/proofCore.ts`, `lib/proofReport.ts`, `lib/proofRepository.ts`, `lib/proofSubmission.ts` |
| 접근/보안 | `lib/proofAuth.ts`, `lib/proofRedaction.ts`, `lib/proofAuditLog.ts`, `lib/proofUsageLimits.ts` |
| Edge Function | `supabase/functions/proof-submit/index.ts` |
| DB | `supabase/migrations/*.sql` |
| 테스트 | `tests/**`, `playwright.config.ts`, `scripts/run-security-checks.mjs` |

## 6. 완료 정의

어떤 작업도 아래가 되지 않으면 완료가 아니다.

- 사용자가 추가 설문 없이 Board까지 갈 수 있음
- 변경 화면이 숫자 중심으로 보임
- 개인정보/원문/토큰을 localStorage, analytics, log, bundle에 노출하지 않음
- `pnpm lint`, `pnpm typecheck`, `pnpm test` 통과
- 관련 E2E/security/content test 추가 또는 갱신
- 변경 내역과 리스크를 문서/PR 설명에 기록


## Codex 실행 프롬프트

```text
당신은 agentproofKR/agentproofKR.github.io 저장소만 작업한다. 다른 프로젝트 구조나 다른 저장소 개념을 섞지 않는다.
작업 전 이 문서와 docs/agentproof-super-mvp-v1/00_README_FOR_CODEX.md를 읽고, 관련 현재 파일을 직접 확인한다.
변경은 작은 단위로 수행하고, TypeScript strict, 개인정보/토큰 비노출, 한국어 UI, 320px 이상 가로 스크롤 금지를 유지한다.
작업 후 pnpm lint, pnpm typecheck, pnpm test, 관련 Playwright/E2E 또는 security test를 실행하고 실패를 수정한다.
```


---

<!-- 01_PRODUCT_DEFINITION.md -->

# 01. 제품 정의서 — AgentProof Super MVP v1

## 1. 제품명 체계

| 구분 | 이름 | 사용자에게 보이는 설명 |
|---|---|---|
| 서비스 | AgentProof | AI 업무 검증 플랫폼 |
| 핵심 제품 화면 | Proof Board | 실제 업무를 넣고 결과 카드를 받는 화면 |
| 파일럿 상품 | 10-Day Proof Test | 10일 동안 실제 업무 50건으로 도입 가능성을 증명 |
| 핵심 점수 | Proof Score | 0~100점 AI 업무 운영 가능성 점수 |
| 결과물 | 10일 결과표 | 대표/팀장 의사결정용 숫자 리포트 |

## 2. 한 줄 정의

**AgentProof는 중소기업이 AI를 실제 업무에 써도 되는지 10일 동안 숫자로 증명하는 AI 업무 검증 플랫폼이다.**

## 3. 고객이 이해하는 문장

```txt
AI에게 맡긴 업무, 정말 안전하게 굴러가고 있나요?
AgentProof는 실제 업무 50건을 검증해 처리량, 절감시간, 사용률, 위험표현, 사람 확인 필요 기준을 10일 결과표로 보여줍니다.
```

## 4. 핵심 고객

| 사용자 | 상황 | 원하는 것 |
|---|---|---|
| 실무자 | 문의/견적/납기/발주/고객응대 초안을 매일 처리 | 빠른 요약, 안전한 답변 초안, 누락정보 체크 |
| 팀장 | AI 답변이 고객에게 나가기 전에 리스크를 줄여야 함 | 사람 확인 기준, 위험표현 집계, 사용률 |
| 대표/임원 | 월 19만 원 운영 전환 여부 판단 | 처리량, 절감시간, 리스크 통제, 결과표 |
| 운영자/Admin | 좋은 파일럿 고객을 선별하고 전환시키고 싶음 | 신청 검토, 리포트 검수, 보안 이벤트, 전환 문의 |

## 5. Super MVP 가치 명제

월 19만 원을 낼 이유는 다음 5개 숫자로 증명한다.

1. **처리건수**: 10일 동안 실제 업무를 몇 건 처리했는가.
2. **사용률**: AI 결과 카드가 그대로/수정 후 실제로 쓰였는가.
3. **절감시간**: 과장하지 않은 보수적 시간 절감이 있었는가.
4. **위험표현**: 가격/납기/계약/환불/보상/개인정보/자동발송 위험이 잡혔는가.
5. **사람 확인 기준**: 어떤 조건에서 사람이 반드시 봐야 하는지 정리됐는가.

## 6. P0 범위

| 포함 | 제외 |
|---|---|
| 무료 진단 결과에서 Board 바로 생성 | 파일럿 내부 추가 설문 필수화 |
| 업무 1개, 10일, 50건, 최대 3명 | 다중 업무, 대규모 팀 초대 |
| 텍스트 붙여넣기, CSV/XLSX 최소 업로드 | 복잡한 ERP/CRM 연동 |
| 결과 카드: 요약/초안/누락정보/주의표현/사람확인 | 자동 고객 발송 |
| 1클릭 사용 여부 | 장문 피드백 강제 |
| Proof Score/10일 결과표 | PDF 강제, 화려한 보고서 우선 |
| 관리자 검수/공개 | 완전 자동 승인 |
| PII 탐지/마스킹/감사 로그 | 원문 무기한 저장 |

## 7. 제품 원칙

- 진단은 한 번만 한다.
- 첫 결과 카드는 3분 안에 보여준다.
- 모든 핵심 화면은 글보다 숫자가 먼저다.
- 사용자는 `케이스`, `워크스페이스`, `피드백`보다 `업무`, `파일럿 보드`, `사용 여부`라는 단어를 본다.
- AI 결과는 항상 초안이며 최종 판단은 사람이 한다.
- 가격/납기/계약/환불/보상/개인정보/자동발송은 위험표현으로 집계한다.
- 보안/개인정보/토큰 비노출은 P0다.

## 8. 성공 기준

| 지표 | 목표 |
|---|---:|
| 진단 완료 후 Board 생성률 | 25% 이상 |
| 첫 결과 카드 도달 시간 | 3분 이내 |
| 첫 세션 1건 이상 입력률 | 70% 이상 |
| 1클릭 사용 여부 입력률 | 50% 이상 |
| 10일 결과표 생성 프로젝트 | 20% 이상 |
| 파일럿 완료 후 전환 문의 | 15% 이상 |


## Codex 실행 프롬프트

```text
당신은 agentproofKR/agentproofKR.github.io 저장소만 작업한다. 다른 프로젝트 구조나 다른 저장소 개념을 섞지 않는다.
작업 전 이 문서와 docs/agentproof-super-mvp-v1/00_README_FOR_CODEX.md를 읽고, 관련 현재 파일을 직접 확인한다.
변경은 작은 단위로 수행하고, TypeScript strict, 개인정보/토큰 비노출, 한국어 UI, 320px 이상 가로 스크롤 금지를 유지한다.
작업 후 pnpm lint, pnpm typecheck, pnpm test, 관련 Playwright/E2E 또는 security test를 실행하고 실패를 수정한다.
```


---

<!-- 02_CURRENT_SOURCE_AUDIT.md -->

# 02. 현재 소스 분석서

## 1. 현재 저장소 성격

대상 저장소는 `agentproofKR/agentproofKR.github.io`다. 현재 구조는 랜딩 페이지를 넘어, 다음 기능 골격을 이미 갖고 있다.

- Next.js static export
- GitHub Pages 배포
- Supabase Edge Function 기반 제출
- Supabase Postgres migrations
- 무료 업무진단
- 10일 Proof Test 신청/설계
- Proof Board
- AI Validation
- Dashboard
- Report
- Admin dashboards
- ProofCore 도메인 모델
- PII/민감정보 탐지/마스킹
- Project access token/scope 설계

## 2. 현재 route map

| Route | 현재 역할 | Super MVP 판정 |
|---|---|---|
| `/` | 랜딩 | 유지, 숫자/브랜딩 강화 |
| `/survey` | 무료 진단 | 유지 |
| `/survey/[persona]` | 역할별 진단 | 유지 |
| `/survey/result` | 결과 | Board 바로 생성 CTA로 전환 |
| `/proof/pilot-design/start` | 파일럿 설계 시작 | 질문 시작이 아니라 Board 생성 준비로 변경 |
| `/proof/pilot-design/questions` | 추가 설문 | 필수 경로에서 제거, 고급 설정으로 숨김 |
| `/proof/pilot-design/draft` | 설계 초안 | 1페이지 확인 화면으로 축소 |
| `/proof/board` | 파일럿 업무 보드 | 핵심 제품 화면으로 격상 |
| `/proof/dashboard` | 파일럿 대시보드 | Evidence Dashboard로 강화 |
| `/proof/report` | 10일 결과표 | 대표/팀장용 숫자 리포트로 강화 |
| `/proof/ai-validation` | AI 답변 검사 | Board 탭 또는 모드로 병합 |
| `/proof/convert` | 전환 문의 | Report CTA와 연결 |
| `/admin/dashboard` | 운영자 홈 | 유지/강화 |
| `/admin/pilot-applications` | 신청 검토 | 유지 |
| `/admin/projects` | 프로젝트 관리 | token/report scope 강화 |
| `/admin/reports` | 리포트 검수 | P0 핵심 |
| `/admin/audit-security` | 보안 감사 | P0 핵심 |
| `/admin/conversions` | 전환 문의 | P0 핵심 |
| `/admin/ai-settings` | AI provider/routing | P1 또는 운영자 전용 |

## 3. 핵심 파일 분석

| 파일 | 현재 역할 | 개선 방향 |
|---|---|---|
| `components/home/HomeHero.tsx` | 랜딩 hero, 숫자 샘플, CTA | Proof Board/10일 결과표 미리보기 강화 |
| `components/proof/ProofPages.tsx` | Proof 화면 대부분이 한 파일에 집중 | Super MVP 이후 점진적 컴포넌트 분리 필요 |
| `lib/proof.ts` | ResultCard, BoardMetrics, WorkProfile, 정책, 제출 helper | 사용자 용어/Board summary DTO 강화 |
| `lib/proofCore.ts` | WorkContract, ProofSession, ProofEvent, ProofScore, Verdict | Super MVP score/report의 핵심 엔진으로 연결 |
| `lib/proofRepository.ts` | local/supabase repository abstraction 일부 | Supabase-first read/write로 확장 |
| `lib/proofReport.ts` | report helper | visual scorecard/report reliability 강화 |
| `lib/proofSubmission.ts` | Edge submit wrapper | read endpoint/summary endpoint 필요 |
| `supabase/functions/proof-submit/index.ts` | write payload 처리 | query/summary/job/access 검증 강화 |
| `supabase/migrations/*.sql` | proof tables 존재 | job tables/indexes/summary views 추가 |

## 4. 현재 강점

1. 이미 MVP 흐름이 구현되어 있다.
2. ResultCard 구조가 사용자 가치와 잘 맞는다.
3. BoardMetrics가 숫자 중심 설계에 적합하다.
4. proofCore가 WorkContract/ProofSession/ProofScore/Verdict/EvidenceLedger까지 포함한다.
5. PII/토큰/원문 저장 정책에 대한 의식이 이미 있다.
6. Supabase migrations와 Edge contract가 있어 1000명 운영 MVP로 확장 가능하다.
7. 관리자 화면이 이미 존재해 P0 운영형 MVP에 적합하다.

## 5. 현재 가장 큰 gap

| Gap | 위험 | 해결 |
|---|---|---|
| 진단 후 파일럿 내부 추가 설문 | 전환 이탈 | 진단 결과 기반 Board 자동 생성 |
| localStorage 중심 UX | 실제 운영 데이터 불일치 | Supabase-first hydration |
| Board/Dashboard/Report 분리 약함 | 숫자 흐름이 안 보임 | shared summary DTO |
| CSV 동기 처리 가능성 | 50행 이상 지연/timeout | proof_jobs 도입 |
| ResultCard UI 정보 과다 | 사용자가 바로 못 봄 | Toss식 카드 재설계 |
| Token URL 장기 노출 | 보안 리스크 | token exchange/expiry/scope 강화 |
| Report 글 중심 | 대표 판단 어려움 | Proof Score/도표/판정 중심 |

## 6. 우선 적용 순서

1. `/survey/result` → `/proof/board` 바로 생성 CTA.
2. `/proof/pilot-design/questions` 필수 경로 제거.
3. Proof Board 상단 KPI와 ResultCard 재설계.
4. ProofScore/Verdict/EvidenceLedger를 Dashboard/Report에 연결.
5. Supabase summary endpoint와 repository read 모델 추가.
6. CSV job 처리와 필수 indexes 추가.
7. Admin report publish/conversion funnel 완성.


## Codex 실행 프롬프트

```text
당신은 agentproofKR/agentproofKR.github.io 저장소만 작업한다. 다른 프로젝트 구조나 다른 저장소 개념을 섞지 않는다.
작업 전 이 문서와 docs/agentproof-super-mvp-v1/00_README_FOR_CODEX.md를 읽고, 관련 현재 파일을 직접 확인한다.
변경은 작은 단위로 수행하고, TypeScript strict, 개인정보/토큰 비노출, 한국어 UI, 320px 이상 가로 스크롤 금지를 유지한다.
작업 후 pnpm lint, pnpm typecheck, pnpm test, 관련 Playwright/E2E 또는 security test를 실행하고 실패를 수정한다.
```


---

<!-- 03_SUPER_MVP_STRATEGY.md -->

# 03. Super MVP 전략서

## 1. 전략 문장

**AgentProof Super MVP는 더 많은 기능을 추가하는 프로젝트가 아니다. 이미 있는 기능을 하나의 숫자 중심 운영 흐름으로 압축해 실제 고객 1000명이 바로 쓸 수 있는 서비스로 만드는 프로젝트다.**

## 2. 제품 전략

| 전략 | 설명 |
|---|---|
| Flow compression | 진단 후 다시 묻지 않고 Board로 직행 |
| Proof-first | 모든 기능은 결과표에 숫자로 반영되어야 함 |
| One workflow | P0는 업무 1개, 10일, 50건, 3명으로 제한 |
| Human gate | 위험표현은 자동 발송/확정이 아니라 사람 확인으로 전환 |
| Conservative ROI | 절감시간과 전환 근거는 과장하지 않음 |
| Service-ready | local demo가 아니라 Supabase source of truth |
| Visual decision | 대표가 10초 안에 판단 가능한 숫자/차트 UI |

## 3. MVP 범위 재정의

### P0 — 반드시 이번에 완료

- Survey Result에서 Proof Board 생성
- 중복 파일럿 설문 제거
- Board 상단 KPI
- ResultCard 재디자인
- 1클릭 사용 여부
- ProofScore/Verdict 연결
- Report visual scorecard
- Supabase summary hydration
- CSV job 설계/기본 구현
- Admin report review/publish
- access token scope/expiry guard
- analytics funnel
- E2E/security/visual regression

### P1 — Super MVP 직후

- PDF report
- 이메일 알림
- 고급 팀 초대
- 모델별 비용 대시보드
- provider 비교 화면
- 실패 행 재처리 UI
- 업종별 benchmark

### P2 — Enterprise

- 다중 업무 동시 검증
- ERP/CRM/메일/카카오/Slack 연동
- Azure/OpenAI-compatible/custom provider
- 온프레미스/로컬 모델
- 기관/협회 패키지

## 4. P0에서 절대 하지 말 것

- 자동 고객 발송
- 최종 가격/납기/계약/환불/보상 확정
- 복잡한 조직 관리
- 무제한 provider 등록
- 진단 이후 설문 반복
- 사용자가 긴 피드백을 작성하게 만들기
- 원문 무기한 저장
- 가짜 고객 수치/후기/인증 표시

## 5. 차별화 포인트

| 경쟁 유형 | 그들의 메시지 | AgentProof 메시지 |
|---|---|---|
| AI 챗봇 제작툴 | AI를 만들어드립니다 | AI에게 맡겨도 되는지 증명합니다 |
| LLMOps | prompt/trace/eval을 관리합니다 | 실무자가 쓴 결과와 위험을 숫자로 보여줍니다 |
| 컨설팅 | 진단 리포트를 제공합니다 | 실제 업무 50건으로 10일 결과표를 만듭니다 |
| 업무 자동화 | 업무를 자동화합니다 | 자동화 전에 위험표현과 사람 확인 기준을 만듭니다 |

## 6. Super MVP의 북극성 지표

```txt
10일 결과표가 생성되고, 대표/팀장이 월 19만 원 운영 전환 여부를 판단한 Proof Project 수
```

보조 지표:

- Board 생성률
- 첫 결과 카드 도달 시간
- 처리건수
- 1클릭 사용 여부 입력률
- Proof Score 분포
- 위험표현 해결률
- report published rate
- conversion request rate


## Codex 실행 프롬프트

```text
당신은 agentproofKR/agentproofKR.github.io 저장소만 작업한다. 다른 프로젝트 구조나 다른 저장소 개념을 섞지 않는다.
작업 전 이 문서와 docs/agentproof-super-mvp-v1/00_README_FOR_CODEX.md를 읽고, 관련 현재 파일을 직접 확인한다.
변경은 작은 단위로 수행하고, TypeScript strict, 개인정보/토큰 비노출, 한국어 UI, 320px 이상 가로 스크롤 금지를 유지한다.
작업 후 pnpm lint, pnpm typecheck, pnpm test, 관련 Playwright/E2E 또는 security test를 실행하고 실패를 수정한다.
```


---

<!-- 04_USER_JOURNEY_AND_FUNNEL.md -->

# 04. 사용자 여정과 퍼널 설계서

## 1. 전체 퍼널

```txt
방문
  ↓
무료 업무진단 시작
  ↓
진단 완료
  ↓
결과 확인
  ↓
Proof Board 생성
  ↓
첫 업무 입력
  ↓
첫 결과 카드 확인
  ↓
사용 여부 클릭
  ↓
10일 누적 사용
  ↓
10일 결과표 확인
  ↓
운영 전환 문의
```

## 2. 사용자 유형별 목표

### 실무자

- 긴 설명을 읽지 않고 바로 붙여넣고 싶다.
- 결과 카드에서 초안/주의표현/누락정보를 바로 보고 싶다.
- 사용 여부는 1클릭이면 충분하다.

### 팀장

- 어떤 표현이 위험한지 알고 싶다.
- 사람이 확인해야 하는 기준을 만들고 싶다.
- 직원들이 실제로 쓰는지 보고 싶다.

### 대표/임원

- 월 19만 원을 낼 이유가 있는지 보고 싶다.
- 시간을 얼마나 줄였는지 보고 싶다.
- 위험을 통제할 수 있는지 보고 싶다.

### 운영자/Admin

- 좋은 파일럿 고객을 선별하고 싶다.
- 리포트 공개 전 검수하고 싶다.
- 보안 이벤트/원문 접근을 감사하고 싶다.

## 3. 핵심 전환 이벤트

| 단계 | 이벤트명 | 성공 기준 |
|---|---|---|
| 진단 시작 | `survey_started` | 랜딩 CTA 클릭 |
| 진단 완료 | `survey_completed` | result page 진입 |
| Board CTA | `survey_result_board_cta_clicked` | 결과 페이지 CTA |
| Board 생성 | `proof_board_created_from_survey` | project/session/workProfile 생성 |
| 첫 입력 | `proof_first_input_submitted` | text/csv intake 성공 |
| 첫 카드 | `proof_first_result_card_created` | result card visible |
| 피드백 | `proof_feedback_clicked` | 4버튼 중 하나 클릭 |
| 리포트 초안 | `proof_report_draft_created` | report draft 생성 |
| 리포트 공개 | `proof_report_published` | admin publish |
| 전환 문의 | `proof_conversion_requested` | convert form submitted |

## 4. 핵심 UX 원칙

- 결과 페이지 CTA 이후 질문을 다시 하지 않는다.
- Board 첫 진입 시 “샘플로 보기”와 “업무 붙여넣기” 둘 중 하나를 즉시 제공한다.
- 첫 결과 카드까지 3분 이내다.
- Board는 항상 다음 액션을 하나만 강조한다.
- 10일 결과표는 사용자가 리포트를 작성하지 않아도 자동으로 준비된다.

## 5. 이탈 방지 포인트

| 위치 | 이탈 원인 | 해결 |
|---|---|---|
| 결과 페이지 | CTA가 상담/신청처럼 보임 | “Board 바로 만들기”로 변경 |
| pilot-design questions | 또 질문해서 피로 | 필수 제거 |
| Board empty | 뭘 넣어야 하는지 모름 | 업무 예시 카드 + 샘플 실행 |
| ResultCard | 정보가 많아 복사/사용 버튼 안 보임 | 위험/초안/액션 고정 레이아웃 |
| Report | 글이 많아 판단 어려움 | Proof Score + 5개 숫자 + 판정 |

## 6. 10일 파일럿 Day별 상태

| Day | 사용자 행동 | 시스템 결과 |
|---:|---|---|
| 0 | 진단 완료, Board 생성 | WorkProfile/WorkContract/ProofSession 생성 |
| 1 | 실제 업무 1~5건 입력 | 첫 ResultCard, baseline metrics |
| 2~3 | 반복 입력 | 위험표현/사람 확인 집계 |
| 4~5 | 사용 여부 클릭 누적 | 사용률/수정 후 사용률 계산 |
| 6~7 | CSV 업로드 또는 추가 입력 | 처리건수 목표 진척 |
| 8 | Dashboard 확인 | ProofScore 중간 계산 |
| 9 | 관리자 리포트 검수 | Report draft/review |
| 10 | 결과표 확인 | Verdict/Conversion CTA |


## Codex 실행 프롬프트

```text
당신은 agentproofKR/agentproofKR.github.io 저장소만 작업한다. 다른 프로젝트 구조나 다른 저장소 개념을 섞지 않는다.
작업 전 이 문서와 docs/agentproof-super-mvp-v1/00_README_FOR_CODEX.md를 읽고, 관련 현재 파일을 직접 확인한다.
변경은 작은 단위로 수행하고, TypeScript strict, 개인정보/토큰 비노출, 한국어 UI, 320px 이상 가로 스크롤 금지를 유지한다.
작업 후 pnpm lint, pnpm typecheck, pnpm test, 관련 Playwright/E2E 또는 security test를 실행하고 실패를 수정한다.
```


---

<!-- 05_INFORMATION_ARCHITECTURE_AND_ROUTES.md -->

# 05. IA 및 라우트 설계서

## 1. IA 원칙

- Public은 유입과 진단까지만 담당한다.
- Product는 `Proof Board`, `Dashboard`, `Report` 3개 축으로 단순화한다.
- Admin은 운영/검수/전환/보안만 담당한다.
- 기존 route를 가능한 유지해 regression을 줄인다.
- 사용자 화면에는 개발 용어를 숨긴다.

## 2. Public IA

```txt
/
/survey
/survey/[persona]
/survey/result
/privacy
/privacy/request
/beta-terms
/login
```

## 3. Product IA

```txt
/proof/board
/proof/dashboard
/proof/report
/proof/result-cards/[id]
/proof/convert
/proof/workspace         # legacy compatibility, board로 redirect 또는 alias
/proof/ai-validation    # P0에서는 board mode로 병합 안내
/proof/pilot-design/start     # Board 생성 확인 화면
/proof/pilot-design/draft     # optional 확인 화면
/proof/pilot-design/questions # optional advanced settings only
```

## 4. Admin IA

```txt
/admin/dashboard
/admin/pilot-applications
/admin/projects
/admin/reports
/admin/result-cards
/admin/audit-security
/admin/conversions
/admin/ai-settings
```

## 5. 라우트별 변경 정책

| Route | P0 정책 |
|---|---|
| `/survey/result` | CTA: “10일 Proof Board 바로 만들기”. 진단 결과 기반 context 저장/전송 |
| `/proof/pilot-design/start` | 질문 시작 제거. 진단 결과를 요약하고 “Board 만들기” 확인 |
| `/proof/pilot-design/questions` | 직접 URL 접근 시 “고급 설정”으로 표시. 필수 funnel에서 제외 |
| `/proof/pilot-design/draft` | 긴 초안 제거. 1페이지 설정 확인/수정만 |
| `/proof/board` | 핵심 화면. KPI, input, result cards, next action |
| `/proof/dashboard` | Evidence Dashboard. 숫자/차트/ProofScore |
| `/proof/report` | 10일 결과표. 대표/팀장 공유용 |
| `/proof/convert` | report/context 기반 전환 문의 |
| `/proof/ai-validation` | “Board에서 외부 AI 답변 검사 모드 사용” 안내 또는 redirect |

## 6. URL 파라미터 정책

| 파라미터 | 용도 | 보안 정책 |
|---|---|---|
| `project` | proof project id | UUID format validate |
| `token` | legacy raw access token | 즉시 session exchange 권장, log 저장 금지 |
| `mode` | board input mode | `paste`, `csv`, `external_ai_review` |
| `source` | CTA source | analytics-safe 값만 허용 |
| `report` | report id | report_view scope 필요 |

## 7. Legacy compatibility

기존 사용자가 가진 URL을 깨지 않기 위해 아래 정책을 쓴다.

- `/workspace` → `/proof/board`로 안내/redirect.
- `/proof/workspace` → `/proof/board` alias.
- `/proof/ai-validation` → board external AI mode 안내.
- `/proof/pilot-design/questions`는 404로 만들지 말고 optional advanced settings로 둔다.

## 8. Navigation

### Product top nav

```txt
Proof Board | 대시보드 | 10일 결과표 | 운영 전환
```

### Admin nav

```txt
운영 홈 | 신청 | 프로젝트 | 결과 카드 | 리포트 | 보안 감사 | 전환 문의 | AI 설정
```


## Codex 실행 프롬프트

```text
당신은 agentproofKR/agentproofKR.github.io 저장소만 작업한다. 다른 프로젝트 구조나 다른 저장소 개념을 섞지 않는다.
작업 전 이 문서와 docs/agentproof-super-mvp-v1/00_README_FOR_CODEX.md를 읽고, 관련 현재 파일을 직접 확인한다.
변경은 작은 단위로 수행하고, TypeScript strict, 개인정보/토큰 비노출, 한국어 UI, 320px 이상 가로 스크롤 금지를 유지한다.
작업 후 pnpm lint, pnpm typecheck, pnpm test, 관련 Playwright/E2E 또는 security test를 실행하고 실패를 수정한다.
```


---

<!-- 06_REQUIREMENTS_MATRIX.md -->

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


---

<!-- 07_FUNCTIONAL_SPEC.md -->

# 07. 기능명세서 PRD

## 1. 기능 개요

Super MVP는 다음 7개 기능군으로 구성한다.

1. 무료 진단 결과 기반 Proof Board 생성
2. Proof Board 실제 업무 입력
3. Result Card 생성과 사용 여부 수집
4. 위험표현/사람 확인 기준 감지
5. Proof Score와 Evidence Dashboard
6. 10일 결과표와 운영 전환 문의
7. Admin 검수/공개/보안 감사

## 2. 진단 결과 기반 Board 생성

### 사용자 시나리오

사용자가 무료 업무진단을 완료하면 결과 페이지에서 “10일 Proof Board 바로 만들기” 버튼을 누른다. 시스템은 추가 설문 없이 WorkProfile, WorkContract, ProofSession, ProofProject를 생성하거나 생성 준비 payload를 만든다.

### 입력

- survey result id
- persona/role
- selected work/risk summary
- optional company/contact consent
- source CTA

### 출력

- project id
- board access context
- default work profile
- proof period: 10 days
- case limit: 50
- participant limit: 3

### 예외

- 설문 결과가 sessionStorage에만 있고 server id가 없으면 local draft로 Board sample mode 진입 후 신청 시 저장한다.
- 필수 consent가 없으면 연락/신청만 제한하고, sample board는 볼 수 있게 한다.

## 3. Proof Board

### 주요 기능

- KPI strip
- 텍스트 붙여넣기
- CSV/XLSX 업로드
- 외부 AI 답변 검사 모드
- Result Card list
- 사용 여부 4버튼
- 오늘의 다음 액션

### KPI

| KPI | 계산 |
|---|---|
| 처리 | actual result cards / case limit |
| 사용률 | used_as_is + used_with_edits / processed |
| 절감 | sum conservativeSavedMinutes |
| 위험 | risk flags count or high risk card count |
| 사람 확인 | humanReviewRequired count |
| 신뢰도 | reportReliability |

## 4. Result Card

### 필드

- title
- risk level
- one line summary
- draft text
- missing info
- risk flags
- human review required
- copy allowed / blocked reason
- saved minutes
- feedback status

### 액션

1. 복사
2. 그대로 사용
3. 수정 후 사용
4. 안 씀

## 5. 위험표현 탐지

| 위험 | 예시 | 기본 처리 |
|---|---|---|
| 가격 확정 | 확정 단가, 최종 가격 | 사람 확인 필요 |
| 납기 확정 | 납기 보장, 반드시 가능 | 사람 확인 필요 또는 차단 |
| 계약/법률 | 법적으로 문제 없음 | 차단/검토 필요 |
| 환불/보상 | 전액 환불, 무조건 보상 | 사람 확인 필요 |
| 개인정보 | 전화, 이메일, 주민번호 등 | 마스킹/차단 |
| 자동 발송 | 바로 발송, 검토 없이 전송 | 차단 |

## 6. Dashboard

- Proof Score
- processed / target
- feedback breakdown
- time saved trend
- risk flags by category
- human gate count
- report readiness
- next action

## 7. Report

### 판정

- passed
- conditional_pass
- retest
- failed
- insufficient_data

### 구성

1. 판정 배지
2. Proof Score
3. 5개 숫자 요약
4. 운영 가능 범위
5. 제외 범위
6. 주의표현 TOP N
7. 사람 확인 기준
8. 전환 판단
9. 다음 액션

## 8. Admin

- 신청 검토
- 프로젝트 활성/중지/완료
- 결과 카드 검색
- 리포트 draft/review/published/recheck
- raw source access audit
- security event review
- conversion request 관리


## Codex 실행 프롬프트

```text
당신은 agentproofKR/agentproofKR.github.io 저장소만 작업한다. 다른 프로젝트 구조나 다른 저장소 개념을 섞지 않는다.
작업 전 이 문서와 docs/agentproof-super-mvp-v1/00_README_FOR_CODEX.md를 읽고, 관련 현재 파일을 직접 확인한다.
변경은 작은 단위로 수행하고, TypeScript strict, 개인정보/토큰 비노출, 한국어 UI, 320px 이상 가로 스크롤 금지를 유지한다.
작업 후 pnpm lint, pnpm typecheck, pnpm test, 관련 Playwright/E2E 또는 security test를 실행하고 실패를 수정한다.
```


---

<!-- 08_SCREEN_SPEC_PUBLIC_AND_SURVEY_RESULT.md -->

# 08. 화면설계서 — Public / Survey Result

## 1. Landing `/`

### 목적

방문자가 5초 안에 AgentProof를 “AI 업무 도입을 숫자로 증명하는 서비스”로 이해하게 한다.

### Hero 구조

```txt
[Badge] AI 업무 검증 플랫폼
[H1] AI에게 맡긴 업무, 안전하게 굴러가는지 숫자로 증명하세요.
[Sub] 10일 동안 실제 업무 50건을 검증해 처리량·절감시간·사용률·위험표현·사람 확인 기준을 보여드립니다.
[CTA Primary] 무료 업무 검증 시작
[CTA Secondary] 10일 Proof Test 보기
[Metric Cards] 128건 처리 / 17.5h 절감 / 위험 7건 발견 / 신뢰도 92%
```

### 섹션 순서

1. Hero
2. AI 도입 전 봐야 할 5개 숫자
3. Result Card 미리보기
4. 10일 Evidence Dashboard 미리보기
5. 업무 유형 6개
6. 10일 결과표 미리보기
7. 월 19만 원 운영 전환 근거
8. Final CTA

## 2. Survey Result `/survey/result`

### 목적

진단 결과를 상담 문의가 아니라 Proof Board 생성으로 전환한다.

### 화면 구조

```txt
상단 결과 카드
- AI 업무 적용도 64 / 100
- 위험도: 중간
- 추천 검증 업무: 고객 문의 답변
- 예상 Proof Test 목표: 10일 동안 실제 업무 20건 이상

위험 TOP 3
- 가격/납기 확정 표현 가능성
- 고객 전달 전 사람 확인 필요
- 개인정보 포함 가능성

CTA
[10일 Proof Board 바로 만들기]

보조 문구
진단은 끝났습니다. 이제 추가 설문 없이 실제 업무 1건을 넣어 검증을 시작합니다.
```

### 금지

- `10일 파일럿 설계받기`처럼 다시 설문을 떠올리게 하는 문구
- “상담 신청”만 강조하는 CTA
- 긴 리포트 본문

### State

| 상태 | UI |
|---|---|
| server survey id 있음 | 바로 Board 생성 |
| session summary만 있음 | local draft로 Board 생성 후 신청 시 저장 |
| consent 부족 | sample board 허용, live 저장/신청만 제한 |
| API 오류 | “임시 보드로 먼저 보기” 제공 |


## Codex 실행 프롬프트

```text
당신은 agentproofKR/agentproofKR.github.io 저장소만 작업한다. 다른 프로젝트 구조나 다른 저장소 개념을 섞지 않는다.
작업 전 이 문서와 docs/agentproof-super-mvp-v1/00_README_FOR_CODEX.md를 읽고, 관련 현재 파일을 직접 확인한다.
변경은 작은 단위로 수행하고, TypeScript strict, 개인정보/토큰 비노출, 한국어 UI, 320px 이상 가로 스크롤 금지를 유지한다.
작업 후 pnpm lint, pnpm typecheck, pnpm test, 관련 Playwright/E2E 또는 security test를 실행하고 실패를 수정한다.
```


---

<!-- 09_SCREEN_SPEC_PROOF_BOARD.md -->

# 09. 화면설계서 — Proof Board

## 1. 화면 목적

Proof Board는 AgentProof의 핵심 제품 화면이다. 사용자가 실제 업무 원문 또는 엑셀을 넣고, 즉시 결과 카드를 받고, 사용 여부를 1클릭으로 남긴다.

## 2. 레이아웃

```txt
┌─────────────────────────────────────────────┐
│ Proof Board · Day 3/10                       │
│ [Proof Score 72] [처리 18/50] [사용률 61%]   │
│ [절감 2.4h] [위험 3] [사람 확인 5] [신뢰도 보통] │
├──────────────┬──────────────────────────────┤
│ 입력 패널     │ 결과 카드 목록                 │
│ 붙여넣기      │ ResultCard                    │
│ CSV 업로드    │ ResultCard                    │
│ 외부AI 검사   │ ResultCard                    │
│ 샘플 실행     │                              │
├──────────────┴──────────────────────────────┤
│ 다음 액션: 오늘 5건 더 넣으면 결과표 신뢰도가 높아집니다. │
└─────────────────────────────────────────────┘
```

## 3. KPI Strip

| KPI | 예시 | 클릭 시 |
|---|---:|---|
| Proof Score | 72 | Dashboard |
| 처리 | 18/50 | Result list filter |
| 사용률 | 61% | feedback breakdown |
| 절감 | 2.4h | time saving tooltip |
| 위험 | 3건 | risk filter |
| 사람 확인 | 5건 | human gate filter |
| 신뢰도 | 보통 | report readiness |

## 4. 입력 패널

### Tabs

1. 붙여넣기
2. CSV/XLSX 업로드
3. 외부 AI 답변 검사
4. 샘플로 보기

### 붙여넣기 placeholder

```txt
거래처 문의, 견적 요청, 고객 답변 초안, 회의 메모를 그대로 붙여넣어 주세요.
AgentProof가 요약, 답변 초안, 누락정보, 주의표현을 나눠서 보여드립니다.
```

### 제출 버튼

```txt
결과 카드 만들기
```

## 5. ResultCard 구조

```txt
[위험 낮음/주의 필요/차단됨] 카드 제목
한 줄 요약

초안
...

누락정보
- ...

주의표현
- ...

사람 확인 필요
- ...

[복사] [그대로 사용] [수정 후 사용] [안 씀]
```

## 6. Empty State

```txt
아직 검증한 업무가 없습니다.
첫 업무 원문을 붙여넣으면 30초 안에 결과 카드가 만들어집니다.

[샘플로 먼저 보기] [업무 붙여넣기]
```

## 7. 모바일

- KPI는 horizontal scroll이 아니라 2열 grid로 wrap.
- 입력 패널이 먼저, 결과 카드가 아래.
- ResultCard 액션은 sticky bottom 또는 카드 하단 full-width.
- 320px 이상 가로 스크롤 금지.

## 8. Acceptance

- 첫 진입 1초 이내 주요 KPI skeleton 표시.
- Board empty state에서 샘플 실행 가능.
- ResultCard action button은 키보드 tab 순서로 접근 가능.
- 위험표현이 있으면 카드 상단에 반드시 chip 표시.
- “사용 여부” 클릭 후 board metrics 즉시 업데이트.


## Codex 실행 프롬프트

```text
당신은 agentproofKR/agentproofKR.github.io 저장소만 작업한다. 다른 프로젝트 구조나 다른 저장소 개념을 섞지 않는다.
작업 전 이 문서와 docs/agentproof-super-mvp-v1/00_README_FOR_CODEX.md를 읽고, 관련 현재 파일을 직접 확인한다.
변경은 작은 단위로 수행하고, TypeScript strict, 개인정보/토큰 비노출, 한국어 UI, 320px 이상 가로 스크롤 금지를 유지한다.
작업 후 pnpm lint, pnpm typecheck, pnpm test, 관련 Playwright/E2E 또는 security test를 실행하고 실패를 수정한다.
```


---

<!-- 10_SCREEN_SPEC_DASHBOARD_AND_REPORT.md -->

# 10. 화면설계서 — Evidence Dashboard / 10일 결과표

## 1. Evidence Dashboard `/proof/dashboard`

### 목적

팀장/대표가 10초 안에 “이 업무가 돈값을 하는가”를 판단하게 한다.

### 상단

```txt
Proof Score 78 / 100
판정: 조건부 운영 가능
Day 7/10 · 처리 42/50 · 리포트 신뢰도 높음
```

### 주요 카드

| 카드 | 표시 |
|---|---|
| 목표 달성률 | 42/50, progress bar |
| 사용률 | 그대로/수정후/복사만/미사용 stacked bar |
| 절감시간 | 11.2h, 보수 산정 badge |
| 위험표현 | 9건, 카테고리별 bar |
| 사람 확인 필요 | 13건, 해결/미해결 |
| 리포트 준비도 | 낮음/보통/높음 조건 |

### 하단

- 최근 결과 카드 5개
- 위험표현 TOP 5
- 다음 액션

## 2. 10일 결과표 `/proof/report`

### 목적

대표/팀장 공유용 의사결정 화면. PDF보다 먼저 화면 링크를 완성한다.

### 구조

```txt
[판정 배지] 조건부 운영 가능
[Proof Score] 78

5개 숫자
처리 42건 / 사용률 64% / 절감 11.2h / 위험 9건 / 사람 확인 13건

운영 가능 범위
- 문의 요약
- 답변 초안
- 누락정보 확인

제외 범위
- 최종 가격 확정
- 납기 보장
- 계약/법률 판단
- 환불/보상 확정
- 자동 발송

월 19만 원 전환 판단
- 조건부 추천
- 이유: 10일 동안 42건 처리, 사용률 64%, 위험표현 9건 차단

[운영 전환 문의]
```

## 3. 판정 로직 표시

| Verdict | UI |
|---|---|
| passed | 초록: 운영 가능 |
| conditional_pass | 파랑/앰버: 조건부 운영 가능 |
| retest | 앰버: 재검증 필요 |
| failed | 빨강: 현재 운영 비추천 |
| insufficient_data | 회색: 데이터 부족 |

## 4. 신뢰도 badge

| 조건 | 신뢰도 |
|---|---|
| 처리 < 5 | 낮음 |
| 처리 5~19 또는 피드백 부족 | 보통 |
| 처리 >= 20, 피드백 >= 50%, 위험 집계 있음 | 높음 |

## 5. Acceptance

- Report는 긴 문단보다 숫자 카드가 먼저 나온다.
- 운영 가능 범위와 제외 범위가 항상 같이 표시된다.
- 전환 CTA는 report context를 conversion request에 포함한다.
- report_view token이 없거나 unpublished면 공개 report를 볼 수 없다.


## Codex 실행 프롬프트

```text
당신은 agentproofKR/agentproofKR.github.io 저장소만 작업한다. 다른 프로젝트 구조나 다른 저장소 개념을 섞지 않는다.
작업 전 이 문서와 docs/agentproof-super-mvp-v1/00_README_FOR_CODEX.md를 읽고, 관련 현재 파일을 직접 확인한다.
변경은 작은 단위로 수행하고, TypeScript strict, 개인정보/토큰 비노출, 한국어 UI, 320px 이상 가로 스크롤 금지를 유지한다.
작업 후 pnpm lint, pnpm typecheck, pnpm test, 관련 Playwright/E2E 또는 security test를 실행하고 실패를 수정한다.
```


---

<!-- 11_ADMIN_SCREEN_SPEC.md -->

# 11. 화면설계서 — Admin

## 1. Admin 목표

운영자는 수동 운영을 통해 P0 파일럿을 안전하게 검수하고 전환시킨다.

## 2. `/admin/dashboard`

### KPI

- 신규 신청
- 활성 Proof Project
- 리포트 검수 대기
- 보안 이벤트
- 전환 문의
- Provider 실패율

## 3. `/admin/pilot-applications`

| 기능 | 요구사항 |
|---|---|
| 신청 목록 | submitted/reviewing/approved/conditionally/rejected |
| 신청 상세 | 회사명, 담당자, 업무 유형, 위험 domain, paid intent |
| 승인 | approved/conditionally/rejected + reason 필수 |
| 프로젝트 생성 | 승인 후 proof_project/work_profile/project_member 생성 |

## 4. `/admin/projects`

- project status 관리
- participant/case limit 확인
- board_access/report_view token 상태 확인
- token revoke/expire P1 UI placeholder
- 최근 처리건수, risk count, feedback rate

## 5. `/admin/result-cards`

- result cards 검색/필터
- blocked/high risk 카드 확인
- sample/real 구분
- raw source 접근은 audit reason 필수

## 6. `/admin/reports`

- draft 생성
- review 상태
- published 공개
- recheck_needed 표시
- report reliability 확인
- 전환 CTA context 확인

## 7. `/admin/audit-security`

- raw source access audit
- PII redaction events
- prompt injection/security blocks
- token scope mismatch
- provider failures

## 8. `/admin/conversions`

- report 기반 전환 문의
- plan: `single_work_190000`
- recommended start date
- decision maker memo
- status: new/contacted/won/lost

## 9. Acceptance

- Admin 작업은 사용자 board token으로 불가능하다.
- Raw source 접근은 reason 없이 불가능하다.
- Report publish 전 공개 report_view가 열리지 않는다.
- 모든 admin mutation은 audit event를 남긴다.


## Codex 실행 프롬프트

```text
당신은 agentproofKR/agentproofKR.github.io 저장소만 작업한다. 다른 프로젝트 구조나 다른 저장소 개념을 섞지 않는다.
작업 전 이 문서와 docs/agentproof-super-mvp-v1/00_README_FOR_CODEX.md를 읽고, 관련 현재 파일을 직접 확인한다.
변경은 작은 단위로 수행하고, TypeScript strict, 개인정보/토큰 비노출, 한국어 UI, 320px 이상 가로 스크롤 금지를 유지한다.
작업 후 pnpm lint, pnpm typecheck, pnpm test, 관련 Playwright/E2E 또는 security test를 실행하고 실패를 수정한다.
```


---

<!-- 12_BRAND_DESIGN_SYSTEM.md -->

# 12. 브랜딩/디자인 시스템

## 1. 브랜드 핵심

AgentProof는 “AI를 잘 만든다”가 아니라 “AI 업무가 안전하게 돌아가는지 증명한다”는 브랜드다.

### 키워드

- Proof: 근거, 기록, 숫자, 검증
- Work: 실제 업무, 반복 업무, 실무 언어
- Safe: 사람 확인, 마스킹, 차단
- Simple: 질문 줄이기, 클릭 줄이기
- Decision: 대표/팀장의 판단

## 2. 브랜드 카피

```txt
AI 도입 여부를 감으로 정하지 마세요.
10일 동안 실제 업무로 증명하세요.
```

```txt
붙여넣으면 결과 카드가 나오고,
10일이 지나면 운영 판단표가 남습니다.
```

## 3. Tone & Manner

| 지양 | 지향 |
|---|---|
| AI 혁신, 자동화, 무한 가능성 | 실제 업무, 10일, 50건, 숫자 |
| 위험합니다 | 사람 확인이 필요합니다 |
| 실패했습니다 | 재검증이 필요합니다 |
| 케이스 | 업무 |
| 피드백 | 사용 여부 |
| 워크스페이스 | 파일럿 보드 |

## 4. 컬러 토큰

```css
:root {
  --ap-ink: #101828;
  --ap-navy: #071b3d;
  --ap-blue: #0b5cff;
  --ap-blue-soft: #e8f1ff;
  --ap-mint: #11d5c2;
  --ap-green: #18b26b;
  --ap-green-soft: #eaf8f0;
  --ap-amber: #ff9f1c;
  --ap-amber-soft: #fff4df;
  --ap-red: #f04438;
  --ap-red-soft: #fff0ef;
  --ap-cream: #f7f4ed;
  --ap-surface: #ffffff;
  --ap-line: #e6e9ef;
  --ap-muted: #667085;
}
```

## 5. Typography

- H1: 48~64px desktop, 34~40px mobile
- H2: 32~40px
- Metric number: 36~56px
- Card title: 18~22px
- Body: 15~17px
- Caption: 12~13px

## 6. Layout

- 최대 폭: landing 1180px, app 1280px
- 카드 radius: 20~28px
- 버튼 height: 44~56px
- Shadow: 매우 약하게
- Background: cream/white, dashboard는 light blue tint 가능

## 7. Motion

- 숫자 카드는 0.2~0.4초 fade/slide
- 과한 3D/blur 금지
- skeleton은 부드럽게
- CTA hover는 scale보다 background/outline 변화

## 8. Visual rule

모든 핵심 화면 상단에는 항상 숫자가 있다.

```txt
[Proof Score] [처리] [사용률] [절감] [위험] [신뢰도]
```


## Codex 실행 프롬프트

```text
당신은 agentproofKR/agentproofKR.github.io 저장소만 작업한다. 다른 프로젝트 구조나 다른 저장소 개념을 섞지 않는다.
작업 전 이 문서와 docs/agentproof-super-mvp-v1/00_README_FOR_CODEX.md를 읽고, 관련 현재 파일을 직접 확인한다.
변경은 작은 단위로 수행하고, TypeScript strict, 개인정보/토큰 비노출, 한국어 UI, 320px 이상 가로 스크롤 금지를 유지한다.
작업 후 pnpm lint, pnpm typecheck, pnpm test, 관련 Playwright/E2E 또는 security test를 실행하고 실패를 수정한다.
```


---

<!-- 13_UI_COMPONENT_SYSTEM.md -->

# 13. UI 컴포넌트 명세서

## 1. 공통 컴포넌트 목록

| Component | 용도 |
|---|---|
| `MetricStrip` | 상단 KPI 가로/반응형 카드 |
| `MetricCard` | 단일 숫자 카드 |
| `ProofScoreRing` | 0~100 점수 게이지 |
| `ResultCard` | AI 결과 카드 |
| `RiskChip` | 위험수준/주의표현 표시 |
| `HumanGateList` | 사람 확인 필요 항목 |
| `UsageFeedbackButtons` | 4개 사용 여부 버튼 |
| `EvidenceTimeline` | 10일 진행/이벤트 |
| `ReportVerdictCard` | 결과표 판정 |
| `ReliabilityBadge` | 리포트 신뢰도 |
| `CsvUploadPanel` | CSV/XLSX 업로드 |
| `EmptyProofBoardState` | 첫 진입 상태 |
| `AdminStatusPill` | admin 상태 표시 |

## 2. MetricStrip

### Props

```ts
type MetricStripProps = {
  proofScore?: number;
  processed: number;
  caseLimit: number;
  usageRate: number;
  savedMinutes: number;
  riskCount: number;
  humanReviewCount: number;
  reliability: '낮음' | '보통' | '높음';
};
```

### 표시 규칙

- processed: `18/50`
- usageRate: `61%`
- savedMinutes: 60분 이상이면 `2.4h`, 미만이면 `42m`
- riskCount: 0이면 green, 1~4 amber, 5+ red

## 3. ResultCard

### Props

```ts
type ResultCardProps = {
  card: ResultCard;
  onCopy(id: string): void;
  onFeedback(id: string, status: FeedbackStatus): void;
};
```

### UX

- 위험 chip은 card top-left.
- title은 1줄, summary는 최대 2줄.
- draft는 collapsible 가능하지만 기본 3~5줄 노출.
- action buttons는 항상 카드 하단 고정.

## 4. UsageFeedbackButtons

버튼 순서:

```txt
[그대로 사용] [수정 후 사용] [복사만 함] [안 씀]
```

내부 값:

- `used_as_is`
- `used_with_edits`
- `copied_only`
- `not_used`

## 5. RiskChip

| riskLevel | label | color |
|---|---|---|
| low | 위험 낮음 | green |
| medium | 주의 필요 | amber |
| high | 사람 확인 필요 | red/amber |
| blocked | 차단됨 | red |

## 6. Accessibility

- 모든 button은 `button` element.
- icon-only button은 `aria-label` 필수.
- chip 색상만으로 상태 전달 금지.
- keyboard focus visible 유지.


## Codex 실행 프롬프트

```text
당신은 agentproofKR/agentproofKR.github.io 저장소만 작업한다. 다른 프로젝트 구조나 다른 저장소 개념을 섞지 않는다.
작업 전 이 문서와 docs/agentproof-super-mvp-v1/00_README_FOR_CODEX.md를 읽고, 관련 현재 파일을 직접 확인한다.
변경은 작은 단위로 수행하고, TypeScript strict, 개인정보/토큰 비노출, 한국어 UI, 320px 이상 가로 스크롤 금지를 유지한다.
작업 후 pnpm lint, pnpm typecheck, pnpm test, 관련 Playwright/E2E 또는 security test를 실행하고 실패를 수정한다.
```


---

<!-- 14_DATA_MODEL_SUPABASE.md -->

# 14. 데이터 모델 / Supabase 설계서

## 1. Source of truth

Super MVP에서 실제 운영 데이터의 source of truth는 Supabase Postgres다. localStorage는 demo/cache/fallback 용도로만 사용한다.

## 2. 현재 핵심 테이블

| 테이블 | 역할 |
|---|---|
| `organizations` | 고객 회사 |
| `users` | 참여자/관리자 |
| `pilot_design_sessions` | legacy 파일럿 설계 세션 |
| `work_profiles` | 고객 업무 정의 |
| `proof_applications` | 파일럿 신청 |
| `proof_projects` | Proof Board 운영 단위 |
| `project_members` | 접근 token hash/role |
| `input_intakes` | 입력 원문 수신/마스킹 |
| `file_uploads` | CSV/XLSX 업로드 증거 |
| `file_import_rows` | 업로드 row |
| `proof_cases` | 결과 카드 생성 대상 업무 |
| `proof_ai_outputs` | AI 출력 구조 |
| `proof_feedbacks` | 사용 여부 |
| `proof_reports` | 10일 결과표 |
| `conversion_requests` | 운영 전환 문의 |
| `work_contracts` | 허용/금지/사람 확인 기준 |
| `proof_sessions` | 10일 proof 기간 |
| `proof_events` | 실제 proof event |
| `risk_reviews` | 위험 분석 |
| `human_edit_burdens` | 수정 부담 |
| `time_saving_estimates` | 절감시간 |
| `proof_scores` | 점수 |
| `proof_verdicts` | 판정 |
| `evidence_ledgers` | 최종 증거 원장 |

## 3. 추가 테이블

CSV/XLSX 비동기 처리를 위해 추가한다.

```sql
create table if not exists public.proof_jobs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.proof_projects(id) on delete cascade,
  job_type text not null check (job_type in ('csv_import','bulk_recheck','report_build')),
  status text not null default 'queued' check (status in ('queued','running','completed','failed','cancelled')),
  total_items integer not null default 0,
  processed_items integer not null default 0,
  failed_items integer not null default 0,
  error_code text,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz
);

create table if not exists public.proof_job_items (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.proof_jobs(id) on delete cascade,
  row_number integer not null,
  status text not null default 'queued' check (status in ('queued','running','completed','failed','blocked')),
  input_hash text,
  case_id uuid references public.proof_cases(id) on delete set null,
  error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (job_id, row_number)
);
```

## 4. Summary read model

Board/Dashboard/Report hydration을 위해 Edge에서 다음 shape를 반환한다.

```ts
type ProofProjectSummary = {
  project: { id: string; status: string; startDate: string; endDate: string; caseLimit: number };
  workProfile: { id: string; workName: string; workType: string; workTypeLabel: string };
  metrics: BoardMetrics;
  proofScore?: ProofScore;
  verdict?: Verdict;
  recentResultCards: ResultCard[];
  riskBreakdown: Array<{ category: string; count: number; severeCount: number }>;
  humanGateSummary: { requiredCount: number; satisfiedCount: number; missingCount: number };
  report?: { id: string; status: string; reliability: string; publishedAt?: string };
};
```

## 5. 필수 인덱스

```sql
create index if not exists proof_projects_org_status_idx on public.proof_projects(organization_id, status);
create index if not exists proof_cases_project_created_idx on public.proof_cases(project_id, created_at desc);
create index if not exists proof_feedbacks_project_status_idx on public.proof_feedbacks(project_id, feedback_status);
create index if not exists proof_reports_project_status_idx on public.proof_reports(project_id, status);
create index if not exists proof_jobs_project_status_idx on public.proof_jobs(project_id, status, created_at desc);
create index if not exists proof_job_items_job_status_idx on public.proof_job_items(job_id, status, row_number);
create index if not exists proof_events_session_created_idx on public.proof_events(session_id, created_at desc);
create index if not exists risk_reviews_event_idx on public.risk_reviews(event_id);
```

## 6. Data retention

- raw file: 기본 delete_after_parse.
- raw text: encrypted 또는 redacted, analytics/log 금지.
- hash/excerpt/sanitized summary만 report에 사용.
- raw source admin access는 reason/audit 필수.


## Codex 실행 프롬프트

```text
당신은 agentproofKR/agentproofKR.github.io 저장소만 작업한다. 다른 프로젝트 구조나 다른 저장소 개념을 섞지 않는다.
작업 전 이 문서와 docs/agentproof-super-mvp-v1/00_README_FOR_CODEX.md를 읽고, 관련 현재 파일을 직접 확인한다.
변경은 작은 단위로 수행하고, TypeScript strict, 개인정보/토큰 비노출, 한국어 UI, 320px 이상 가로 스크롤 금지를 유지한다.
작업 후 pnpm lint, pnpm typecheck, pnpm test, 관련 Playwright/E2E 또는 security test를 실행하고 실패를 수정한다.
```


---

<!-- 15_API_EDGE_FUNCTION_CONTRACTS.md -->

# 15. API / Supabase Edge Function 계약서

## 1. 원칙

현재 GitHub Pages에는 server route가 없으므로 운영 write/read는 Supabase Edge Function을 통해 처리한다. `NEXT_PUBLIC_SURVEY_API_URL` 또는 proof endpoint 환경변수에 설정된 Edge Function만 운영 경로다.

## 2. 현재 proof-submit kind 확장 정책

현재 `proof-submit`은 여러 `kind` payload를 처리한다. Super MVP에서는 다음 kind를 확정한다.

| kind | 용도 |
|---|---|
| `proof_pilot_design_session` | legacy design session 생성 |
| `proof_pilot_design_answers` | optional advanced settings 저장 |
| `proof_pilot_design_draft` | workProfile draft 저장 |
| `proof_application` | 파일럿 신청 |
| `admin_application_decision` | 관리자 승인/거절 |
| `proof_text_intake` | 단건 업무 입력 |
| `proof_csv_intake` | CSV/XLSX 업로드 접수 |
| `proof_quick_feedback` | 1클릭 사용 여부 |
| `admin_report_review` | report review/publish |
| `proof_conversion_request` | 운영 전환 문의 |
| `proof_data_request` | 개인정보 권리 요청 |
| `admin_raw_source_audit` | 원문 접근 감사 |

## 3. 추가할 read/action kind

| kind | 용도 |
|---|---|
| `proof_create_board_from_survey` | survey result 기반 board 생성 |
| `proof_project_summary` | Board/Dashboard summary read |
| `proof_report_view` | report_view scope로 report read |
| `proof_job_status` | CSV job status read |
| `proof_token_exchange` | raw token → short session context |

## 4. `proof_create_board_from_survey`

```ts
type ProofCreateBoardFromSurveyPayload = {
  kind: 'proof_create_board_from_survey';
  surveyResultId?: string;
  importedContext?: {
    persona?: string;
    recommendedWorkType?: string;
    riskDomains?: string[];
    score?: number;
  };
  companyName?: string;
  contactName?: string;
  email?: string;
  idempotencyKey: string;
};
```

### Response

```ts
type ProofCreateBoardFromSurveyResponse = {
  ok: true;
  projectId: string;
  boardAccessToken?: string; // raw token only once
  workProfileId: string;
  proofSessionId?: string;
  boardUrl: string;
};
```

## 5. `proof_project_summary`

```ts
type ProofProjectSummaryPayload = {
  kind: 'proof_project_summary';
  projectId: string;
  projectAccessToken: string;
};
```

Response는 `ProofProjectSummary`를 반환한다.

## 6. Error shape

```ts
type ProofErrorResponse = {
  ok: false;
  errorCode: string;
  errorMessage: string;
  traceId: string;
  retryable?: boolean;
};
```

## 7. 보안 계약

- raw token은 저장하지 않는다.
- email/phone은 encrypted 저장.
- analytics payload에 email/company/raw text 금지.
- CORS allowed origins만 허용.
- idempotencyKey 필수.
- projectId/token scope/status/expiry 검증.
- report view는 `report_view` scope + report published 필요.


## Codex 실행 프롬프트

```text
당신은 agentproofKR/agentproofKR.github.io 저장소만 작업한다. 다른 프로젝트 구조나 다른 저장소 개념을 섞지 않는다.
작업 전 이 문서와 docs/agentproof-super-mvp-v1/00_README_FOR_CODEX.md를 읽고, 관련 현재 파일을 직접 확인한다.
변경은 작은 단위로 수행하고, TypeScript strict, 개인정보/토큰 비노출, 한국어 UI, 320px 이상 가로 스크롤 금지를 유지한다.
작업 후 pnpm lint, pnpm typecheck, pnpm test, 관련 Playwright/E2E 또는 security test를 실행하고 실패를 수정한다.
```


---

<!-- 16_STATE_MACHINE_AND_SCORING.md -->

# 16. 상태머신 / 점수 / 판정 로직 설계서

## 1. Proof Project 상태

```txt
ready → active → report_draft → report_review → report_published → converted/closed
                    ↓
               recheck_needed
```

## 2. Proof Session 상태

```txt
test_ready → active → completed
   ↓           ↓
cancelled   cancelled
```

## 3. Proof State

```txt
diagnosed
→ test_ready
→ active_proof
→ low_adoption_risk / risk_restricted / template_revision_needed / conversion_ready
→ passed / conditional_pass / retest / failed
```

## 4. Proof Score 공식

현재 `proofCore.calculateProofScore`의 축을 유지한다.

| 축 | 점수 | 설명 |
|---|---:|---|
| adoptionScore | 20 | 사용건수/처리건수 목표 달성 |
| efficiencyScore | 25 | 절감시간 비율과 일관성 |
| qualityScore | 20 | draft usage rate와 human edit burden |
| contractConformanceScore | 20 | 금지행위/사람확인 기준 준수 |
| riskControlScore | 15 | severe/medium risk와 human review rate |
| expansionScore | 0 | P1 이후 |
| 합계 | 100 | finalProofScore |

## 5. BoardMetrics 계산

| 지표 | 공식 |
|---|---|
| processedCount | resultCards.length |
| actualCaseCount | non-sample cards |
| utilizationRate | actualCaseCount / caseLimit |
| copyRate | copied + used statuses / processed |
| draftUsageRate | used_as_is + used_with_edits / processed |
| usedWithEditsRate | used_with_edits / processed |
| notUsedRate | not_used / processed |
| estimatedSavedMinutes | sum conservativeSavedMinutes |
| riskFlagCount | sum riskFlags.length |
| humanReviewCount | sum humanReviewRequired.length |
| reportReliability | 처리건수 + feedback rate 기반 |

## 6. Verdict

| 조건 | Verdict | UI |
|---|---|---|
| usage < 5 | failed 또는 insufficient_data | 데이터 부족/운영 비추천 |
| severe hard block 있음 + score >= 60 | conditional_pass | 조건부 운영 가능 |
| score >= 80, hard block 없음 | passed | 운영 가능 |
| score >= 60 | conditional_pass | 조건부 운영 가능 |
| score >= 40 | retest | 재검증 필요 |
| else | failed | 운영 비추천 |

## 7. Hard block

- 가격 확정 + 사람 확인 없음
- 납기 확정 + 사람 확인 없음
- 계약/법률 판단
- 외부 AI 모드에서 개인정보 위험
- 자동 발송 표현
- 10일 완료 후 사용건수 5건 미만

## 8. Report reliability

| 신뢰도 | 조건 |
|---|---|
| 낮음 | actualCaseCount < 5 |
| 보통 | actualCaseCount 5~19 또는 feedback rate < 50% |
| 높음 | actualCaseCount >= 20, feedback rate >= 50%, risk/human gate 집계 가능 |


## Codex 실행 프롬프트

```text
당신은 agentproofKR/agentproofKR.github.io 저장소만 작업한다. 다른 프로젝트 구조나 다른 저장소 개념을 섞지 않는다.
작업 전 이 문서와 docs/agentproof-super-mvp-v1/00_README_FOR_CODEX.md를 읽고, 관련 현재 파일을 직접 확인한다.
변경은 작은 단위로 수행하고, TypeScript strict, 개인정보/토큰 비노출, 한국어 UI, 320px 이상 가로 스크롤 금지를 유지한다.
작업 후 pnpm lint, pnpm typecheck, pnpm test, 관련 Playwright/E2E 또는 security test를 실행하고 실패를 수정한다.
```


---

<!-- 17_RESULT_CARD_AND_RISK_ENGINE.md -->

# 17. Result Card / Risk Engine 설계서

## 1. Result Card의 역할

Result Card는 AgentProof의 최소 가치 단위다. 사용자는 결과 카드 하나에서 “이 업무를 AI로 처리해도 되는지”를 즉시 판단한다.

## 2. Result Card 정보 구조

```txt
상태 chip + 제목
한 줄 요약
초안
누락정보
주의표현
사람 확인 필요
절감시간
사용 여부 버튼
```

## 3. Risk flag 분류

| type | label | severity |
|---|---|---|
| `price_commitment` | 가격 확정 표현 | high |
| `delivery_commitment` | 납기 확정 표현 | high |
| `contract_commitment` | 계약/법률 판단 | critical |
| `refund_or_compensation` | 환불/보상 확정 | high |
| `privacy` | 개인정보/민감정보 | critical |
| `auto_send` | 자동 발송 | critical |
| `customer_trust` | 고객 신뢰 위험 | medium |
| `missing_info` | 누락정보 | low/medium |

## 4. 추천 수정 문구

| 위험 | 추천 |
|---|---|
| 가격 확정 | “담당자 확인 후 안내드리겠습니다.” |
| 납기 확정 | “가능 일정은 물류/생산 확인 후 안내드리겠습니다.” |
| 계약 판단 | “계약 관련 사항은 담당자 검토 후 안내드리겠습니다.” |
| 환불/보상 | “내부 기준 확인 후 처리 가능 여부를 안내드리겠습니다.” |
| 개인정보 | “개인정보는 입력하지 말고 담당 부서에 문의해 주세요.” |
| 자동 발송 | “최종 발송 전 담당자 확인이 필요합니다.” |

## 5. Copy allowed 정책

- low/medium: copy allowed, warning 표시.
- high: copy allowed but human review required 강조.
- blocked/critical privacy/auto_send: copy disabled 또는 masked draft만 copy.

## 6. 사용 여부 버튼

| UI | 내부 값 | 지표 반영 |
|---|---|---|
| 그대로 사용 | `used_as_is` | draftUsageRate + saved minutes |
| 수정 후 사용 | `used_with_edits` | draftUsageRate + edit burden |
| 복사만 함 | `copied_only` | copyRate만 |
| 안 씀 | `not_used` | notUsedRate |

## 7. Acceptance

- 위험표현이 있는 카드는 위험 chip이 반드시 표시된다.
- 사람이 확인해야 할 항목은 초안보다 아래에 숨기지 않는다.
- blocked 카드는 copy 버튼이 disabled 또는 safe draft only다.
- feedback 클릭은 중복 클릭해도 idempotent하게 처리한다.


## Codex 실행 프롬프트

```text
당신은 agentproofKR/agentproofKR.github.io 저장소만 작업한다. 다른 프로젝트 구조나 다른 저장소 개념을 섞지 않는다.
작업 전 이 문서와 docs/agentproof-super-mvp-v1/00_README_FOR_CODEX.md를 읽고, 관련 현재 파일을 직접 확인한다.
변경은 작은 단위로 수행하고, TypeScript strict, 개인정보/토큰 비노출, 한국어 UI, 320px 이상 가로 스크롤 금지를 유지한다.
작업 후 pnpm lint, pnpm typecheck, pnpm test, 관련 Playwright/E2E 또는 security test를 실행하고 실패를 수정한다.
```


---

<!-- 18_SECURITY_PRIVACY_ACCESS_CONTROL.md -->

# 18. 보안 / 개인정보 / 접근제어 설계서

## 1. 기본 원칙

- 원문은 가능한 저장하지 않는다.
- 저장해야 하면 암호화하고 retention을 제한한다.
- analytics/log/bundle에 email/company/raw text/token/secret을 보내지 않는다.
- raw token은 생성 직후 한 번만 보여주고 DB에는 hash만 저장한다.
- report는 `report_view` scope와 published 상태가 모두 필요하다.

## 2. 접근 token scope

| scope | 가능 |
|---|---|
| `board_access` | `/proof/board`, text/csv intake, feedback |
| `report_view` | published `/proof/report` read only |
| admin token | admin mutations |

## 3. Access failure states

- missing_token
- invalid_token
- revoked_token
- expired_token
- scope_mismatch
- cross_project
- project_not_active
- report_not_published

## 4. Raw source access

Admin이 원문/민감 source를 보려면 반드시 reason이 필요하다.

Audit fields:

- admin id
- reason
- related resource type/id
- rawTextStored false 여부
- fingerprint/hash
- timestamp

## 5. PII 탐지

- 전화번호
- 이메일
- 주소
- 카드번호
- 주민등록번호
- 사업자번호
- 계좌번호 패턴은 P1 추가 가능

## 6. Retention

| 데이터 | 정책 |
|---|---|
| CSV 원본 파일 | 기본 delete_after_parse |
| raw text | encrypted or redacted, report에는 excerpt/masked |
| result card | sanitized output 저장 |
| feedback | 저장 |
| audit log | 저장 |
| access token raw | 저장 금지 |
| token hash | 저장 |

## 7. Security acceptance

- `pnpm test:security` 통과.
- bundle에 secret/key/token 없음.
- analytics payload allowlist test 통과.
- logs/error message에 raw text/token 없음.
- project/report scope mismatch test 통과.


## Codex 실행 프롬프트

```text
당신은 agentproofKR/agentproofKR.github.io 저장소만 작업한다. 다른 프로젝트 구조나 다른 저장소 개념을 섞지 않는다.
작업 전 이 문서와 docs/agentproof-super-mvp-v1/00_README_FOR_CODEX.md를 읽고, 관련 현재 파일을 직접 확인한다.
변경은 작은 단위로 수행하고, TypeScript strict, 개인정보/토큰 비노출, 한국어 UI, 320px 이상 가로 스크롤 금지를 유지한다.
작업 후 pnpm lint, pnpm typecheck, pnpm test, 관련 Playwright/E2E 또는 security test를 실행하고 실패를 수정한다.
```


---

<!-- 19_SCALABILITY_1000_USERS.md -->

# 19. 1000명 사용 가능 설계서

## 1. 운영 목표

| 항목 | 목표 |
|---|---:|
| 방문/가입 사용자 | 1000명 |
| 동시 활성 사용자 | 50명 |
| 활성 Proof Project | 300개 |
| Project당 참여자 | 3명 |
| Project당 기본 입력 | 50건 |
| 총 Proof Case | 15,000~50,000건 |
| 단건 응답 | P95 10초 이하 |
| CSV 50행 처리 | 3분 이하 |

## 2. 병목 예상

| 병목 | 해결 |
|---|---|
| Edge Function 동기 CSV 처리 | proof_jobs 비동기 처리 |
| dashboard/report 매번 client 계산 | summary endpoint/read model |
| localStorage state drift | Supabase-first |
| token URL 장기 노출 | exchange/expiry/scope |
| LLM provider latency/failure | provider fallback/routing |
| Postgres slow query | indexes |

## 3. Rate limit

| 대상 | 제한 |
|---|---:|
| IP | 60 req/min |
| Project text intake | 30/min |
| Project CSV upload | 5/day |
| Free proof case | 50 |
| Paid single workflow | 500/month |
| File | 5MB |
| CSV row | 50 P0, 500 paid P1 |

## 4. Scaling sequence

### Step 1

- Supabase-first summary read.
- Indexes 추가.
- CSV job table 추가.

### Step 2

- Background job processing.
- Job status polling.
- Provider timeout/fallback.

### Step 3

- Paid tier case limit 확장.
- materialized summary table or scheduled refresh.
- alerting dashboard.

## 5. Failure policy

- Provider 실패 시 fallback provider.
- 모든 provider 실패 시 deterministic result card로 최소 결과 제공.
- CSV job item 실패는 전체 job 실패로 만들지 않는다.
- user-facing error는 재시도 가능/불가능을 분리한다.


## Codex 실행 프롬프트

```text
당신은 agentproofKR/agentproofKR.github.io 저장소만 작업한다. 다른 프로젝트 구조나 다른 저장소 개념을 섞지 않는다.
작업 전 이 문서와 docs/agentproof-super-mvp-v1/00_README_FOR_CODEX.md를 읽고, 관련 현재 파일을 직접 확인한다.
변경은 작은 단위로 수행하고, TypeScript strict, 개인정보/토큰 비노출, 한국어 UI, 320px 이상 가로 스크롤 금지를 유지한다.
작업 후 pnpm lint, pnpm typecheck, pnpm test, 관련 Playwright/E2E 또는 security test를 실행하고 실패를 수정한다.
```


---

<!-- 20_ANALYTICS_EVENTS_AND_METRICS.md -->

# 20. Analytics / Events / Funnel 설계서

## 1. 원칙

- analytics에는 비식별 이벤트만 보낸다.
- email, companyName, raw text, token, memo 금지.
- 이벤트는 제품 개선과 전환 퍼널 분석에만 사용한다.

## 2. 핵심 이벤트

| event | source | metadata |
|---|---|---|
| `survey_result_board_cta_clicked` | survey result | persona, scoreBucket, recommendedWorkType |
| `proof_board_created_from_survey` | result/start | projectId hash/ref, workType |
| `proof_board_viewed` | board | dayNumber, projectStatus |
| `proof_first_input_submitted` | board | inputType, workType |
| `proof_result_card_created` | board | riskLevel, source, latencyBucket |
| `proof_feedback_clicked` | board | feedbackStatus, riskLevel |
| `proof_dashboard_viewed` | dashboard | processedBucket, proofScoreBucket |
| `proof_report_viewed` | report | status, verdict |
| `proof_conversion_requested` | report/convert | verdict, recommendedPlan |
| `proof_security_block_shown` | board | riskType, severity |

## 3. Funnel metrics

| Metric | Formula |
|---|---|
| Board creation rate | board created / survey completed |
| First card rate | first result card / board created |
| Feedback rate | feedback clicked / result cards |
| 10-day completion | report draft/published / board created |
| Conversion request rate | conversion request / report viewed |

## 4. Product KPIs

- first result card time
- processed count
- draft usage rate
- saved minutes
- risk signal count
- human review count
- report reliability
- proof score distribution

## 5. 금지 metadata

```txt
email
phone
companyName
contactName
rawText
aiOutput
finalUsedOutput
projectAccessToken
adminToken
secret
memo
```


## Codex 실행 프롬프트

```text
당신은 agentproofKR/agentproofKR.github.io 저장소만 작업한다. 다른 프로젝트 구조나 다른 저장소 개념을 섞지 않는다.
작업 전 이 문서와 docs/agentproof-super-mvp-v1/00_README_FOR_CODEX.md를 읽고, 관련 현재 파일을 직접 확인한다.
변경은 작은 단위로 수행하고, TypeScript strict, 개인정보/토큰 비노출, 한국어 UI, 320px 이상 가로 스크롤 금지를 유지한다.
작업 후 pnpm lint, pnpm typecheck, pnpm test, 관련 Playwright/E2E 또는 security test를 실행하고 실패를 수정한다.
```


---

<!-- 21_LLM_GATEWAY_AND_EVAL.md -->

# 21. LLM Gateway / Eval 설계서

## 1. 현재 방향

현재 provider는 OpenAI, Google/Gemini, Anthropic/Claude를 기준으로 하고 routing preset은 fast_parse, general_draft, risk_review, report_generation으로 나뉜다.

## 2. P0 정책

- Provider 무제한 등록 금지.
- Admin 설정은 운영자만 접근.
- 사용자에게 provider 세부 모델을 노출하지 않는다.
- 실패 시 fallback provider 사용.
- 모든 AI 결과는 deterministic risk review를 한 번 더 통과한다.

## 3. Routing preset

| preset | 용도 | 요구 |
|---|---|---|
| fast_parse | 입력 요약/구조화 | 빠른 응답 |
| general_draft | 답변 초안 | 안정적 한국어 |
| risk_review | 위험표현 검토 | 보수적 판정 |
| report_generation | 결과표 문구 | 숫자 기반 요약 |

## 4. Output schema

```ts
type ProofAiOutput = {
  summary_text: string;
  draft_text: string;
  missing_info: string[];
  risk_flags: RiskFlag[];
  human_review_required: string[];
  safety_status: 'passed' | 'masked' | 'blocked';
  output_schema_version: string;
};
```

## 5. Eval 기준

| 기준 | 설명 |
|---|---|
| schema compliance | 필수 필드 누락 없음 |
| risk recall | 금지 표현 감지 |
| safe wording | 확정 표현 대신 확인 문구 |
| Korean tone | 실무형 존댓말 |
| no auto-send | 자동 발송 제안 금지 |
| pii handling | 개인정보 마스킹/차단 |

## 6. Fallback

- LLM 실패 시 deterministic `createResultCardFromText`로 최소 카드 생성.
- `source`는 `deterministic` 또는 `llm`으로 명시.
- 사용자는 “AI 제공자 오류”보다 “기본 규칙으로 먼저 검사했습니다”를 본다.


## Codex 실행 프롬프트

```text
당신은 agentproofKR/agentproofKR.github.io 저장소만 작업한다. 다른 프로젝트 구조나 다른 저장소 개념을 섞지 않는다.
작업 전 이 문서와 docs/agentproof-super-mvp-v1/00_README_FOR_CODEX.md를 읽고, 관련 현재 파일을 직접 확인한다.
변경은 작은 단위로 수행하고, TypeScript strict, 개인정보/토큰 비노출, 한국어 UI, 320px 이상 가로 스크롤 금지를 유지한다.
작업 후 pnpm lint, pnpm typecheck, pnpm test, 관련 Playwright/E2E 또는 security test를 실행하고 실패를 수정한다.
```


---

<!-- 22_CSV_JOB_PROCESSING.md -->

# 22. CSV/XLSX 비동기 Job 설계서

## 1. 문제

P0는 CSV/XLSX 5MB/50행을 지원한다. 동기 Edge 처리로 모든 행을 LLM 처리하면 timeout과 사용자 이탈이 발생할 수 있다.

## 2. 목표

- 업로드 즉시 job 생성.
- row 단위로 처리.
- job status polling.
- 부분 실패 허용.
- completed rows는 result card로 즉시 표시.

## 3. Job flow

```txt
파일 업로드
→ 파일 parse
→ proof_jobs 생성
→ proof_job_items 생성
→ queued response 반환
→ worker/polling 처리
→ row별 proof_case/result_card 생성
→ job status completed/failed
```

## 4. User UI

```txt
CSV 32행을 처리 중입니다.
12개 완료 · 1개 차단 · 19개 대기
완료된 결과 카드는 아래에서 바로 볼 수 있습니다.
```

## 5. Error codes

- unsupported_file_type
- file_too_large
- missing_required_column
- too_many_rows
- empty_file
- row_parse_failed
- provider_timeout
- pii_blocked

## 6. Acceptance

- 50행 upload가 Edge timeout 없이 job status를 반환한다.
- 실패 row가 있어도 성공 row 결과 카드가 생성된다.
- job progress가 Board에 표시된다.
- raw file delete_after_parse evidence가 남는다.


## Codex 실행 프롬프트

```text
당신은 agentproofKR/agentproofKR.github.io 저장소만 작업한다. 다른 프로젝트 구조나 다른 저장소 개념을 섞지 않는다.
작업 전 이 문서와 docs/agentproof-super-mvp-v1/00_README_FOR_CODEX.md를 읽고, 관련 현재 파일을 직접 확인한다.
변경은 작은 단위로 수행하고, TypeScript strict, 개인정보/토큰 비노출, 한국어 UI, 320px 이상 가로 스크롤 금지를 유지한다.
작업 후 pnpm lint, pnpm typecheck, pnpm test, 관련 Playwright/E2E 또는 security test를 실행하고 실패를 수정한다.
```


---

<!-- 23_REPORT_AND_CONVERSION_SPEC.md -->

# 23. 10일 결과표 / 운영 전환 명세서

## 1. Report 목적

10일 결과표는 예쁜 보고서가 아니라 대표/팀장이 월 19만 원 운영 전환 여부를 판단하는 의사결정 화면이다.

## 2. Report 필수 필드

- project id
- work name/type
- period
- proof score
- verdict
- processed count
- feedback breakdown
- saved minutes
- risk count
- human review count
- reliability
- allowed scope
- excluded scope
- next action
- conversion CTA

## 3. 전환 로직

| 조건 | CTA |
|---|---|
| passed | 월 19만 원 운영 전환 추천 |
| conditional_pass | 조건부 운영 전환 상담 추천 |
| retest | 재검증 후 운영 전환 검토 |
| failed | 업무 범위 재설계 권장 |
| insufficient_data | 데이터 추가 입력 권장 |

## 4. Conversion payload

```ts
type ProofConversionRequestPayload = {
  kind: 'proof_conversion_request';
  projectId: string;
  projectAccessToken: string;
  reportId?: string;
  requestedPlan: 'single_work_190000';
  resultType: 'pass' | 'conditional_pass' | 'retest' | 'fail' | 'insufficient_data';
  recommendedPlan: 'single_work_190000';
  pricePlan: 'single_work_190000';
  planPrice: 190000;
  sourceCta: string;
  decisionMakerMemo?: string;
  email?: string;
};
```

## 5. Report publish guard

- draft는 admin만.
- review는 admin만.
- published만 report_view token으로 열람 가능.
- recheck_needed는 공개 링크에서 “재검증 필요”로 표시하거나 차단.

## 6. Acceptance

- report에는 5개 핵심 숫자가 첫 화면에 보인다.
- report 전환 CTA는 reportId/projectId/verdict를 포함한다.
- conversion request는 raw text를 포함하지 않는다.
- report view scope mismatch는 차단한다.


## Codex 실행 프롬프트

```text
당신은 agentproofKR/agentproofKR.github.io 저장소만 작업한다. 다른 프로젝트 구조나 다른 저장소 개념을 섞지 않는다.
작업 전 이 문서와 docs/agentproof-super-mvp-v1/00_README_FOR_CODEX.md를 읽고, 관련 현재 파일을 직접 확인한다.
변경은 작은 단위로 수행하고, TypeScript strict, 개인정보/토큰 비노출, 한국어 UI, 320px 이상 가로 스크롤 금지를 유지한다.
작업 후 pnpm lint, pnpm typecheck, pnpm test, 관련 Playwright/E2E 또는 security test를 실행하고 실패를 수정한다.
```


---

<!-- 24_QA_TEST_STRATEGY.md -->

# 24. QA / 테스트 전략서

## 1. 기본 명령

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm test:security
pnpm build
```

## 2. 테스트 계층

| 계층 | 대상 |
|---|---|
| Unit | proofCore scoring, risk review, result card, redaction |
| Contract | Edge payload kinds, error shape, access guard |
| Integration | create board from survey, text intake, feedback, report |
| E2E | survey result → board → card → feedback → dashboard → report |
| Security | secret/token/raw text leakage, CORS, PII |
| Visual | landing, survey result, board, dashboard, report mobile/desktop |

## 3. 필수 E2E 시나리오

### E2E-001 중복 설문 제거

```txt
무료 진단 결과 페이지에서 CTA 클릭
→ /proof/pilot-design/questions를 거치지 않음
→ /proof/board 진입
→ 첫 입력 가능
```

### E2E-002 첫 결과 카드

```txt
Board 진입
→ sample 또는 text 입력
→ ResultCard 생성
→ 4개 사용 여부 버튼 표시
```

### E2E-003 feedback metrics

```txt
ResultCard에서 수정 후 사용 클릭
→ Board KPI 사용률/수정후 사용률 업데이트
→ dashboard에도 반영
```

### E2E-004 report guard

```txt
unpublished report_view 접근 차단
published report + report_view token 접근 허용
board_access token으로 report-only 접근 차단
```

### E2E-005 privacy

```txt
개인정보 포함 입력
→ 마스킹/차단 표시
→ analytics/log/localStorage에 원문 없음
```

## 4. Visual checkpoints

- `/` desktop/mobile
- `/survey/result` desktop/mobile
- `/proof/board` empty/with cards/mobile
- `/proof/dashboard` with summary
- `/proof/report` published
- `/admin/dashboard`

## 5. Acceptance

- 새 기능은 테스트 없이 완료 금지.
- UI 변경은 최소 1개 E2E 또는 visual assertion 필요.
- 보안/개인정보 관련 변경은 `test:security` 필수.


## Codex 실행 프롬프트

```text
당신은 agentproofKR/agentproofKR.github.io 저장소만 작업한다. 다른 프로젝트 구조나 다른 저장소 개념을 섞지 않는다.
작업 전 이 문서와 docs/agentproof-super-mvp-v1/00_README_FOR_CODEX.md를 읽고, 관련 현재 파일을 직접 확인한다.
변경은 작은 단위로 수행하고, TypeScript strict, 개인정보/토큰 비노출, 한국어 UI, 320px 이상 가로 스크롤 금지를 유지한다.
작업 후 pnpm lint, pnpm typecheck, pnpm test, 관련 Playwright/E2E 또는 security test를 실행하고 실패를 수정한다.
```


---

<!-- 25_DEPLOYMENT_RELEASE_RUNBOOK.md -->

# 25. 배포 / 릴리즈 Runbook

## 1. 로컬 검증

```bash
pnpm install
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm test:security
pnpm build
```

## 2. Supabase 검증

- migration dry run
- proof-submit Edge function deploy check
- CORS allowed origins
- RLS/권한 확인
- token scope/status/expiry 테스트
- QA data cleanup

## 3. 배포 전 체크리스트

- [ ] `/version.json` 생성 확인
- [ ] secret이 bundle/log/docs에 없음
- [ ] `NEXT_PUBLIC_SURVEY_API_URL` 설정 확인
- [ ] `LEGAL_OPERATOR_NAME` 설정 확인
- [ ] Supabase variables/secrets 확인
- [ ] report/published guard 확인
- [ ] raw source audit reason 필수 확인

## 4. GitHub Pages 배포

- main push 또는 수동 workflow.
- deploy-pages workflow 확인.
- live domain 최신 SHA 반영 확인.

## 5. Smoke test

- 랜딩 CTA
- 무료 진단 시작
- 결과 페이지
- Board 생성
- text intake sample
- feedback click
- dashboard open
- report guard
- admin dashboard load

## 6. Rollback 기준

- survey submit 깨짐
- proof text intake 5xx 증가
- token scope guard 오작동
- 개인정보/토큰 노출 발견
- mobile board 가로 스크롤 발생
- report unpublished 공개 노출


## Codex 실행 프롬프트

```text
당신은 agentproofKR/agentproofKR.github.io 저장소만 작업한다. 다른 프로젝트 구조나 다른 저장소 개념을 섞지 않는다.
작업 전 이 문서와 docs/agentproof-super-mvp-v1/00_README_FOR_CODEX.md를 읽고, 관련 현재 파일을 직접 확인한다.
변경은 작은 단위로 수행하고, TypeScript strict, 개인정보/토큰 비노출, 한국어 UI, 320px 이상 가로 스크롤 금지를 유지한다.
작업 후 pnpm lint, pnpm typecheck, pnpm test, 관련 Playwright/E2E 또는 security test를 실행하고 실패를 수정한다.
```


---

<!-- 26_MIGRATION_ROLLOUT_PLAN.md -->

# 26. Migration / Rollout Plan

## 1. 목표

기존 v0.5~v0.8.6 기능을 깨지 않고 Super MVP로 전환한다.

## 2. 단계

### Phase A — UX redirect

- survey result CTA 변경
- pilot design questions 필수 제거
- start route를 board creation screen으로 변경
- legacy URL 유지

### Phase B — Board redesign

- KPI strip
- ResultCard redesign
- feedback buttons
- empty state
- mobile layout

### Phase C — Data source

- summary endpoint
- repository read model
- localStorage fallback only
- idempotent create board

### Phase D — Scalability

- proof_jobs tables
- indexes
- job status UI
- rate limit

### Phase E — Report/conversion

- visual scorecard
- report publish guard
- conversion context
- admin review flow

## 3. Feature flags

| flag | 목적 |
|---|---|
| `AP_SUPER_MVP_BOARD_FLOW` | survey result → board 바로 생성 |
| `AP_SUPER_MVP_SUMMARY_API` | Supabase summary hydration |
| `AP_SUPER_MVP_ASYNC_CSV` | CSV job flow |
| `AP_SUPER_MVP_REPORT_V2` | visual report |

## 4. Rollout

1. local sample mode
2. staging Supabase
3. 1 internal project
4. 3 pilot companies
5. public CTA 10%
6. public CTA 100%

## 5. 데이터 호환성

- 기존 `pilot_design_sessions` 유지.
- 기존 `work_profiles` 유지.
- 새로운 board creation은 기존 table을 재사용하되 `source='survey_result'` metadata 추가 권장.
- questions route로 만든 project도 Board에서 정상 표시.


## Codex 실행 프롬프트

```text
당신은 agentproofKR/agentproofKR.github.io 저장소만 작업한다. 다른 프로젝트 구조나 다른 저장소 개념을 섞지 않는다.
작업 전 이 문서와 docs/agentproof-super-mvp-v1/00_README_FOR_CODEX.md를 읽고, 관련 현재 파일을 직접 확인한다.
변경은 작은 단위로 수행하고, TypeScript strict, 개인정보/토큰 비노출, 한국어 UI, 320px 이상 가로 스크롤 금지를 유지한다.
작업 후 pnpm lint, pnpm typecheck, pnpm test, 관련 Playwright/E2E 또는 security test를 실행하고 실패를 수정한다.
```


---

<!-- 27_GLOBAL_SAAS_BENCHMARK_PATTERNS.md -->

# 27. 글로벌 SaaS 100개 벤치마크 패턴 요약

## 1. 분석 그룹

| 그룹 | 서비스 | 가져올 패턴 |
|---|---|---|
| Work OS | Linear, Jira, Asana, monday.com, ClickUp, Trello, Wrike, Smartsheet, Height, Basecamp | 상태, 프로젝트, 필터, 공유 뷰, 진행률 |
| Workflow/BPM | ServiceNow, Camunda, Zapier, Make, n8n, Workato, Tray.io, Boomi, Power Automate, Retool | 승인, 자동화, 감사, 조건 분기 |
| LLMOps/Eval | LangSmith, Braintrust, Langfuse, Humanloop, Galileo, Arize Phoenix, W&B Weave, Helicone, Promptfoo, Guardrails AI | trace, eval, scorer, feedback, regression |
| Observability | Datadog, New Relic, Sentry, Grafana, Honeycomb, Splunk, Elastic, PagerDuty, Opsgenie, Better Stack | 지표, 이벤트, 알림, 장애 추적 |
| Knowledge | Notion, Confluence, Coda, Airtable, Google Workspace, Microsoft 365, Guru, Slab, Slite, Dropbox | 문서/테이블/카드형 협업 |
| CRM/CS | Salesforce, HubSpot, Zendesk, Intercom, Freshdesk, Front, Gainsight, ChurnZero, Gong, Outreach | 고객응대 품질, 파이프라인, 활동 로그 |
| Security/GRC | Okta, Auth0, Vanta, Drata, OneTrust, Wiz, Snyk, Semgrep, CrowdStrike, Microsoft Purview | 접근제어, 감사증거, 보안 이벤트 |
| BI/Product Analytics | Amplitude, Mixpanel, PostHog, Looker, Tableau, Power BI, Hex, Metabase, Mode, Segment | funnel, cohort, metric card, dashboard |
| Finance/Ops | Ramp, Brex, Coupa, SAP Ariba, NetSuite, QuickBooks, Xero, Odoo, Zoho, Shopify | 승인/비용/구매 판단 근거 |
| Product Craft | Stripe, Vercel, Figma, Slack, Discord, Toss, Attio, Linear, Shopify, Notion | 단순한 CTA, 숫자, 고급스러운 카드, 빠른 액션 |

## 2. AgentProof 적용 원칙

1. Linear처럼 빠르게 상태를 바꾸고 필터링한다.
2. Jira처럼 작업/위험/승인 상태가 명확하다.
3. ServiceNow처럼 사람 승인과 감사 로그를 남긴다.
4. Camunda처럼 사람+AI+시스템 이벤트를 end-to-end 증거로 묶는다.
5. LangSmith처럼 결과별 trace를 남긴다.
6. Braintrust처럼 scorer와 verdict를 명확히 한다.
7. Datadog처럼 운영 숫자와 위험을 한눈에 보여준다.
8. Vanta처럼 증거 기반 신뢰도를 보여준다.
9. Toss처럼 글보다 숫자와 CTA가 먼저다.
10. Stripe처럼 브랜드 완성도를 높인다.

## 3. 화면별 적용

| 화면 | 가져올 패턴 |
|---|---|
| Landing | Stripe/Toss: 큰 메시지, 짧은 문장, 숫자 proof |
| Survey Result | Toss: 결과 요약 + 하나의 다음 액션 |
| Board | Linear/Notion: 카드와 빠른 액션 |
| Dashboard | Datadog/Amplitude: metric cards + breakdown |
| Report | Vanta/Drata: audit proof + pass/conditional verdict |
| Admin | Jira/ServiceNow: queue, status, approval |


## Codex 실행 프롬프트

```text
당신은 agentproofKR/agentproofKR.github.io 저장소만 작업한다. 다른 프로젝트 구조나 다른 저장소 개념을 섞지 않는다.
작업 전 이 문서와 docs/agentproof-super-mvp-v1/00_README_FOR_CODEX.md를 읽고, 관련 현재 파일을 직접 확인한다.
변경은 작은 단위로 수행하고, TypeScript strict, 개인정보/토큰 비노출, 한국어 UI, 320px 이상 가로 스크롤 금지를 유지한다.
작업 후 pnpm lint, pnpm typecheck, pnpm test, 관련 Playwright/E2E 또는 security test를 실행하고 실패를 수정한다.
```


---

<!-- 28_COPYWRITING_AND_EMPTY_STATES.md -->

# 28. 카피라이팅 / Empty State 문구집

## 1. 핵심 카피

```txt
AI 도입 여부를 감으로 정하지 마세요.
10일 동안 실제 업무로 증명하세요.
```

```txt
진단은 끝났습니다.
이제 실제 업무를 넣고 10일 Proof Board를 시작하세요.
```

```txt
붙여넣으면 결과 카드가 나오고,
10일이 지나면 운영 판단표가 남습니다.
```

## 2. CTA

| 위치 | Primary | Secondary |
|---|---|---|
| Landing | 무료 업무 검증 시작 | 10일 Proof Test 보기 |
| Survey Result | 10일 Proof Board 바로 만들기 | 샘플 Board 보기 |
| Board Empty | 첫 업무 붙여넣기 | 샘플로 먼저 보기 |
| Dashboard | 10일 결과표 보기 | 오늘 5건 더 입력하기 |
| Report | 운영 전환 문의 | 결과표 공유하기 |

## 3. 상태 문구

| 상태 | 문구 |
|---|---|
| no input | 아직 검증한 업무가 없습니다. 첫 업무를 붙여넣으면 결과 카드가 만들어집니다. |
| processing | 결과 카드를 만드는 중입니다. 위험표현과 누락정보를 함께 확인합니다. |
| low risk | 바로 초안으로 활용할 수 있지만 최종 확인은 사람이 해야 합니다. |
| human review | 사람 확인이 필요한 표현이 있습니다. 발송 전 담당자가 확인하세요. |
| blocked | 이 결과는 그대로 사용할 수 없습니다. 개인정보 또는 금지 표현이 감지되었습니다. |
| report low | 아직 데이터가 부족합니다. 업무 5건 이상을 넣으면 판단이 쉬워집니다. |
| report high | 충분한 사용 기록이 쌓였습니다. 운영 전환 판단에 사용할 수 있습니다. |

## 4. 위험표현 문구

- 가격 확정 표현이 있습니다.
- 납기 보장처럼 보이는 문장이 있습니다.
- 계약/법률 판단으로 오해될 수 있습니다.
- 환불/보상 확정 표현이 있습니다.
- 개인정보가 포함되어 마스킹이 필요합니다.
- 자동 발송을 암시하는 표현이 있습니다.

## 5. Report verdict 문구

| Verdict | 문구 |
|---|---|
| passed | 제한된 범위에서 운영 가능성이 확인되었습니다. |
| conditional_pass | 성과는 확인됐지만 사람 확인 조건이 필요합니다. |
| retest | 가능성은 있으나 더 많은 실제 업무 검증이 필요합니다. |
| failed | 현재 데이터로는 운영 전환을 추천하기 어렵습니다. |
| insufficient_data | 아직 판단할 만큼의 사용 기록이 부족합니다. |


## Codex 실행 프롬프트

```text
당신은 agentproofKR/agentproofKR.github.io 저장소만 작업한다. 다른 프로젝트 구조나 다른 저장소 개념을 섞지 않는다.
작업 전 이 문서와 docs/agentproof-super-mvp-v1/00_README_FOR_CODEX.md를 읽고, 관련 현재 파일을 직접 확인한다.
변경은 작은 단위로 수행하고, TypeScript strict, 개인정보/토큰 비노출, 한국어 UI, 320px 이상 가로 스크롤 금지를 유지한다.
작업 후 pnpm lint, pnpm typecheck, pnpm test, 관련 Playwright/E2E 또는 security test를 실행하고 실패를 수정한다.
```


---

<!-- 29_CODEX_EXECUTION_PROTOCOL.md -->

# 29. Codex 실행 프로토콜

## 1. 절대 원칙

- `agentproofKR/agentproofKR.github.io`만 작업한다.
- 다른 프로젝트 폴더/도메인/아키텍처를 섞지 않는다.
- 한국어 UI를 유지한다.
- 가짜 고객 수치/후기/로고/인증을 만들지 않는다.
- secret/token/raw text를 bundle/log/docs/analytics에 노출하지 않는다.
- 기능 변경에는 테스트를 함께 추가한다.

## 2. 작업 시작 절차

1. `AGENTS.md` 읽기.
2. `docs/agentproof-super-mvp-v1/00_README_FOR_CODEX.md` 읽기.
3. 해당 task packet 읽기.
4. 관련 현재 파일 직접 열기.
5. 변경 계획을 5줄 이하로 요약.
6. 작은 단위로 수정.
7. 테스트 실행.
8. 결과 보고.

## 3. 작업 단위 규칙

- 한 번에 route 흐름 + UI + DB + Edge를 모두 크게 바꾸지 않는다.
- AP-SMVP task 1개 단위로 진행한다.
- public UX 변경과 admin/security 변경은 분리한다.
- DB migration은 반드시 rollback risk를 적는다.

## 4. 완료 보고 형식

```txt
구현한 작업:
- AP-SMVP-00X ...

변경 파일:
- ...

테스트:
- pnpm lint: pass/fail
- pnpm typecheck: pass/fail
- pnpm test: pass/fail
- pnpm test:e2e: pass/fail or not run(reason)
- pnpm test:security: pass/fail or not run(reason)

확인한 UX:
- ...

남은 이슈:
- ...
```

## 5. 중단 기준

- 테스트가 깨졌는데 원인을 모를 때.
- 개인정보/토큰 노출 가능성이 생겼을 때.
- migration이 기존 운영 데이터를 삭제할 수 있을 때.
- survey 기존 저장 흐름이 깨질 때.


## Codex 실행 프롬프트

```text
당신은 agentproofKR/agentproofKR.github.io 저장소만 작업한다. 다른 프로젝트 구조나 다른 저장소 개념을 섞지 않는다.
작업 전 이 문서와 docs/agentproof-super-mvp-v1/00_README_FOR_CODEX.md를 읽고, 관련 현재 파일을 직접 확인한다.
변경은 작은 단위로 수행하고, TypeScript strict, 개인정보/토큰 비노출, 한국어 UI, 320px 이상 가로 스크롤 금지를 유지한다.
작업 후 pnpm lint, pnpm typecheck, pnpm test, 관련 Playwright/E2E 또는 security test를 실행하고 실패를 수정한다.
```


---

<!-- 30_CODEX_MASTER_PROMPT.md -->

# 30. Codex Master Prompt

아래 프롬프트는 Codex 세션 시작 시 그대로 붙여넣는다.

```text
당신은 AgentProof Super MVP v1 구현 담당 Codex다.
대상 저장소는 agentproofKR/agentproofKR.github.io 하나뿐이다. 다른 프로젝트의 구조, 용어, 아키텍처를 섞지 않는다.

목표:
현재 AgentProof MVP를 실제 서비스 가능한 Super MVP로 개선한다. 핵심은 무료 진단 후 중복 설문 없이 Proof Board로 바로 들어가고, 실제 업무 입력 → 결과 카드 → 1클릭 사용 여부 → Proof Score/Evidence Dashboard → 10일 결과표 → 월 19만 원 운영 전환 문의까지 한 흐름으로 닫는 것이다.

작업 전 반드시 읽을 문서:
1. AGENTS.md
2. docs/agentproof-super-mvp-v1/00_README_FOR_CODEX.md
3. docs/agentproof-super-mvp-v1/02_CURRENT_SOURCE_AUDIT.md
4. docs/agentproof-super-mvp-v1/31_BACKLOG_TASK_PACKETS.md
5. 현재 맡은 task packet

절대 지킬 것:
- 한국어 UI 유지
- 진단 후 /proof/pilot-design/questions 필수 경로 재도입 금지
- 원문, 이메일, 회사명, token, secret을 analytics/localStorage/log/bundle에 노출 금지
- 사용자는 케이스/워크스페이스/피드백보다 업무/파일럿 보드/사용 여부라는 쉬운 용어를 본다
- 모든 핵심 화면은 숫자 중심이어야 한다
- 320px 이상에서 가로 스크롤 금지
- 기능 변경에는 테스트 추가

작업 방식:
- 작은 task 하나씩 구현
- 관련 파일 직접 확인 후 수정
- pnpm lint, pnpm typecheck, pnpm test 실행
- UI 변경이면 관련 E2E/visual assertion 추가
- 보안 변경이면 pnpm test:security 실행

완료 보고에는 변경 파일, 실행 테스트, UX 확인 결과, 남은 리스크를 포함한다.
```

## Codex 실행 프롬프트

```text
당신은 agentproofKR/agentproofKR.github.io 저장소만 작업한다. 다른 프로젝트 구조나 다른 저장소 개념을 섞지 않는다.
작업 전 이 문서와 docs/agentproof-super-mvp-v1/00_README_FOR_CODEX.md를 읽고, 관련 현재 파일을 직접 확인한다.
변경은 작은 단위로 수행하고, TypeScript strict, 개인정보/토큰 비노출, 한국어 UI, 320px 이상 가로 스크롤 금지를 유지한다.
작업 후 pnpm lint, pnpm typecheck, pnpm test, 관련 Playwright/E2E 또는 security test를 실행하고 실패를 수정한다.
```


---

<!-- 31_BACKLOG_TASK_PACKETS.md -->

# 31. Backlog / Task Packets

## Epic 1 — 중복 설문 제거와 Board 직행

| ID | 작업 | Prompt file |
|---|---|---|
| AP-SMVP-001 | pilot design questions 필수 경로 제거 | `codex-prompts/AP-SMVP-001_remove_duplicate_survey.md` |
| AP-SMVP-002 | survey result에서 Proof Board 생성 | `codex-prompts/AP-SMVP-002_survey_result_to_board.md` |

## Epic 2 — Proof Board Super MVP UI

| ID | 작업 | Prompt file |
|---|---|---|
| AP-SMVP-003 | Board KPI redesign | `codex-prompts/AP-SMVP-003_board_kpi_redesign.md` |
| AP-SMVP-004 | Result Card redesign | `codex-prompts/AP-SMVP-004_result_card_redesign.md` |
| AP-SMVP-017 | Mobile responsive board | `codex-prompts/AP-SMVP-017_mobile_responsive_board.md` |

## Epic 3 — Supabase-first / 1000명 운영

| ID | 작업 | Prompt file |
|---|---|---|
| AP-SMVP-005 | project summary endpoint | `codex-prompts/AP-SMVP-005_proof_summary_endpoint.md` |
| AP-SMVP-006 | Supabase-first repository | `codex-prompts/AP-SMVP-006_supabase_first_repository.md` |
| AP-SMVP-007 | CSV async jobs | `codex-prompts/AP-SMVP-007_proof_jobs_csv_async.md` |
| AP-SMVP-010 | access token exchange | `codex-prompts/AP-SMVP-010_access_token_exchange.md` |

## Epic 4 — Score / Report / Conversion

| ID | 작업 | Prompt file |
|---|---|---|
| AP-SMVP-008 | ProofScore dashboard | `codex-prompts/AP-SMVP-008_score_verdict_dashboard.md` |
| AP-SMVP-009 | Report scorecard conversion | `codex-prompts/AP-SMVP-009_report_scorecard_conversion.md` |
| AP-SMVP-011 | Admin report publish flow | `codex-prompts/AP-SMVP-011_admin_publish_flow.md` |

## Epic 5 — Safety / Analytics / Release

| ID | 작업 | Prompt file |
|---|---|---|
| AP-SMVP-012 | security/privacy hardening | `codex-prompts/AP-SMVP-012_security_privacy_hardening.md` |
| AP-SMVP-013 | analytics funnel | `codex-prompts/AP-SMVP-013_analytics_funnel.md` |
| AP-SMVP-014 | QA/E2E/visual tests | `codex-prompts/AP-SMVP-014_tests_visual_e2e.md` |
| AP-SMVP-015 | brand design application | `codex-prompts/AP-SMVP-015_brand_design_system_apply.md` |
| AP-SMVP-016 | LLM gateway eval guardrails | `codex-prompts/AP-SMVP-016_llm_gateway_eval_guardrails.md` |
| AP-SMVP-018 | release verification | `codex-prompts/AP-SMVP-018_release_verification.md` |

## 권장 실행 순서

```txt
001 → 002 → 003 → 004 → 008 → 009 → 005 → 006 → 007 → 010 → 011 → 012 → 013 → 014 → 015 → 017 → 016 → 018
```


## Codex 실행 프롬프트

```text
당신은 agentproofKR/agentproofKR.github.io 저장소만 작업한다. 다른 프로젝트 구조나 다른 저장소 개념을 섞지 않는다.
작업 전 이 문서와 docs/agentproof-super-mvp-v1/00_README_FOR_CODEX.md를 읽고, 관련 현재 파일을 직접 확인한다.
변경은 작은 단위로 수행하고, TypeScript strict, 개인정보/토큰 비노출, 한국어 UI, 320px 이상 가로 스크롤 금지를 유지한다.
작업 후 pnpm lint, pnpm typecheck, pnpm test, 관련 Playwright/E2E 또는 security test를 실행하고 실패를 수정한다.
```


---

<!-- 32_ACCEPTANCE_CHECKLISTS.md -->

# 32. Acceptance Checklists

## 1. UX Flow

- [ ] `/survey/result`에서 CTA 문구가 `10일 Proof Board 바로 만들기`다.
- [ ] CTA 클릭 후 `/proof/pilot-design/questions`를 거치지 않는다.
- [ ] Board 첫 진입에서 업무 입력/샘플 실행이 보인다.
- [ ] 첫 ResultCard까지 3분 이내 UX가 가능하다.
- [ ] Board 상단에 Proof Score/처리/사용률/절감/위험/사람확인/신뢰도가 보인다.

## 2. Result Card

- [ ] 요약/초안/누락정보/주의표현/사람확인/액션이 분리되어 있다.
- [ ] 위험 수준 chip이 보인다.
- [ ] blocked 카드의 copy 정책이 안전하다.
- [ ] 4개 사용 여부 버튼이 항상 보인다.
- [ ] 클릭 후 metrics가 업데이트된다.

## 3. Dashboard/Report

- [ ] Proof Score가 0~100으로 표시된다.
- [ ] Verdict가 통과/조건부/재검증/불합격/데이터 부족으로 표시된다.
- [ ] Report 첫 화면에 5개 숫자가 보인다.
- [ ] 운영 가능 범위와 제외 범위가 함께 표시된다.
- [ ] 운영 전환 CTA가 report context를 포함한다.

## 4. Data/API

- [ ] Supabase summary read가 가능하다.
- [ ] localStorage는 source of truth가 아니다.
- [ ] CSV 업로드는 job status를 반환한다.
- [ ] idempotency key가 mutation에 사용된다.
- [ ] rate limit이 문서/코드에 반영된다.

## 5. Security

- [ ] raw token은 저장/log/analytics에 없다.
- [ ] report_view와 board_access scope가 분리된다.
- [ ] unpublished report는 공개되지 않는다.
- [ ] raw source access는 reason 없이 불가능하다.
- [ ] PII 입력은 마스킹/차단된다.

## 6. Test

- [ ] pnpm lint pass
- [ ] pnpm typecheck pass
- [ ] pnpm test pass
- [ ] relevant e2e pass
- [ ] security test pass
- [ ] mobile visual check pass


## Codex 실행 프롬프트

```text
당신은 agentproofKR/agentproofKR.github.io 저장소만 작업한다. 다른 프로젝트 구조나 다른 저장소 개념을 섞지 않는다.
작업 전 이 문서와 docs/agentproof-super-mvp-v1/00_README_FOR_CODEX.md를 읽고, 관련 현재 파일을 직접 확인한다.
변경은 작은 단위로 수행하고, TypeScript strict, 개인정보/토큰 비노출, 한국어 UI, 320px 이상 가로 스크롤 금지를 유지한다.
작업 후 pnpm lint, pnpm typecheck, pnpm test, 관련 Playwright/E2E 또는 security test를 실행하고 실패를 수정한다.
```


---

<!-- 34_PROMPT_INDEX.md -->

# 34. Prompt Index

Codex prompt는 `codex-prompts/` 폴더에 있다.

## 시작 프롬프트

- `PROMPT_00_READ_FIRST.md`

## Task prompts

- `AP-SMVP-001_remove_duplicate_survey.md`
- `AP-SMVP-002_survey_result_to_board.md`
- `AP-SMVP-003_board_kpi_redesign.md`
- `AP-SMVP-004_result_card_redesign.md`
- `AP-SMVP-005_proof_summary_endpoint.md`
- `AP-SMVP-006_supabase_first_repository.md`
- `AP-SMVP-007_proof_jobs_csv_async.md`
- `AP-SMVP-008_score_verdict_dashboard.md`
- `AP-SMVP-009_report_scorecard_conversion.md`
- `AP-SMVP-010_access_token_exchange.md`
- `AP-SMVP-011_admin_publish_flow.md`
- `AP-SMVP-012_security_privacy_hardening.md`
- `AP-SMVP-013_analytics_funnel.md`
- `AP-SMVP-014_tests_visual_e2e.md`
- `AP-SMVP-015_brand_design_system_apply.md`
- `AP-SMVP-016_llm_gateway_eval_guardrails.md`
- `AP-SMVP-017_mobile_responsive_board.md`
- `AP-SMVP-018_release_verification.md`

## 사용법

1. `PROMPT_00_READ_FIRST.md`를 Codex 세션 시작에 붙여넣는다.
2. 작업할 task prompt 하나만 추가로 붙여넣는다.
3. 한 번에 여러 task를 섞지 않는다.
4. task 완료 후 테스트 결과와 변경 파일을 보고받는다.

## Codex 실행 프롬프트

```text
당신은 agentproofKR/agentproofKR.github.io 저장소만 작업한다. 다른 프로젝트 구조나 다른 저장소 개념을 섞지 않는다.
작업 전 이 문서와 docs/agentproof-super-mvp-v1/00_README_FOR_CODEX.md를 읽고, 관련 현재 파일을 직접 확인한다.
변경은 작은 단위로 수행하고, TypeScript strict, 개인정보/토큰 비노출, 한국어 UI, 320px 이상 가로 스크롤 금지를 유지한다.
작업 후 pnpm lint, pnpm typecheck, pnpm test, 관련 Playwright/E2E 또는 security test를 실행하고 실패를 수정한다.
```


---

<!-- 35_OPERATIONS_CUSTOMER_SUCCESS_PLAYBOOK.md -->

# 35. 운영 / 고객성공 Playbook

## 1. 10일 Proof Test 운영 원칙

- 고객에게 추가 리포트 작성을 요구하지 않는다.
- 고객은 실제 업무를 붙여넣고 사용 여부만 클릭하면 된다.
- 운영자는 리포트 공개 전 숫자와 위험표현을 검수한다.
- 월 19만 원 전환은 결과표가 판단 근거다.

## 2. 파일럿 온보딩 메시지

```txt
진단은 완료되었습니다.
이제 10일 동안 실제 업무 원문을 넣어 AI가 어디까지 안전하게 도와줄 수 있는지 확인합니다.
하루 3~5건만 넣어도 결과표의 신뢰도가 높아집니다.
```

## 3. Day별 운영자 체크

| Day | 운영자 확인 |
|---:|---|
| 0 | Board 생성/접속 링크/업무 유형 확인 |
| 1 | 첫 결과 카드 생성 여부 |
| 2 | 사용 여부 클릭률 확인 |
| 3 | 위험표현 과다/blocked 여부 |
| 5 | 처리건수 10건 이상 유도 |
| 7 | Dashboard 중간 점검 |
| 9 | Report draft 생성/검수 |
| 10 | Report publish/전환 문의 안내 |

## 4. 전환 상담 기준

| 조건 | 안내 |
|---|---|
| Proof Score >= 80 | 운영 전환 적극 추천 |
| 60~79 | 조건부 운영 전환, 사람 확인 기준 포함 |
| 40~59 | 재검증 제안 |
| < 40 | 업무 범위 재설계 |
| 데이터 부족 | 5~10건 추가 입력 요청 |

## 5. 고객에게 보여줄 숫자

- 처리건수
- 사용률
- 수정 후 사용률
- 절감시간
- 위험표현 수
- 사람 확인 필요 수
- 운영 가능 범위
- 제외 범위


## Codex 실행 프롬프트

```text
당신은 agentproofKR/agentproofKR.github.io 저장소만 작업한다. 다른 프로젝트 구조나 다른 저장소 개념을 섞지 않는다.
작업 전 이 문서와 docs/agentproof-super-mvp-v1/00_README_FOR_CODEX.md를 읽고, 관련 현재 파일을 직접 확인한다.
변경은 작은 단위로 수행하고, TypeScript strict, 개인정보/토큰 비노출, 한국어 UI, 320px 이상 가로 스크롤 금지를 유지한다.
작업 후 pnpm lint, pnpm typecheck, pnpm test, 관련 Playwright/E2E 또는 security test를 실행하고 실패를 수정한다.
```


---

<!-- 36_AGENTS_SUPER_MVP_UPDATE.md -->

# 36. AGENTS.md Super MVP 업데이트 제안

## 1. 목적

현재 `AGENTS.md`는 AgentProof Landing V4.1 기준 문서를 우선시한다. Super MVP 작업에서는 기존 규칙을 유지하되, 새 source of truth를 추가해야 Codex가 옛 랜딩 중심 지시와 새 Proof Board 중심 지시 사이에서 흔들리지 않는다.

## 2. AGENTS.md에 추가할 섹션

아래 내용을 기존 `AGENTS.md` 상단 또는 `Source of truth` 앞에 추가한다.

```md
## AgentProof Super MVP v1 작업 기준

Super MVP 작업을 수행할 때는 아래 문서를 먼저 읽는다.

1. `docs/agentproof-super-mvp-v1/00_README_FOR_CODEX.md`
2. `docs/agentproof-super-mvp-v1/01_PRODUCT_DEFINITION.md`
3. `docs/agentproof-super-mvp-v1/02_CURRENT_SOURCE_AUDIT.md`
4. `docs/agentproof-super-mvp-v1/31_BACKLOG_TASK_PACKETS.md`
5. 현재 작업의 `codex-prompts/AP-SMVP-*.md`

Super MVP의 최우선 목표는 무료 진단 후 추가 설문 없이 Proof Board로 바로 연결하고, 실제 업무 입력 → 결과 카드 → 사용 여부 → Proof Score/Evidence Dashboard → 10일 결과표 → 운영 전환 문의까지 하나의 흐름으로 닫는 것이다.

### Super MVP에서 반드시 지킬 것

- 다른 프로젝트의 구조나 용어를 섞지 않는다.
- `/proof/pilot-design/questions`를 필수 funnel로 다시 만들지 않는다.
- 사용자 화면에서는 `업무`, `파일럿 보드`, `결과 카드`, `사용 여부`, `주의표현`, `사람 확인 필요`, `10일 결과표` 용어를 우선한다.
- 원문, 이메일, 회사명, 연락처, project access token, admin token, secret은 analytics/localStorage/log/bundle에 노출하지 않는다.
- 모든 핵심 화면은 숫자 중심이어야 한다.
```

## 3. 기존 규칙과의 관계

기존 규칙은 유지한다.

- 한국어 UI 유지
- 가짜 고객 로고/후기/인증/성과 수치 금지
- 실제 저장 성공 전 성공 메시지 금지
- secret 클라이언트 노출 금지
- keyboard accessibility 유지
- 320px 이상 가로 스크롤 금지
- 기능 변경 시 테스트 추가

## 4. 적용 task

- AP-SMVP-018 또는 첫 PR에서 문서만 먼저 적용 가능.


## Codex 실행 프롬프트

```text
AgentProof Super MVP v1 작업을 수행한다. 이 문서를 source of truth로 사용하되, 변경 전 반드시 현재 repo 파일을 직접 확인한다. 다른 프로젝트 설계를 섞지 않는다. 작업 후 lint/typecheck/test와 관련 E2E/security 검증을 실행한다.
```


---

<!-- 37_DEVELOPER_HANDOFF_CHECKLIST.md -->

# 37. 개발자 핸드오프 체크리스트

## 1. 작업 시작 전

- [ ] `AGENTS.md` 읽음
- [ ] `00_README_FOR_CODEX.md` 읽음
- [ ] 작업 task prompt 읽음
- [ ] 현재 파일 직접 확인
- [ ] 변경 범위 5줄 이하로 정리

## 2. UX 변경 체크

- [ ] 한국어 UI 유지
- [ ] 중복 설문 재도입 없음
- [ ] 숫자 KPI 우선 표시
- [ ] CTA는 하나만 명확히 강조
- [ ] 모바일 320px 이상 가로 스크롤 없음
- [ ] keyboard focus 확인

## 3. 데이터/보안 체크

- [ ] raw token 저장/log 없음
- [ ] raw text analytics 없음
- [ ] email/company analytics 없음
- [ ] report scope guard 확인
- [ ] admin raw source reason 필수
- [ ] idempotencyKey 사용

## 4. 테스트 체크

- [ ] `pnpm lint`
- [ ] `pnpm typecheck`
- [ ] `pnpm test`
- [ ] 관련 `pnpm test:e2e`
- [ ] 보안 변경 시 `pnpm test:security`
- [ ] build 필요 시 `pnpm build`

## 5. PR 설명 템플릿

```md
## 변경 요약
- 

## 관련 Task
- AP-SMVP-XXX

## 변경 파일
- 

## 사용자 흐름 확인
- 

## 보안/개인정보 확인
- 

## 테스트
- [ ] pnpm lint
- [ ] pnpm typecheck
- [ ] pnpm test
- [ ] pnpm test:e2e
- [ ] pnpm test:security

## 남은 리스크
- 
```


## Codex 실행 프롬프트

```text
AgentProof Super MVP v1 작업을 수행한다. 이 문서를 source of truth로 사용하되, 변경 전 반드시 현재 repo 파일을 직접 확인한다. 다른 프로젝트 설계를 섞지 않는다. 작업 후 lint/typecheck/test와 관련 E2E/security 검증을 실행한다.
```


---

<!-- 38_SCREEN_WIREFRAMES_ASCII.md -->

# 38. ASCII 와이어프레임 모음

## 1. Survey Result

```txt
┌──────────────────────────────────────────────┐
│ AgentProof 결과                              │
│                                              │
│ AI 업무 적용도                               │
│ 64 / 100                                     │
│ ████████████░░░░░░                           │
│                                              │
│ 추천 검증 업무: 고객 문의 답변               │
│ 위험도: 중간                                 │
│                                              │
│ TOP 위험                                     │
│ 1. 가격/납기 확정 표현                       │
│ 2. 고객 전달 전 사람 확인 필요               │
│ 3. 개인정보 포함 가능성                      │
│                                              │
│ [10일 Proof Board 바로 만들기]               │
│ 진단은 끝났습니다. 추가 설문 없이 시작합니다. │
└──────────────────────────────────────────────┘
```

## 2. Proof Board Desktop

```txt
┌───────────────────────────────────────────────────────────────┐
│ Proof Board · Day 3/10                                        │
├────────────┬────────────┬────────────┬────────────┬───────────┤
│ Score 72   │ 처리 18/50 │ 사용률 61% │ 절감 2.4h │ 위험 3건  │
├────────────┴────────────┴────────────┴────────────┴───────────┤
│ 사람 확인 5건 · 리포트 신뢰도 보통                             │
├───────────────────────┬───────────────────────────────────────┤
│ [입력 패널]            │ [결과 카드 목록]                      │
│ 탭: 붙여넣기/CSV/검사  │ ┌───────────────────────────────────┐ │
│                       │ │ 주의 필요 · 납기 확정 표현 감지    │ │
│ textarea              │ │ 요약 / 초안 / 누락정보 / 주의표현 │ │
│ [결과 카드 만들기]     │ │ [그대로] [수정후] [복사만] [안씀] │ │
│ [샘플로 보기]          │ └───────────────────────────────────┘ │
└───────────────────────┴───────────────────────────────────────┘
```

## 3. Proof Board Mobile

```txt
┌──────────────────────┐
│ Proof Board Day 3/10 │
├──────────┬───────────┤
│ Score 72 │ 처리 18/50│
├──────────┼───────────┤
│ 사용 61% │ 절감 2.4h │
├──────────┴───────────┤
│ [업무 붙여넣기]       │
│ textarea             │
│ [결과 카드 만들기]    │
├──────────────────────┤
│ Result Card          │
│ [그대로][수정후]     │
│ [복사만][안씀]       │
└──────────────────────┘
```

## 4. Report

```txt
┌──────────────────────────────────────────────┐
│ 10일 결과표                                  │
│ 조건부 운영 가능                             │
│ Proof Score 78                               │
├─────────┬─────────┬─────────┬─────────┬──────┤
│ 42건    │ 64%     │ 11.2h   │ 위험 9  │ 확인13│
├─────────┴─────────┴─────────┴─────────┴──────┤
│ 운영 가능 범위                               │
│ - 문의 요약 - 답변 초안 - 누락정보 확인       │
│ 제외 범위                                    │
│ - 가격 확정 - 납기 보장 - 계약 판단 - 자동발송│
│ [월 19만 원 운영 전환 문의]                  │
└──────────────────────────────────────────────┘
```


## Codex 실행 프롬프트

```text
AgentProof Super MVP v1 작업을 수행한다. 이 문서를 source of truth로 사용하되, 변경 전 반드시 현재 repo 파일을 직접 확인한다. 다른 프로젝트 설계를 섞지 않는다. 작업 후 lint/typecheck/test와 관련 E2E/security 검증을 실행한다.
```


---

<!-- 39_PR_TEMPLATE_SUPER_MVP.md -->

# 39. Super MVP PR Template

```md
# AP-SMVP-XXX — 제목

## 1. 목적


## 2. 변경 요약

- 

## 3. 사용자 흐름 변화

Before:

After:

## 4. 변경 파일

- 

## 5. 보안/개인정보 영향

- [ ] raw text 저장/노출 없음
- [ ] token 저장/노출 없음
- [ ] analytics 개인정보 없음
- [ ] report scope guard 영향 확인

## 6. 테스트

- [ ] pnpm lint
- [ ] pnpm typecheck
- [ ] pnpm test
- [ ] pnpm test:e2e
- [ ] pnpm test:security
- [ ] pnpm build

## 7. 스크린샷/캡처

- Desktop:
- Mobile:

## 8. 남은 리스크

- 
```


## Codex 실행 프롬프트

```text
AgentProof Super MVP v1 작업을 수행한다. 이 문서를 source of truth로 사용하되, 변경 전 반드시 현재 repo 파일을 직접 확인한다. 다른 프로젝트 설계를 섞지 않는다. 작업 후 lint/typecheck/test와 관련 E2E/security 검증을 실행한다.
```


---

<!-- 40_CODE_REVIEW_CHECKLIST.md -->

# 40. 코드리뷰 체크리스트

## 1. Product

- [ ] 진단 후 중복 설문 없음
- [ ] 사용자가 첫 결과 카드까지 빠르게 도달함
- [ ] 핵심 숫자가 상단에 보임
- [ ] 월 19만 원 전환 근거가 숫자로 설명됨

## 2. UI

- [ ] 한국어 쉬운 용어
- [ ] card hierarchy 명확
- [ ] 모바일 대응
- [ ] keyboard 접근성
- [ ] loading/error/empty state 존재

## 3. Logic

- [ ] score 공식이 문서와 일치
- [ ] verdict 조건이 문서와 일치
- [ ] risk flags/human gate가 누락되지 않음
- [ ] feedback status가 metrics에 반영됨

## 4. API/Data

- [ ] idempotencyKey
- [ ] Supabase source of truth
- [ ] localStorage에 민감 데이터 없음
- [ ] query indexes 고려
- [ ] error shape 일관성

## 5. Security

- [ ] token hash only
- [ ] report_view/board_access 분리
- [ ] raw source audit reason 필수
- [ ] PII masking/blocking
- [ ] analytics allowlist


## Codex 실행 프롬프트

```text
AgentProof Super MVP v1 작업을 수행한다. 이 문서를 source of truth로 사용하되, 변경 전 반드시 현재 repo 파일을 직접 확인한다. 다른 프로젝트 설계를 섞지 않는다. 작업 후 lint/typecheck/test와 관련 E2E/security 검증을 실행한다.
```


---

<!-- 41_SUPABASE_RELEASE_VERIFICATION.md -->

# 41. Supabase Release Verification

## 1. Migration 검증

- [ ] 기존 테이블 drop 없음
- [ ] migration idempotent
- [ ] indexes 생성
- [ ] proof_jobs/proof_job_items foreign key 확인
- [ ] RLS/Edge service role 동작 확인

## 2. Edge Function 검증

- [ ] allowed origins 확인
- [ ] kind allowlist 확인
- [ ] CORS preflight 확인
- [ ] idempotency 처리
- [ ] project access 검증
- [ ] report_view guard 확인
- [ ] error shape 통일

## 3. 운영 데이터 검증

- [ ] survey submit 성공
- [ ] create board from survey 성공
- [ ] text intake 성공
- [ ] quick feedback 성공
- [ ] project summary read 성공
- [ ] report publish 성공
- [ ] conversion request 성공
- [ ] data request 성공

## 4. 보안 검증

- [ ] raw token DB 미저장
- [ ] encrypted email/phone
- [ ] raw text analytics 미포함
- [ ] raw file delete_after_parse evidence
- [ ] admin raw source audit reason required


## Codex 실행 프롬프트

```text
AgentProof Super MVP v1 작업을 수행한다. 이 문서를 source of truth로 사용하되, 변경 전 반드시 현재 repo 파일을 직접 확인한다. 다른 프로젝트 설계를 섞지 않는다. 작업 후 lint/typecheck/test와 관련 E2E/security 검증을 실행한다.
```


---

<!-- 42_TEST_FIXTURE_SPEC.md -->

# 42. 테스트 Fixture 명세서

## 1. 기본 Fixture 회사

```ts
const fixtureOrg = {
  companyName: '에이전트프루프 테스트 제조',
  industry: 'manufacturing_b2b',
  employeeCount: '20_50'
};
```

## 2. 업무 유형 fixture

- 견적 요청 정리
- 고객 문의 답변
- 납기 문의 확인
- 발주 요청 정리
- 클레임 초안 작성
- 회의록 요약

## 3. 위험 입력 fixture

### 가격 확정

```txt
최저가로 적용해드리고 최종 가격은 이 금액으로 확정하겠습니다.
```

### 납기 확정

```txt
다음 주까지 반드시 납품 가능합니다. 납기 보장드립니다.
```

### 계약/법률

```txt
계약상 문제 없고 법적으로 확실합니다.
```

### 환불/보상

```txt
전액 환불과 무조건 보상을 약속드립니다.
```

### 개인정보

```txt
홍길동 고객의 전화번호는 010-1234-5678이고 이메일은 test@example.com입니다.
```

### 자동발송

```txt
검토 없이 고객에게 바로 발송해주세요.
```

## 4. 기대 결과

| 입력 | expected |
|---|---|
| 가격 확정 | price_commitment risk + human review |
| 납기 확정 | delivery_commitment risk + human review |
| 계약/법률 | contract/legal hard block |
| 환불/보상 | refund_or_compensation risk |
| 개인정보 | privacy mask/block |
| 자동발송 | auto_send block |


## Codex 실행 프롬프트

```text
AgentProof Super MVP v1 작업을 수행한다. 이 문서를 source of truth로 사용하되, 변경 전 반드시 현재 repo 파일을 직접 확인한다. 다른 프로젝트 설계를 섞지 않는다. 작업 후 lint/typecheck/test와 관련 E2E/security 검증을 실행한다.
```
