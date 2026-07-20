ALTER TYPE "notification_delivery_state" ADD VALUE IF NOT EXISTS 'unknown';

ALTER TYPE "catalog_import_state" ADD VALUE IF NOT EXISTS 'uploading';
ALTER TYPE "catalog_import_state" ADD VALUE IF NOT EXISTS 'previewing';
ALTER TYPE "catalog_import_state" ADD VALUE IF NOT EXISTS 'applying';
ALTER TYPE "catalog_import_state" ADD VALUE IF NOT EXISTS 'retryable_failure';
ALTER TYPE "catalog_import_state" ADD VALUE IF NOT EXISTS 'permanent_failure';
ALTER TYPE "catalog_import_state" ADD VALUE IF NOT EXISTS 'orphaned';
ALTER TYPE "catalog_import_state" ADD VALUE IF NOT EXISTS 'missing_object';
ALTER TYPE "catalog_import_state" ADD VALUE IF NOT EXISTS 'rolled_back';

ALTER TABLE "job_outbox"
  ADD COLUMN "claimed_by" VARCHAR(191),
  ADD COLUMN "claim_expires_at" TIMESTAMPTZ(6);

UPDATE "job_outbox"
SET "claim_expires_at" = "claimed_at" + INTERVAL '5 minutes'
WHERE "claimed_at" IS NOT NULL AND "published_at" IS NULL;

CREATE INDEX "idx_job_outbox_claim_expiry" ON "job_outbox"("published_at", "claim_expires_at");

CREATE TABLE "notification_delivery_attempts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "notification_delivery_id" UUID NOT NULL,
    "attempt_number" INTEGER NOT NULL,
    "provider_mode" VARCHAR(30) NOT NULL,
    "provider_idempotency_key" VARCHAR(191) NOT NULL,
    "provider_delivery_id" VARCHAR(191),
    "state" VARCHAR(30) NOT NULL,
    "failure_code" VARCHAR(80),
    "started_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ(6),
    "reconciled_at" TIMESTAMPTZ(6),
    CONSTRAINT "notification_delivery_attempts_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "notification_delivery_attempts_notification_delivery_id_fkey"
      FOREIGN KEY ("notification_delivery_id") REFERENCES "notification_deliveries"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX "notification_delivery_attempts_provider_idempotency_key_key"
  ON "notification_delivery_attempts"("provider_idempotency_key");
CREATE UNIQUE INDEX "uq_notification_delivery_attempt_number"
  ON "notification_delivery_attempts"("notification_delivery_id", "attempt_number");
CREATE INDEX "idx_notification_delivery_attempts_state_started"
  ON "notification_delivery_attempts"("state", "started_at");

CREATE TABLE "remote_config_revisions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "config_key" VARCHAR(80) NOT NULL,
    "version" INTEGER NOT NULL,
    "value_json" JSONB NOT NULL,
    "content_hash" VARCHAR(64) NOT NULL,
    "action" VARCHAR(20) NOT NULL,
    "actor_admin_id" UUID,
    "reason" VARCHAR(500) NOT NULL,
    "activated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "remote_config_revisions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "uq_remote_config_revisions_key_version"
  ON "remote_config_revisions"("config_key", "version");
CREATE INDEX "idx_remote_config_revisions_key_created"
  ON "remote_config_revisions"("config_key", "created_at");

INSERT INTO "remote_config_revisions" (
  "config_key", "version", "value_json", "content_hash", "action", "actor_admin_id", "reason", "activated_at"
)
SELECT
  "config_key",
  "version",
  "value_json",
  encode(digest("value_json"::text, 'sha256'), 'hex'),
  'initial',
  "updated_by_admin_id",
  'Migration 33 baseline',
  "updated_at"
FROM "remote_configs"
ON CONFLICT ("config_key", "version") DO NOTHING;

CREATE TABLE "service_instance_heartbeats" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "service_type" VARCHAR(30) NOT NULL,
    "instance_id" VARCHAR(191) NOT NULL,
    "boot_id" VARCHAR(80) NOT NULL,
    "state" VARCHAR(30) NOT NULL,
    "active_config_version" INTEGER,
    "config_source" VARCHAR(30),
    "restart_count" INTEGER NOT NULL DEFAULT 0,
    "started_at" TIMESTAMPTZ(6) NOT NULL,
    "last_heartbeat_at" TIMESTAMPTZ(6) NOT NULL,
    "stopped_at" TIMESTAMPTZ(6),
    "metadata_json" JSONB,
    CONSTRAINT "service_instance_heartbeats_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "uq_service_instance_heartbeats_type_instance"
  ON "service_instance_heartbeats"("service_type", "instance_id");
CREATE INDEX "idx_service_instance_heartbeats_type_last"
  ON "service_instance_heartbeats"("service_type", "last_heartbeat_at");

ALTER TABLE "catalog_imports"
  ADD COLUMN "object_key" VARCHAR(500),
  ADD COLUMN "object_sha256" VARCHAR(64),
  ADD COLUMN "object_size_bytes" BIGINT,
  ADD COLUMN "object_etag" VARCHAR(191),
  ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "apply_attempt_count" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "last_error_code" VARCHAR(80),
  ADD COLUMN "reconciled_at" TIMESTAMPTZ(6),
  ADD COLUMN "reconciliation_json" JSONB;

CREATE UNIQUE INDEX "catalog_imports_object_key_key" ON "catalog_imports"("object_key");
CREATE INDEX "idx_catalog_imports_reconciliation" ON "catalog_imports"("state", "updated_at");
