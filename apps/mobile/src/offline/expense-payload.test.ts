import { describe, expect, it } from "vitest";
import { expenseToOfflinePayload, writableExpenseType } from "./expense-payload";
import type { Expense } from "../api/client";

function expense(expenseType: Expense["expenseType"]): Expense {
  return {
    id: `expense-${expenseType}`,
    childId: "child-1",
    categoryId: "category-1",
    amountKrw: 12_000,
    spentOn: "2026-07-16",
    itemName: expenseType,
    paymentMethod: "card",
    expenseType,
    source: "manual",
    version: 3
  };
}

describe("offline financial adjustment payload", () => {
  it.each(["refund", "support"] as const)(
    "preserves %s locally while omitting an unsupported type change from the update wire payload",
    (expenseType) => {
      const payload = expenseToOfflinePayload(expense(expenseType));

      expect(payload.expenseType).toBe(expenseType);
      expect(writableExpenseType(payload.expenseType)).toBeUndefined();
    }
  );

  it.each(["expense", "gift"] as const)("keeps editable %s types writable", (expenseType) => {
    expect(writableExpenseType(expenseType)).toBe(expenseType);
  });
});
