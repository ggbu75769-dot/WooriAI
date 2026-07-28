-- Release 4C: revision-bound catalog review and publish separation.
ALTER TYPE catalog_review_status ADD VALUE IF NOT EXISTS 'review_requested';
ALTER TYPE catalog_review_status ADD VALUE IF NOT EXISTS 'editorial_review';
ALTER TYPE catalog_review_status ADD VALUE IF NOT EXISTS 'domain_review';
ALTER TYPE catalog_review_status ADD VALUE IF NOT EXISTS 'safety_review';
ALTER TYPE catalog_review_status ADD VALUE IF NOT EXISTS 'changes_requested';
ALTER TYPE catalog_review_status ADD VALUE IF NOT EXISTS 'approved';
ALTER TYPE catalog_review_status ADD VALUE IF NOT EXISTS 'scheduled';
ALTER TYPE catalog_review_status ADD VALUE IF NOT EXISTS 'suspended';
ALTER TYPE catalog_review_status ADD VALUE IF NOT EXISTS 'recalled';
ALTER TYPE catalog_review_status ADD VALUE IF NOT EXISTS 'archived';

CREATE TYPE catalog_approval_type AS ENUM ('editorial', 'domain', 'safety');

ALTER TABLE item_definitions
  ADD COLUMN content_hash VARCHAR(64),
  ADD COLUMN published_by_admin_id UUID REFERENCES admin_users(id) ON DELETE SET NULL,
  ADD COLUMN published_at TIMESTAMPTZ(6),
  ADD COLUMN scheduled_at TIMESTAMPTZ(6);

CREATE TABLE catalog_item_revisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_definition_id UUID NOT NULL REFERENCES item_definitions(id) ON DELETE CASCADE,
  revision INTEGER NOT NULL,
  content_hash VARCHAR(64) NOT NULL,
  payload_json JSONB NOT NULL,
  authored_by_admin_id UUID NOT NULL REFERENCES admin_users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_catalog_item_revisions_item_revision UNIQUE (item_definition_id, revision),
  CONSTRAINT ck_catalog_item_revisions_revision CHECK (revision > 0),
  CONSTRAINT ck_catalog_item_revisions_hash CHECK (content_hash ~ '^[0-9a-f]{64}$')
);
CREATE INDEX idx_catalog_item_revisions_item_created ON catalog_item_revisions(item_definition_id, created_at DESC);

CREATE TABLE catalog_item_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_definition_id UUID NOT NULL REFERENCES item_definitions(id) ON DELETE CASCADE,
  revision INTEGER NOT NULL,
  content_hash VARCHAR(64) NOT NULL,
  approval_type catalog_approval_type NOT NULL,
  reviewed_by_admin_id UUID NOT NULL REFERENCES admin_users(id) ON DELETE RESTRICT,
  evidence_url TEXT,
  evidence_title VARCHAR(240),
  expires_at TIMESTAMPTZ(6),
  created_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_catalog_item_approvals_revision_type UNIQUE (item_definition_id, revision, approval_type),
  CONSTRAINT ck_catalog_item_approvals_revision CHECK (revision > 0),
  CONSTRAINT ck_catalog_item_approvals_hash CHECK (content_hash ~ '^[0-9a-f]{64}$')
);
CREATE INDEX idx_catalog_item_approvals_type_expiry ON catalog_item_approvals(approval_type, expires_at);

CREATE TABLE catalog_reviewer_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  approval_type catalog_approval_type NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  expires_at TIMESTAMPTZ(6),
  created_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_catalog_reviewer_credentials_admin_type UNIQUE (admin_id, approval_type)
);
CREATE INDEX idx_catalog_reviewer_credentials_active ON catalog_reviewer_credentials(approval_type, active, expires_at);

CREATE TABLE catalog_item_workflow_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_definition_id UUID NOT NULL REFERENCES item_definitions(id) ON DELETE CASCADE,
  actor_admin_id UUID NOT NULL REFERENCES admin_users(id) ON DELETE RESTRICT,
  revision INTEGER NOT NULL,
  content_hash VARCHAR(64) NOT NULL,
  from_status catalog_review_status NOT NULL,
  to_status catalog_review_status NOT NULL,
  metadata_json JSONB,
  created_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT ck_catalog_item_workflow_events_revision CHECK (revision > 0),
  CONSTRAINT ck_catalog_item_workflow_events_hash CHECK (content_hash ~ '^[0-9a-f]{64}$')
);
CREATE INDEX idx_catalog_item_workflow_events_item_created ON catalog_item_workflow_events(item_definition_id, created_at DESC);

CREATE INDEX idx_item_definitions_content_hash ON item_definitions(content_hash) WHERE content_hash IS NOT NULL;
CREATE INDEX idx_item_definitions_publisher ON item_definitions(published_by_admin_id) WHERE published_by_admin_id IS NOT NULL;
