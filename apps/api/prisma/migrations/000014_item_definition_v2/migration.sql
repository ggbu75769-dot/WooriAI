-- Release 4B: separate canonical needs from sellable offers and accounting categories.

CREATE TYPE target_subject AS ENUM ('mother', 'child', 'caregiver', 'household', 'shared');
CREATE TYPE recommendation_state AS ENUM (
  'recommended', 'conditional', 'professional_review_required',
  'not_recommended', 'recalled_or_blocked', 'retired'
);
CREATE TYPE secondhand_policy AS ENUM ('allowed', 'inspect', 'avoid', 'prohibited');
CREATE TYPE rental_policy AS ENUM ('suitable', 'conditional', 'unsuitable');
CREATE TYPE safety_tier AS ENUM ('normal', 'elevated', 'high');
CREATE TYPE catalog_review_status AS ENUM ('draft', 'in_review', 'published', 'retired');
CREATE TYPE offer_stock_state AS ENUM ('in_stock', 'out_of_stock', 'preorder', 'discontinued', 'unknown');
CREATE TYPE offer_recall_state AS ENUM ('clear', 'check_required', 'recalled', 'unknown');
CREATE TYPE offer_health_state AS ENUM ('healthy', 'stale', 'failed', 'blocked');

CREATE TABLE item_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(100) NOT NULL UNIQUE,
  legacy_item_template_id UUID UNIQUE REFERENCES item_templates(id) ON DELETE SET NULL,
  name_ko VARCHAR(120) NOT NULL,
  short_description VARCHAR(240) NOT NULL,
  target_subject target_subject NOT NULL,
  necessity item_necessity NOT NULL,
  recommendation_state recommendation_state NOT NULL,
  reason_text TEXT NOT NULL,
  skip_reason_text TEXT,
  quantity_guidance VARCHAR(240),
  timing_summary VARCHAR(240) NOT NULL,
  price_min_krw INTEGER,
  price_max_krw INTEGER,
  price_checked_at TIMESTAMPTZ(6),
  secondhand_policy secondhand_policy NOT NULL,
  rental_policy rental_policy NOT NULL,
  safety_tier safety_tier NOT NULL,
  safety_note TEXT,
  medical_disclaimer_required BOOLEAN NOT NULL DEFAULT false,
  source_summary TEXT NOT NULL,
  content_version INTEGER NOT NULL DEFAULT 1,
  reviewed_at TIMESTAMPTZ(6),
  reviewed_by_admin_id UUID REFERENCES admin_users(id) ON DELETE SET NULL,
  status catalog_review_status NOT NULL DEFAULT 'draft',
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT ck_item_definitions_price_range CHECK (
    (price_min_krw IS NULL OR price_min_krw >= 0) AND
    (price_max_krw IS NULL OR price_max_krw >= 0) AND
    (price_min_krw IS NULL OR price_max_krw IS NULL OR price_min_krw <= price_max_krw)
  ),
  CONSTRAINT ck_item_definitions_content_version CHECK (content_version > 0),
  CONSTRAINT ck_item_definitions_published_review CHECK (
    status <> 'published' OR (reviewed_at IS NOT NULL AND reviewed_by_admin_id IS NOT NULL)
  ),
  CONSTRAINT ck_item_definitions_high_risk_review CHECK (
    safety_tier <> 'high' OR status <> 'published' OR recommendation_state IN ('professional_review_required', 'not_recommended', 'recalled_or_blocked')
  )
);
CREATE INDEX idx_item_definitions_status_order ON item_definitions(status, display_order);
CREATE INDEX idx_item_definitions_subject_necessity ON item_definitions(target_subject, necessity);
CREATE INDEX idx_item_definitions_safety_status ON item_definitions(safety_tier, status);

CREATE TABLE item_definition_categories (
  item_definition_id UUID NOT NULL REFERENCES item_definitions(id) ON DELETE CASCADE,
  catalog_node_id UUID NOT NULL REFERENCES catalog_nodes(id) ON DELETE RESTRICT,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  display_order INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY(item_definition_id, catalog_node_id)
);
CREATE INDEX idx_item_definition_categories_node_primary
  ON item_definition_categories(catalog_node_id, is_primary);
CREATE UNIQUE INDEX uq_item_definition_categories_one_primary
  ON item_definition_categories(item_definition_id) WHERE is_primary;

CREATE TABLE item_lifecycle_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_definition_id UUID NOT NULL REFERENCES item_definitions(id) ON DELETE CASCADE,
  axis lifecycle_axis NOT NULL,
  lifecycle_code VARCHAR(60) NOT NULL,
  timing_text VARCHAR(240),
  priority_weight INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_item_lifecycle_rule UNIQUE(item_definition_id, axis, lifecycle_code)
);
CREATE INDEX idx_item_lifecycle_rules_stage
  ON item_lifecycle_rules(axis, lifecycle_code, priority_weight);

CREATE TABLE item_context_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_definition_id UUID NOT NULL REFERENCES item_definitions(id) ON DELETE CASCADE,
  context_code VARCHAR(60) NOT NULL,
  weight INTEGER NOT NULL DEFAULT 0,
  required BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_item_context_rule UNIQUE(item_definition_id, context_code)
);
CREATE INDEX idx_item_context_rules_context_weight ON item_context_rules(context_code, weight);

CREATE TABLE item_attributes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_definition_id UUID NOT NULL REFERENCES item_definitions(id) ON DELETE CASCADE,
  attribute_key VARCHAR(80) NOT NULL,
  value_json JSONB NOT NULL,
  created_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_item_attribute UNIQUE(item_definition_id, attribute_key)
);

CREATE TABLE item_evidence_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_definition_id UUID NOT NULL REFERENCES item_definitions(id) ON DELETE CASCADE,
  source_type VARCHAR(40) NOT NULL,
  title VARCHAR(240) NOT NULL,
  public_url TEXT NOT NULL,
  publisher VARCHAR(160),
  published_at TIMESTAMPTZ(6),
  checked_at TIMESTAMPTZ(6) NOT NULL,
  created_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT ck_item_evidence_sources_url CHECK (public_url ~ '^https://')
);
CREATE INDEX idx_item_evidence_sources_item_checked
  ON item_evidence_sources(item_definition_id, checked_at);

CREATE TABLE item_safety_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_definition_id UUID NOT NULL REFERENCES item_definitions(id) ON DELETE CASCADE,
  rule_code VARCHAR(80) NOT NULL,
  severity safety_tier NOT NULL,
  guidance_text TEXT NOT NULL,
  blocks_recommendation BOOLEAN NOT NULL DEFAULT false,
  reviewed_at TIMESTAMPTZ(6),
  expires_at TIMESTAMPTZ(6),
  created_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_item_safety_rule UNIQUE(item_definition_id, rule_code)
);
CREATE INDEX idx_item_safety_rules_severity_expiry ON item_safety_rules(severity, expires_at);

CREATE TABLE item_alternatives (
  item_definition_id UUID NOT NULL REFERENCES item_definitions(id) ON DELETE CASCADE,
  alternative_item_definition_id UUID NOT NULL REFERENCES item_definitions(id) ON DELETE CASCADE,
  reason VARCHAR(240) NOT NULL,
  PRIMARY KEY(item_definition_id, alternative_item_definition_id),
  CONSTRAINT ck_item_alternatives_not_self CHECK (item_definition_id <> alternative_item_definition_id)
);

CREATE TABLE item_dependencies (
  item_definition_id UUID NOT NULL REFERENCES item_definitions(id) ON DELETE CASCADE,
  dependency_item_definition_id UUID NOT NULL REFERENCES item_definitions(id) ON DELETE CASCADE,
  required BOOLEAN NOT NULL DEFAULT false,
  reason VARCHAR(240) NOT NULL,
  PRIMARY KEY(item_definition_id, dependency_item_definition_id),
  CONSTRAINT ck_item_dependencies_not_self CHECK (item_definition_id <> dependency_item_definition_id)
);

CREATE TABLE item_bundles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(100) NOT NULL UNIQUE,
  name_ko VARCHAR(120) NOT NULL,
  description TEXT NOT NULL,
  lifecycle_axis lifecycle_axis,
  lifecycle_code VARCHAR(60),
  context_code VARCHAR(60),
  status catalog_review_status NOT NULL DEFAULT 'draft',
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_item_bundles_status_order ON item_bundles(status, display_order);

CREATE TABLE item_bundle_members (
  bundle_id UUID NOT NULL REFERENCES item_bundles(id) ON DELETE CASCADE,
  item_definition_id UUID NOT NULL REFERENCES item_definitions(id) ON DELETE CASCADE,
  necessity item_necessity NOT NULL,
  default_quantity INTEGER,
  display_order INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY(bundle_id, item_definition_id),
  CONSTRAINT ck_item_bundle_members_quantity CHECK (default_quantity IS NULL OR default_quantity > 0)
);
CREATE INDEX idx_item_bundle_members_item ON item_bundle_members(item_definition_id);

CREATE TABLE product_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_definition_id UUID NOT NULL REFERENCES item_definitions(id) ON DELETE CASCADE,
  legacy_product_link_id UUID UNIQUE REFERENCES product_links(id) ON DELETE SET NULL,
  seller VARCHAR(120) NOT NULL,
  brand VARCHAR(120),
  product_name VARCHAR(200) NOT NULL,
  model_name VARCHAR(160),
  variant VARCHAR(160),
  public_url TEXT NOT NULL,
  affiliate_url TEXT,
  is_affiliate BOOLEAN NOT NULL DEFAULT false,
  is_sponsored BOOLEAN NOT NULL DEFAULT false,
  disclosure_text VARCHAR(240),
  price_snapshot_krw INTEGER,
  price_checked_at TIMESTAMPTZ(6),
  stock_state offer_stock_state NOT NULL DEFAULT 'unknown',
  certification_refs_json JSONB,
  recall_state offer_recall_state NOT NULL DEFAULT 'unknown',
  health_state offer_health_state NOT NULL DEFAULT 'stale',
  active BOOLEAN NOT NULL DEFAULT true,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT ck_product_offers_public_url CHECK (public_url ~ '^https://'),
  CONSTRAINT ck_product_offers_price CHECK (price_snapshot_krw IS NULL OR price_snapshot_krw >= 0),
  CONSTRAINT ck_product_offers_affiliate_disclosure CHECK (
    NOT is_affiliate OR (affiliate_url IS NOT NULL AND disclosure_text IS NOT NULL)
  )
);
CREATE INDEX idx_product_offers_item_active_order
  ON product_offers(item_definition_id, active, display_order);
CREATE INDEX idx_product_offers_health_recall ON product_offers(health_state, recall_state);

-- Backfill reviewed Release 3 canonical entries. No development/example offer is promoted.
INSERT INTO item_definitions (
  code, legacy_item_template_id, name_ko, short_description, target_subject,
  necessity, recommendation_state, reason_text, skip_reason_text,
  quantity_guidance, timing_summary, price_min_krw, price_max_krw,
  secondhand_policy, rental_policy, safety_tier, safety_note,
  medical_disclaimer_required, source_summary, content_version, reviewed_at,
  reviewed_by_admin_id, status, display_order, created_at, updated_at
)
SELECT
  template.code,
  template.id,
  template.name,
  template.short_reason,
  CASE WHEN EXISTS (
    SELECT 1 FROM item_template_stages stage
    WHERE stage.item_template_id = template.id
      AND stage.stage_code IN ('pregnancy_early', 'pregnancy_mid', 'pregnancy_late')
  ) THEN 'mother'::target_subject ELSE 'child'::target_subject END,
  CASE template.necessity_level
    WHEN 'essential' THEN 'required'::item_necessity
    WHEN 'convenience' THEN 'recommended'::item_necessity
    ELSE 'optional'::item_necessity
  END,
  CASE WHEN template.medical_disclaimer_required
    THEN 'professional_review_required'::recommendation_state
    ELSE 'recommended'::recommendation_state
  END,
  template.reason_text,
  template.skip_reason_text,
  NULL,
  COALESCE(template.timing_label, '사용자 상황에 맞춰 준비 시기를 확인하세요.'),
  template.price_min_krw,
  template.price_max_krw,
  CASE WHEN template.used_secondhand_ok THEN 'allowed'::secondhand_policy ELSE 'inspect'::secondhand_policy END,
  'conditional'::rental_policy,
  CASE
    WHEN template.medical_disclaimer_required THEN 'high'::safety_tier
    WHEN template.safety_note IS NOT NULL THEN 'elevated'::safety_tier
    ELSE 'normal'::safety_tier
  END,
  template.safety_note,
  template.medical_disclaimer_required,
  COALESCE(template.source_note, 'Release 3 reviewed catalog backfill'),
  template.content_version,
  template.reviewed_at,
  template.reviewed_by_admin_id,
  CASE template.content_status
    WHEN 'reviewed' THEN CASE WHEN template.reviewed_by_admin_id IS NULL THEN 'in_review'::catalog_review_status ELSE 'published'::catalog_review_status END
    WHEN 'retired' THEN 'retired'::catalog_review_status
    ELSE 'draft'::catalog_review_status
  END,
  template.display_order,
  template.created_at,
  template.updated_at
FROM item_templates template
ON CONFLICT (code) DO NOTHING;

INSERT INTO item_lifecycle_rules (
  item_definition_id, axis, lifecycle_code, timing_text, priority_weight, created_at
)
SELECT
  definition.id,
  CASE WHEN stage.stage_code IN ('pregnancy_early', 'pregnancy_mid', 'pregnancy_late')
    THEN 'mother'::lifecycle_axis ELSE 'child'::lifecycle_axis END,
  CASE stage.stage_code
    WHEN 'pregnancy_early' THEN 'pregnancy_early'
    WHEN 'pregnancy_mid' THEN 'pregnancy_mid'
    WHEN 'pregnancy_late' THEN 'pregnancy_late'
    WHEN 'newborn_0_3' THEN 'newborn_0_3m'
    WHEN 'infant_4_6' THEN 'infant_4_6m'
    WHEN 'infant_7_12' THEN 'infant_7_12m'
    WHEN 'toddler_1_3' THEN 'toddler_1_2y'
    WHEN 'kid_4_7' THEN 'preschool_4_5y'
    WHEN 'elementary' THEN 'elementary_lower'
    WHEN 'middle_school' THEN 'middle_school'
  END,
  definition.timing_summary,
  stage.priority_weight,
  stage.created_at
FROM item_template_stages stage
JOIN item_definitions definition ON definition.legacy_item_template_id = stage.item_template_id
ON CONFLICT (item_definition_id, axis, lifecycle_code) DO NOTHING;

INSERT INTO product_offers (
  item_definition_id, legacy_product_link_id, seller, product_name, public_url,
  affiliate_url, is_affiliate, is_sponsored, disclosure_text,
  price_snapshot_krw, price_checked_at, active, display_order, created_at, updated_at
)
SELECT
  definition.id,
  link.id,
  link.platform::text,
  link.title,
  link.url,
  link.affiliate_url,
  link.is_affiliate,
  link.is_sponsored,
  link.disclosure_text,
  link.price_snapshot_krw,
  link.price_checked_at,
  link.active,
  link.display_order,
  link.created_at,
  link.updated_at
FROM product_links link
JOIN item_definitions definition ON definition.legacy_item_template_id = link.item_template_id
WHERE link.url NOT LIKE 'https://example.com/%'
ON CONFLICT (legacy_product_link_id) DO NOTHING;
