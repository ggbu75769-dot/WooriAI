import { expenseToOfflinePayload } from "./expense-payload";
import type {
  ApplyRemoteSyncPageInput,
  LocalExpenseRow,
  MutationOutboxRow
} from "./types";

export type DeltaReconciliationResult = {
  upserts: LocalExpenseRow[];
  deleteLocalIds: string[];
  deleteMutationIds: string[];
  affectedChildIds: string[];
};

function canonicalId(change: ApplyRemoteSyncPageInput["changes"][number]): string {
  return change.op === "upsert" ? change.data.id : change.id;
}

function conflictVersion(row: LocalExpenseRow): number {
  if (!row.conflictCurrent) return row.version ?? 0;
  return Math.max(
    row.version ?? 0,
    row.conflictCurrent.deleted
      ? row.conflictCurrent.version
      : row.conflictCurrent.expense.version
  );
}

function normalizedPayloadEqual(
  left: LocalExpenseRow["payload"],
  right: LocalExpenseRow["payload"]
): boolean {
  const normalize = (payload: LocalExpenseRow["payload"]) => ({
    childId: payload.childId,
    categoryId: payload.categoryId,
    amountKrw: payload.amountKrw,
    spentOn: payload.spentOn,
    itemName: payload.itemName,
    merchant: payload.merchant ?? null,
    memo: payload.memo ?? null,
    paymentMethod: payload.paymentMethod ?? "unknown",
    paymentMethodId: payload.paymentMethodId ?? null,
    linkedItemTemplateId: payload.linkedItemTemplateId ?? null,
    linkedItemDefinitionId: payload.linkedItemDefinitionId ?? null,
    expenseCategoryV2Id: payload.expenseCategoryV2Id ?? null,
    expenseType: payload.expenseType ?? "expense",
    source: payload.source ?? "manual",
    createdByUserId: payload.createdByUserId ?? null,
    payerUserId: payload.payerUserId ?? null
  });
  const normalizedLeft = normalize(left);
  const normalizedRight = normalize(right);
  return (Object.keys(normalizedLeft) as Array<keyof typeof normalizedLeft>).every(
    (key) => normalizedLeft[key] === normalizedRight[key]
  );
}

function remoteLocalId(expenseId: string): string {
  return `remote:${expenseId}`;
}

export function reconcileRemoteSyncPage(
  scopeKey: string,
  localRows: LocalExpenseRow[],
  mutations: MutationOutboxRow[],
  input: ApplyRemoteSyncPageInput
): DeltaReconciliationResult {
  if (input.changes.length > 200) throw new Error("SYNC_PAGE_OVERSIZED");
  if (input.hasMore && !input.nextCursor) throw new Error("SYNC_CURSOR_NOT_ADVANCING");
  if (input.hasMore && input.nextCursor === input.expectedCursor) {
    throw new Error("SYNC_CURSOR_NOT_ADVANCING");
  }

  const rowsByCanonical = new Map<string, LocalExpenseRow>();
  for (const row of localRows) {
    if (!row.canonicalId) continue;
    if (rowsByCanonical.has(row.canonicalId)) {
      throw new Error("SYNC_CANONICAL_DUPLICATE");
    }
    rowsByCanonical.set(row.canonicalId, row);
  }
  const mutationsByLocal = new Map<string, MutationOutboxRow[]>();
  for (const mutation of mutations) {
    const entries = mutationsByLocal.get(mutation.targetLocalId) ?? [];
    entries.push(mutation);
    mutationsByLocal.set(mutation.targetLocalId, entries);
  }

  const seen = new Set<string>();
  const upserts = new Map<string, LocalExpenseRow>();
  const deleteLocalIds = new Set<string>();
  const deleteMutationIds = new Set<string>();
  const affectedChildIds = new Set<string>();

  for (const change of input.changes) {
    const id = canonicalId(change);
    if (
      change.type !== "expense" ||
      change.householdId !== input.householdId ||
      !id ||
      !change.childId ||
      seen.has(id)
    ) {
      throw new Error("SYNC_PAGE_INVARIANT_FAILED");
    }
    if (change.op === "upsert" && change.data.childId !== change.childId) {
      throw new Error("SYNC_PAGE_INVARIANT_FAILED");
    }
    seen.add(id);
    affectedChildIds.add(change.childId);

    const row = rowsByCanonical.get(id);
    if (!row) {
      if (change.op === "delete") continue;
      const payload = expenseToOfflinePayload(change.data);
      const mirrored: LocalExpenseRow = {
        scopeKey,
        localId: remoteLocalId(id),
        canonicalId: id,
        childId: change.childId,
        payload,
        version: change.data.version,
        syncState: "synced",
        pendingDelete: false,
        conflictCurrent: null,
        lastError: null,
        failureKind: null,
        createdAt: input.appliedAt,
        updatedAt: input.appliedAt
      };
      rowsByCanonical.set(id, mirrored);
      upserts.set(mirrored.localId, mirrored);
      continue;
    }

    const localMutations = mutationsByLocal.get(row.localId) ?? [];
    if (row.syncState === "syncing" || localMutations.some((mutation) => mutation.inFlight)) {
      throw new Error("SYNC_PUSH_PULL_OVERLAP");
    }
    const hasLocalWork = row.syncState !== "synced" || localMutations.length > 0;
    const knownVersion = conflictVersion(row);
    const remoteVersion = change.op === "upsert" ? change.data.version : change.version;

    if (hasLocalWork) {
      if (change.op === "delete" && row.pendingDelete && remoteVersion > knownVersion) {
        deleteLocalIds.add(row.localId);
        for (const mutation of localMutations) deleteMutationIds.add(mutation.mutationId);
        continue;
      }
      if (remoteVersion <= knownVersion) continue;
      const conflictCurrent =
        change.op === "upsert"
          ? {
              deleted: false as const,
              expense: {
                ...expenseToOfflinePayload(change.data),
                id,
                version: change.data.version
              }
            }
          : { deleted: true as const, id, version: change.version };
      upserts.set(row.localId, {
        ...row,
        syncState: "conflict",
        conflictCurrent,
        lastError: "다른 기기에서 변경된 기록과 확인이 필요해요.",
        failureKind: null,
        updatedAt: input.appliedAt
      });
      continue;
    }

    if (remoteVersion < knownVersion) continue;
    if (change.op === "delete") {
      if (remoteVersion === knownVersion) {
        upserts.set(row.localId, {
          ...row,
          syncState: "conflict",
          conflictCurrent: { deleted: true, id, version: change.version },
          lastError: "같은 버전의 삭제 상태가 달라 확인이 필요해요.",
          failureKind: null,
          updatedAt: input.appliedAt
        });
      } else {
        deleteLocalIds.add(row.localId);
      }
      continue;
    }

    const payload = expenseToOfflinePayload(change.data);
    if (remoteVersion === knownVersion) {
      if (!normalizedPayloadEqual(row.payload, payload) || row.childId !== change.childId) {
        upserts.set(row.localId, {
          ...row,
          syncState: "conflict",
          conflictCurrent: {
            deleted: false,
            expense: { ...payload, id, version: change.data.version }
          },
          lastError: "같은 버전의 서버 내용이 달라 확인이 필요해요.",
          failureKind: null,
          updatedAt: input.appliedAt
        });
      }
      continue;
    }

    upserts.set(row.localId, {
      ...row,
      childId: change.childId,
      payload,
      version: change.data.version,
      syncState: "synced",
      pendingDelete: false,
      conflictCurrent: null,
      lastError: null,
      failureKind: null,
      updatedAt: input.appliedAt
    });
  }

  return {
    upserts: [...upserts.values()],
    deleteLocalIds: [...deleteLocalIds],
    deleteMutationIds: [...deleteMutationIds],
    affectedChildIds: [...affectedChildIds]
  };
}
