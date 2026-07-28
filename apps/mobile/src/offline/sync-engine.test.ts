import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  RemoteAuthRequiredError,
  RemotePermanentError,
  RemotePermissionDeniedError,
  RemoteVersionConflictError
} from "./errors";
import { MAX_AUTOMATIC_RETRY_ATTEMPTS } from "./backoff";
import { createMemoryOfflineStore } from "./memory-offline-store";
import {
  diffExpenseFields,
  flushOutbox,
  recordLocalCreate,
  recordLocalDelete,
  recordLocalUpdate,
  resolveConflictAdoptServer,
  resolveConflictReapplyMine,
  resolveConflictWithMergedPayload,
  retryFailedMutation,
  type RemoteExpenseApi
} from "./sync-engine";
import type { ConflictSnapshot, ExpensePayload, OfflineStore } from "./types";

const payload: ExpensePayload = {
  childId: "child-1",
  categoryId: "cat-diaper",
  amountKrw: 10_000,
  spentOn: "2026-07-01",
  itemName: "기저귀"
};

/** Records every call so tests can assert on ordering and idempotency-key stability, and can be
 * configured to fail the next N calls (network) or a specific canonicalId (version conflict). */
function createFakeRemote(options?: {
  failNetworkTimes?: number;
  conflictOnCanonicalId?: { id: string; current: ConflictSnapshot };
  permanentFailurePayloadMatch?: (payload: ExpensePayload) => boolean;
}) {
  const calls: Array<{ op: "create" | "update" | "delete"; idempotencyKey: string; canonicalId?: string }> = [];
  let remainingNetworkFailures = options?.failNetworkTimes ?? 0;
  let nextId = 0;

  const remote: RemoteExpenseApi = {
    async createExpense(createPayload, idempotencyKey) {
      calls.push({ op: "create", idempotencyKey });
      if (remainingNetworkFailures > 0) {
        remainingNetworkFailures -= 1;
        throw new TypeError("Network request failed");
      }
      if (options?.permanentFailurePayloadMatch?.(createPayload)) {
        throw new RemotePermanentError(422, "잘못된 요청이에요.");
      }
      nextId += 1;
      return { id: `server-${nextId}`, version: 1 };
    },
    async updateExpense(canonicalId, _updatePayload, expectedVersion, idempotencyKey) {
      calls.push({ op: "update", idempotencyKey, canonicalId });
      if (options?.conflictOnCanonicalId && canonicalId === options.conflictOnCanonicalId.id) {
        throw new RemoteVersionConflictError(options.conflictOnCanonicalId.current);
      }
      return { version: expectedVersion + 1 };
    },
    async deleteExpense(canonicalId, _expectedVersion, idempotencyKey) {
      calls.push({ op: "delete", idempotencyKey, canonicalId });
    }
  };

  return { remote, calls };
}

describe("sync-engine: recordLocalCreate + flushOutbox", () => {
  let store: OfflineStore;

  beforeEach(() => {
    store = createMemoryOfflineStore();
  });

  it("flushes outbox mutations in creation order", async () => {
    const first = await recordLocalCreate(store, { ...payload, itemName: "첫번째" }, "2026-07-12T00:00:00.000Z");
    const second = await recordLocalCreate(store, { ...payload, itemName: "두번째" }, "2026-07-12T00:00:01.000Z");
    const third = await recordLocalCreate(store, { ...payload, itemName: "세번째" }, "2026-07-12T00:00:02.000Z");

    const order: string[] = [];
    const remote: RemoteExpenseApi = {
      async createExpense(created) {
        order.push(created.itemName);
        return { id: `server-${order.length}`, version: 1 };
      },
      async updateExpense() {
        throw new Error("not used");
      },
      async deleteExpense() {
        throw new Error("not used");
      }
    };

    const summary = await flushOutbox(store, remote);

    expect(order).toEqual(["첫번째", "두번째", "세번째"]);
    expect(summary).toEqual({ synced: 3, failed: 0, conflicted: 0, stoppedForNetwork: false });
    for (const local of [first, second, third]) {
      const row = await store.getLocalExpense(local.localId);
      expect(row?.syncState).toBe("synced");
      expect(row?.canonicalId).toMatch(/^server-/);
    }
  });

  it("keeps the same idempotency key across a network-failure retry, and only sends it once it succeeds", async () => {
    const created = await recordLocalCreate(store, payload);
    const mutationsBefore = await store.listOutboxMutationsForLocalId(created.localId);
    const idempotencyKey = mutationsBefore[0].idempotencyKey;

    const { remote, calls } = createFakeRemote({ failNetworkTimes: 1 });

    const firstAttempt = await flushOutbox(store, remote);
    expect(firstAttempt.stoppedForNetwork).toBe(true);
    let row = await store.getLocalExpense(created.localId);
    expect(row?.syncState).toBe("pending");
    const mutationsAfterFailure = await store.listOutboxMutationsForLocalId(created.localId);
    expect(mutationsAfterFailure).toHaveLength(1);
    expect(mutationsAfterFailure[0].idempotencyKey).toBe(idempotencyKey);
    expect(mutationsAfterFailure[0].attemptCount).toBe(1);
    // Clear the backoff window so the retry below is actually attempted immediately.
    await store.updateOutboxMutation(mutationsAfterFailure[0].mutationId, { nextRetryAt: null });

    const secondAttempt = await flushOutbox(store, remote);
    expect(secondAttempt.synced).toBe(1);
    row = await store.getLocalExpense(created.localId);
    expect(row?.syncState).toBe("synced");

    expect(calls).toHaveLength(2);
    expect(calls[0].idempotencyKey).toBe(idempotencyKey);
    expect(calls[1].idempotencyKey).toBe(idempotencyKey);
  });

  it("stops automatic network retries at a finite cap and requires an explicit retry", async () => {
    const created = await recordLocalCreate(store, payload);
    const createExpense = vi.fn(async () => {
      throw new TypeError("Network request failed");
    });
    const remote: RemoteExpenseApi = {
      createExpense,
      async updateExpense() {
        throw new Error("not used");
      },
      async deleteExpense() {
        throw new Error("not used");
      }
    };

    for (let attempt = 1; attempt <= MAX_AUTOMATIC_RETRY_ATTEMPTS; attempt += 1) {
      const summary = await flushOutbox(store, remote);
      const mutation = (await store.listOutboxMutationsForLocalId(created.localId))[0];
      expect(mutation.attemptCount).toBe(attempt);
      if (attempt < MAX_AUTOMATIC_RETRY_ATTEMPTS) {
        expect((await store.getLocalExpense(created.localId))?.syncState).toBe("pending");
        expect(summary.stoppedForNetwork).toBe(true);
        await store.updateOutboxMutation(mutation.mutationId, { nextRetryAt: null });
      } else {
        expect(await store.getLocalExpense(created.localId)).toMatchObject({
          syncState: "failed",
          failureKind: "retry_exhausted"
        });
        expect(summary.failed).toBe(1);
      }
    }

    await flushOutbox(store, remote);
    expect(createExpense).toHaveBeenCalledTimes(MAX_AUTOMATIC_RETRY_ATTEMPTS);

    await retryFailedMutation(store, created.localId);
    const resetMutation = (await store.listOutboxMutationsForLocalId(created.localId))[0];
    expect(resetMutation).toMatchObject({ attemptCount: 0, nextRetryAt: null, lastError: null });
    expect((await store.getLocalExpense(created.localId))?.syncState).toBe("pending");
  });

  it("replays a Sprint 1 outbox payload that has no paymentMethodId", async () => {
    const legacyPayload = { ...payload };
    const created = await recordLocalCreate(store, legacyPayload);
    let received: ExpensePayload | null = null;
    const remote: RemoteExpenseApi = {
      async createExpense(value) {
        received = value;
        return { id: "server-legacy", version: 1 };
      },
      async updateExpense() {
        throw new Error("not used");
      },
      async deleteExpense() {
        throw new Error("not used");
      }
    };

    await expect(flushOutbox(store, remote)).resolves.toEqual({
      synced: 1,
      failed: 0,
      conflicted: 0,
      stoppedForNetwork: false
    });
    expect(received).toEqual(legacyPayload);
    expect(received).not.toHaveProperty("paymentMethodId");
    expect((await store.getLocalExpense(created.localId))?.canonicalId).toBe("server-legacy");
  });

  it("creates 20 offline expenses and flushes them with zero duplicates", async () => {
    const created = [];
    for (let index = 0; index < 20; index += 1) {
      created.push(await recordLocalCreate(store, { ...payload, itemName: `지출 ${index}` }, `2026-07-12T00:00:${String(index).padStart(2, "0")}.000Z`));
    }

    const { remote, calls } = createFakeRemote();
    const summary = await flushOutbox(store, remote);

    expect(summary).toEqual({ synced: 20, failed: 0, conflicted: 0, stoppedForNetwork: false });
    expect(calls).toHaveLength(20);
    const idempotencyKeys = new Set(calls.map((call) => call.idempotencyKey));
    expect(idempotencyKeys.size).toBe(20);

    const canonicalIds = new Set<string>();
    for (const local of created) {
      const row = await store.getLocalExpense(local.localId);
      expect(row?.syncState).toBe("synced");
      expect(row?.canonicalId).toBeTruthy();
      canonicalIds.add(row!.canonicalId!);
    }
    expect(canonicalIds.size).toBe(20);

    const remainingOutbox = await store.listOutboxMutations();
    expect(remainingOutbox).toHaveLength(0);
  });

  it("moves a 4xx failure to 'failed' and stops auto-retrying it until explicitly retried", async () => {
    const created = await recordLocalCreate(store, payload);
    const { remote } = createFakeRemote({ permanentFailurePayloadMatch: () => true });

    const summary = await flushOutbox(store, remote);
    expect(summary).toEqual({ synced: 0, failed: 1, conflicted: 0, stoppedForNetwork: false });
    const row = await store.getLocalExpense(created.localId);
    expect(row?.syncState).toBe("failed");
    expect(row?.failureKind).toBe("validation");

    // A second flush pass should skip it (still 'failed', no user action taken yet).
    const secondSummary = await flushOutbox(store, remote);
    expect(secondSummary).toEqual({ synced: 0, failed: 0, conflicted: 0, stoppedForNetwork: false });
  });

  it("classifies final 401 as auth-required and does not create an automatic retry loop", async () => {
    const created = await recordLocalCreate(store, payload);
    const createExpense = vi.fn(async () => {
      throw new RemoteAuthRequiredError();
    });
    const remote: RemoteExpenseApi = {
      createExpense,
      async updateExpense() {
        throw new Error("not used");
      },
      async deleteExpense() {
        throw new Error("not used");
      }
    };

    await expect(flushOutbox(store, remote)).resolves.toMatchObject({ failed: 1 });
    expect(await store.getLocalExpense(created.localId)).toMatchObject({
      syncState: "failed",
      failureKind: "auth_required"
    });
    await flushOutbox(store, remote);
    expect(createExpense).toHaveBeenCalledTimes(1);
  });

  it("keeps 403 separate from authentication-required recovery", async () => {
    const created = await recordLocalCreate(store, payload);
    const remote: RemoteExpenseApi = {
      async createExpense() {
        throw new RemotePermissionDeniedError();
      },
      async updateExpense() {
        throw new Error("not used");
      },
      async deleteExpense() {
        throw new Error("not used");
      }
    };

    await flushOutbox(store, remote);
    expect(await store.getLocalExpense(created.localId)).toMatchObject({
      syncState: "failed",
      failureKind: "permission_denied"
    });
  });
});

describe("sync-engine: outbox merge integration via recordLocalUpdate/recordLocalDelete", () => {
  let store: OfflineStore;

  beforeEach(() => {
    store = createMemoryOfflineStore();
  });

  it("folds an update onto a still-pending create into a single outbox mutation", async () => {
    const created = await recordLocalCreate(store, payload);
    await recordLocalUpdate(store, created.localId, { amountKrw: 20_000 });

    const mutations = await store.listOutboxMutationsForLocalId(created.localId);
    expect(mutations).toHaveLength(1);
    expect(mutations[0].operation).toBe("create");
    expect(mutations[0].payload?.amountKrw).toBe(20_000);
  });

  it("leaves fields unset in an explicit undefined patch unchanged instead of wiping them (matches the app/expenses/[expenseId].tsx 'field || undefined' convention)", async () => {
    const created = await recordLocalCreate(store, { ...payload, memo: "원래 메모" });
    const updated = await recordLocalUpdate(store, created.localId, { amountKrw: 25_000, memo: undefined });

    expect(updated.payload.amountKrw).toBe(25_000);
    expect(updated.payload.memo).toBe("원래 메모");
  });

  it("drops the local row entirely for create+delete before the create ever synced", async () => {
    const created = await recordLocalCreate(store, payload);
    await recordLocalDelete(store, created.localId);

    expect(await store.getLocalExpense(created.localId)).toBeNull();
    expect(await store.listOutboxMutationsForLocalId(created.localId)).toHaveLength(0);
  });
});

describe("sync-engine: 409 VERSION_CONFLICT transition", () => {
  let store: OfflineStore;

  beforeEach(async () => {
    store = createMemoryOfflineStore();
  });

  async function seedSyncedExpense() {
    const created = await recordLocalCreate(store, payload);
    const { remote } = createFakeRemote();
    await flushOutbox(store, remote);
    return (await store.getLocalExpense(created.localId))!;
  }

  it("moves the local row to 'conflict' and preserves the server's current value", async () => {
    const synced = await seedSyncedExpense();
    await recordLocalUpdate(store, synced.localId, { amountKrw: 30_000 });

    const currentFromServer = {
      deleted: false as const,
      expense: { ...payload, id: synced.canonicalId!, version: 5 }
    };
    const { remote } = createFakeRemote({ conflictOnCanonicalId: { id: synced.canonicalId!, current: currentFromServer } });

    const summary = await flushOutbox(store, remote);
    expect(summary).toEqual({ synced: 0, failed: 0, conflicted: 1, stoppedForNetwork: false });

    const row = await store.getLocalExpense(synced.localId);
    expect(row?.syncState).toBe("conflict");
    expect(row?.conflictCurrent).toEqual(currentFromServer);

    // The outbox mutation must still be present -- it needs an explicit user resolution,
    // not silent last-write-wins.
    const mutations = await store.listOutboxMutationsForLocalId(synced.localId);
    expect(mutations).toHaveLength(1);
  });
});

describe("sync-engine: conflict resolution (design doc §3.4, three branches)", () => {
  let store: OfflineStore;

  async function seedConflictedExpense() {
    const created = await recordLocalCreate(store, payload);
    const { remote } = createFakeRemote();
    await flushOutbox(store, remote);
    const synced = (await store.getLocalExpense(created.localId))!;
    await recordLocalUpdate(store, synced.localId, { amountKrw: 30_000, itemName: "내가 바꾼 이름" });

    const currentFromServer = {
      deleted: false as const,
      expense: { ...payload, itemName: "다른 기기가 바꾼 이름", id: synced.canonicalId!, version: 5 }
    };
    const { remote: conflictingRemote } = createFakeRemote({
      conflictOnCanonicalId: { id: synced.canonicalId!, current: currentFromServer }
    });
    await flushOutbox(store, conflictingRemote);
    return { localId: synced.localId, currentFromServer };
  }

  beforeEach(() => {
    store = createMemoryOfflineStore();
  });

  it("① adopt-server: discards the local change and takes the server's value", async () => {
    const { localId, currentFromServer } = await seedConflictedExpense();

    await resolveConflictAdoptServer(store, localId);

    const row = await store.getLocalExpense(localId);
    expect(row?.syncState).toBe("synced");
    expect(row?.conflictCurrent).toBeNull();
    expect(row?.version).toBe(currentFromServer.expense.version);
    expect(row?.payload.itemName).toBe("다른 기기가 바꾼 이름");
    expect(await store.listOutboxMutationsForLocalId(localId)).toHaveLength(0);
  });

  it("② reapply-mine: requeues the local change with the server's version as the new expectedVersion", async () => {
    const { localId, currentFromServer } = await seedConflictedExpense();

    await resolveConflictReapplyMine(store, localId);

    const row = await store.getLocalExpense(localId);
    expect(row?.syncState).toBe("pending");
    expect(row?.conflictCurrent).toBeNull();
    expect(row?.payload.itemName).toBe("내가 바꾼 이름");

    const mutations = await store.listOutboxMutationsForLocalId(localId);
    expect(mutations).toHaveLength(1);
    expect(mutations[0].operation).toBe("update");
    expect(mutations[0].expectedVersion).toBe(currentFromServer.expense.version);
  });

  it("② reapply-mine on a deleted-tombstone conflict re-queues as a brand-new create", async () => {
    const created = await recordLocalCreate(store, payload);
    const { remote } = createFakeRemote();
    await flushOutbox(store, remote);
    const synced = (await store.getLocalExpense(created.localId))!;
    await recordLocalUpdate(store, synced.localId, { amountKrw: 30_000 });

    const deletedCurrent = { deleted: true as const, id: synced.canonicalId!, version: 9 };
    const { remote: conflictingRemote } = createFakeRemote({
      conflictOnCanonicalId: { id: synced.canonicalId!, current: deletedCurrent }
    });
    await flushOutbox(store, conflictingRemote);

    await resolveConflictReapplyMine(store, synced.localId);

    const row = await store.getLocalExpense(synced.localId);
    expect(row?.canonicalId).toBeNull();
    expect(row?.version).toBeNull();
    expect(row?.syncState).toBe("pending");

    const mutations = await store.listOutboxMutationsForLocalId(synced.localId);
    expect(mutations).toHaveLength(1);
    expect(mutations[0].operation).toBe("create");
    expect(mutations[0].expectedVersion).toBeNull();
  });

  it("③ side-by-side merge: sends a chosen field combination gated on the server's version", async () => {
    const { localId, currentFromServer } = await seedConflictedExpense();

    const diff = diffExpenseFields(
      { ...payload, amountKrw: 30_000, itemName: "내가 바꾼 이름" },
      currentFromServer.expense
    );
    expect(diff.some((entry) => entry.field === "itemName")).toBe(true);

    const mergedPayload: ExpensePayload = { ...payload, amountKrw: 30_000, itemName: "다른 기기가 바꾼 이름" };
    await resolveConflictWithMergedPayload(store, localId, mergedPayload);

    const row = await store.getLocalExpense(localId);
    expect(row?.syncState).toBe("pending");
    expect(row?.payload).toEqual(mergedPayload);

    const mutations = await store.listOutboxMutationsForLocalId(localId);
    expect(mutations).toHaveLength(1);
    expect(mutations[0].operation).toBe("update");
    expect(mutations[0].expectedVersion).toBe(currentFromServer.expense.version);
    expect(mutations[0].payload).toEqual(mergedPayload);
  });
});

describe("sync-engine: H-3 in-flight interleaving safety (diff review)", () => {
  let store: OfflineStore;

  beforeEach(() => {
    store = createMemoryOfflineStore();
  });

  it("does not silently lose an edit that lands while the row's create is still in-flight", async () => {
    const created = await recordLocalCreate(store, { ...payload, amountKrw: 10_000 });

    let resolveCreate!: (result: { id: string; version: number }) => void;
    const createResultPromise = new Promise<{ id: string; version: number }>((resolve) => {
      resolveCreate = resolve;
    });
    const createCalls: ExpensePayload[] = [];
    const updateCalls: Array<{ canonicalId: string; payload: ExpensePayload; expectedVersion: number }> = [];
    const remote: RemoteExpenseApi = {
      async createExpense(createPayload) {
        createCalls.push(createPayload);
        return createResultPromise;
      },
      async updateExpense(canonicalId, updatePayload, expectedVersion) {
        updateCalls.push({ canonicalId, payload: updatePayload, expectedVersion });
        return { version: expectedVersion + 1 };
      },
      async deleteExpense() {
        throw new Error("not used in this test");
      }
    };

    const firstFlush = flushOutbox(store, remote);

    // Let the microtasks up through "read the mutation, mark it in-flight, call
    // remote.createExpense" run before the edit lands -- remote.createExpense is now blocked on
    // createResultPromise, simulating a slow in-flight request.
    await new Promise((resolve) => setTimeout(resolve, 0));

    const mutationsWhileInFlight = await store.listOutboxMutationsForLocalId(created.localId);
    expect(mutationsWhileInFlight).toHaveLength(1);
    expect(mutationsWhileInFlight[0].inFlight).toBe(true);

    // The edit lands *during* the in-flight create -- this is exactly the interleaving that used
    // to silently fold into (and then get deleted along with) the in-flight mutation.
    await recordLocalUpdate(store, created.localId, { amountKrw: 25_000 });

    const mutationsAfterEdit = await store.listOutboxMutationsForLocalId(created.localId);
    expect(mutationsAfterEdit).toHaveLength(2);
    const stillInFlightCreate = mutationsAfterEdit.find((mutation) => mutation.operation === "create")!;
    // Untouched -- if the edit had been folded into it (the pre-fix bug), this would now read
    // 25_000, even though the request already in flight was sent with 10_000.
    expect(stillInFlightCreate.payload?.amountKrw).toBe(10_000);
    const queuedUpdate = mutationsAfterEdit.find((mutation) => mutation.operation === "update")!;
    expect(queuedUpdate.payload?.amountKrw).toBe(25_000);
    expect(queuedUpdate.inFlight).toBeFalsy();

    // The edit path starts its own background flush while the create pass is still active.
    // That caller must share the single flight *and* request a follow-up drain; requiring an
    // unrelated later foreground/reconnect event would leave this edit pending indefinitely.
    const followUpFlush = flushOutbox(store, remote);

    resolveCreate({ id: "server-1", version: 1 });
    const [firstSummary, followUpSummary] = await Promise.all([firstFlush, followUpFlush]);

    expect(firstSummary.synced).toBe(2);
    expect(followUpSummary).toEqual(firstSummary);
    expect(createCalls).toHaveLength(1);
    expect(createCalls[0].amountKrw).toBe(10_000);
    expect(updateCalls).toHaveLength(1);
    expect(updateCalls[0].canonicalId).toBe("server-1");
    expect(updateCalls[0].payload.amountKrw).toBe(25_000);
    expect(updateCalls[0].expectedVersion).toBe(1);

    const finalRow = await store.getLocalExpense(created.localId);
    expect(finalRow?.syncState).toBe("synced");
    expect(finalRow?.payload.amountKrw).toBe(25_000);
    expect(finalRow?.version).toBe(2);
    expect(await store.listOutboxMutationsForLocalId(created.localId)).toHaveLength(0);
  });

  it("rebases a second edit on the version acknowledged by an in-flight update", async () => {
    const created = await recordLocalCreate(store, { ...payload, amountKrw: 10_000 });
    await flushOutbox(store, {
      async createExpense() {
        return { id: "server-1", version: 1 };
      },
      async updateExpense() {
        throw new Error("not used");
      },
      async deleteExpense() {
        throw new Error("not used");
      }
    });
    await recordLocalUpdate(store, created.localId, { amountKrw: 20_000 });

    let resolveFirstUpdate!: (result: { version: number }) => void;
    const firstUpdate = new Promise<{ version: number }>((resolve) => {
      resolveFirstUpdate = resolve;
    });
    const expectedVersions: number[] = [];
    const remote: RemoteExpenseApi = {
      async createExpense() {
        throw new Error("not used");
      },
      async updateExpense(_id, _payload, expectedVersion) {
        expectedVersions.push(expectedVersion);
        if (expectedVersions.length === 1) return firstUpdate;
        return { version: expectedVersion + 1 };
      },
      async deleteExpense() {
        throw new Error("not used");
      }
    };

    const activeFlush = flushOutbox(store, remote);
    await new Promise((resolve) => setTimeout(resolve, 0));
    await recordLocalUpdate(store, created.localId, { amountKrw: 30_000 });
    const queued = await store.listOutboxMutationsForLocalId(created.localId);
    expect(queued).toHaveLength(2);
    expect(queued.find((mutation) => !mutation.inFlight)?.expectedVersion).toBeNull();
    const followUp = flushOutbox(store, remote);
    resolveFirstUpdate({ version: 2 });
    await Promise.all([activeFlush, followUp]);

    expect(expectedVersions).toEqual([1, 2]);
    expect(await store.getLocalExpense(created.localId)).toMatchObject({
      version: 3,
      syncState: "synced",
      payload: { amountKrw: 30_000 }
    });
  });

  it("serializes concurrent flushOutbox calls against the same store into a single pass instead of double-sending", async () => {
    await recordLocalCreate(store, payload);
    let createCallCount = 0;
    const remote: RemoteExpenseApi = {
      async createExpense() {
        createCallCount += 1;
        await new Promise((resolve) => setTimeout(resolve, 5));
        return { id: `server-${createCallCount}`, version: 1 };
      },
      async updateExpense() {
        throw new Error("not used in this test");
      },
      async deleteExpense() {
        throw new Error("not used in this test");
      }
    };

    const [first, second] = await Promise.all([flushOutbox(store, remote), flushOutbox(store, remote)]);

    expect(createCallCount).toBe(1);
    expect(first).toEqual(second);
    expect(first.synced).toBe(1);
  });

  it("cancels an old-session flush without acknowledging the queued mutation or consuming retry budget", async () => {
    const created = await recordLocalCreate(store, payload);
    const controller = new AbortController();
    let ownerActive = true;
    let resolveRemote!: (value: { id: string; version: number }) => void;
    const remoteResult = new Promise<{ id: string; version: number }>((resolve) => {
      resolveRemote = resolve;
    });
    const remote: RemoteExpenseApi = {
      createExpense: async () => remoteResult,
      updateExpense: async () => {
        throw new Error("not used in this test");
      },
      deleteExpense: async () => {
        throw new Error("not used in this test");
      }
    };

    const flushing = flushOutbox(store, remote, {
      signal: controller.signal,
      isActive: () => ownerActive
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect((await store.listOutboxMutationsForLocalId(created.localId))[0].inFlight).toBe(true);

    ownerActive = false;
    controller.abort();
    resolveRemote({ id: "server-from-old-session", version: 1 });

    await expect(flushing).resolves.toMatchObject({ cancelled: true, synced: 0 });
    const queued = (await store.listOutboxMutationsForLocalId(created.localId))[0];
    expect(queued).toMatchObject({ attemptCount: 0, inFlight: false, lastError: null });
    expect(await store.getLocalExpense(created.localId)).toMatchObject({
      canonicalId: null,
      syncState: "pending",
      lastError: null
    });

    const currentRemote: RemoteExpenseApi = {
      createExpense: async () => ({ id: "server-from-current-session", version: 1 }),
      updateExpense: async () => {
        throw new Error("not used in this test");
      },
      deleteExpense: async () => {
        throw new Error("not used in this test");
      }
    };
    await expect(flushOutbox(store, currentRemote)).resolves.toMatchObject({ synced: 1 });
    expect(await store.getLocalExpense(created.localId)).toMatchObject({
      canonicalId: "server-from-current-session",
      syncState: "synced"
    });
  });
});
