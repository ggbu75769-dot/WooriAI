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

---

# PERF-115 (000014) — EXPLAIN 전수 감사 라운드15 후속

핫 경로 전반에 대한 EXPLAIN 전수 감사에서 확정된 발견 4건의 처리 기록. PERF-101과
같은 원칙(측정/판정 근거 없는 인덱스 추가 금지)을 유지하되, 이번 라운드는 감사에서
나온 **판정·확신도**를 그대로 남긴다. 인덱스 3건은 `000014_perf_round15`
(000011/000012와 동일한 additive `CREATE INDEX IF NOT EXISTS` 관례), 나머지 2건은
코드 수정이다.

| # | 확신도 | 발견 | 처리 |
|---|---|---|---|
| F1 | 높음 | `dashboard-summary.service.ts`의 7일 분석 이벤트 카운트가 `received_at` 기준인데 시간 인덱스는 `occurred_at`(000011)뿐 → 가장 빨리 자라는 append 전용 테이블(analytics_events) 풀스캔 | **코드 수정**: `occurredAt` 기준으로 재작성. 의도적 의미 변경(수신 시각 → 발생 시각)이며 KPI 화면(`analytics-summary.service.ts`)과 의미가 정합해진다 — `received_at` 인덱스 추가 대신 이 쪽이 최선이라는 감사 판정. 지연 수신(backfill) 이벤트가 카운트에서 빠지는 회귀 테스트 포함(`admin-dashboard-summary.e2e.test.ts`) |
| F2 | 높음 | 파기 워커(`data-retention-purge.job.ts` `selectPurgeableStubs`)의 `NOT EXISTS (... expenses.created_by_user_id = u.id)` 안티조인이 무인덱스 컬럼이라 후보 행마다 최대 볼륨 테이블(expenses) 풀스캔; 같은 컬럼을 `findReferenceBlockedUserIds`도 조회 | **추가** `idx_expenses_created_by (created_by_user_id)` — 안티조인 프로브가 index-only로 풀린다 |
| F3 | 중간(예방) | attachments에 PK 외 인덱스 0개인데 파기 캐스케이드가 30초 트랜잭션 안에서 `expense_id IN (...)` UPDATE(FK 널링)와 `child_id IN (...)` DELETE를 수행 — 첨부 볼륨이 쌓이면 배치당 풀스캔 x2가 tx 타임아웃 예산을 잠식 | **추가** `idx_attachments_expense (expense_id)`, `idx_attachments_child (child_id)` — 현재 볼륨에선 측정 이득이 작지만 30초 타임아웃 실패 모드(포이즌 행 오판)의 예방 비용이 낮다고 판정 |
| F4 | — | `content-revisions.service.ts` 목록 쿼리에 LIMIT 없음 — publish/rollback마다 이력 행이 무한 누적되는 테이블의 전량 응답 | **코드 수정**: 어드민 목록 관례(감사 로그 뷰어의 bounded `take`)에 맞춰 `take: 100`(`CONTENT_REVISIONS_LIST_LIMIT`) + `id` desc 타이브레이커. `{ revisions: [...] }` 응답 계약 유지(최신순이라 잘리는 것은 가장 오래된 이력) |

## 검증 (000014)

- `pnpm --filter api prisma:validate` ✅ (비부분 인덱스 3건 모두 schema.prisma `@@index` 반영)
- `prisma migrate deploy`로 000014가 기존 dev DB(000013까지 적용)에 정상 적용 ✅
- `apps/api/test/perf-indexes.db.test.ts`에 PERF-115 블록 추가: pg_indexes 정의 계약
  (PERF-101 관례) + **EXPLAIN 인덱스 사용 확인**. 테스트 DB는 소규모라 플래너가
  seq scan을 선호하므로 트랜잭션 내 `SET LOCAL enable_seqscan = off`로 강제한 뒤
  파기 워커의 실제 술어 모양이 새 인덱스를 태우는지(플랜에 인덱스명 등장) 검증 —
  "인덱스가 해당 술어에 사용 가능한가"는 통계와 무관하게 결정적이다. dev DB 수동
  확인에서도 3건 모두 Index (Only) Scan 확인 ✅
- F1/F4는 각 서비스 테스트로 검증(`admin-dashboard-summary.e2e.test.ts`,
  `content-revisions.e2e.test.ts`)

런칭 후 재측정 시에는 이 라운드 인덱스도 상단 "재측정 방법"대로 before/after 실측을
남길 것 (F3은 예방 채택이므로 볼륨이 생기면 실측으로 사후 정당화하거나 제거를 판단).

---

# PERF-121 — 홈/누적 리포트 핫패스: 전 행 로드 → DB 집계

이번 라운드는 **인덱스를 하나도 추가하지 않은** 항목이다. 느린 원인이 인덱스 부재가 아니라
"인덱스로 잘 찾은 행을 전부 앱으로 끌고 와서 JS로 접는 것"이었기 때문이다. 그래서 이 절은
PERF-101/115와 달리 *쿼리 모양 자체*의 before/after를 남기고, **기존 부분 인덱스
`idx_expenses_not_deleted (child_id, spent_on) WHERE deleted_at IS NULL`(000001)이 치환 후
쿼리도 그대로 서빙한다**는 것을 EXPLAIN으로 확인한 근거를 남긴다.

## 대상 2건

| # | 위치 | Before | After |
|---|---|---|---|
| F1 | `onboarding/reporting-store.service.ts` `getHome` | 아이의 **전 기간 지출 행 전량**(memo/merchant 등 본문 컬럼 포함)을 `findMany`로 읽어 → 합계는 JS 순회, 최근 목록은 `slice(0, 3)` | `sumExpenses(childId)`(range 없는 `aggregate` SUM) + `expensesForChild(childId, undefined, 3)`(같은 정렬의 `take: 3`) |
| F2 | 같은 파일 `getCumulativeReport` | 전 기간 행을 `select: {spentOn, amountKrw}`로 읽어 JS에서 연도별 접기 | `groupBy(["spentOn"])` + `_sum`/`_count`로 DB에서 일자별 접고, 일자→연도 접기만 JS |

F1은 **홈 탭과 준비템 탭이 매번 호출**하는 경로다 — 아이의 지출이 쌓일수록 비용이 선형으로
늘고, 그 비용의 대부분이 DB 실행 시간이 아니라 행 전송/역직렬화다.

응답 형태·필터는 불변이다:
- `totalExpenseKrw`는 전 기간 + `expense_type='expense'` — 선물 제외(DNC-015) 그대로.
- `recentExpenses`는 **선물 포함**(종전 `slice`가 타입을 가리지 않았다) + `spent_on DESC, created_at DESC`.
- soft delete 행 제외(DNC-014), 누적 리포트의 연도 경계 계산(UTC date-only 문자열 절단) 그대로.

### 정정 (FIX-121A, 라운드21 리뷰) — "완전 불변"이 아니었다

위 목록은 원래 "응답 형태·정렬·필터는 **완전 불변**"이라고 적었지만, 정렬에 한해 틀렸다.
`(spent_on, created_at)` 정렬은 **동률에서 유일하지 않다**. 전량을 읽어 `slice(0, 3)`할 때와
`LIMIT 3`을 걸 때, 동률 행 중 어느 3건이 나오는지는 Postgres 재량이라 서로 달라질 수 있고
실제 DB에서 재현됐다. 동률은 예외 상황이 아니다 — 가져오기 확정(import-pipeline)이 한
트랜잭션 안에서 여러 지출을 삽입하므로 `created_at` 기본값 `now()`가 트랜잭션 시각으로
**전부 동일**해진다(같은 날짜 지출을 한 번에 가져오는 것이 정상 사용 패턴).

수정: `expensesForChild`의 정렬에 `id DESC` 결정적 타이브레이커를 추가했다
(`apps/api/src/onboarding/expenses-store.service.ts`). 정렬 정의가 이 한 메서드에만 있으므로
홈(`recentExpenses`)과 기록 탭(`listExpenses`)이 함께 안정화된다. 따라서 현재의 정렬 계약은
**`spent_on DESC, created_at DESC, id DESC`** 이며, 위 항목의 정렬 표기도 이 기준으로 읽어야 한다.

인덱스 판단은 바뀌지 않는다 — 인덱스 선택은 WHERE 술어가 결정하고, 추가된 타이브레이커는
"인덱스를 추가하지 않은 근거" 절에서 이미 사실상 공짜라고 실측한 top-N 정렬 안에서 처리된다
(후보 `(child_id, spent_on, created_at)`을 스킵한 판단도 그대로 유효하다).

회귀: `apps/api/test/reporting-hotpath.db.test.ts`에 `createMany`로 같은 `spent_on` + 같은
`created_at` 5건을 만들어 홈 `LIMIT 3`·기록 탭 전량 목록·참조 구현이 모두 같은 결정적 순서를
주는지 고정했다(참조 구현도 같은 타이브레이커로 대조 — 그래야 대조 자체가 결정적이다).

## 측정 환경

- PostgreSQL 16, 스크래치 DB `wooriai_perf121`(000001~000015 적용 + 시드 후 볼륨 생성, 측정 후 드랍)
- 볼륨: PERF-101과 같은 모양 — 가구 20 / 사용자 20 / 아이 40 / **지출 50,000건**(24개월 분산,
  2% 톰스톤, **선물 10% 혼합**, memo를 현실적 크기로 채움) → **아이당 약 1,250건**
- 쿼리 모양은 Prisma 쿼리 로그로 실제 발행 SQL을 뜬 뒤 그대로 EXPLAIN
- DB 수치는 warm cache `EXPLAIN (ANALYZE, BUFFERS)`, 앱 수치는 Prisma 클라이언트 호출
  왕복 30회의 median/p90 (**행 전송·역직렬화 포함** — 이 티켓의 진짜 비용이 여기 있다)
- 아이당 지출 날짜 분포가 결과를 가르므로 두 가지로 측정: **분산형**(1,225행 / 657 distinct day,
  거의 매일 기록)과 **군집형**(1,250행 / 126 distinct day, 장 보는 날에 몰아 기록 — 실사용에 가깝다)

## F1 — 홈 (군집형 아이 기준, 1,250행)

| 쿼리 | 플랜 | Execution Time | buf | 앱까지 온 행 |
|---|---|---|---|---|
| **Before** 전 행 `findMany` | Bitmap Index Scan `idx_expenses_not_deleted` → Bitmap Heap Scan → **Sort (quicksort, 390kB)** | **1.93ms** | 65 | **1,250행 × 21컬럼** |
| **After (a)** 전 기간 SUM | Bitmap Index Scan `idx_expenses_not_deleted` → Bitmap Heap Scan → Aggregate | **0.68ms** | 50 | **1행** |
| **After (b)** 최근 3건 | **Index Scan Backward** `idx_expenses_not_deleted` → Incremental Sort(top-N) → Limit | **0.20ms** | 22 | **3행** |

DB 실행 시간만 봐도 1.93ms → 0.68ms(둘은 `Promise.all`로 병렬이라 벽시계는 느린 쪽) 이지만,
실제 격차는 앱 왕복에서 나온다:

| Prisma 왕복(30회) | median | p90 |
|---|---|---|
| Before (전 행) | **47.35ms** | 60.81ms |
| After (SUM) | 1.17ms | 1.37ms |
| After (LIMIT 3) | 1.31ms | 1.52ms |
| **After (둘 병렬 = 실제 getHome 모양)** | **1.57ms** | **1.86ms** |

**약 30배**(47.35 → 1.57ms). 분산형 아이에서도 동일(48.62 → 2.11ms). DB가 1.9ms 만에 끝낸
일을 앱이 47ms 동안 받아 적고 있었다는 뜻이고, 이 차이는 아이당 지출 건수에 비례해 커진다.

부수 효과 하나: `Sort (quicksort, 390kB)`가 사라진다. Before는 전량 정렬이 필요했지만,
After (b)는 부분 인덱스가 `(child_id, spent_on)` 순서라 **역방향 인덱스 스캔 + 조기 종료**로
풀린다(플랜의 `rows=12`만 읽고 멈춘다 — 같은 날짜 타이브레이커 `created_at` 처리분).

## F2 — 누적 리포트

| 분포 | Before(전 행) DB | After(groupBy) DB | Before 앱 median | After 앱 median |
|---|---|---|---|---|
| 군집형 1,250행 / 126일 | 0.62ms / 50buf / **1,125행 전송** | 0.81ms / 50buf / **125행 전송** | **6.61ms** | **2.46ms** (2.7배) |
| 분산형 1,225행 / 657일 | 0.62ms / 54buf / 1,125행 | 1.07ms / 54buf / 657행 | 8.03ms | 7.46ms (≈동률) |

정직하게 남길 점: **DB 실행 시간은 오히려 조금 늘어난다**(HashAggregate 비용). 이득은 전적으로
전송 행 수 감소에서 나오므로, 같은 날짜에 여러 건을 적는 실사용 패턴에서 2.7배이고, 거의
매일 한두 건씩만 적는 극단적 분산에서는 본전이다. **어느 쪽에서도 나빠지지 않고**, 행 수 상한이
"지출 건수"(무제한)에서 "지출이 있었던 날짜 수"(달력일)로 바뀌는 것이 구조적 이득이라 채택했다.

Prisma는 파생식(연도 추출) 기준 groupBy를 표현할 수 없어 일자 기준으로 접고 연도 접기만 JS에
남겼다. 연도 기준 SQL(`EXTRACT(YEAR ...)`)을 쓰려면 `$queryRaw`가 필요한데, 응답 1건을 위해
타입 안전성을 버릴 만큼의 격차는 위 실측에서 확인되지 않았다.

## 인덱스를 추가하지 않은 근거

치환 후 3개 쿼리 모양 **모두** 000001의 부분 인덱스 `idx_expenses_not_deleted`를 탄다
(위 플랜의 `Bitmap Index Scan` / `Index Scan Backward` 노드). 비부분 인덱스
`idx_expenses_child_spent_on (child_id, spent_on)`이 함께 있는데도 플래너가 매번 부분 인덱스를
고른다 — `deleted_at IS NULL` 술어가 인덱스 조건에 흡수되기 때문이다.

- 새 인덱스 후보 **`(child_id, expense_type)`**: SUM 쪽 플랜에서 `Rows Removed by Filter: 100`
  (선물 10%)에 불과하다 — 선택도가 낮아 인덱스로 거를 값이 없고, 쓰기 비용만 는다. **스킵**.
- 새 인덱스 후보 **`(child_id, spent_on, created_at)`**: 최근 3건의 Incremental Sort를 없앨 수
  있지만, 그 정렬은 이미 `Full-sort Groups: 1 / Peak Memory: 26kB`로 사실상 공짜다(0.20ms 중
  대부분은 힙 접근). **스킵**.

## 검증

- 동치 회귀 테스트: `apps/api/test/reporting-hotpath.db.test.ts` (5건 — FIX-121A 동률 케이스 포함) — 기대값을 손으로 적지
  않고 **치환 전과 동일한 "전 행 → JS 접기" 참조 구현**을 테스트 안에서 돌려 API 응답과 비교한다.
  데이터는 행 다수·같은 날짜 복수 건·선물 혼합·soft delete·연도 경계(12-31/01-01)를 모두 섞는다.
- 인덱스 사용 고정: `apps/api/test/perf-indexes.db.test.ts`의 PERF-121 블록 — PERF-115 관례대로
  `SET LOCAL enable_seqscan = off` 후 세 쿼리 모양이 `idx_expenses_not_deleted`를 태우는지 확인.
- 기존 e2e 안전망 그대로 통과(`expense-home-report.e2e.test.ts`의 PERF-103 홈 일관성 테스트 포함).
- 스크래치 DB `wooriai_perf121`은 측정 종료 후 드랍.

---

# ADM-123 (000016) — 후속 관찰 2건 (라운드 정밀 리뷰 F7)

`000016_affiliate_clicks_clicked_product`가 추가한 `idx_affiliate_clicks_clicked_product
(clicked_at, product_link_id)`에 대한 **관찰 기록**이다. 지금 당장 바꾸는 것은 없고
(마이그레이션 파일은 Prisma 체크섬 때문에 수정 금지), 런칭 후 판단할 항목만 남긴다.

## 1) `idx_affiliate_clicks_clicked_at` 단일 인덱스와의 중복

새 복합 인덱스는 선두 컬럼이 `clicked_at`이라, 000011이 추가한 단일 인덱스
`idx_affiliate_clicks_clicked_at (clicked_at)`이 서빙하던 쿼리(어드민 대시보드 최근 7일 합계,
일별 추이 GROUP BY)를 **그대로 다 서빙할 수 있다** — 범위 술어가 같은 선두 컬럼에 걸리고,
일별 추이는 `clicked_at`만 읽으므로 넓어진 인덱스에서도 Index Only Scan이다.

- 남는 비용: `affiliate_clicks`는 `/r/:code`가 INSERT만 하는 append 전용 테이블이라 중복 인덱스
  하나가 **매 클릭마다 쓰기 비용**을 더한다. 용량도 40만 행 기준 복합 15MB + 단일 10MB로,
  단일 인덱스 몫 10MB가 사실상 잉여다.
- 지금 지우지 않는 이유: 클릭 실데이터가 아직 없어 두 인덱스의 실제 플랜 선택(단일 인덱스가
  더 작아 일별 추이에서 계속 선택될 여지)을 실측으로 확인할 수 없다. 000016의 실측은 합성
  스크래치 DB(`wooriai_perf_adm123`) 기준이다.
- 할 일: 운영 데이터가 쌓인 뒤 `pg_stat_user_indexes.idx_scan`으로 `idx_affiliate_clicks_clicked_at`
  사용 횟수를 확인하고, 복합 인덱스만으로 같은 플랜이 나오면 **단일 인덱스 제거**를 검토한다
  (제거도 `DROP INDEX CONCURRENTLY`로 별도 마이그레이션).

## 2) 000016은 `CONCURRENTLY`가 아니다 — 운영 중 재적용 시 `/r/:code` INSERT 블록

000016은 000011·000014·000015와 같은 관례로 **런칭 전**임을 전제해 `CREATE INDEX IF NOT EXISTS`
(비-CONCURRENTLY)를 쓴다. 일반 `CREATE INDEX`는 대상 테이블에 `SHARE` 락을 잡아 인덱스 빌드가
끝날 때까지 **INSERT를 막는다**. `affiliate_clicks`의 INSERT 경로는 제휴 링크 리다이렉트
`/r/:code`이므로, 트래픽이 있는 상태에서 이 마이그레이션이 (새 환경 구축·복구 등으로) 다시
돌면 그동안 클릭 리다이렉트가 지연·타임아웃될 수 있다 — 핵심 루프의 "구매 링크 클릭" 단계다.

- 할 일: **런칭 후**에 affiliate_clicks 인덱스를 추가·교체할 일이 생기면 기존 파일을 고치지 말고
  `CREATE INDEX CONCURRENTLY`(트랜잭션 밖 실행 필요)로 **별도 마이그레이션**을 새로 만든다.
  Prisma의 마이그레이션은 기본적으로 트랜잭션으로 감싸므로 CONCURRENTLY 문은 단독 마이그레이션
  파일로 분리해야 한다.

---

# R24-M3 (000017) — 지출 목록 keyset 커서: 정렬 일치 인덱스 + "앞 페이지 재스캔" 주장 정정

라운드 24 리뷰 M3의 처리 기록. 이 절은 **인덱스를 추가하면서도 "이 인덱스가 그 문제를
고치지는 못한다"를 함께 남기는** 항목이라, PERF-101 이래의 원칙("측정 없이 추가 금지")에
더해 *측정으로 반증된 주석을 정정한 기록*을 같이 둔다.

## 발단 — 코드 주석이 사실과 반대였다

`expensesForChild`(`apps/api/src/onboarding/expenses-store.service.ts`)의 API-124 JSDoc은
keyset 커서에 대해 이렇게 적고 있었다:

> OFFSET을 쓰지 않으므로 … **깊은 페이지에서도 앞 페이지를 다시 스캔하지 않는다**.

측정 결과 뒷부분은 **틀렸다**. Prisma는 튜플 비교 `(spent_on, created_at, id) < (…)`를
표현할 수 없어 커서 술어가 3분기 OR로 나가고, Postgres는 그 OR를 인덱스 시작점
(Index Cond)으로 삼지 못한다 — 인덱스를 정렬 순서대로 훑으며 **Filter로 앞 페이지 행을
전부 버린 뒤** 이번 페이지를 채운다. 즉 읽는 엔트리 수는 여전히 O(offset)이다.
(OFFSET을 쓰지 않는 데서 오는 진짜 이득 — 페이지 사이에 행이 생기거나 지워져도
건너뜀/중복이 없다는 안정성 — 은 그대로 유효하다. 틀린 것은 비용에 대한 주장뿐이다.)

## 측정 환경

- PostgreSQL 16, 스크래치 DB `wooriai_perf124`(000001~000016 적용 후 볼륨 생성, 측정 후 드랍)
- 볼륨: 가구 8 / 사용자 8 / 아이 16 / **지출 80,000건**, 그중 **대상 아이 1명에 20,000건**
  (24개월 730일 분산 = 하루 약 27건의 군집형, 선물 10% 혼합, 2% soft-delete 톰스톤,
  memo를 현실적 크기로 채움). `created_at`은 `date_trunc('milliseconds', …)`로 넣어
  Prisma 클라이언트가 만드는 값과 같은 정밀도를 유지했다(R24-L4의 ms 불변식).
- 쿼리 모양은 Prisma 쿼리 로그로 실제 발행 SQL(21컬럼 SELECT, `LIMIT 201`)을 뜬 뒤 그대로 EXPLAIN
- 수치는 warm cache `EXPLAIN (ANALYZE, BUFFERS)`, 각 쿼리 8회 이상 반복해 중앙값 확인

## Before/After — `idx_expenses_list_keyset (child_id, spent_on DESC, created_at DESC, id DESC) WHERE deleted_at IS NULL`

| # | 쿼리 (발행 위치) | Before (000016) | After (000017) | 판정 |
|---|---|---|---|---|
| Q1 | 첫 페이지, 커서 없음 `LIMIT 201` (`listExpenses` 1페이지) | 231buf / **0.76ms** — `Index Scan Backward idx_expenses_not_deleted` + **Incremental Sort** | 205buf / **0.35ms** — `Index Scan idx_expenses_list_keyset`, **Sort 노드 없음** | **개선 2.2배** |
| Q2 | 커서 @ offset 1,000 (3분기 OR) | 1,225buf / 1.06ms, `Rows Removed by Filter: 1001` | 1,211buf / 0.88ms, `Rows Removed by Filter: 1001` | 거의 동률 |
| Q3 | **커서 @ offset 10,000** (3분기 OR) | **10,243buf / 7.3ms**, `Rows Removed by Filter: 10001` | **10,255buf / 7.6ms**, `Rows Removed by Filter: 10001` | **개선 없음** |
| Q4 | 홈 `recentExpenses` `LIMIT 3` (`getHome`) | 30buf / 0.073ms (+Incremental Sort) | **6buf / 0.042ms** | **개선 5배(buf)** |
| Q5 | 월 범위 목록 `yearMonth=2026-07` | 219buf / 0.47ms | 205buf / 0.27ms — 범위가 `Index Cond`로 흡수 | **개선 1.7배** |
| Q6 | `sumExpenses` 전 기간 SUM | 772buf / 7.6ms — `idx_expenses_not_deleted` | 772buf / 7.9ms — **여전히 `idx_expenses_not_deleted`** | 불변(아래 참고) |

buf = `EXPLAIN (ANALYZE, BUFFERS)`의 shared 버퍼 접근 수(8KB 페이지).

**Q3이 이 절의 핵심이다.** 리뷰가 지적한 "offset 10,000에서 buffers 약 47배"는 재현됐고
(231 → 10,243buf = 44배), **새 인덱스로도 그대로 남는다**(10,255buf). 플랜을 보면 이유가
분명하다 — `Index Cond`는 `child_id = …` 하나뿐이고 3분기 OR 전체가 `Filter:`로 내려가
있다. 인덱스를 바꿔도 "정렬 순서로 훑으며 앞 페이지를 버린다"는 구조는 그대로다.

## 그래도 000017을 추가한 이유

이 인덱스가 사는 값은 **깊은 페이지 seek가 아니라 "정렬 커버"**다:

1. **Sort 노드 제거** — Before의 모든 목록 플랜에 `Incremental Sort`가 붙어 있었다
   (`idx_expenses_not_deleted`는 `(child_id, spent_on)`뿐이라 `created_at`/`id` 타이브레이커를
   인덱스로 못 준다). 000017은 정렬 계약 `spent_on DESC, created_at DESC, id DESC`
   (FIX-121A)와 컬럼·방향이 정확히 같아 인덱스 순서 그대로 읽고 멈춘다.
2. **가장 자주 호출되는 경로가 가장 크게 좋아진다** — 홈/준비템 탭이 매번 호출하는
   `recentExpenses`(Q4)가 30 → 6buf. 기록 탭 첫 페이지(Q1)와 월 범위(Q5)도 함께 개선된다.
   **깊은 페이지는 드물고 첫 페이지는 항상 열린다** — 개선이 실사용 분포와 맞는 쪽에 있다.
3. **후속 수정이 이 인덱스를 전제한다** — 아래 "남은 일" 두 방안 모두 이 인덱스가 있어야
   성립한다(둘 다 `(child_id, spent_on, created_at, id)` 순서를 요구한다).

**부분 인덱스(`WHERE deleted_at IS NULL`)로 만든 이유**: 이 인덱스를 타는 쿼리는 전부
`deleted_at IS NULL`을 함께 건다(DNC-014 soft delete). 000001 `idx_expenses_not_deleted`의
관례와 같고, 술어가 인덱스 조건에 흡수돼 플랜에 `Filter: (deleted_at IS NULL)`이 남지
않는다. 비부분 버전도 만들어 대조했다 — 크기는 5,312kB vs **5,208kB**(톰스톤 2%만큼만
작다)로 차이가 작지만, 비부분 쪽은 모든 플랜에 `deleted_at IS NULL` Filter가 남고
행 비교(아래) 경로에서 Index **Only** Scan이 되지 못한다(6buf vs 9buf). 부분 인덱스는
Prisma `@@index`로 표현할 수 없어 `schema.prisma`에는 주석으로 남기고, 정의 계약은
`apps/api/test/perf-indexes.db.test.ts`의 R24-M3 블록이 고정한다(000001·000011과 동일 관례).

**Q6이 안 바뀐 것은 정상이다**: 집계(SUM/groupBy)는 아이의 행 *전체*를 Bitmap으로 모으는
쿼리라 더 좁은 `idx_expenses_not_deleted`가 계속 유리하다. 즉 000001의 부분 인덱스는
000017이 생겨도 **잉여가 아니다** — 목록 경로는 000017, 집계 경로는 000001이 나눠 맡는다.
(ADM-123의 중복 인덱스 관찰과 달리 여기서는 제거 후보가 없다.)

## 후속 집행 기록 — 깊은 페이지 O(offset) 해소 ((A) 적용 완료, 라운드 25 `0ec1ab3`)

아래 두 방안을 같은 DB에서 실측했고, **(A)를 같은 라운드에서 집행했다** —
`expensesForChild`의 `spentOnBounds`가 커서 상한 `lte: after.spentOn`을 AND로 명시하며,
`yearMonth`의 `gte/lt`와 같은 키를 객체 병합으로 함께 담는다. 결과 집합 항등성은
`expenses-pagination.e2e.test.ts`의 왕복 계약(205행 동일 `spent_on` 동률 포함)이,
플랜 모양(`spent_on <= S`가 Index Cond로 상승)은 `perf-indexes.db.test.ts`의 R24-M3
후속A 단언이 고정한다. (B)는 이득 폭이 미미해 집행하지 않는다.

| 방안 | offset 10,000 (000017 적용 상태) | 성립 조건 |
|---|---|---|
| 현재 (3분기 OR) | **10,255buf / 7.6ms** | — |
| **(A) 잉여 sargable 술어 추가** — OR와 함께 `spentOn: { lte: after.spentOn }`를 AND로 더한다 | **228buf / 0.20ms** (**45배 / 38배**) | OR 세 분기가 모두 `spent_on <= S`를 함의하므로 **논리적으로 항등**(결과 집합 불변). Prisma로 표현 가능. 단 `yearMonth` 사용 시 기존 `spentOn: { gte, lt }`와 같은 키라 객체를 병합해야 한다 |
| **(B) raw SQL 행 비교** — `(spent_on, created_at, id) < (…)` | **206buf / 0.18ms** | `$queryRaw`가 필요(21컬럼 수기 매핑 + 타입 안전성 상실). 대신 `Index Cond`에 `ROW(...)`가 그대로 올라가 진짜 seek가 된다 |

(A)를 택한 이유: 한 줄짜리 항등 술어로 45배 — Postgres가 (B)의 행 비교에서 스스로
`spent_on <= S`를 Index Cond로 끌어올리는 것과 같은 효과를 Prisma가 표현 가능한 형태로
손으로 주는 것이다. 3분기 OR 자체는 여전히 Filter로 남지만(플랜에서 확인), 인덱스 범위가
커서 날짜 이하로 좁혀져 재스캔 규모가 동률 구간 하나로 준다.

적용 범위(R26 리뷰 정정): 위 45배 실측과 "lte를 지우면 회귀" 경고는 **yearMonth 없는
호출**에 대한 것이다. 모바일은 항상 yearMonth를 붙이므로(월 범위가 스캔을 이미 묶음)
앱 트래픽에는 O(offset) 문제가 없고 lte는 무해한 잉여다. yearMonth 생략이 허용된 공개
API 경로를 위해 lte와 R24-M3 후속A 플랜 단언(그 경로 형태 기준)을 유지한다.

## 검증

- `pnpm --filter api prisma:validate` ✅ (부분 인덱스라 `@@index` 추가 없음 — `schema.prisma`
  Expense 모델의 "SQL 전용 부분 인덱스" 주석 목록에 3번째 항목으로 반영)
- `prisma migrate deploy`로 000017이 기존 DB(000016까지 적용)에 정상 적용 ✅
- `apps/api/test/perf-indexes.db.test.ts` R24-M3 블록 5건 추가 — 정의 계약 + 첫 페이지의
  Sort 노드 부재 + yearMonth 범위 흡수 + **OR이 Filter로 남는다는 한계** + 행 비교가
  Index Cond로 올라간다는 후속 근거
- 기존 PERF-121 블록의 "홈 최근 3건" 테스트는 새 인덱스가 선택될 수 있으므로 두 인덱스
  중 하나를 타면 통과하도록 완화(고정하려는 것은 "seq scan으로 떨어지지 않는다"이다)
- 스크래치 DB `wooriai_perf124`는 측정 종료 후 드랍

---

# ADM-127 사용자 조회 — `ILIKE '%…%'`는 seq scan이다 (라운드 28 리뷰 F4, 측정 없음·관찰만)

`GET /admin/users-lookup`(`apps/api/src/admin/admin-users-lookup.service.ts`)의 검색 조건은
Prisma `contains` + `mode: "insensitive"` 두 개의 OR다:

```sql
WHERE email ILIKE '%' || $1 || '%' OR display_name ILIKE '%' || $1 || '%'
```

**앞자리가 열려 있는 패턴이라 B-tree 인덱스를 탈 수 없다** — `users_email_key`(unique)도,
어떤 `(email)` 인덱스도 쓰이지 않고 `users` 전건 **Seq Scan + Filter**로 떨어진다.
`ORDER BY created_at DESC, id ASC` + `LIMIT 20`도 도움이 되지 않는다: 필터가 인덱스로
좁혀지지 않으므로 정렬 전에 전건을 훑어야 한다.

지금은 **추가하지 않는다**. 근거:

- 볼륨: 현 단계 `users`는 수천~수만 행 규모이고, 그 정도면 seq scan이 수 ms다.
- 호출 빈도: CS 문의가 들어왔을 때 운영자가 손으로 한 번 치는 조회다(초당 요청이 아니다).
  게다가 `RequireAdminRoles("admin")` + 최소 2자 + `limit ≤ 50` 제한이 걸려 있다.
- 비용: pg_trgm은 확장 설치(`CREATE EXTENSION pg_trgm`)와 GIN 인덱스 2개(email,
  display_name)를 요구하고, 두 컬럼 모두 쓰기 경로(가입·프로필 수정·파기 잡의 익명화)에서
  갱신되므로 인덱스 유지 비용이 붙는다. PERF-101 관례상 **측정된 개선 없이는 추가하지 않는다.**

**성장 시 처방**(같은 관례대로, 먼저 스크래치 DB에서 `EXPLAIN (ANALYZE, BUFFERS)`로 확인한 뒤):

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX CONCURRENTLY idx_users_email_trgm ON users USING gin (email gin_trgm_ops);
CREATE INDEX CONCURRENTLY idx_users_display_name_trgm ON users USING gin (display_name gin_trgm_ops);
```

트리거로 삼을 신호: `users` 행 수가 10만을 넘거나, 이 엔드포인트의 p95가 눈에 띄게(수백 ms)
늘어날 때. 참고로 trigram 인덱스는 검색어가 3자 이상일 때 효과가 있다 — 현재 최소 길이는
2자(`USERS_LOOKUP_MIN_QUERY_LENGTH`)라, 2자 검색은 인덱스를 붙여도 여전히 전건에 가깝다.
(`CONCURRENTLY`는 ADM-123 절의 관찰과 같은 이유로 운영 반영 시 필수다.)
