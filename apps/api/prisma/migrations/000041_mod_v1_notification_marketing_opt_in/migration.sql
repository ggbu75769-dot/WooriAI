ALTER TABLE "notification_preferences"
  ADD COLUMN "marketing_opt_in_at" TIMESTAMPTZ(6);

UPDATE "notification_preferences"
SET "marketing_opt_in_at" = "updated_at"
WHERE "marketing_enabled" = TRUE
  AND "marketing_opt_in_at" IS NULL;
