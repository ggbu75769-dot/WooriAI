-- The in-memory import-row validator produces validation status strings such as
-- "low_confidence_duplicate_candidate" (35 chars), which exceeds the
-- import_rows.validation_status varchar(30) column from 000001_init. Widen it so
-- these values can actually be persisted.
ALTER TABLE import_rows ALTER COLUMN validation_status TYPE varchar(50);
