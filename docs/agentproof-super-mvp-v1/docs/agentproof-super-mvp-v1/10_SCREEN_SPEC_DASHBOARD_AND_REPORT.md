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
