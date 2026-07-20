import { writableExpenseType } from "./expense-payload";
import type { ExpensePayload } from "./types";

export function createExpenseSyncBody(payload: ExpensePayload) {
  return {
    categoryId: payload.categoryId,
    amountKrw: payload.amountKrw,
    spentOn: payload.spentOn,
    itemName: payload.itemName,
    merchant: payload.merchant ?? undefined,
    paymentMethod: payload.paymentMethod,
    paymentMethodId: payload.paymentMethodId ?? undefined,
    memo: payload.memo ?? undefined,
    linkedItemTemplateId: payload.linkedItemTemplateId ?? undefined,
    linkedItemDefinitionId: payload.linkedItemDefinitionId ?? undefined,
    expenseCategoryV2Id: payload.expenseCategoryV2Id ?? undefined,
    expenseType: writableExpenseType(payload.expenseType)
  };
}

export function updateExpenseSyncBody(payload: ExpensePayload, expectedVersion: number) {
  return {
    categoryId: payload.categoryId,
    amountKrw: payload.amountKrw,
    spentOn: payload.spentOn,
    itemName: payload.itemName,
    memo: payload.memo ?? undefined,
    paymentMethod: payload.paymentMethod,
    paymentMethodId: payload.paymentMethodId,
    expenseType: writableExpenseType(payload.expenseType),
    expectedVersion
  };
}

