# Task Packet — AP-SMVP-014 — QA/E2E/Visual Regression

## Objective

Super MVP 핵심 플로우와 UI 회귀 테스트를 추가한다.

## Context

이 작업은 AgentProof Super MVP v1 전환의 일부다. 무료 진단 후 중복 설문 없이 Proof Board로 진입하고, 숫자 중심 결과 카드를 쌓는 흐름을 강화한다.

## Files

- `tests/**`
- `playwright.config.ts`
- `scripts/generate-qa-artifacts.mjs`

## Acceptance

- [ ] 중복 설문 제거 E2E
- [ ] board result card E2E
- [ ] report guard E2E
- [ ] mobile visual check

## Required tests

- [ ] `pnpm lint`
- [ ] `pnpm typecheck`
- [ ] `pnpm test`
- [ ] 관련 E2E/security/visual test 필요 여부 판단 및 실행

## Prompt

See `codex-prompts/AP-SMVP-014_tests_visual_e2e.md`.
