import { describe, expect, it } from "vitest";
import { acquisitionModeSchema, catalogReviewStatusSchema, recommendationStateSchema, userItemPlanStateSchema } from "./release4";

describe("Release 4 contracts", () => {
  it("keeps recommendation and review status separate", () => {
    expect(recommendationStateSchema.parse("professional_review_required")).toBe("professional_review_required");
    expect(catalogReviewStatusSchema.parse("in_review")).toBe("in_review");
    expect(() => catalogReviewStatusSchema.parse("professional_review_required")).toThrow();
  });

  it("supports the full preparation state machine", () => {
    expect(userItemPlanStateSchema.options).toEqual([
      "not_considered", "need", "researching", "planned", "ordered", "owned",
      "borrowed", "rented", "gift_expected", "gifted", "not_needed",
      "replacement_needed", "replaced", "retired"
    ]);
    expect(acquisitionModeSchema.parse("secondhand")).toBe("secondhand");
  });
});
