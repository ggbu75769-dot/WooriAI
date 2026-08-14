import type { OfflineStore } from "./types";

/**
 * MOB-103b — persisted delta-sync cursor for `GET /v1/sync/changes`.
 *
 * The server (apps/api/src/sync/sync.service.ts, read-only reference) keyset-paginates by the
 * stable `(updatedAt, id)` sort key across *every household the authenticated user belongs to*
 * — there is no per-child (or even per-household) cursor parameter. The cursor therefore scopes
 * to exactly one thing: the authenticated user. We persist it under a scope key derived from
 * `userId` and treat any stored cursor whose scope key doesn't match the current session as
 * absent (and clear it), so an account switch can never resume from another account's stream.
 * Switching the selected child deliberately does NOT invalidate the cursor: the stream already
 * covers all of the user's children, and a child-scoped cursor would silently skip the other
 * children's changes.
 *
 * Reset semantics, mirrored from the server: a malformed/undecodable cursor is rejected with
 * HTTP 400 `{ error: { code: "SYNC_CURSOR_INVALID" } }` (see sync.service.ts's decodeOrThrow and
 * apps/api/test/sync-changes.e2e.test.ts). A cursor that is merely "old" is NOT an error — the
 * keyset query simply returns everything after it (or an empty page). So the only server-driven
 * reset signal is that 400, which `runDeltaPull` answers by clearing the persisted cursor and
 * restarting the same pull as a full re-pull from scratch, exactly once.
 *
 * Everything here is transport-agnostic (mirrors sync-engine.ts's RemoteExpenseApi pattern):
 * sync-controller.ts adapts src/api/client.ts's getSyncChanges into `DeltaPullTransport`; tests
 * use in-memory fakes with no network, SQLite, or timers.
 */

/** Key inside OfflineStore's meta area. One slot total (not one per user): the store itself is
 * device-local and single-account-at-a-time, so a scope mismatch simply evicts the old value. */
export const SYNC_CURSOR_META_KEY = "syncCursor";

type PersistedSyncCursor = { scopeKey: string; cursor: string };

/** Scope key the cursor is persisted under — the authenticated userId, or a fixed sentinel for
 * the tokenless local/demo session (whose local backend ignores cursors anyway). */
export function syncCursorScopeKey(userId: string | null): string {
  return userId ?? "local-session";
}

function parsePersistedCursor(raw: string): PersistedSyncCursor | null {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (
      parsed &&
      typeof parsed === "object" &&
      typeof (parsed as PersistedSyncCursor).scopeKey === "string" &&
      typeof (parsed as PersistedSyncCursor).cursor === "string"
    ) {
      return parsed as PersistedSyncCursor;
    }
  } catch {
    // fall through — malformed blob is treated as absent below
  }
  return null;
}

/** Reads the persisted cursor for `scopeKey`. A blob that is malformed or belongs to a different
 * scope (previous account) is deleted and reported as absent — defense-in-depth on top of the
 * explicit session-change invalidation in sync-controller.ts. */
export async function loadSyncCursor(store: OfflineStore, scopeKey: string): Promise<string | null> {
  const raw = await store.getMeta(SYNC_CURSOR_META_KEY);
  if (raw === null) return null;
  const persisted = parsePersistedCursor(raw);
  if (!persisted || persisted.scopeKey !== scopeKey) {
    await store.deleteMeta(SYNC_CURSOR_META_KEY);
    return null;
  }
  return persisted.cursor;
}

export async function saveSyncCursor(store: OfflineStore, scopeKey: string, cursor: string): Promise<void> {
  await store.setMeta(SYNC_CURSOR_META_KEY, JSON.stringify({ scopeKey, cursor } satisfies PersistedSyncCursor));
}

/** Session teardown hook: called on logout / account switch (see sync-controller.ts). */
export async function clearSyncCursor(store: OfflineStore): Promise<void> {
  await store.deleteMeta(SYNC_CURSOR_META_KEY);
}

/**
 * Matches the server's 400 `SYNC_CURSOR_INVALID` rejection as it surfaces on the client:
 * requestJson (src/api/client.ts) throws `new Error(JSON.stringify(body))` for any non-ok
 * response, so the code arrives embedded in the message string rather than as a typed field.
 */
export function isSyncCursorInvalidError(error: unknown): boolean {
  return error instanceof Error && error.message.includes("SYNC_CURSOR_INVALID");
}

/** One page of `/sync/changes`, in the wire shape (matches client.ts's SyncChangesResult). */
export type DeltaPullPage<TChange> = {
  changes: TChange[];
  nextCursor: string | null;
  hasMore: boolean;
};

export interface DeltaPullTransport<TChange> {
  /** `cursor === undefined` means "from the beginning" (full pull). */
  fetchChanges(cursor: string | undefined): Promise<DeltaPullPage<TChange>>;
}

export type DeltaPullSummary = {
  /** Pages successfully fetched AND applied this pull. */
  pages: number;
  /** Total changes across those pages. */
  changeCount: number;
  /** True if the pull started from a persisted cursor (delta) rather than from scratch. */
  resumedFromCursor: boolean;
  /** True if the server rejected the persisted cursor and the pull restarted from scratch. */
  didResetCursor: boolean;
};

/** Safety valve so one pull pass can't spin forever against a pathological/misbehaving server;
 * the persisted cursor makes the next pass resume exactly where this one stopped. */
const DEFAULT_MAX_PAGES_PER_PULL = 20;

/**
 * Pages through `/sync/changes` starting from the persisted cursor (if any), applying each page
 * via `applyPage` and advancing the persisted cursor only AFTER that page has fully applied — a
 * page whose application throws leaves the cursor at the last fully-applied page, so nothing is
 * ever skipped on the next pull (re-applying a page is safe: upserts/tombstones are idempotent).
 *
 * Stale-cursor handling: if the server 400s the persisted cursor (SYNC_CURSOR_INVALID), the
 * cursor is cleared and the pull restarts from scratch once; a failure without a cursor in play
 * propagates to the caller (best-effort semantics are the caller's concern).
 */
export async function runDeltaPull<TChange>(
  store: OfflineStore,
  transport: DeltaPullTransport<TChange>,
  options: {
    scopeKey: string;
    applyPage?: (changes: TChange[]) => void | Promise<void>;
    maxPages?: number;
  }
): Promise<DeltaPullSummary> {
  const maxPages = options.maxPages ?? DEFAULT_MAX_PAGES_PER_PULL;
  let cursor = await loadSyncCursor(store, options.scopeKey);
  const summary: DeltaPullSummary = {
    pages: 0,
    changeCount: 0,
    resumedFromCursor: cursor !== null,
    didResetCursor: false
  };

  let hasMore = true;
  while (hasMore && summary.pages < maxPages) {
    let page: DeltaPullPage<TChange>;
    try {
      page = await transport.fetchChanges(cursor ?? undefined);
    } catch (error) {
      if (cursor !== null && isSyncCursorInvalidError(error)) {
        // Server-driven reset: our persisted cursor is unusable. Clear it and restart this
        // same pull as a full re-pull. Only reachable once — after this, cursor === null, so a
        // second SYNC_CURSOR_INVALID (server bug) propagates instead of looping.
        await clearSyncCursor(store);
        cursor = null;
        summary.didResetCursor = true;
        summary.resumedFromCursor = false;
        continue;
      }
      throw error;
    }

    // Apply BEFORE persisting the page's cursor — if this throws, the cursor still points at
    // the last fully-applied page and the whole page is retried next pull.
    if (options.applyPage) {
      await options.applyPage(page.changes);
    }
    summary.pages += 1;
    summary.changeCount += page.changes.length;

    if (page.nextCursor !== null && page.nextCursor !== cursor) {
      await saveSyncCursor(store, options.scopeKey, page.nextCursor);
      cursor = page.nextCursor;
    }
    hasMore = page.hasMore;
  }

  return summary;
}
