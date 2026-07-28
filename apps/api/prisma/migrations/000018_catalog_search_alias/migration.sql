-- Release 4C: normalized search aliases. Alias rows remain tied to one canonical need.

CREATE TYPE catalog_import_state AS ENUM ('uploaded', 'validating', 'ready', 'applied', 'rejected', 'failed');

CREATE TABLE item_synonyms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_definition_id UUID NOT NULL REFERENCES item_definitions(id) ON DELETE CASCADE,
  synonym VARCHAR(160) NOT NULL,
  normalized_synonym VARCHAR(160) NOT NULL,
  locale VARCHAR(20) NOT NULL DEFAULT 'ko-KR',
  created_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_item_synonyms_item_normalized_locale UNIQUE(
    item_definition_id, normalized_synonym, locale
  )
);
CREATE INDEX idx_item_synonyms_normalized_locale ON item_synonyms(normalized_synonym, locale);

CREATE TABLE catalog_imports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requested_by_admin_id UUID NOT NULL REFERENCES admin_users(id) ON DELETE RESTRICT,
  state catalog_import_state NOT NULL DEFAULT 'uploaded',
  source_name VARCHAR(200) NOT NULL,
  source_hash VARCHAR(64) NOT NULL,
  row_count INTEGER NOT NULL DEFAULT 0,
  validation_json JSONB,
  applied_at TIMESTAMPTZ(6),
  created_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_catalog_imports_source_hash UNIQUE(source_hash),
  CONSTRAINT ck_catalog_imports_hash CHECK (source_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT ck_catalog_imports_row_count CHECK (row_count >= 0)
);
CREATE INDEX idx_catalog_imports_state_created ON catalog_imports(state, created_at);

CREATE TABLE catalog_item_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_definition_id UUID NOT NULL REFERENCES item_definitions(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  reason_code VARCHAR(80) NOT NULL,
  detail TEXT,
  state VARCHAR(30) NOT NULL DEFAULT 'open',
  resolved_by_admin_id UUID REFERENCES admin_users(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ(6),
  created_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_catalog_item_reports_item_state
  ON catalog_item_reports(item_definition_id, state, created_at);

-- Canonical name is always a searchable alias; additional curated aliases arrive via seed/import.
INSERT INTO item_synonyms (item_definition_id, synonym, normalized_synonym)
SELECT id, name_ko, lower(regexp_replace(name_ko, '[[:space:][:punct:]]+', '', 'g'))
FROM item_definitions
ON CONFLICT (item_definition_id, normalized_synonym, locale) DO NOTHING;

