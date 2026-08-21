-- PERF-101: DB 인덱스 실측 최적화. wooriai_perf 스크래치 DB에 실데이터 볼륨
-- (지출 5만 건/가구 20/아이 40/24개월, 분석 이벤트 5천, 리프레시 토큰 2천 등)을
-- 채우고 핫 쿼리를 EXPLAIN (ANALYZE, BUFFERS)로 실측한 결과에서 seq scan →
-- index scan 개선이 확인된 인덱스만 추가한다. 실측 전/후 수치와 "추가하지 않은"
-- 후보들의 판단 근거는 docs/operations/perf-index-notes.md 참고.
-- additive 마이그레이션(CREATE INDEX만, 런칭 전이라 CONCURRENTLY 불필요).
-- 000001~000010은 수정하지 않는다.
--
-- 참고: 지출 목록/홈 합계/리포트 groupBy가 쓰는 부분 인덱스
-- idx_expenses_not_deleted (child_id, spent_on) WHERE deleted_at IS NULL 은
-- 이미 000001에 존재하며 실측에서도 그 인덱스를 타는 것이 확인돼 추가하지 않는다.

-- 1) 파기 워커 드라이버 (data-retention-purge.job.ts purgeExpenses):
--    WHERE deleted_at < cutoff ORDER BY deleted_at ASC, id ASC LIMIT batch.
--    실측: 5만 행 seq scan + top-N sort 16.0ms/1112버퍼 → 부분 인덱스
--    index-only scan 0.07ms/3버퍼. 톰스톤(2%)만 담는 부분 인덱스라 크기도 작고
--    live 행 갱신 시 인덱스 유지 비용도 없다. (부분 인덱스는 Prisma @@index로
--    표현 불가 — 000001의 idx_expenses_not_deleted와 같은 SQL 전용 관례.)
CREATE INDEX IF NOT EXISTS idx_expenses_deleted_purge
  ON expenses (deleted_at, id)
  WHERE deleted_at IS NOT NULL;

-- 2) 델타 동기화 keyset (sync.service.ts getChanges):
--    WHERE household_id IN (...) AND (updated_at, id) > 커서
--    ORDER BY updated_at ASC, id ASC LIMIT n+1.
--    실측(가구당 2,500행): 기존 idx_expenses_household_child 는 가구 전체를
--    bitmap으로 모은 뒤 매 페이지 top-N sort(첫 페이지 1.34ms) — 이 인덱스로는
--    정렬 없이 인덱스 순서로 101행만 읽고 조기 종료(0.09ms), 최근 커서 폴링은
--    BitmapOr로 sargable하게 풀려 0.22ms/14버퍼. 가구 데이터가 늘수록 격차 확대.
CREATE INDEX IF NOT EXISTS idx_expenses_household_updated
  ON expenses (household_id, updated_at, id);

-- 3) 분석 이벤트 occurred_at 윈도우 (admin/analytics-summary.service.ts):
--    일별 raw GROUP BY와 COUNT(DISTINCT user_anon_id)는 occurred_at 범위만으로
--    거르는데, 기존 (event_name, occurred_at) 인덱스는 선두 컬럼이 event_name이라
--    범위 스캔이 불가(전체 인덱스 스캔 또는 seq scan). 실측(5천 행, 7일 윈도우):
--    일별 집계 4.43ms → 0.66ms, DISTINCT 사용자 1.34ms(seq) → 0.42ms(bitmap).
--    append 전용으로 가장 빨리 자라는 테이블이라 격차는 계속 커진다.
CREATE INDEX IF NOT EXISTS idx_analytics_events_occurred_at
  ON analytics_events (occurred_at);

-- 4) 리프레시 토큰 정리 워커 (refresh-token-cleanup.job.ts):
--    WHERE expires_at < cutoff OR revoked_at < cutoff. revoked_at 쪽 OR 분기가
--    인덱스가 없어 항상 seq scan이었다(실측 2천 행: 0.60ms/40버퍼 →
--    BitmapOr 0.24ms/44버퍼; 정리 후 매치가 적은 정상 상태에선 격차가 더 크다).
--    revoked_at IS NOT NULL 행(전체의 소수)만 담는 부분 인덱스 — Prisma 표현 불가.
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_revoked_at
  ON refresh_tokens (revoked_at)
  WHERE revoked_at IS NOT NULL;

-- 5) 어드민 대시보드 최근 7일 클릭 수 (dashboard-summary.service.ts):
--    WHERE clicked_at >= since. 기존 인덱스는 (product_link_id, clicked_at)/
--    (child_id, clicked_at)뿐이라 clicked_at 단독 범위는 seq scan.
--    실측(3천 행): 0.53ms(seq, 전체 스캔) → 0.13ms(index-only, 윈도우만 스캔).
--    클릭은 무기한 누적되는 append 전용 테이블이라 전체 스캔 비용만 계속 는다.
CREATE INDEX IF NOT EXISTS idx_affiliate_clicks_clicked_at
  ON affiliate_clicks (clicked_at);
