# 우리아이 전체 문서 + Codex 실행 패키지 v0.5

생성일: 2026-07-06

이 ZIP은 지금까지 생성한 우리아이 프로젝트 문서를 단계별 폴더로 정리한 인수인계 패키지입니다.

## 폴더 구조

```text
wooriai_handoff_package_v0_5/
├─ README.md
├─ AGENTS.md
├─ CODEX_START_HERE.md
├─ MANIFEST.csv
├─ codex/
│  ├─ CODEX_START_PROMPT.md
│  ├─ EXECUTION_ORDER.md
│  └─ HANDOFF_RULES.md
└─ docs/
   ├─ 0_원본아이디어/
   ├─ 1차/
   ├─ 2차/
   ├─ 3차/
   └─ 4차/
```

## 단계별 사용법

- `docs/1차`: 서비스 개요서, PRD, MVP 범위, 기능 목록, 비즈니스 룰
- `docs/2차`: 사용자 흐름, 화면 목록, 화면정의, 화면 상태, UI 프롬프트, 디자인 시스템
- `docs/3차`: 데이터 모델, DB/API, 인증/권한, 폴더 구조, 상태관리, 컴포넌트
- `docs/4차`: Codex Master Instruction, Implementation Plan, Task Breakdown, Do Not Change, Acceptance Criteria, QA Runbook, Release Checklist

## Codex 시작법

Codex에게는 우선 `CODEX_START_HERE.md` 또는 `codex/CODEX_START_PROMPT.md`를 그대로 제공하세요. Codex는 `docs/4차/prompts/`의 프롬프트를 읽고 Batch 순서대로 진행하도록 설계했습니다.

## 문서 우선순위

1. `docs/4차/prompts/04_do_not_change_v0_4.md`
2. `docs/4차/contracts/do_not_change_contract_v0_4.yaml`
3. `docs/4차/prompts/05_acceptance_criteria_v0_4.md`
4. `docs/3차/db_api/wooriai_phase3_openapi_v0_3.yaml` 및 `wooriai_phase3_schema_v0_3.sql`
5. `docs/3차/개발고정_문서/wooriai_phase3_dev_fixed_docs_v0_3.docx`
6. `docs/2차/화면고정_문서/wooriai_phase2_screen_design_docs_v0_2.docx`
7. `docs/1차/제품기획_문서/wooriai_product_docs_v0_1.docx`
8. `docs/0_원본아이디어/아이_가계부_어플_설계.txt`

## 구현 원칙

- Batch 00 Source Lock 산출물은 `docs/dev/source-lock.md`와 `docs/dev/do-not-change.md`입니다.
- 기능 구현 전에는 `docs/dev/source-lock.md`에서 현재 repo 상태, 고정 화면 ID, DB/API 계약, 누락된 bootstrap 파일 목록을 확인합니다.
- Do Not Change 계약은 `docs/dev/do-not-change.md`를 repo-local 기준으로 사용합니다.
- Batch 순서는 `docs/4차/prompts/08_codex_iteration_prompts_v0_4.md`를 따르고, 다음 Batch 범위의 기능을 미리 구현하지 않습니다.
- 제품 본질은 `지출 기록 -> 총액 확인 -> 시기별 준비템 확인 -> 구매 링크 클릭 -> 구매 후 기록/상태 체크`입니다.

## 검수

전체 파일 목록과 해시값은 `MANIFEST.csv`와 `MANIFEST.json`에서 확인할 수 있습니다.
