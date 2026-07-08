# Task Packet — AP-SMVP-017 — Mobile Responsive Board

## Objective

320/375/768/1440에서 Proof Board가 가로 스크롤 없이 핵심 CTA와 결과 카드를 보여준다.

## Context

이 작업은 AgentProof Super MVP v1 전환의 일부다. 무료 진단 후 중복 설문 없이 Proof Board로 진입하고, 숫자 중심 결과 카드를 쌓는 흐름을 강화한다.

## Files

- `components/proof/ProofPages.tsx`
- `styles/proof.module.css`
- `tests/e2e/**`

## Acceptance

- [ ] 320px 가로 스크롤 없음
- [ ] KPI 2열 wrap
- [ ] 버튼 full-width
- [ ] card readability

## Required tests

- [ ] `pnpm lint`
- [ ] `pnpm typecheck`
- [ ] `pnpm test`
- [ ] 관련 E2E/security/visual test 필요 여부 판단 및 실행

## Prompt

See `codex-prompts/AP-SMVP-017_mobile_responsive_board.md`.
