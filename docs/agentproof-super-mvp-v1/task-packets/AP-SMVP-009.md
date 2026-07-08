# Task Packet — AP-SMVP-009 — 10일 결과표 Scorecard / Conversion

## Objective

Report를 글 중심에서 숫자 scorecard 중심으로 바꾸고 월 19만 원 운영 전환 CTA를 report context와 연결한다.

## Context

이 작업은 AgentProof Super MVP v1 전환의 일부다. 무료 진단 후 중복 설문 없이 Proof Board로 진입하고, 숫자 중심 결과 카드를 쌓는 흐름을 강화한다.

## Files

- `app/proof/report/page.tsx`
- `components/proof/ProofPages.tsx`
- `lib/proofReport.ts`
- `lib/proofSubmission.ts`

## Acceptance

- [ ] 5개 숫자 첫 화면
- [ ] 가능/제외 범위 표시
- [ ] conversion payload context 포함

## Required tests

- [ ] `pnpm lint`
- [ ] `pnpm typecheck`
- [ ] `pnpm test`
- [ ] 관련 E2E/security/visual test 필요 여부 판단 및 실행

## Prompt

See `codex-prompts/AP-SMVP-009_report_scorecard_conversion.md`.
