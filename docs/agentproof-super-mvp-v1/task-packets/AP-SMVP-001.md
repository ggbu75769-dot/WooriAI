# Task Packet — AP-SMVP-001 — 중복 파일럿 설문 필수 경로 제거

## Objective

무료 진단 후 `/proof/pilot-design/questions`를 필수로 거치지 않게 만들고, questions route는 고급 설정/legacy route로만 유지한다.

## Context

이 작업은 AgentProof Super MVP v1 전환의 일부다. 무료 진단 후 중복 설문 없이 Proof Board로 진입하고, 숫자 중심 결과 카드를 쌓는 흐름을 강화한다.

## Files

- `components/proof/ProofPages.tsx`
- `app/proof/pilot-design/start/page.tsx`
- `app/proof/pilot-design/questions/page.tsx`
- `lib/proof.ts`
- `tests/**`

## Acceptance

- [ ] survey result CTA에서 questions로 가지 않는 E2E 추가
- [ ] questions route 직접 접근 시 고급 설정 또는 안내 표시
- [ ] 기존 저장 payload contract는 깨지지 않음

## Required tests

- [ ] `pnpm lint`
- [ ] `pnpm typecheck`
- [ ] `pnpm test`
- [ ] 관련 E2E/security/visual test 필요 여부 판단 및 실행

## Prompt

See `codex-prompts/AP-SMVP-001_remove_duplicate_survey.md`.
