import {
  reconcileLegacyOfflineMutations,
  type Expense,
  type LegacyOfflineReconcileMutation,
  type LegacyOfflineReconcileResult
} from "../api/client";
import { createExpenseSyncBody, updateExpenseSyncBody } from "./expense-sync-request";
import type {
  LegacyLocalExpenseSqlRow,
  LegacyMutationSqlRow
} from "./sqlite-upgrade";
import type {
  ConflictSnapshot,
  ExpensePayload,
  LegacyQuarantineEntry,
  LocalExpenseRow,
  MutationOutboxRow,
  OfflineStore,
  SyncState
} from "./types";
import { RemoteSyncCancelledError } from "./errors";

export type LegacyReconciliationControl = {
  signal?: AbortSignal;
  isActive?: () => boolean;
};

function assertReconciliationActive(control?: LegacyReconciliationControl): void {
  if (control?.signal?.aborted || control?.isActive?.() === false) {
    throw new RemoteSyncCancelledError();
  }
}

function parseJson<T>(value: string | null): T | null {
  if (value === null) return null;
  return JSON.parse(value) as T;
}

function buildMutationRequest(
  local: LegacyLocalExpenseSqlRow,
  mutation: LegacyMutationSqlRow
): LegacyOfflineReconcileMutation | null {
  const payload = parseJson<ExpensePayload>(mutation.payload);
  if (mutation.operation === "create" && payload) {
    return {
      sourceLocalId: local.local_id,
      sourceMutationId: mutation.mutation_id,
      idempotencyKey: mutation.idempotency_key,
      method: "POST",
      path: `/children/${payload.childId}/expenses`,
      body: createExpenseSyncBody(payload)
    };
  }
  if (!local.canonical_id) return null;
  if (mutation.operation === "update" && payload) {
    const expectedVersion = mutation.expected_version ?? local.version;
    if (expectedVersion == null) return null;
    return {
      sourceLocalId: local.local_id,
      sourceMutationId: mutation.mutation_id,
      idempotencyKey: mutation.idempotency_key,
      method: "PATCH",
      path: `/expenses/${local.canonical_id}`,
      body: updateExpenseSyncBody(payload, expectedVersion)
    };
  }
  if (mutation.operation === "delete") {
    return {
      sourceLocalId: local.local_id,
      sourceMutationId: mutation.mutation_id,
      idempotencyKey: mutation.idempotency_key,
      method: "DELETE",
      path: `/expenses/${local.canonical_id}`,
      body: {}
    };
  }
  return null;
}

export function buildLegacyReconciliationRequests(entries: LegacyQuarantineEntry[]) {
  return entries.flatMap((entry) => {
    const local = parseJson<LegacyLocalExpenseSqlRow>(entry.localExpenseJson);
    const mutations = parseJson<LegacyMutationSqlRow[]>(entry.outboxJson);
    if (!local || !mutations) return [];
    return mutations.flatMap((mutation) => {
      const request = buildMutationRequest(local, mutation);
      return request ? [request] : [];
    });
  });
}

export function chunkLegacyReconciliationRequests(
  requests: LegacyOfflineReconcileMutation[],
  batchSize = 50
): LegacyOfflineReconcileMutation[][] {
  if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 50) {
    throw new Error("LEGACY_RECONCILIATION_BATCH_SIZE_INVALID");
  }
  const chunks: LegacyOfflineReconcileMutation[][] = [];
  for (let index = 0; index < requests.length; index += batchSize) {
    chunks.push(requests.slice(index, index + batchSize));
  }
  return chunks;
}

function restoredSyncState(
  local: LegacyLocalExpenseSqlRow,
  remaining: LegacyMutationSqlRow[]
): SyncState {
  if (remaining.length === 0) return "synced";
  if (local.sync_state === "conflict") return "conflict";
  if (local.sync_state === "failed") return "failed";
  return "pending";
}

function restoreEntry(
  scopeKey: string,
  entry: LegacyQuarantineEntry,
  results: LegacyOfflineReconcileResult[]
): { row: LocalExpenseRow | null; mutations: MutationOutboxRow[] } | null {
  const local = parseJson<LegacyLocalExpenseSqlRow>(entry.localExpenseJson);
  const legacyMutations = parseJson<LegacyMutationSqlRow[]>(entry.outboxJson);
  if (!local || !legacyMutations) return null;
  const resultByMutation = new Map(
    results.map((result) => [result.sourceMutationId, result])
  );
  const proven = results.some(
    (result) => result.disposition === "attributable" || result.disposition === "already_synced"
  );
  if (!proven) return null;

  const remaining = legacyMutations.filter(
    (mutation) => resultByMutation.get(mutation.mutation_id)?.disposition !== "already_synced"
  );
  const completedResponses = results
    .filter((result) => result.disposition === "already_synced" && result.response)
    .map((result) => result.response as Partial<Expense>);
  const latestExpense = [...completedResponses].reverse().find(
    (response: Partial<Expense>) =>
      typeof response.id === "string" && typeof response.version === "number"
  );
  const lastLegacyMutation = legacyMutations[legacyMutations.length - 1];
  if (
    remaining.length === 0 &&
    lastLegacyMutation?.operation === "delete" &&
    results.some(
      (result) =>
        result.sourceMutationId === lastLegacyMutation.mutation_id &&
        result.disposition === "already_synced"
    )
  ) {
    return { row: null, mutations: [] };
  }

  const payload = parseJson<ExpensePayload>(local.payload);
  if (!payload) return null;
  const syncState = restoredSyncState(local, remaining);
  const highestAttemptCount = remaining.reduce(
    (highest, mutation) => Math.max(highest, mutation.attempt_count),
    0
  );
  const row: LocalExpenseRow = {
    scopeKey,
    localId: local.local_id,
    canonicalId: latestExpense?.id ?? local.canonical_id,
    childId: local.child_id,
    payload,
    version: latestExpense?.version ?? local.version,
    syncState,
    pendingDelete: Boolean(local.pending_delete),
    conflictCurrent: parseJson<ConflictSnapshot>(local.conflict_current ?? null),
    lastError: syncState === "synced" ? null : (local.last_error ?? null),
    failureKind:
      syncState === "failed"
        ? highestAttemptCount >= 5
          ? "retry_exhausted"
          : "validation"
        : null,
    createdAt: local.created_at,
    updatedAt: local.updated_at
  };
  const mutations: MutationOutboxRow[] = remaining.map((mutation) => ({
    scopeKey,
    mutationId: mutation.mutation_id,
    idempotencyKey: mutation.idempotency_key,
    operation: mutation.operation as MutationOutboxRow["operation"],
    targetLocalId: mutation.target_local_id,
    payload: parseJson<ExpensePayload>(mutation.payload),
    expectedVersion: mutation.expected_version,
    attemptCount: mutation.attempt_count,
    nextRetryAt: mutation.next_retry_at,
    lastError: mutation.last_error,
    createdAt: mutation.created_at,
    inFlight: false
  }));
  return { row, mutations };
}

export async function reconcileLegacyOfflineScope(
  token: string,
  store: OfflineStore,
  control?: LegacyReconciliationControl
): Promise<{ restored: number; remaining: number }> {
  assertReconciliationActive(control);
  const entries = await store.listLegacyQuarantineEntries(50);
  assertReconciliationActive(control);
  if (entries.length === 0) return { restored: 0, remaining: 0 };
  const requests = buildLegacyReconciliationRequests(entries);
  if (requests.length === 0) return { restored: 0, remaining: entries.length };
  const results: LegacyOfflineReconcileResult[] = [];
  for (const batch of chunkLegacyReconciliationRequests(requests)) {
    assertReconciliationActive(control);
    const response = await reconcileLegacyOfflineMutations(token, batch, control?.signal);
    assertReconciliationActive(control);
    results.push(...response.results);
  }
  let restored = 0;
  for (const entry of entries) {
    assertReconciliationActive(control);
    const entryResults = results.filter(
      (result) => result.sourceLocalId === entry.sourceLocalId
    );
    const restore = restoreEntry(store.scopeKey, entry, entryResults);
    if (!restore) continue;
    assertReconciliationActive(control);
    await store.restoreLegacyQuarantineEntry(entry.id, restore.row, restore.mutations);
    restored += 1;
  }
  return { restored, remaining: entries.length - restored };
}
