-- 라운드 102 T1: 카테고리별 예산 — docs/5차/round102-category-budget-design.md §1.
-- budgets(총액 한 칸)를 확장하지 않는 이유는 §1.1(uq_budgets_child_month 교체 = 파괴적
-- 변경 + DNC-007 의미 변경). 000011~000022와 동일하게 additive-only·재실행 안전.
CREATE TABLE IF NOT EXISTS category_budgets (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- 아이 물리 파기 시 함께 삭제(custom_items 000022·push_boundary_marks 000013 관례 —
  -- budgets가 FK 없이 purge job의 명시 deleteMany에 기대는 것보다 이 쪽이 새 표의 정석이다. §1.5)
  child_id     uuid NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  year_month   date NOT NULL,
  -- 카테고리는 물리 삭제되지 않는 운영 시드(active 플래그만 뒤집힘)라 캐스케이드 없음
  category_id  uuid NOT NULL REFERENCES categories(id),
  amount_krw   int  NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_category_budgets_child_month_category UNIQUE (child_id, year_month, category_id),
  -- budgets의 chk_budgets_first_day와 같은 형식 — 월 키의 정규형을 DB가 지킨다
  CONSTRAINT chk_category_budgets_first_day CHECK (date_trunc('month', year_month)::date = year_month)
);
-- 조회는 언제나 (child_id, year_month) 전량이므로 유니크 제약의 선두 컬럼이 곧 인덱스다(추가 인덱스 없음).
