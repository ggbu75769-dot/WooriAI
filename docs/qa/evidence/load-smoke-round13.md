# PERF-114: 부하 스모크 라운드 13 — 시나리오 확장 + p50/p95 실측

- 측정일: 2026-08-21
- 스크립트: `scripts/qa/load-smoke.mjs` (이번 라운드에서 확장 — 아래 "추가 시나리오" 참고)
- 파라미터: 시나리오별 N=200, 동시성 10, 워밍업 10회(통계 제외)
- 기준선: `docs/qa/load-smoke-results.md` (2026-08-21, 동일 환경·동일 파라미터)

## 추가 시나리오 (이번 라운드 신규)

| 시나리오 | 인증 | 비고 |
|---|---|---|
| `GET /sync/changes?limit=100` | JWT | 델타 동기화 전체 창(커서 없음) 반복 — 클라이언트 첫 동기화와 동일 형태 |
| `GET /health/push` | 무인증 | PUSH-113 관측성 (항상 200) |
| `GET /health/worker` | 무인증 | INF-007 워커 관측성 (항상 200) |
| `GET /admin/audit-logs?limit=50` | x-admin-token | ADM-113 감사로그 목록. **dev/test 전용 레거시 `x-admin-token` 폴백**(AdminTokenGuard, 기본 `dev-admin-token`, `LOAD_ADMIN_TOKEN`으로 지정)으로 인증 — 쿠키 세션 + TOTP MFA 실플로우는 부하 스크립트 범위 밖(admin-e2e.mjs 소관)이라 채택하지 않았고, 폴백이 거부되는 환경에선 프로브 후 사유를 남기고 자동 스킵 |

`GET /home?childId=` 반복은 기존 1번 시나리오 그대로 유지(중복 추가 없음). 기존 p50/p95/p99/max/req/s/429/err 리포트 형식 그대로.

## 측정 환경 / 실행 조건

| 항목 | 값 |
|---|---|
| 실행 환경 | 개발 컨테이너 (x86_64, 4 vCPU), Node v22.22.2 |
| API 서버 | `tsx src/main.ts` dev 모드 (NODE_ENV=development, WORKER_ENABLED=1 — 프로덕션 빌드 아님) |
| 서버 인스턴스 | **전용 포트 3450**, `RATE_LIMIT_GLOBAL_MAX=100000 RATE_LIMIT_AUTH_MAX=1000` |
| DB | 로컬 PostgreSQL 16.13, `wooriai_dev` |
| 네트워크 | localhost 루프백 |
| 데이터 정합 | 측정 전 이전 라운드들이 남긴 `load-smoke` 지출 잔여물 1,448행을 정리해 기준선과 같은 시드 수준(해당 child 지출 2행)에서 측정. 이번 실행 생성분 210행은 스크립트가 전부 DELETE로 자체 정리(210/210) |
| 동시 부하 | 측정 중 같은 컨테이너에서 다른 에이전트의 `pnpm --filter api test`(vitest)가 병행 실행 중이었음 (load avg ≈ 1.1~1.6). 수치가 약간 보수적으로(느리게) 나왔을 수 있으나 전 시나리오가 기준선보다 빨라 결론에는 영향 없음 |

> 지시서는 공용 dev 서버(3400)를 그대로 겨냥하도록 했으나, 3400은 전역 레이트리밋 기본값
> 300req/min이라 본 부하(총 2,100+ 요청/수 분)만으로 429가 대량 발생해 분포가 오염된다.
> 기준선 문서의 재실행 절차와 동일하게 **전용 3450 인스턴스**(레이트리밋 상향)로 측정했고,
> 3400 공용 서버는 손대지 않았다. 측정 종료 후 3450 인스턴스는 종료 완료.

## 결과 (2xx 응답 기준, ms)

| 시나리오 | n | p50 | p95 | p99 | max | req/s | 429 | err |
|---|---|---|---|---|---|---|---|---|
| GET /home?childId= | 200 | 68.9 | 92.4 | 115.7 | 117.2 | 140.7 | 0 | 0 |
| GET /children/:id/expenses | 200 | 25.7 | 36.7 | 44.7 | 47.1 | 367.8 | 0 | 0 |
| GET /children/:id/items?tab=now | 200 | 48.5 | 69.9 | 81.7 | 83.6 | 198.0 | 0 | 0 |
| GET /children/:id/reports/monthly | 200 | 26.8 | 35.0 | 37.0 | 38.2 | 358.2 | 0 | 0 |
| POST /children/:id/expenses | 200 | 41.9 | 59.7 | 74.1 | 76.2 | 229.4 | 0 | 0 |
| GET /sync/changes *(신규)* | 200 | 39.3 | 51.4 | 57.8 | 60.3 | 248.5 | 0 | 0 |
| GET /health/ready | 200 | 7.0 | 13.6 | 17.0 | 21.1 | 1258.8 | 0 | 0 |
| GET /health/push *(신규)* | 200 | 3.9 | 11.2 | 12.5 | 15.4 | 1920.4 | 0 | 0 |
| GET /health/worker *(신규)* | 200 | 4.2 | 9.2 | 13.3 | 16.1 | 1848.4 | 0 | 0 |
| GET /admin/audit-logs *(신규)* | 200 | 28.9 | 36.4 | 42.6 | 46.0 | 341.2 | 0 | 0 |

- 오류율 0%, 429 0건 (전 시나리오).

## 기준선 대비 회귀 판정: **회귀 없음**

기존 6개 시나리오 전부 기준선(`docs/qa/load-smoke-results.md`)보다 **개선**됐다. 2배 이상 악화 기준에 걸리는 시나리오가 없어 EXPLAIN 원인 조사는 불필요.

| 시나리오 | p50 (기준→이번) | p95 (기준→이번) | 판정 |
|---|---|---|---|
| GET /home?childId= | 114.0 → 68.9 | 251.0 → 92.4 | 개선 (p95 -63%) |
| GET /children/:id/expenses | 40.6 → 25.7 | 148.3 → 36.7 | 개선 |
| GET /children/:id/items?tab=now | 71.7 → 48.5 | 116.4 → 69.9 | 개선 |
| GET /children/:id/reports/monthly | 40.1 → 26.8 | 77.2 → 35.0 | 개선 |
| POST /children/:id/expenses | 68.3 → 41.9 | 111.9 → 59.7 | 개선 |
| GET /health/ready | 9.5 → 7.0 | 35.7 → 13.6 | 개선 |

- /home의 큰 폭 개선은 기준선 문서가 지목했던 순차 await·지출 중복 조회 이슈와는 별개로,
  기준선 측정 시점 대비 런타임 컨디션 차이(워밍업 상태, 캐시)일 수 있다 — 어느 쪽이든 회귀 아님.
- 신규 4개 시나리오는 이번이 첫 측정으로, 이 표가 이후 라운드의 기준선이 된다.
  - /sync/changes p95 51.4ms, /admin/audit-logs p95 36.4ms — 일반 GET 시나리오들과 같은 수준.
  - /health/push·/health/worker p50 ~4ms — DB를 안 타는 인메모리 스냅샷 응답답게 /health/ready(DB ping 포함)보다 빠름.

## 재실행 방법

```bash
service postgresql start   # 필요시

# 전용 측정 인스턴스 (공용 3400과 분리, 레이트리밋 상향)
cd apps/api && NODE_ENV=development PORT=3450 WORKER_ENABLED=1 \
  RATE_LIMIT_GLOBAL_MAX=100000 RATE_LIMIT_AUTH_MAX=1000 \
  DATABASE_URL=postgresql://wooriai:wooriai_dev_password@localhost:5432/wooriai_dev \
  npx tsx src/main.ts &

LOAD_BASE_URL=http://localhost:3450 node scripts/qa/load-smoke.mjs
# 파라미터: LOAD_N, LOAD_CONCURRENCY, LOAD_WARMUP, LOAD_ADMIN_TOKEN
# 끝나면 3450 인스턴스는 종료할 것.
```
