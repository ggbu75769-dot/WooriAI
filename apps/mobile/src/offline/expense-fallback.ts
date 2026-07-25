import { ApiClientError, type Expense } from "../api/client";
import type { LocalExpenseRow, RemoteSyncMetadata } from "./types";

export function offlineExpenseFallbackAllowed(
  error: unknown,
  online: boolean | null,
  metadata: RemoteSyncMetadata
): boolean {
  if (error instanceof ApiClientError && [401, 403, 404].includes(error.status)) {
    return false;
  }
  if (
    metadata.authorizationState !== "authorized" ||
    !metadata.baselineComplete ||
    !metadata.lastSuccessfulPullAt
  ) return false;
  if (online === false) return true;
  if (error instanceof ApiClientError) return error.status >= 500;
  return (
    error instanceof TypeError ||
    (error instanceof Error && error.name === "AbortError")
  );
}

export function syncedExpenseMirrors(
  rows: LocalExpenseRow[],
  childId: string,
  yearMonth: string
): Expense[] {
  const byCanonicalId = new Map<string, Expense>();
  for (const row of rows) {
    if (
      row.childId !== childId ||
      row.syncState !== "synced" ||
      row.pendingDelete ||
      !row.canonicalId ||
      !row.version ||
      !row.payload.spentOn.startsWith(yearMonth)
    ) {
      continue;
    }
    byCanonicalId.set(row.canonicalId, {
      id: row.canonicalId,
      childId: row.childId,
      categoryId: row.payload.categoryId,
      amountKrw: row.payload.amountKrw,
      spentOn: row.payload.spentOn,
      itemName: row.payload.itemName,
      merchant: row.payload.merchant,
      memo: row.payload.memo,
      paymentMethod: row.payload.paymentMethod ?? "unknown",
      paymentMethodId: row.payload.paymentMethodId,
      linkedItemDefinitionId: row.payload.linkedItemDefinitionId,
      expenseCategoryV2Id: row.payload.expenseCategoryV2Id,
      expenseType: row.payload.expenseType ?? "expense",
      source: row.payload.source ?? "manual",
      createdByUserId: row.payload.createdByUserId ?? null,
      payerUserId: row.payload.payerUserId ?? null,
      version: row.version
    });
  }
  return [...byCanonicalId.values()].sort(
    (left, right) =>
      right.spentOn.localeCompare(left.spentOn) || right.id.localeCompare(left.id)
  );
}
