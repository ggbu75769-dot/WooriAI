CREATE TYPE content_status AS ENUM ('draft', 'reviewed', 'retired');

ALTER TABLE item_templates
  ADD COLUMN short_reason varchar(160) NOT NULL DEFAULT '',
  ADD COLUMN reviewed_at timestamptz(6),
  ADD COLUMN reviewed_by_admin_id uuid,
  ADD COLUMN next_review_at timestamptz(6),
  ADD COLUMN source_note text,
  ADD COLUMN content_status content_status NOT NULL DEFAULT 'draft';

CREATE INDEX idx_item_templates_content_status_active
  ON item_templates(content_status, active);
