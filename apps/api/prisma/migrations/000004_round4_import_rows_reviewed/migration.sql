-- The in-memory import-row model tracked whether a user had manually reviewed/edited
-- a low-confidence preview row (userReviewed), which is what lets updateImportRow
-- clear the "low_confidence_duplicate_candidate" validation status once a human has
-- looked at the row. import_rows had no equivalent column.
ALTER TABLE import_rows ADD COLUMN IF NOT EXISTS user_reviewed boolean NOT NULL DEFAULT false;
