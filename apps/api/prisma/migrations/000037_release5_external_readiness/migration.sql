ALTER TABLE "item_alternatives"
  ADD COLUMN "evidence_source_id" UUID REFERENCES "item_evidence_sources"("id") ON DELETE RESTRICT,
  ADD COLUMN "approved_by_admin_id" UUID REFERENCES "admin_users"("id") ON DELETE SET NULL,
  ADD COLUMN "safety_approved_at" TIMESTAMPTZ(6),
  ADD COLUMN "active" BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE "product_offers"
  ADD COLUMN "currency" VARCHAR(3) NOT NULL DEFAULT 'KRW',
  ADD COLUMN "freshness_expires_at" TIMESTAMPTZ(6),
  ADD COLUMN "shipping_json" JSONB,
  ADD COLUMN "merchant_identity" VARCHAR(191),
  ADD COLUMN "content_hash" VARCHAR(64),
  ADD COLUMN "revision" INTEGER NOT NULL DEFAULT 1;

CREATE TABLE "recall_provider_events" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "provider_key" VARCHAR(80) NOT NULL,
  "provider_event_id" VARCHAR(191) NOT NULL, "provider_version" INTEGER NOT NULL,
  "event_status" VARCHAR(30) NOT NULL, "payload_hash" VARCHAR(64) NOT NULL,
  "raw_payload_json" JSONB NOT NULL, "raw_payload_expires_at" TIMESTAMPTZ(6) NOT NULL,
  "signature_valid" BOOLEAN NOT NULL, "item_definition_id" UUID REFERENCES "item_definitions"("id") ON DELETE SET NULL,
  "match_confidence" DECIMAL(5,4) NOT NULL DEFAULT 0, "review_state" VARCHAR(30) NOT NULL DEFAULT 'pending',
  "reviewed_by_admin_id" UUID REFERENCES "admin_users"("id") ON DELETE SET NULL, "reviewed_at" TIMESTAMPTZ(6),
  "normalized_guidance" TEXT NOT NULL, "source_url" TEXT, "occurred_at" TIMESTAMPTZ(6) NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1, "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "recall_provider_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ck_recall_provider_events_status" CHECK ("event_status" IN ('recalled', 'corrected', 'withdrawn', 'unknown')),
  CONSTRAINT "ck_recall_provider_events_review" CHECK ("review_state" IN ('pending', 'approved', 'rejected'))
);
CREATE UNIQUE INDEX "uq_recall_provider_event_version" ON "recall_provider_events"("provider_key", "provider_event_id", "provider_version");
CREATE INDEX "idx_recall_provider_event_current" ON "recall_provider_events"("provider_key", "provider_event_id", "provider_version");
CREATE INDEX "idx_recall_provider_events_review" ON "recall_provider_events"("review_state", "created_at");
CREATE INDEX "idx_recall_provider_events_item_status" ON "recall_provider_events"("item_definition_id", "event_status");

CREATE TABLE "merchant_feed_imports" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "requested_by_admin_id" UUID NOT NULL REFERENCES "admin_users"("id") ON DELETE RESTRICT,
  "source_name" VARCHAR(191) NOT NULL, "source_hash" VARCHAR(64) NOT NULL, "state" VARCHAR(30) NOT NULL DEFAULT 'preview_ready',
  "result_json" JSONB, "applied_at" TIMESTAMPTZ(6), "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "merchant_feed_imports_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "uq_merchant_feed_imports_source_hash" ON "merchant_feed_imports"("source_hash");
CREATE INDEX "idx_merchant_feed_imports_state_created" ON "merchant_feed_imports"("state", "created_at");

CREATE TABLE "merchant_feed_rows" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "import_id" UUID NOT NULL REFERENCES "merchant_feed_imports"("id") ON DELETE CASCADE,
  "row_index" INTEGER NOT NULL, "merchant_identity" VARCHAR(191) NOT NULL, "item_definition_id" UUID REFERENCES "item_definitions"("id") ON DELETE RESTRICT,
  "product_name" VARCHAR(200) NOT NULL, "public_url" TEXT NOT NULL, "price_krw" INTEGER NOT NULL, "currency" VARCHAR(3) NOT NULL,
  "stock_state" VARCHAR(30) NOT NULL, "shipping_json" JSONB, "affiliate" BOOLEAN NOT NULL DEFAULT FALSE,
  "disclosure_text" VARCHAR(240), "price_checked_at" TIMESTAMPTZ(6) NOT NULL, "content_hash" VARCHAR(64) NOT NULL,
  "validation_state" VARCHAR(30) NOT NULL, "validation_errors" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "review_state" VARCHAR(30) NOT NULL DEFAULT 'pending', "reviewed_by_admin_id" UUID REFERENCES "admin_users"("id") ON DELETE SET NULL,
  "reviewed_at" TIMESTAMPTZ(6), "published_by_admin_id" UUID REFERENCES "admin_users"("id") ON DELETE SET NULL,
  "product_offer_id" UUID REFERENCES "product_offers"("id") ON DELETE SET NULL, "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "merchant_feed_rows_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ck_merchant_feed_rows_validation" CHECK ("validation_state" IN ('valid', 'invalid')),
  CONSTRAINT "ck_merchant_feed_rows_review" CHECK ("review_state" IN ('pending', 'approved', 'rejected', 'published'))
);
CREATE UNIQUE INDEX "uq_merchant_feed_rows_import_index" ON "merchant_feed_rows"("import_id", "row_index");
CREATE INDEX "idx_merchant_feed_rows_worklist" ON "merchant_feed_rows"("import_id", "validation_state", "review_state");
CREATE INDEX "idx_merchant_feed_rows_item_review" ON "merchant_feed_rows"("item_definition_id", "review_state");
