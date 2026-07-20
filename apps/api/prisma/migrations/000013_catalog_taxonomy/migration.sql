-- Release 4A/4B: additive catalog hierarchy and explicit coverage decisions.

CREATE TYPE catalog_node_level AS ENUM ('domain', 'category', 'subcategory');
CREATE TYPE lifecycle_axis AS ENUM ('mother', 'child');
CREATE TYPE item_necessity AS ENUM ('required', 'recommended', 'conditional', 'optional');
CREATE TYPE catalog_coverage_state AS ENUM ('covered', 'not_applicable', 'gap');

CREATE TABLE catalog_nodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(80) NOT NULL UNIQUE,
  parent_id UUID REFERENCES catalog_nodes(id) ON DELETE RESTRICT,
  level catalog_node_level NOT NULL,
  name_ko VARCHAR(100) NOT NULL,
  description TEXT,
  icon_key VARCHAR(80),
  display_order INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT ck_catalog_nodes_version CHECK (version > 0),
  CONSTRAINT ck_catalog_nodes_not_self_parent CHECK (parent_id IS NULL OR parent_id <> id),
  CONSTRAINT ck_catalog_nodes_domain_root CHECK (level <> 'domain' OR parent_id IS NULL)
);
CREATE INDEX idx_catalog_nodes_parent_order ON catalog_nodes(parent_id, display_order);
CREATE INDEX idx_catalog_nodes_level_active_order ON catalog_nodes(level, active, display_order);

CREATE TABLE catalog_coverage_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain_node_id UUID NOT NULL REFERENCES catalog_nodes(id) ON DELETE CASCADE,
  lifecycle_axis lifecycle_axis NOT NULL,
  lifecycle_code VARCHAR(60) NOT NULL,
  context_code VARCHAR(60) NOT NULL,
  necessity item_necessity NOT NULL,
  state catalog_coverage_state NOT NULL,
  reason TEXT,
  approved_by_admin_id UUID REFERENCES admin_users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ(6),
  created_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_catalog_coverage_cell UNIQUE(
    domain_node_id, lifecycle_axis, lifecycle_code, context_code, necessity
  ),
  CONSTRAINT ck_catalog_coverage_not_applicable_approval CHECK (
    state <> 'not_applicable' OR (reason IS NOT NULL AND approved_by_admin_id IS NOT NULL AND approved_at IS NOT NULL)
  )
);
CREATE INDEX idx_catalog_coverage_state_lifecycle
  ON catalog_coverage_decisions(state, lifecycle_axis, lifecycle_code);

