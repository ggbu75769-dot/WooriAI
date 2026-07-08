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
