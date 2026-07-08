# Task Packet — AP-SMVP-008 — ProofScore/Verdict Dashboard 연결

## Objective

proofCore의 ProofScore/Verdict를 Evidence Dashboard와 Board summary에 연결한다.

## Context

이 작업은 AgentProof Super MVP v1 전환의 일부다. 무료 진단 후 중복 설문 없이 Proof Board로 진입하고, 숫자 중심 결과 카드를 쌓는 흐름을 강화한다.

## Files

- `lib/proofCore.ts`
- `lib/proofReport.ts`
- `components/proof/ProofPages.tsx`
- `app/proof/dashboard/page.tsx`

## Acceptance

- [ ] 0~100 score 표시
- [ ] verdict badge
- [ ] 점수 breakdown
- [ ] data 부족 표시

## Required tests

- [ ] `pnpm lint`
- [ ] `pnpm typecheck`
- [ ] `pnpm test`
- [ ] 관련 E2E/security/visual test 필요 여부 판단 및 실행

## Prompt

See `codex-prompts/AP-SMVP-008_score_verdict_dashboard.md`.
