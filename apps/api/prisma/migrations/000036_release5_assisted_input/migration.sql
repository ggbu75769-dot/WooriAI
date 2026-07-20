ALTER TYPE "expense_source" ADD VALUE IF NOT EXISTS 'receipt';

ALTER TABLE "user_item_plans"
  ADD COLUMN "prediction_enabled" BOOLEAN NOT NULL DEFAULT TRUE;

CREATE TABLE "receipt_drafts" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "household_id" UUID NOT NULL REFERENCES "households"("id") ON DELETE CASCADE,
  "child_id" UUID NOT NULL REFERENCES "children"("id") ON DELETE CASCADE,
  "created_by_user_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "content_hash" VARCHAR(64) NOT NULL,
  "file_name" VARCHAR(191) NOT NULL,
  "mime_type" VARCHAR(80) NOT NULL,
  "file_size_bytes" INTEGER NOT NULL,
  "object_key" VARCHAR(500),
  "status" VARCHAR(30) NOT NULL DEFAULT 'draft',
  "extraction_provider" VARCHAR(40),
  "extraction_json" JSONB,
  "confirmed_expense_id" UUID REFERENCES "expenses"("id") ON DELETE SET NULL,
  "retention_until" TIMESTAMPTZ(6),
  "deleted_at" TIMESTAMPTZ(6),
  "version" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "receipt_drafts_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ck_receipt_drafts_hash" CHECK ("content_hash" ~ '^[0-9a-f]{64}$'),
  CONSTRAINT "ck_receipt_drafts_size" CHECK ("file_size_bytes" > 0 AND "file_size_bytes" <= 15728640),
  CONSTRAINT "ck_receipt_drafts_status" CHECK ("status" IN ('draft', 'extracting', 'review_ready', 'extraction_failed', 'confirmed', 'deleted'))
);
CREATE UNIQUE INDEX "uq_receipt_drafts_household_hash" ON "receipt_drafts"("household_id", "content_hash");
CREATE INDEX "idx_receipt_drafts_user_created" ON "receipt_drafts"("created_by_user_id", "created_at");
CREATE INDEX "idx_receipt_drafts_scope_status" ON "receipt_drafts"("household_id", "child_id", "status");

CREATE TABLE "receipt_confirmations" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "receipt_draft_id" UUID NOT NULL REFERENCES "receipt_drafts"("id") ON DELETE CASCADE,
  "requested_by_user_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "idempotency_key" VARCHAR(191) NOT NULL,
  "expense_id" UUID NOT NULL REFERENCES "expenses"("id") ON DELETE RESTRICT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "receipt_confirmations_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "receipt_confirmations_idempotency_key_key" ON "receipt_confirmations"("idempotency_key");
CREATE INDEX "idx_receipt_confirmations_draft_created" ON "receipt_confirmations"("receipt_draft_id", "created_at");

CREATE TABLE "expense_plan_link_events" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "expense_id" UUID NOT NULL REFERENCES "expenses"("id") ON DELETE CASCADE,
  "plan_id" UUID NOT NULL REFERENCES "user_item_plans"("id") ON DELETE CASCADE,
  "actor_user_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "action" VARCHAR(20) NOT NULL,
  "reason_code" VARCHAR(80) NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "expense_plan_link_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ck_expense_plan_link_events_action" CHECK ("action" IN ('linked', 'unlinked'))
);
CREATE INDEX "idx_expense_plan_link_events_expense" ON "expense_plan_link_events"("expense_id", "created_at");
CREATE INDEX "idx_expense_plan_link_events_plan" ON "expense_plan_link_events"("plan_id", "created_at");
