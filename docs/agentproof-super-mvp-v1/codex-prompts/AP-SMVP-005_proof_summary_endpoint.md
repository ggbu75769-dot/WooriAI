# AP-SMVP-005 — Proof Project Summary Endpoint

## 목표

Board/Dashboard/Report가 Supabase source of truth에서 요약 데이터를 읽도록 `proof_project_summary` contract를 추가한다.

## 작업 전 읽을 문서

- `docs/agentproof-super-mvp-v1/00_README_FOR_CODEX.md`
- `docs/agentproof-super-mvp-v1/31_BACKLOG_TASK_PACKETS.md`
- 이 task와 관련된 화면/기능 문서

## 주요 파일

- `lib/proofSubmission.ts`
- `supabase/functions/proof-submit/index.ts`
- `lib/proofRepository.ts`
- `tests/unit/proof-edge-contract.test.ts`

## 구현 지시

1. 위 파일들을 직접 열어 현재 구현을 확인한다.
2. 기존 survey/privacy/storage 동작을 깨지 않는다.
3. 변경 범위를 이 task에 필요한 파일로 제한한다.
4. 사용자 화면은 한국어와 쉬운 용어를 유지한다.
5. 개인정보/토큰/원문 노출 가능성이 생기면 즉시 차단한다.

## 수용 기준

- summary DTO 반환
- project token 검증
- sample/blocked/cross-project 제외

## 테스트

```bash
pnpm lint
pnpm typecheck
pnpm test
```

UI 변경이면 관련 Playwright/E2E 또는 visual assertion을 추가하고 실행한다. 보안/토큰/개인정보 변경이면 `pnpm test:security`도 실행한다.

## Codex에게 붙여넣을 프롬프트

```text
AP-SMVP-005 — Proof Project Summary Endpoint 작업을 수행해줘.
대상 저장소는 agentproofKR/agentproofKR.github.io 하나뿐이다.
목표: Board/Dashboard/Report가 Supabase source of truth에서 요약 데이터를 읽도록 `proof_project_summary` contract를 추가한다.

주요 파일:
lib/proofSubmission.ts
supabase/functions/proof-submit/index.ts
lib/proofRepository.ts
tests/unit/proof-edge-contract.test.ts

수용 기준:
- summary DTO 반환
- project token 검증
- sample/blocked/cross-project 제외

공통 규칙:

공통 규칙:
- 현재 파일을 직접 열어 확인한 뒤 수정한다.
- 다른 프로젝트 패턴을 가져오지 않는다.
- TypeScript strict를 유지한다.
- 사용자 화면 용어는 업무/파일럿 보드/결과 카드/사용 여부/주의표현/사람 확인 필요를 우선한다.
- 테스트 없이 완료 보고하지 않는다.


작업 후 변경 파일, 실행한 테스트, 통과/실패, 남은 리스크를 보고해줘.
```
