# Task Packet — AP-SMVP-002 — Survey Result에서 Proof Board 바로 생성

## Objective

진단 결과 페이지의 CTA를 “10일 Proof Board 바로 만들기”로 바꾸고, 진단 결과 context로 WorkProfile/ProofProject/Board URL을 생성한다.

## Context

이 작업은 AgentProof Super MVP v1 전환의 일부다. 무료 진단 후 중복 설문 없이 Proof Board로 진입하고, 숫자 중심 결과 카드를 쌓는 흐름을 강화한다.

## Files

- `components/survey/SurveyResult.tsx`
- `lib/proof.ts`
- `lib/proofSubmission.ts`
- `supabase/functions/proof-submit/index.ts`
- `app/proof/board/page.tsx`

## Acceptance

- [ ] CTA 문구 변경
- [ ] 추가 설문 없음
- [ ] idempotencyKey 사용
- [ ] API 실패 시 sample board fallback

## Required tests

- [ ] `pnpm lint`
- [ ] `pnpm typecheck`
- [ ] `pnpm test`
- [ ] 관련 E2E/security/visual test 필요 여부 판단 및 실행

## Prompt

See `codex-prompts/AP-SMVP-002_survey_result_to_board.md`.
