import type { Expense as PrismaExpense } from "@prisma/client";

/**
 * Shared, minimal expense row -> wire-shape helpers used by the version/conflict
 * layer (expenses.service.ts) and the delta sync module (../sync). Deliberately
 * kept outside the onboarding store services (whose own
 * `toExpenseDto`/`fromDateOnly` this mirrors) so this Round 5A work never touches
 * that file, which other work in this sprint owns concurrently.
 */

export function fromDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Field set intentionally mirrors store-shared.ts's
 * `toExpenseDto`, plus `version`. Used for the `current` payload of a 409
 * VERSION_CONFLICT response and for delta-sync `upsert` change entries.
 */
export function toExpenseSnapshot(expense: PrismaExpense) {
  return {
    id: expense.id,
    childId: expense.childId,
    categoryId: expense.categoryId,
    amountKrw: expense.amountKrw,
    spentOn: fromDateOnly(expense.spentOn),
    itemName: expense.itemName,
    merchant: expense.merchant ?? null,
    memo: expense.memo ?? null,
    expenseType: expense.expenseType,
    source: expense.source,
    createdByUserId: expense.createdByUserId,
    version: expense.version
  };
}

export function toDeletedExpenseSnapshot(expense: Pick<PrismaExpense, "id" | "version">) {
  return { id: expense.id, deleted: true as const, version: expense.version };
}
