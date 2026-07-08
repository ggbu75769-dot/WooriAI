# Task Packet — AP-SMVP-018 — Release Verification

## Objective

Super MVP 릴리즈 전 최종 검증 스크립트와 체크리스트를 수행한다.

## Context

이 작업은 AgentProof Super MVP v1 전환의 일부다. 무료 진단 후 중복 설문 없이 Proof Board로 진입하고, 숫자 중심 결과 카드를 쌓는 흐름을 강화한다.

## Files

- `package.json`
- `scripts/**`
- `docs/agentproof-super-mvp-v1/**`

## Acceptance

- [ ] lint/typecheck/test/e2e/security/build
- [ ] version.json
- [ ] live smoke checklist

## Required tests

- [ ] `pnpm lint`
- [ ] `pnpm typecheck`
- [ ] `pnpm test`
- [ ] 관련 E2E/security/visual test 필요 여부 판단 및 실행

## Prompt

See `codex-prompts/AP-SMVP-018_release_verification.md`.
