import type { LocalExpenseRow, MutationOutboxRow, OfflineStore } from "./types";

/**
 * In-memory `OfflineStore` implementation. Used by tests (vitest can't run native SQLite -- see
 * sqlite-offline-store.ts) and as a same-shape fallback anywhere expo-sqlite isn't available
 * (e.g. the web target of this Expo app).
 */
export function createMemoryOfflineStore(): OfflineStore {
  const localExpenses = new Map<string, LocalExpenseRow>();
  const outbox = new Map<string, MutationOutboxRow>();
  const meta = new Map<string, string>();
  // Tracks outbox insertion order independent of Map iteration order (which happens to be
  // insertion order in JS, but this is explicit and survives updates-in-place).
  const outboxOrder: string[] = [];

  return {
    async insertLocalExpense(row) {
      localExpenses.set(row.localId, { ...row });
    },
    async getLocalExpense(localId) {
      const row = localExpenses.get(localId);
      return row ? { ...row } : null;
    },
    async updateLocalExpense(localId, patch) {
      const row = localExpenses.get(localId);
      if (!row) return;
      localExpenses.set(localId, { ...row, ...patch });
    },
    async deleteLocalExpense(localId) {
      localExpenses.delete(localId);
    },
    async listLocalExpenses(childId) {
      const rows = [...localExpenses.values()];
      return (childId ? rows.filter((row) => row.childId === childId) : rows).map((row) => ({ ...row }));
    },

    async getMeta(key) {
      return meta.get(key) ?? null;
    },
    async setMeta(key, value) {
      meta.set(key, value);
    },
    async deleteMeta(key) {
      meta.delete(key);
    },

    async insertOutboxMutation(row) {
      outbox.set(row.mutationId, { ...row });
      outboxOrder.push(row.mutationId);
    },
    async getOutboxMutation(mutationId) {
      const row = outbox.get(mutationId);
      return row ? { ...row } : null;
    },
    async updateOutboxMutation(mutationId, patch) {
      const row = outbox.get(mutationId);
      if (!row) return;
      outbox.set(mutationId, { ...row, ...patch });
    },
    async deleteOutboxMutation(mutationId) {
      outbox.delete(mutationId);
      const index = outboxOrder.indexOf(mutationId);
      if (index !== -1) outboxOrder.splice(index, 1);
    },
    async listOutboxMutations() {
      return outboxOrder.filter((id) => outbox.has(id)).map((id) => ({ ...outbox.get(id)! }));
    },
    async listOutboxMutationsForLocalId(localId) {
      return outboxOrder
        .filter((id) => outbox.has(id) && outbox.get(id)!.targetLocalId === localId)
        .map((id) => ({ ...outbox.get(id)! }));
    }
  };
}
