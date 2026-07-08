# Task Packet — AP-SMVP-010 — Access Token Exchange/Scope 강화

## Objective

board_access/report_view token scope, expiry, revoke, exchange를 강화한다.

## Context

이 작업은 AgentProof Super MVP v1 전환의 일부다. 무료 진단 후 중복 설문 없이 Proof Board로 진입하고, 숫자 중심 결과 카드를 쌓는 흐름을 강화한다.

## Files

- `lib/proofAuth.ts`
- `lib/proof.ts`
- `supabase/functions/proof-submit/index.ts`
- `supabase/migrations/**`

## Acceptance

- [ ] raw token 저장 금지
- [ ] scope mismatch 차단
- [ ] report published guard

## Required tests

- [ ] `pnpm lint`
- [ ] `pnpm typecheck`
- [ ] `pnpm test`
- [ ] 관련 E2E/security/visual test 필요 여부 판단 및 실행

## Prompt

See `codex-prompts/AP-SMVP-010_access_token_exchange.md`.
