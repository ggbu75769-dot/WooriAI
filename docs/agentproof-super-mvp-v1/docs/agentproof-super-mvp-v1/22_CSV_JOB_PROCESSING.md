# 22. CSV/XLSX 비동기 Job 설계서

## 1. 문제

P0는 CSV/XLSX 5MB/50행을 지원한다. 동기 Edge 처리로 모든 행을 LLM 처리하면 timeout과 사용자 이탈이 발생할 수 있다.

## 2. 목표

- 업로드 즉시 job 생성.
- row 단위로 처리.
- job status polling.
- 부분 실패 허용.
- completed rows는 result card로 즉시 표시.

## 3. Job flow

```txt
파일 업로드
→ 파일 parse
→ proof_jobs 생성
→ proof_job_items 생성
→ queued response 반환
→ worker/polling 처리
→ row별 proof_case/result_card 생성
→ job status completed/failed
```

## 4. User UI

```txt
CSV 32행을 처리 중입니다.
12개 완료 · 1개 차단 · 19개 대기
완료된 결과 카드는 아래에서 바로 볼 수 있습니다.
```

## 5. Error codes

- unsupported_file_type
- file_too_large
- missing_required_column
- too_many_rows
- empty_file
- row_parse_failed
- provider_timeout
- pii_blocked

## 6. Acceptance

- 50행 upload가 Edge timeout 없이 job status를 반환한다.
- 실패 row가 있어도 성공 row 결과 카드가 생성된다.
- job progress가 Board에 표시된다.
- raw file delete_after_parse evidence가 남는다.


## Codex 실행 프롬프트

```text
당신은 agentproofKR/agentproofKR.github.io 저장소만 작업한다. 다른 프로젝트 구조나 다른 저장소 개념을 섞지 않는다.
작업 전 이 문서와 docs/agentproof-super-mvp-v1/00_README_FOR_CODEX.md를 읽고, 관련 현재 파일을 직접 확인한다.
변경은 작은 단위로 수행하고, TypeScript strict, 개인정보/토큰 비노출, 한국어 UI, 320px 이상 가로 스크롤 금지를 유지한다.
작업 후 pnpm lint, pnpm typecheck, pnpm test, 관련 Playwright/E2E 또는 security test를 실행하고 실패를 수정한다.
```
