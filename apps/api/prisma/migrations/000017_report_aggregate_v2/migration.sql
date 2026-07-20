-- Release 4A/4F: auditable daily aggregates for arbitrary report ranges.

CREATE TABLE report_daily_aggregates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id UUID NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  aggregate_date DATE NOT NULL,
  expense_type expense_type NOT NULL,
  category_code VARCHAR(80) NOT NULL,
  member_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  amount_krw INTEGER NOT NULL,
  record_count INTEGER NOT NULL,
  refreshed_at TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT uq_report_daily_aggregate_dimension UNIQUE(
    child_id, aggregate_date, expense_type, category_code, member_user_id
  ),
  CONSTRAINT ck_report_daily_aggregate_amount CHECK (amount_krw >= 0),
  CONSTRAINT ck_report_daily_aggregate_count CHECK (record_count > 0)
);
CREATE INDEX idx_report_daily_aggregates_child_date
  ON report_daily_aggregates(child_id, aggregate_date);

INSERT INTO report_daily_aggregates (
  child_id, aggregate_date, expense_type, category_code, member_user_id,
  amount_krw, record_count, refreshed_at
)
SELECT
  expense.child_id,
  expense.spent_on,
  expense.expense_type,
  category.code,
  expense.created_by_user_id,
  SUM(CASE
    WHEN expense.expense_type = 'refund' THEN 0
    ELSE expense.amount_krw
  END),
  COUNT(*)::INTEGER,
  CURRENT_TIMESTAMP
FROM expenses expense
JOIN expense_categories_v2 category ON category.id = expense.expense_category_v2_id
WHERE expense.deleted_at IS NULL
GROUP BY expense.child_id, expense.spent_on, expense.expense_type, category.code, expense.created_by_user_id
ON CONFLICT (child_id, aggregate_date, expense_type, category_code, member_user_id)
DO UPDATE SET
  amount_krw = EXCLUDED.amount_krw,
  record_count = EXCLUDED.record_count,
  refreshed_at = EXCLUDED.refreshed_at;

