-- Release 4B: stable accounting taxonomy independent from item discovery.

ALTER TYPE expense_type ADD VALUE IF NOT EXISTS 'support';

CREATE TABLE expense_categories_v2 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID REFERENCES households(id) ON DELETE CASCADE,
  parent_category_id UUID REFERENCES expense_categories_v2(id) ON DELETE RESTRICT,
  code VARCHAR(80) NOT NULL,
  name_ko VARCHAR(80) NOT NULL,
  icon_key VARCHAR(80),
  is_system BOOLEAN NOT NULL DEFAULT true,
  hidden BOOLEAN NOT NULL DEFAULT false,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_expense_categories_v2_scope_code UNIQUE(household_id, code),
  CONSTRAINT ck_expense_categories_v2_system_scope CHECK (
    (is_system AND household_id IS NULL) OR (NOT is_system AND household_id IS NOT NULL)
  )
);
CREATE UNIQUE INDEX uq_expense_categories_v2_system_code
  ON expense_categories_v2(code) WHERE household_id IS NULL;
CREATE INDEX idx_expense_categories_v2_scope_order
  ON expense_categories_v2(household_id, hidden, display_order);

INSERT INTO expense_categories_v2 (code, name_ko, icon_key, display_order)
VALUES
  ('pregnancy_mother_health', '임신·산모 건강', 'mother-heart', 10),
  ('birth_postpartum', '출산·산후', 'hospital-box-outline', 20),
  ('hospital_health', '병원·건강', 'medical-bag', 30),
  ('diaper_hygiene', '기저귀·위생', 'baby-face-outline', 40),
  ('feeding_food', '수유·이유식·식비', 'baby-bottle-outline', 50),
  ('clothes_shoes_laundry', '의류·신발·세탁', 'tshirt-crew-outline', 60),
  ('sleep_furniture_storage', '수면·가구·수납', 'bed-outline', 70),
  ('outing_mobility_travel', '외출·이동·여행', 'stroller', 80),
  ('safety_emergency', '안전·응급', 'shield-check-outline', 90),
  ('play_books_development', '장난감·책·발달', 'toy-brick-outline', 100),
  ('care_education', '돌봄·교육', 'school-outline', 110),
  ('service_rental', '서비스·렌탈', 'handshake-outline', 120),
  ('insurance_savings', '보험·저축', 'piggy-bank-outline', 130),
  ('other', '기타', 'dots-horizontal-circle-outline', 999);

CREATE TABLE item_expense_category_mappings (
  item_definition_id UUID NOT NULL REFERENCES item_definitions(id) ON DELETE CASCADE,
  expense_category_id UUID NOT NULL REFERENCES expense_categories_v2(id) ON DELETE RESTRICT,
  is_default BOOLEAN NOT NULL DEFAULT false,
  PRIMARY KEY(item_definition_id, expense_category_id)
);
CREATE UNIQUE INDEX uq_item_expense_category_mappings_default
  ON item_expense_category_mappings(item_definition_id) WHERE is_default;
CREATE INDEX idx_item_expense_category_mappings_category
  ON item_expense_category_mappings(expense_category_id);

ALTER TABLE expenses
  ADD COLUMN linked_item_definition_id UUID REFERENCES item_definitions(id) ON DELETE SET NULL,
  ADD COLUMN expense_category_v2_id UUID REFERENCES expense_categories_v2(id) ON DELETE RESTRICT;
CREATE INDEX idx_expenses_category_v2 ON expenses(expense_category_v2_id);
CREATE INDEX idx_expenses_item_definition ON expenses(linked_item_definition_id);

UPDATE expenses expense
SET linked_item_definition_id = definition.id
FROM item_definitions definition
WHERE definition.legacy_item_template_id = expense.linked_item_template_id;

UPDATE expenses expense
SET expense_category_v2_id = v2.id
FROM categories legacy
CROSS JOIN LATERAL (
  SELECT CASE
    WHEN legacy.code IN ('pregnancy_mother') THEN 'pregnancy_mother_health'
    WHEN legacy.code IN ('birth_postpartum') THEN 'birth_postpartum'
    WHEN legacy.code IN ('hospital_checkup', 'mobile_hospital_checkup') THEN 'hospital_health'
    WHEN legacy.code IN ('diaper_hygiene', 'mobile_diaper_hygiene') THEN 'diaper_hygiene'
    WHEN legacy.code IN ('feeding_babyfood', 'mobile_feeding_dairy', 'mobile_feeding_meal') THEN 'feeding_food'
    WHEN legacy.code IN ('clothes_laundry', 'mobile_clothes_laundry') THEN 'clothes_shoes_laundry'
    WHEN legacy.code IN ('sleep_furniture') THEN 'sleep_furniture_storage'
    WHEN legacy.code IN ('outing_mobility', 'mobile_outing_mobility') THEN 'outing_mobility_travel'
    WHEN legacy.code IN ('toys_books', 'mobile_toys_books') THEN 'play_books_development'
    WHEN legacy.code IN ('care_education') THEN 'care_education'
    WHEN legacy.code IN ('insurance_savings') THEN 'insurance_savings'
    ELSE 'other'
  END AS target_code
) mapped
JOIN expense_categories_v2 v2 ON v2.household_id IS NULL AND v2.code = mapped.target_code
WHERE expense.category_id = legacy.id;

UPDATE expenses
SET expense_category_v2_id = (
  SELECT id FROM expense_categories_v2 WHERE household_id IS NULL AND code = 'other'
)
WHERE expense_category_v2_id IS NULL;

