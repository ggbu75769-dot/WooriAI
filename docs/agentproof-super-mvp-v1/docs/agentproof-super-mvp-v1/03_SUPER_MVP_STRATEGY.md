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
