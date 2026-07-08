CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$ BEGIN
  CREATE TYPE auth_provider AS ENUM ('kakao', 'apple', 'google');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE user_status AS ENUM ('active', 'withdrawn', 'blocked');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE member_role AS ENUM ('owner', 'co_parent', 'viewer', 'gift_participant');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE member_status AS ENUM ('pending', 'active', 'removed', 'left');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE child_stage_mode AS ENUM ('pregnant', 'born', 'manual');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE child_stage_code AS ENUM (
    'pregnancy_early', 'pregnancy_mid', 'pregnancy_late',
    'newborn_0_3', 'infant_4_6', 'infant_7_12',
    'toddler_1_3', 'kid_4_7', 'elementary', 'middle_school'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE expense_source AS ENUM ('manual', 'excel_import', 'purchase_followup', 'admin');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE expense_type AS ENUM ('expense', 'gift', 'refund');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE payment_method AS ENUM ('unknown', 'cash', 'card', 'transfer', 'mobile_pay');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE necessity_level AS ENUM ('essential', 'convenience', 'optional');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE item_status AS ENUM ('not_prepared', 'prepared', 'gifted', 'not_needed', 'interested');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE product_platform AS ENUM ('coupang', 'naver', 'custom');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE import_status AS ENUM ('uploaded', 'analyzing', 'preview_ready', 'confirmed', 'failed', 'cancelled');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_provider auth_provider NOT NULL,
  provider_user_id varchar(191) NOT NULL,
  email varchar(320),
  phone varchar(32),
  display_name varchar(80),
  profile_image_url text,
  status user_status NOT NULL DEFAULT 'active',
  last_login_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT uq_users_provider UNIQUE (auth_provider, provider_user_id)
);

CREATE TABLE IF NOT EXISTS user_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id),
  platform varchar(20) NOT NULL CHECK (platform IN ('ios', 'android')),
  device_id_hash varchar(128),
  push_token text,
  notification_enabled boolean NOT NULL DEFAULT false,
  app_version varchar(32),
  os_version varchar(64),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS households (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(80) NOT NULL,
  owner_user_id uuid NOT NULL REFERENCES users(id),
  default_child_id uuid,
  status varchar(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE TABLE IF NOT EXISTS household_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES households(id),
  user_id uuid NOT NULL REFERENCES users(id),
  role member_role NOT NULL,
  status member_status NOT NULL DEFAULT 'active',
  invited_by_user_id uuid REFERENCES users(id),
  joined_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_household_members_user UNIQUE (household_id, user_id)
);

CREATE TABLE IF NOT EXISTS household_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES households(id),
  invited_by_user_id uuid NOT NULL REFERENCES users(id),
  role member_role NOT NULL,
  invite_token_hash varchar(128) NOT NULL UNIQUE,
  channel varchar(20) NOT NULL CHECK (channel IN ('kakao', 'sms', 'link')),
  status varchar(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'revoked')),
  expires_at timestamptz NOT NULL,
  accepted_by_user_id uuid REFERENCES users(id),
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_household_invites_expiry CHECK (expires_at > created_at)
);

CREATE TABLE IF NOT EXISTS children (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES households(id),
  nickname varchar(60) NOT NULL,
  stage_mode child_stage_mode NOT NULL,
  due_date date,
  birth_date date,
  manual_stage child_stage_code,
  gender varchar(20),
  profile_image_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT chk_children_stage_inputs CHECK (
    (stage_mode = 'pregnant' AND due_date IS NOT NULL)
    OR (stage_mode = 'born' AND birth_date IS NOT NULL)
    OR (stage_mode = 'manual' AND manual_stage IS NOT NULL)
  )
);

ALTER TABLE households
  DROP CONSTRAINT IF EXISTS fk_households_default_child,
  ADD CONSTRAINT fk_households_default_child FOREIGN KEY (default_child_id) REFERENCES children(id);

CREATE TABLE IF NOT EXISTS categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_category_id uuid REFERENCES categories(id),
  code varchar(50) NOT NULL UNIQUE,
  name varchar(50) NOT NULL,
  icon_name varchar(50),
  display_order integer NOT NULL DEFAULT 0,
  is_system boolean NOT NULL DEFAULT true,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS item_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code varchar(80) NOT NULL UNIQUE,
  name varchar(80) NOT NULL,
  category_id uuid REFERENCES categories(id),
  necessity_level necessity_level NOT NULL,
  timing_label varchar(80),
  price_min_krw integer CHECK (price_min_krw IS NULL OR price_min_krw >= 0),
  price_max_krw integer CHECK (price_max_krw IS NULL OR price_max_krw >= 0),
  reason_text text NOT NULL,
  skip_reason_text text,
  used_secondhand_ok boolean NOT NULL DEFAULT false,
  safety_note text,
  medical_disclaimer_required boolean NOT NULL DEFAULT false,
  display_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_item_templates_price_range CHECK (
    price_min_krw IS NULL OR price_max_krw IS NULL OR price_min_krw <= price_max_krw
  )
);

CREATE TABLE IF NOT EXISTS item_template_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_template_id uuid NOT NULL REFERENCES item_templates(id) ON DELETE CASCADE,
  stage_code child_stage_code NOT NULL,
  priority_weight integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_item_template_stage UNIQUE (item_template_id, stage_code)
);

CREATE TABLE IF NOT EXISTS expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES households(id),
  child_id uuid NOT NULL REFERENCES children(id),
  created_by_user_id uuid NOT NULL REFERENCES users(id),
  category_id uuid NOT NULL REFERENCES categories(id),
  amount_krw integer NOT NULL CHECK (amount_krw > 0),
  spent_on date NOT NULL,
  item_name varchar(120) NOT NULL,
  merchant varchar(120),
  payment_method payment_method NOT NULL DEFAULT 'unknown',
  expense_type expense_type NOT NULL DEFAULT 'expense',
  source expense_source NOT NULL DEFAULT 'manual',
  memo text,
  linked_item_template_id uuid REFERENCES item_templates(id),
  linked_product_link_id uuid,
  import_job_id uuid,
  deleted_at timestamptz,
  deleted_by_user_id uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS budgets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id uuid NOT NULL REFERENCES children(id),
  year_month date NOT NULL,
  amount_krw integer NOT NULL CHECK (amount_krw > 0),
  created_by_user_id uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_budgets_child_month UNIQUE (child_id, year_month),
  CONSTRAINT chk_budgets_first_day CHECK (date_trunc('month', year_month)::date = year_month)
);

CREATE TABLE IF NOT EXISTS child_item_statuses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id uuid NOT NULL REFERENCES children(id),
  item_template_id uuid NOT NULL REFERENCES item_templates(id),
  status item_status NOT NULL DEFAULT 'not_prepared',
  expense_id uuid REFERENCES expenses(id),
  status_note varchar(200),
  updated_by_user_id uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_child_item_status UNIQUE (child_id, item_template_id)
);

CREATE TABLE IF NOT EXISTS product_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_template_id uuid NOT NULL REFERENCES item_templates(id),
  platform product_platform NOT NULL,
  title varchar(160) NOT NULL,
  url text NOT NULL,
  affiliate_url text,
  affiliate_partner_code varchar(80),
  is_affiliate boolean NOT NULL DEFAULT false,
  is_sponsored boolean NOT NULL DEFAULT false,
  sponsor_label varchar(80),
  price_snapshot_krw integer CHECK (price_snapshot_krw IS NULL OR price_snapshot_krw >= 0),
  display_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  disclosure_text varchar(200),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_product_links_sponsor CHECK (is_sponsored = false OR sponsor_label IS NOT NULL)
);

ALTER TABLE expenses
  DROP CONSTRAINT IF EXISTS fk_expenses_linked_product_link,
  ADD CONSTRAINT fk_expenses_linked_product_link FOREIGN KEY (linked_product_link_id) REFERENCES product_links(id);

CREATE TABLE IF NOT EXISTS affiliate_clicks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id),
  household_id uuid NOT NULL REFERENCES households(id),
  child_id uuid NOT NULL REFERENCES children(id),
  item_template_id uuid NOT NULL REFERENCES item_templates(id),
  product_link_id uuid NOT NULL REFERENCES product_links(id),
  platform product_platform NOT NULL,
  sub_id varchar(128),
  referrer_screen_id varchar(50),
  ip_hash varchar(128),
  user_agent text,
  clicked_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS import_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id),
  household_id uuid NOT NULL REFERENCES households(id),
  child_id uuid NOT NULL REFERENCES children(id),
  file_name varchar(255) NOT NULL,
  file_type varchar(10) NOT NULL CHECK (file_type IN ('xlsx', 'csv')),
  file_size_bytes bigint NOT NULL CHECK (file_size_bytes > 0),
  status import_status NOT NULL,
  source_file_url text,
  row_count integer,
  candidate_count integer,
  imported_count integer,
  skipped_count integer,
  error_code varchar(80),
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

ALTER TABLE expenses
  DROP CONSTRAINT IF EXISTS fk_expenses_import_job,
  ADD CONSTRAINT fk_expenses_import_job FOREIGN KEY (import_job_id) REFERENCES import_jobs(id);

CREATE TABLE IF NOT EXISTS import_rows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  import_job_id uuid NOT NULL REFERENCES import_jobs(id) ON DELETE CASCADE,
  row_index integer NOT NULL,
  raw_json jsonb NOT NULL,
  parsed_date date,
  parsed_item_name varchar(120),
  parsed_amount_krw integer CHECK (parsed_amount_krw IS NULL OR parsed_amount_krw > 0),
  category_id uuid REFERENCES categories(id),
  merchant varchar(120),
  confidence numeric(4,3) NOT NULL DEFAULT 0 CHECK (confidence >= 0 AND confidence <= 1),
  duplicate_candidate_expense_id uuid REFERENCES expenses(id),
  selected boolean NOT NULL DEFAULT false,
  validation_status varchar(30) NOT NULL DEFAULT 'ready',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_import_rows_row_index UNIQUE (import_job_id, row_index)
);

CREATE TABLE IF NOT EXISTS consents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id),
  consent_type varchar(60) NOT NULL,
  version varchar(30) NOT NULL,
  accepted boolean NOT NULL,
  accepted_at timestamptz,
  revoked_at timestamptz,
  ip_hash varchar(128),
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_consents_user_type_version UNIQUE (user_id, consent_type, version)
);

CREATE TABLE IF NOT EXISTS attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES households(id),
  child_id uuid NOT NULL REFERENCES children(id),
  expense_id uuid REFERENCES expenses(id),
  uploaded_by_user_id uuid NOT NULL REFERENCES users(id),
  file_url text NOT NULL,
  file_type varchar(30) NOT NULL,
  file_size_bytes bigint NOT NULL CHECK (file_size_bytes > 0),
  metadata_json jsonb,
  status varchar(30) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'deleted')),
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid REFERENCES users(id),
  household_id uuid REFERENCES households(id),
  action varchar(80) NOT NULL,
  target_type varchar(80) NOT NULL,
  target_id uuid,
  before_json jsonb,
  after_json jsonb,
  ip_hash varchar(128),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_deleted_at ON users(deleted_at);
CREATE INDEX IF NOT EXISTS idx_user_devices_user_id ON user_devices(user_id);
CREATE INDEX IF NOT EXISTS idx_households_owner_user_id ON households(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_household_members_user_id ON household_members(user_id);
CREATE INDEX IF NOT EXISTS idx_household_members_household_role ON household_members(household_id, role, status);
CREATE INDEX IF NOT EXISTS idx_household_invites_household_status ON household_invites(household_id, status);
CREATE INDEX IF NOT EXISTS idx_household_invites_expires_at ON household_invites(expires_at);
CREATE INDEX IF NOT EXISTS idx_children_household_id ON children(household_id);
CREATE INDEX IF NOT EXISTS idx_children_stage_mode ON children(stage_mode);
CREATE INDEX IF NOT EXISTS idx_categories_active_order ON categories(active, display_order);
CREATE INDEX IF NOT EXISTS idx_expenses_child_spent_on ON expenses(child_id, spent_on DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_household_child ON expenses(household_id, child_id);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category_id);
CREATE INDEX IF NOT EXISTS idx_expenses_not_deleted ON expenses(child_id, spent_on) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_budgets_child_month ON budgets(child_id, year_month);
CREATE INDEX IF NOT EXISTS idx_item_templates_active_order ON item_templates(active, display_order);
CREATE INDEX IF NOT EXISTS idx_item_template_stages_stage ON item_template_stages(stage_code, priority_weight DESC);
CREATE INDEX IF NOT EXISTS idx_child_item_statuses_child_status ON child_item_statuses(child_id, status);
CREATE INDEX IF NOT EXISTS idx_product_links_item_platform ON product_links(item_template_id, platform, active);
CREATE INDEX IF NOT EXISTS idx_product_links_active_order ON product_links(active, display_order);
CREATE INDEX IF NOT EXISTS idx_affiliate_clicks_product_clicked ON affiliate_clicks(product_link_id, clicked_at DESC);
CREATE INDEX IF NOT EXISTS idx_affiliate_clicks_child_clicked ON affiliate_clicks(child_id, clicked_at DESC);
CREATE INDEX IF NOT EXISTS idx_import_jobs_child_status ON import_jobs(child_id, status);
CREATE INDEX IF NOT EXISTS idx_import_rows_job_selected ON import_rows(import_job_id, selected);
CREATE INDEX IF NOT EXISTS idx_audit_logs_household_created ON audit_logs(household_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_target ON audit_logs(target_type, target_id);

CREATE OR REPLACE VIEW v_child_monthly_expense_summary AS
SELECT
  child_id,
  date_trunc('month', spent_on)::date AS year_month,
  SUM(amount_krw) FILTER (WHERE expense_type = 'expense') AS expense_total_krw,
  SUM(amount_krw) FILTER (WHERE expense_type = 'gift') AS gift_value_krw,
  COUNT(*) FILTER (WHERE expense_type = 'expense') AS expense_count
FROM expenses
WHERE deleted_at IS NULL
GROUP BY child_id, date_trunc('month', spent_on)::date;

CREATE OR REPLACE VIEW v_child_category_expense_summary AS
SELECT
  e.child_id,
  date_trunc('month', e.spent_on)::date AS year_month,
  e.category_id,
  c.name AS category_name,
  SUM(e.amount_krw) AS amount_krw,
  COUNT(*) AS expense_count
FROM expenses e
JOIN categories c ON c.id = e.category_id
WHERE e.deleted_at IS NULL
  AND e.expense_type = 'expense'
GROUP BY e.child_id, date_trunc('month', e.spent_on)::date, e.category_id, c.name;
