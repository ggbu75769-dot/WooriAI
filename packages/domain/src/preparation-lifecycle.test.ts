import { describe, expect, it } from "vitest";
import {
  buildPreparationRecommendationReason,
  calculatePreparationLifecycle
} from "./preparation-lifecycle";

describe("calculatePreparationLifecycle", () => {
  it.each([
    ["pregnancy_mid", { stageMode: "pregnant" as const, dueDate: "2026-10-16", today: "2026-07-16" }],
    ["pregnancy_late", { stageMode: "pregnant" as const, dueDate: "2026-08-27", today: "2026-07-16" }],
    ["newborn_0_3m", { stageMode: "born" as const, birthDate: "2026-07-16", today: "2026-07-16" }],
    ["infant_4_6m", { stageMode: "born" as const, birthDate: "2026-02-16", today: "2026-07-16" }],
    ["toddler_2_3y", { stageMode: "born" as const, birthDate: "2024-07-16", today: "2026-07-16" }],
    ["elementary_lower", { stageMode: "born" as const, birthDate: "2017-07-16", today: "2026-07-16" }],
    ["middle_school", { stageMode: "born" as const, birthDate: "2012-07-16", today: "2026-07-16" }],
    ["middle_school", { stageMode: "manual" as const, manualStage: "middle_school" as const, today: "2026-07-16" }]
  ])("maps %s without a local/server-specific fallback", (expected, input) => {
    expect(calculatePreparationLifecycle(input)).toMatchObject({ available: true, code: expected });
  });

  it("returns an explicit unavailable result instead of guessing newborn", () => {
    expect(calculatePreparationLifecycle({ stageMode: "born", birthDate: null, today: "2026-07-16" }))
      .toEqual({ available: false, reason: "INSUFFICIENT_STAGE_DATA" });
  });

  it("uses completed calendar months at the day-before/day-of/day-after boundary", () => {
    expect(calculatePreparationLifecycle({ stageMode: "born", birthDate: "2026-03-17", today: "2026-07-16" }))
      .toMatchObject({ code: "newborn_0_3m" });
    expect(calculatePreparationLifecycle({ stageMode: "born", birthDate: "2026-03-16", today: "2026-07-16" }))
      .toMatchObject({ code: "infant_4_6m" });
    expect(calculatePreparationLifecycle({ stageMode: "born", birthDate: "2026-03-15", today: "2026-07-16" }))
      .toMatchObject({ code: "infant_4_6m" });
  });

  it("is deterministic across the KST UTC-day boundary because callers pass today", () => {
    const input = { stageMode: "born" as const, birthDate: "2026-03-17", today: "2026-07-16" };
    const baseline = calculatePreparationLifecycle(input);
    for (let repeat = 0; repeat < 30; repeat += 1) {
      expect(calculatePreparationLifecycle(input)).toEqual(baseline);
    }
  });
});

describe("preparation recommendation reasons", () => {
  it("never interpolates internal lifecycle or context codes", () => {
    const reason = buildPreparationRecommendationReason({
      lifecycleCode: "pregnancy_late",
      nextLifecycleCode: "labor_delivery",
      matchedContextCodes: ["first_child"],
      bucket: "this_week",
      dueWindow: { label: "이번 주", derivedFrom: "lifecycle" }
    });
    expect(reason.recommendationReasonCode).toBe("FIRST_CHILD_CONTEXT");
    expect(reason.recommendationReason).toContain("첫째 아이");
    expect(reason.recommendationReason).not.toMatch(/pregnancy_late|first_child/);
  });

  it("prioritizes replacement and recurring due explanations", () => {
    expect(buildPreparationRecommendationReason({
      lifecycleCode: "toddler_2_3y",
      nextLifecycleCode: "preschool_4_5y",
      matchedContextCodes: [],
      bucket: "this_week",
      dueWindow: { label: "7월 20일", derivedFrom: "replacement" }
    }).recommendationReasonCode).toBe("REPLACEMENT_DUE");
    expect(buildPreparationRecommendationReason({
      lifecycleCode: "toddler_2_3y",
      nextLifecycleCode: "preschool_4_5y",
      matchedContextCodes: [],
      bucket: "this_week",
      dueWindow: { label: "7월 20일", derivedFrom: "repeat_purchase" }
    }).recommendationReasonCode).toBe("RECURRING_PURCHASE_DUE");
  });
});
