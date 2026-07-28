ALTER TABLE "legal_documents"
  ADD COLUMN "approved_by_admin_id" UUID,
  ADD COLUMN "approved_at" TIMESTAMPTZ(6),
  ADD COLUMN "approval_note" VARCHAR(500),
  ADD COLUMN "revision" INTEGER NOT NULL DEFAULT 1;

CREATE INDEX "idx_legal_documents_approval"
  ON "legal_documents"("document_type", "locale", "approved_at", "effective_at");

ALTER TABLE "item_evidence_sources"
  ADD COLUMN "revision" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "content_hash" VARCHAR(64),
  ADD COLUMN "captured_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "captured_by_admin_id" UUID,
  ADD COLUMN "reviewed_by_admin_id" UUID,
  ADD COLUMN "applicable_claims_json" JSONB,
  ADD COLUMN "expires_at" TIMESTAMPTZ(6),
  ADD COLUMN "review_due_at" TIMESTAMPTZ(6),
  ADD COLUMN "status" VARCHAR(30) NOT NULL DEFAULT 'draft';

CREATE INDEX "idx_item_evidence_sources_readiness"
  ON "item_evidence_sources"("item_definition_id", "revision", "status", "review_due_at");

CREATE TABLE "catalog_pilot_manifests" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "created_by_admin_id" UUID NOT NULL,
  "content_hash" VARCHAR(64) NOT NULL,
  "item_ids" UUID[] NOT NULL,
  "expected_revisions_json" JSONB NOT NULL,
  "status" VARCHAR(30) NOT NULL DEFAULT 'preview',
  "result_json" JSONB,
  "applied_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "catalog_pilot_manifests_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "idx_catalog_pilot_manifests_status_created"
  ON "catalog_pilot_manifests"("status", "created_at");
