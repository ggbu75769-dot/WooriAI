# Task Packet — AP-SMVP-016 — LLM Gateway/Eval Guardrails

## Objective

AI output schema, provider fallback, deterministic risk review를 강화한다.

## Context

이 작업은 AgentProof Super MVP v1 전환의 일부다. 무료 진단 후 중복 설문 없이 Proof Board로 진입하고, 숫자 중심 결과 카드를 쌓는 흐름을 강화한다.

## Files

- `lib/proof.ts`
- `lib/proofCore.ts`
- `supabase/functions/proof-submit/index.ts`
- `tests/**`

## Acceptance

- [ ] schema compliance
- [ ] fallback provider
- [ ] risk_review deterministic pass
- [ ] no auto-send

## Required tests

- [ ] `pnpm lint`
- [ ] `pnpm typecheck`
- [ ] `pnpm test`
- [ ] 관련 E2E/security/visual test 필요 여부 판단 및 실행

## Prompt

See `codex-prompts/AP-SMVP-016_llm_gateway_eval_guardrails.md`.
