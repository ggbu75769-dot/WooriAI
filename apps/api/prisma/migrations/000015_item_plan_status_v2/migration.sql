-- Release 4B: lifecycle-aware household preparation state.

CREATE TYPE user_item_plan_state AS ENUM (
  'not_considered', 'need', 'researching', 'planned', 'ordered', 'owned',
  'borrowed', 'rented', 'gifted', 'not_needed', 'replaced', 'retired'
);
CREATE TYPE acquisition_mode AS ENUM (
  'new_purchase', 'secondhand', 'rental', 'borrow', 'gift', 'existing', 'undecided'
);

CREATE TABLE mother_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  child_id UUID REFERENCES children(id) ON DELETE SET NULL,
  due_date DATE,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_mother_profiles_household_active ON mother_profiles(household_id, active);
CREATE UNIQUE INDEX uq_mother_profiles_child ON mother_profiles(child_id) WHERE child_id IS NOT NULL;

CREATE TABLE user_item_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  child_id UUID REFERENCES children(id) ON DELETE CASCADE,
  mother_profile_id UUID REFERENCES mother_profiles(id) ON DELETE CASCADE,
  item_definition_id UUID NOT NULL REFERENCES item_definitions(id) ON DELETE CASCADE,
  state user_item_plan_state NOT NULL DEFAULT 'not_considered',
  desired_quantity INTEGER,
  owned_quantity INTEGER,
  due_date DATE,
  acquisition_mode acquisition_mode,
  assigned_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  budget_krw INTEGER,
  note TEXT,
  linked_expense_id UUID REFERENCES expenses(id) ON DELETE SET NULL,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT ck_user_item_plans_target CHECK (child_id IS NOT NULL OR mother_profile_id IS NOT NULL),
  CONSTRAINT ck_user_item_plans_quantities CHECK (
    (desired_quantity IS NULL OR desired_quantity >= 0) AND
    (owned_quantity IS NULL OR owned_quantity >= 0)
  ),
  CONSTRAINT ck_user_item_plans_budget CHECK (budget_krw IS NULL OR budget_krw >= 0),
  CONSTRAINT ck_user_item_plans_version CHECK (version > 0)
);
CREATE INDEX idx_user_item_plans_scope_state ON user_item_plans(household_id, child_id, state);
CREATE INDEX idx_user_item_plans_item_state ON user_item_plans(item_definition_id, state);
CREATE UNIQUE INDEX uq_user_item_plans_child_item
  ON user_item_plans(household_id, child_id, item_definition_id)
  WHERE child_id IS NOT NULL AND mother_profile_id IS NULL;
CREATE UNIQUE INDEX uq_user_item_plans_mother_item
  ON user_item_plans(household_id, mother_profile_id, item_definition_id)
  WHERE mother_profile_id IS NOT NULL AND child_id IS NULL;

INSERT INTO mother_profiles (household_id, child_id, due_date, active, created_at, updated_at)
SELECT child.household_id, child.id, child.due_date, true, child.created_at, child.updated_at
FROM children child
WHERE child.stage_mode = 'pregnant'
ON CONFLICT (child_id) WHERE child_id IS NOT NULL DO NOTHING;

INSERT INTO user_item_plans (
  household_id, child_id, item_definition_id, state, acquisition_mode,
  assigned_user_id, note, linked_expense_id, version, created_at, updated_at
)
SELECT
  child.household_id,
  legacy.child_id,
  definition.id,
  CASE legacy.status
    WHEN 'prepared' THEN 'owned'::user_item_plan_state
    WHEN 'gifted' THEN 'gifted'::user_item_plan_state
    WHEN 'not_needed' THEN 'not_needed'::user_item_plan_state
    WHEN 'interested' THEN 'researching'::user_item_plan_state
    ELSE 'not_considered'::user_item_plan_state
  END,
  CASE legacy.status
    WHEN 'prepared' THEN 'existing'::acquisition_mode
    WHEN 'gifted' THEN 'gift'::acquisition_mode
    ELSE NULL
  END,
  legacy.updated_by_user_id,
  legacy.status_note,
  legacy.expense_id,
  1,
  legacy.created_at,
  legacy.updated_at
FROM child_item_statuses legacy
JOIN children child ON child.id = legacy.child_id
JOIN item_definitions definition ON definition.legacy_item_template_id = legacy.item_template_id
ON CONFLICT DO NOTHING;

