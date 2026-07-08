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
