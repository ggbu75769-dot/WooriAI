import { describe, expect, it } from "vitest";
import { LOCAL_CHILD_ID, LOCAL_USER_ID, localItemTemplateFixtures } from "./api/local-fixtures";
import {
  completeOnboarding,
  isLegacyFixtureChildFingerprint,
  listChildren,
  onboardingStatus,
  previewOnboardingStarterItems,
  resetLocalBackendForTests,
  startLocalOnboardingSession,
  useLocalBackendStore
} from "./api/local-backend";

describe("Release 5U local qualification onboarding", () => {
  it("starts with no child, exposes 12 isolated starter items, and commits only at final confirmation", () => {
    resetLocalBackendForTests();
    startLocalOnboardingSession();
    expect(listChildren()).toEqual({ children: [] });

    const preview = previewOnboardingStarterItems({ stageMode: "born", birthDate: "2025-12-18" });
    expect(preview.items).toHaveLength(12);
    expect(preview.eligibleCount).toBe(12);
    expect(listChildren()).toEqual({ children: [] });

    const body = {
      householdId: "local-household-qualification",
      draftVersion: 1 as const,
      child: {
        nickname: "다온",
        stageMode: "born" as const,
        birthDate: "2025-12-18",
        stageOverride: false,
        gender: "unknown" as const
      },
      prepared: {
        state: "selected" as const,
        itemDefinitionIds: localItemTemplateFixtures.slice(0, 3).map((item) => item.id)
      },
      budget: null
    };
    const responses = Array.from({ length: 30 }, () => completeOnboarding(body, "stable-final-key"));
    expect(new Set(responses.map((response) => response.child.id)).size).toBe(1);
    expect(responses[0]?.child.id).toBe(LOCAL_CHILD_ID);
    expect(listChildren().children).toHaveLength(1);
    expect(listChildren().children[0]?.nickname).toBe("다온");
    expect(Object.keys(useLocalBackendStore.getState().itemStatuses)).toHaveLength(3);
    expect(new Set(Object.keys(useLocalBackendStore.getState().itemStatuses))).toHaveLength(3);
    expect(onboardingStatus()).toMatchObject({ completed: true, nextStep: "home", summary: { budget: null } });
    startLocalOnboardingSession();
    expect(onboardingStatus()).toMatchObject({ completed: false, nextStep: "child-profile" });
  });

  it("recognizes only the exact legacy synthetic fingerprint, never a real user-created Daon", () => {
    const legacyChild = {
      id: "local-child-daon",
      nickname: "다온이",
      stageMode: "born" as const,
      dueDate: null,
      birthDate: "2024-01-01",
      manualStage: null,
      gender: null,
      profileImageUrl: null,
      deletedAt: null
    };
    const persisted = {
      members: [{ householdId: "local-household-daon", userId: LOCAL_USER_ID }]
    };
    expect(isLegacyFixtureChildFingerprint(legacyChild, persisted)).toBe(true);
    expect(isLegacyFixtureChildFingerprint({ ...legacyChild, id: "real-user-child-id", nickname: "다온" }, persisted)).toBe(false);
    for (let repeat = 0; repeat < 30; repeat += 1) {
      expect(isLegacyFixtureChildFingerprint({ ...legacyChild, id: "real-user-child-id", nickname: "다온" }, persisted)).toBe(false);
    }
  });

  it("rejects the same incompatible and future-date completion payloads as production", () => {
    resetLocalBackendForTests();
    startLocalOnboardingSession();
    const base = {
      householdId: "local-household-qualification",
      draftVersion: 1,
      prepared: { state: "completed_none" as const, itemDefinitionIds: [] },
      budget: null
    };

    expect(() => completeOnboarding({
      ...base,
      child: {
        nickname: "하늘",
        stageMode: "born" as const,
        birthDate: "2025-12-18",
        dueDate: "2026-12-01",
        gender: "unknown" as const,
        stageOverride: false
      }
    }, "incompatible-local")).toThrow("ONBOARDING_PATH_FIELDS_INCOMPATIBLE");

    expect(() => completeOnboarding({
      ...base,
      child: {
        nickname: "하늘",
        stageMode: "born" as const,
        birthDate: "2999-01-01",
        gender: "unknown" as const,
        stageOverride: false
      }
    }, "future-local")).toThrow("BIRTH_DATE_INVALID");
    expect(listChildren()).toEqual({ children: [] });
  });
});
