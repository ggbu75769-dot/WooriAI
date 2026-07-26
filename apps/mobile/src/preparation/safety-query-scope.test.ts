import { describe, expect, it } from "vitest";
import {
  activeSafetyAlertAfterScopeChange,
  safetyAlternativeScopeKey,
  safetyAlternativesQueryKey
} from "./safety-query-scope";

describe("safety alternative account and context cache boundary", () => {
  const original = {
    sessionGeneration: 10,
    userId: "user-a",
    defaultHouseholdId: "household-a",
    isTestSession: false
  };

  it("changes the cache scope immediately for identity, generation, household, and preparation context changes", () => {
    const originalScope = safetyAlternativeScopeKey(original, "child:child-a");
    const changedScopes = [
      safetyAlternativeScopeKey({ ...original, sessionGeneration: 11 }, "child:child-a"),
      safetyAlternativeScopeKey({ ...original, userId: "user-b" }, "child:child-a"),
      safetyAlternativeScopeKey({ ...original, defaultHouseholdId: "household-b" }, "child:child-a"),
      safetyAlternativeScopeKey(original, "child:child-b")
    ];

    for (const changedScope of changedScopes) {
      expect(changedScope).not.toBe(originalScope);
      expect(safetyAlternativesQueryKey(changedScope, "alert-a"))
        .not.toEqual(safetyAlternativesQueryKey(originalScope, "alert-a"));
      expect(activeSafetyAlertAfterScopeChange(originalScope, changedScope, "alert-a")).toBeNull();
    }
  });

  it("preserves the selected alert only within the exact same owner and context scope", () => {
    const scope = safetyAlternativeScopeKey(original, "child:child-a");
    expect(activeSafetyAlertAfterScopeChange(scope, scope, "alert-a")).toBe("alert-a");
  });
});
