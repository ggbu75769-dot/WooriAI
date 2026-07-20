-- Release 4 admin workflow: preserve the last author so review cannot be self-approved.
ALTER TABLE item_definitions
  ADD COLUMN last_edited_by_admin_id UUID REFERENCES admin_users(id) ON DELETE SET NULL;

CREATE INDEX idx_item_definitions_last_editor
  ON item_definitions(last_edited_by_admin_id)
  WHERE last_edited_by_admin_id IS NOT NULL;
