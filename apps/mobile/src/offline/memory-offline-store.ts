import type { ItemStatusOutboxRow, LocalExpenseRow, MutationOutboxRow, OfflineStore } from "./types";

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
  // 라운드 51 C-10: 준비템 상태 큐. 지출 아웃박스와 같은 관례(삽입 순서 배열 + 행 Map)로
  // 둬서 SQLite 구현(`item_status_outbox` 테이블, created_at 정렬)과 1:1로 맞춘다.
  const itemStatusOutbox = new Map<string, ItemStatusOutboxRow>();
  const itemStatusOrder: string[] = [];

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

    async clearAll() {
      localExpenses.clear();
      outbox.clear();
      outboxOrder.length = 0;
      // PRIV-104: 준비템 상태 큐도 같은 계정 단위 상태다 -- 다음 계정의 토큰으로 이전 계정이
      // 눌러 둔 준비 상태가 날아가면 안 된다.
      itemStatusOutbox.clear();
      itemStatusOrder.length = 0;
      meta.clear();
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
    },

    async insertItemStatusMutation(row) {
      itemStatusOutbox.set(row.mutationId, { ...row });
      itemStatusOrder.push(row.mutationId);
    },
    async updateItemStatusMutation(mutationId, patch) {
      const row = itemStatusOutbox.get(mutationId);
      if (!row) return;
      itemStatusOutbox.set(mutationId, { ...row, ...patch });
    },
    async deleteItemStatusMutation(mutationId) {
      itemStatusOutbox.delete(mutationId);
      const index = itemStatusOrder.indexOf(mutationId);
      if (index !== -1) itemStatusOrder.splice(index, 1);
    },
    async listItemStatusMutations() {
      return itemStatusOrder.filter((id) => itemStatusOutbox.has(id)).map((id) => ({ ...itemStatusOutbox.get(id)! }));
    },
    async listItemStatusMutationsForItem(childId, itemTemplateId) {
      return itemStatusOrder
        .filter((id) => {
          const row = itemStatusOutbox.get(id);
          return Boolean(row && row.childId === childId && row.itemTemplateId === itemTemplateId);
        })
        .map((id) => ({ ...itemStatusOutbox.get(id)! }));
    }
  };
}
