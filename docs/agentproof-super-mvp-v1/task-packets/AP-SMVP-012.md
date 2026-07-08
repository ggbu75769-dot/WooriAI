# Task Packet — AP-SMVP-012 — Security/Privacy Hardening

## Objective

PII, token, raw text, analytics leakage를 막는 테스트와 helper를 강화한다.

## Context

이 작업은 AgentProof Super MVP v1 전환의 일부다. 무료 진단 후 중복 설문 없이 Proof Board로 진입하고, 숫자 중심 결과 카드를 쌓는 흐름을 강화한다.

## Files

- `lib/proofRedaction.ts`
- `lib/analytics.ts`
- `lib/proofAuditLog.ts`
- `scripts/run-security-checks.mjs`
- `tests/**`

## Acceptance

- [ ] test:security 통과
- [ ] analytics allowlist
- [ ] raw source reason 필수

## Required tests

- [ ] `pnpm lint`
- [ ] `pnpm typecheck`
- [ ] `pnpm test`
- [ ] 관련 E2E/security/visual test 필요 여부 판단 및 실행

## Prompt

See `codex-prompts/AP-SMVP-012_security_privacy_hardening.md`.
