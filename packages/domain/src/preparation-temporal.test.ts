import { describe, expect, it } from "vitest";
import { preparationDateKeyKst, preparationDueEvents } from "./preparation-temporal";

const utcDate = (date: string) => new Date(`${date}T00:00:00.000Z`);

describe("preparation replacement and recurring due contract", () => {
  it.each([
    ["2026-07-16T14:59:59.999Z", "2026-07-16"],
    ["2026-07-16T15:00:00.000Z", "2026-07-17"],
    ["2026-12-31T14:59:59.999Z", "2026-12-31"],
    ["2026-12-31T15:00:00.000Z", "2027-01-01"],
    ["2028-02-28T15:00:00.000Z", "2028-02-29"]
  ])("uses the caller clock at KST boundaries: %s", (reference, expected) => {
    expect(preparationDateKeyKst(new Date(reference))).toBe(expected);
  });

  it("emits each due kind once and suppresses future or inactive plans", () => {
    const referenceTime = new Date("2026-07-16T15:00:00.000Z");
    expect(preparationDueEvents({ state: "owned", replacementDueAt: utcDate("2026-07-17"), nextPurchaseDueAt: utcDate("2026-07-16"), referenceTime }))
      .toEqual([
        { eventType: "replacement_due", dueKey: "2026-07-17" },
        { eventType: "recurring_purchase_due", dueKey: "2026-07-16" }
      ]);
    expect(preparationDueEvents({ state: "owned", replacementDueAt: utcDate("2026-07-18"), referenceTime })).toEqual([]);
    expect(preparationDueEvents({ state: "not_needed", replacementDueAt: utcDate("2026-07-17"), referenceTime })).toEqual([]);
    expect(preparationDueEvents({ state: "retired", nextPurchaseDueAt: utcDate("2026-07-17"), referenceTime })).toEqual([]);
  });

  it("is deterministic across fifty scheduler contenders", () => {
    const input = { state: "replacement_due", replacementDueAt: utcDate("2026-07-17"), referenceTime: new Date("2026-07-16T15:00:00.000Z") };
    expect(Array.from({ length: 50 }, () => preparationDueEvents(input))).toEqual(
      Array.from({ length: 50 }, () => [{ eventType: "replacement_due", dueKey: "2026-07-17" }])
    );
  });
});
