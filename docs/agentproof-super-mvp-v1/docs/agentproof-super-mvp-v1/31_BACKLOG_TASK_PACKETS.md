# 31. Backlog / Task Packets

## Epic 1 — 중복 설문 제거와 Board 직행

| ID | 작업 | Prompt file |
|---|---|---|
| AP-SMVP-001 | pilot design questions 필수 경로 제거 | `codex-prompts/AP-SMVP-001_remove_duplicate_survey.md` |
| AP-SMVP-002 | survey result에서 Proof Board 생성 | `codex-prompts/AP-SMVP-002_survey_result_to_board.md` |

## Epic 2 — Proof Board Super MVP UI

| ID | 작업 | Prompt file |
|---|---|---|
| AP-SMVP-003 | Board KPI redesign | `codex-prompts/AP-SMVP-003_board_kpi_redesign.md` |
| AP-SMVP-004 | Result Card redesign | `codex-prompts/AP-SMVP-004_result_card_redesign.md` |
| AP-SMVP-017 | Mobile responsive board | `codex-prompts/AP-SMVP-017_mobile_responsive_board.md` |

## Epic 3 — Supabase-first / 1000명 운영

| ID | 작업 | Prompt file |
|---|---|---|
| AP-SMVP-005 | project summary endpoint | `codex-prompts/AP-SMVP-005_proof_summary_endpoint.md` |
| AP-SMVP-006 | Supabase-first repository | `codex-prompts/AP-SMVP-006_supabase_first_repository.md` |
| AP-SMVP-007 | CSV async jobs | `codex-prompts/AP-SMVP-007_proof_jobs_csv_async.md` |
| AP-SMVP-010 | access token exchange | `codex-prompts/AP-SMVP-010_access_token_exchange.md` |

## Epic 4 — Score / Report / Conversion

| ID | 작업 | Prompt file |
|---|---|---|
| AP-SMVP-008 | ProofScore dashboard | `codex-prompts/AP-SMVP-008_score_verdict_dashboard.md` |
| AP-SMVP-009 | Report scorecard conversion | `codex-prompts/AP-SMVP-009_report_scorecard_conversion.md` |
| AP-SMVP-011 | Admin report publish flow | `codex-prompts/AP-SMVP-011_admin_publish_flow.md` |

## Epic 5 — Safety / Analytics / Release

| ID | 작업 | Prompt file |
|---|---|---|
| AP-SMVP-012 | security/privacy hardening | `codex-prompts/AP-SMVP-012_security_privacy_hardening.md` |
| AP-SMVP-013 | analytics funnel | `codex-prompts/AP-SMVP-013_analytics_funnel.md` |
| AP-SMVP-014 | QA/E2E/visual tests | `codex-prompts/AP-SMVP-014_tests_visual_e2e.md` |
| AP-SMVP-015 | brand design application | `codex-prompts/AP-SMVP-015_brand_design_system_apply.md` |
| AP-SMVP-016 | LLM gateway eval guardrails | `codex-prompts/AP-SMVP-016_llm_gateway_eval_guardrails.md` |
| AP-SMVP-018 | release verification | `codex-prompts/AP-SMVP-018_release_verification.md` |

## 권장 실행 순서

```txt
001 → 002 → 003 → 004 → 008 → 009 → 005 → 006 → 007 → 010 → 011 → 012 → 013 → 014 → 015 → 017 → 016 → 018
```


## Codex 실행 프롬프트

```text
당신은 agentproofKR/agentproofKR.github.io 저장소만 작업한다. 다른 프로젝트 구조나 다른 저장소 개념을 섞지 않는다.
작업 전 이 문서와 docs/agentproof-super-mvp-v1/00_README_FOR_CODEX.md를 읽고, 관련 현재 파일을 직접 확인한다.
변경은 작은 단위로 수행하고, TypeScript strict, 개인정보/토큰 비노출, 한국어 UI, 320px 이상 가로 스크롤 금지를 유지한다.
작업 후 pnpm lint, pnpm typecheck, pnpm test, 관련 Playwright/E2E 또는 security test를 실행하고 실패를 수정한다.
```
