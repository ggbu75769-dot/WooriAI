# Task Packet — AP-SMVP-007 — CSV/XLSX 비동기 Job 처리

## Objective

CSV/XLSX 업로드를 proof_jobs/proof_job_items 기반 비동기 처리로 전환한다.

## Context

이 작업은 AgentProof Super MVP v1 전환의 일부다. 무료 진단 후 중복 설문 없이 Proof Board로 진입하고, 숫자 중심 결과 카드를 쌓는 흐름을 강화한다.

## Files

- `supabase/migrations/**`
- `supabase/functions/proof-submit/index.ts`
- `lib/proofSubmission.ts`
- `components/proof/ProofPages.tsx`
- `lib/proofFile.ts`

## Acceptance

- [ ] job status 반환
- [ ] row partial failure 허용
- [ ] 50행 timeout 방지
- [ ] progress UI

## Required tests

- [ ] `pnpm lint`
- [ ] `pnpm typecheck`
- [ ] `pnpm test`
- [ ] 관련 E2E/security/visual test 필요 여부 판단 및 실행

## Prompt

See `codex-prompts/AP-SMVP-007_proof_jobs_csv_async.md`.
