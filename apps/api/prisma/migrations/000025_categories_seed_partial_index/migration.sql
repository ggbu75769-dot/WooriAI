-- 라운드 103 리뷰 렌즈1 M-4 — `GET /categories`가 categories 전량 seq scan으로 떨어지던 것을 닫는다.
--
-- 000024는 `idx_categories_household ... WHERE household_id IS NOT NULL` 하나만 두면서 근거를
-- "가구 목록 조회는 언제나 (household_id) 단일 술어다"라고 적었다. **그 문장이 틀렸다.**
-- 실제 술어는 `household_id IS NULL OR household_id IN (...)`이고(finance/categories.controller.ts),
-- `IS NOT NULL` 부분 색인은 `IS NULL` 분기를 서빙할 수 없어 플래너가 전량 스캔으로 떨어진다.
--
-- 실측(시드 21 + 커스텀 100,000행 = 7,000가구 x 약 14, ANALYZE 후):
--   보완 색인 없음 → Seq Scan, Rows Removed by Filter 99,986, buffers 1,136, 9.6 ms
--   보완 색인 있음 → BitmapOr(idx_categories_seed, idx_categories_household), buffers 18, 0.106 ms
-- 이 조회는 페이지네이션이 없고 소비처가 열이며 모바일 캐시 규약이 includeAll=true로 채운다.
-- 설계 §1.7의 "36행 상한"은 **호출자가 받는 행 수**에 대해 참이지 스캔하는 행 수에 대해서는
-- 참이 아니다 — 스캔량은 그 앱의 총 가구 수에 비례해 자란다.
--
-- 같은 모양의 조회가 하나 더 있다: custom-categories.service.ts의 requireUniqueName
-- (`OR: [{householdId: null}, {householdId}]`)도 이 색인 쌍을 함께 쓴다.
--
-- 000018·000022·000023·000024와 같은 additive 관례: 색인 추가만 · 행 삭제 없음 · 기존 id 불변.
CREATE INDEX IF NOT EXISTS idx_categories_seed
  ON categories(household_id) WHERE household_id IS NULL;
