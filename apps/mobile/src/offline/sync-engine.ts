import { MAX_DELAY_MS, computeNextRetryAtIso } from "./backoff";
import { RemotePermanentError, RemoteVersionConflictError } from "./errors";
import { mergeOutboxMutation } from "./outbox-merge";
import {
  generateOfflineId,
  type ExpensePayload,
  type LocalExpenseRow,
  type MutationOutboxRow,
  type OfflineStore
} from "./types";

export type RemoteCreateResult = { id: string; version: number };
export type RemoteUpdateResult = { version: number };

/**
 * Thin transport contract the sync engine flushes mutations through. `remote-api.ts` implements
 * this against `src/api/client.ts`'s real/local-session-aware HTTP functions; tests implement it
 * with in-memory fakes so the merge/backoff/conflict logic here can be verified without any
 * network or SQLite dependency.
 */
export interface RemoteExpenseApi {
  createExpense(payload: ExpensePayload, idempotencyKey: string): Promise<RemoteCreateResult>;
  updateExpense(
    canonicalId: string,
    payload: ExpensePayload,
    expectedVersion: number,
    idempotencyKey: string
  ): Promise<RemoteUpdateResult>;
  deleteExpense(canonicalId: string, expectedVersion: number, idempotencyKey: string): Promise<void>;
}

function nowIso(): string {
  return new Date().toISOString();
}

/** Drops keys whose value is explicitly `undefined` before merging a patch onto a payload. The
 * rest of this codebase's update call sites (e.g. app/expenses/[expenseId].tsx) pass
 * `field: value || undefined` to mean "leave this field unchanged" -- a plain object spread
 * (`{...row.payload, ...patch}`) would instead overwrite the existing value with `undefined`
 * for any such key, since spread copies own enumerable keys regardless of their value. */
function omitUndefinedValues<T extends object>(patch: Partial<T>): Partial<T> {
  const result: Partial<T> = {};
  for (const key of Object.keys(patch) as Array<keyof T>) {
    if (patch[key] !== undefined) {
      result[key] = patch[key];
    }
  }
  return result;
}

/**
 * COV-T5 bug 1 (삭제-404 영구 실패 루프): a DELETE the server answers with 404 EXPENSE_NOT_FOUND
 * means both sides already agree the row is gone -- the local delete's whole intent is satisfied.
 * Routing it to 'failed' (like other permanent errors) created an unwinnable retry loop: 재시도
 * re-sends the same idempotency key and gets the same 404 forever, and only a manual discard
 * exits. Instead flushOutbox treats exactly this case as delete success.
 *
 * Deliberately narrow: only status 404 AND the API's actual not-found body code. The server's
 * delete path raises NotFoundException({code: "EXPENSE_NOT_FOUND", ...}) (apps/api/src/finance/
 * expenses.service.ts), which GlobalExceptionFilter serializes as `{error: {code, message, ...}}`
 * -- and remote-api.ts forwards that parsed body onto RemotePermanentError.body. A 404 without
 * that code (e.g. from a proxy/gateway) proves nothing about the row and stays 'failed'; any
 * other status (403 FORBIDDEN, 422, ...) is untouched; UPDATE mutations never take this path.
 */
function isDeleteTargetAlreadyGoneOnServer(error: RemotePermanentError): boolean {
  if (error.status !== 404) return false;
  const body = error.body as { error?: { code?: unknown } } | null | undefined;
  return body?.error?.code === "EXPENSE_NOT_FOUND";
}

async function replaceOutboxForLocalId(
  store: OfflineStore,
  existing: MutationOutboxRow[],
  merged: MutationOutboxRow[]
): Promise<void> {
  const mergedIds = new Set(merged.map((mutation) => mutation.mutationId));
  for (const old of existing) {
    if (!mergedIds.has(old.mutationId)) {
      await store.deleteOutboxMutation(old.mutationId);
    }
  }
  for (const row of merged) {
    const wasAlreadyPersisted = existing.some((mutation) => mutation.mutationId === row.mutationId);
    if (wasAlreadyPersisted) {
      await store.updateOutboxMutation(row.mutationId, row);
    } else {
      await store.insertOutboxMutation(row);
    }
  }
}

/** Step 1 of §3.2's flow: record a new expense locally (sync_state='pending') and queue its
 * create mutation. Callers are expected to have already reflected this optimistically in the UI
 * (react-query cache merge) -- see src/offline/sync-controller.ts. */
export async function recordLocalCreate(
  store: OfflineStore,
  payload: ExpensePayload,
  timestamp: string = nowIso()
): Promise<LocalExpenseRow> {
  const localId = generateOfflineId("lexp");
  const row: LocalExpenseRow = {
    localId,
    canonicalId: null,
    childId: payload.childId,
    payload,
    version: null,
    syncState: "pending",
    pendingDelete: false,
    conflictCurrent: null,
    lastError: null,
    createdAt: timestamp,
    updatedAt: timestamp
  };
  await store.insertLocalExpense(row);
  await store.insertOutboxMutation({
    mutationId: generateOfflineId("mut"),
    idempotencyKey: generateOfflineId("idem"),
    operation: "create",
    targetLocalId: localId,
    payload,
    expectedVersion: null,
    attemptCount: 0,
    nextRetryAt: null,
    lastError: null,
    createdAt: timestamp
  });
  return row;
}

export async function recordLocalUpdate(
  store: OfflineStore,
  localId: string,
  patch: Partial<ExpensePayload>,
  timestamp: string = nowIso()
): Promise<LocalExpenseRow> {
  const row = await store.getLocalExpense(localId);
  if (!row) throw new Error("로컬 지출 기록을 찾을 수 없어요.");

  const mergedPayload: ExpensePayload = { ...row.payload, ...omitUndefinedValues(patch) };
  await store.updateLocalExpense(localId, {
    payload: mergedPayload,
    syncState: "pending",
    lastError: null,
    updatedAt: timestamp
  });

  const existing = await store.listOutboxMutationsForLocalId(localId);
  const incoming: MutationOutboxRow = {
    mutationId: generateOfflineId("mut"),
    idempotencyKey: generateOfflineId("idem"),
    operation: "update",
    targetLocalId: localId,
    payload: mergedPayload,
    expectedVersion: row.version,
    attemptCount: 0,
    nextRetryAt: null,
    lastError: null,
    createdAt: timestamp
  };
  await replaceOutboxForLocalId(store, existing, mergeOutboxMutation(existing, incoming));

  return (await store.getLocalExpense(localId)) as LocalExpenseRow;
}

export async function recordLocalDelete(
  store: OfflineStore,
  localId: string,
  timestamp: string = nowIso()
): Promise<void> {
  const row = await store.getLocalExpense(localId);
  if (!row) throw new Error("로컬 지출 기록을 찾을 수 없어요.");

  const existing = await store.listOutboxMutationsForLocalId(localId);
  const incoming: MutationOutboxRow = {
    mutationId: generateOfflineId("mut"),
    idempotencyKey: generateOfflineId("idem"),
    operation: "delete",
    targetLocalId: localId,
    payload: null,
    expectedVersion: row.version,
    attemptCount: 0,
    nextRetryAt: null,
    lastError: null,
    createdAt: timestamp
  };
  const merged = mergeOutboxMutation(existing, incoming);
  await replaceOutboxForLocalId(store, existing, merged);

  if (merged.length === 0) {
    // create+delete before the create ever synced -- the row never existed remotely.
    await store.deleteLocalExpense(localId);
  } else {
    await store.updateLocalExpense(localId, {
      syncState: "pending",
      pendingDelete: true,
      lastError: null,
      updatedAt: timestamp
    });
  }
}

export type FlushSummary = {
  synced: number;
  failed: number;
  conflicted: number;
  /** True if the pass stopped early because a mutation failed with what looks like a network
   * error (not a typed 409/4xx) -- further sends in the same pass would likely fail the same
   * way while offline, so the pass bails out instead of burning through the whole queue. */
  stoppedForNetwork: boolean;
};

/**
 * H-3 fix (diff review): serializes concurrent flushOutbox() calls against the *same* store
 * instance into a single in-progress pass -- a caller that invokes flushOutbox while one is
 * already running for that store just awaits the already-running pass's result instead of
 * starting a second, overlapping one (which could double-send a mutation or race the same
 * store rows). Keyed by store identity (not global) via WeakMap, so this never leaks across
 * tests/instances: each test's `createMemoryOfflineStore()` call gets its own independent slot,
 * and the app has exactly one singleton store (see sync-controller.ts). Mirrors the same
 * single-flight pattern already used for token refresh in src/api/client.ts.
 */
const inFlightFlushes = new WeakMap<OfflineStore, Promise<FlushSummary>>();

/** PRIV-104: single-flight session wipes, symmetric with `inFlightFlushes` above — see
 * `wipeOfflineStore` below. */
const inFlightWipes = new WeakMap<OfflineStore, Promise<void>>();

export function flushOutbox(store: OfflineStore, remote: RemoteExpenseApi): Promise<FlushSummary> {
  const alreadyRunning = inFlightFlushes.get(store);
  if (alreadyRunning) return alreadyRunning;

  const pass = (async () => {
    // PRIV-104: a flush requested while a session wipe is running must not read the pre-wipe
    // outbox snapshot — it would re-send (and re-confirm bookkeeping for) mutations the wipe is
    // about to delete, under whatever token the *new* session passed in. Wait for the wipe to
    // finish; the pass then sees the post-wipe (empty) queue and no-ops.
    const wipeInProgress = inFlightWipes.get(store);
    if (wipeInProgress) await wipeInProgress.catch(() => undefined);
    return flushOutboxPass(store, remote);
  })().finally(() => {
    inFlightFlushes.delete(store);
  });
  inFlightFlushes.set(store, pass);
  return pass;
}

/**
 * PRIV-104 session teardown: wipes every row the offline store persists (local_expenses,
 * mutation_outbox, sync_meta) on logout / account switch / demo-session toggle — see
 * session-teardown.ts for the policy of *when* this fires.
 *
 * Race handling, built on the same single-flight WeakMaps the H-3 flush fix uses:
 *   - wipe requested while a flush pass is in-flight → the wipe AWAITS that pass first. The
 *     outgoing user's in-flight mutations get their normal chance to reach the server under the
 *     outgoing token (no data loss for writes already being sent), and the pass's row updates
 *     can't resurrect or half-update rows underneath the DELETEs. Whatever the pass leaves
 *     behind is then wiped.
 *   - flush requested while a wipe is in-flight → the flush awaits the wipe (see flushOutbox
 *     above) and starts from the clean, empty store.
 *   - two concurrent wipe requests coalesce into one.
 * The `inFlightWipes` registration is SYNCHRONOUS — the map entry exists before this function
 * returns. session-teardown.ts relies on that: it starts the wipe before its own first `await`,
 * so a flush requested at any point during teardown is guaranteed to see the wipe and park
 * behind it (never read the outgoing account's outbox under the incoming account's token).
 * Residual risk (documented, accepted): direct store writers that are neither a flush nor a wipe
 * (the recordLocal... / resolveConflict... helpers fired from a screen the outgoing user still
 * had open) are not serialized through these maps — a write that lands in the moments after
 * clearAll() ran would survive the wipe. Both store implementations tolerate this without
 * corruption (row-level operations are independent; updates to deleted rows no-op), and the
 * logout/switch navigation unmounts those screens before the new session mounts.
 */
export function wipeOfflineStore(store: OfflineStore): Promise<void> {
  const alreadyWiping = inFlightWipes.get(store);
  if (alreadyWiping) return alreadyWiping;

  const wipe = (async () => {
    const flushInProgress = inFlightFlushes.get(store);
    if (flushInProgress) await flushInProgress.catch(() => undefined);
    await store.clearAll();
  })().finally(() => {
    inFlightWipes.delete(store);
  });
  inFlightWipes.set(store, wipe);
  return wipe;
}

/**
 * Sends every eligible queued outbox mutation to the server, in the order they were created
 * (design doc §3.2 point 2: "outbox 순서대로"). Rows whose local expense is currently in
 * 'conflict' or 'failed' state are skipped -- those need an explicit user action (conflict
 * resolution, retry, or discard) before they're eligible again. Rows still inside their
 * backoff window (`next_retry_at` in the future) are also skipped -- unless the window is
 * impossibly far in the future, which the OFF-115 clock-anomaly rule below self-heals.
 */
async function flushOutboxPass(store: OfflineStore, remote: RemoteExpenseApi): Promise<FlushSummary> {
  const summary: FlushSummary = { synced: 0, failed: 0, conflicted: 0, stoppedForNetwork: false };
  const mutations = await store.listOutboxMutations();
  const currentTime = nowIso();

  for (const mutation of mutations) {
    const localRow = await store.getLocalExpense(mutation.targetLocalId);
    if (!localRow) {
      // Orphaned mutation (local row already removed by some other path) -- drop it.
      await store.deleteOutboxMutation(mutation.mutationId);
      continue;
    }
    if (localRow.syncState === "conflict" || localRow.syncState === "failed") {
      continue;
    }
    if (mutation.nextRetryAt && mutation.nextRetryAt > currentTime) {
      // OFF-115 (시계 역행 자가 치유): a legitimately scheduled retry can never sit more than
      // MAX_DELAY_MS past "now" -- computeNextRetryAtIso caps the delay at MAX_DELAY_MS relative
      // to the wall clock at failure time, and real time only moves the window CLOSER afterwards.
      // So `nextRetryAt > now + MAX_DELAY_MS` (strictly greater: an uncrossed cap-sized window is
      // still legitimate) proves the device clock jumped backwards after the failure was recorded.
      // Without this rule the row would stay parked for the whole jump width + delay -- unbounded,
      // and invisible in the UI (the row is 'pending', not 'failed', so no 재시도 button appears).
      // Chosen over threading a "bypass nextRetryAt" flag through the reconnect/foreground
      // triggers (backoff.ts's original design comment) because it is local, heals EVERY flush
      // entry point (timer, reconnect poll, foreground, manual), and doesn't let repeated
      // foreground events bypass a healthy backoff window during network flaps.
      const maxPlausibleRetryAt = new Date(new Date(currentTime).getTime() + MAX_DELAY_MS).toISOString();
      if (mutation.nextRetryAt <= maxPlausibleRetryAt) {
        continue; // normal backoff window -- untouched (§6: MAX_DELAY_MS plateau semantics)
      }
      // Clock anomaly: clamp the stale window away ("due now") and fall through to send in this
      // very pass. attemptCount is deliberately kept (unlike the explicit user 재시도) so a still-
      // failing network re-schedules from the SAME backoff rung, now anchored to the current
      // clock -- the anomaly heals without resetting pacing.
      await store.updateOutboxMutation(mutation.mutationId, { nextRetryAt: null });
    }
    if (mutation.operation !== "create" && !localRow.canonicalId) {
      // H-3: this update/delete was appended (not folded) because an earlier create for the
      // same local_id was in-flight when it was queued (see outbox-merge.ts) -- nothing to send
      // yet. It'll become eligible once that create's own flush completes and populates
      // canonicalId, on a later pass (never within this same snapshot -- see the single-flight
      // guard above, which is exactly what makes that ordering safe).
      continue;
    }

    // H-3: mark this exact mutation row in-flight *before* sending, so any edit that lands
    // while the request is outstanding gets appended as a new row (outbox-merge.ts) instead of
    // silently folded into -- and then deleted along with -- this one.
    await store.updateOutboxMutation(mutation.mutationId, { inFlight: true });
    await store.updateLocalExpense(mutation.targetLocalId, { syncState: "syncing" });

    try {
      if (mutation.operation === "create") {
        const result = await remote.createExpense(mutation.payload as ExpensePayload, mutation.idempotencyKey);
        await store.deleteOutboxMutation(mutation.mutationId);
        // H-3: if an edit landed while this create was in-flight, it was appended as a separate
        // (not-yet-sent) mutation rather than folded in -- see outbox-merge.ts. Only mark the row
        // fully 'synced' once nothing else is still queued for it; otherwise it should read
        // 'pending' (there's still an unsent edit) rather than misleadingly claiming done.
        const stillQueued = await store.listOutboxMutationsForLocalId(mutation.targetLocalId);
        await store.updateLocalExpense(mutation.targetLocalId, {
          canonicalId: result.id,
          version: result.version,
          syncState: stillQueued.length > 0 ? "pending" : "synced",
          lastError: null,
          updatedAt: nowIso()
        });
        summary.synced += 1;
        continue;
      }

      if (mutation.operation === "update") {
        // Falls back to the local row's own known version when this mutation was queued before
        // its target's canonicalId/version were known (see the defer-continue above) -- by the
        // time canonicalId is set, localRow.version reflects the version that just came back
        // from the create, which is exactly the expectedVersion this update should send.
        const expectedVersion = mutation.expectedVersion ?? localRow.version;
        if (!localRow.canonicalId || expectedVersion == null) {
          // Should be unreachable (guarded above), but stay defensive rather than sending a
          // malformed request.
          throw new RemotePermanentError(422, "동기화할 원본 기록을 찾을 수 없어요.");
        }
        const result = await remote.updateExpense(
          localRow.canonicalId,
          mutation.payload as ExpensePayload,
          expectedVersion,
          mutation.idempotencyKey
        );
        await store.deleteOutboxMutation(mutation.mutationId);
        const stillQueued = await store.listOutboxMutationsForLocalId(mutation.targetLocalId);
        await store.updateLocalExpense(mutation.targetLocalId, {
          version: result.version,
          syncState: stillQueued.length > 0 ? "pending" : "synced",
          lastError: null,
          updatedAt: nowIso()
        });
        summary.synced += 1;
        continue;
      }

      // operation === "delete"
      const expectedVersion = mutation.expectedVersion ?? localRow.version;
      if (!localRow.canonicalId || expectedVersion == null) {
        // Never reached the server -- nothing to delete remotely.
        await store.deleteLocalExpense(mutation.targetLocalId);
        await store.deleteOutboxMutation(mutation.mutationId);
        summary.synced += 1;
        continue;
      }
      await remote.deleteExpense(localRow.canonicalId, expectedVersion, mutation.idempotencyKey);
      await store.deleteLocalExpense(mutation.targetLocalId);
      await store.deleteOutboxMutation(mutation.mutationId);
      summary.synced += 1;
    } catch (error) {
      if (error instanceof RemoteVersionConflictError) {
        if (error.current === null) {
          // A genuine VERSION_CONFLICT whose `current` snapshot is unknown (e.g. the row
          // vanished server-side entirely) can't be resolved by any of the three conflict
          // choices -- there's nothing to adopt, reapply against, or diff. Route it into the
          // same 'failed' state as a permanent HTTP error so the existing retry/discard UI
          // handles it instead of leaving the row permanently stuck in an unresolvable
          // 'conflict' state (see resolveConflict* below, which also guards against this).
          await store.updateLocalExpense(mutation.targetLocalId, {
            syncState: "failed",
            lastError: error.message,
            updatedAt: nowIso()
          });
          await store.updateOutboxMutation(mutation.mutationId, {
            attemptCount: mutation.attemptCount + 1,
            lastError: error.message,
            inFlight: false
          });
          summary.failed += 1;
          continue;
        }
        await store.updateLocalExpense(mutation.targetLocalId, {
          syncState: "conflict",
          conflictCurrent: error.current,
          lastError: error.message,
          updatedAt: nowIso()
        });
        await store.updateOutboxMutation(mutation.mutationId, { inFlight: false, lastError: error.message });
        summary.conflicted += 1;
        continue;
      }

      if (error instanceof RemotePermanentError) {
        if (mutation.operation === "delete" && isDeleteTargetAlreadyGoneOnServer(error)) {
          // 404/EXPENSE_NOT_FOUND on a delete: the server already has no such row, which is
          // exactly the end state this mutation wanted. Converge as success -- mirror the
          // normal delete success path (local row removed, outbox row cleared) instead of
          // parking the row in an unwinnable 'failed' retry loop.
          await store.deleteLocalExpense(mutation.targetLocalId);
          await store.deleteOutboxMutation(mutation.mutationId);
          summary.synced += 1;
          continue;
        }
        await store.updateLocalExpense(mutation.targetLocalId, {
          syncState: "failed",
          lastError: error.message,
          updatedAt: nowIso()
        });
        await store.updateOutboxMutation(mutation.mutationId, {
          attemptCount: mutation.attemptCount + 1,
          lastError: error.message,
          inFlight: false
        });
        summary.failed += 1;
        continue;
      }

      // Transient/network error: keep 'pending', schedule a backed-off retry, and stop this
      // flush pass -- further sends are likely to fail the same way while offline.
      const message = error instanceof Error ? error.message : String(error);
      const nextAttempt = mutation.attemptCount + 1;
      await store.updateOutboxMutation(mutation.mutationId, {
        attemptCount: nextAttempt,
        nextRetryAt: computeNextRetryAtIso(nowIso(), nextAttempt),
        lastError: message,
        inFlight: false
      });
      await store.updateLocalExpense(mutation.targetLocalId, {
        syncState: "pending",
        lastError: message,
        updatedAt: nowIso()
      });
      summary.stoppedForNetwork = true;
      break;
    }
  }

  return summary;
}

async function clearOutboxForLocalId(store: OfflineStore, localId: string): Promise<void> {
  const mutations = await store.listOutboxMutationsForLocalId(localId);
  for (const mutation of mutations) {
    await store.deleteOutboxMutation(mutation.mutationId);
  }
}

/**
 * Defense-in-depth for a 'conflict' row whose `conflictCurrent` is unexpectedly null (should be
 * rare after the H-1 fix in client.ts's requestExpenseJson, which now only ever produces a
 * 'conflict' row when the server's `current` snapshot is actually present -- see
 * flushOutbox's RemoteVersionConflictError branch above, which itself already routes a
 * null-current conflict straight to 'failed'). None of the three resolution choices below have
 * anything to adopt/reapply/diff against in that state, so rather than silently no-op'ing (which
 * would leave the row permanently stuck, unreachable by any UI action), fall back to 'failed' so
 * the existing retry/discard actions can recover it.
 */
async function fallBackToFailedForUnresolvableConflict(store: OfflineStore, localId: string): Promise<void> {
  await store.updateLocalExpense(localId, {
    syncState: "failed",
    lastError: "충돌 정보를 확인할 수 없어요. 다시 시도하거나 삭제해 주세요.",
    updatedAt: nowIso()
  });
}

/** User-triggered "재시도" for a 'failed' row (design doc §3.2 point 5): resets the outbox
 * mutation's backoff bookkeeping and flips the row back to 'pending' so the next flush picks it
 * up again.
 *
 * FIX-MOB-DX (COV-T5 관찰 #4): `attemptCount` is reset to 0 too, not just `nextRetryAt`. An
 * explicit user retry is a fresh expression of intent -- if it then fails on the network, its
 * backoff should restart from the base delay (2s), not resume the pre-retry exponential climb
 * (which could park the very mutation the user just asked to send behind a minutes-long
 * `next_retry_at`). The idempotency key is untouched, so a re-send stays deduplicated. */
export async function retryFailedMutation(store: OfflineStore, localId: string): Promise<void> {
  const mutations = await store.listOutboxMutationsForLocalId(localId);
  for (const mutation of mutations) {
    await store.updateOutboxMutation(mutation.mutationId, { attemptCount: 0, nextRetryAt: null, lastError: null });
  }
  await store.updateLocalExpense(localId, { syncState: "pending", lastError: null });
}

/** User-triggered "삭제" for a 'failed' row: discards the local row and its queued mutation(s)
 * entirely (the record never made it to the server, so there's nothing to reconcile). */
export async function discardFailedMutation(store: OfflineStore, localId: string): Promise<void> {
  await clearOutboxForLocalId(store, localId);
  await store.deleteLocalExpense(localId);
}

// ---------------------------------------------------------------------------
// Conflict resolution (design doc §3.4 / D-10) -- three explicit choices, no silent
// last-write-wins. All three clear the row out of 'conflict' state and either resolve it
// immediately (adopt) or requeue a mutation with the now-known server version (reapply/merge).
// ---------------------------------------------------------------------------

/** Every mutable field ExpensePayload carries (src/offline/types.ts) -- the full field set, not
 * just diffExpenseFields' display subset (which deliberately omits childId/linkedItemTemplateId). */
const expensePayloadFieldKeys: ReadonlyArray<keyof ExpensePayload> = [
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

/**
 * COV-T5 bug 2 (adopt-server payload 오염): a ConflictSnapshot's live expense is
 * `ExpensePayload & {id, version}` -- spreading the whole snapshot into a payload
 * (`{...row.payload, ...server}`) smuggles the server bookkeeping keys `id`/`version` into
 * ExpensePayload, where they'd ride along into later update/create request bodies as unknown
 * fields. This picks only the payload-shaped fields the snapshot actually carries (fields the
 * snapshot omits, e.g. paymentMethod which toEngineConflictSnapshot doesn't map, keep their
 * local value via the merge at the call site).
 */
function pickPayloadFieldsFromSnapshot(
  snapshot: ExpensePayload & { id: string; version: number }
): Partial<ExpensePayload> {
  const picked: Partial<ExpensePayload> = {};
  for (const key of expensePayloadFieldKeys) {
    if (key in snapshot) {
      (picked as Record<string, unknown>)[key] = snapshot[key];
    }
  }
  return picked;
}

/** ① 다른 기기 값 유지: discard the local change, adopt the server's current value. */
export async function resolveConflictAdoptServer(store: OfflineStore, localId: string): Promise<void> {
  const row = await store.getLocalExpense(localId);
  if (!row) return;
  if (!row.conflictCurrent) {
    await fallBackToFailedForUnresolvableConflict(store, localId);
    return;
  }
  await clearOutboxForLocalId(store, localId);

  if (row.conflictCurrent.deleted) {
    await store.deleteLocalExpense(localId);
    return;
  }

  const server = row.conflictCurrent.expense;
  await store.updateLocalExpense(localId, {
    canonicalId: server.id,
    payload: { ...row.payload, ...pickPayloadFieldsFromSnapshot(server) },
    version: server.version,
    syncState: "synced",
    conflictCurrent: null,
    pendingDelete: false,
    lastError: null,
    updatedAt: nowIso()
  });
}

/** ② 내 변경 다시 적용: resend the local change using the server's now-known version as the new
 * expectedVersion. If the server's current value is a deleted tombstone, "my change" can't be
 * applied on top of a resource that no longer exists -- it's re-queued as a brand-new create
 * instead (design doc §3.4: "current가 deleted면 이 옵션은 새 기록으로 재생성임을 안내"). */
export async function resolveConflictReapplyMine(store: OfflineStore, localId: string): Promise<void> {
  const row = await store.getLocalExpense(localId);
  if (!row) return;
  if (!row.conflictCurrent) {
    await fallBackToFailedForUnresolvableConflict(store, localId);
    return;
  }
  await clearOutboxForLocalId(store, localId);
  const timestamp = nowIso();

  if (row.conflictCurrent.deleted) {
    await store.updateLocalExpense(localId, {
      canonicalId: null,
      version: null,
      syncState: "pending",
      conflictCurrent: null,
      pendingDelete: false,
      lastError: null,
      updatedAt: timestamp
    });
    await store.insertOutboxMutation({
      mutationId: generateOfflineId("mut"),
      idempotencyKey: generateOfflineId("idem"),
      operation: "create",
      targetLocalId: localId,
      payload: row.payload,
      expectedVersion: null,
      attemptCount: 0,
      nextRetryAt: null,
      lastError: null,
      createdAt: timestamp
    });
    return;
  }

  const serverVersion = row.conflictCurrent.expense.version;
  await store.updateLocalExpense(localId, {
    syncState: "pending",
    conflictCurrent: null,
    version: serverVersion,
    lastError: null,
    updatedAt: timestamp
  });
  await store.insertOutboxMutation({
    mutationId: generateOfflineId("mut"),
    idempotencyKey: generateOfflineId("idem"),
    operation: row.pendingDelete ? "delete" : "update",
    targetLocalId: localId,
    payload: row.pendingDelete ? null : row.payload,
    expectedVersion: serverVersion,
    attemptCount: 0,
    nextRetryAt: null,
    lastError: null,
    createdAt: timestamp
  });
}

/** ③ 두 값 나란히 보기: after the user reviews the local-vs-server field diff (see
 * `diffExpenseFields` below) and picks/edits the fields they want, this sends that chosen
 * payload as the update, gated on the server's now-known version. */
export async function resolveConflictWithMergedPayload(
  store: OfflineStore,
  localId: string,
  mergedPayload: ExpensePayload
): Promise<void> {
  const row = await store.getLocalExpense(localId);
  if (!row) return;
  if (!row.conflictCurrent) {
    // Nothing to diff/merge against -- fall back to 'failed' rather than throwing into an
    // unhandled rejection that would leave the row stuck (see
    // fallBackToFailedForUnresolvableConflict's doc comment).
    await fallBackToFailedForUnresolvableConflict(store, localId);
    return;
  }
  if (row.conflictCurrent.deleted) {
    throw new Error("병합할 수 없는 상태예요.");
  }
  await clearOutboxForLocalId(store, localId);
  const timestamp = nowIso();
  const serverVersion = row.conflictCurrent.expense.version;

  await store.updateLocalExpense(localId, {
    payload: mergedPayload,
    syncState: "pending",
    conflictCurrent: null,
    version: serverVersion,
    lastError: null,
    updatedAt: timestamp
  });
  await store.insertOutboxMutation({
    mutationId: generateOfflineId("mut"),
    idempotencyKey: generateOfflineId("idem"),
    operation: "update",
    targetLocalId: localId,
    payload: mergedPayload,
    expectedVersion: serverVersion,
    attemptCount: 0,
    nextRetryAt: null,
    lastError: null,
    createdAt: timestamp
  });
}

/** Field-by-field diff between the local pending payload and the server's current value, for
 * the "두 값 나란히 보기" screen. */
export function diffExpenseFields(
  local: ExpensePayload,
  server: ExpensePayload
): Array<{ field: keyof ExpensePayload; localValue: unknown; serverValue: unknown }> {
  const fields: Array<keyof ExpensePayload> = [
    "categoryId",
    "amountKrw",
    "spentOn",
    "itemName",
    "merchant",
    "memo",
    "paymentMethod",
    "expenseType"
  ];
  return fields
    .filter((field) => JSON.stringify(local[field] ?? null) !== JSON.stringify(server[field] ?? null))
    .map((field) => ({ field, localValue: local[field], serverValue: server[field] }));
}
