import type { SyncChangesV2Result } from "../api/client";
import { RemoteSyncCancelledError } from "./errors";
import type { OfflineStore } from "./types";

export type DeltaPullResult = {
  complete: boolean;
  resetAttempted: boolean;
  pages: number;
  changes: number;
};

export type DeltaPullOptions = {
  store: OfflineStore;
  householdId: string;
  signal: AbortSignal;
  fetchPage: (cursor: string | null, signal: AbortSignal) => Promise<SyncChangesV2Result>;
  isActive: () => boolean;
  isInvalidCursorError: (error: unknown) => boolean;
  onPageCommitted?: (childIds: string[]) => Promise<void>;
  now?: () => Date;
  maxPages?: number;
  maxChanges?: number;
  maxElapsedMs?: number;
};

function assertActive(options: Pick<DeltaPullOptions, "signal" | "isActive">): void {
  if (options.signal.aborted || !options.isActive()) {
    throw new RemoteSyncCancelledError();
  }
}

export async function runPersistedDeltaPull(
  options: DeltaPullOptions
): Promise<DeltaPullResult> {
  const maxPages = options.maxPages ?? 10;
  const maxChanges = options.maxChanges ?? 2_000;
  const maxElapsedMs = options.maxElapsedMs ?? 8_000;
  const now = options.now ?? (() => new Date());
  const startedAt = now().getTime();
  let metadata = await options.store.getRemoteSyncMetadata();
  let cursor = metadata.cursor;
  let resetAttempted = false;
  let pages = 0;
  let changes = 0;

  while (
    pages < maxPages &&
    changes < maxChanges &&
    now().getTime() - startedAt < maxElapsedMs
  ) {
    assertActive(options);
    let page: SyncChangesV2Result;
    try {
      page = await options.fetchPage(cursor, options.signal);
    } catch (error) {
      if (options.isInvalidCursorError(error) && !resetAttempted) {
        assertActive(options);
        metadata = await options.store.resetRemoteSyncMetadata({
          expectedCursor: metadata.cursor,
          resetAt: new Date().toISOString(),
          ownerStillCurrent: options.isActive
        });
        cursor = metadata.cursor;
        resetAttempted = true;
        continue;
      }
      throw error;
    }

    assertActive(options);
    const applied = await options.store.applyRemoteSyncPage({
      householdId: options.householdId,
      expectedCursor: cursor,
      changes: page.changes,
      nextCursor: page.nextCursor,
      hasMore: page.hasMore,
      appliedAt: now().toISOString(),
      ownerStillCurrent: () => !options.signal.aborted && options.isActive()
    });
    if (applied.affectedChildIds.length > 0) {
      await options.onPageCommitted?.(applied.affectedChildIds);
    }
    cursor = applied.metadata.cursor;
    pages += 1;
    changes += page.changes.length;
    if (!page.hasMore) {
      return { complete: true, resetAttempted, pages, changes };
    }
  }

  return { complete: false, resetAttempted, pages, changes };
}
