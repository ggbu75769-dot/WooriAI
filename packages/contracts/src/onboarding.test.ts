import { describe, expect, it } from "vitest";
import {
  onboardingCompletionRequestSchema,
  onboardingCompletionResponseSchema,
  onboardingStarterPreviewResponseSchema
} from "./onboarding";

describe("onboarding runtime contracts", () => {
  it("accepts only the canonical YYYY-MM completion budget", () => {
    const request = {
      householdId: "11111111-1111-4111-8111-111111111111",
      draftVersion: 1,
      child: { nickname: "봄이", stageMode: "born", birthDate: "2025-05-01", stageOverride: false, gender: "unknown" },
      prepared: { state: "completed_none", itemDefinitionIds: [] },
      budget: { yearMonth: "2026-07", amountKrw: 500_000 }
    };
    expect(onboardingCompletionRequestSchema.parse(request).budget?.yearMonth).toBe("2026-07");
    expect(() => onboardingCompletionRequestSchema.parse({ ...request, budget: { ...request.budget, yearMonth: "2026-07-01" } })).toThrow();
  });

  it("requires category-aware starter items and a true completion response", () => {
    expect(onboardingStarterPreviewResponseSchema.parse({
      availability: "available",
      blockerCode: null,
      eligibleCount: 1,
      items: [{ id: "11111111-1111-4111-8111-111111111111", code: "diaper", categoryCode: "diaper_hygiene", nameKo: "기저귀", shortDescription: "출산 전", iconKey: "human-baby-changing-table", safetyTier: "normal", onboardingPriority: 100 }],
      rankingPolicy: "policy"
    }).items[0]?.categoryCode).toBe("diaper_hygiene");
    expect(() => onboardingCompletionResponseSchema.parse({ onboardingCompleted: false })).toThrow();
  });
});
