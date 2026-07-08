# Task Packet — AP-SMVP-013 — Analytics Funnel 이벤트

## Objective

Survey → Board → Card → Feedback → Report → Conversion 퍼널 이벤트를 비식별로 추가한다.

## Context

이 작업은 AgentProof Super MVP v1 전환의 일부다. 무료 진단 후 중복 설문 없이 Proof Board로 진입하고, 숫자 중심 결과 카드를 쌓는 흐름을 강화한다.

## Files

- `lib/analytics.ts`
- `lib/proof.ts`
- `components/proof/ProofPages.tsx`
- `components/survey/SurveyResult.tsx`

## Acceptance

- [ ] 금지 metadata 없음
- [ ] event taxonomy test
- [ ] funnel 계산 가능

## Required tests

- [ ] `pnpm lint`
- [ ] `pnpm typecheck`
- [ ] `pnpm test`
- [ ] 관련 E2E/security/visual test 필요 여부 판단 및 실행

## Prompt

See `codex-prompts/AP-SMVP-013_analytics_funnel.md`.
