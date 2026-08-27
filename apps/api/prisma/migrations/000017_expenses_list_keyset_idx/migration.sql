-- R24-M3 (라운드 24 리뷰 M3): 지출 목록 keyset 페이지네이션의 정렬 계약
--   ORDER BY spent_on DESC, created_at DESC, id DESC   (FIX-121A)
-- 과 컬럼·방향까지 정확히 일치하는 복합 인덱스를 추가한다.
-- 근거 실측(before/after EXPLAIN (ANALYZE, BUFFERS))은
-- docs/operations/perf-index-notes.md 의 "R24-M3" 절 참고.
--
-- 000011/000014/000015/000016과 같은 additive 관례: CREATE INDEX IF NOT EXISTS,
-- 런칭 전이라 CONCURRENTLY 미사용. 기존 마이그레이션(000001~000016)은 수정하지 않는다.
--
-- 부분 인덱스(WHERE deleted_at IS NULL)인 이유: 이 인덱스를 타는 쿼리
-- (expensesForChild — 기록 탭 목록·홈 최근 3건)는 **항상** deleted_at IS NULL을
-- 함께 건다(DNC-014 soft delete). 000001의 idx_expenses_not_deleted와 같은 관례이며,
-- 술어가 인덱스 조건에 흡수돼 플랜에 Filter가 남지 않는다. (Prisma @@index로는
-- 부분 인덱스를 표현할 수 없어 schema.prisma에는 주석으로만 남긴다 — 000001의
-- idx_expenses_not_deleted / 000011의 idx_expenses_deleted_purge와 동일. 정의
-- 계약은 apps/api/test/perf-indexes.db.test.ts의 R24-M3 블록이 고정한다.)
--
-- 실측 요약 (스크래치 DB wooriai_perf124, 지출 8만 건 / 대상 아이 2만 건, warm cache):
--   * 첫 페이지(LIMIT 201)        231buf / 0.76ms → 205buf / 0.35ms  (Incremental Sort 노드 제거)
--   * 홈 recentExpenses(LIMIT 3)   30buf / 0.073ms →   6buf / 0.042ms (5배)
--   * 월 범위 목록(yearMonth)     219buf / 0.47ms  → 205buf / 0.27ms  (범위가 Index Cond로 흡수)
--   * 깊은 커서(offset 10,000)  10,243buf / 7.3ms → 10,255buf / 7.6ms **개선 없음**
--
-- ⚠️ 마지막 줄이 이 인덱스의 한계다. Prisma가 튜플 비교를 표현하지 못해 커서 술어가
-- 3분기 OR로 나가고, Postgres는 OR를 인덱스 시작점으로 삼지 못해 **정렬 순서로 훑으며
-- Filter로 앞 페이지를 전부 버린다**(O(offset)). 이 인덱스가 사는 값은 "정렬 커버"
-- (Sort 노드 제거 + 첫 페이지/홈/월 범위 개선)이지 깊은 페이지 seek가 아니다.
-- 깊은 페이지를 O(1) seek로 만들려면 쿼리 모양을 바꿔야 하며(잉여 sargable
-- spent_on <= 커서, 또는 raw SQL 행 비교 — 둘 다 같은 실측 DB에서 10,243buf →
-- 약 230buf), 그 판단은 위 노트 문서에 후속 항목으로 남겼다.

CREATE INDEX IF NOT EXISTS idx_expenses_list_keyset
  ON expenses (child_id, spent_on DESC, created_at DESC, id DESC)
  WHERE deleted_at IS NULL;
