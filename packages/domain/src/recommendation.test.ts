import { describe, expect, it } from "vitest";
import {
  calculateRecommendationScore,
  sortRecommendedItems,
  validateItemTrustRules
} from "./recommendation";

describe("recommendation scoring", () => {
  it("uses stage, necessity, preparation status, budget fit, and interest", () => {
    expect(
      calculateRecommendationScore({
        stageMatches: true,
        necessityLevel: "essential",
        status: "not_prepared",
        budgetFits: true,
        userInterest: false
      })
    ).toBe(95);
  });

  it("does not use affiliate commission as a score variable", () => {
    const base = {
      stageMatches: true,
      necessityLevel: "convenience" as const,
      status: "interested" as const,
      budgetFits: false,
      userInterest: true
    };

    expect(calculateRecommendationScore({ ...base, affiliateCommissionRate: 0 })).toBe(
      calculateRecommendationScore({ ...base, affiliateCommissionRate: 0.2 })
    );
  });

  it("excludes prepared, gifted, and not-needed items from now-needed recommendations", () => {
    const sorted = sortRecommendedItems([
      { id: "prepared", stageMatches: true, necessityLevel: "essential", status: "prepared" },
      { id: "gifted", stageMatches: true, necessityLevel: "essential", status: "gifted" },
      { id: "not-needed", stageMatches: true, necessityLevel: "essential", status: "not_needed" },
      { id: "needed", stageMatches: true, necessityLevel: "essential", status: "not_prepared" }
    ]);

    expect(sorted.map((item) => item.id)).toEqual(["needed"]);
  });

  it("enforces trust metadata for convenience, optional, and medical items", () => {
    expect(
      validateItemTrustRules({
        necessityLevel: "optional",
        skipReasonText: "이미 비슷한 물건이 있으면 안 사도 돼요.",
        medicalDisclaimerRequired: false
      })
    ).toEqual([]);

    expect(
      validateItemTrustRules({
        necessityLevel: "convenience",
        medicalDisclaimerRequired: true
      })
    ).toEqual(["SKIP_REASON_REQUIRED", "MEDICAL_DISCLAIMER_REQUIRED"]);
  });
});
