# Task Packet — AP-SMVP-015 — 브랜드 디자인 시스템 적용

## Objective

AgentProof 브랜드 토큰과 숫자 중심 UI를 landing/board/dashboard/report에 적용한다.

## Context

이 작업은 AgentProof Super MVP v1 전환의 일부다. 무료 진단 후 중복 설문 없이 Proof Board로 진입하고, 숫자 중심 결과 카드를 쌓는 흐름을 강화한다.

## Files

- `app/globals.css`
- `styles/proof.module.css`
- `styles/landing.module.css`
- `components/home/HomeHero.tsx`
- `components/proof/ProofPages.tsx`

## Acceptance

- [ ] color tokens
- [ ] metric cards
- [ ] Toss급 간결한 CTA
- [ ] 모바일 반응형

## Required tests

- [ ] `pnpm lint`
- [ ] `pnpm typecheck`
- [ ] `pnpm test`
- [ ] 관련 E2E/security/visual test 필요 여부 판단 및 실행

## Prompt

See `codex-prompts/AP-SMVP-015_brand_design_system_apply.md`.
