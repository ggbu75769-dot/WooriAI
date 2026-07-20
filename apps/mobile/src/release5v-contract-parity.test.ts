import { describe, expect, it } from "vitest";
import { normalizeOnboardingCompletionInput, type OnboardingCompletionInput } from "@wooriai/domain";
import { completeOnboarding, listChildren, resetLocalBackendForTests, startLocalOnboardingSession } from "./api/local-backend";
import type { CompleteOnboardingInput } from "./api/client";

function validInput(): CompleteOnboardingInput {
  return {
    householdId: "11111111-1111-4111-8111-111111111111",
    draftVersion: 7,
    child: {
      nickname: "  봄이  ",
      stageMode: "born",
      birthDate: "2025-05-01",
      stageOverride: false,
      gender: "unknown"
    },
    prepared: { state: "skipped", itemDefinitionIds: [] },
    budget: { yearMonth: "2026-07", amountKrw: 500000 }
  };
}

describe("Release 5V API/mobile/local onboarding contract parity", () => {
  it("keeps the mobile client type identical to the shared domain contract", () => {
    const mobile: CompleteOnboardingInput = validInput();
    const domain: OnboardingCompletionInput = mobile;
    expect(domain).toEqual(mobile);
  });

  it("normalizes the same input and result in the standalone backend 30 times", () => {
    for (let repeat = 0; repeat < 30; repeat += 1) {
      resetLocalBackendForTests();
      startLocalOnboardingSession();
      const input = validInput();
      const normalized = normalizeOnboardingCompletionInput(input, "2026-07-18");
      const result = completeOnboarding(input, `parity-${repeat}`);
      expect(normalized.child.nickname).toBe("봄이");
      expect(result.child.nickname).toBe("봄이");
      expect(result.budget).toEqual({ yearMonth: "2026-07", amountKrw: 500000 });
      expect(listChildren().children).toHaveLength(1);
    }
  });

  it("fails closed on an unknown enum before the local backend creates a child", () => {
    resetLocalBackendForTests();
    startLocalOnboardingSession();
    const invalid = validInput();
    invalid.child.stageMode = "fixture_stage" as typeof invalid.child.stageMode;
    expect(() => completeOnboarding(invalid, "invalid-enum")).toThrow("ONBOARDING_PATH_INVALID");
    expect(listChildren().children).toEqual([]);
  });
});
