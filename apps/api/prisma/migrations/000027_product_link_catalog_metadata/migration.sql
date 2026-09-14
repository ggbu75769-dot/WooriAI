ALTER TABLE "product_links"
  ADD COLUMN "product_name" VARCHAR(300),
  ADD COLUMN "brand" VARCHAR(120),
  ADD COLUMN "image_url" TEXT,
  ADD COLUMN "rating" DOUBLE PRECISION,
  ADD COLUMN "review_count" INTEGER,
  ADD COLUMN "search_rank" INTEGER;

ALTER TABLE "product_links"
  ADD CONSTRAINT "product_links_rating_range" CHECK ("rating" IS NULL OR ("rating" >= 0 AND "rating" <= 5)),
  ADD CONSTRAINT "product_links_review_count_nonnegative" CHECK ("review_count" IS NULL OR "review_count" >= 0),
  ADD CONSTRAINT "product_links_search_rank_positive" CHECK ("search_rank" IS NULL OR "search_rank" > 0);
