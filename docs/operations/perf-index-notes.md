# PERF-101 — DB 인덱스 실측 최적화 노트

마이그레이션 `000011_perf_indexes`의 실측 근거 문서. 후보 인덱스를 "그럴듯해서" 추가하지 않고,
실데이터 볼륨을 채운 스크래치 DB에서 코드가 실제로 발행하는 쿼리 모양 그대로
`EXPLAIN (ANALYZE, BUFFERS)`를 돌려 **측정된 개선이 있는 것만** 추가했다.

## 측정 환경

- PostgreSQL 16, 스크래치 DB `wooriai_perf` (000001~000010 적용 + 시드 후 볼륨 생성, 측정 종료 후 드랍)
- 볼륨: 가구 20 / 사용자 20 / 아이 40 / **지출 50,000건**(24개월 분산, 2% soft-delete 톰스톤 1,000건,
  `updated_at` 무작위 분산) / 분석 이벤트 5,000 / 리프레시 토큰 2,000(만료·폐기 혼합) /
  idempotency 키 1,000(60% 만료) / child_item_statuses 520 / affiliate_clicks 3,000
- 쿼리 모양은 각 서비스 코드에서 확인한 그대로 재현 (Prisma가 생성하는 WHERE/ORDER BY/LIMIT 포함)
- 모든 수치는 warm cache 기준 `EXPLAIN (ANALYZE, BUFFERS)` 실측값

## 결과 요약 — 쿼리 → 인덱스 매핑

| # | 핫 쿼리 (발행 위치) | 쿼리 모양 | Before | After | 결정 |
|---|---|---|---|---|---|
| Q1 | 지출 목록 (`onboarding-store.service.ts` `expensesForChild`) | `child_id = ? AND deleted_at IS NULL AND spent_on ∈ [월)` ORDER BY spent_on DESC | 0.26ms / 31buf — **이미 `idx_expenses_not_deleted` 사용** | 동일 | **스킵** (000001의 부분 인덱스가 서빙) |
| Q2 | 홈/월간 합계 (`sumExpenses`) | 위 + `expense_type='expense'`, SUM | 0.11ms / 31buf — 동일 인덱스 | 동일 | **스킵** |
| Q3 | 카테고리 리포트 groupBy (`categoryBreakdown`) | `child_id + deleted_at IS NULL` GROUP BY category_id | 0.42ms / 36buf — 동일 인덱스 | 동일 | **스킵** |
| Q4 | 연간 리포트 (`getYearlyReport`) | `child_id + 연 범위` | 0.21ms / 34buf — 동일 인덱스 | 동일 | **스킵** |
| Q5 | 델타 동기화 keyset (`sync.service.ts` `getChanges`) | `household_id IN (...) AND (updated_at,id) > 커서` ORDER BY updated_at,id LIMIT 101 | 첫 페이지 1.34ms / 59buf, 최근 커서 폴링 ~1.5ms / 62buf (가구 2,500행 전체 bitmap + 매 페이지 top-N sort) | 첫 페이지 **0.09ms / 105buf**(조기 종료), 최근 커서 **0.22ms / 14buf**(BitmapOr sargable) | **추가** `idx_expenses_household_updated (household_id, updated_at, id)` |
| Q6 | 리프레시 토큰 정리 워커 (`refresh-token-cleanup.job.ts`) | `expires_at < cutoff OR revoked_at < cutoff` | 0.60ms / 40buf — **Seq Scan** (revoked_at 분기 인덱스 없음) | **0.24ms / 44buf** — BitmapOr(expires_at + revoked_at 인덱스) | **추가** `idx_refresh_tokens_revoked_at (revoked_at) WHERE revoked_at IS NOT NULL` (부분) |
| Q7 | idempotency 정리 워커 | `expires_at < now()` | 0.18ms — Seq Scan이지만 매치 60%라 플래너 선택이 옳음; 낮은 선택도에선 기존 `idx_idempotency_keys_expires_at` 사용 | — | **스킵** (기존 인덱스로 충분) |
| Q8a | 어드민 KPI eventName groupBy (`analytics-summary.service.ts`) | `occurred_at ∈ [윈도우)` GROUP BY event_name | 0.30ms / 18buf — `(event_name, occurred_at)` 전체 인덱스 스캔 | 0.27ms / 17buf | (아래 인덱스가 겸사 서빙) |
| Q8b | 어드민 KPI 일별 raw GROUP BY | `occurred_at ∈ [윈도우)` GROUP BY 일자 | **4.43ms** / 18buf | **0.66ms** / 4buf — index-only 범위 스캔 | **추가** `idx_analytics_events_occurred_at (occurred_at)` |
| Q8c | 어드민 KPI 유니크 사용자 | `COUNT(DISTINCT user_anon_id)` + 윈도우 | **1.34ms / 82buf — Seq Scan**(5천 행 전체) | **0.42ms / 20buf** — bitmap 범위 스캔 | (위 인덱스가 서빙) |
| Q9 | 제휴 클릭 플랫폼 합계 (`adminAffiliateClickSummary`) | 전체 테이블 GROUP BY platform | 0.66ms — Seq Scan | — | **스킵** (필터 없는 전량 집계, 어떤 인덱스도 도움 안 됨) |
| Q9b | 어드민 대시보드 최근 7일 클릭 (`dashboard-summary.service.ts`) | `clicked_at >= since` COUNT | 0.53ms / 58buf — **Seq Scan**(전체 이력) | **0.13ms / 4buf** — index-only 윈도우 스캔 | **추가** `idx_affiliate_clicks_clicked_at (clicked_at)` |
| Q10a | 파기 워커 지출 드라이버 (`data-retention-purge.job.ts` `purgeExpenses`) | `deleted_at < cutoff` ORDER BY deleted_at,id LIMIT 200 | **16.0ms / 1,112buf — Seq Scan 5만 행 + top-N sort** | **0.07ms / 3buf** — 부분 인덱스 index-only 스캔 | **추가** `idx_expenses_deleted_purge (deleted_at, id) WHERE deleted_at IS NOT NULL` (부분) |
| Q10b | 파기 워커 아이 드라이버 | `children.deleted_at < cutoff` | 0.03ms — 40행 테이블 | — | **스킵** (측정 가능한 이득 없음) |
| Q10c | 파기 워커 탈퇴 사용자 드라이버 | `users: status='withdrawn' AND deleted_at IS NULL AND updated_at < cutoff` | 0.03ms — 20행 테이블 | — | **스킵** (동일) |

buf = `EXPLAIN (ANALYZE, BUFFERS)`의 shared 버퍼 접근 수(8KB 페이지).

## 추가한 인덱스 (5건, 000011)

1. **`idx_expenses_deleted_purge (deleted_at, id) WHERE deleted_at IS NOT NULL`** — 최대 승자.
   파기 워커가 틱마다 도는 드라이버 셀렉트가 5만 행 seq scan(16ms, 1,112buf)에서 3버퍼
   index-only 스캔으로. 톰스톤(~2%)만 담는 부분 인덱스라 크기가 작고 live 행 write에
   유지 비용이 없다. 정렬 키 `(deleted_at, id)`와 정확히 일치해 sort도 사라진다.
2. **`idx_expenses_household_updated (household_id, updated_at, id)`** — 동기화 keyset 커서와
   정렬 키 일치. 기존 `idx_expenses_household_child`는 가구 전체를 모아 매 페이지 정렬해야
   했다. 첫 페이지 16배(1.34→0.09ms), 최근 커서 폴링은 Prisma의
   `OR (updated_at = ?, id > ?)` 모양이 BitmapOr로 sargable하게 풀려 7배(1.5→0.22ms).
   가구당 지출이 늘수록(테스트: 2,500행) before 쪽 정렬 비용만 커지므로 격차는 확대된다.
   참고: 티켓 후보였던 전역 `(updated_at, id)`는 가구 필터를 못 태우므로 채택하지 않았다.
3. **`idx_analytics_events_occurred_at (occurred_at)`** — 기존 `(event_name, occurred_at)`은
   선두 컬럼 때문에 occurred_at 단독 범위를 못 탄다(전체 인덱스 스캔/seq scan). 일별 raw
   GROUP BY 6.7배(4.43→0.66ms), COUNT(DISTINCT user_anon_id) 3.2배(1.34→0.42ms).
   append 전용으로 가장 빨리 자라는 테이블 — 5천 행에서 이 정도면 볼륨 증가 시 격차 최대.
4. **`idx_refresh_tokens_revoked_at (revoked_at) WHERE revoked_at IS NOT NULL`** — 정리
   워커의 OR 분기 중 revoked_at 쪽이 인덱스가 없어 항상 seq scan을 강제했다. 부분 인덱스
   추가로 BitmapOr(2.5배, 0.60→0.24ms). 정리가 주기적으로 돌아 매치 비율이 낮아지는 정상
   상태에서는 seq scan 대비 이득이 더 커진다.
5. **`idx_affiliate_clicks_clicked_at (clicked_at)`** — 대시보드 7일 카운트가 전체 클릭
   이력 seq scan → 윈도우만 index-only 스캔(4배, 0.53→0.13ms). 클릭은 무기한 누적되는
   append 전용 테이블이라 seq scan 비용은 단조 증가, 인덱스 비용은 윈도우 크기에 비례.

## 추가하지 않은 후보와 이유

- **`expenses (child_id, spent_on) WHERE deleted_at IS NULL`** — **이미 존재**
  (000001의 `idx_expenses_not_deleted`, schema.prisma에는 부분 인덱스라 미표기).
  Q1~Q4 실측 모두 이 인덱스를 탔다. 중복 추가 금지.
- **전역 `expenses (updated_at, id)`** — 동기화 쿼리는 항상 가구 스코프라 가구 컬럼이
  선두인 2번이 우월. 전역판은 다른 가구 엔트리를 걸러가며 스캔해야 한다.
- **`idempotency_keys (expires_at)`** — 이미 존재. 측정 시점의 seq scan은 매치 60%
  볼륨을 만든 탓이며 플래너 선택이 옳다(선택도 낮은 정상 상태에선 인덱스 사용).
- **`children (deleted_at)` / `users (status, updated_at)`** — 파기 드라이버용이지만 두
  테이블 모두 소규모(수십 행, 성장도 완만)라 측정 가능한 이득이 없음. 지출과 달리
  아이/사용자 행 수는 지출량에 비례해 자라지 않는다.
- **`affiliate_clicks (platform)`** — 플랫폼 합계는 필터 없는 전량 GROUP BY라 인덱스로
  개선 불가(플랫폼 enum 카디널리티도 3).
- **`oauth_transactions (consumed_at)`** — 10분 TTL + begin()마다 기회적 삭제로
  테이블이 상시 소규모. 측정할 볼륨 자체가 형성되지 않음.

## 검증

- `pnpm prisma:validate` ✅ (schema.prisma에 비부분 인덱스 3건 `@@index` 반영, 부분 인덱스
  2건은 표현 불가라 주석으로 명시 — 000001 `idx_expenses_not_deleted` 관례와 동일)
- `prisma migrate deploy`로 000011이 기존 DB(000010까지 적용)에 정상 적용 ✅
- 신규 DB `wooriai_perf2`에서 vitest globalSetup(마이그레이션+시드) 경유
  `npx vitest run test/perf-indexes.db.test.ts` → 6/6 통과 ✅ (인덱스 정의 계약 테스트,
  `apps/api/test/perf-indexes.db.test.ts`)
- 스크래치 DB(`wooriai_perf`, `wooriai_perf2`)는 측정 종료 후 드랍

## 재측정 방법

```bash
PGPASSWORD=... createdb -h localhost -U wooriai wooriai_perf
DATABASE_URL=postgresql://wooriai:...@localhost:5432/wooriai_perf pnpm prisma:deploy && pnpm seed
# 볼륨 생성 SQL(generate_series 기반)을 채운 뒤:
psql ... -c "EXPLAIN (ANALYZE, BUFFERS) <서비스 코드의 쿼리 모양 그대로>"
```

인덱스 추가/제거 판단은 항상 이 문서처럼 **before/after 실측**을 남길 것. 특히
`CREATE INDEX ... CONCURRENTLY`는 런칭 후 트래픽이 생기면 필수(000011은 런칭 전이라 미사용).
