import { usePurchaseFollowupStore } from "../commerce/purchase-followup.store";
import { useNotificationStore } from "../notifications/notification.store";
import { deactivateRegisteredPushDevice } from "../notifications/usePushDeviceRegistration";
import { clearAppQueryCache } from "../query/query-client-registry";
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
 * The slice of a zustand `persist`-wrapped store this module's subscription helper needs. Kept
 * structural (rather than importing `useSessionStore`'s concrete type) so a unit test can hand in
 * a fake that reproduces the hydration sequence, and so this policy module keeps depending on
 * nothing but the store's shape.
 */
export type HydratablePersistedStore<TState> = {
  subscribe: (listener: (state: TState, previous: TState) => void) => () => void;
  persist: {
    hasHydrated: () => boolean;
    onFinishHydration: (listener: () => void) => () => void;
  };
};

/**
 * AUTH-127 (round27 H-1) — subscribe to REAL session transitions only, never to the notification
 * zustand's persist middleware emits when it rehydrates.
 *
 * The hazard: `persist` finishes hydration with `set(stateFromStorage, true)`, an ordinary
 * replace-set, so every `subscribe` listener is called with `(persistedState, preHydrationState)`
 * — and the pre-hydration state is the store's *initial* state (`userId: null`). On a cold start
 * that reads back a persisted `userId: "user-a"`, an unguarded listener therefore sees
 * `null → "user-a"`, which `isSessionIdentityChange` correctly classifies as "a login after a
 * logout" — and answers by wiping local_expenses / mutation_outbox / sync_meta / the delta cursor
 * / the purchase-followup store. That wipe destroys exactly what AUTH-127 promised to keep: the
 * user records a expense offline, the refresh token expires (`clearSession("expired")` keeps
 * `userId`, so nothing is wiped), the app is killed, and the next cold start's rehydration wipes
 * the queue the login screen is at that very moment promising to flush
 * ("저장하지 않은 기록도 이어서 반영할게요").
 *
 * The fix is to treat rehydration as what it is — restoring the state the app already had, not a
 * change of session — with two overlapping guards:
 *
 *   1. the transition subscription is not registered until hydration has finished
 *      (`hasHydrated()` already true at mount, or `onFinishHydration`, which persist fires in a
 *      `.then()` *after* the replace-set above — so the rehydration notification is provably not
 *      observable by a listener registered from it);
 *   2. once registered, notifications that arrive while a hydration pass is running are dropped.
 *      `persist.hasHydrated()` goes back to false for the whole duration of any later
 *      `persist.rehydrate()` call, which would otherwise re-open the identical hole.
 *
 * Everything after hydration is untouched: login, logout, A → B switch and the demo toggle all
 * reach `listener` exactly as before.
 *
 * Known edge, deliberately accepted: if a hydration pass never settles (persist swallows a
 * storage read failure and leaves `hasHydrated()` false forever), the subscription never arms and
 * a later account switch would not tear down. That device has no working persisted session at
 * all — nothing was restored, so the app is on the login screen with an empty store — and
 * delta-sync.ts's scope-key check still invalidates the cursor. The failure mode is "no
 * teardown", never "a teardown of the wrong thing"; the pre-guard behavior's failure mode was a
 * guaranteed wipe on every cold start after an expiry.
 */
export function subscribeToHydratedSessionTransitions<TState>(
  store: HydratablePersistedStore<TState>,
  listener: (state: TState, previous: TState) => void
): () => void {
  let unsubscribeTransitions: (() => void) | null = null;
  let disposed = false;

  const startListening = () => {
    if (disposed || unsubscribeTransitions) return;
    unsubscribeTransitions = store.subscribe((state, previous) => {
      // Guard 2: a *later* hydration pass (persist.rehydrate()) flips hasHydrated back to false
      // for its whole duration, replace-set included.
      if (!store.persist.hasHydrated()) return;
      listener(state, previous);
    });
  };

  if (store.persist.hasHydrated()) startListening();
  // Guard 1: nothing is subscribed until hydration finishes. Registered even when already
  // hydrated, so a later rehydrate() that lands between passes still re-arms the listener.
  const unsubscribeHydration = store.persist.onFinishHydration(startListening);

  return () => {
    disposed = true;
    unsubscribeHydration();
    unsubscribeTransitions?.();
  };
}

/**
 * FIX-118A / round27 M-1 — the SYNCHRONOUS half of the identity-change teardown.
 *
 * `teardownOfflineSessionState` below is async, and its caller in sync-controller.ts can only
 * reach it through `getOfflineStore()` (a promise: the SQLite module is imported lazily). Both
 * hops are microtasks, and React re-renders the subscribers of the session store from the same
 * `set()` that produced the identity change — so anything that must be true "before the incoming
 * account's screens render" cannot live behind those hops. The query-cache clear is exactly such
 * a step: user-scoped query keys carry no user id (`["children"]`, `["my-devices"]`, …), so B's
 * first render would otherwise read A's cached rows.
 *
 * Calling this from the subscription body, before any await/then, is what makes the ordering
 * real. Limitation worth naming: this pins "the clear runs in the same tick as the store
 * notification, ahead of the async teardown" — vitest cannot mount the real navigator/screens, so
 * the render itself is not what the tests observe (see session-teardown.test.ts).
 *
 * Idempotent: `teardownOfflineSessionState` calls it again as its step 0, which keeps direct
 * callers of the teardown (and its unit tests) whole.
 */
export function clearSessionScopedQueryCache(): void {
  clearAppQueryCache();
}

/**
 * The outgoing session's credentials, handed in by the caller (sync-controller.ts reads them off
 * the subscription's `previous` state — by the time teardown runs, the store already holds the
 * *incoming* session). Only used for best-effort server-side cleanup that must happen while the
 * leaving account's token is still valid; every step of the teardown works without it.
 */
export type SessionTeardownContext = {
  /** Access token of the session being torn down (or the local test-session token). */
  authToken: string | null;
};

/**
 * Wipes every piece of device-local, user-scoped offline state. Steps, in order:
 *
 *   0. react-query cache clear (FIX-118A / M-3) — user-scoped query keys in this app carry no
 *      user identifier (`["children"]`, `["my-devices"]`, …), so without this the incoming
 *      account renders the outgoing account's cached child list / device list for the whole
 *      30s staleTime window. Synchronous and first, so nothing can re-render stale rows while
 *      the rest of the teardown is still awaiting. A no-op if app/_layout.tsx never registered
 *      a client (unit tests) — see src/query/query-client-registry.ts. Round27 M-1: the real
 *      caller runs this one step *before* awaiting the offline store (see
 *      `clearSessionScopedQueryCache`), because "first inside an async function that is itself
 *      reached through a promise" was not early enough to precede the incoming account's first
 *      render; the repeat here is deliberate and idempotent;
 *   0b. push device deactivation (FIX-118A / M-4, client half) — started here, deliberately NOT
 *      awaited: it is a best-effort network call under the OUTGOING token, and teardown must
 *      never be delayed (or failed) by it. Kicked off before the awaits below so it uses the
 *      token while it is still valid;
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
export async function teardownOfflineSessionState(
  store: OfflineStore,
  context: SessionTeardownContext = { authToken: null }
): Promise<void> {
  // Step 0: drop every cached server response of the outgoing account (see doc comment). The
  // controller already did this synchronously at the moment of the identity change (round27 M-1);
  // repeating it here keeps every direct caller of the teardown — and its unit tests — whole.
  clearSessionScopedQueryCache();
  // Step 0b: best-effort, fire-and-forget — never awaited, never allowed to reject.
  void deactivateRegisteredPushDevice(context.authToken);
  usePurchaseFollowupStore.getState().resetAll();
  // NOTI-102: 알림 이력·중복 방지 키·시기 메타도 사용자 단위 상태이므로 함께 초기화한다.
  useNotificationStore.getState().resetAll();
  // Step 2: start the wipe BEFORE the first await so it registers in inFlightWipes
  // synchronously — see the ordering rationale in the doc comment above.
  const wipe = wipeOfflineStore(store);
  await clearSyncCursor(store);
  await wipe;
}
