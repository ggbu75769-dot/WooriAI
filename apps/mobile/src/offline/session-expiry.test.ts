import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { usePurchaseFollowupStore } from "../commerce/purchase-followup.store";
import {
  registerAppQueryClient,
  resetAppQueryClientRegistryForTests
} from "../query/query-client-registry";
import { secureSessionStorage } from "../stores/secure-session-storage";
import { useSessionStore, type SessionEndReason } from "../stores/session.store";
import { saveSyncCursor, SYNC_CURSOR_META_KEY } from "./delta-sync";
import { createMemoryOfflineStore } from "./memory-offline-store";
import { SESSION_EXPIRED_LOGIN_NOTICE } from "./messages";
import {
  isSessionExpiryTransition,
  LOGIN_HREF,
  shouldShowSessionExpiredNotice,
  type SessionCredentialState
} from "./session-expiry";
import { isSessionIdentityChange, teardownOfflineSessionState, type SessionIdentity } from "./session-teardown";
import { recordLocalCreate } from "./sync-engine";
import type { ExpensePayload, OfflineStore } from "./types";

/**
 * AUTH-127 — a session that ends because the server rejected the refresh token (30-day TTL, or a
 * reuse-detection revoke) is an INVOLUNTARY end, and must be handled differently from the
 * deliberate logout PRIV-104's teardown was written for:
 *
 *   - the unsynced offline outbox survives it (nobody asked to lose their records);
 *   - the app leaves whatever screen it was on for the login screen, so the logged-out preview
 *     fixtures can never be mistaken for the user's own data;
 *   - the login screen says what happened.
 *
 * ...while everything PRIV-104 exists for stays exactly as it was: an explicit logout still wipes,
 * and a login by a DIFFERENT account still wipes before that account touches the store.
 *
 * Follows session-teardown.test.ts's conventions (memory store, real policy functions, source
 * verification for the parts vitest cannot mount).
 */

const payload: ExpensePayload = {
  childId: "child-1",
  categoryId: "cat-diaper",
  amountKrw: 10_000,
  spentOn: "2026-07-01",
  itemName: "기저귀"
};

const mobileRoot = process.cwd();
const source = (relativePath: string) => readFileSync(join(mobileRoot, relativePath), "utf8");

/** The identity snapshot the teardown policy reads, taken off the live session store. */
function currentIdentity(): SessionIdentity {
  const { userId, isTestSession } = useSessionStore.getState();
  return { userId, isTestSession };
}

/** The credentials snapshot the expiry policy reads, taken off the live session store. */
function currentCredentials(): SessionCredentialState {
  const { accessToken, isTestSession, lastEndReason } = useSessionStore.getState();
  return { accessToken, isTestSession, lastEndReason };
}

/** Mirrors sync-controller.ts's teardown subscription: tear down exactly on an identity change. */
async function applySessionTransition(
  store: OfflineStore,
  previous: SessionIdentity,
  next: SessionIdentity
): Promise<boolean> {
  if (!isSessionIdentityChange(previous, next)) return false;
  await teardownOfflineSessionState(store);
  return true;
}

async function seedUnsyncedWork(store: OfflineStore): Promise<void> {
  await recordLocalCreate(store, payload);
  await saveSyncCursor(store, "user-a", "cursor-abc");
}

function loginAs(userId: string) {
  useSessionStore.getState().setSession({
    accessToken: `access-${userId}`,
    refreshToken: `refresh-${userId}`,
    userId,
    defaultHouseholdId: `household-${userId}`
  });
}

beforeEach(() => {
  usePurchaseFollowupStore.setState({ entries: [] });
  resetAppQueryClientRegistryForTests();
  useSessionStore.getState().clearSession();
});

describe("AUTH-127 clearSession reason branching", () => {
  it("defaults to a logout — the pre-AUTH-127 behavior every existing call site depends on", () => {
    loginAs("user-a");
    useSessionStore.getState().clearSession();

    expect(useSessionStore.getState()).toMatchObject({
      accessToken: null,
      refreshToken: null,
      userId: null,
      defaultHouseholdId: null,
      isTestSession: false,
      lastEndReason: "logout"
    });
  });

  it("an expiry drops the credentials but keeps the identity, so the offline store still belongs to someone", () => {
    loginAs("user-a");
    useSessionStore.getState().clearSession("expired");

    expect(useSessionStore.getState()).toMatchObject({
      accessToken: null,
      refreshToken: null,
      userId: "user-a",
      defaultHouseholdId: "household-user-a",
      lastEndReason: "expired"
    });
  });

  it("starting a session (real or demo) clears the reason, so the notice cannot outlive the problem", () => {
    loginAs("user-a");
    useSessionStore.getState().clearSession("expired");
    expect(useSessionStore.getState().lastEndReason).toBe("expired");

    loginAs("user-a");
    expect(useSessionStore.getState().lastEndReason).toBeNull();

    useSessionStore.getState().clearSession("expired");
    useSessionStore.getState().startTestSession();
    expect(useSessionStore.getState().lastEndReason).toBeNull();
  });
});

describe("AUTH-127 teardown branch: which session end wipes the outbox", () => {
  it("an expiry does NOT wipe — the identity never changed, so PRIV-104's teardown never fires", async () => {
    const store = createMemoryOfflineStore();
    await seedUnsyncedWork(store);
    loginAs("user-a");
    const before = currentIdentity();

    useSessionStore.getState().clearSession("expired");
    const toreDown = await applySessionTransition(store, before, currentIdentity());

    expect(toreDown).toBe(false);
    expect(await store.listLocalExpenses()).toHaveLength(1);
    expect(await store.listOutboxMutations()).toHaveLength(1);
    // The delta-sync cursor is still the same account's, so the next pull resumes instead of
    // re-walking the whole change stream.
    expect(await store.getMeta(SYNC_CURSOR_META_KEY)).not.toBeNull();
  });

  it("an explicit logout still wipes everything (PRIV-104 unchanged)", async () => {
    const store = createMemoryOfflineStore();
    await seedUnsyncedWork(store);
    loginAs("user-a");
    const before = currentIdentity();

    useSessionStore.getState().clearSession();
    const toreDown = await applySessionTransition(store, before, currentIdentity());

    expect(toreDown).toBe(true);
    expect(await store.listLocalExpenses()).toEqual([]);
    expect(await store.listOutboxMutations()).toEqual([]);
    expect(await store.getMeta(SYNC_CURSOR_META_KEY)).toBeNull();
  });
});

describe("AUTH-127 expiry → re-login", () => {
  it("the SAME user coming back resumes the outbox: no teardown at either step", async () => {
    const store = createMemoryOfflineStore();
    await seedUnsyncedWork(store);
    loginAs("user-a");

    // 1. The refresh 401 lands.
    const beforeExpiry = currentIdentity();
    useSessionStore.getState().clearSession("expired");
    const expiryToreDown = await applySessionTransition(store, beforeExpiry, currentIdentity());

    // 2. The user logs back in with the same account.
    const beforeLogin = currentIdentity();
    loginAs("user-a");
    const loginToreDown = await applySessionTransition(store, beforeLogin, currentIdentity());

    expect(expiryToreDown).toBe(false);
    expect(loginToreDown).toBe(false);
    // The record the user saved offline before the expiry is still queued, and the app now holds
    // a fresh token to flush it with.
    expect(await store.listOutboxMutations()).toHaveLength(1);
    expect((await store.listLocalExpenses())[0].payload.itemName).toBe("기저귀");
    expect(useSessionStore.getState().accessToken).toBe("access-user-a");
    expect(useSessionStore.getState().lastEndReason).toBeNull();
  });

  it("a DIFFERENT account logging in after an expiry still gets the full PRIV-104 teardown (no cross-account leak)", async () => {
    const client = new QueryClient();
    registerAppQueryClient(client);
    client.setQueryData(["children"], { children: [{ id: "child-of-user-a" }] });

    const store = createMemoryOfflineStore();
    await seedUnsyncedWork(store);
    usePurchaseFollowupStore.getState().recordLinkClick({
      itemTemplateId: "item-diaper",
      itemName: "기저귀",
      childId: "child-1",
      clickedAt: 1_700_000_000_000
    });
    loginAs("user-a");

    const beforeExpiry = currentIdentity();
    useSessionStore.getState().clearSession("expired");
    await applySessionTransition(store, beforeExpiry, currentIdentity());

    const beforeLogin = currentIdentity();
    loginAs("user-b");
    const loginToreDown = await applySessionTransition(store, beforeLogin, currentIdentity());

    expect(loginToreDown).toBe(true);
    expect(await store.listLocalExpenses()).toEqual([]);
    expect(await store.listOutboxMutations()).toEqual([]);
    expect(await store.getMeta(SYNC_CURSOR_META_KEY)).toBeNull();
    expect(usePurchaseFollowupStore.getState().entries).toEqual([]);
    // FIX-118A's react-query clear still happens before user B's screens can read user A's rows —
    // it is simply deferred from the expiry to the login, which is the moment B actually arrives.
    expect(client.getQueryData(["children"])).toBeUndefined();
  });

  it("switching to the demo/test session after an expiry still wipes (fixture rows never mix with a real account's)", async () => {
    const store = createMemoryOfflineStore();
    await seedUnsyncedWork(store);
    loginAs("user-a");
    useSessionStore.getState().clearSession("expired");

    const before = currentIdentity();
    useSessionStore.getState().startTestSession();

    expect(await applySessionTransition(store, before, currentIdentity())).toBe(true);
    expect(await store.listLocalExpenses()).toEqual([]);
  });
});

describe("AUTH-127 isSessionExpiryTransition (redirect edge trigger)", () => {
  const live: SessionCredentialState = { accessToken: "access", isTestSession: false, lastEndReason: null };
  const expired: SessionCredentialState = { accessToken: null, isTestSession: false, lastEndReason: "expired" };

  it("fires on the live → expired edge", () => {
    expect(isSessionExpiryTransition(live, expired)).toBe(true);
  });

  it("does NOT fire again while already expired — concurrent 401s all call clearSession('expired')", () => {
    expect(isSessionExpiryTransition(expired, expired)).toBe(false);
  });

  it("does not fire for an explicit logout, a token refresh, or a login", () => {
    const loggedOut: SessionCredentialState = { accessToken: null, isTestSession: false, lastEndReason: "logout" };
    expect(isSessionExpiryTransition(live, loggedOut)).toBe(false);
    expect(isSessionExpiryTransition(live, { ...live, accessToken: "rotated" })).toBe(false);
    expect(isSessionExpiryTransition(expired, { ...live, accessToken: "fresh" })).toBe(false);
  });

  it("never fires for the demo/test session (its calls short-circuit before the refresh flow)", () => {
    const demo: SessionCredentialState = { accessToken: null, isTestSession: true, lastEndReason: "expired" };
    expect(isSessionExpiryTransition(live, demo)).toBe(false);
  });

  it("drives the real store's transitions the way sync-controller's subscription does", () => {
    loginAs("user-a");
    const beforeExpiry = currentCredentials();
    useSessionStore.getState().clearSession("expired");
    const afterExpiry = currentCredentials();
    expect(isSessionExpiryTransition(beforeExpiry, afterExpiry)).toBe(true);

    // A second concurrent 401 handler calling clearSession("expired") must not re-navigate.
    useSessionStore.getState().clearSession("expired");
    expect(isSessionExpiryTransition(afterExpiry, currentCredentials())).toBe(false);
  });
});

describe("AUTH-127 login-screen notice", () => {
  it("shows only for an expiry, and only while logged out", () => {
    expect(shouldShowSessionExpiredNotice({ accessToken: null, isTestSession: false, lastEndReason: "expired" })).toBe(true);
    expect(shouldShowSessionExpiredNotice({ accessToken: null, isTestSession: false, lastEndReason: "logout" })).toBe(false);
    expect(shouldShowSessionExpiredNotice({ accessToken: null, isTestSession: false, lastEndReason: null })).toBe(false);
    // A live session (or the demo session) never shows it, whatever the stale reason says.
    expect(shouldShowSessionExpiredNotice({ accessToken: "access", isTestSession: false, lastEndReason: "expired" })).toBe(false);
    expect(shouldShowSessionExpiredNotice({ accessToken: null, isTestSession: true, lastEndReason: "expired" })).toBe(false);
  });

  it("survives an app restart: the reason is persisted state, not a one-shot event", () => {
    loginAs("user-a");
    useSessionStore.getState().clearSession("expired");
    // Exactly what a cold start reads back out of the store.
    expect(shouldShowSessionExpiredNotice(currentCredentials())).toBe(true);

    loginAs("user-a");
    expect(shouldShowSessionExpiredNotice(currentCredentials())).toBe(false);
  });

  it("promises only what the outbox policy actually delivers", () => {
    expect(SESSION_EXPIRED_LOGIN_NOTICE).toContain("세션이 만료됐어요");
    expect(SESSION_EXPIRED_LOGIN_NOTICE).toContain("저장하지 않은 기록도 이어서 반영할게요");
  });
});

describe("AUTH-127 persisted lastEndReason is sanitized on rehydration", () => {
  async function rehydrateWith(lastEndReason: unknown): Promise<SessionEndReason | null> {
    // Start from the store's own default, exactly like a cold start does -- zustand's merge is
    // `{...current, ...persisted}`, so `current` at rehydration time is the initial state.
    useSessionStore.setState({ lastEndReason: null });
    await secureSessionStorage.setItem(
      "wooriai-session",
      JSON.stringify({
        state: {
          accessToken: null,
          refreshToken: null,
          userId: "user-a",
          defaultHouseholdId: null,
          isTestSession: false,
          lastEndReason
        },
        version: 2
      })
    );
    await useSessionStore.persist.rehydrate();
    return useSessionStore.getState().lastEndReason;
  }

  it("collapses an unknown reason to null instead of claiming an expiry", async () => {
    // A future build's new reason, a truncated write, hand-edited storage.
    for (const bogus of [null, "", "revoked", 42, { reason: "expired" }]) {
      expect(await rehydrateWith(bogus)).toBeNull();
    }
  });

  it("falls back to null for a blob written before the field existed (JSON drops an undefined key)", async () => {
    expect(await rehydrateWith(undefined)).toBeNull();
  });

  it("round-trips the two real reasons, so an expiry survives an app restart", async () => {
    expect(await rehydrateWith("logout")).toBe("logout");
    expect(await rehydrateWith("expired")).toBe("expired");
    expect(shouldShowSessionExpiredNotice(currentCredentials())).toBe(true);
  });
});

describe("AUTH-127 wiring (source verification — client.ts's transports, the router redirect, and the two screens are not runtime-mountable under vitest)", () => {
  it("every refresh-401 branch in client.ts ends the session as an expiry, and none of them logs out", () => {
    const clientSource = source("src/api/client.ts");
    expect(clientSource).toContain('useSessionStore.getState().clearSession("expired");');
    // All three transports (requestJson / requestMultipartJson / requestExpenseJson) funnel
    // through the one helper -- the count pins that none of them grew a private path back.
    expect(clientSource.match(/endSessionAsExpired\(\);/g) ?? []).toHaveLength(3);
    // A bare clearSession() call anywhere in client.ts would be the old data-destroying path.
    expect(clientSource).not.toContain("getState().clearSession();");
  });

  it("sync-controller redirects to the login screen on the expiry edge, from the same root-mounted hook as the teardown subscription", () => {
    const controllerSource = source("src/offline/sync-controller.ts");
    expect(controllerSource).toContain('import { isSessionExpiryTransition, LOGIN_HREF } from "./session-expiry";');
    expect(controllerSource).toContain("if (!isSessionExpiryTransition(previous, state)) return;");
    expect(controllerSource).toContain("router.replace(LOGIN_HREF);");
    // Both subscriptions live inside useOfflineSyncLifecycle, which app/_layout.tsx mounts once.
    const hookBody = controllerSource.slice(controllerSource.indexOf("export function useOfflineSyncLifecycle"));
    expect(hookBody).toContain("isSessionExpiryTransition");
    expect(hookBody).toContain("isSessionIdentityChange(previous, state)");
    expect(source("app/_layout.tsx")).toContain("useOfflineSyncLifecycle(token, client);");
  });

  it("the login href points at the real login route", () => {
    expect(LOGIN_HREF).toBe("/login");
    // app/(auth)/login.tsx is the route behind it -- the same href launch-animation already uses.
    expect(source("app/launch-animation.tsx")).toContain('router.replace("/login")');
  });

  it("the login screen renders the notice, gated by the shared policy", () => {
    const loginSource = source("app/(auth)/login.tsx");
    expect(loginSource).toContain('import { SESSION_EXPIRED_LOGIN_NOTICE } from "../../src/offline/messages";');
    expect(loginSource).toContain('import { shouldShowSessionExpiredNotice } from "../../src/offline/session-expiry";');
    expect(loginSource).toContain("shouldShowSessionExpiredNotice({");
    expect(loginSource).toContain("{showExpiredNotice ? (");
    expect(loginSource).toContain("{SESSION_EXPIRED_LOGIN_NOTICE}");
    // A11Y-115 관례: 화면에 뜬 안내는 스크린리더로도 한 번 읽힌다.
    expect(loginSource).toContain("announceForA11y(SESSION_EXPIRED_LOGIN_NOTICE)");
  });

  it("a cold start after an expiry goes straight to login instead of replaying the splash", () => {
    const indexSource = source("app/index.tsx");
    expect(indexSource).toContain('import { shouldShowSessionExpiredNotice } from "../src/offline/session-expiry";');
    // 로그아웃/첫 실행은 예전 그대로 스플래시 -- 만료일 때만 목적지가 갈린다.
    expect(indexSource).toContain('? "/login" : "/launch-animation"');
    expect(indexSource).toContain("shouldShowSessionExpiredNotice({ accessToken, isTestSession, lastEndReason })");
  });
});
