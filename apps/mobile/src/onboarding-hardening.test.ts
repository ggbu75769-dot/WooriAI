import glyphMap from "@expo/vector-icons/build/vendor/react-native-vector-icons/glyphmaps/MaterialCommunityIcons.json";
import { describe, expect, it } from "vitest";
import {
  ONBOARDING_STARTER_ITEM_REGISTRY,
  columnCountForPreparedItems,
  resolveOnboardingStarterIcon
} from "./onboarding/starter-items";
import { previewOnboardingStarterItems } from "./api/local-backend";
import { completionErrorMessage, finalizeOnboardingSuccess } from "./onboarding/completion";
import { createSingleFlightGuard } from "./onboarding/single-flight";
import { LOCAL_HOUSEHOLD_ID, LOCAL_USER_ID } from "./api/fixture-runtime";
import {
  householdIdForSelectedChildScope,
  selectedChildScopeKey,
  selectedChildScopeKeyForSession
} from "./stores/selected-child.store";

describe("onboarding six-step hardening", () => {
  it("uses a complete, unique, installed glyph registry and responsive 3/4-column grid", () => {
    const icons = Object.values(ONBOARDING_STARTER_ITEM_REGISTRY).map((entry) => entry.icon);
    expect(icons).toHaveLength(12);
    expect(new Set(icons)).toHaveLength(12);
    for (const icon of icons) expect(glyphMap).toHaveProperty(icon);
    expect(columnCountForPreparedItems(320, 800)).toBe(3);
    expect(columnCountForPreparedItems(480, 800)).toBe(4);
    expect(columnCountForPreparedItems(400, 320)).toBe(4);
    for (const [code, entry] of Object.entries(ONBOARDING_STARTER_ITEM_REGISTRY)) {
      expect(resolveOnboardingStarterIcon({ code, categoryCode: null, iconKey: null })).toBe(entry.icon);
    }
  });

  it("exposes category names instead of sellable product names in starter recommendations", () => {
    const preview = previewOnboardingStarterItems({ stageMode: "manual", manualStage: "newborn_0_3" });
    expect(preview.items.map((item) => item.nameKo)).toEqual([
      "기저귀",
      "아기띠",
      "블록 세트",
      "아기 침대",
      "배냇저고리",
      "속싸개",
      "젖병",
      "체온계",
      "아기 욕조",
      "손수건",
      "카시트",
      "유모차"
    ]);
    expect(preview.items.map((item) => item.nameKo).join(" ")).not.toMatch(/네이처러브|팬티형|힙시트|도담도담|원목/);
  });

  it("finalizes cache and progress before navigation and clears the draft after navigation", async () => {
    const calls: string[] = [];
    await finalizeOnboardingSuccess("child-1", {
      selectChild: () => calls.push("select-child"),
      refreshCache: async () => { calls.push("refresh-cache"); },
      completeProgress: () => calls.push("complete-progress"),
      navigateHome: () => { calls.push("navigate-home"); },
      clearDraft: async () => { calls.push("clear-draft"); }
    });
    expect(calls).toEqual(["select-child", "refresh-cache", "complete-progress", "navigate-home", "clear-draft"]);
  });

  it("waits for navigation to commit before clearing the draft", async () => {
    const calls: string[] = [];
    let finishNavigation!: () => void;
    const navigationCommitted = new Promise<void>((resolve) => { finishNavigation = resolve; });
    const finalizing = finalizeOnboardingSuccess("child-1", {
      selectChild: () => calls.push("select-child"),
      refreshCache: async () => { calls.push("refresh-cache"); },
      completeProgress: () => calls.push("complete-progress"),
      navigateHome: async () => {
        calls.push("navigate-home");
        await navigationCommitted;
      },
      clearDraft: async () => { calls.push("clear-draft"); }
    });
    await Promise.resolve();
    await Promise.resolve();
    expect(calls).toEqual(["select-child", "refresh-cache", "complete-progress", "navigate-home"]);
    finishNavigation();
    await finalizing;
    expect(calls.at(-1)).toBe("clear-draft");
  });

  it("uses the canonical local identity scope for test-session tabs", () => {
    expect(selectedChildScopeKeyForSession(null, null, true)).toBe(
      selectedChildScopeKey(LOCAL_USER_ID, LOCAL_HOUSEHOLD_ID)
    );
    expect(selectedChildScopeKeyForSession(null, null, false)).toBeNull();
  });

  it("never falls back to the default household while a selected child's household is unresolved", () => {
    expect(householdIdForSelectedChildScope("child-b", null, "household-a")).toBeNull();
    expect(householdIdForSelectedChildScope("child-b", "household-b", "household-a")).toBe("household-b");
    expect(householdIdForSelectedChildScope(null, null, "household-a")).toBe("household-a");
  });

  it("maps validation, stale, auth, network, and server failures separately", () => {
    expect(completionErrorMessage({ status: 400, code: "VALIDATION_ERROR" })).toContain("입력");
    expect(completionErrorMessage({ status: 409, code: "STARTER_ITEMS_STALE" })).toContain("변경");
    expect(completionErrorMessage({ status: 401, code: "UNAUTHORIZED" })).toContain("로그인");
    expect(completionErrorMessage(new TypeError("Failed to fetch"))).toContain("네트워크");
    expect(completionErrorMessage({ status: 500, code: "INTERNAL_SERVER_ERROR" })).toContain("잠시 후");
  });

  it("admits only one final mutation until the active request settles", () => {
    const guard = createSingleFlightGuard();
    expect(guard.tryStart()).toBe(true);
    expect(guard.tryStart()).toBe(false);
    guard.finish();
    expect(guard.tryStart()).toBe(true);
  });
});
