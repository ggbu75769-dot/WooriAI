# 19. 1000명 사용 가능 설계서

## 1. 운영 목표

| 항목 | 목표 |
|---|---:|
| 방문/가입 사용자 | 1000명 |
| 동시 활성 사용자 | 50명 |
| 활성 Proof Project | 300개 |
| Project당 참여자 | 3명 |
| Project당 기본 입력 | 50건 |
| 총 Proof Case | 15,000~50,000건 |
| 단건 응답 | P95 10초 이하 |
| CSV 50행 처리 | 3분 이하 |

## 2. 병목 예상

| 병목 | 해결 |
|---|---|
| Edge Function 동기 CSV 처리 | proof_jobs 비동기 처리 |
| dashboard/report 매번 client 계산 | summary endpoint/read model |
| localStorage state drift | Supabase-first |
| token URL 장기 노출 | exchange/expiry/scope |
| LLM provider latency/failure | provider fallback/routing |
| Postgres slow query | indexes |

## 3. Rate limit

| 대상 | 제한 |
|---|---:|
| IP | 60 req/min |
| Project text intake | 30/min |
| Project CSV upload | 5/day |
| Free proof case | 50 |
| Paid single workflow | 500/month |
| File | 5MB |
| CSV row | 50 P0, 500 paid P1 |

## 4. Scaling sequence

### Step 1

- Supabase-first summary read.
- Indexes 추가.
- CSV job table 추가.

### Step 2

- Background job processing.
- Job status polling.
- Provider timeout/fallback.

### Step 3

- Paid tier case limit 확장.
- materialized summary table or scheduled refresh.
- alerting dashboard.

## 5. Failure policy

- Provider 실패 시 fallback provider.
- 모든 provider 실패 시 deterministic result card로 최소 결과 제공.
- CSV job item 실패는 전체 job 실패로 만들지 않는다.
- user-facing error는 재시도 가능/불가능을 분리한다.


## Codex 실행 프롬프트

```text
당신은 agentproofKR/agentproofKR.github.io 저장소만 작업한다. 다른 프로젝트 구조나 다른 저장소 개념을 섞지 않는다.
작업 전 이 문서와 docs/agentproof-super-mvp-v1/00_README_FOR_CODEX.md를 읽고, 관련 현재 파일을 직접 확인한다.
변경은 작은 단위로 수행하고, TypeScript strict, 개인정보/토큰 비노출, 한국어 UI, 320px 이상 가로 스크롤 금지를 유지한다.
작업 후 pnpm lint, pnpm typecheck, pnpm test, 관련 Playwright/E2E 또는 security test를 실행하고 실패를 수정한다.
```
