CREATE TABLE "preparation_context_profiles" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "household_id" UUID NOT NULL REFERENCES "households"("id") ON DELETE CASCADE,
  "scope_key" VARCHAR(80) NOT NULL,
  "child_id" UUID REFERENCES "children"("id") ON DELETE CASCADE,
  "mother_profile_id" UUID REFERENCES "mother_profiles"("id") ON DELETE CASCADE,
  "context_codes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "version" INTEGER NOT NULL DEFAULT 1,
  "updated_by_user_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "uq_preparation_context_scope" UNIQUE ("household_id", "scope_key"),
  CONSTRAINT "ck_preparation_context_scope" CHECK (
    ("child_id" IS NOT NULL AND "mother_profile_id" IS NULL AND "scope_key" = 'child:' || "child_id"::TEXT)
    OR
    ("child_id" IS NULL AND "mother_profile_id" IS NOT NULL AND "scope_key" = 'mother:' || "mother_profile_id"::TEXT)
  ),
  CONSTRAINT "ck_preparation_context_version" CHECK ("version" > 0),
  CONSTRAINT "ck_preparation_context_codes" CHECK (
    cardinality("context_codes") <= 24
    AND "context_codes" <@ ARRAY['first_child', 'second_or_later', 'multiple_birth', 'preterm_or_nicu', 'vaginal_delivery', 'cesarean_delivery', 'breastfeeding', 'formula_feeding', 'mixed_feeding', 'daycare', 'kindergarten', 'school', 'car_primary', 'public_transport_primary', 'no_car', 'no_elevator', 'small_home', 'pet_household', 'secondhand_preferred', 'rental_preferred', 'frequent_travel', 'summer_birth', 'winter_birth', 'budget_saving']::TEXT[]
  )
);

CREATE INDEX "idx_preparation_context_child" ON "preparation_context_profiles"("child_id");
CREATE INDEX "idx_preparation_context_mother" ON "preparation_context_profiles"("mother_profile_id");

CREATE FUNCTION enforce_preparation_context_household() RETURNS TRIGGER AS $$
BEGIN
  IF NEW."child_id" IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM "children" WHERE "id" = NEW."child_id" AND "household_id" = NEW."household_id" AND "deleted_at" IS NULL
  ) THEN
    RAISE EXCEPTION 'preparation context child household mismatch';
  END IF;
  IF NEW."mother_profile_id" IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM "mother_profiles" WHERE "id" = NEW."mother_profile_id" AND "household_id" = NEW."household_id" AND "active" = TRUE
  ) THEN
    RAISE EXCEPTION 'preparation context mother household mismatch';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "trg_preparation_context_household"
BEFORE INSERT OR UPDATE ON "preparation_context_profiles"
FOR EACH ROW EXECUTE FUNCTION enforce_preparation_context_household();
