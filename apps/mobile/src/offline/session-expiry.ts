import type { SessionEndReason } from "../stores/session.store";

/**
 * AUTH-127 — policy for an INVOLUNTARY session end (refresh rejected with 401: the 30-day refresh
 * TTL elapsed, or the token family was revoked by the server's reuse detection).
 *
 * Two things used to go wrong at that moment, both silent:
 *
 *   1. **No navigation.** src/api/client.ts merely called `clearSession()`. The user stayed on
 *      whichever screen they were on, and every screen's `Boolean(authToken && childId)` gate had
 *      just flipped false — so Home/준비템/리포트 fell back to their logged-out *preview fixtures*
 *      (다온이, 1,245,700원) and rendered them as if they were the user's own data. Nothing said
 *      the session had ended.
 *   2. **Data loss.** `clearSession()` nulled `userId`, which PRIV-104's
 *      `isSessionIdentityChange` reads as "a different account is taking over this device" and
 *      answers by wiping local_expenses / mutation_outbox / sync_meta. That wipe is *correct* for
 *      the case it was written for — a deliberate logout, after which no token exists to flush the
 *      queue with ever again — but an expiry is not that case: the same person is still holding
 *      the same phone and is about to log back in.
 *
 * ## The teardown boundary chosen for "expired", and why
 *
 * `clearSession("expired")` drops the credentials and *keeps* the identity fields
 * (`userId`/`defaultHouseholdId` — see src/stores/session.store.ts). That single decision settles
 * the whole boundary, because every teardown step already hangs off `isSessionIdentityChange`:
 *
 *   - **outbox / local_expenses / sync_meta: KEPT.** The identity did not change, so
 *     `teardownOfflineSessionState` never runs. Unsynced records survive the expiry, and the
 *     delta-sync cursor stays valid for the account it belongs to.
 *   - **react-query cache: KEPT.** FIX-118A clears it so an *incoming* account cannot read the
 *     outgoing one's `["children"]`/`["my-devices"]` rows. After an expiry there is no incoming
 *     account: the app is on the login screen, no screen is mounted against a token, and the only
 *     way to get back in is a login — which either re-establishes the SAME user (cache is
 *     correctly warm, exactly like the same-user token refresh FIX-118A already exempts) or is an
 *     A → B identity change that clears the cache on the way in. So the leak FIX-118A closes
 *     stays closed.
 *
 *     What that A → B clear actually guarantees (round27 M-1 corrected the claim that used to
 *     stand here): sync-controller.ts's identity-change subscription calls
 *     `clearSessionScopedQueryCache()` *synchronously*, inside the notification `setSession`
 *     itself emits — so it completes before React can flush the re-render that same `set` just
 *     scheduled for B's screens. The rest of the teardown (the SQLite wipe, the cursor, the
 *     purchase-followup reset) stays asynchronous behind `getOfflineStore()` and may well land
 *     after B's first paint; none of it is read by a react-query render path, which is exactly
 *     why the cache clear — and only the cache clear — is pulled out in front of the awaits.
 *     The earlier wording claimed the whole teardown beat B's render; it could not, because it
 *     begins with a promise hop.
 *   - **push device deactivation: NOT attempted.** Same reason plus a practical one: it is a
 *     network call authenticated with the OUTGOING access token, and after an expiry that token is
 *     precisely what the server has stopped accepting — the call could only 401. (This is not a
 *     regression: pre-AUTH-127 the teardown did fire here, and it fired with the same dead token,
 *     so it failed and was swallowed then too.) The device row is turned off by the ordinary
 *     logout path, and a later A → B login still resets the local registration.
 *
 * A login by a DIFFERENT account after an expiry is still `userId` A → B, still an identity
 * change, and still gets the unchanged PRIV-104 teardown. Nothing about cross-account isolation
 * moves here.
 */

/** The session-store fields this policy reads: the *credentials* half, plus why they ended. */
export type SessionCredentialState = {
  accessToken: string | null;
  isTestSession: boolean;
  lastEndReason: SessionEndReason | null;
};

/** Where an expired session is sent. `/login` resolves to app/(auth)/login.tsx — the same href
 * app/launch-animation.tsx already navigates to, so the route group stays an implementation
 * detail. */
export const LOGIN_HREF = "/login";

/**
 * True exactly on the edge where a live session becomes an expired one, so the redirect fires
 * once. Deliberately edge-triggered on `lastEndReason`: concurrent 401s all await the same
 * single-flight refresh and therefore all call `clearSession("expired")`, and a store that is
 * already in the expired state must not re-navigate on the 2nd..nth of them (that would stomp on
 * a login the user has meanwhile started).
 *
 * A demo/test session can never reach this: `isLocalToken` short-circuits the refresh flow before
 * any 401 handling, so `lastEndReason` is never set to "expired" for one. The explicit
 * `isTestSession` guard keeps that true even if a future call site forgets.
 */
export function isSessionExpiryTransition(
  previous: SessionCredentialState,
  next: SessionCredentialState
): boolean {
  return (
    next.lastEndReason === "expired" &&
    previous.lastEndReason !== "expired" &&
    next.accessToken === null &&
    !next.isTestSession
  );
}

/**
 * True while the login screen should explain why the user is looking at it. Reads the *current*
 * state (not a transition) because the reason is persisted: an expiry that happened while the app
 * was backgrounded, or was killed before the redirect ran, still owes the user the explanation on
 * the next cold start. `setSession`/`startTestSession` clear the reason, so the notice disappears
 * the moment a session exists again.
 */
export function shouldShowSessionExpiredNotice(state: SessionCredentialState): boolean {
  return state.lastEndReason === "expired" && state.accessToken === null && !state.isTestSession;
}
