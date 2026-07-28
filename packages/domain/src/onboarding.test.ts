import { describe, expect, it } from "vitest";
import {
  DEFAULT_MONTHLY_BUDGET_WON,
  buildOnboardingCompletionInput,
  createEmptyOnboardingDraft,
  formatChildAgeKorean,
  getOnboardingReadiness,
  normalizeOnboardingCompletionInput,
  normalizeOnboardingPathChange,
  onboardingStarterAvailability,
  rankOnboardingStarterItems,
  validateOnboardingDraft
} from "./onboarding";

describe("Release 5U onboarding domain", () => {
  it("starts schema v3 with the 500,000 won default and builds the API month as YYYY-MM", () => {
    const draft = {
      ...createEmptyOnboardingDraft("user-1", "11111111-1111-4111-8111-111111111111"),
      selectedPath: "born" as const,
      childName: "하늘",
      birthDate: "2025-12-18",
      sex: "female" as const,
      preparedStepState: "completed_none" as const,
      currentStep: "review" as const
    };

    expect(draft).toMatchObject({ schemaVersion: 3, monthlyBudgetWon: DEFAULT_MONTHLY_BUDGET_WON, monthlyBudgetEdited: false });
    expect(getOnboardingReadiness(draft, "2026-07-18")).toEqual({ ready: true, errors: [] });
    expect(buildOnboardingCompletionInput(draft, "2026-07-18").budget).toEqual({ yearMonth: "2026-07", amountKrw: 500_000 });
  });

  it("distinguishes an explicit budget skip from an invalid zero amount", () => {
    const base = {
      ...createEmptyOnboardingDraft("user-1", "11111111-1111-4111-8111-111111111111"),
      selectedPath: "born" as const,
      childName: "하늘",
      birthDate: "2025-12-18",
      sex: "unknown" as const,
      preparedStepState: "skipped" as const,
      currentStep: "review" as const
    };
    expect(getOnboardingReadiness({ ...base, monthlyBudgetWon: null, monthlyBudgetEdited: true }, "2026-07-18").ready).toBe(true);
    expect(getOnboardingReadiness({ ...base, monthlyBudgetWon: 0, monthlyBudgetEdited: true }, "2026-07-18").errors).toContain("BUDGET_INVALID");
  });

  it("enforces selected, none, skipped, and unvisited preparation readiness", () => {
    const readyBase = {
      ...createEmptyOnboardingDraft("user-1", "11111111-1111-4111-8111-111111111111"),
      selectedPath: "born" as const,
      childName: "하늘",
      birthDate: "2025-12-18",
      sex: "unknown" as const,
      currentStep: "review" as const
    };
    expect(getOnboardingReadiness({ ...readyBase, preparedStepState: "selected", preparedItemIds: ["item-1"] }, "2026-07-18").ready).toBe(true);
    expect(getOnboardingReadiness({ ...readyBase, preparedStepState: "completed_none", preparedItemIds: [] }, "2026-07-18").ready).toBe(true);
    expect(getOnboardingReadiness({ ...readyBase, preparedStepState: "skipped", preparedItemIds: [] }, "2026-07-18").ready).toBe(true);
    expect(getOnboardingReadiness({ ...readyBase, preparedStepState: "not_started", preparedItemIds: [] }, "2026-07-18").errors).toContain("PREPARED_STEP_REQUIRED");
  });

  it("clears only incompatible path fields and keeps common user input", () => {
    const pregnant = {
      ...createEmptyOnboardingDraft("user-1", "household-1"),
      selectedPath: "pregnant" as const,
      childName: "별이",
      dueDate: "2026-12-01",
      sex: "unknown" as const,
      preparedItemIds: ["item-1"],
      preparedStepState: "selected" as const
    };

    expect(normalizeOnboardingPathChange(pregnant, "born", "2026-07-18T00:00:00.000Z")).toMatchObject({
      selectedPath: "born",
      childName: "별이",
      dueDate: null,
      birthDate: null,
      manualStage: null,
      stageOverride: false,
      sex: "unknown",
      preparedItemIds: [],
      preparedStepState: "not_started",
      version: 2
    });

    expect(normalizeOnboardingPathChange(pregnant, null, "2026-07-18T00:00:00.000Z")).toMatchObject({
      selectedPath: null,
      childName: "별이",
      dueDate: null,
      birthDate: null,
      manualStage: null,
      stageOverride: false
    });
  });

  it("derives Korean age copy from birthDate without persisting an age", () => {
    expect(formatChildAgeKorean("2026-07-01", "2026-07-18")).toBe("생후 17일");
    expect(formatChildAgeKorean("2026-02-18", "2026-07-18")).toBe("생후 5개월");
    expect(formatChildAgeKorean("2024-07-18", "2026-07-18")).toBe("만 2세");
  });

  it("handles leap-day birthdays and rejects future dates deterministically", () => {
    for (let repeat = 0; repeat < 30; repeat += 1) {
      expect(formatChildAgeKorean("2024-02-29", "2026-02-28")).toBe("생후 23개월");
      expect(formatChildAgeKorean("2024-02-29", "2026-03-01")).toBe("만 2세");
      expect(() => formatChildAgeKorean("2026-07-19", "2026-07-18")).toThrow("BIRTH_DATE_FUTURE");
    }
  });

  it("keeps validation deterministic for the born path across 30 repetitions", () => {
    const draft = {
      ...createEmptyOnboardingDraft("user-1", "household-1"),
      selectedPath: "born" as const,
      childName: "하늘",
      birthDate: "2025-12-18",
      sex: "female" as const
    };

    for (let repeat = 0; repeat < 30; repeat += 1) {
      expect(validateOnboardingDraft(draft, "2026-07-18")).toEqual([]);
    }
  });

  it("ranks eligible starter items deterministically and reports the minimum-count blocker", () => {
    const ranked = rankOnboardingStarterItems([
      { id: "b", code: "B", lifecycleRelevance: 5, onboardingPriority: 100, necessity: "required" },
      { id: "a", code: "A", lifecycleRelevance: 8, onboardingPriority: 10, necessity: "optional" },
      { id: "d", code: "D", lifecycleRelevance: 5, onboardingPriority: 100, necessity: "optional" },
      { id: "c", code: "C", lifecycleRelevance: 5, onboardingPriority: 100, necessity: "required" }
    ]);

    expect(ranked.map((item) => item.id)).toEqual(["a", "b", "c", "d"]);
    expect(onboardingStarterAvailability(9)).toEqual({
      availability: "external_blocked",
      blockerCode: "EXTERNAL_BLOCKED_ONBOARDING_CATALOG"
    });
    expect(onboardingStarterAvailability(10)).toEqual({ availability: "available", blockerCode: null });
  });

  it("keeps a direct-stage override explicit and contradiction-free across 30 repetitions", () => {
    const direct = {
      ...createEmptyOnboardingDraft("user-1", "household-1"),
      selectedPath: "manual" as const,
      childName: "하늘",
      birthDate: "2025-12-18",
      manualStage: "toddler_1_3" as const,
      stageOverride: true,
      sex: "unknown" as const
    };

    for (let repeat = 0; repeat < 30; repeat += 1) {
      expect(validateOnboardingDraft(direct, "2026-07-18")).toEqual([]);
      expect(normalizeOnboardingPathChange(direct, "pregnant", "2026-07-18T00:00:00.000Z")).toMatchObject({
        birthDate: null,
        manualStage: null,
        stageOverride: false
      });
    }
  });

  it("fails closed on unknown enum values and invalid mobile budget month keys", () => {
    const valid = {
      householdId: "11111111-1111-4111-8111-111111111111",
      draftVersion: 2,
      child: {
        nickname: "봄이",
        stageMode: "born" as const,
        birthDate: "2025-05-01",
        stageOverride: false,
        gender: "unknown" as const
      },
      prepared: { state: "skipped" as const, itemDefinitionIds: [] },
      budget: { yearMonth: "2026-07", amountKrw: 500000 }
    };

    expect(normalizeOnboardingCompletionInput(valid, "2026-07-18")).toEqual(valid);
    expect(() => normalizeOnboardingCompletionInput({
      ...valid,
      child: { ...valid.child, stageMode: "fixture_stage" as typeof valid.child.stageMode }
    }, "2026-07-18")).toThrow("ONBOARDING_PATH_INVALID");
    expect(() => normalizeOnboardingCompletionInput({
      ...valid,
      child: { ...valid.child, gender: "fixture_sex" as typeof valid.child.gender }
    }, "2026-07-18")).toThrow("CHILD_SEX_INVALID");
    expect(() => normalizeOnboardingCompletionInput({
      ...valid,
      budget: { yearMonth: "2026-07-01", amountKrw: 500000 }
    }, "2026-07-18")).toThrow("BUDGET_INVALID");
  });
});
