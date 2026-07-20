import { describe, expect, it } from "vitest";
import { buildPreparationCalendarEvents, explainBudgetVariance, kstWeekStart, predictRecurringPurchase, selectTodayActions } from "./release5";

describe("Release 5 deterministic daily-use domain", () => {
  it("ranks at most three actions deterministically and preserves safety through snooze", () => {
    const candidates = [
      { actionKey: "recommend", kind: "recommendation" as const, sourceId: "i4", childId: "c", dueDate: null, assignedUserId: null },
      { actionKey: "mine", kind: "overdue_assigned" as const, sourceId: "i2", childId: "c", dueDate: "2026-07-15", assignedUserId: "user" },
      { actionKey: "safety", kind: "safety_acknowledgement" as const, sourceId: "i1", childId: "c", dueDate: null, assignedUserId: null, safetyBlocking: true },
      { actionKey: "finance", kind: "planned_cost_unassigned" as const, sourceId: "i3", childId: "c", dueDate: "2026-07-18", assignedUserId: null, financial: true }
    ];
    for (let repeat = 0; repeat < 30; repeat += 1) {
      expect(selectTodayActions({
        referenceDate: "2026-07-17",
        currentUserId: "user",
        canViewFinancial: false,
        candidates,
        preferences: [{ actionKey: "safety", mode: "hide_lifecycle", snoozedUntil: null }]
      }).map((action) => action.actionKey)).toEqual(["safety", "mine", "recommend"]);
    }
  });

  it("builds calendar events from one shared non-terminal schedule", () => {
    expect(buildPreparationCalendarEvents([{ planId: "p", itemDefinitionId: "i", childId: "c", assignedUserId: null, dueDate: "2026-07-17", replacementDueAt: "2026-08-17", nextPurchaseDueAt: null, state: "planned" }]))
      .toEqual([
        expect.objectContaining({ eventId: "p:preparation", type: "preparation", date: "2026-07-17" }),
        expect.objectContaining({ eventId: "p:replacement", type: "replacement", date: "2026-08-17" })
      ]);
  });

  it("uses KST weeks and suppresses sparse recurring predictions", () => {
    expect(kstWeekStart("2026-07-19")).toBe("2026-07-13");
    expect(predictRecurringPurchase({ purchaseDates: ["2026-05-01", "2026-06-01"] })).toBeNull();
    for (let repeat = 0; repeat < 30; repeat += 1) {
      expect(predictRecurringPurchase({ purchaseDates: ["2026-04-01", "2026-05-01", "2026-06-01", "2026-07-01"] }))
        .toEqual({ predictedDate: "2026-07-31", intervalDays: 30, confidence: "medium" });
    }
  });

  it("builds deterministic variance copy from report aggregates and suppresses sparse data", () => {
    expect(explainBudgetVariance({ plannedKrw: 100_000, actualKrw: 120_000, actualRecordCount: 1, categories: [] })).toBeNull();
    for (let repeat = 0; repeat < 30; repeat += 1) {
      expect(explainBudgetVariance({
        plannedKrw: 100_000,
        actualKrw: 142_000,
        actualRecordCount: 4,
        categories: [{ name: "외출 준비", actualKrw: 50_000 }, { name: "의류", actualKrw: 70_000 }],
        giftKrw: 10_000,
        refundKrw: 3_000
      })).toEqual({
        varianceKrw: 42_000,
        direction: "over",
        summary: "실제 지출은 계획보다 42,000원 많아요.",
        topDrivers: [{ name: "의류", actualKrw: 70_000 }, { name: "외출 준비", actualKrw: 50_000 }],
        adjustments: { giftKrw: 10_000, refundKrw: 3_000, supportKrw: 0 },
        basis: "report_v3_ledger_and_plan"
      });
    }
  });
});
