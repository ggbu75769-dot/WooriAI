ALTER TABLE "product_offers"
  ADD COLUMN "comparison_attributes_json" JSONB,
  ADD COLUMN "created_by_admin_id" UUID REFERENCES "admin_users"("id") ON DELETE SET NULL,
  ADD COLUMN "approved_by_admin_id" UUID REFERENCES "admin_users"("id") ON DELETE SET NULL,
  ADD COLUMN "approved_at" TIMESTAMPTZ(6);

-- Legacy-migrated offers have no reviewer provenance. Quarantine them instead of
-- inventing approval metadata; they remain available to the admin review queue.
UPDATE "product_offers" SET "active" = FALSE WHERE "active" = TRUE;

ALTER TABLE "product_offers"
  ADD CONSTRAINT "ck_product_offers_active_approval" CHECK (NOT "active" OR ("approved_by_admin_id" IS NOT NULL AND "approved_at" IS NOT NULL));

CREATE INDEX "idx_product_offers_approval" ON "product_offers"("active", "approved_at");
