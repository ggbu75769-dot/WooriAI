# Task Packet — AP-SMVP-011 — Admin Report Publish Flow

## Objective

admin reports 화면에서 draft/review/published/recheck 상태를 명확하게 관리한다.

## Context

이 작업은 AgentProof Super MVP v1 전환의 일부다. 무료 진단 후 중복 설문 없이 Proof Board로 진입하고, 숫자 중심 결과 카드를 쌓는 흐름을 강화한다.

## Files

- `app/admin/reports/page.tsx`
- `components/proof/ProofPages.tsx`
- `lib/proofSubmission.ts`
- `supabase/functions/proof-submit/index.ts`

## Acceptance

- [ ] publish 전 공개 차단
- [ ] admin mutation audit
- [ ] recheck_needed 처리

## Required tests

- [ ] `pnpm lint`
- [ ] `pnpm typecheck`
- [ ] `pnpm test`
- [ ] 관련 E2E/security/visual test 필요 여부 판단 및 실행

## Prompt

See `codex-prompts/AP-SMVP-011_admin_publish_flow.md`.
