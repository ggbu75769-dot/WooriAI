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
