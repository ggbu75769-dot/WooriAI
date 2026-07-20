import type { LocalExpenseRow, MutationOutboxRow, OfflineStore } from "./types";
import { LEGACY_UNSCOPED_SCOPE_KEY } from "./session-scope";

export type MemoryOfflineStoreBackend = {
  localExpenses: Map<string, LocalExpenseRow>;
  outbox: Map<string, MutationOutboxRow>;
  outboxOrder: string[];
};

export function createMemoryOfflineStoreBackend(): MemoryOfflineStoreBackend {
  return {
    localExpenses: new Map<string, LocalExpenseRow>(),
    outbox: new Map<string, MutationOutboxRow>(),
    outboxOrder: []
  };
}

/**
 * In-memory `OfflineStore` implementation. Used by tests (vitest can't run native SQLite -- see
 * sqlite-offline-store.ts) and as a same-shape fallback anywhere expo-sqlite isn't available
 * (e.g. the web target of this Expo app).
 */
export function createMemoryOfflineStore(
  scopeKey: string = LEGACY_UNSCOPED_SCOPE_KEY,
  backend: MemoryOfflineStoreBackend = createMemoryOfflineStoreBackend()
): OfflineStore {
  const { localExpenses, outbox, outboxOrder } = backend;

  const localInScope = (row: LocalExpenseRow | undefined): row is LocalExpenseRow =>
    Boolean(row && row.scopeKey === scopeKey);
  const mutationInScope = (row: MutationOutboxRow | undefined): row is MutationOutboxRow =>
    Boolean(row && row.scopeKey === scopeKey);

  return {
    scopeKey,
    async insertLocalExpense(row) {
      if (row.scopeKey !== scopeKey) throw new Error("OFFLINE_SCOPE_MISMATCH");
      localExpenses.set(row.localId, { ...row });
    },
    async getLocalExpense(localId) {
      const row = localExpenses.get(localId);
      return localInScope(row) ? { ...row } : null;
    },
    async updateLocalExpense(localId, patch) {
      const row = localExpenses.get(localId);
      if (!localInScope(row)) return;
      if (patch.scopeKey && patch.scopeKey !== scopeKey) throw new Error("OFFLINE_SCOPE_MISMATCH");
      localExpenses.set(localId, { ...row, ...patch, scopeKey });
    },
    async deleteLocalExpense(localId) {
      const row = localExpenses.get(localId);
      if (localInScope(row)) localExpenses.delete(localId);
    },
    async listLocalExpenses(childId) {
      const rows = [...localExpenses.values()].filter((row) => row.scopeKey === scopeKey);
      return (childId ? rows.filter((row) => row.childId === childId) : rows).map((row) => ({ ...row }));
    },

    async insertOutboxMutation(row) {
      if (row.scopeKey !== scopeKey) throw new Error("OFFLINE_SCOPE_MISMATCH");
      outbox.set(row.mutationId, { ...row });
      outboxOrder.push(row.mutationId);
    },
    async getOutboxMutation(mutationId) {
      const row = outbox.get(mutationId);
      return mutationInScope(row) ? { ...row } : null;
    },
    async updateOutboxMutation(mutationId, patch) {
      const row = outbox.get(mutationId);
      if (!mutationInScope(row)) return;
      if (patch.scopeKey && patch.scopeKey !== scopeKey) throw new Error("OFFLINE_SCOPE_MISMATCH");
      outbox.set(mutationId, { ...row, ...patch, scopeKey });
    },
    async deleteOutboxMutation(mutationId) {
      const row = outbox.get(mutationId);
      if (!mutationInScope(row)) return;
      outbox.delete(mutationId);
      const index = outboxOrder.indexOf(mutationId);
      if (index !== -1) outboxOrder.splice(index, 1);
    },
    async listOutboxMutations() {
      return outboxOrder
        .filter((id) => mutationInScope(outbox.get(id)))
        .map((id) => ({ ...outbox.get(id)! }));
    },
    async listOutboxMutationsForLocalId(localId) {
      return outboxOrder
        .filter((id) => mutationInScope(outbox.get(id)) && outbox.get(id)!.targetLocalId === localId)
        .map((id) => ({ ...outbox.get(id)! }));
    },
    async getLegacyQuarantineSummary() {
      const legacyRows = [...localExpenses.values()].filter(
        (row) => row.scopeKey === LEGACY_UNSCOPED_SCOPE_KEY
      );
      return {
        total: legacyRows.length,
        awaitingReconciliation: legacyRows.length,
        ambiguous: 0,
        corrupt: 0,
        duplicate: 0,
        alreadySynced: 0
      };
    },
    async listLegacyQuarantineEntries() {
      return [];
    },
    async updateLegacyQuarantineEntry() {
      return;
    },
    async deleteLegacyQuarantineEntry() {
      return;
    },
    async restoreLegacyQuarantineEntry(_id, row, mutations) {
      if (row) await this.insertLocalExpense(row);
      for (const mutation of mutations) await this.insertOutboxMutation(mutation);
    }
  };
}
