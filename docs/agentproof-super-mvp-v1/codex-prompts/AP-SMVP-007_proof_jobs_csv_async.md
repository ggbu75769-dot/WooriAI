# AP-SMVP-007 — CSV/XLSX 비동기 Job 처리

## 목표

CSV/XLSX 업로드를 proof_jobs/proof_job_items 기반 비동기 처리로 전환한다.

## 작업 전 읽을 문서

- `docs/agentproof-super-mvp-v1/00_README_FOR_CODEX.md`
- `docs/agentproof-super-mvp-v1/31_BACKLOG_TASK_PACKETS.md`
- 이 task와 관련된 화면/기능 문서

## 주요 파일

- `supabase/migrations/**`
- `supabase/functions/proof-submit/index.ts`
- `lib/proofSubmission.ts`
- `components/proof/ProofPages.tsx`
- `lib/proofFile.ts`

## 구현 지시

1. 위 파일들을 직접 열어 현재 구현을 확인한다.
2. 기존 survey/privacy/storage 동작을 깨지 않는다.
3. 변경 범위를 이 task에 필요한 파일로 제한한다.
4. 사용자 화면은 한국어와 쉬운 용어를 유지한다.
5. 개인정보/토큰/원문 노출 가능성이 생기면 즉시 차단한다.

## 수용 기준

- job status 반환
- row partial failure 허용
- 50행 timeout 방지
- progress UI

## 테스트

```bash
pnpm lint
pnpm typecheck
pnpm test
```

UI 변경이면 관련 Playwright/E2E 또는 visual assertion을 추가하고 실행한다. 보안/토큰/개인정보 변경이면 `pnpm test:security`도 실행한다.

## Codex에게 붙여넣을 프롬프트

```text
AP-SMVP-007 — CSV/XLSX 비동기 Job 처리 작업을 수행해줘.
대상 저장소는 agentproofKR/agentproofKR.github.io 하나뿐이다.
목표: CSV/XLSX 업로드를 proof_jobs/proof_job_items 기반 비동기 처리로 전환한다.

주요 파일:
supabase/migrations/**
supabase/functions/proof-submit/index.ts
lib/proofSubmission.ts
components/proof/ProofPages.tsx
lib/proofFile.ts

수용 기준:
- job status 반환
- row partial failure 허용
- 50행 timeout 방지
- progress UI

공통 규칙:

공통 규칙:
- 현재 파일을 직접 열어 확인한 뒤 수정한다.
- 다른 프로젝트 패턴을 가져오지 않는다.
- TypeScript strict를 유지한다.
- 사용자 화면 용어는 업무/파일럿 보드/결과 카드/사용 여부/주의표현/사람 확인 필요를 우선한다.
- 테스트 없이 완료 보고하지 않는다.


작업 후 변경 파일, 실행한 테스트, 통과/실패, 남은 리스크를 보고해줘.
```
