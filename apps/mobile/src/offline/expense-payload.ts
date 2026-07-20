import type { Expense } from "../api/client";
import type { ExpensePayload } from "./types";

export function writableExpenseType(
  expenseType: ExpensePayload["expenseType"]
): "expense" | "gift" | undefined {
  return expenseType === "expense" || expenseType === "gift" ? expenseType : undefined;
}

export function expenseToOfflinePayload(expense: Expense): ExpensePayload {
  return {
    childId: expense.childId,
    categoryId: expense.categoryId,
    amountKrw: expense.amountKrw,
    spentOn: expense.spentOn,
    itemName: expense.itemName,
    merchant: expense.merchant,
    memo: expense.memo,
    paymentMethod: expense.paymentMethod,
    paymentMethodId: expense.paymentMethodId,
    linkedItemDefinitionId: expense.linkedItemDefinitionId,
    expenseCategoryV2Id: expense.expenseCategoryV2Id,
    expenseType: expense.expenseType
  };
}
