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
