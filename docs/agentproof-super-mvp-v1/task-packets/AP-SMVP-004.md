# Task Packet — AP-SMVP-004 — Result Card 재디자인

## Objective

ResultCard를 요약/초안/누락정보/주의표현/사람확인/4버튼 액션이 한눈에 보이는 구조로 바꾼다.

## Context

이 작업은 AgentProof Super MVP v1 전환의 일부다. 무료 진단 후 중복 설문 없이 Proof Board로 진입하고, 숫자 중심 결과 카드를 쌓는 흐름을 강화한다.

## Files

- `components/proof/ProofPages.tsx`
- `styles/proof.module.css`
- `lib/proof.ts`
- `tests/**`

## Acceptance

- [ ] 위험 chip 표시
- [ ] blocked copy 정책
- [ ] 4버튼 키보드 접근
- [ ] feedback 저장

## Required tests

- [ ] `pnpm lint`
- [ ] `pnpm typecheck`
- [ ] `pnpm test`
- [ ] 관련 E2E/security/visual test 필요 여부 판단 및 실행

## Prompt

See `codex-prompts/AP-SMVP-004_result_card_redesign.md`.
