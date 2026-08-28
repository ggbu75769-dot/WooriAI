import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BASE_DELAY_MS, MAX_DELAY_MS, computeBackoffDelayMs } from "./backoff";
import { runDeltaPull, saveSyncCursor, loadSyncCursor, SYNC_CURSOR_META_KEY, type DeltaPullPage, type DeltaPullTransport } from "./delta-sync";
import { RemotePermanentError, RemoteVersionConflictError } from "./errors";
import { createMemoryOfflineStore } from "./memory-offline-store";
import { teardownOfflineSessionState } from "./session-teardown";
import {
  diffExpenseFields,
  flushOutbox,
  recordLocalCreate,
  recordLocalDelete,
  recordLocalUpdate,
  resolveConflictAdoptServer,
  resolveConflictReapplyMine,
  retryFailedMutation,
  type RemoteExpenseApi
} from "./sync-engine";
import type { ExpensePayload, OfflineStore } from "./types";

/**
 * TEST-114 — 오프라인 동기화 엔진 엣지 케이스 확장.
 *
 * Complements the existing suites, covering ONLY scenarios none of them exercise:
 *
 *   §1 outbox 대량(100+): creation-order preservation at scale, and a mid-batch network death
 *      whose retry resumes from exactly the failed mutation (already-confirmed sends never
 *      repeated; the failed mutation's idempotency key reused);
 *   §2 동일 지출 연속 수정 3회: the online version chain (expectedVersion 1→2→3, ending at
 *      version 4) and the offline collapse of three edits into one mutation gated on the
 *      earliest server-known version;
 *   §3 삭제 → 같은 품목명 재생성: two independent local rows / mutations that must never
 *      cross-merge by item name, flushed in queue order (delete before create); plus recreation
 *      while the old row's delete sits in 'failed';
 *   §4 커서 손상·과거 커서: corruption recovery *through runDeltaPull* (not just loadSyncCursor),
 *      a mid-pull SYNC_CURSOR_INVALID reset re-applying earlier pages idempotently, and an
 *      ancient-but-decodable cursor being a plain backlog catch-up (never a reset);
 *   §5 시계 역행: a small backward device-clock jump (within MAX_DELAY_MS) keeps a backed-off
 *      mutation parked on its absolute instant (documented), the explicit user retry as the
 *      manual escape, and the OFF-115 clock-anomaly self-heal for large jumps (formerly a
 *      skipped BUG repro -- see the note there);
 *   §6 409 폭주 / backoff 상한: repeated version conflicts never grow backoff bookkeeping or
 *      auto-retry (bounded at one request per explicit user action), and the network backoff
 *      delay produced by the ENGINE path is capped at MAX_DELAY_MS;
 *   §7 스냅숏 refresh(델타 풀) 도중 teardown: the documented residual meta write after a wipe,
 *      and the scope-key fallback that keeps the next account from resuming the old stream;
 *   §8 페이로드 필드 피커: unknown server-side fields on a conflict snapshot never leak into
 *      the local payload (adopt-server) nor into the diff view.
 *
 * Deliberately NOT duplicated: single-mutation idempotency retry + basic ordering
 * (sync-engine.test.ts), delete/404/tombstone recovery (delete-conflict-recovery.test.ts),
 * outbox merge rules in isolation (outbox-merge.test.ts), cursor scope-key mechanics in
 * isolation (delta-sync.test.ts), and wipe-vs-flush sequencing (session-teardown.test.ts).
 * Mocking follows the same conventions: memory store + in-file fake remotes/transports.
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

/** Same shape as delete-conflict-recovery.test.ts's createRecordingRemote: records every call
 * with full args, and failure hooks run AFTER recording so failing attempts are asserted too. */
function createRecordingRemote(behavior?: {
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

/** Creates one expense offline and flushes it so the row is server-known (version 1). */
async function seedSyncedExpense(store: OfflineStore, overrides?: Partial<ExpensePayload>) {
  const created = await recordLocalCreate(store, { ...payload, ...overrides });
  const { remote } = createRecordingRemote();
  await flushOutbox(store, remote);
  const row = (await store.getLocalExpense(created.localId))!;
  expect(row.syncState).toBe("synced");
  expect(row.version).toBe(1);
  return row;
}

function networkError() {
  return new TypeError("Network request failed");
}

// ---------------------------------------------------------------------------
// §1 outbox 대량(100+) 순서 보존 + 부분 실패 재개
// ---------------------------------------------------------------------------

describe("TEST-114 §1: 100+ queued mutations — order preservation and partial-failure resume", () => {
  it("flushes 120 creates in exact creation order; a network death at #58 stops the pass, and the resumed pass re-sends ONLY #58 (same key) then the remaining 62 in order", async () => {
    const store = createMemoryOfflineStore();
    const TOTAL = 120;
    const FAIL_AT = 58; // 1-based create-call index that dies on the network

    for (let index = 0; index < TOTAL; index += 1) {
      await recordLocalCreate(
        store,
        { ...payload, itemName: `지출 ${index}` },
        `2026-07-12T00:${String(Math.floor(index / 60)).padStart(2, "0")}:${String(index % 60).padStart(2, "0")}.000Z`
      );
    }
    const queuedBefore = await store.listOutboxMutations();
    expect(queuedBefore).toHaveLength(TOTAL);

    // One remote across both passes so the recorded call list and key bookkeeping are unified.
    // Only the 58th create CALL fails (call index keeps counting across passes, so the retry --
    // call #59 -- succeeds).
    const { remote, calls } = createRecordingRemote({
      failCreate: (index) => (index === FAIL_AT ? networkError() : undefined)
    });

    const firstPass = await flushOutbox(store, remote);
    expect(firstPass.synced).toBe(FAIL_AT - 1);
    expect(firstPass.stoppedForNetwork).toBe(true);
    expect(calls).toHaveLength(FAIL_AT);
    // Creation order held exactly for everything sent, including the failing send itself.
    expect(calls.map((call) => (call as { payload: ExpensePayload }).payload.itemName)).toEqual(
      Array.from({ length: FAIL_AT }, (_, index) => `지출 ${index}`)
    );

    // The failed mutation carries the backoff bookkeeping; everything queued BEHIND it was
    // never touched (the pass broke out instead of burning through the queue).
    const outboxAfterFailure = await store.listOutboxMutations();
    expect(outboxAfterFailure).toHaveLength(TOTAL - (FAIL_AT - 1));
    const failedMutation = outboxAfterFailure[0];
    expect(failedMutation.attemptCount).toBe(1);
    expect(failedMutation.nextRetryAt).not.toBeNull();
    for (const untouched of outboxAfterFailure.slice(1)) {
      expect(untouched.attemptCount).toBe(0);
      expect(untouched.nextRetryAt).toBeNull();
    }
    const failedKey = failedMutation.idempotencyKey;
    expect(failedKey).toBe(calls[FAIL_AT - 1].idempotencyKey);

    // Clear the backoff window (same convention as sync-engine.test.ts) and resume.
    await store.updateOutboxMutation(failedMutation.mutationId, { nextRetryAt: null });
    const secondPass = await flushOutbox(store, remote);
    expect(secondPass).toEqual({
      synced: TOTAL - (FAIL_AT - 1),
      failed: 0,
      conflicted: 0,
      itemStatusSynced: 0,
      itemStatusFailed: 0,
      stoppedForNetwork: false
    });

    // The resumed pass starts at exactly the failed mutation, with ITS OWN key reused, then
    // continues in the original creation order.
    const secondPassCalls = calls.slice(FAIL_AT);
    expect(secondPassCalls[0].idempotencyKey).toBe(failedKey);
    expect(secondPassCalls.map((call) => (call as { payload: ExpensePayload }).payload.itemName)).toEqual(
      Array.from({ length: TOTAL - (FAIL_AT - 1) }, (_, index) => `지출 ${FAIL_AT - 1 + index}`)
    );

    // No confirmed create was ever re-sent: total sends = 120 successes + the 1 network death,
    // and exactly one key (the failed one's) appears twice.
    expect(calls).toHaveLength(TOTAL + 1);
    const keyCounts = new Map<string, number>();
    for (const call of calls) keyCounts.set(call.idempotencyKey, (keyCounts.get(call.idempotencyKey) ?? 0) + 1);
    expect(keyCounts.size).toBe(TOTAL);
    expect([...keyCounts.values()].filter((count) => count === 2)).toHaveLength(1);
    expect(keyCounts.get(failedKey)).toBe(2);

    // Every row synced with a distinct canonicalId; queue fully drained.
    const rows = await store.listLocalExpenses();
    expect(rows).toHaveLength(TOTAL);
    expect(rows.every((row) => row.syncState === "synced")).toBe(true);
    expect(new Set(rows.map((row) => row.canonicalId)).size).toBe(TOTAL);
    expect(await store.listOutboxMutations()).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// §2 동일 지출 연속 수정 3회 — 버전 체인
// ---------------------------------------------------------------------------

describe("TEST-114 §2: three consecutive edits of the same expense", () => {
  let store: OfflineStore;

  beforeEach(() => {
    store = createMemoryOfflineStore();
  });

  it("online chain: each flushed edit sends the previous flush's returned version as expectedVersion (1→2→3), ending at version 4 with three distinct keys", async () => {
    const synced = await seedSyncedExpense(store);
    const { remote, calls } = createRecordingRemote();

    await recordLocalUpdate(store, synced.localId, { amountKrw: 20_000 });
    await flushOutbox(store, remote);
    await recordLocalUpdate(store, synced.localId, { amountKrw: 30_000 });
    await flushOutbox(store, remote);
    await recordLocalUpdate(store, synced.localId, { amountKrw: 40_000 });
    await flushOutbox(store, remote);

    const updates = calls.filter((call) => call.op === "update") as Array<Extract<RecordedCall, { op: "update" }>>;
    expect(updates).toHaveLength(3);
    expect(updates.map((call) => call.expectedVersion)).toEqual([1, 2, 3]);
    expect(updates.map((call) => call.payload.amountKrw)).toEqual([20_000, 30_000, 40_000]);
    // Each edit is its own mutation with its own idempotency key -- never a reuse across edits.
    expect(new Set(updates.map((call) => call.idempotencyKey)).size).toBe(3);

    const row = (await store.getLocalExpense(synced.localId))!;
    expect(row.version).toBe(4);
    expect(row.syncState).toBe("synced");
    expect(row.payload.amountKrw).toBe(40_000);
    expect(await store.listOutboxMutations()).toHaveLength(0);
  });

  it("offline chain: three edits to different fields collapse into ONE update gated on the pre-edit server version, carrying all three field changes", async () => {
    const synced = await seedSyncedExpense(store);

    await recordLocalUpdate(store, synced.localId, { amountKrw: 20_000 });
    await recordLocalUpdate(store, synced.localId, { memo: "둘째 수정" });
    await recordLocalUpdate(store, synced.localId, { itemName: "물티슈" });

    const mutations = await store.listOutboxMutationsForLocalId(synced.localId);
    expect(mutations).toHaveLength(1);
    expect(mutations[0].operation).toBe("update");
    // The earliest queued expectedVersion -- the version the server actually still has.
    expect(mutations[0].expectedVersion).toBe(1);
    expect(mutations[0].payload).toMatchObject({ amountKrw: 20_000, memo: "둘째 수정", itemName: "물티슈" });

    const { remote, calls } = createRecordingRemote();
    const summary = await flushOutbox(store, remote);
    expect(summary.synced).toBe(1);
    expect(calls).toHaveLength(1);

    const row = (await store.getLocalExpense(synced.localId))!;
    expect(row.version).toBe(2); // exactly one server round-trip for three edits
    expect(row.syncState).toBe("synced");
    expect(row.payload).toMatchObject({ amountKrw: 20_000, memo: "둘째 수정", itemName: "물티슈" });
  });
});

// ---------------------------------------------------------------------------
// §3 삭제 → 같은 품목명 재생성
// ---------------------------------------------------------------------------

describe("TEST-114 §3: delete then recreate under the same item name", () => {
  let store: OfflineStore;

  beforeEach(() => {
    store = createMemoryOfflineStore();
  });

  it("offline delete of a synced row + offline create of a same-named item stay two independent mutations (no name-based cross-merge), flushed delete-first in queue order", async () => {
    const original = await seedSyncedExpense(store);

    await recordLocalDelete(store, original.localId);
    const recreated = await recordLocalCreate(store, { ...payload }); // 같은 품목명 "기저귀"

    expect(recreated.localId).not.toBe(original.localId);
    // Two rows coexist locally: the pending-delete original and the fresh create.
    const rowsBefore = await store.listLocalExpenses();
    expect(rowsBefore).toHaveLength(2);

    // Merge scoping is by local_id, NEVER by item name: the same-named create must not fold
    // into (or cancel against) the queued delete.
    const queue = await store.listOutboxMutations();
    expect(queue.map((mutation) => mutation.operation)).toEqual(["delete", "create"]);
    expect(queue[0].targetLocalId).toBe(original.localId);
    expect(queue[1].targetLocalId).toBe(recreated.localId);

    const { remote, calls } = createRecordingRemote();
    const summary = await flushOutbox(store, remote);
    expect(summary).toEqual({ synced: 2, failed: 0, conflicted: 0, itemStatusSynced: 0, itemStatusFailed: 0, stoppedForNetwork: false });

    // Queue order on the wire: the old row's delete goes out BEFORE the same-named create, so
    // the server never sees two live rows racing on the same name in the other order.
    expect(calls.map((call) => call.op)).toEqual(["delete", "create"]);
    expect((calls[0] as Extract<RecordedCall, { op: "delete" }>).canonicalId).toBe(original.canonicalId);
    expect((calls[1] as Extract<RecordedCall, { op: "create" }>).payload.itemName).toBe("기저귀");

    // The old row is gone; exactly the recreated row remains, under a brand-new canonicalId.
    const rowsAfter = await store.listLocalExpenses();
    expect(rowsAfter).toHaveLength(1);
    expect(rowsAfter[0].localId).toBe(recreated.localId);
    expect(rowsAfter[0].syncState).toBe("synced");
    expect(rowsAfter[0].canonicalId).toBeTruthy();
    expect(await store.listOutboxMutations()).toHaveLength(0);
  });

  it("a recreate while the old row's delete sits in 'failed' still syncs independently; the failed delete stays parked for explicit user action, untouched by the same-named create", async () => {
    const original = await seedSyncedExpense(store);
    await recordLocalDelete(store, original.localId);

    // The delete permanently fails (e.g. 403 -- NOT the 404-converges-as-success case, which
    // delete-conflict-recovery.test.ts owns).
    const { remote: failingRemote } = createRecordingRemote({
      failDelete: () => new RemotePermanentError(403, "권한이 없어요.")
    });
    const failedSummary = await flushOutbox(store, failingRemote);
    expect(failedSummary.failed).toBe(1);
    const failedRow = (await store.getLocalExpense(original.localId))!;
    expect(failedRow.syncState).toBe("failed");
    expect(failedRow.pendingDelete).toBe(true);

    const recreated = await recordLocalCreate(store, { ...payload });
    const { remote, calls } = createRecordingRemote();
    const summary = await flushOutbox(store, remote);

    // Only the create went over the wire -- the failed delete is skipped until 재시도/삭제.
    expect(summary).toEqual({ synced: 1, failed: 0, conflicted: 0, itemStatusSynced: 0, itemStatusFailed: 0, stoppedForNetwork: false });
    expect(calls.map((call) => call.op)).toEqual(["create"]);

    const recreatedRow = (await store.getLocalExpense(recreated.localId))!;
    expect(recreatedRow.syncState).toBe("synced");
    // The failed row is byte-for-byte still parked: state, delete flag, and its queued mutation.
    const stillFailed = (await store.getLocalExpense(original.localId))!;
    expect(stillFailed.syncState).toBe("failed");
    expect(stillFailed.pendingDelete).toBe(true);
    expect(await store.listOutboxMutationsForLocalId(original.localId)).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// §4 커서 손상 / 과거 커서 복구 (runDeltaPull 경유)
// ---------------------------------------------------------------------------

/** Same scripted-transport convention as delta-sync.test.ts. */
function createFakeTransport(
  pagesByCursor: Record<string, DeltaPullPage<string>>,
  options?: { rejectCursors?: Record<string, Error> }
) {
  const fetchedCursors: Array<string | undefined> = [];
  const transport: DeltaPullTransport<string> = {
    async fetchChanges(cursor) {
      fetchedCursors.push(cursor);
      const key = cursor ?? "<none>";
      const rejection = options?.rejectCursors?.[key];
      if (rejection) throw rejection;
      const page = pagesByCursor[key];
      if (!page) throw new Error(`fake transport: no page scripted for cursor ${key}`);
      return page;
    }
  };
  return { transport, fetchedCursors };
}

function syncCursorInvalidHttpError(): Error {
  return new Error(JSON.stringify({ error: { code: "SYNC_CURSOR_INVALID", message: "동기화 커서가 올바르지 않아요." } }));
}

describe("TEST-114 §4: cursor corruption / ancient cursor recovery through runDeltaPull", () => {
  let store: OfflineStore;

  beforeEach(() => {
    store = createMemoryOfflineStore();
  });

  it("a corrupted persisted blob (garbage bytes) makes the pull start from scratch and self-repair: full pull, fresh cursor persisted, resumedFromCursor false", async () => {
    await store.setMeta(SYNC_CURSOR_META_KEY, " corrupted {{{");
    const { transport, fetchedCursors } = createFakeTransport({
      "<none>": { changes: ["a", "b"], nextCursor: "fresh-1", hasMore: false }
    });

    const summary = await runDeltaPull(store, transport, { scopeKey: "user-1" });

    // The garbage never went over the wire -- the pull behaved as a first-ever pull.
    expect(fetchedCursors).toEqual([undefined]);
    expect(summary).toEqual({ pages: 1, changeCount: 2, resumedFromCursor: false, didResetCursor: false });
    expect(await loadSyncCursor(store, "user-1")).toBe("fresh-1");
  });

  it("a shape-valid blob whose cursor is not a string (older build wrote it) is likewise treated as absent by the pull, not sent to the server", async () => {
    await store.setMeta(SYNC_CURSOR_META_KEY, JSON.stringify({ scopeKey: "user-1", cursor: 12345 }));
    const { transport, fetchedCursors } = createFakeTransport({
      "<none>": { changes: ["a"], nextCursor: "fresh-1", hasMore: false }
    });

    const summary = await runDeltaPull(store, transport, { scopeKey: "user-1" });

    expect(fetchedCursors).toEqual([undefined]);
    expect(summary.resumedFromCursor).toBe(false);
    expect(await loadSyncCursor(store, "user-1")).toBe("fresh-1");
  });

  it("SYNC_CURSOR_INVALID raised on a NON-first page mid-pull resets once and restarts from scratch, re-applying the earlier page (idempotent-apply contract)", async () => {
    await saveSyncCursor(store, "user-1", "c1");
    const { transport, fetchedCursors } = createFakeTransport(
      {
        c1: { changes: ["a"], nextCursor: "c2", hasMore: true },
        "<none>": { changes: ["a", "b", "c"], nextCursor: "c3", hasMore: false }
      },
      { rejectCursors: { c2: syncCursorInvalidHttpError() } }
    );
    const applied: string[][] = [];

    const summary = await runDeltaPull(store, transport, {
      scopeKey: "user-1",
      applyPage: (changes) => {
        applied.push(changes);
      }
    });

    expect(fetchedCursors).toEqual(["c1", "c2", undefined]);
    // Page "a" is applied twice (once pre-reset, once inside the full re-pull) -- safe because
    // upserts/tombstones are idempotent, per runDeltaPull's documented contract.
    expect(applied).toEqual([["a"], ["a", "b", "c"]]);
    expect(summary).toEqual({ pages: 2, changeCount: 4, resumedFromCursor: false, didResetCursor: true });
    expect(await loadSyncCursor(store, "user-1")).toBe("c3");
  });

  it("an ancient-but-decodable cursor is NOT an error: the pull drains the whole backlog page by page as a plain delta, never flags a reset", async () => {
    // Server semantics (sync.service.ts / delta-sync.ts header): a merely-old cursor keyset-pages
    // everything after it -- only an undecodable cursor 400s.
    await saveSyncCursor(store, "user-1", "ancient-cursor");
    const { transport, fetchedCursors } = createFakeTransport({
      "ancient-cursor": { changes: ["m1", "m2"], nextCursor: "b1", hasMore: true },
      b1: { changes: ["m3", "m4"], nextCursor: "b2", hasMore: true },
      b2: { changes: ["m5"], nextCursor: "b3", hasMore: false }
    });
    const applied: string[][] = [];

    const summary = await runDeltaPull(store, transport, {
      scopeKey: "user-1",
      applyPage: (changes) => {
        applied.push(changes);
      }
    });

    expect(fetchedCursors).toEqual(["ancient-cursor", "b1", "b2"]);
    expect(applied).toEqual([["m1", "m2"], ["m3", "m4"], ["m5"]]);
    expect(summary).toEqual({ pages: 3, changeCount: 5, resumedFromCursor: true, didResetCursor: false });
    expect(await loadSyncCursor(store, "user-1")).toBe("b3");
  });
});

// ---------------------------------------------------------------------------
// §5 시계 역행 (기기 시간 변경)
// ---------------------------------------------------------------------------

describe("TEST-114 §5: backward device-clock jump vs the backoff window", () => {
  const T0 = new Date("2026-07-12T12:00:00.000Z");
  let store: OfflineStore;

  beforeEach(() => {
    store = createMemoryOfflineStore();
    vi.useFakeTimers();
    vi.setSystemTime(T0);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("DOCUMENTED: after a small backward jump (within MAX_DELAY_MS), a backed-off mutation stays parked (nextRetryAt is compared as an absolute wall-clock instant) and only sends once the clock re-passes it -- with the same idempotency key", async () => {
    await recordLocalCreate(store, payload);
    const { remote, calls } = createRecordingRemote({
      failCreate: (index) => (index === 1 ? networkError() : undefined)
    });

    // T0: network death -> nextRetryAt = T0 + BASE_DELAY_MS.
    const firstPass = await flushOutbox(store, remote);
    expect(firstPass.stoppedForNetwork).toBe(true);
    const [mutation] = await store.listOutboxMutations();
    expect(mutation.nextRetryAt).toBe(new Date(T0.getTime() + BASE_DELAY_MS).toISOString());
    const key = mutation.idempotencyKey;

    // Device clock rolls back one minute. The window now sits 62s ahead of the wall clock --
    // still within MAX_DELAY_MS, so the OFF-115 clock-anomaly rule does NOT fire: the row is
    // 'pending' (not failed) and stays parked on its absolute instant until the clock re-passes
    // it. (A jump wide enough to push the window past now + MAX_DELAY_MS self-heals instead --
    // see the OFF-115 test below.)
    vi.setSystemTime(new Date(T0.getTime() - 60 * 1000));
    const rolledBackPass = await flushOutbox(store, remote);
    expect(rolledBackPass).toEqual({ synced: 0, failed: 0, conflicted: 0, itemStatusSynced: 0, itemStatusFailed: 0, stoppedForNetwork: false });
    expect(calls).toHaveLength(1);
    expect((await store.getLocalExpense(mutation.targetLocalId))?.syncState).toBe("pending");

    // Still parked right up to the original instant...
    vi.setSystemTime(new Date(T0.getTime() + BASE_DELAY_MS - 1));
    expect((await flushOutbox(store, remote)).synced).toBe(0);
    expect(calls).toHaveLength(1);

    // ...and eligible the moment the wall clock re-passes nextRetryAt, key unchanged.
    vi.setSystemTime(new Date(T0.getTime() + BASE_DELAY_MS + 1));
    const finalPass = await flushOutbox(store, remote);
    expect(finalPass.synced).toBe(1);
    expect(calls).toHaveLength(2);
    expect(calls[1].idempotencyKey).toBe(key);
  });

  it("the explicit user 재시도 is the manual escape: it clears nextRetryAt, so the mutation sends immediately even under a rolled-back clock", async () => {
    const created = await recordLocalCreate(store, payload);
    const { remote, calls } = createRecordingRemote({
      failCreate: (index) => (index === 1 ? networkError() : undefined)
    });
    await flushOutbox(store, remote);
    expect(calls).toHaveLength(1);

    // Clock rolls back one minute -- deliberately WITHIN the MAX_DELAY_MS anomaly threshold, so
    // the OFF-115 self-heal does not apply and the row would otherwise stay parked ~62s. The
    // explicit retry is the escape that works regardless of any threshold.
    vi.setSystemTime(new Date(T0.getTime() - 60 * 1000));
    await retryFailedMutation(store, created.localId);

    const summary = await flushOutbox(store, remote);
    expect(summary.synced).toBe(1);
    expect(calls).toHaveLength(2);
    expect(calls[1].idempotencyKey).toBe(calls[0].idempotencyKey);
    expect((await store.getLocalExpense(created.localId))?.syncState).toBe("synced");
  });

  // OFF-115 (TEST-114가 skip 재현으로 고정했던 실버그, 이제 수정됨): backoff.ts의 옛 설계 주석은
  // "연결 복구/foreground 트리거는 next_retry_at와 무관하게 즉시 flush"라고 말했지만,
  // connectivity.ts의 onReconnect는 flushOutbox를 그대로 호출할 뿐이고 flushOutboxPass는
  // next_retry_at가 미래인 row를 건너뛰었다 — 우회 경로가 실제로는 없어서, 기기 시계가 뒤로
  // 점프하면 next_retry_at가 "미래"에 고정되어 (점프 폭 + 지연)만큼 — 상한 없이 — 어떤 자동
  // flush로도 전송되지 않았다(row는 'failed'가 아닌 'pending'이라 재시도 버튼도 미노출).
  // 수정: flushOutboxPass가 `nextRetryAt > now + MAX_DELAY_MS`인 row를 시계 이상으로 간주해
  // 창을 클램프하고 그 pass에서 바로 전송한다(정상 backoff 창은 절대 now + MAX_DELAY_MS를
  // 넘을 수 없으므로 오탐 없음 — §6의 상한 평탄화 의미는 그대로). 아래는 그 자가 치유를
  // 재연결 flush 경로(= 그냥 flushOutbox 호출) 그대로 검증한다.
  it("OFF-115 fix: a reconnect-triggered flush self-heals a clock-rollback-parked mutation -- a nextRetryAt beyond now + MAX_DELAY_MS is clamped and sent immediately, same idempotency key", async () => {
    await recordLocalCreate(store, payload);
    const { remote, calls } = createRecordingRemote({
      failCreate: (index) => (index === 1 ? networkError() : undefined)
    });
    await flushOutbox(store, remote); // T0: network death, nextRetryAt = T0 + 2s
    const [parked] = await store.listOutboxMutations();
    const key = parked.idempotencyKey;

    // Clock rolls back one hour (window now 1h + 2s ahead of the wall clock -- far beyond
    // MAX_DELAY_MS), then connectivity returns: the reconnect trigger is exactly a flushOutbox
    // call (connectivity.ts wires onReconnect straight to it).
    vi.setSystemTime(new Date(T0.getTime() - 60 * 60 * 1000));
    const reconnectFlush = await flushOutbox(store, remote);

    // The automatic flush detects the impossible window, clamps it, and sends in the same pass
    // -- with the parked mutation's own idempotency key, so the earlier dead send stays deduped.
    expect(reconnectFlush.synced).toBe(1);
    expect(calls).toHaveLength(2);
    expect(calls[1].idempotencyKey).toBe(key);
    expect(await store.listOutboxMutations()).toHaveLength(0);
    expect((await store.getLocalExpense(parked.targetLocalId))?.syncState).toBe("synced");
  });
});

// ---------------------------------------------------------------------------
// §6 409 폭주 / backoff 상한
// ---------------------------------------------------------------------------

describe("TEST-114 §6: conflict storms and the backoff ceiling", () => {
  let store: OfflineStore;

  beforeEach(() => {
    store = createMemoryOfflineStore();
  });

  it("engine-path backoff delay is capped at MAX_DELAY_MS: repeated network failures double the delay then plateau, never exceeding the cap", async () => {
    vi.useFakeTimers();
    try {
      const T0 = new Date("2026-07-12T12:00:00.000Z");
      vi.setSystemTime(T0);
      await recordLocalCreate(store, payload);
      const { remote } = createRecordingRemote({ failCreate: () => networkError() });

      for (let attempt = 1; attempt <= 12; attempt += 1) {
        const summary = await flushOutbox(store, remote);
        expect(summary.stoppedForNetwork).toBe(true);

        const [mutation] = await store.listOutboxMutations();
        expect(mutation.attemptCount).toBe(attempt);
        const delayMs = new Date(mutation.nextRetryAt!).getTime() - Date.now();
        expect(delayMs).toBe(computeBackoffDelayMs(attempt));
        expect(delayMs).toBeLessThanOrEqual(MAX_DELAY_MS);
        if (attempt >= 9) {
          // 2s * 2^8 = 512s would exceed the 5-minute cap -> plateau exactly at the cap.
          expect(delayMs).toBe(MAX_DELAY_MS);
        }
        // Re-arm for the next attempt (same convention as sync-engine.test.ts).
        await store.updateOutboxMutation(mutation.mutationId, { nextRetryAt: null });
      }

      // The row is still an ordinary 'pending' row throughout -- a network storm never strands
      // it in 'failed', and its idempotency key never rotated.
      const [finalMutation] = await store.listOutboxMutations();
      expect(finalMutation.attemptCount).toBe(12);
      const row = await store.getLocalExpense(finalMutation.targetLocalId);
      expect(row?.syncState).toBe("pending");
    } finally {
      vi.useRealTimers();
    }
  });

  it("a 409 storm never grows backoff bookkeeping or auto-retries: each conflict costs exactly one request per explicit user action, with the queue pinned at one mutation", async () => {
    const synced = await seedSyncedExpense(store);
    await recordLocalUpdate(store, synced.localId, { amountKrw: 20_000 });

    let serverVersion = 5;
    const conflictSnapshot = () => ({
      deleted: false as const,
      expense: { ...payload, id: synced.canonicalId!, version: serverVersion }
    });
    const { remote, calls } = createRecordingRemote({
      failUpdate: () => new RemoteVersionConflictError(conflictSnapshot())
    });

    for (let cycle = 1; cycle <= 3; cycle += 1) {
      const summary = await flushOutbox(store, remote);
      expect(summary).toEqual({ synced: 0, failed: 0, conflicted: 1, itemStatusSynced: 0, itemStatusFailed: 0, stoppedForNetwork: false });
      // Exactly one request per cycle -- the storm is user-paced, never a hot loop.
      expect(calls.filter((call) => call.op === "update")).toHaveLength(cycle);

      // A follow-up automatic flush (reconnect/foreground) sends NOTHING for a conflict row.
      const idleSummary = await flushOutbox(store, remote);
      expect(idleSummary).toEqual({ synced: 0, failed: 0, conflicted: 0, itemStatusSynced: 0, itemStatusFailed: 0, stoppedForNetwork: false });
      expect(calls.filter((call) => call.op === "update")).toHaveLength(cycle);

      const mutations = await store.listOutboxMutationsForLocalId(synced.localId);
      expect(mutations).toHaveLength(1);
      // 409 is not a retryable failure: no attempt counting, no backoff window -- ever.
      expect(mutations[0].attemptCount).toBe(0);
      expect(mutations[0].nextRetryAt).toBeNull();

      const row = (await store.getLocalExpense(synced.localId))!;
      expect(row.syncState).toBe("conflict");
      expect(row.conflictCurrent).toEqual(conflictSnapshot());

      // The user reapplies against the fresh server version; another device bumps it again
      // before our send lands -> next cycle conflicts anew.
      await resolveConflictReapplyMine(store, synced.localId);
      const requeued = await store.listOutboxMutationsForLocalId(synced.localId);
      expect(requeued[0].expectedVersion).toBe(serverVersion);
      serverVersion += 1;
    }
  });
});

// ---------------------------------------------------------------------------
// §7 스냅숏 refresh(델타 풀) 도중 teardown 경합
// ---------------------------------------------------------------------------

describe("TEST-114 §7: session teardown racing an in-flight delta pull", () => {
  it("DOCUMENTED residual + fallback: a pull page applied across the wipe re-persists the OLD scope's cursor after clearAll, but the scope-key check evicts it before the next account can resume the old stream", async () => {
    // session-teardown.ts documents this exact residual risk class: direct store writers that
    // are neither a flush nor a wipe (runDeltaPull's saveSyncCursor here) are not serialized
    // through the single-flight maps. This test pins BOTH halves: the resurrection actually
    // happens (so a future fix is visible as a behavior change) AND delta-sync.ts's
    // loadSyncCursor scope check contains the damage, exactly as the teardown doc promises.
    const store = createMemoryOfflineStore();
    await recordLocalCreate(store, payload);
    await saveSyncCursor(store, "user-a", "c1");

    let releaseApply!: () => void;
    const applyGate = new Promise<void>((resolve) => {
      releaseApply = resolve;
    });
    const { transport } = createFakeTransport({
      c1: { changes: ["a"], nextCursor: "c2", hasMore: false }
    });

    // User A's snapshot refresh is mid-page-apply...
    const pullPromise = runDeltaPull(store, transport, {
      scopeKey: "user-a",
      applyPage: async () => {
        await applyGate;
      }
    });
    await new Promise((resolve) => setTimeout(resolve, 0));

    // ...when the A -> B teardown runs to completion (no flush in flight, so the wipe lands).
    await teardownOfflineSessionState(store);
    expect(await store.listLocalExpenses()).toEqual([]);
    expect(await store.listOutboxMutations()).toEqual([]);
    expect(await store.getMeta(SYNC_CURSOR_META_KEY)).toBeNull();

    // The pull resumes and persists its page's cursor -- INTO the freshly wiped store.
    releaseApply();
    const summary = await pullPromise;
    expect(summary.pages).toBe(1);
    const resurrected = await store.getMeta(SYNC_CURSOR_META_KEY);
    expect(resurrected).not.toBeNull(); // the documented residual write survived the wipe
    expect(resurrected).toContain('"scopeKey":"user-a"');

    // Fallback: user B's first cursor load sees a foreign scope, reports absent, and evicts --
    // B can never resume A's stream, and B's first pull starts from scratch.
    expect(await loadSyncCursor(store, "user-b")).toBeNull();
    expect(await store.getMeta(SYNC_CURSOR_META_KEY)).toBeNull();
    // The expense tables stayed empty throughout -- the pull never resurrects rows, only meta.
    expect(await store.listLocalExpenses()).toEqual([]);
    expect(await store.listOutboxMutations()).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// §8 페이로드 필드 피커 — 미지 필드 무시
// ---------------------------------------------------------------------------

describe("TEST-114 §8: payload field picker ignores unknown server fields", () => {
  let store: OfflineStore;

  const KNOWN_PAYLOAD_KEYS = [
    "childId",
    "categoryId",
    "amountKrw",
    "spentOn",
    "itemName",
    "merchant",
    "memo",
    "paymentMethod",
    "linkedItemTemplateId",
    "expenseType"
  ];

  beforeEach(() => {
    store = createMemoryOfflineStore();
  });

  async function seedConflictWithSnapshot(
    snapshotExtras: Record<string, unknown>,
    localOverrides?: Partial<ExpensePayload>
  ) {
    const synced = await seedSyncedExpense(store, localOverrides);
    await recordLocalUpdate(store, synced.localId, { amountKrw: 30_000 });
    const snapshot = {
      deleted: false as const,
      expense: {
        ...payload,
        ...localOverrides,
        itemName: "다른 기기 이름",
        id: synced.canonicalId!,
        version: 7,
        ...snapshotExtras
      } as ExpensePayload & { id: string; version: number }
    };
    const { remote } = createRecordingRemote({
      failUpdate: () => new RemoteVersionConflictError(snapshot)
    });
    await flushOutbox(store, remote);
    const row = (await store.getLocalExpense(synced.localId))!;
    expect(row.syncState).toBe("conflict");
    return synced.localId;
  }

  it("adopt-server drops every unknown field a newer server may attach to the snapshot (source, householdId, updatedAt, ...) -- only the known ExpensePayload keys survive", async () => {
    const localId = await seedConflictWithSnapshot({
      source: "manual",
      householdId: "hh-1",
      updatedAt: "2026-07-13T00:00:00.000Z",
      createdBy: "user-9",
      totallyNewServerField: { nested: true }
    });

    await resolveConflictAdoptServer(store, localId);

    const row = (await store.getLocalExpense(localId))!;
    expect(row.syncState).toBe("synced");
    expect(row.version).toBe(7);
    expect(row.payload.itemName).toBe("다른 기기 이름");
    // None of the unknown keys leaked into the payload (they would otherwise ride along into
    // later update/create request bodies), and no known key was lost.
    const payloadKeys = Object.keys(row.payload);
    for (const key of payloadKeys) {
      expect(KNOWN_PAYLOAD_KEYS).toContain(key);
    }
    for (const forbidden of ["id", "version", "source", "householdId", "updatedAt", "createdBy", "totallyNewServerField"]) {
      expect(payloadKeys).not.toContain(forbidden);
    }
  });

  it("a known field the snapshot OMITS keeps its local value on adopt-server (picker copies only fields the snapshot actually carries)", async () => {
    // toEngineConflictSnapshot deliberately doesn't map paymentMethod -- the base `payload`
    // has none, so building the snapshot from it leaves paymentMethod absent while the local
    // row carries "card".
    const localId = await seedConflictWithSnapshot({}, { paymentMethod: "card" });
    // Remove paymentMethod from the snapshot side to simulate the unmapped field.
    const rowBefore = (await store.getLocalExpense(localId))!;
    const snapshot = rowBefore.conflictCurrent;
    if (snapshot && !snapshot.deleted) {
      delete (snapshot.expense as Partial<ExpensePayload>).paymentMethod;
      await store.updateLocalExpense(localId, { conflictCurrent: snapshot });
    }

    await resolveConflictAdoptServer(store, localId);

    const row = (await store.getLocalExpense(localId))!;
    expect(row.payload.paymentMethod).toBe("card"); // local value retained, not wiped
    expect(row.payload.itemName).toBe("다른 기기 이름"); // fields the snapshot carries ARE adopted
  });

  it("diffExpenseFields only ever diffs the fixed display field set -- unknown extra fields on the server object produce no diff rows", async () => {
    const serverWithExtras = {
      ...payload,
      amountKrw: 99_999,
      source: "manual",
      householdId: "hh-1",
      surpriseField: "boo"
    } as unknown as ExpensePayload;

    const diff = diffExpenseFields({ ...payload, memo: "로컬 메모" }, serverWithExtras);

    const diffedFields = diff.map((entry) => entry.field as string);
    expect(diffedFields).toContain("amountKrw");
    expect(diffedFields).toContain("memo");
    for (const field of diffedFields) {
      expect(KNOWN_PAYLOAD_KEYS).toContain(field);
    }
    for (const unknown of ["source", "householdId", "surpriseField", "id", "version"]) {
      expect(diffedFields).not.toContain(unknown);
    }
  });
});
