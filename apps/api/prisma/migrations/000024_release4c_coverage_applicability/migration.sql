CREATE TYPE "catalog_coverage_applicability" AS ENUM (
  'required',
  'recommended',
  'optional',
  'not_applicable',
  'review_needed'
);

CREATE TYPE "catalog_coverage_gap_type" AS ENUM (
  'missing_item',
  'insufficient_depth',
  'missing_lifecycle_rule',
  'missing_context_rule',
  'missing_source',
  'review_blocked',
  'taxonomy_mismatch',
  'unclassified_applicability'
);

ALTER TABLE "catalog_coverage_decisions"
  ADD COLUMN "applicability" "catalog_coverage_applicability" NOT NULL DEFAULT 'review_needed',
  ADD COLUMN "gap_type" "catalog_coverage_gap_type";

UPDATE "catalog_coverage_decisions"
SET "applicability" = CASE
  WHEN "state"::text = 'not_applicable' THEN 'not_applicable'::"catalog_coverage_applicability"
  WHEN "state"::text = 'covered' AND "necessity"::text = 'required' THEN 'required'::"catalog_coverage_applicability"
  WHEN "state"::text = 'covered' AND "necessity"::text IN ('recommended', 'conditional') THEN 'recommended'::"catalog_coverage_applicability"
  WHEN "state"::text = 'covered' AND "necessity"::text = 'optional' THEN 'optional'::"catalog_coverage_applicability"
  ELSE 'review_needed'::"catalog_coverage_applicability"
END,
"gap_type" = CASE
  WHEN "state"::text = 'gap' THEN 'review_blocked'::"catalog_coverage_gap_type"
  ELSE NULL
END;

CREATE INDEX "idx_catalog_coverage_applicability_gap"
  ON "catalog_coverage_decisions"("applicability", "gap_type");
