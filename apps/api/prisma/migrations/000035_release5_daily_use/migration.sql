ALTER TABLE "notification_preferences"
  ADD COLUMN "replacement_enabled" BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN "recurring_enabled" BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN "weekly_briefing_enabled" BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN "external_channel_enabled" BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN "weekly_frequency" VARCHAR(20) NOT NULL DEFAULT 'weekly',
  ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;

CREATE TABLE "today_action_preferences" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "household_id" UUID NOT NULL REFERENCES "households"("id") ON DELETE CASCADE,
  "child_id" UUID REFERENCES "children"("id") ON DELETE CASCADE,
  "scope_key" VARCHAR(80) NOT NULL,
  "action_key" VARCHAR(191) NOT NULL,
  "mode" VARCHAR(30) NOT NULL,
  "snoozed_until" DATE,
  "lifecycle_code" VARCHAR(60),
  "version" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "today_action_preferences_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ck_today_action_preferences_mode" CHECK ("mode" IN ('snooze', 'hide_lifecycle'))
);
CREATE UNIQUE INDEX "uq_today_action_preferences_scope_action" ON "today_action_preferences"("user_id", "household_id", "scope_key", "action_key");
CREATE INDEX "idx_today_action_preferences_scope" ON "today_action_preferences"("household_id", "child_id");

CREATE TABLE "custom_preparation_bundles" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "household_id" UUID NOT NULL REFERENCES "households"("id") ON DELETE CASCADE,
  "created_by_user_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "title" VARCHAR(120) NOT NULL,
  "scope_type" VARCHAR(20) NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "archived_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "custom_preparation_bundles_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ck_custom_preparation_bundles_scope" CHECK ("scope_type" IN ('child', 'household'))
);
CREATE INDEX "idx_custom_preparation_bundles_household" ON "custom_preparation_bundles"("household_id", "archived_at", "updated_at");

CREATE TABLE "custom_preparation_bundle_items" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "bundle_id" UUID NOT NULL REFERENCES "custom_preparation_bundles"("id") ON DELETE CASCADE,
  "item_definition_id" UUID NOT NULL REFERENCES "item_definitions"("id") ON DELETE RESTRICT,
  "default_quantity" INTEGER,
  "display_order" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "custom_preparation_bundle_items_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ck_custom_preparation_bundle_items_quantity" CHECK ("default_quantity" IS NULL OR "default_quantity" > 0)
);
CREATE UNIQUE INDEX "uq_custom_bundle_items_bundle_item" ON "custom_preparation_bundle_items"("bundle_id", "item_definition_id");
CREATE INDEX "idx_custom_bundle_items_item" ON "custom_preparation_bundle_items"("item_definition_id");

CREATE TABLE "custom_bundle_applications" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "bundle_id" UUID NOT NULL REFERENCES "custom_preparation_bundles"("id") ON DELETE RESTRICT,
  "household_id" UUID NOT NULL REFERENCES "households"("id") ON DELETE CASCADE,
  "child_id" UUID REFERENCES "children"("id") ON DELETE CASCADE,
  "requested_by_user_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "idempotency_key" VARCHAR(191) NOT NULL,
  "result_json" JSONB NOT NULL,
  "applied_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "custom_bundle_applications_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "custom_bundle_applications_idempotency_key_key" ON "custom_bundle_applications"("idempotency_key");
CREATE INDEX "idx_custom_bundle_applications_bundle" ON "custom_bundle_applications"("bundle_id", "applied_at");

CREATE TABLE "weekly_briefings" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "household_id" UUID NOT NULL REFERENCES "households"("id") ON DELETE CASCADE,
  "week_start" DATE NOT NULL,
  "payload_json" JSONB NOT NULL,
  "source_hash" VARCHAR(64) NOT NULL,
  "generated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "read_at" TIMESTAMPTZ(6),
  CONSTRAINT "weekly_briefings_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "uq_weekly_briefings_user_household_week" ON "weekly_briefings"("user_id", "household_id", "week_start");
CREATE INDEX "idx_weekly_briefings_household_week" ON "weekly_briefings"("household_id", "week_start");

WITH updated AS (
  UPDATE "remote_configs"
  SET
    "value_json" = jsonb_set(
      "value_json",
      '{featureFlags}',
      COALESCE("value_json"->'featureFlags', '{}'::jsonb) || jsonb_build_object(
        'today_family_center', false,
        'preparation_calendar', false,
        'custom_bundles', false,
        'weekly_briefing', false,
        'receipt_assisted_entry', false,
        'expense_plan_link_suggestion', false,
        'recurring_purchase_prediction', false,
        'budget_variance_explanation', false,
        'external_recall_provider', false,
        'merchant_offer_comparison', false
      )
    ),
    "version" = "version" + 1,
    "updated_at" = CURRENT_TIMESTAMP
  WHERE "config_key" = 'public_app_config'
  RETURNING *
)
INSERT INTO "remote_config_revisions" (
  "config_key", "version", "value_json", "content_hash", "action", "actor_admin_id", "reason", "activated_at"
)
SELECT
  "config_key", "version", "value_json", encode(digest("value_json"::text, 'sha256'), 'hex'),
  'migration', NULL, 'Release 5 feature flags added fail-closed', "updated_at"
FROM updated
ON CONFLICT ("config_key", "version") DO NOTHING;
