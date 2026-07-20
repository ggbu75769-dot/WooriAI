import { beforeEach, describe, expect, it } from "vitest";
import { selectedChildScopeKey, useSelectedChildStore } from "./selected-child.store";
import { shouldClearSessionCache } from "./session-cache-boundary";
import { useSessionStore } from "./session.store";

describe("mobile session data boundary", () => {
  beforeEach(() => {
    useSelectedChildStore.getState().clearSelectedChildId();
    useSessionStore.getState().clearSession();
  });

  it("clears the selected child immediately when the session is cleared", () => {
    useSelectedChildStore.getState().setSelectedChildId("child-from-user-a");
    useSessionStore.getState().setSession({
      accessToken: "access-a",
      refreshToken: "refresh-a",
      userId: "user-a",
      defaultHouseholdId: "household-a"
    });

    useSessionStore.getState().clearSession();

    expect(useSelectedChildStore.getState().selectedChildId).toBeNull();
  });

  it("clears React Query data whenever the user or household scope changes", () => {
    expect(shouldClearSessionCache(undefined, null)).toBe(false);
    expect(shouldClearSessionCache(null, "scope-a")).toBe(true);
    expect(shouldClearSessionCache("scope-a", "scope-a")).toBe(false);
    expect(shouldClearSessionCache("scope-a", null)).toBe(true);
    expect(shouldClearSessionCache("scope-a", "scope-b")).toBe(true);
  });

  it("clears a stale selected child immediately when the authenticated account changes", () => {
    useSessionStore.getState().setSession({
      accessToken: "access-a",
      refreshToken: "refresh-a",
      userId: "user-a",
      defaultHouseholdId: "household-a"
    });
    useSelectedChildStore.getState().setSelectedChildId("child-from-user-a");

    useSessionStore.getState().setSession({
      accessToken: "access-b",
      refreshToken: "refresh-b",
      userId: "user-b",
      defaultHouseholdId: "household-b"
    });

    expect(useSelectedChildStore.getState().selectedChildId).toBeNull();
  });

  it("rejects a persisted selected child outside the active user-household scope 50 times", () => {
    for (let repeat = 0; repeat < 50; repeat += 1) {
      const store = useSelectedChildStore.getState();
      store.activateScope(selectedChildScopeKey("user-a", "household-a"));
      useSelectedChildStore.getState().setSelectedChildId(`child-a-${repeat}`);
      useSelectedChildStore.getState().activateScope(selectedChildScopeKey("user-b", "household-b"));
      expect(useSelectedChildStore.getState().selectedChildId).toBeNull();
      expect(useSelectedChildStore.getState().selectedChildScopeKey).toBe(selectedChildScopeKey("user-b", "household-b"));
    }
  });
});
