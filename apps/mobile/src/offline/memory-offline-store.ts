import { reconcileRemoteSyncPage } from "./delta-reconciliation";
import type {
  LocalExpenseRow,
  MutationOutboxRow,
  OfflineStore,
  RemoteSyncMetadata
} from "./types";
import { LEGACY_UNSCOPED_SCOPE_KEY } from "./session-scope";

export type MemoryOfflineStoreBackend = {
  localExpenses: Map<string, LocalExpenseRow>;
  outbox: Map<string, MutationOutboxRow>;
  outboxOrder: string[];
  remoteSyncMetadata: Map<string, RemoteSyncMetadata>;
};

export function createMemoryOfflineStoreBackend(): MemoryOfflineStoreBackend {
  return {
    localExpenses: new Map<string, LocalExpenseRow>(),
    outbox: new Map<string, MutationOutboxRow>(),
    outboxOrder: [],
    remoteSyncMetadata: new Map<string, RemoteSyncMetadata>()
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
  const { localExpenses, outbox, outboxOrder, remoteSyncMetadata } = backend;
  const emptyMetadata = (): RemoteSyncMetadata => ({
    protocolVersion: 2,
    cursor: null,
    baselineComplete: false,
    lastSuccessfulPullAt: null,
    authorizationState: "unknown",
    authorizationCheckedAt: null
  });

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
    async commitLocalMutation(input) {
      if (
        input.localRow?.scopeKey !== undefined &&
        input.localRow.scopeKey !== scopeKey
      ) {
        throw new Error("OFFLINE_SCOPE_MISMATCH");
      }
      if (input.localRow && input.localRow.localId !== input.targetLocalId) {
        throw new Error("OFFLINE_TARGET_MISMATCH");
      }
      for (const mutation of input.upsertMutations) {
        if (
          mutation.scopeKey !== scopeKey ||
          mutation.targetLocalId !== input.targetLocalId
        ) {
          throw new Error("OFFLINE_SCOPE_MISMATCH");
        }
      }
      for (const mutationId of input.deleteMutationIds) {
        const mutation = outbox.get(mutationId);
        if (
          mutation &&
          (!mutationInScope(mutation) || mutation.targetLocalId !== input.targetLocalId)
        ) {
          throw new Error("OFFLINE_SCOPE_MISMATCH");
        }
      }
      const currentLocalRow = localInScope(localExpenses.get(input.targetLocalId))
        ? localExpenses.get(input.targetLocalId)!
        : null;
      const localRevision = (row: LocalExpenseRow | null) =>
        row
          ? JSON.stringify([
              row.scopeKey,
              row.localId,
              row.canonicalId,
              row.childId,
              row.payload,
              row.version,
              row.syncState,
              row.pendingDelete,
              row.conflictCurrent,
              row.lastError,
              row.failureKind,
              row.createdAt,
              row.updatedAt
            ])
          : null;
      const currentMutations = outboxOrder
        .filter(
          (id) =>
            mutationInScope(outbox.get(id)) &&
            outbox.get(id)!.targetLocalId === input.targetLocalId
        )
        .map((id) => ({
          mutationId: id,
          inFlight: outbox.get(id)!.inFlight === true
        }));
      if (
        localRevision(currentLocalRow) !== localRevision(input.expectedLocalRow) ||
        JSON.stringify(currentMutations) !== JSON.stringify(input.expectedMutations)
      ) {
        throw new Error("OFFLINE_MUTATION_RACE");
      }

      if (input.localRow) localExpenses.set(input.targetLocalId, { ...input.localRow });
      else localExpenses.delete(input.targetLocalId);
      for (const mutationId of input.deleteMutationIds) {
        outbox.delete(mutationId);
        const index = outboxOrder.indexOf(mutationId);
        if (index !== -1) outboxOrder.splice(index, 1);
      }
      for (const mutation of input.upsertMutations) {
        if (!outbox.has(mutation.mutationId)) outboxOrder.push(mutation.mutationId);
        outbox.set(mutation.mutationId, { ...mutation });
      }
    },
    async acknowledgeOutboxMutation(input) {
      const mutation = outbox.get(input.mutationId);
      if (
        mutation &&
        (!mutationInScope(mutation) || mutation.targetLocalId !== input.targetLocalId)
      ) {
        throw new Error("OFFLINE_SCOPE_MISMATCH");
      }
      outbox.delete(input.mutationId);
      const index = outboxOrder.indexOf(input.mutationId);
      if (index !== -1) outboxOrder.splice(index, 1);
      const remainingMutationCount = outboxOrder.filter((mutationId) => {
        const candidate = outbox.get(mutationId);
        return mutationInScope(candidate) && candidate.targetLocalId === input.targetLocalId;
      }).length;
      const row = localExpenses.get(input.targetLocalId);
      if (localInScope(row)) {
        if (input.deleteLocalExpense && remainingMutationCount === 0) {
          localExpenses.delete(input.targetLocalId);
        } else {
          const patch: Partial<LocalExpenseRow> | undefined = input.rowPatch
            ? { ...input.rowPatch }
            : undefined;
          if (remainingMutationCount > 0 && patch) delete patch.payload;
          localExpenses.set(input.targetLocalId, {
            ...row,
            ...patch,
            scopeKey,
            syncState: remainingMutationCount > 0 ? "pending" : patch?.syncState ?? "synced",
            updatedAt: input.acknowledgedAt
          });
        }
      }
      return { remainingMutationCount };
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
    },
    async getRemoteSyncMetadata() {
      return { ...(remoteSyncMetadata.get(scopeKey) ?? emptyMetadata()) };
    },
    async resetRemoteSyncMetadata(input) {
      if (input.ownerStillCurrent && !input.ownerStillCurrent()) {
        throw new Error("SYNC_OWNER_CHANGED");
      }
      const current = remoteSyncMetadata.get(scopeKey) ?? emptyMetadata();
      if (current.cursor !== input.expectedCursor) {
        throw new Error("SYNC_CURSOR_CAS_MISMATCH");
      }
      if (input.ownerStillCurrent && !input.ownerStillCurrent()) {
        throw new Error("SYNC_OWNER_CHANGED");
      }
      const reset = emptyMetadata();
      remoteSyncMetadata.set(scopeKey, reset);
      return { ...reset };
    },
    async setRemoteSyncAuthorization(input) {
      if (input.ownerStillCurrent && !input.ownerStillCurrent()) {
        throw new Error("SYNC_OWNER_CHANGED");
      }
      const current = remoteSyncMetadata.get(scopeKey) ?? emptyMetadata();
      const next = {
        ...current,
        authorizationState: input.state,
        authorizationCheckedAt: input.checkedAt
      } satisfies RemoteSyncMetadata;
      if (input.ownerStillCurrent && !input.ownerStillCurrent()) {
        throw new Error("SYNC_OWNER_CHANGED");
      }
      remoteSyncMetadata.set(scopeKey, next);
      return { ...next };
    },
    async applyRemoteSyncPage(input) {
      if (input.ownerStillCurrent && !input.ownerStillCurrent()) {
        throw new Error("SYNC_OWNER_CHANGED");
      }
      const currentMetadata = remoteSyncMetadata.get(scopeKey) ?? emptyMetadata();
      if (currentMetadata.cursor !== input.expectedCursor) {
        throw new Error("SYNC_CURSOR_CAS_MISMATCH");
      }
      const scopedRows = [...localExpenses.values()]
        .filter((row) => row.scopeKey === scopeKey)
        .map((row) => ({ ...row }));
      const scopedMutations = [...outbox.values()]
        .filter((row) => row.scopeKey === scopeKey)
        .map((row) => ({ ...row }));
      const reconciled = reconcileRemoteSyncPage(
        scopeKey,
        scopedRows,
        scopedMutations,
        input
      );
      if (input.ownerStillCurrent && !input.ownerStillCurrent()) {
        throw new Error("SYNC_OWNER_CHANGED");
      }

      for (const localId of reconciled.deleteLocalIds) {
        localExpenses.delete(localId);
      }
      for (const row of reconciled.upserts) {
        localExpenses.set(row.localId, { ...row });
      }
      for (const mutationId of reconciled.deleteMutationIds) {
        outbox.delete(mutationId);
        const index = outboxOrder.indexOf(mutationId);
        if (index !== -1) outboxOrder.splice(index, 1);
      }
      const metadata: RemoteSyncMetadata = {
        protocolVersion: 2,
        cursor: input.nextCursor,
        baselineComplete: !input.hasMore,
        lastSuccessfulPullAt: input.hasMore
          ? currentMetadata.lastSuccessfulPullAt
          : input.appliedAt,
        authorizationState: "authorized",
        authorizationCheckedAt: input.appliedAt
      };
      remoteSyncMetadata.set(scopeKey, metadata);
      return {
        affectedChildIds: reconciled.affectedChildIds,
        metadata: { ...metadata }
      };
    }
  };
}
