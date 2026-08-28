import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { RemotePermanentError, RemoteVersionConflictError } from "./errors";
import { createMemoryOfflineStore } from "./memory-offline-store";
import {
  diffExpenseFields,
  flushOutbox,
  recordLocalCreate,
  recordLocalDelete,
  recordLocalItemStatus,
  recordLocalUpdate,
  recoverInterruptedSyncState,
  resolveConflictAdoptServer,
  resolveConflictReapplyMine,
  resolveConflictWithMergedPayload,
  type RemoteExpenseApi
} from "./sync-engine";
import type { ConflictSnapshot, ExpensePayload, ItemStatusPayload, OfflineStore } from "./types";

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
    expect(summary).toEqual({ synced: 3, failed: 0, conflicted: 0, itemStatusSynced: 0, itemStatusFailed: 0, stoppedForNetwork: false });
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

  it("creates 20 offline expenses and flushes them with zero duplicates", async () => {
    const created = [];
    for (let index = 0; index < 20; index += 1) {
      created.push(await recordLocalCreate(store, { ...payload, itemName: `지출 ${index}` }, `2026-07-12T00:00:${String(index).padStart(2, "0")}.000Z`));
    }

    const { remote, calls } = createFakeRemote();
    const summary = await flushOutbox(store, remote);

    expect(summary).toEqual({ synced: 20, failed: 0, conflicted: 0, itemStatusSynced: 0, itemStatusFailed: 0, stoppedForNetwork: false });
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
    expect(summary).toEqual({ synced: 0, failed: 1, conflicted: 0, itemStatusSynced: 0, itemStatusFailed: 0, stoppedForNetwork: false });
    const row = await store.getLocalExpense(created.localId);
    expect(row?.syncState).toBe("failed");

    // A second flush pass should skip it (still 'failed', no user action taken yet).
    const secondSummary = await flushOutbox(store, remote);
    expect(secondSummary).toEqual({ synced: 0, failed: 0, conflicted: 0, itemStatusSynced: 0, itemStatusFailed: 0, stoppedForNetwork: false });
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

  /**
   * 라운드 57 QA(P2-4) — 실패했던 행을 사용자가 **고치거나 지우면** 실패 사유도 함께 사라진다.
   *
   * `lastError`(사람이 읽는 문장)만 비우고 구조화된 사유(`lastErrorStatus`/`lastErrorCode`)를
   * 남기면, 그 행이 다음에 화면에 실패로 뜨는 순간 **지난번 실패의 status**로 판정되어 이미
   * 성격이 달라진 실패에 "다시 보내도 같은 결과예요"가 붙는다(permission-denied.ts).
   */
  it("recordLocalUpdate/recordLocalDelete가 구조화된 실패 사유까지 지운다", async () => {
    const created = await recordLocalCreate(store, payload);
    await store.updateLocalExpense(created.localId, {
      syncState: "failed",
      lastError: "권한이 없어요. 가족 구성원 여부와 내 역할을 확인해 주세요.",
      lastErrorStatus: 403,
      lastErrorCode: "FORBIDDEN"
    });

    const updated = await recordLocalUpdate(store, created.localId, { amountKrw: 20_000 });
    expect(updated.syncState).toBe("pending");
    expect(updated.lastError).toBeNull();
    expect(updated.lastErrorStatus).toBeNull();
    expect(updated.lastErrorCode).toBeNull();

    // 삭제 대기로 넘어갈 때도 같다. 서버가 이미 아는 행이어야 삭제가 큐에 남으므로(create+delete는
    // 둘 다 버려진다) 대기 create를 치우고 canonicalId를 채운 "동기화됐다가 실패한" 행을 만든다.
    const synced = await recordLocalCreate(store, payload);
    for (const queued of await store.listOutboxMutationsForLocalId(synced.localId)) {
      await store.deleteOutboxMutation(queued.mutationId);
    }
    await store.updateLocalExpense(synced.localId, {
      canonicalId: "srv-1",
      version: 3,
      syncState: "failed",
      lastError: "잠시 후 다시 시도해주세요.",
      lastErrorStatus: 500,
      lastErrorCode: "INTERNAL_ERROR"
    });
    await recordLocalDelete(store, synced.localId);

    const afterDelete = await store.getLocalExpense(synced.localId);
    expect(afterDelete?.pendingDelete).toBe(true);
    expect(afterDelete?.syncState).toBe("pending");
    expect(afterDelete?.lastError).toBeNull();
    expect(afterDelete?.lastErrorStatus).toBeNull();
    expect(afterDelete?.lastErrorCode).toBeNull();
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
    expect(summary).toEqual({ synced: 0, failed: 0, conflicted: 1, itemStatusSynced: 0, itemStatusFailed: 0, stoppedForNetwork: false });

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
    // COV-T5 bug 2 fix: exactly the ExpensePayload fields are adopted -- the snapshot's
    // server bookkeeping keys (id/version) never leak into the payload object.
    expect(row?.payload).toEqual({ ...payload, itemName: "다른 기기가 바꾼 이름" });
    expect(Object.keys(row?.payload ?? {})).not.toContain("id");
    expect(Object.keys(row?.payload ?? {})).not.toContain("version");
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

  /**
   * 라운드 49 QA(P3-9): 유령 충돌 행 — 아무도 바꾸지 않은 "구매처"·"메모".
   *
   * 지출 상세는 판매처·메모를 비울 때 **빈 문자열**을 보낸다(그래야 서버가 "지웠다"로 알아듣는다).
   * 그래서 원래 값이 없던 지출의 금액만 고쳐도 대기 payload에는 ""가, 서버에는 null이 남는다.
   * 그 둘을 다른 값으로 보면 충돌 화면이 "구매처: 없음 / 없음" 같은, 고를 것이 없는 행을 띄웠다.
   */
  it("④ 빈 문자열과 null은 같은 '없음'이라 충돌 항목이 되지 않는다", () => {
    const local: ExpensePayload = { ...payload, merchant: "", memo: "  ", amountKrw: 30_000 };
    const server: ExpensePayload = { ...payload, merchant: null, memo: null, amountKrw: 10_000 };

    const diff = diffExpenseFields(local, server);
    expect(diff.map((entry) => entry.field)).toEqual(["amountKrw"]);

    // 진짜로 값이 다른 경우는 종전 그대로 보인다(비운 것도 변경이다).
    const cleared = diffExpenseFields({ ...payload, merchant: "" }, { ...payload, merchant: "쿠팡" });
    expect(cleared.map((entry) => entry.field)).toEqual(["merchant"]);
    expect(cleared[0]).toMatchObject({ localValue: "", serverValue: "쿠팡" });
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

    resolveCreate({ id: "server-1", version: 1 });
    const firstSummary = await firstFlush;

    expect(firstSummary.synced).toBe(1);
    expect(createCalls).toHaveLength(1);
    expect(createCalls[0].amountKrw).toBe(10_000);

    const rowAfterCreate = await store.getLocalExpense(created.localId);
    expect(rowAfterCreate?.canonicalId).toBe("server-1");
    expect(rowAfterCreate?.payload.amountKrw).toBe(25_000);
    // Not 'synced' yet -- the queued update still hasn't reached the server.
    expect(rowAfterCreate?.syncState).toBe("pending");

    // The queued update must still be present -- the create's own cleanup only ever deletes its
    // own mutationId, never anything appended alongside it.
    const mutationsAfterCreateSynced = await store.listOutboxMutationsForLocalId(created.localId);
    expect(mutationsAfterCreateSynced).toHaveLength(1);
    expect(mutationsAfterCreateSynced[0].operation).toBe("update");

    // A later flush pass (as would be triggered by the edit itself, or the next foreground/
    // reconnect event) sends the queued update now that canonicalId/version are known.
    const secondSummary = await flushOutbox(store, remote);
    expect(secondSummary.synced).toBe(1);
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
});

/**
 * 라운드 51 QA(P1-1) — 지출 큐도 준비템 큐와 같은 결함을 갖고 있었다(빈도만 낮다): pass가 도는
 * 동안 저장된 기록은 그 pass의 스냅숏에 없고, 그 사이의 flush 요청은 단일 비행 가드에 흡수돼
 * 사라졌다. 두 큐 모두 flushOutbox의 "재실행 표시" 하나로 함께 낫는다.
 */
describe("라운드 51 QA(P1-1): pass 중에 저장된 지출도 같은 호출 안에서 이어서 나간다", () => {
  it("A 전송 중에 저장한 B가 pass 종료 후 자동으로 전송된다", async () => {
    const store = createMemoryOfflineStore();
    await recordLocalCreate(store, { ...payload, itemName: "먼저" });

    const sentNames: string[] = [];
    let releaseFirst!: () => void;
    const firstReleased = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    let markFirstSeen!: () => void;
    const firstSeen = new Promise<void>((resolve) => {
      markFirstSeen = resolve;
    });
    const remote: RemoteExpenseApi = {
      async createExpense(created) {
        sentNames.push(created.itemName);
        if (sentNames.length === 1) {
          markFirstSeen();
          await firstReleased;
        }
        return { id: `server-${sentNames.length}`, version: 1 };
      },
      async updateExpense() {
        throw new Error("not used in this test");
      },
      async deleteExpense() {
        throw new Error("not used in this test");
      }
    };

    const flush = flushOutbox(store, remote);
    await firstSeen;

    // createExpenseOffline이 하는 그대로: 로컬에 남기고 곧바로 flush를 한 번 요청한다.
    await recordLocalCreate(store, { ...payload, itemName: "나중" });
    expect(flushOutbox(store, remote)).toBe(flush);

    releaseFirst();
    const summary = await flush;

    expect(sentNames).toEqual(["먼저", "나중"]);
    expect(summary.synced).toBe(2);
    expect(await store.listOutboxMutations()).toEqual([]);
  });
});

/**
 * 라운드 51 QA(P3-7) — 전송 도중 앱이 죽으면서 남은 표시의 재시작 자가 치유.
 *
 * 남은 `inFlight` 표시는 병합 대상에서 그 행을 빼므로(outbox-merge.ts), 같은 지출을 고칠 때마다
 * 새 행이 붙어 큐가 끝없이 자란다. 화면에도 "동기화 중"으로 보이는데 실제로 나가 있는 요청은
 * 없다. 값·페이로드·백오프 예산은 그대로 두고 표시만 되돌린다.
 */
describe("라운드 51 QA(P3-7) recoverInterruptedSyncState", () => {
  const statusPayload: ItemStatusPayload = {
    childId: "child-1",
    itemTemplateId: "item-carseat",
    status: "prepared",
    itemName: "카시트"
  };

  it("죽은 'syncing'/inFlight 표시를 대기로 되돌린다 (값·예산은 그대로)", async () => {
    const store = createMemoryOfflineStore();
    const created = await recordLocalCreate(store, payload);
    const [mutation] = await store.listOutboxMutationsForLocalId(created.localId);
    await store.updateOutboxMutation(mutation.mutationId, { inFlight: true, attemptCount: 3, nextRetryAt: null });
    await store.updateLocalExpense(created.localId, { syncState: "syncing" });
    const statusRow = await recordLocalItemStatus(store, statusPayload);
    await store.updateItemStatusMutation(statusRow.mutationId, { inFlight: true, syncState: "syncing" });

    const repaired = await recoverInterruptedSyncState(store);

    // 지출 로컬 행 + 지출 mutation + 준비템 행 = 3.
    expect(repaired).toBe(3);
    expect((await store.getLocalExpense(created.localId))?.syncState).toBe("pending");
    const [repairedMutation] = await store.listOutboxMutationsForLocalId(created.localId);
    expect(repairedMutation.inFlight).toBe(false);
    // 백오프 예산과 페이로드는 한 글자도 건드리지 않는다.
    expect(repairedMutation.attemptCount).toBe(3);
    expect(repairedMutation.payload?.itemName).toBe(payload.itemName);
    const [repairedStatus] = await store.listItemStatusMutations();
    expect(repairedStatus).toMatchObject({ syncState: "pending", inFlight: false, status: "prepared" });
  });

  it("되돌린 뒤에는 새 편집이 다시 접힌다 (죽은 표시 때문에 행이 무한히 쌓이지 않는다)", async () => {
    const store = createMemoryOfflineStore();
    const created = await recordLocalCreate(store, payload);
    const [mutation] = await store.listOutboxMutationsForLocalId(created.localId);
    await store.updateOutboxMutation(mutation.mutationId, { inFlight: true });

    // 되돌리기 전: 죽은 표시가 병합을 막아 편집마다 새 행이 붙는다.
    await recordLocalUpdate(store, created.localId, { amountKrw: 20_000 });
    expect(await store.listOutboxMutationsForLocalId(created.localId)).toHaveLength(2);

    const store2 = createMemoryOfflineStore();
    const created2 = await recordLocalCreate(store2, payload);
    const [mutation2] = await store2.listOutboxMutationsForLocalId(created2.localId);
    await store2.updateOutboxMutation(mutation2.mutationId, { inFlight: true });
    await recoverInterruptedSyncState(store2);
    await recordLocalUpdate(store2, created2.localId, { amountKrw: 20_000 });

    const merged = await store2.listOutboxMutationsForLocalId(created2.localId);
    expect(merged).toHaveLength(1);
    expect(merged[0].operation).toBe("create");
    expect(merged[0].payload?.amountKrw).toBe(20_000);
  });

  it("'failed'·'conflict'·정상 대기 행은 건드리지 않는다", async () => {
    const store = createMemoryOfflineStore();
    const failed = await recordLocalCreate(store, { ...payload, itemName: "실패" });
    await store.updateLocalExpense(failed.localId, { syncState: "failed", lastError: "서버 오류" });
    const conflict = await recordLocalCreate(store, { ...payload, itemName: "충돌" });
    await store.updateLocalExpense(conflict.localId, { syncState: "conflict" });
    const pending = await recordLocalCreate(store, { ...payload, itemName: "대기" });
    const statusRow = await recordLocalItemStatus(store, statusPayload);
    await store.updateItemStatusMutation(statusRow.mutationId, { syncState: "failed", lastError: "권한이 없어요." });

    expect(await recoverInterruptedSyncState(store)).toBe(0);

    expect((await store.getLocalExpense(failed.localId))?.syncState).toBe("failed");
    expect((await store.getLocalExpense(conflict.localId))?.syncState).toBe("conflict");
    expect((await store.getLocalExpense(pending.localId))?.syncState).toBe("pending");
    expect((await store.listItemStatusMutations())[0].syncState).toBe("failed");
  });

  it("살아 있는 pass가 있으면 아무것도 하지 않는다 (전송 중 표시를 지우지 않는다)", async () => {
    const store = createMemoryOfflineStore();
    const created = await recordLocalCreate(store, payload);
    let releaseCreate!: (result: { id: string; version: number }) => void;
    const createResult = new Promise<{ id: string; version: number }>((resolve) => {
      releaseCreate = resolve;
    });
    let markSeen!: () => void;
    const seen = new Promise<void>((resolve) => {
      markSeen = resolve;
    });
    const remote: RemoteExpenseApi = {
      async createExpense() {
        markSeen();
        return createResult;
      },
      async updateExpense() {
        throw new Error("not used in this test");
      },
      async deleteExpense() {
        throw new Error("not used in this test");
      }
    };

    const flush = flushOutbox(store, remote);
    await seen;

    expect(await recoverInterruptedSyncState(store)).toBe(0);
    const [inFlightMutation] = await store.listOutboxMutationsForLocalId(created.localId);
    expect(inFlightMutation.inFlight).toBe(true);
    expect((await store.getLocalExpense(created.localId))?.syncState).toBe("syncing");

    releaseCreate({ id: "server-1", version: 1 });
    await flush;
  });

  it("앱 시작 시 첫 flush **앞에서** 한 번 부른다 (source verification -- 컨트롤러는 vitest에서 실행할 수 없다)", () => {
    const controllerSource = readFileSync(join(process.cwd(), "src/offline/sync-controller.ts"), "utf8");
    expect(controllerSource).toContain("await recoverInterruptedSyncState(await getOfflineStore());");
    const startBody = controllerSource.slice(controllerSource.indexOf("async function recoverAndFlushOnStart"));
    // 되돌리기 → 스냅샷 → flush 순서. 순서가 뒤집히면 되돌린 행이 이번 pass에 실리지 않는다.
    expect(startBody.indexOf("recoverInterruptedSyncState")).toBeLessThan(startBody.indexOf("refreshSnapshot()"));
    expect(startBody.indexOf("refreshSnapshot()")).toBeLessThan(startBody.indexOf("flushInBackground(token, queryClient)"));
    const hookBody = controllerSource.slice(controllerSource.indexOf("export function useOfflineSyncLifecycle"));
    expect(hookBody).toContain("void recoverAndFlushOnStart(token, queryClient);");
    // 재연결·포그라운드 트리거는 종전 그대로 flush만 한다(되돌리기는 부팅 시 한 번이다).
    const watcherBody = hookBody.slice(hookBody.indexOf("startConnectivityWatcher"));
    expect(watcherBody).not.toContain("recoverAndFlushOnStart");
  });
});
