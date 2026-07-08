# AgentProof Super MVP v1 — Codex 작업 문서 팩

작성일: 2026-07-07  
대상 저장소: `agentproofKR/agentproofKR.github.io`  
작업 원칙: **AgentProof 단독 분석/설계/구현. 다른 프로젝트 구조를 혼합하지 않는다.**

## 1. 이 문서 팩의 목적

이 문서 팩은 현재 AgentProof MVP를 **실제 서비스 가능한 Super MVP**로 개선하기 위한 Codex용 실행 지시서다. 목표는 단순 설명이 아니라 Codex가 바로 파일을 열고, 수정하고, 테스트하고, 검증할 수 있게 만드는 것이다.

## 2. 최종 제품 방향

AgentProof는 중소기업이 AI를 실제 업무에 써도 되는지 10일 동안 숫자로 증명하는 **AI 업무 검증 플랫폼**이다.

핵심 플로우는 다음 하나로 고정한다.

```txt
랜딩 → 무료 업무진단 → 진단 결과 → 10일 Proof Board 바로 생성 → 실제 업무 입력 → 결과 카드 → 사용 여부 피드백 → Proof Score/10일 결과표 → 월 19만 원 운영 전환 문의
```

## 3. 반드시 제거할 UX 문제

현재 10일 파일럿 내부에 `proofDesignQuestions` 기반 추가 설문 흐름이 있다. Super MVP에서는 필수 경로에서 제거한다.

```txt
금지: 진단 완료 후 또 업무 파악 설문을 요구한다.
허용: 진단 결과 기반으로 WorkProfile/WorkContract를 자동 생성하고, 고급 설정에서만 수정하게 한다.
```

## 4. Codex 문서 읽기 순서

1. `00_README_FOR_CODEX.md`
2. `01_PRODUCT_DEFINITION.md`
3. `02_CURRENT_SOURCE_AUDIT.md`
4. `03_SUPER_MVP_STRATEGY.md`
5. `04_USER_JOURNEY_AND_FUNNEL.md`
6. `05_INFORMATION_ARCHITECTURE_AND_ROUTES.md`
7. `06_REQUIREMENTS_MATRIX.md`
8. `07_FUNCTIONAL_SPEC.md`
9. `08~11_SCREEN_SPEC_*`
10. `12_BRAND_DESIGN_SYSTEM.md`
11. `13_UI_COMPONENT_SYSTEM.md`
12. `14_DATA_MODEL_SUPABASE.md`
13. `15_API_EDGE_FUNCTION_CONTRACTS.md`
14. `16_STATE_MACHINE_AND_SCORING.md`
15. `24_QA_TEST_STRATEGY.md`
16. `29_CODEX_EXECUTION_PROTOCOL.md`
17. `31_BACKLOG_TASK_PACKETS.md`
18. `codex-prompts/`의 해당 작업 프롬프트

## 5. 구현 전 반드시 확인할 현재 파일

| 영역 | 파일 |
|---|---|
| 랜딩/히어로 | `components/home/HomeHero.tsx`, `styles/landing.module.css` |
| 무료 진단 결과 | `app/survey/result/page.tsx`, `components/survey/SurveyResult.tsx` |
| Proof 제품 화면 | `app/proof/board/page.tsx`, `app/proof/dashboard/page.tsx`, `app/proof/report/page.tsx`, `components/proof/ProofPages.tsx` |
| Proof 도메인 | `lib/proof.ts`, `lib/proofCore.ts`, `lib/proofReport.ts`, `lib/proofRepository.ts`, `lib/proofSubmission.ts` |
| 접근/보안 | `lib/proofAuth.ts`, `lib/proofRedaction.ts`, `lib/proofAuditLog.ts`, `lib/proofUsageLimits.ts` |
| Edge Function | `supabase/functions/proof-submit/index.ts` |
| DB | `supabase/migrations/*.sql` |
| 테스트 | `tests/**`, `playwright.config.ts`, `scripts/run-security-checks.mjs` |

## 6. 완료 정의

어떤 작업도 아래가 되지 않으면 완료가 아니다.

- 사용자가 추가 설문 없이 Board까지 갈 수 있음
- 변경 화면이 숫자 중심으로 보임
- 개인정보/원문/토큰을 localStorage, analytics, log, bundle에 노출하지 않음
- `pnpm lint`, `pnpm typecheck`, `pnpm test` 통과
- 관련 E2E/security/content test 추가 또는 갱신
- 변경 내역과 리스크를 문서/PR 설명에 기록


## Codex 실행 프롬프트

```text
당신은 agentproofKR/agentproofKR.github.io 저장소만 작업한다. 다른 프로젝트 구조나 다른 저장소 개념을 섞지 않는다.
작업 전 이 문서와 docs/agentproof-super-mvp-v1/00_README_FOR_CODEX.md를 읽고, 관련 현재 파일을 직접 확인한다.
변경은 작은 단위로 수행하고, TypeScript strict, 개인정보/토큰 비노출, 한국어 UI, 320px 이상 가로 스크롤 금지를 유지한다.
작업 후 pnpm lint, pnpm typecheck, pnpm test, 관련 Playwright/E2E 또는 security test를 실행하고 실패를 수정한다.
```
