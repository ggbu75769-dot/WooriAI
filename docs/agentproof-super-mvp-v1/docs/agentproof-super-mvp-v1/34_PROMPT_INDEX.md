# 34. Prompt Index

Codex prompt는 `codex-prompts/` 폴더에 있다.

## 시작 프롬프트

- `PROMPT_00_READ_FIRST.md`

## Task prompts

- `AP-SMVP-001_remove_duplicate_survey.md`
- `AP-SMVP-002_survey_result_to_board.md`
- `AP-SMVP-003_board_kpi_redesign.md`
- `AP-SMVP-004_result_card_redesign.md`
- `AP-SMVP-005_proof_summary_endpoint.md`
- `AP-SMVP-006_supabase_first_repository.md`
- `AP-SMVP-007_proof_jobs_csv_async.md`
- `AP-SMVP-008_score_verdict_dashboard.md`
- `AP-SMVP-009_report_scorecard_conversion.md`
- `AP-SMVP-010_access_token_exchange.md`
- `AP-SMVP-011_admin_publish_flow.md`
- `AP-SMVP-012_security_privacy_hardening.md`
- `AP-SMVP-013_analytics_funnel.md`
- `AP-SMVP-014_tests_visual_e2e.md`
- `AP-SMVP-015_brand_design_system_apply.md`
- `AP-SMVP-016_llm_gateway_eval_guardrails.md`
- `AP-SMVP-017_mobile_responsive_board.md`
- `AP-SMVP-018_release_verification.md`

## 사용법

1. `PROMPT_00_READ_FIRST.md`를 Codex 세션 시작에 붙여넣는다.
2. 작업할 task prompt 하나만 추가로 붙여넣는다.
3. 한 번에 여러 task를 섞지 않는다.
4. task 완료 후 테스트 결과와 변경 파일을 보고받는다.

## Codex 실행 프롬프트

```text
당신은 agentproofKR/agentproofKR.github.io 저장소만 작업한다. 다른 프로젝트 구조나 다른 저장소 개념을 섞지 않는다.
작업 전 이 문서와 docs/agentproof-super-mvp-v1/00_README_FOR_CODEX.md를 읽고, 관련 현재 파일을 직접 확인한다.
변경은 작은 단위로 수행하고, TypeScript strict, 개인정보/토큰 비노출, 한국어 UI, 320px 이상 가로 스크롤 금지를 유지한다.
작업 후 pnpm lint, pnpm typecheck, pnpm test, 관련 Playwright/E2E 또는 security test를 실행하고 실패를 수정한다.
```
