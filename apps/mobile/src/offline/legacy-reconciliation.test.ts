import { describe, expect, it, vi } from "vitest";
import {
  reconcileLegacyOfflineMutations,
  type LegacyOfflineReconcileResult
} from "../api/client";
import {
  buildLegacyReconciliationRequests,
  chunkLegacyReconciliationRequests,
  reconcileLegacyOfflineScope
} from "./legacy-reconciliation";
import type {
  LegacyQuarantineEntry,
  LocalExpenseRow,
  MutationOutboxRow,
  OfflineStore
} from "./types";

vi.mock("../api/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../api/client")>();
  return {
    ...actual,
    reconcileLegacyOfflineMutations: vi.fn()
  };
});

const entry: LegacyQuarantineEntry = {
  id: "legacy:local-1",
  sourceLocalId: "local-1",
  classification: "awaiting_reconciliation",
  reasonCode: "LEGACY_SERVER_PROOF_REQUIRED",
  createdAt: "2026-07-17T00:00:00.000Z",
  localExpenseJson: JSON.stringify({
    local_id: "local-1",
    canonical_id: null,
    child_id: "67ec851a-5920-4f91-9b17-4ec6659e91ca",
    payload: JSON.stringify({
      childId: "67ec851a-5920-4f91-9b17-4ec6659e91ca",
      categoryId: "category-1",
      amountKrw: 12_000,
      spentOn: "2026-07-17",
      itemName: "기저귀",
      expenseType: "refund"
    }),
    version: null,
    sync_state: "pending",
    pending_delete: 0,
    conflict_current: null,
    last_error: null,
    created_at: "2026-07-17T00:00:00.000Z",
    updated_at: "2026-07-17T00:00:00.000Z"
  }),
  outboxJson: JSON.stringify([
    {
      mutation_id: "mutation-1",
      idempotency_key: "idem-1",
      operation: "create",
      target_local_id: "local-1",
      payload: JSON.stringify({
        childId: "67ec851a-5920-4f91-9b17-4ec6659e91ca",
        categoryId: "category-1",
        amountKrw: 12_000,
        spentOn: "2026-07-17",
        itemName: "기저귀",
        expenseType: "refund"
      }),
      expected_version: null,
      attempt_count: 1,
      next_retry_at: null,
      last_error: null,
      created_at: "2026-07-17T00:00:00.000Z"
    }
  ])
};

describe("legacy offline reconciliation request", () => {
  it("reconstructs the exact allowlisted request shape without claiming the current account", () => {
    expect(buildLegacyReconciliationRequests([entry])).toEqual([
      {
        sourceLocalId: "local-1",
        sourceMutationId: "mutation-1",
        idempotencyKey: "idem-1",
        method: "POST",
        path: "/children/67ec851a-5920-4f91-9b17-4ec6659e91ca/expenses",
        body: {
          categoryId: "category-1",
          amountKrw: 12_000,
          spentOn: "2026-07-17",
          itemName: "기저귀",
          merchant: undefined,
          paymentMethod: undefined,
          paymentMethodId: undefined,
          memo: undefined,
          linkedItemTemplateId: undefined,
          linkedItemDefinitionId: undefined,
          expenseCategoryV2Id: undefined,
          expenseType: undefined
        }
      }
    ]);
  });

  it("keeps every server reconciliation request within the 50-row API limit", () => {
    const requests = Array.from({ length: 121 }, (_, index) => ({
      sourceLocalId: `local-${index}`,
      sourceMutationId: `mutation-${index}`,
      idempotencyKey: `idem-${index}`,
      method: "POST" as const,
      path: "/children/67ec851a-5920-4f91-9b17-4ec6659e91ca/expenses",
      body: { amountKrw: index + 1 }
    }));

    expect(chunkLegacyReconciliationRequests(requests).map((batch) => batch.length))
      .toEqual([50, 50, 21]);
    expect(chunkLegacyReconciliationRequests(requests).flat()).toEqual(requests);
    expect(() => chunkLegacyReconciliationRequests(requests, 51)).toThrow(
      "LEGACY_RECONCILIATION_BATCH_SIZE_INVALID"
    );
  });

  it("restores only a server-proven row across 30 deterministic quarantine reconciliations", async () => {
    for (let repeat = 0; repeat < 30; repeat += 1) {
      const restoreLegacyQuarantineEntry = vi.fn(async (
        _id: string,
        _row: LocalExpenseRow | null,
        _mutations: MutationOutboxRow[]
      ) => undefined);
      const store = {
        scopeKey: `v1:user-owner-${repeat}:household-owner-${repeat}`,
        listLegacyQuarantineEntries: vi.fn(async () => [entry]),
        restoreLegacyQuarantineEntry
      } as unknown as OfflineStore;
      vi.mocked(reconcileLegacyOfflineMutations).mockResolvedValueOnce({
        results: [{
          sourceLocalId: "local-1",
          sourceMutationId: "mutation-1",
          disposition: "already_synced",
          reasonCode: "CURRENT_USER_COMPLETED_REQUEST_MATCH",
          response: { id: `server-expense-${repeat}`, version: 3 }
        } satisfies LegacyOfflineReconcileResult]
      });

      await expect(reconcileLegacyOfflineScope("owner-token", store)).resolves.toEqual({
        restored: 1,
        remaining: 0
      });
      expect(restoreLegacyQuarantineEntry).toHaveBeenCalledWith(
        entry.id,
        expect.objectContaining({
          scopeKey: store.scopeKey,
          canonicalId: `server-expense-${repeat}`,
          version: 3,
          syncState: "synced"
        }),
        []
      );

      restoreLegacyQuarantineEntry.mockClear();
      vi.mocked(reconcileLegacyOfflineMutations).mockResolvedValueOnce({
        results: [{
          sourceLocalId: "local-1",
          sourceMutationId: "mutation-1",
          disposition: "ambiguous",
          reasonCode: "CURRENT_USER_IDEMPOTENCY_PROOF_NOT_FOUND"
        } satisfies LegacyOfflineReconcileResult]
      });
      await expect(reconcileLegacyOfflineScope("different-user-token", store)).resolves.toEqual({
        restored: 0,
        remaining: 1
      });
      expect(restoreLegacyQuarantineEntry).not.toHaveBeenCalled();
    }
  });

  it("stops after an in-flight batch loses session ownership and never restores local rows", async () => {
    vi.mocked(reconcileLegacyOfflineMutations).mockReset();
    const baseMutation = JSON.parse(entry.outboxJson) as Array<Record<string, unknown>>;
    const manyMutations = Array.from({ length: 51 }, (_, index) => ({
      ...baseMutation[0],
      mutation_id: `mutation-${index}`,
      idempotency_key: `idem-${index}`
    }));
    const batchedEntry = { ...entry, outboxJson: JSON.stringify(manyMutations) };
    const restoreLegacyQuarantineEntry = vi.fn(async () => undefined);
    const store = {
      scopeKey: "v1:user-a:household-a",
      listLegacyQuarantineEntries: vi.fn(async () => [batchedEntry]),
      restoreLegacyQuarantineEntry
    } as unknown as OfflineStore;
    let resolveFirstBatch!: (value: { results: LegacyOfflineReconcileResult[] }) => void;
    const firstBatch = new Promise<{ results: LegacyOfflineReconcileResult[] }>((resolve) => {
      resolveFirstBatch = resolve;
    });
    vi.mocked(reconcileLegacyOfflineMutations).mockImplementationOnce(async () => firstBatch);
    const controller = new AbortController();
    let ownerActive = true;

    const reconciliation = reconcileLegacyOfflineScope("owner-token", store, {
      signal: controller.signal,
      isActive: () => ownerActive
    });
    await vi.waitFor(() => expect(reconcileLegacyOfflineMutations).toHaveBeenCalledTimes(1));
    expect(vi.mocked(reconcileLegacyOfflineMutations).mock.calls[0]?.[2]).toBe(controller.signal);

    ownerActive = false;
    controller.abort();
    resolveFirstBatch({ results: [] });

    await expect(reconciliation).rejects.toMatchObject({ name: "RemoteSyncCancelledError" });
    expect(reconcileLegacyOfflineMutations).toHaveBeenCalledTimes(1);
    expect(restoreLegacyQuarantineEntry).not.toHaveBeenCalled();
  });
});
