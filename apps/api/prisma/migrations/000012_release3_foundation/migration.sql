-- Release 3 additive foundation. Existing migrations 000001-000011 remain immutable.

CREATE TYPE consent_action AS ENUM ('accepted', 'revoked', 'acknowledged');
CREATE TYPE consent_source AS ENUM ('mobile', 'web', 'admin');
CREATE TYPE privacy_request_type AS ENUM ('deletion', 'export', 'correction');
CREATE TYPE privacy_request_state AS ENUM (
  'requested', 'access_revoked', 'processor_delete_queued', 'purging',
  'retained_exception', 'completed', 'failed', 'cancelled'
);
CREATE TYPE product_link_health_state AS ENUM ('healthy', 'redirected', 'stale', 'failed', 'blocked');
CREATE TYPE notification_delivery_state AS ENUM ('queued', 'sending', 'sent', 'opened', 'failed', 'cancelled');

ALTER TABLE households ADD COLUMN ownership_version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE expenses ADD COLUMN payment_method_label_snapshot VARCHAR(80);
ALTER TABLE item_templates
  ADD COLUMN content_version INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN last_content_check_at TIMESTAMPTZ(6);
ALTER TABLE product_links ADD COLUMN price_checked_at TIMESTAMPTZ(6);
ALTER TABLE user_devices ADD COLUMN disabled_at TIMESTAMPTZ(6);
ALTER TABLE admin_users
  ADD COLUMN invited_by_admin_id UUID,
  ADD COLUMN disabled_at TIMESTAMPTZ(6);
ALTER TABLE content_revisions
  ADD COLUMN publish_claimed_at TIMESTAMPTZ(6),
  ADD COLUMN publish_error_code VARCHAR(80);

UPDATE expenses AS expense
SET payment_method_label_snapshot = method.label
FROM user_payment_methods AS method
WHERE expense.payment_method_id = method.id
  AND expense.payment_method_label_snapshot IS NULL;

CREATE TABLE oauth_identities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider auth_provider NOT NULL,
  provider_subject VARCHAR(191) NOT NULL,
  email_at_link VARCHAR(320),
  linked_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_verified_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  unlinked_at TIMESTAMPTZ(6),
  created_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT uq_oauth_identities_provider_subject UNIQUE (provider, provider_subject)
);
CREATE INDEX idx_oauth_identities_user_unlinked ON oauth_identities(user_id, unlinked_at);

INSERT INTO oauth_identities (
  user_id, provider, provider_subject, email_at_link, linked_at,
  last_verified_at, created_at, updated_at
)
SELECT id, auth_provider, provider_user_id, email, created_at,
       COALESCE(last_login_at, created_at), created_at, updated_at
FROM users
ON CONFLICT (provider, provider_subject) DO NOTHING;

CREATE TABLE legal_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_type VARCHAR(60) NOT NULL,
  locale VARCHAR(20) NOT NULL DEFAULT 'ko-KR',
  version VARCHAR(30) NOT NULL,
  title VARCHAR(160) NOT NULL,
  body_markdown TEXT NOT NULL,
  public_url TEXT,
  content_hash VARCHAR(64) NOT NULL,
  required BOOLEAN NOT NULL DEFAULT false,
  placeholder BOOLEAN NOT NULL DEFAULT true,
  effective_at TIMESTAMPTZ(6) NOT NULL,
  published_at TIMESTAMPTZ(6),
  retired_at TIMESTAMPTZ(6),
  created_by_admin_id UUID REFERENCES admin_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT uq_legal_documents_type_locale_version UNIQUE(document_type, locale, version),
  CONSTRAINT ck_legal_documents_hash CHECK (content_hash ~ '^[0-9a-f]{64}$')
);
CREATE INDEX idx_legal_documents_current ON legal_documents(document_type, locale, effective_at);

CREATE TABLE consent_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  legal_document_id UUID NOT NULL REFERENCES legal_documents(id) ON DELETE RESTRICT,
  action consent_action NOT NULL,
  content_hash VARCHAR(64) NOT NULL,
  source consent_source NOT NULL,
  app_version VARCHAR(32),
  ip_hash VARCHAR(128),
  user_agent_hash VARCHAR(128),
  occurred_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_consent_events_user_occurred ON consent_events(user_id, occurred_at);
CREATE INDEX idx_consent_events_document ON consent_events(legal_document_id);

CREATE TABLE privacy_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  request_type privacy_request_type NOT NULL,
  state privacy_request_state NOT NULL DEFAULT 'requested',
  requested_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  due_at TIMESTAMPTZ(6),
  access_revoked_at TIMESTAMPTZ(6),
  completed_at TIMESTAMPTZ(6),
  failure_code VARCHAR(80),
  retention_summary_json JSONB,
  status_token_hash VARCHAR(128) UNIQUE,
  export_object_key TEXT,
  export_expires_at TIMESTAMPTZ(6),
  created_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ(6) NOT NULL
);
CREATE INDEX idx_privacy_requests_user_type_state ON privacy_requests(user_id, request_type, state);
CREATE INDEX idx_privacy_requests_state_requested ON privacy_requests(state, requested_at);

CREATE TABLE privacy_request_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  privacy_request_id UUID NOT NULL REFERENCES privacy_requests(id) ON DELETE CASCADE,
  previous_state privacy_request_state,
  next_state privacy_request_state NOT NULL,
  actor_type VARCHAR(30) NOT NULL,
  event_code VARCHAR(80) NOT NULL,
  metadata_json JSONB,
  created_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_privacy_request_events_request_created
  ON privacy_request_events(privacy_request_id, created_at);

CREATE TABLE job_outbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic VARCHAR(80) NOT NULL,
  aggregate_type VARCHAR(80) NOT NULL,
  aggregate_id VARCHAR(191) NOT NULL,
  dedupe_key VARCHAR(191) NOT NULL,
  schema_version INTEGER NOT NULL DEFAULT 1,
  payload_json JSONB NOT NULL,
  trace_id VARCHAR(64),
  visible_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  published_at TIMESTAMPTZ(6),
  attempt_count INTEGER NOT NULL DEFAULT 0,
  last_error_code VARCHAR(80),
  claimed_at TIMESTAMPTZ(6),
  created_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT uq_job_outbox_topic_dedupe UNIQUE(topic, dedupe_key),
  CONSTRAINT ck_job_outbox_attempt_count CHECK (attempt_count >= 0)
);
CREATE INDEX idx_job_outbox_pending_visible ON job_outbox(published_at, visible_at);

CREATE TABLE dead_letter_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  original_job_id VARCHAR(191) NOT NULL,
  topic VARCHAR(80) NOT NULL,
  dedupe_key VARCHAR(191) NOT NULL,
  payload_json JSONB NOT NULL,
  failure_code VARCHAR(80) NOT NULL,
  attempts INTEGER NOT NULL,
  first_failed_at TIMESTAMPTZ(6) NOT NULL,
  last_failed_at TIMESTAMPTZ(6) NOT NULL,
  resolved_at TIMESTAMPTZ(6),
  resolved_by_admin_id UUID REFERENCES admin_users(id) ON DELETE SET NULL,
  resolution_note VARCHAR(500),
  cancelled_at TIMESTAMPTZ(6),
  created_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_dead_letter_jobs_topic_dedupe UNIQUE(topic, dedupe_key),
  CONSTRAINT ck_dead_letter_jobs_attempts CHECK (attempts > 0)
);
CREATE INDEX idx_dead_letter_jobs_open_failed ON dead_letter_jobs(resolved_at, last_failed_at);

CREATE TABLE processed_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic VARCHAR(80) NOT NULL,
  dedupe_key VARCHAR(191) NOT NULL,
  result_code VARCHAR(80) NOT NULL,
  completed_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_processed_jobs_topic_dedupe UNIQUE(topic, dedupe_key)
);

CREATE TABLE quick_expense_presets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  item_name VARCHAR(120) NOT NULL,
  category_id UUID NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  default_amount_krw INTEGER,
  payment_method_id UUID REFERENCES user_payment_methods(id) ON DELETE SET NULL,
  pinned BOOLEAN NOT NULL DEFAULT false,
  use_count INTEGER NOT NULL DEFAULT 0,
  last_used_at TIMESTAMPTZ(6),
  display_order INTEGER NOT NULL DEFAULT 0,
  archived_at TIMESTAMPTZ(6),
  created_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT ck_quick_expense_presets_amount CHECK (default_amount_krw IS NULL OR default_amount_krw > 0),
  CONSTRAINT ck_quick_expense_presets_use_count CHECK (use_count >= 0)
);
CREATE INDEX idx_quick_expense_presets_scope_active
  ON quick_expense_presets(household_id, user_id, archived_at);

CREATE TABLE sync_cursor_states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  device_id_hash VARCHAR(128) NOT NULL,
  cursor TEXT,
  schema_version INTEGER NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT uq_sync_cursor_states_scope_device UNIQUE(user_id, household_id, device_id_hash)
);

CREATE TABLE item_content_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_template_id UUID NOT NULL REFERENCES item_templates(id) ON DELETE CASCADE,
  source_type VARCHAR(40) NOT NULL,
  title VARCHAR(200) NOT NULL,
  public_url TEXT NOT NULL,
  published_at TIMESTAMPTZ(6),
  checked_at TIMESTAMPTZ(6) NOT NULL,
  created_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT ck_item_content_sources_url CHECK (public_url ~ '^https://')
);
CREATE INDEX idx_item_content_sources_item_checked ON item_content_sources(item_template_id, checked_at);

CREATE TABLE item_context_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(60) NOT NULL UNIQUE,
  name VARCHAR(80) NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  display_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE item_template_context_tags (
  item_template_id UUID NOT NULL REFERENCES item_templates(id) ON DELETE CASCADE,
  context_tag_id UUID NOT NULL REFERENCES item_context_tags(id) ON DELETE CASCADE,
  weight INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY(item_template_id, context_tag_id)
);

CREATE TABLE product_link_health (
  product_link_id UUID PRIMARY KEY REFERENCES product_links(id) ON DELETE CASCADE,
  state product_link_health_state NOT NULL DEFAULT 'stale',
  last_status_code INTEGER,
  final_domain VARCHAR(255),
  checked_at TIMESTAMPTZ(6),
  consecutive_failures INTEGER NOT NULL DEFAULT 0,
  price_checked_at TIMESTAMPTZ(6),
  disabled_at TIMESTAMPTZ(6),
  failure_reason VARCHAR(160),
  updated_at TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT ck_product_link_health_failures CHECK (consecutive_failures >= 0)
);

CREATE TABLE notification_preferences (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  family_enabled BOOLEAN NOT NULL DEFAULT true,
  budget_enabled BOOLEAN NOT NULL DEFAULT true,
  sync_enabled BOOLEAN NOT NULL DEFAULT true,
  stage_enabled BOOLEAN NOT NULL DEFAULT true,
  service_enabled BOOLEAN NOT NULL DEFAULT true,
  marketing_enabled BOOLEAN NOT NULL DEFAULT false,
  quiet_hours_start VARCHAR(5),
  quiet_hours_end VARCHAR(5),
  timezone VARCHAR(64) NOT NULL DEFAULT 'Asia/Seoul',
  updated_at TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT ck_notification_quiet_start CHECK (quiet_hours_start IS NULL OR quiet_hours_start ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  CONSTRAINT ck_notification_quiet_end CHECK (quiet_hours_end IS NULL OR quiet_hours_end ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$')
);

CREATE TABLE notification_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_id UUID REFERENCES user_devices(id) ON DELETE SET NULL,
  event_type VARCHAR(80) NOT NULL,
  dedupe_key VARCHAR(191) NOT NULL UNIQUE,
  state notification_delivery_state NOT NULL DEFAULT 'queued',
  scheduled_at TIMESTAMPTZ(6) NOT NULL,
  sent_at TIMESTAMPTZ(6),
  opened_at TIMESTAMPTZ(6),
  failure_code VARCHAR(80),
  retry_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT ck_notification_delivery_retry CHECK (retry_count >= 0)
);
CREATE INDEX idx_notification_deliveries_user_created ON notification_deliveries(user_id, created_at);
CREATE INDEX idx_notification_deliveries_state_scheduled ON notification_deliveries(state, scheduled_at);

CREATE TABLE remote_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_key VARCHAR(80) NOT NULL UNIQUE,
  value_json JSONB NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  active BOOLEAN NOT NULL DEFAULT true,
  updated_by_admin_id UUID REFERENCES admin_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT ck_remote_configs_version CHECK (version > 0)
);

INSERT INTO remote_configs(config_key, value_json, version, active, updated_at)
VALUES (
  'public_app_config',
  '{"minimumSupportedVersion":"0.0.0","latestVersion":"0.0.0","maintenanceMode":false,"readOnlyMode":false,"emergencyMessage":null,"authProviders":[],"featureFlags":{"analytics":false,"affiliate":false,"import":false,"notification":false},"policyVersions":{},"analyticsEnabled":false,"affiliateEnabled":false,"importEnabled":false,"notificationEnabled":false,"priceMaxAgeDays":null,"configVersion":1}',
  1,
  true,
  CURRENT_TIMESTAMP
);

CREATE TABLE support_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  target_type VARCHAR(40) NOT NULL,
  target_id UUID,
  reason_code VARCHAR(80) NOT NULL,
  state VARCHAR(30) NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_support_reports_state_created ON support_reports(state, created_at);

CREATE TABLE report_integrity_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id UUID NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  year_month DATE NOT NULL,
  ledger_total_krw INTEGER NOT NULL,
  aggregate_total_krw INTEGER NOT NULL,
  matched BOOLEAN NOT NULL,
  checked_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_report_integrity_checks_matched_checked ON report_integrity_checks(matched, checked_at);
