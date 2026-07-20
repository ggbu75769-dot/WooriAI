ALTER TABLE "expenses" ADD COLUMN "payer_user_id" UUID;

UPDATE "expenses" SET "payer_user_id" = "created_by_user_id" WHERE "payer_user_id" IS NULL;

ALTER TABLE "expenses"
  ALTER COLUMN "payer_user_id" SET NOT NULL,
  ADD CONSTRAINT "expenses_payer_user_id_fkey" FOREIGN KEY ("payer_user_id") REFERENCES "users"("id") ON DELETE RESTRICT;

CREATE INDEX "idx_expenses_household_payer_spent" ON "expenses"("household_id", "payer_user_id", "spent_on");
