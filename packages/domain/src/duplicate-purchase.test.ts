import { describe, expect, it } from "vitest";
import { isDuplicatePurchaseRisk } from "./duplicate-purchase";

const canonicalItemId = "item-1";

describe("duplicate purchase determination", () => {
  it.each(["ordered", "owned", "borrowed", "rented", "gifted"] as const)("warns for a same-child %s item", (state) => {
    expect(isDuplicatePurchaseRisk({
      canonicalItemId,
      targetSubject: "child",
      childId: "child-a",
      requestedState: "planned",
      existing: { canonicalItemId, childId: "child-a", state }
    })).toBe(true);
  });

  it.each(["not_considered", "need", "researching", "planned", "gift_expected", "not_needed", "replacement_needed", "ended"] as const)(
    "does not warn for a non-purchased %s state",
    (state) => {
      expect(isDuplicatePurchaseRisk({
        canonicalItemId,
        targetSubject: "child",
        childId: "child-a",
        requestedState: "planned",
        existing: { canonicalItemId, childId: "child-a", state }
      })).toBe(false);
    }
  );

  it("separates child items and shares household items without using their names", () => {
    const existing = { canonicalItemId, childId: "child-b", state: "owned" as const };
    expect(isDuplicatePurchaseRisk({ canonicalItemId, targetSubject: "child", childId: "child-a", requestedState: "planned", existing })).toBe(false);
    expect(isDuplicatePurchaseRisk({ canonicalItemId, targetSubject: "shared", childId: "child-a", requestedState: "planned", existing })).toBe(true);
    expect(isDuplicatePurchaseRisk({ canonicalItemId, targetSubject: "household", childId: "child-a", requestedState: "planned", existing })).toBe(true);
  });

  it("is deterministic across repeated evaluation", () => {
    const input = {
      canonicalItemId,
      targetSubject: "shared" as const,
      childId: "child-a",
      requestedState: "planned" as const,
      existing: { canonicalItemId, childId: "child-b", state: "owned" as const }
    };
    expect(Array.from({ length: 30 }, () => isDuplicatePurchaseRisk(input))).toEqual(Array(30).fill(true));
  });
});
