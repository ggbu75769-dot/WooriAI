CREATE TYPE prepared_step_state AS ENUM ('not_started', 'selected', 'skipped', 'completed_none');

ALTER TABLE children
  ADD COLUMN stage_override BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN prepared_step_state prepared_step_state NOT NULL DEFAULT 'not_started',
  ADD COLUMN onboarding_completed_at TIMESTAMPTZ(6);

ALTER TABLE item_definitions
  ADD COLUMN onboarding_eligible BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN onboarding_priority INTEGER;

CREATE INDEX idx_item_definitions_onboarding
  ON item_definitions(status, onboarding_eligible, onboarding_priority);
