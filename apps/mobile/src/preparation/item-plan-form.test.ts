import { describe, expect, it } from "vitest";
import { isValidDateOnly, itemPlanDraftChanged, itemPlanFieldVisibility } from "./item-plan-form";

describe("item plan progressive disclosure", () => {
  it("shows acquired-only, recurring, and replacement fields only when their conditions apply", () => {
    expect(itemPlanFieldVisibility({ state: "planned", recurringEnabled: false, replacementEnabled: false, canViewPrivatePlan: true })).toMatchObject({
      showAcquiredFields: false,
      showRecurringField: false,
      showReplacementField: false
    });
    expect(itemPlanFieldVisibility({ state: "owned", recurringEnabled: true, replacementEnabled: true, canViewPrivatePlan: true })).toMatchObject({
      showAcquiredFields: true,
      showRecurringField: true,
      showReplacementField: true
    });
    expect(itemPlanFieldVisibility({ state: "owned", recurringEnabled: true, replacementEnabled: true, canViewPrivatePlan: false })).toEqual({
      showPrivatePlan: false,
      showAcquiredFields: false,
      showRecurringField: false,
      showReplacementField: false
    });
  });

  it("rejects invalid calendar dates", () => {
    expect(isValidDateOnly("2026-02-29")).toBe(false);
    expect(isValidDateOnly("2024-02-29")).toBe(true);
    expect(isValidDateOnly("2026/07/16")).toBe(false);
  });

  it("detects a no-op draft", () => {
    const draft = {
      quantityNeeded: "",
      quantityOwned: "",
      assignedUserId: null,
      budgetKrw: "",
      size: "",
      variant: "",
      dueDate: "",
      purchasedAt: "",
      openedAt: "",
      replacementDueAt: "",
      storageLocation: "",
      recurringIntervalDays: "",
      acquisitionType: null,
      notes: ""
    };
    expect(itemPlanDraftChanged(null, draft)).toBe(false);
    expect(itemPlanDraftChanged(null, { ...draft, budgetKrw: "50000" })).toBe(true);
  });
});
