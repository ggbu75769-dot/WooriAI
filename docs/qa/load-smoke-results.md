# QA-LOAD: 부하 스모크 결과 (p50/p95 실측)

- 측정일: 2026-08-21
- 스크립트: `scripts/qa/load-smoke.mjs` (순수 Node fetch, 외부 의존성 없음)
- 파라미터: 시나리오별 N=200, 동시성 10, 워밍업 10회(통계 제외)

## 측정 환경

| 항목 | 값 |
|---|---|
| 실행 환경 | 개발 컨테이너 (x86_64, 4 vCPU) |
| API 서버 | `tsx src/main.ts` dev 모드 (NODE_ENV=development, 트랜스파일 온더플라이 — 프로덕션 빌드 아님) |
| Node | v22.22.2 |
| DB | 로컬 PostgreSQL 16.13, `wooriai_dev` (시드 데이터 수준의 소량 행) |
| 서버 인스턴스 | 전용 포트 3450, `RATE_LIMIT_GLOBAL_MAX=100000 RATE_LIMIT_AUTH_MAX=1000` (공용 3400과 분리, 레이트리밋 간섭 제거) |
| 네트워크 | localhost 루프백 (네트워크 지연 ≈ 0) |

> **절대값은 참고치.** 컨테이너 + tsx dev 모드 + 로컬 PG 조합이라 프로덕션 수치와 직접 비교 불가.
> 목적은 **회귀 비교 기준선** — 같은 환경에서 재측정했을 때 특정 엔드포인트의 p95가 크게 튀면 회귀 신호로 본다.

## 결과 (2xx 응답 기준, ms)

| 시나리오 | n | p50 | p95 | p99 | max | req/s | 429 | err |
|---|---|---|---|---|---|---|---|---|
| GET /home?childId= | 200 | 114.0 | 251.0 | 438.6 | 451.9 | 78.1 | 0 | 0 |
| GET /children/:id/expenses?yearMonth= | 200 | 40.6 | 148.3 | 223.4 | 252.6 | 183.9 | 0 | 0 |
| GET /children/:id/items?tab=now | 200 | 71.7 | 116.4 | 156.6 | 165.5 | 130.6 | 0 | 0 |
| GET /children/:id/reports/monthly | 200 | 40.1 | 77.2 | 126.1 | 145.2 | 223.5 | 0 | 0 |
| POST /children/:id/expenses | 200 | 68.3 | 111.9 | 182.9 | 184.4 | 133.4 | 0 | 0 |
| GET /health/ready | 200 | 9.5 | 35.7 | 126.5 | 126.6 | 552.1 | 0 | 0 |

- 오류율: 전 시나리오 0%. 429(레이트리밋)도 0건 (전용 인스턴스에서 한도를 올리고 측정했기 때문 — 공용 기본값 300req/min에서는 이 부하만으로 429가 발생함).
- POST로 생성한 지출 210건(워밍업 10 포함)은 종료 시 전부 DELETE로 정리 완료 — DB 잔여물 없음.

## 해석

- **가장 느린 엔드포인트는 GET /home** (p50 114ms, p95 251ms — 다른 GET 대비 2~3배).
  첫 번째 추정 원인(측정 당시 `OnboardingStoreService.getHome`): child 접근 검증 → budget 조회 → 지출 목록
  → 추천 아이템 → 예산 DTO를 **순차 await**로 실행하고, 특히 `expensesForChild(childId)`를 **두 번 호출**해서
  child의 전체 지출을 중복으로 읽는다. `Promise.all` 병렬화 + 지출 1회 조회 재사용만으로도 눈에 띌 여지가 있다.
  → **후속 조치 완료**: REF-118로 갓 서비스가 분해되어 이 메서드는 현재
  `apps/api/src/onboarding/reporting-store.service.ts`의 `ReportingStoreService.getHome`이며,
  PERF-103이 독립 조회를 `Promise.all`로 병렬화하고 PERF-121(F1)이 전량 조회를 SUM + LIMIT 3 두 쿼리로 대체했다.
  (위 수치는 그 이전 측정값이므로 현행 성능과 다르다.)
- 그 외 엔드포인트는 p50 40~80ms, p95 80~150ms 수준으로 dev 모드 치고 무난.
- /health/ready p99가 126ms로 튄 것은 동시성 10에서 이벤트 루프/DB 커넥션 경합에 의한 꼬리 지연으로 보임(단건 p50은 9.5ms).

## 재실행 방법

```bash
# 1. (필요시) postgres 기동
service postgresql start

# 2. 전용 측정 인스턴스 기동 (공용 3400과 분리, 레이트리밋 상향)
cd apps/api && NODE_ENV=development PORT=3450 \
  RATE_LIMIT_GLOBAL_MAX=100000 RATE_LIMIT_AUTH_MAX=1000 \
  DATABASE_URL=postgresql://wooriai:wooriai_dev_password@localhost:5432/wooriai_dev \
  npx tsx src/main.ts &

# 3. 측정 (기본 N=200, 동시성 10)
LOAD_BASE_URL=http://localhost:3450 node scripts/qa/load-smoke.mjs

# 파라미터 조절: LOAD_N, LOAD_CONCURRENCY, LOAD_WARMUP
# 끝나면 3450 인스턴스는 종료할 것.
```

공용 dev 서버(3400)를 그대로 겨냥하면 전역 레이트리밋(300req/min)에 걸려 429가 섞이므로,
깨끗한 수치가 필요하면 반드시 전용 인스턴스를 쓴다. 429는 표에서 err와 분리 집계된다.
