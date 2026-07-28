CREATE TABLE "catalog_safety_alerts" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "item_definition_id" UUID NOT NULL REFERENCES "item_definitions"("id") ON DELETE RESTRICT,
  "user_item_plan_id" UUID NOT NULL REFERENCES "user_item_plans"("id") ON DELETE CASCADE,
  "event_type" VARCHAR(30) NOT NULL,
  "reason" TEXT NOT NULL,
  "item_content_version" INTEGER NOT NULL,
  "state" VARCHAR(30) NOT NULL DEFAULT 'unread',
  "acknowledged_by_user_id" UUID REFERENCES "users"("id") ON DELETE SET NULL,
  "acknowledged_at" TIMESTAMPTZ(6),
  "version" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ck_catalog_safety_alert_event" CHECK ("event_type" IN ('blocked', 'recalled')),
  CONSTRAINT "ck_catalog_safety_alert_state" CHECK ("state" IN ('unread', 'acknowledged')),
  CONSTRAINT "ck_catalog_safety_alert_ack" CHECK (("state" = 'unread' AND "acknowledged_at" IS NULL) OR ("state" = 'acknowledged' AND "acknowledged_at" IS NOT NULL)),
  CONSTRAINT "uq_catalog_safety_alert_plan_event_revision" UNIQUE ("user_item_plan_id", "event_type", "item_content_version")
);

CREATE INDEX "idx_catalog_safety_alerts_item_state" ON "catalog_safety_alerts"("item_definition_id", "state", "created_at");
CREATE INDEX "idx_catalog_safety_alerts_plan_created" ON "catalog_safety_alerts"("user_item_plan_id", "created_at");
