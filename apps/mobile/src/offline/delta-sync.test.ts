import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import {
  clearSyncCursor,
  isSyncCursorInvalidError,
  loadSyncCursor,
  runDeltaPull,
  saveSyncCursor,
  syncCursorScopeKey,
  SYNC_CURSOR_META_KEY,
  type DeltaPullPage,
  type DeltaPullTransport
} from "./delta-sync";
import { createMemoryOfflineStore } from "./memory-offline-store";
import type { OfflineStore } from "./types";

/** Minimal stand-in for a /sync/changes change entry -- delta-sync.ts is generic over the change
 * shape (it only counts/forwards them), so tests use plain strings. */
type FakeChange = string;

/**
 * Fake transport in the createFakeRemote style of sync-engine.test.ts: a scripted map from
 * "cursor sent" to "page returned", recording every fetch so tests can assert exactly which
 * cursors went over the wire. `undefined` (no cursor) is keyed as "<none>".
 */
function createFakeTransport(
  pagesByCursor: Record<string, DeltaPullPage<FakeChange>>,
  options?: { rejectCursors?: Record<string, Error> }
) {
  const fetchedCursors: Array<string | undefined> = [];
  const transport: DeltaPullTransport<FakeChange> = {
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

/** The exact shape the mobile client surfaces the server's 400 as: requestJson throws
 * `new Error(JSON.stringify(body))` where body is `{ error: { code: "SYNC_CURSOR_INVALID" } }`
 * (see apps/api/test/sync-changes.e2e.test.ts for the server side). */
function syncCursorInvalidHttpError(): Error {
  return new Error(JSON.stringify({ error: { code: "SYNC_CURSOR_INVALID", message: "동기화 커서가 올바르지 않아요." } }));
}

describe("delta-sync: cursor persistence round-trip", () => {
  let store: OfflineStore;

  beforeEach(() => {
    store = createMemoryOfflineStore();
  });

  it("round-trips a cursor through the store's meta area for the same scope", async () => {
    await saveSyncCursor(store, "user-1", "cursor-abc");
    expect(await loadSyncCursor(store, "user-1")).toBe("cursor-abc");
    // Persisted through the same OfflineStore the outbox uses, under a single well-known key.
    expect(await store.getMeta(SYNC_CURSOR_META_KEY)).toContain("cursor-abc");
  });

  it("treats another account's cursor as absent AND evicts it (scope check)", async () => {
    await saveSyncCursor(store, "user-1", "cursor-abc");
    expect(await loadSyncCursor(store, "user-2")).toBeNull();
    // Evicted, not just hidden: even the original scope no longer sees it.
    expect(await store.getMeta(SYNC_CURSOR_META_KEY)).toBeNull();
    expect(await loadSyncCursor(store, "user-1")).toBeNull();
  });

  it("treats a malformed persisted blob (older build / corruption) as absent and evicts it", async () => {
    await store.setMeta(SYNC_CURSOR_META_KEY, "not-json{{{");
    expect(await loadSyncCursor(store, "user-1")).toBeNull();
    expect(await store.getMeta(SYNC_CURSOR_META_KEY)).toBeNull();

    await store.setMeta(SYNC_CURSOR_META_KEY, JSON.stringify({ cursor: 42 }));
    expect(await loadSyncCursor(store, "user-1")).toBeNull();
  });

  it("maps a null userId (local/demo session) to a stable non-user scope key", () => {
    expect(syncCursorScopeKey(null)).toBe("local-session");
    expect(syncCursorScopeKey("user-1")).toBe("user-1");
    expect(syncCursorScopeKey(null)).not.toBe(syncCursorScopeKey("user-1"));
  });
});

describe("delta-sync: runDeltaPull resumes from the persisted cursor", () => {
  let store: OfflineStore;

  beforeEach(() => {
    store = createMemoryOfflineStore();
  });

  it("first pull starts from scratch, pages through, and persists the last page's cursor", async () => {
    const { transport, fetchedCursors } = createFakeTransport({
      "<none>": { changes: ["a", "b"], nextCursor: "c1", hasMore: true },
      c1: { changes: ["c"], nextCursor: "c2", hasMore: false }
    });
    const applied: FakeChange[][] = [];

    const summary = await runDeltaPull(store, transport, {
      scopeKey: "user-1",
      applyPage: (changes) => {
        applied.push(changes);
      }
    });

    expect(fetchedCursors).toEqual([undefined, "c1"]);
    expect(applied).toEqual([["a", "b"], ["c"]]);
    expect(summary).toEqual({ pages: 2, changeCount: 3, resumedFromCursor: false, didResetCursor: false });
    expect(await loadSyncCursor(store, "user-1")).toBe("c2");
  });

  it("a later pull resumes from the persisted cursor instead of re-pulling from scratch", async () => {
    await saveSyncCursor(store, "user-1", "c2");
    const { transport, fetchedCursors } = createFakeTransport({
      c2: { changes: ["d"], nextCursor: "c3", hasMore: false }
    });

    const summary = await runDeltaPull(store, transport, { scopeKey: "user-1" });

    expect(fetchedCursors).toEqual(["c2"]);
    expect(summary.resumedFromCursor).toBe(true);
    expect(summary.changeCount).toBe(1);
    expect(await loadSyncCursor(store, "user-1")).toBe("c3");
  });

  it("an empty delta page (nothing new; server echoes the cursor back) keeps the cursor as-is", async () => {
    await saveSyncCursor(store, "user-1", "c2");
    // Mirrors sync.service.ts: with no rows past the cursor, nextCursor === the cursor sent.
    const { transport } = createFakeTransport({
      c2: { changes: [], nextCursor: "c2", hasMore: false }
    });

    const summary = await runDeltaPull(store, transport, { scopeKey: "user-1" });

    expect(summary).toEqual({ pages: 1, changeCount: 0, resumedFromCursor: true, didResetCursor: false });
    expect(await loadSyncCursor(store, "user-1")).toBe("c2");
  });

  it("never persists the cursor of a page whose application failed (partial-page guard)", async () => {
    const { transport } = createFakeTransport({
      "<none>": { changes: ["a"], nextCursor: "c1", hasMore: true },
      c1: { changes: ["b"], nextCursor: "c2", hasMore: false }
    });

    let pageIndex = 0;
    await expect(
      runDeltaPull(store, transport, {
        scopeKey: "user-1",
        applyPage: () => {
          pageIndex += 1;
          if (pageIndex === 2) throw new Error("apply blew up mid-pull");
        }
      })
    ).rejects.toThrow("apply blew up mid-pull");

    // Page 1 applied fully -> its cursor is safe to keep; page 2's cursor must NOT have been
    // advanced past the un-applied changes.
    expect(await loadSyncCursor(store, "user-1")).toBe("c1");
  });

  it("stops after maxPages but leaves the cursor at the last applied page so the next pull resumes", async () => {
    const { transport, fetchedCursors } = createFakeTransport({
      "<none>": { changes: ["a"], nextCursor: "c1", hasMore: true },
      c1: { changes: ["b"], nextCursor: "c2", hasMore: true },
      c2: { changes: ["c"], nextCursor: "c3", hasMore: false }
    });

    const summary = await runDeltaPull(store, transport, { scopeKey: "user-1", maxPages: 2 });

    expect(fetchedCursors).toEqual([undefined, "c1"]);
    expect(summary.pages).toBe(2);
    expect(await loadSyncCursor(store, "user-1")).toBe("c2");

    const second = createFakeTransport({ c2: { changes: ["c"], nextCursor: "c3", hasMore: false } });
    await runDeltaPull(store, second.transport, { scopeKey: "user-1" });
    expect(second.fetchedCursors).toEqual(["c2"]);
    expect(await loadSyncCursor(store, "user-1")).toBe("c3");
  });
});

describe("delta-sync: server-driven cursor reset (400 SYNC_CURSOR_INVALID)", () => {
  let store: OfflineStore;

  beforeEach(() => {
    store = createMemoryOfflineStore();
  });

  it("recognizes the client-side surfaced shape of the server's 400", () => {
    expect(isSyncCursorInvalidError(syncCursorInvalidHttpError())).toBe(true);
    expect(isSyncCursorInvalidError(new TypeError("Network request failed"))).toBe(false);
    expect(isSyncCursorInvalidError("SYNC_CURSOR_INVALID")).toBe(false); // non-Error never matches
  });

  it("clears the rejected cursor and falls back to a full re-pull, exactly once", async () => {
    await saveSyncCursor(store, "user-1", "stale-cursor");
    const { transport, fetchedCursors } = createFakeTransport(
      {
        "<none>": { changes: ["a", "b"], nextCursor: "fresh-1", hasMore: false }
      },
      { rejectCursors: { "stale-cursor": syncCursorInvalidHttpError() } }
    );
    const applied: FakeChange[][] = [];

    const summary = await runDeltaPull(store, transport, {
      scopeKey: "user-1",
      applyPage: (changes) => {
        applied.push(changes);
      }
    });

    expect(fetchedCursors).toEqual(["stale-cursor", undefined]);
    expect(applied).toEqual([["a", "b"]]);
    expect(summary).toEqual({ pages: 1, changeCount: 2, resumedFromCursor: false, didResetCursor: true });
    expect(await loadSyncCursor(store, "user-1")).toBe("fresh-1");
  });

  it("propagates SYNC_CURSOR_INVALID raised on a cursorless fetch instead of looping", async () => {
    const { transport, fetchedCursors } = createFakeTransport(
      {},
      { rejectCursors: { "<none>": syncCursorInvalidHttpError() } }
    );

    await expect(runDeltaPull(store, transport, { scopeKey: "user-1" })).rejects.toThrow("SYNC_CURSOR_INVALID");
    expect(fetchedCursors).toEqual([undefined]);
  });

  it("propagates non-cursor errors (network) without touching the persisted cursor", async () => {
    await saveSyncCursor(store, "user-1", "c1");
    const { transport } = createFakeTransport(
      {},
      { rejectCursors: { c1: new TypeError("Network request failed") } }
    );

    await expect(runDeltaPull(store, transport, { scopeKey: "user-1" })).rejects.toThrow("Network request failed");
    expect(await loadSyncCursor(store, "user-1")).toBe("c1");
  });
});

describe("delta-sync: session teardown invalidation", () => {
  it("clearSyncCursor removes the persisted cursor entirely", async () => {
    const store = createMemoryOfflineStore();
    await saveSyncCursor(store, "user-1", "cursor-abc");

    await clearSyncCursor(store);

    expect(await store.getMeta(SYNC_CURSOR_META_KEY)).toBeNull();
    expect(await loadSyncCursor(store, "user-1")).toBeNull();
  });

  it("sync-controller wires cursor invalidation to session identity changes and routes the delta pull through runDeltaPull (source verification -- the controller itself is not runtime-testable under vitest, see its header comment; follows ui-wiring.test.ts's convention)", () => {
    const controllerSource = readFileSync(join(process.cwd(), "src/offline/sync-controller.ts"), "utf8");

    // Teardown hook: a session store subscription tears down offline state (which includes
    // clearing the cursor -- see session-teardown.ts and session-teardown.test.ts) when the
    // account changes. PRIV-104 moved the policy out of the controller into session-teardown.ts.
    expect(controllerSource).toContain("useSessionStore.subscribe");
    expect(controllerSource).toContain("isSessionIdentityChange(previous, state)");
    // FIX-118A added the outgoing session's token as a second argument (best-effort push-device
    // deactivation); the cursor-clearing contract this test pins is unchanged.
    expect(controllerSource).toContain("teardownOfflineSessionState(store, { authToken: outgoingToken })");

    // The pull resumes via the persisted-cursor pipeline, scoped by userId, not a bare one-shot.
    expect(controllerSource).toContain("runDeltaPull(");
    expect(controllerSource).toContain("syncCursorScopeKey(useSessionStore.getState().userId)");
    expect(controllerSource).toContain("fetchChanges: (cursor) => getSyncChanges(token, cursor)");
    // The old cursorless one-shot call must be gone.
    expect(controllerSource).not.toContain("getSyncChanges(token)\n");
  });
});
