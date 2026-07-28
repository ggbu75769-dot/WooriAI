ALTER TABLE notification_deliveries
  ADD COLUMN household_id UUID,
  ADD COLUMN child_id UUID,
  ADD COLUMN target_type VARCHAR(40),
  ADD COLUMN target_id UUID;

CREATE INDEX idx_notification_deliveries_user_household_created
  ON notification_deliveries(user_id, household_id, created_at DESC);
