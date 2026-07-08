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
