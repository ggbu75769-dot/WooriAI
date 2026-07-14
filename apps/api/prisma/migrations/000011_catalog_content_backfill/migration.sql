-- Preserve the already-published Sprint 1 catalog during a deploy even before
-- the idempotent Sprint 2 catalog import runs.
UPDATE item_templates
SET short_reason = LEFT(reason_text, 160),
    reviewed_at = COALESCE(updated_at, now()),
    source_note = 'Backfilled by 000011_catalog_content_backfill',
    content_status = 'reviewed'
WHERE active = true
  AND content_status = 'draft';
