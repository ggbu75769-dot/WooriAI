# 26. Migration / Rollout Plan

## 1. 목표

기존 v0.5~v0.8.6 기능을 깨지 않고 Super MVP로 전환한다.

## 2. 단계

### Phase A — UX redirect

- survey result CTA 변경
- pilot design questions 필수 제거
- start route를 board creation screen으로 변경
- legacy URL 유지

### Phase B — Board redesign

- KPI strip
- ResultCard redesign
- feedback buttons
- empty state
- mobile layout

### Phase C — Data source

- summary endpoint
- repository read model
- localStorage fallback only
- idempotent create board

### Phase D — Scalability

- proof_jobs tables
- indexes
- job status UI
- rate limit

### Phase E — Report/conversion

- visual scorecard
- report publish guard
- conversion context
- admin review flow

## 3. Feature flags

| flag | 목적 |
|---|---|
| `AP_SUPER_MVP_BOARD_FLOW` | survey result → board 바로 생성 |
| `AP_SUPER_MVP_SUMMARY_API` | Supabase summary hydration |
| `AP_SUPER_MVP_ASYNC_CSV` | CSV job flow |
| `AP_SUPER_MVP_REPORT_V2` | visual report |

## 4. Rollout

1. local sample mode
2. staging Supabase
3. 1 internal project
4. 3 pilot companies
5. public CTA 10%
6. public CTA 100%

## 5. 데이터 호환성

- 기존 `pilot_design_sessions` 유지.
- 기존 `work_profiles` 유지.
- 새로운 board creation은 기존 table을 재사용하되 `source='survey_result'` metadata 추가 권장.
- questions route로 만든 project도 Board에서 정상 표시.


## Codex 실행 프롬프트

```text
당신은 agentproofKR/agentproofKR.github.io 저장소만 작업한다. 다른 프로젝트 구조나 다른 저장소 개념을 섞지 않는다.
작업 전 이 문서와 docs/agentproof-super-mvp-v1/00_README_FOR_CODEX.md를 읽고, 관련 현재 파일을 직접 확인한다.
변경은 작은 단위로 수행하고, TypeScript strict, 개인정보/토큰 비노출, 한국어 UI, 320px 이상 가로 스크롤 금지를 유지한다.
작업 후 pnpm lint, pnpm typecheck, pnpm test, 관련 Playwright/E2E 또는 security test를 실행하고 실패를 수정한다.
```
