import { describe, expect, it } from "vitest";
import type { TodayActionContract } from "@wooriai/contracts";
import {
  isTodayActionDismissible,
  todayActionHref,
  todayActionPresentation
} from "./today-center";

const childId = "5d2a79d4-cc9d-4e78-898d-64d889802031";
const itemId = "20ca11fe-0000-4a01-8a01-f1c7deb0a001";

function action(
  kind: TodayActionContract["kind"],
  navigation: TodayActionContract["navigation"]
): TodayActionContract {
  return {
    actionKey: `test:${kind}`,
    kind,
    sourceId: itemId,
    childId,
    dueDate: "2026-07-27",
    assignedUserId: null,
    reasonCode: kind,
    reasonParams: { itemName: "기저귀" },
    navigation,
    preferenceScope: { kind: "child", childId },
    preferenceVersion: 0
  };
}

describe("Today Center mobile policy", () => {
  it("routes every contract navigation kind without a fallthrough", () => {
    expect(todayActionHref(action("due_this_week", { kind: "item", itemId, childId })))
      .toBe(`/items/${itemId}?contextType=child&contextId=${childId}`);
    expect(todayActionHref(action("due_this_week", { kind: "calendar", childId })))
      .toBe("/preparation-calendar");
    expect(todayActionHref(action("safety_acknowledgement", { kind: "notifications" })))
      .toBe("/notifications");
    expect(todayActionHref(action("sync_conflict", { kind: "sync" })))
      .toBe("/sync-status");
  });

  it("uses source and action child fallbacks only for item navigation", () => {
    expect(todayActionHref(action("recommendation", { kind: "item" })))
      .toBe(`/items/${itemId}?contextType=child&contextId=${childId}`);
  });

  it("never makes safety acknowledgements dismissible", () => {
    expect(isTodayActionDismissible(action("safety_acknowledgement", { kind: "notifications" }))).toBe(false);
    expect(isTodayActionDismissible(action("recurring_due", { kind: "item", itemId, childId }))).toBe(true);
  });

  it("gives same-item actions distinct visible and accessibility copy", () => {
    const due = todayActionPresentation(action("due_this_week", { kind: "item", itemId, childId }));
    const recurring = todayActionPresentation(action("recurring_due", { kind: "item", itemId, childId }));
    const replacement = todayActionPresentation(action("replacement_due", { kind: "item", itemId, childId }));

    expect(new Set([due.title, recurring.title, replacement.title]).size).toBe(3);
    expect(new Set([due.managementLabel, recurring.managementLabel, replacement.managementLabel]).size).toBe(3);
    expect(recurring.managementLabel).toContain("반복 구매");
  });
});
