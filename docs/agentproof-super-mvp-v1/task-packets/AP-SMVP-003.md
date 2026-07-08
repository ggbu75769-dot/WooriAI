# Task Packet — AP-SMVP-003 — Board KPI Strip 재설계

## Objective

Proof Board 상단에 Proof Score, 처리, 사용률, 절감, 위험, 사람 확인, 신뢰도를 숫자 카드로 표시한다.

## Context

이 작업은 AgentProof Super MVP v1 전환의 일부다. 무료 진단 후 중복 설문 없이 Proof Board로 진입하고, 숫자 중심 결과 카드를 쌓는 흐름을 강화한다.

## Files

- `components/proof/ProofPages.tsx`
- `styles/proof.module.css`
- `lib/proof.ts`

## Acceptance

- [ ] 모바일 2열 wrap
- [ ] 가로 스크롤 없음
- [ ] metrics가 feedback 후 갱신

## Required tests

- [ ] `pnpm lint`
- [ ] `pnpm typecheck`
- [ ] `pnpm test`
- [ ] 관련 E2E/security/visual test 필요 여부 판단 및 실행

## Prompt

See `codex-prompts/AP-SMVP-003_board_kpi_redesign.md`.
