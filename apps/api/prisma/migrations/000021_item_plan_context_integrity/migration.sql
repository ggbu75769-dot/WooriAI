-- Release 4: a preparation state belongs to exactly one maternal or child context.
ALTER TABLE user_item_plans
  DROP CONSTRAINT IF EXISTS ck_user_item_plans_target;

ALTER TABLE user_item_plans
  ADD CONSTRAINT ck_user_item_plans_exactly_one_target CHECK (
    (child_id IS NOT NULL AND mother_profile_id IS NULL) OR
    (child_id IS NULL AND mother_profile_id IS NOT NULL)
  );

CREATE INDEX IF NOT EXISTS idx_user_item_plans_mother_scope_state
  ON user_item_plans(household_id, mother_profile_id, state)
  WHERE mother_profile_id IS NOT NULL;
