# Task Packet — AP-SMVP-006 — Supabase-first Repository 전환

## Objective

localStorage를 source of truth가 아니라 fallback/cache로 낮추고, live project는 Supabase summary와 mutation을 우선 사용하게 한다.

## Context

이 작업은 AgentProof Super MVP v1 전환의 일부다. 무료 진단 후 중복 설문 없이 Proof Board로 진입하고, 숫자 중심 결과 카드를 쌓는 흐름을 강화한다.

## Files

- `lib/proofRepository.ts`
- `lib/proofLocalStore.ts`
- `components/proof/ProofPages.tsx`
- `lib/proofSubmission.ts`

## Acceptance

- [ ] offline/demo fallback 유지
- [ ] live data refresh 가능
- [ ] localStorage에 raw text/token 없음

## Required tests

- [ ] `pnpm lint`
- [ ] `pnpm typecheck`
- [ ] `pnpm test`
- [ ] 관련 E2E/security/visual test 필요 여부 판단 및 실행

## Prompt

See `codex-prompts/AP-SMVP-006_supabase_first_repository.md`.
