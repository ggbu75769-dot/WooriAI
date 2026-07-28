ALTER TYPE "user_item_plan_state" ADD VALUE IF NOT EXISTS 'replacement_due';
ALTER TYPE "user_item_plan_state" ADD VALUE IF NOT EXISTS 'ended';

ALTER TABLE "user_item_plans"
  ADD COLUMN "size" VARCHAR(80),
  ADD COLUMN "variant" VARCHAR(120),
  ADD COLUMN "purchased_at" DATE,
  ADD COLUMN "opened_at" DATE,
  ADD COLUMN "expires_at" DATE,
  ADD COLUMN "replacement_due_at" DATE,
  ADD COLUMN "usage_ended_at" DATE,
  ADD COLUMN "storage_location" VARCHAR(160),
  ADD COLUMN "recurring_interval_days" INTEGER,
  ADD COLUMN "next_purchase_due_at" DATE,
  ADD CONSTRAINT "ck_user_item_plans_recurring_interval" CHECK ("recurring_interval_days" IS NULL OR "recurring_interval_days" BETWEEN 1 AND 3650);

CREATE TABLE "user_item_plan_history" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "plan_id" UUID NOT NULL REFERENCES "user_item_plans"("id") ON DELETE CASCADE,
  "actor_user_id" UUID REFERENCES "users"("id") ON DELETE SET NULL,
  "from_version" INTEGER,
  "to_version" INTEGER NOT NULL,
  "changes_json" JSONB NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ck_user_item_plan_history_versions" CHECK ("to_version" > 0 AND ("from_version" IS NULL OR "from_version" < "to_version"))
);

CREATE INDEX "idx_user_item_plan_history_plan_created" ON "user_item_plan_history"("plan_id", "created_at");

CREATE TABLE "user_item_plan_comments" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "plan_id" UUID NOT NULL REFERENCES "user_item_plans"("id") ON DELETE CASCADE,
  "author_user_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "body" VARCHAR(1000) NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" TIMESTAMPTZ(6)
);

CREATE INDEX "idx_user_item_plan_comments_plan_created" ON "user_item_plan_comments"("plan_id", "created_at");
