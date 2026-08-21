import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { BASE_DELAY_MS, computeBackoffDelayMs } from "./backoff";
import { runDeltaPull } from "./delta-sync";
import { RemotePermanentError, RemoteVersionConflictError } from "./errors";
import { reconcileMonthlyExpenses } from "./expense-list-reconciliation";
import { createMemoryOfflineStore } from "./memory-offline-store";
import {
  discardFailedMutation,
  flushOutbox,
  recordLocalCreate,
  recordLocalDelete,
  recordLocalUpdate,
  resolveConflictAdoptServer,
  resolveConflictReapplyMine,
  resolveConflictWithMergedPayload,
  retryFailedMutation,
  wipeOfflineStore,
  type RemoteExpenseApi
} from "./sync-engine";
import type { ConflictSnapshot, ExpensePayload, OfflineStore } from "./types";

/**
 * COV-T5 — 오프라인 삭제/충돌 복구 경로 커버 강화.
 *
 * Complements sync-engine.test.ts (which covers create-flush ordering, single-mutation
 * idempotency retry, the 409 transition on an UPDATE, and the three §3.4 resolution branches
 * for an update conflict). This suite targets the paths that had no coverage:
 *
 *   - the DELETE flush path end-to-end (transport args, 404, 409-with-live-row, 409-with-null
 *     current) and both resolution branches for a delete conflict;
 *   - conflict resolution round-trips through the transport (re-queued mutation actually sent
 *     with the server's version and a fresh idempotency key);
 *   - unresolvable conflicts (conflictCurrent unexpectedly null) falling back to 'failed';
 *   - delete queued while the row's create is still in-flight (H-3 interleaving x delete);
 *   - mid-batch network death: retry resumes without re-sending the already-confirmed
 *     mutation, reusing the failed mutation's idempotency key;
 *   - wipe (PRIV-104 teardown) clearing conflict rows, including one produced by a flush pass
 *     the wipe had to wait for;
 *   - delta-pull tombstone vs a PENDING local update — documented precedence.
 *
 * Deliberately NOT duplicated from existing suites: plain offline create+delete netting to a
 * no-op (sync-engine.test.ts "drops the local row entirely..."), the outbox merge rules
 * themselves (outbox-merge.test.ts), and cursor mechanics (delta-sync.test.ts).
 */

const payload: ExpensePayload = {
  childId: "child-1",
  categoryId: "cat-diaper",
  amountKrw: 10_000,
  spentOn: "2026-07-01",
  itemName: "기저귀"
};

type RecordedCall =
  | { op: "create"; payload: ExpensePayload; idempotencyKey: string }
  | { op: "update"; canonicalId: string; payload: ExpensePayload; expectedVersion: number; idempotencyKey: string }
  | { op: "delete"; canonicalId: string; expectedVersion: number; idempotencyKey: string };

/** Records every transport call (including full args) and optionally fails specific ops.
 * Failure hooks run AFTER the call is recorded, so tests can assert exactly what was sent
 * on a failing attempt too. */
function createRecordingRemote(behavior?: {
  /** Called with the 1-based create call index; return an error to throw for that call. */
  failCreate?: (createCallIndex: number) => Error | undefined;
  failUpdate?: (canonicalId: string) => Error | undefined;
  failDelete?: (canonicalId: string) => Error | undefined;
}) {
  const calls: RecordedCall[] = [];
  let nextId = 0;
  let createCallIndex = 0;
  const remote: RemoteExpenseApi = {
    async createExpense(createPayload, idempotencyKey) {
      calls.push({ op: "create", payload: createPayload, idempotencyKey });
      createCallIndex += 1;
      const error = behavior?.failCreate?.(createCallIndex);
      if (error) throw error;
      nextId += 1;
      return { id: `server-${nextId}`, version: 1 };
    },
    async updateExpense(canonicalId, updatePayload, expectedVersion, idempotencyKey) {
      calls.push({ op: "update", canonicalId, payload: updatePayload, expectedVersion, idempotencyKey });
      const error = behavior?.failUpdate?.(canonicalId);
      if (error) throw error;
      return { version: expectedVersion + 1 };
    },
    async deleteExpense(canonicalId, expectedVersion, idempotencyKey) {
      calls.push({ op: "delete", canonicalId, expectedVersion, idempotencyKey });
      const error = behavior?.failDelete?.(canonicalId);
      if (error) throw error;
    }
  };
  return { remote, calls };
}

/** Mirrors the API's real 404 exactly as remote-api.ts forwards it to the sync engine: the
 * delete path's NotFoundException({code: "EXPENSE_NOT_FOUND", ...}) (apps/api/src/finance/
 * expenses.service.ts) is serialized by GlobalExceptionFilter as `{error: {code, message, ...}}`,
 * and remote-api's rethrowAsSyncEngineError carries that parsed body on RemotePermanentError. */
function expenseNotFoundError() {
  return new RemotePermanentError(404, "요청을 처리하지 못했어요.", {
    error: { code: "EXPENSE_NOT_FOUND", message: "지출 기록을 찾을 수 없어요." }
  });
}

/** Creates one expense offline and flushes it so the row is server-known
 * (canonicalId='server-1', version=1, syncState='synced'). */
async function seedSyncedExpense(store: OfflineStore) {
  const created = await recordLocalCreate(store, payload);
  const { remote } = createRecordingRemote();
  await flushOutbox(store, remote);
  const row = (await store.getLocalExpense(created.localId))!;
  expect(row.syncState).toBe("synced");
  expect(row.canonicalId).toBe("server-1");
  expect(row.version).toBe(1);
  return row;
}

function liveServerSnapshot(canonicalId: string, version: number, overrides?: Partial<ExpensePayload>) {
  return {
    deleted: false as const,
    expense: { ...payload, ...overrides, id: canonicalId, version }
  };
}

describe("COV-T5 §1: offline DELETE of a server-known expense", () => {
  let store: OfflineStore;

  beforeEach(() => {
    store = createMemoryOfflineStore();
  });

  it("queues the delete (row kept as '삭제 대기 중'), then flush sends canonicalId + expectedVersion + the queued idempotency key and removes row + outbox on success", async () => {
    const synced = await seedSyncedExpense(store);

    await recordLocalDelete(store, synced.localId);

    const queued = (await store.getLocalExpense(synced.localId))!;
    expect(queued.pendingDelete).toBe(true);
    expect(queued.syncState).toBe("pending");
    const mutations = await store.listOutboxMutationsForLocalId(synced.localId);
    expect(mutations).toHaveLength(1);
    expect(mutations[0].operation).toBe("delete");
    expect(mutations[0].payload).toBeNull();
    expect(mutations[0].expectedVersion).toBe(1);
    const idempotencyKey = mutations[0].idempotencyKey;

    const { remote, calls } = createRecordingRemote();
    const summary = await flushOutbox(store, remote);

    expect(summary).toEqual({ synced: 1, failed: 0, conflicted: 0, stoppedForNetwork: false });
    expect(calls).toEqual([
      { op: "delete", canonicalId: synced.canonicalId!, expectedVersion: 1, idempotencyKey }
    ]);
    expect(await store.getLocalExpense(synced.localId)).toBeNull();
    expect(await store.listOutboxMutations()).toHaveLength(0);
  });

  it("an orphaned outbox mutation (its local row already removed by another path) is dropped by the next flush without any remote call", async () => {
    const created = await recordLocalCreate(store, payload);
    // The documented "removed by some other path" case (flushOutboxPass's orphan guard):
    // the local row disappears while its create mutation is still queued.
    await store.deleteLocalExpense(created.localId);
    expect(await store.listOutboxMutations()).toHaveLength(1);

    const { remote, calls } = createRecordingRemote();
    const summary = await flushOutbox(store, remote);

    expect(summary).toEqual({ synced: 0, failed: 0, conflicted: 0, stoppedForNetwork: false });
    expect(calls).toEqual([]);
    expect(await store.listOutboxMutations()).toHaveLength(0);
  });

  it("a 404 EXPENSE_NOT_FOUND on delete (already deleted server-side) converges as SUCCESS: local row removed, outbox cleared, nothing left to retry", async () => {
    // COV-T5 bug 1 fix: both sides agree the row is gone -- the delete's whole intent is
    // already satisfied, so this counts as success instead of parking the row in an
    // unwinnable 'failed' retry loop (re-sending the same idempotency key 404s forever).
    const synced = await seedSyncedExpense(store);
    await recordLocalDelete(store, synced.localId);

    const { remote, calls } = createRecordingRemote({
      failDelete: () => expenseNotFoundError()
    });
    const summary = await flushOutbox(store, remote);

    expect(summary).toEqual({ synced: 1, failed: 0, conflicted: 0, stoppedForNetwork: false });
    expect(await store.getLocalExpense(synced.localId)).toBeNull();
    expect(await store.listOutboxMutations()).toHaveLength(0);

    // Converged: the next pass has nothing to send -- no retry loop, no manual discard needed.
    await flushOutbox(store, remote);
    expect(calls).toHaveLength(1);
  });

  it("the delete-404 success mapping is NARROW: a 404 on an UPDATE still routes to 'failed' exactly as before (never swallowed)", async () => {
    const synced = await seedSyncedExpense(store);
    await recordLocalUpdate(store, synced.localId, { amountKrw: 30_000 });
    const [queuedMutation] = await store.listOutboxMutationsForLocalId(synced.localId);

    const { remote, calls } = createRecordingRemote({
      failUpdate: () => expenseNotFoundError()
    });
    const summary = await flushOutbox(store, remote);

    expect(summary).toEqual({ synced: 0, failed: 1, conflicted: 0, stoppedForNetwork: false });
    const row = (await store.getLocalExpense(synced.localId))!;
    expect(row.syncState).toBe("failed");
    // The local edit and its queued mutation are preserved for explicit retry/discard --
    // an update losing its target is NOT an outcome the update agrees with.
    expect(row.payload.amountKrw).toBe(30_000);
    const mutationsAfter = await store.listOutboxMutationsForLocalId(synced.localId);
    expect(mutationsAfter).toHaveLength(1);
    expect(mutationsAfter[0].attemptCount).toBe(1);
    expect(mutationsAfter[0].idempotencyKey).toBe(queuedMutation.idempotencyKey);

    // 'failed' rows are skipped by later passes.
    await flushOutbox(store, remote);
    expect(calls).toHaveLength(1);
  });

  it("the delete-404 success mapping is NARROW: a 404 WITHOUT the EXPENSE_NOT_FOUND body code (e.g. from a proxy) still routes to 'failed'; discard remains the exit", async () => {
    const synced = await seedSyncedExpense(store);
    await recordLocalDelete(store, synced.localId);

    const { remote } = createRecordingRemote({
      failDelete: () => new RemotePermanentError(404, "요청을 처리하지 못했어요.", "<html>Not Found</html>")
    });
    const summary = await flushOutbox(store, remote);

    expect(summary).toEqual({ synced: 0, failed: 1, conflicted: 0, stoppedForNetwork: false });
    const row = (await store.getLocalExpense(synced.localId))!;
    expect(row.syncState).toBe("failed");
    expect(row.pendingDelete).toBe(true);

    // User-triggered discard still converges local state for a row that stays 'failed'.
    await discardFailedMutation(store, synced.localId);
    expect(await store.getLocalExpense(synced.localId)).toBeNull();
    expect(await store.listOutboxMutations()).toHaveLength(0);
  });

  it("a 409 on delete surfaces a conflict carrying the server's live row; the delete mutation stays queued for explicit resolution", async () => {
    const synced = await seedSyncedExpense(store);
    await recordLocalDelete(store, synced.localId);
    const [queuedMutation] = await store.listOutboxMutationsForLocalId(synced.localId);

    // Another device edited the row (v7) while our delete (expecting v1) was queued.
    const serverCurrent = liveServerSnapshot(synced.canonicalId!, 7, { amountKrw: 55_000, itemName: "다른 기기가 바꾼 이름" });
    const { remote, calls } = createRecordingRemote({
      failDelete: () => new RemoteVersionConflictError(serverCurrent)
    });
    const summary = await flushOutbox(store, remote);

    expect(summary).toEqual({ synced: 0, failed: 0, conflicted: 1, stoppedForNetwork: false });
    const row = (await store.getLocalExpense(synced.localId))!;
    expect(row.syncState).toBe("conflict");
    expect(row.conflictCurrent).toEqual(serverCurrent);
    expect(row.pendingDelete).toBe(true);
    const mutationsAfter = await store.listOutboxMutationsForLocalId(synced.localId);
    expect(mutationsAfter).toHaveLength(1);
    expect(mutationsAfter[0].operation).toBe("delete");
    expect(mutationsAfter[0].idempotencyKey).toBe(queuedMutation.idempotencyKey);
    expect(mutationsAfter[0].inFlight).toBe(false);

    // 'conflict' rows are skipped by later passes until the user resolves.
    await flushOutbox(store, remote);
    expect(calls).toHaveLength(1);
  });

  it("delete-conflict + adopt-server abandons the delete: row returns to 'synced' with the server's value, pendingDelete cleared, outbox emptied", async () => {
    const synced = await seedSyncedExpense(store);
    await recordLocalDelete(store, synced.localId);
    const serverCurrent = liveServerSnapshot(synced.canonicalId!, 7, { amountKrw: 55_000, itemName: "다른 기기가 바꾼 이름" });
    await flushOutbox(store, createRecordingRemote({ failDelete: () => new RemoteVersionConflictError(serverCurrent) }).remote);

    await resolveConflictAdoptServer(store, synced.localId);

    const row = (await store.getLocalExpense(synced.localId))!;
    expect(row.syncState).toBe("synced");
    expect(row.pendingDelete).toBe(false);
    expect(row.conflictCurrent).toBeNull();
    expect(row.version).toBe(7);
    // COV-T5 bug 2 fix: the adopted payload contains exactly the ExpensePayload fields -- the
    // snapshot's server bookkeeping keys (id/version) must never leak into the payload object.
    expect(row.payload).toEqual({ ...payload, amountKrw: 55_000, itemName: "다른 기기가 바꾼 이름" });
    expect(Object.keys(row.payload)).not.toContain("id");
    expect(Object.keys(row.payload)).not.toContain("version");
    expect(await store.listOutboxMutationsForLocalId(synced.localId)).toHaveLength(0);
  });

  it("REGRESSION (bug 3): a delete the server contested stays visible in the records view and monthly total as a conflict row -- it must not vanish while the server row is live", async () => {
    const synced = await seedSyncedExpense(store);
    await recordLocalDelete(store, synced.localId);
    const serverCurrent = liveServerSnapshot(synced.canonicalId!, 7, { amountKrw: 55_000 });
    await flushOutbox(store, createRecordingRemote({ failDelete: () => new RemoteVersionConflictError(serverCurrent) }).remote);
    const row = (await store.getLocalExpense(synced.localId))!;
    expect(row.syncState).toBe("conflict");
    expect(row.pendingDelete).toBe(true);

    // The refetched server list still contains the live row the delete lost against (v7).
    const serverList = [{ id: synced.canonicalId!, amountKrw: 55_000, expenseType: "expense" }];
    const view = reconcileMonthlyExpenses(serverList, [row], "2026-07");

    // Exactly once, as the conflict row: the stale server row is hidden (as for every other
    // conflicted mutation) and the local conflict row carries the expense -- previously BOTH
    // were dropped and the contested expense disappeared from list and total entirely.
    expect(view.visibleServerExpenses).toHaveLength(0);
    expect(view.offlinePendingRows).toHaveLength(1);
    expect(view.offlinePendingRows[0].syncState).toBe("conflict");
    expect(view.offlinePendingRows[0].pendingDelete).toBe(true);
    // Counted the way every other conflict row is counted: by its local payload amount.
    expect(view.monthlyTotalKrw).toBe(10_000);
  });

  it("delete-conflict + reapply-mine re-queues the DELETE gated on the server's version, and the next flush sends it with a fresh idempotency key", async () => {
    const synced = await seedSyncedExpense(store);
    await recordLocalDelete(store, synced.localId);
    const [originalMutation] = await store.listOutboxMutationsForLocalId(synced.localId);
    const serverCurrent = liveServerSnapshot(synced.canonicalId!, 7);
    await flushOutbox(store, createRecordingRemote({ failDelete: () => new RemoteVersionConflictError(serverCurrent) }).remote);

    await resolveConflictReapplyMine(store, synced.localId);

    const row = (await store.getLocalExpense(synced.localId))!;
    expect(row.syncState).toBe("pending");
    expect(row.pendingDelete).toBe(true);
    expect(row.version).toBe(7);
    const mutations = await store.listOutboxMutationsForLocalId(synced.localId);
    expect(mutations).toHaveLength(1);
    expect(mutations[0].operation).toBe("delete");
    expect(mutations[0].payload).toBeNull();
    expect(mutations[0].expectedVersion).toBe(7);
    // Requeued as a NEW mutation: same target, but never reuses the conflicted attempt's key
    // (the old delete-at-v1 request and the new delete-at-v7 request are different operations).
    expect(mutations[0].idempotencyKey).not.toBe(originalMutation.idempotencyKey);

    const { remote, calls } = createRecordingRemote();
    const summary = await flushOutbox(store, remote);
    expect(summary.synced).toBe(1);
    expect(calls).toEqual([
      { op: "delete", canonicalId: synced.canonicalId!, expectedVersion: 7, idempotencyKey: mutations[0].idempotencyKey }
    ]);
    expect(await store.getLocalExpense(synced.localId)).toBeNull();
    expect(await store.listOutboxMutations()).toHaveLength(0);
  });

  it("재시도 on a failed delete re-arms it (backoff cleared, SAME idempotency key re-sent, attempt counter reset to 0); a 404 EXPENSE_NOT_FOUND on the retried send then converges as success", async () => {
    // Seed the 'failed' state with a non-404 permanent error (403 FORBIDDEN stays a genuine
    // failure) -- since the bug 1 fix, a delete-404 itself no longer produces 'failed'.
    const synced = await seedSyncedExpense(store);
    await recordLocalDelete(store, synced.localId);
    const { remote: forbiddenRemote, calls: firstCalls } = createRecordingRemote({
      failDelete: () =>
        new RemotePermanentError(403, "지출 기록 접근 권한이 없어요.", {
          error: { code: "FORBIDDEN", message: "지출 기록 접근 권한이 없어요." }
        })
    });
    await flushOutbox(store, forbiddenRemote);
    expect((await store.getLocalExpense(synced.localId))!.syncState).toBe("failed");
    expect(firstCalls).toHaveLength(1);
    const [failedMutation] = await store.listOutboxMutationsForLocalId(synced.localId);

    await retryFailedMutation(store, synced.localId);

    const row = (await store.getLocalExpense(synced.localId))!;
    expect(row.syncState).toBe("pending");
    expect(row.lastError).toBeNull();
    const [rearmed] = await store.listOutboxMutationsForLocalId(synced.localId);
    expect(rearmed.nextRetryAt).toBeNull();
    expect(rearmed.lastError).toBeNull();
    expect(rearmed.idempotencyKey).toBe(failedMutation.idempotencyKey);
    // FIX-MOB-DX (COV-T5 관찰 #4): an explicit user 재시도 is a fresh expression of intent --
    // the attempt counter resets to 0 so a subsequent failure backs off from the base delay
    // again instead of resuming the pre-retry exponential climb.
    expect(failedMutation.attemptCount).toBe(1);
    expect(rearmed.attemptCount).toBe(0);

    // The retried send finds the row already gone server-side (e.g. deleted from another
    // device in the meantime): same operation, same idempotency key over the wire -- and the
    // 404 converges the row instead of re-entering the old permanent 404 loop.
    const { remote: goneRemote, calls: retryCalls } = createRecordingRemote({
      failDelete: () => expenseNotFoundError()
    });
    const retrySummary = await flushOutbox(store, goneRemote);

    expect(retrySummary).toEqual({ synced: 1, failed: 0, conflicted: 0, stoppedForNetwork: false });
    expect(retryCalls).toEqual([
      {
        op: "delete",
        canonicalId: synced.canonicalId!,
        expectedVersion: 1,
        idempotencyKey: failedMutation.idempotencyKey
      }
    ]);
    expect(await store.getLocalExpense(synced.localId)).toBeNull();
    expect(await store.listOutboxMutations()).toHaveLength(0);
  });

  it("FIX-MOB-DX (COV-T5 관찰 #4): after 재시도 resets the attempt counter, a fresh network failure backs off from the BASE delay again -- not from the pre-retry exponential position", async () => {
    const synced = await seedSyncedExpense(store);
    await recordLocalDelete(store, synced.localId);

    // Climb the exponential ladder: two automatic network failures (attempt 1 -> 2s window,
    // attempt 2 -> 4s window)...
    const { remote: deadNetworkRemote } = createRecordingRemote({
      failDelete: () => new TypeError("Network request failed")
    });
    const firstPass = await flushOutbox(store, deadNetworkRemote);
    expect(firstPass.stoppedForNetwork).toBe(true);
    let [mutation] = await store.listOutboxMutationsForLocalId(synced.localId);
    expect(mutation.attemptCount).toBe(1);
    await store.updateOutboxMutation(mutation.mutationId, { nextRetryAt: null });
    await flushOutbox(store, deadNetworkRemote);
    [mutation] = await store.listOutboxMutationsForLocalId(synced.localId);
    expect(mutation.attemptCount).toBe(2);
    await store.updateOutboxMutation(mutation.mutationId, { nextRetryAt: null });

    // ...then a permanent 403 parks the row in 'failed' at attemptCount=3.
    const { remote: forbiddenRemote } = createRecordingRemote({
      failDelete: () =>
        new RemotePermanentError(403, "지출 기록 접근 권한이 없어요.", {
          error: { code: "FORBIDDEN", message: "지출 기록 접근 권한이 없어요." }
        })
    });
    await flushOutbox(store, forbiddenRemote);
    expect((await store.getLocalExpense(synced.localId))!.syncState).toBe("failed");
    [mutation] = await store.listOutboxMutationsForLocalId(synced.localId);
    expect(mutation.attemptCount).toBe(3);

    // The user's explicit 재시도 zeroes the counter along with the backoff window.
    await retryFailedMutation(store, synced.localId);
    [mutation] = await store.listOutboxMutationsForLocalId(synced.localId);
    expect(mutation.attemptCount).toBe(0);
    expect(mutation.nextRetryAt).toBeNull();

    // The retried send dies on the network: this is attempt 1 of a NEW climb, so the scheduled
    // next_retry_at sits exactly one BASE_DELAY_MS out -- were the old counter preserved, this
    // would be attempt 4 (2s * 2^3 = 16s) and the user's just-requested send would stall.
    const beforeMs = Date.now();
    const retryPass = await flushOutbox(store, deadNetworkRemote);
    const afterMs = Date.now();
    expect(retryPass.stoppedForNetwork).toBe(true);
    [mutation] = await store.listOutboxMutationsForLocalId(synced.localId);
    expect(mutation.attemptCount).toBe(1);
    expect(mutation.nextRetryAt).not.toBeNull();
    const nextRetryAtMs = new Date(mutation.nextRetryAt!).getTime();
    expect(computeBackoffDelayMs(1)).toBe(BASE_DELAY_MS);
    expect(nextRetryAtMs).toBeGreaterThanOrEqual(beforeMs + BASE_DELAY_MS);
    expect(nextRetryAtMs).toBeLessThanOrEqual(afterMs + BASE_DELAY_MS);
    // Comfortably below where the pre-retry ladder would have put it.
    expect(nextRetryAtMs - afterMs).toBeLessThan(computeBackoffDelayMs(4));
  });

  it("a 409 on delete whose server snapshot is null (nothing to adopt or reapply against) routes to 'failed' instead of an unresolvable 'conflict'", async () => {
    const synced = await seedSyncedExpense(store);
    await recordLocalDelete(store, synced.localId);

    const { remote } = createRecordingRemote({ failDelete: () => new RemoteVersionConflictError(null) });
    const summary = await flushOutbox(store, remote);

    expect(summary).toEqual({ synced: 0, failed: 1, conflicted: 0, stoppedForNetwork: false });
    const row = (await store.getLocalExpense(synced.localId))!;
    expect(row.syncState).toBe("failed");
    expect(row.conflictCurrent).toBeNull();
    const [mutation] = await store.listOutboxMutationsForLocalId(synced.localId);
    expect(mutation.attemptCount).toBe(1);
    expect(mutation.inFlight).toBe(false);
  });
});

describe("COV-T5 §2: update-conflict resolution round-trips and edge branches", () => {
  let store: OfflineStore;

  beforeEach(() => {
    store = createMemoryOfflineStore();
  });

  /** Server-known row with a locally-updated payload flushed into a 409 conflict against a
   * live server row at `serverVersion`. */
  async function seedUpdateConflict(serverVersion = 5) {
    const synced = await seedSyncedExpense(store);
    await recordLocalUpdate(store, synced.localId, { amountKrw: 30_000, itemName: "내가 바꾼 이름" });
    const [conflictedMutation] = await store.listOutboxMutationsForLocalId(synced.localId);
    const serverCurrent = liveServerSnapshot(synced.canonicalId!, serverVersion, { itemName: "다른 기기가 바꾼 이름" });
    const { remote } = createRecordingRemote({ failUpdate: () => new RemoteVersionConflictError(serverCurrent) });
    await flushOutbox(store, remote);
    const row = (await store.getLocalExpense(synced.localId))!;
    expect(row.syncState).toBe("conflict");
    return { localId: synced.localId, canonicalId: synced.canonicalId!, serverCurrent, conflictedMutation };
  }

  it("reapply-mine then flush: the update is actually SENT with the server's version as expectedVersion and a fresh idempotency key, ending 'synced'", async () => {
    const { localId, canonicalId, conflictedMutation } = await seedUpdateConflict(5);

    await resolveConflictReapplyMine(store, localId);
    const [requeued] = await store.listOutboxMutationsForLocalId(localId);
    expect(requeued.idempotencyKey).not.toBe(conflictedMutation.idempotencyKey);

    const { remote, calls } = createRecordingRemote();
    const summary = await flushOutbox(store, remote);

    expect(summary).toEqual({ synced: 1, failed: 0, conflicted: 0, stoppedForNetwork: false });
    expect(calls).toHaveLength(1);
    const call = calls[0];
    expect(call.op).toBe("update");
    if (call.op !== "update") throw new Error("unreachable");
    expect(call.canonicalId).toBe(canonicalId);
    expect(call.expectedVersion).toBe(5);
    expect(call.idempotencyKey).toBe(requeued.idempotencyKey);
    expect(call.payload.amountKrw).toBe(30_000);
    expect(call.payload.itemName).toBe("내가 바꾼 이름");

    const row = (await store.getLocalExpense(localId))!;
    expect(row.syncState).toBe("synced");
    expect(row.version).toBe(6);
    expect(await store.listOutboxMutations()).toHaveLength(0);
  });

  it("field-level merge then flush: the chosen merged payload is sent verbatim, gated on the server's version", async () => {
    const { localId, canonicalId } = await seedUpdateConflict(5);
    const mergedPayload: ExpensePayload = { ...payload, amountKrw: 30_000, itemName: "다른 기기가 바꾼 이름" };

    await resolveConflictWithMergedPayload(store, localId, mergedPayload);
    const { remote, calls } = createRecordingRemote();
    const summary = await flushOutbox(store, remote);

    expect(summary.synced).toBe(1);
    expect(calls).toHaveLength(1);
    const call = calls[0];
    if (call.op !== "update") throw new Error(`expected update, got ${call.op}`);
    expect(call.canonicalId).toBe(canonicalId);
    expect(call.expectedVersion).toBe(5);
    expect(call.payload).toEqual(mergedPayload);

    const row = (await store.getLocalExpense(localId))!;
    expect(row.syncState).toBe("synced");
    expect(row.version).toBe(6);
    expect(row.payload).toEqual(mergedPayload);
  });

  it("adopt-server on a deleted-tombstone conflict removes the local row entirely and clears its outbox", async () => {
    const synced = await seedSyncedExpense(store);
    await recordLocalUpdate(store, synced.localId, { amountKrw: 30_000 });
    const tombstone: ConflictSnapshot = { deleted: true, id: synced.canonicalId!, version: 9 };
    await flushOutbox(store, createRecordingRemote({ failUpdate: () => new RemoteVersionConflictError(tombstone) }).remote);
    expect((await store.getLocalExpense(synced.localId))!.syncState).toBe("conflict");

    await resolveConflictAdoptServer(store, synced.localId);

    expect(await store.getLocalExpense(synced.localId)).toBeNull();
    expect(await store.listOutboxMutations()).toHaveLength(0);
  });

  it("field-level merge is refused for a deleted-tombstone conflict ('병합할 수 없는 상태예요.'), leaving the conflict state untouched", async () => {
    const synced = await seedSyncedExpense(store);
    await recordLocalUpdate(store, synced.localId, { amountKrw: 30_000 });
    const tombstone: ConflictSnapshot = { deleted: true, id: synced.canonicalId!, version: 9 };
    await flushOutbox(store, createRecordingRemote({ failUpdate: () => new RemoteVersionConflictError(tombstone) }).remote);

    await expect(
      resolveConflictWithMergedPayload(store, synced.localId, { ...payload, amountKrw: 30_000 })
    ).rejects.toThrow("병합할 수 없는 상태예요.");

    // The refusal happens BEFORE any state is touched: still resolvable via the other choices.
    const row = (await store.getLocalExpense(synced.localId))!;
    expect(row.syncState).toBe("conflict");
    expect(row.conflictCurrent).toEqual(tombstone);
    expect(await store.listOutboxMutationsForLocalId(synced.localId)).toHaveLength(1);
  });

  it("a 'conflict' row whose conflictCurrent is unexpectedly null falls back to 'failed' under every resolution choice (and the outbox is kept for retry)", async () => {
    // Manufactures the defense-in-depth state the resolvers guard against (pre-H-1 client
    // could produce a conflict row without a snapshot).
    async function seedNullCurrentConflict() {
      const created = await recordLocalCreate(store, payload);
      await flushOutbox(store, createRecordingRemote().remote);
      const localId = created.localId;
      await recordLocalUpdate(store, localId, { amountKrw: 30_000 });
      await store.updateLocalExpense(localId, { syncState: "conflict", conflictCurrent: null });
      return localId;
    }

    const adoptTarget = await seedNullCurrentConflict();
    await resolveConflictAdoptServer(store, adoptTarget);
    let row = (await store.getLocalExpense(adoptTarget))!;
    expect(row.syncState).toBe("failed");
    expect(row.lastError).toContain("충돌 정보를 확인할 수 없어요");
    // Falls back BEFORE clearing the outbox -- the queued mutation survives for retry/discard.
    expect(await store.listOutboxMutationsForLocalId(adoptTarget)).toHaveLength(1);

    const reapplyTarget = await seedNullCurrentConflict();
    await resolveConflictReapplyMine(store, reapplyTarget);
    row = (await store.getLocalExpense(reapplyTarget))!;
    expect(row.syncState).toBe("failed");

    const mergeTarget = await seedNullCurrentConflict();
    await resolveConflictWithMergedPayload(store, mergeTarget, { ...payload, amountKrw: 30_000 });
    row = (await store.getLocalExpense(mergeTarget))!;
    expect(row.syncState).toBe("failed");

    // A resolver aimed at a row that no longer exists is a silent no-op, never a throw.
    await expect(resolveConflictAdoptServer(store, "no-such-local-id")).resolves.toBeUndefined();
    await expect(resolveConflictReapplyMine(store, "no-such-local-id")).resolves.toBeUndefined();
    await expect(
      resolveConflictWithMergedPayload(store, "no-such-local-id", payload)
    ).resolves.toBeUndefined();
  });
});

describe("COV-T5 §3: delete queued while the row's create is still in-flight (H-3 x delete)", () => {
  it("DOCUMENTED: the no-op netting only applies BEFORE the create is sent — a delete during the in-flight create is appended and later sent with the create's returned id/version", async () => {
    const store = createMemoryOfflineStore();
    const created = await recordLocalCreate(store, payload);

    let resolveCreate!: (result: { id: string; version: number }) => void;
    const createResultPromise = new Promise<{ id: string; version: number }>((resolve) => {
      resolveCreate = resolve;
    });
    const deleteCalls: Array<{ canonicalId: string; expectedVersion: number; idempotencyKey: string }> = [];
    let createCallCount = 0;
    const remote: RemoteExpenseApi = {
      async createExpense() {
        createCallCount += 1;
        return createResultPromise;
      },
      async updateExpense() {
        throw new Error("not used in this test");
      },
      async deleteExpense(canonicalId, expectedVersion, idempotencyKey) {
        deleteCalls.push({ canonicalId, expectedVersion, idempotencyKey });
      }
    };

    const firstFlush = flushOutbox(store, remote);
    await new Promise((resolve) => setTimeout(resolve, 0));

    // The delete lands while the create request is on the wire.
    await recordLocalDelete(store, created.localId);

    // NOT netted to a no-op (the server is about to know this row): the in-flight create is
    // left untouched and the delete is appended behind it.
    const mutationsWhileInFlight = await store.listOutboxMutationsForLocalId(created.localId);
    expect(mutationsWhileInFlight.map((mutation) => mutation.operation)).toEqual(["create", "delete"]);
    const rowWhileInFlight = (await store.getLocalExpense(created.localId))!;
    expect(rowWhileInFlight.pendingDelete).toBe(true);

    resolveCreate({ id: "server-1", version: 1 });
    const firstSummary = await firstFlush;
    expect(firstSummary.synced).toBe(1);
    expect(createCallCount).toBe(1);

    // Create confirmed; the row now waits as a pending delete against the fresh canonicalId.
    const rowAfterCreate = (await store.getLocalExpense(created.localId))!;
    expect(rowAfterCreate.canonicalId).toBe("server-1");
    expect(rowAfterCreate.syncState).toBe("pending");
    expect(rowAfterCreate.pendingDelete).toBe(true);

    // The next pass deletes remotely using the version the create just returned (the delete
    // mutation itself was queued with expectedVersion=null -- the row had no version yet).
    const secondSummary = await flushOutbox(store, remote);
    expect(secondSummary.synced).toBe(1);
    expect(deleteCalls).toHaveLength(1);
    expect(deleteCalls[0].canonicalId).toBe("server-1");
    expect(deleteCalls[0].expectedVersion).toBe(1);
    expect(await store.getLocalExpense(created.localId)).toBeNull();
    expect(await store.listOutboxMutations()).toHaveLength(0);
  });
});

describe("COV-T5 §4: mid-batch network death and idempotent resume", () => {
  it("an edit appended behind an in-flight create whose request dies on the network: the next pass skips both (backoff + no canonicalId), then a cleared retry sends create-then-update in order with the create's original key", async () => {
    const store = createMemoryOfflineStore();
    const created = await recordLocalCreate(store, payload);
    const [createMutation] = await store.listOutboxMutationsForLocalId(created.localId);

    let rejectCreate!: (error: Error) => void;
    const createResult = new Promise<{ id: string; version: number }>((_, reject) => {
      rejectCreate = reject;
    });
    let createAttempts = 0;
    const dyingRemote: RemoteExpenseApi = {
      async createExpense() {
        createAttempts += 1;
        return createResult;
      },
      async updateExpense() {
        throw new Error("must not be called before the create has a canonicalId");
      },
      async deleteExpense() {
        throw new Error("not used in this test");
      }
    };

    const firstFlush = flushOutbox(store, dyingRemote);
    await new Promise((resolve) => setTimeout(resolve, 0));
    // The edit lands while the create request is on the wire (H-3: appended, not folded)...
    await recordLocalUpdate(store, created.localId, { amountKrw: 25_000 });
    // ...and then the create request dies on the network.
    rejectCreate(new TypeError("Network request failed"));
    const firstSummary = await firstFlush;
    expect(firstSummary).toEqual({ synced: 0, failed: 0, conflicted: 0, stoppedForNetwork: true });

    const queued = await store.listOutboxMutationsForLocalId(created.localId);
    expect(queued.map((mutation) => mutation.operation)).toEqual(["create", "update"]);
    expect(queued[0].attemptCount).toBe(1);
    expect(queued[0].nextRetryAt).not.toBeNull();

    // An immediate reflush sends NOTHING: the create sits in its backoff window, and the
    // appended update cannot go out before its target has a canonicalId.
    const secondSummary = await flushOutbox(store, dyingRemote);
    expect(secondSummary).toEqual({ synced: 0, failed: 0, conflicted: 0, stoppedForNetwork: false });
    expect(createAttempts).toBe(1);

    // Connectivity returns: the retry sends the create FIRST (reusing its original
    // idempotency key) and the update right behind it, against the fresh id/version.
    await store.updateOutboxMutation(queued[0].mutationId, { nextRetryAt: null });
    const { remote, calls } = createRecordingRemote();
    const thirdSummary = await flushOutbox(store, remote);
    expect(thirdSummary).toEqual({ synced: 2, failed: 0, conflicted: 0, stoppedForNetwork: false });
    expect(calls.map((call) => call.op)).toEqual(["create", "update"]);
    expect(calls[0].idempotencyKey).toBe(createMutation.idempotencyKey);
    const updateCall = calls[1];
    if (updateCall.op !== "update") throw new Error("unreachable");
    expect(updateCall.canonicalId).toBe("server-1");
    expect(updateCall.expectedVersion).toBe(1);
    expect(updateCall.payload.amountKrw).toBe(25_000);

    const finalRow = (await store.getLocalExpense(created.localId))!;
    expect(finalRow.syncState).toBe("synced");
    expect(finalRow.version).toBe(2);
    expect(finalRow.payload.amountKrw).toBe(25_000);
    expect(await store.listOutboxMutations()).toHaveLength(0);
  });

  it("network dies after the first of 3 creates: the pass stops, and the retry resumes from the failed mutation with ITS OWN reused key — the confirmed first create is never re-sent", async () => {
    const store = createMemoryOfflineStore();
    const first = await recordLocalCreate(store, { ...payload, itemName: "첫번째" }, "2026-07-12T00:00:00.000Z");
    const second = await recordLocalCreate(store, { ...payload, itemName: "두번째" }, "2026-07-12T00:00:01.000Z");
    const third = await recordLocalCreate(store, { ...payload, itemName: "세번째" }, "2026-07-12T00:00:02.000Z");
    const keyOf = async (localId: string) => (await store.listOutboxMutationsForLocalId(localId))[0].idempotencyKey;
    const firstKey = await keyOf(first.localId);
    const secondKey = await keyOf(second.localId);
    const thirdKey = await keyOf(third.localId);

    // The 2nd create call (the batch's second mutation) dies on the network.
    const { remote, calls } = createRecordingRemote({
      failCreate: (index) => (index === 2 ? new TypeError("Network request failed") : undefined)
    });

    const firstPass = await flushOutbox(store, remote);
    expect(firstPass).toEqual({ synced: 1, failed: 0, conflicted: 0, stoppedForNetwork: true });
    // Two calls total: first confirmed, second died; the third was never attempted.
    expect(calls.map((call) => call.idempotencyKey)).toEqual([firstKey, secondKey]);

    const firstRow = (await store.getLocalExpense(first.localId))!;
    expect(firstRow.syncState).toBe("synced");
    expect(firstRow.canonicalId).toBe("server-1");
    expect(await store.listOutboxMutationsForLocalId(first.localId)).toHaveLength(0);

    const [secondMutation] = await store.listOutboxMutationsForLocalId(second.localId);
    expect(secondMutation.idempotencyKey).toBe(secondKey);
    expect(secondMutation.attemptCount).toBe(1);
    expect(secondMutation.nextRetryAt).not.toBeNull();
    expect((await store.getLocalExpense(second.localId))!.syncState).toBe("pending");

    const [thirdMutation] = await store.listOutboxMutationsForLocalId(third.localId);
    expect(thirdMutation.attemptCount).toBe(0);
    expect(thirdMutation.nextRetryAt).toBeNull();

    // Connectivity returns (clear the backoff window so the pass retries immediately).
    await store.updateOutboxMutation(secondMutation.mutationId, { nextRetryAt: null });
    const secondPass = await flushOutbox(store, remote);
    expect(secondPass).toEqual({ synced: 2, failed: 0, conflicted: 0, stoppedForNetwork: false });

    // Resume sent exactly [second (same key as the failed attempt), third] -- the first
    // mutation's key went over the wire exactly once across both passes.
    expect(calls.map((call) => call.idempotencyKey)).toEqual([firstKey, secondKey, secondKey, thirdKey]);
    expect(calls.filter((call) => call.idempotencyKey === firstKey)).toHaveLength(1);

    const canonicalIds = new Set<string>();
    for (const local of [first, second, third]) {
      const row = (await store.getLocalExpense(local.localId))!;
      expect(row.syncState).toBe("synced");
      canonicalIds.add(row.canonicalId!);
    }
    expect(canonicalIds.size).toBe(3);
    // The confirmed first row kept its original server id -- not re-created on resume.
    expect((await store.getLocalExpense(first.localId))!.canonicalId).toBe("server-1");
    expect(await store.listOutboxMutations()).toHaveLength(0);
  });
});

describe("COV-T5 §5: wipe (PRIV-104 teardown) clears conflict rows too", () => {
  it("a wipe removes 'conflict' rows and their still-queued mutations along with everything else; the next flush finds nothing to send", async () => {
    const store = createMemoryOfflineStore();
    // One conflict row (update-409 with a live server snapshot) plus one plain pending create.
    const synced = await seedSyncedExpense(store);
    await recordLocalUpdate(store, synced.localId, { amountKrw: 30_000 });
    const serverCurrent = liveServerSnapshot(synced.canonicalId!, 5);
    await flushOutbox(store, createRecordingRemote({ failUpdate: () => new RemoteVersionConflictError(serverCurrent) }).remote);
    await recordLocalCreate(store, { ...payload, itemName: "아직 안 보낸 기록" });

    expect((await store.listLocalExpenses()).some((row) => row.syncState === "conflict")).toBe(true);
    expect(await store.listOutboxMutations()).toHaveLength(2);

    await wipeOfflineStore(store);

    expect(await store.listLocalExpenses()).toEqual([]);
    expect(await store.listOutboxMutations()).toEqual([]);

    const { remote, calls } = createRecordingRemote();
    const summary = await flushOutbox(store, remote);
    expect(calls).toEqual([]);
    expect(summary).toEqual({ synced: 0, failed: 0, conflicted: 0, stoppedForNetwork: false });
  });

  it("a wipe requested while the flush that PRODUCES the conflict is still in-flight waits for the pass, then clears the freshly-written conflict bookkeeping", async () => {
    const store = createMemoryOfflineStore();
    const synced = await seedSyncedExpense(store);
    await recordLocalUpdate(store, synced.localId, { amountKrw: 30_000 });

    let releaseUpdate!: () => void;
    const updateGate = new Promise<void>((resolve) => {
      releaseUpdate = resolve;
    });
    const serverCurrent = liveServerSnapshot(synced.canonicalId!, 5);
    const remote: RemoteExpenseApi = {
      async createExpense() {
        throw new Error("not used in this test");
      },
      async updateExpense() {
        await updateGate;
        throw new RemoteVersionConflictError(serverCurrent);
      },
      async deleteExpense() {
        throw new Error("not used in this test");
      }
    };

    const order: string[] = [];
    const flushPromise = flushOutbox(store, remote).then((summary) => {
      order.push("flush-settled");
      return summary;
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
    const wipePromise = wipeOfflineStore(store).then(() => order.push("wipe-settled"));

    // While the update request is on the wire, the wipe must not have touched the store.
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(order).toEqual([]);
    expect(await store.listLocalExpenses()).toHaveLength(1);

    releaseUpdate();
    const summary = await flushPromise;
    await wipePromise;

    // The pass finished first (it recorded the conflict), then the wipe erased it -- no
    // conflict row or queued mutation survives into the next session.
    expect(order).toEqual(["flush-settled", "wipe-settled"]);
    expect(summary.conflicted).toBe(1);
    expect(await store.listLocalExpenses()).toEqual([]);
    expect(await store.listOutboxMutations()).toEqual([]);
  });
});

describe("COV-T5 §6: delta-pull tombstone vs a PENDING local update — documented precedence", () => {
  type SyncChange = { id: string; deleted: boolean; version: number };

  it("DOCUMENTED: a pulled tombstone never touches the offline store — the pending local update stays queued and visible; the pull only informs the server-list side", async () => {
    // Precedence, as built today: runDeltaPull applies pages only through the caller-supplied
    // applyPage, and sync-controller.ts passes NO applyPage (verified below) -- it merely
    // invalidates the react-query 'expenses' cache. So a tombstone arriving via /sync/changes
    // cannot delete or downgrade a local row with a PENDING mutation; the pending edit wins in
    // the UI (the refetched server list simply no longer contains the row), and the actual
    // delete-vs-update decision is deferred to flush time, where the server answers 409 with a
    // deleted-tombstone snapshot (see the companion test below).
    const controllerSource = readFileSync(join(process.cwd(), "src/offline/sync-controller.ts"), "utf8");
    const pullBody = controllerSource.slice(controllerSource.indexOf("async function pullDeltaInBackground"));
    const runDeltaPullCall = pullBody.slice(pullBody.indexOf("runDeltaPull("), pullBody.indexOf("if (summary"));
    expect(runDeltaPullCall).toContain("{ scopeKey }");
    expect(runDeltaPullCall).not.toContain("applyPage");

    const store = createMemoryOfflineStore();
    const synced = await seedSyncedExpense(store);
    await recordLocalUpdate(store, synced.localId, { amountKrw: 30_000 });

    const applied: SyncChange[][] = [];
    const summary = await runDeltaPull<SyncChange>(
      store,
      {
        async fetchChanges() {
          return {
            changes: [{ id: synced.canonicalId!, deleted: true, version: 2 }],
            nextCursor: "c1",
            hasMore: false
          };
        }
      },
      // Mirrors the controller: the page is observed (cache invalidation) but nothing writes
      // into the offline store.
      { scopeKey: "user-1", applyPage: (changes) => void applied.push(changes) }
    );
    expect(summary.changeCount).toBe(1);
    expect(applied).toEqual([[{ id: synced.canonicalId!, deleted: true, version: 2 }]]);

    // The pending local update survived the tombstone untouched.
    const row = (await store.getLocalExpense(synced.localId))!;
    expect(row.syncState).toBe("pending");
    expect(row.payload.amountKrw).toBe(30_000);
    expect(row.pendingDelete).toBe(false);
    const mutations = await store.listOutboxMutationsForLocalId(synced.localId);
    expect(mutations).toHaveLength(1);
    expect(mutations[0].operation).toBe("update");

    // Records view after the invalidated refetch: the server list no longer contains the
    // deleted row, but the pending local row still renders (and carries the month's total).
    const view = reconcileMonthlyExpenses([], [row], "2026-07");
    expect(view.offlinePendingRows).toHaveLength(1);
    expect(view.offlinePendingRows[0].localId).toBe(synced.localId);
    expect(view.monthlyTotalKrw).toBe(30_000);
  });

  it("the deferred adjudication: flushing the pending update against the now-deleted row yields a tombstone conflict, and reapply-mine recovers it as a brand-new create", async () => {
    const store = createMemoryOfflineStore();
    const { remote: healthyRemote, calls } = createRecordingRemote();
    const created = await recordLocalCreate(store, payload);
    await flushOutbox(store, healthyRemote); // -> server-1, v1
    const synced = (await store.getLocalExpense(created.localId))!;
    await recordLocalUpdate(store, synced.localId, { amountKrw: 30_000, itemName: "내가 바꾼 이름" });

    const tombstone: ConflictSnapshot = { deleted: true, id: synced.canonicalId!, version: 2 };
    const { remote: deletedRemote } = createRecordingRemote({
      failUpdate: () => new RemoteVersionConflictError(tombstone)
    });
    const conflictSummary = await flushOutbox(store, deletedRemote);
    expect(conflictSummary.conflicted).toBe(1);
    expect((await store.getLocalExpense(synced.localId))!.conflictCurrent).toEqual(tombstone);

    await resolveConflictReapplyMine(store, synced.localId);
    const finalSummary = await flushOutbox(store, healthyRemote);
    expect(finalSummary.synced).toBe(1);

    // The recreate went over the wire as a CREATE carrying the pending edit's fields...
    const createCalls = calls.filter((call) => call.op === "create");
    expect(createCalls).toHaveLength(2); // seed + recreate
    if (createCalls[1].op !== "create") throw new Error("unreachable");
    expect(createCalls[1].payload.amountKrw).toBe(30_000);
    expect(createCalls[1].payload.itemName).toBe("내가 바꾼 이름");
    expect(createCalls[1].idempotencyKey).not.toBe(createCalls[0].idempotencyKey);

    // ...and the row now lives under a NEW server identity, fully synced.
    const finalRow = (await store.getLocalExpense(synced.localId))!;
    expect(finalRow.canonicalId).toBe("server-2");
    expect(finalRow.canonicalId).not.toBe(synced.canonicalId);
    expect(finalRow.version).toBe(1);
    expect(finalRow.syncState).toBe("synced");
    expect(await store.listOutboxMutations()).toHaveLength(0);
  });
});
