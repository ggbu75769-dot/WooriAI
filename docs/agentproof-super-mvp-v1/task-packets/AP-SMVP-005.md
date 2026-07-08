# Task Packet — AP-SMVP-005 — Proof Project Summary Endpoint

## Objective

Board/Dashboard/Report가 Supabase source of truth에서 요약 데이터를 읽도록 `proof_project_summary` contract를 추가한다.

## Context

이 작업은 AgentProof Super MVP v1 전환의 일부다. 무료 진단 후 중복 설문 없이 Proof Board로 진입하고, 숫자 중심 결과 카드를 쌓는 흐름을 강화한다.

## Files

- `lib/proofSubmission.ts`
- `supabase/functions/proof-submit/index.ts`
- `lib/proofRepository.ts`
- `tests/unit/proof-edge-contract.test.ts`

## Acceptance

- [ ] summary DTO 반환
- [ ] project token 검증
- [ ] sample/blocked/cross-project 제외

## Required tests

- [ ] `pnpm lint`
- [ ] `pnpm typecheck`
- [ ] `pnpm test`
- [ ] 관련 E2E/security/visual test 필요 여부 판단 및 실행

## Prompt

See `codex-prompts/AP-SMVP-005_proof_summary_endpoint.md`.
