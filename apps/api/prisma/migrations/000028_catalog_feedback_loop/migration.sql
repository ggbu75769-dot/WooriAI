ALTER TABLE "catalog_item_reports"
  ALTER COLUMN "item_definition_id" DROP NOT NULL,
  ADD COLUMN "reported_text" VARCHAR(160),
  ADD COLUMN "query_hash" VARCHAR(64),
  ADD COLUMN "resolution_note" TEXT,
  ADD COLUMN "user_notified_at" TIMESTAMPTZ(6);

CREATE INDEX "idx_catalog_item_reports_query_hash_state"
  ON "catalog_item_reports"("query_hash", "state");
