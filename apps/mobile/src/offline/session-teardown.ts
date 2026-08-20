import { usePurchaseFollowupStore } from "../commerce/purchase-followup.store";
import { useNotificationStore } from "../notifications/notification.store";
import { clearSyncCursor } from "./delta-sync";
import { wipeOfflineStore } from "./sync-engine";
import type { OfflineStore } from "./types";

/**
 * PRIV-104 — offline-state teardown on session identity change.
 *
 * The offline SQLite store (local_expenses / mutation_outbox / sync_meta) and the persisted
 * purchase-followup store are device-local and NOT keyed by user. Before this module existed,
 * `clearSession` (src/stores/session.store.ts) dropped only the tokens: user B logging in on
 * user A's device inherited A's local expense rows, A's pending outbox mutations (which the next
 * flush would then send under B's token, writing A's data into B's account), and A's
 * purchase-followup prompts.
 *
 * Wiring follows the exact pattern MOB-103b established for the delta-sync cursor: the session
 * store subscription in sync-controller.ts's `useOfflineSyncLifecycle` detects the identity
 * change and calls `teardownOfflineSessionState`. This module holds the (unit-testable) policy
 * and teardown steps; the controller stays a thin, untestable glue layer.
 */

/** The two session-store fields that constitute the session's *identity* (as opposed to its
 * credentials): which account's data the offline store is allowed to hold. Mirrors the fields
 * MOB-103b's cursor invalidation already keyed on. */
export type SessionIdentity = { userId: string | null; isTestSession: boolean };

/**
 * True exactly when the offline store must be wiped before the incoming session touches it:
 *
 *   - A → B account switch (`userId` changed between two non-null users);
 *   - explicit logout (`clearSession` sets `userId` non-null → null) — pending outbox rows are
 *     deliberately dropped with it: after logout there is no token left to ever flush them with,
 *     and keeping them is exactly the PRIV-104 leak once someone else logs in;
 *   - login after a logout (null → non-null). Normally a no-op (the logout transition already
 *     wiped), but it is the belt-and-braces half of the "wipe happens between accounts" rule:
 *     if the logout-time wipe never ran (app killed mid-logout, crash before the async wipe
 *     landed), the incoming user still starts clean;
 *   - demo/test session toggle (`isTestSession` flipped) — demo fixture rows and a real
 *     account's rows must never mix.
 *
 * False — data intentionally KEPT — when the identity is unchanged:
 *
 *   - token refresh (`setTokens` touches only accessToken/refreshToken);
 *   - the same user re-establishing their session (`setSession` with an unchanged userId), so a
 *     re-login never discards that same user's unsynced offline expenses.
 */
export function isSessionIdentityChange(previous: SessionIdentity, next: SessionIdentity): boolean {
  return next.userId !== previous.userId || next.isTestSession !== previous.isTestSession;
}

/**
 * Wipes every piece of device-local, user-scoped offline state. Steps, in order:
 *
 *   1. purchase-followup store reset — synchronous zustand set, effective immediately;
 *   2. `wipeOfflineStore` STARTED (not yet awaited) — this must come before any `await` in this
 *      function because the wipe registers itself in sync-engine.ts's `inFlightWipes` map
 *      synchronously. From that moment, any `flushOutbox` call — including one that arrives
 *      while the remaining teardown steps are still awaiting — parks behind the wipe and reads
 *      the post-wipe (empty) outbox, instead of flushing the outgoing account's queued
 *      mutations under the incoming account's token (the exact PRIV-104 leak). Awaiting the
 *      cursor clear first used to leave precisely that window open;
 *   3. delta-sync cursor removal — kept as an explicit step (same call MOB-103b made from the
 *      controller) even though the wipe clears sync_meta anyway: the wipe may be parked behind
 *      an in-flight flush pass, and the cursor must die *now*, not after that pass completes,
 *      so a concurrently-running delta pull for the new user can never resume from the old
 *      user's cursor. The wipe's own sync_meta clear afterwards is a harmless double-clear;
 *   4. await the wipe — local_expenses + mutation_outbox + sync_meta cleared, sequenced against
 *      any in-flight outbox flush (see its doc comment in sync-engine.ts for the exact race
 *      guarantees).
 *
 * Any store failure propagates to the caller (the controller subscription swallows it — same
 * best-effort stance as every other background offline operation there); the scope-key check in
 * delta-sync.ts's loadSyncCursor remains the last-resort fallback for the cursor specifically.
 */
export async function teardownOfflineSessionState(store: OfflineStore): Promise<void> {
  usePurchaseFollowupStore.getState().resetAll();
  // NOTI-102: 알림 이력·중복 방지 키·시기 메타도 사용자 단위 상태이므로 함께 초기화한다.
  useNotificationStore.getState().resetAll();
  // Step 2: start the wipe BEFORE the first await so it registers in inFlightWipes
  // synchronously — see the ordering rationale in the doc comment above.
  const wipe = wipeOfflineStore(store);
  await clearSyncCursor(store);
  await wipe;
}
