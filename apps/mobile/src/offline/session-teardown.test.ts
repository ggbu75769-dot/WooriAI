import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { usePurchaseFollowupStore } from "../commerce/purchase-followup.store";
import { useFirstRecordCelebrationStore } from "../home/first-record-celebration";
import { useHomeFirstRunGuideStore } from "../home/first-run-guide.store";
import {
  deactivateRegisteredPushDevice,
  resetPushRegistrationForTests,
  usePushRegistrationStore
} from "../notifications/usePushDeviceRegistration";
import {
  registerAppQueryClient,
  resetAppQueryClientRegistryForTests
} from "../query/query-client-registry";
import { secureSessionStorage } from "../stores/secure-session-storage";
import { saveSyncCursor, SYNC_CURSOR_META_KEY } from "./delta-sync";
import { createMemoryOfflineStore } from "./memory-offline-store";
import {
  clearSessionScopedQueryCache,
  isSessionIdentityChange,
  subscribeToHydratedSessionTransitions,
  teardownOfflineSessionState,
  type SessionIdentity
} from "./session-teardown";
import {
  flushOutbox,
  recordLocalCreate,
  recordLocalItemStatus,
  wipeOfflineStore,
  type RemoteExpenseApi
} from "./sync-engine";
import { useSessionStore } from "../stores/session.store";
import type { ExpensePayload, OfflineStore } from "./types";

/**
 * PRIV-104 — on logout / account switch / demo toggle, ALL device-local user-scoped offline
 * state (local_expenses, mutation_outbox, sync_meta, purchase-followup store) must be wiped
 * before the next session uses it; a same-user token refresh must NOT wipe. Follows
 * delta-sync.test.ts's conventions: memory store, fake session states, source verification for
 * the non-runtime-testable wiring.
 */

const payload: ExpensePayload = {
  childId: "child-1",
  categoryId: "cat-diaper",
  amountKrw: 10_000,
  spentOn: "2026-07-01",
  itemName: "기저귀"
};

/** Fake session-store snapshots (only the identity fields the teardown policy reads). */
const loggedOut: SessionIdentity = { userId: null, isTestSession: false };
const userA: SessionIdentity = { userId: "user-a", isTestSession: false };
const userB: SessionIdentity = { userId: "user-b", isTestSession: false };
const demoSession: SessionIdentity = { userId: null, isTestSession: true };

/** Seeds one offline expense (which also queues its create mutation), a persisted sync cursor,
 * and a purchase-followup click — one item of every user-scoped state PRIV-104 must clear. */
async function seedUserScopedState(store: OfflineStore): Promise<void> {
  await recordLocalCreate(store, payload);
  // 라운드 51 C-10: 준비템 상태 변경도 계정 단위 오프라인 상태다 -- 다음 계정의 토큰으로 이전
  // 계정이 눌러 둔 준비 상태가 나가면 안 된다.
  await recordLocalItemStatus(store, {
    childId: "child-1",
    itemTemplateId: "item-carseat",
    status: "prepared",
    itemName: "카시트"
  });
  await saveSyncCursor(store, "user-a", "cursor-abc");
  usePurchaseFollowupStore.getState().recordLinkClick({
    itemTemplateId: "item-diaper",
    itemName: "기저귀",
    childId: "child-1",
    clickedAt: 1_700_000_000_000
  });
  // 라운드 35 F5: 홈 첫 실행 상태 둘도 아이 id로 키가 잡힌 사용자 단위 상태다.
  useHomeFirstRunGuideStore.getState().dismissItemsGuide("child-1");
  useFirstRecordCelebrationStore.getState().observe("child-1", false);
  useFirstRecordCelebrationStore.getState().observe("child-1", true);
}

async function expectStoreFullyEmpty(store: OfflineStore): Promise<void> {
  expect(await store.listLocalExpenses()).toEqual([]);
  expect(await store.listOutboxMutations()).toEqual([]);
  expect(await store.listItemStatusMutations()).toEqual([]);
  expect(await store.getMeta(SYNC_CURSOR_META_KEY)).toBeNull();
}

/** Mirrors the sync-controller.ts subscription body: tear down exactly when the identity
 * changed. Lets tests drive fake session-state transitions through the real policy. */
async function simulateSessionTransition(
  store: OfflineStore,
  previous: SessionIdentity,
  next: SessionIdentity
): Promise<void> {
  if (isSessionIdentityChange(previous, next)) {
    await teardownOfflineSessionState(store);
  }
}

beforeEach(() => {
  usePurchaseFollowupStore.setState({ entries: [] });
  useHomeFirstRunGuideStore.getState().reset();
  useFirstRecordCelebrationStore.getState().reset();
});

// ---------------------------------------------------------------------------
// AUTH-127 round27 H-1 / M-1 — the controller's identity-change subscription itself: when it is
// allowed to observe a transition, and what it must do synchronously when it does.
// ---------------------------------------------------------------------------

/** The three session-store fields sync-controller.ts's teardown subscription reads. */
type SessionSnapshot = SessionIdentity & { accessToken: string | null };

const loggedOutSnapshot: SessionSnapshot = { userId: null, isTestSession: false, accessToken: null };
const userASnapshot: SessionSnapshot = { userId: "user-a", isTestSession: false, accessToken: "access-a" };
/** What AUTH-127's `clearSession("expired")` leaves behind: identity kept, credentials gone. */
const expiredUserASnapshot: SessionSnapshot = { userId: "user-a", isTestSession: false, accessToken: null };
const userBSnapshot: SessionSnapshot = { userId: "user-b", isTestSession: false, accessToken: "access-b" };
const demoSnapshot: SessionSnapshot = { userId: null, isTestSession: true, accessToken: null };

/**
 * Stand-in for the persisted session store, reproducing the two zustand-persist behaviors H-1
 * turns on (verified against zustand 5's persist middleware, and against the real store in the
 * "real persisted session store" describe below):
 *
 *   - hydration ends with an ordinary replace-set, so every `subscribe` listener is notified with
 *     the PRE-hydration (initial) state as `previous`;
 *   - `hasHydrated()` is false for the whole duration of a hydration pass and flips true — with
 *     the finish-hydration listeners firing — only after that set.
 */
function createFakePersistedSessionStore(initial: SessionSnapshot) {
  let state = initial;
  let hydrated = false;
  const listeners = new Set<(next: SessionSnapshot, previous: SessionSnapshot) => void>();
  const finishHydrationListeners = new Set<() => void>();

  const emit = (next: SessionSnapshot) => {
    const previous = state;
    state = next;
    for (const listener of [...listeners]) listener(state, previous);
  };

  return {
    store: {
      subscribe(listener: (next: SessionSnapshot, previous: SessionSnapshot) => void) {
        listeners.add(listener);
        return () => {
          listeners.delete(listener);
        };
      },
      persist: {
        hasHydrated: () => hydrated,
        onFinishHydration(listener: () => void) {
          finishHydrationListeners.add(listener);
          return () => {
            finishHydrationListeners.delete(listener);
          };
        }
      }
    },
    /** One hydration pass, in zustand's order. */
    rehydrateAs(next: SessionSnapshot) {
      hydrated = false;
      emit(next);
      hydrated = true;
      for (const listener of [...finishHydrationListeners]) listener();
    },
    /** An ordinary store write: setSession / clearSession / setTokens / startTestSession. */
    write(next: SessionSnapshot) {
      emit(next);
    },
    listenerCount: () => listeners.size
  };
}

/**
 * Mirrors sync-controller.ts's teardown subscription verbatim — the hydration-guarded subscribe,
 * the synchronous query-cache clear, and the offline-store teardown behind a promise hop (the
 * controller's `getOfflineStore()`). Lets these tests drive the real policy end to end; the
 * controller stays glue and is pinned separately by source verification.
 */
function mountControllerTeardownSubscription(
  fake: ReturnType<typeof createFakePersistedSessionStore>,
  store: OfflineStore
) {
  const order: string[] = [];
  const pending: Array<Promise<void>> = [];
  const unsubscribe = subscribeToHydratedSessionTransitions(fake.store, (state, previous) => {
    if (!isSessionIdentityChange(previous, state)) return;
    clearSessionScopedQueryCache();
    order.push("query-cache-cleared");
    pending.push(
      Promise.resolve(store).then(async (resolved) => {
        order.push("offline-store-torn-down");
        await teardownOfflineSessionState(resolved, { authToken: previous.accessToken });
      })
    );
  });
  return {
    unsubscribe,
    order,
    settle: async () => {
      await Promise.all(pending);
    }
  };
}

describe("AUTH-127 (round27 H-1) a persist rehydration is not a session transition", () => {
  it("the rehydration notification really does read as a login to the identity policy (the hazard the guard exists for)", () => {
    const fake = createFakePersistedSessionStore(loggedOutSnapshot);
    const seen: boolean[] = [];
    fake.store.subscribe((state, previous) => {
      seen.push(isSessionIdentityChange(previous, state));
    });

    fake.rehydrateAs(expiredUserASnapshot);

    // An unguarded subscriber sees userId null -> "user-a" and calls that an account arriving.
    expect(seen).toEqual([true]);
  });

  it("a cold start after an expiry keeps the outbox that expiry deliberately preserved", async () => {
    const store = createMemoryOfflineStore();
    await seedUserScopedState(store);

    // App start: the store still holds its initial state because the storage read is async, and
    // the controller mounts inside that window.
    const fake = createFakePersistedSessionStore(loggedOutSnapshot);
    const wiring = mountControllerTeardownSubscription(fake, store);

    // The persisted blob the expiry left behind comes back.
    fake.rehydrateAs(expiredUserASnapshot);
    await wiring.settle();

    expect(wiring.order).toEqual([]);
    expect(await store.listLocalExpenses()).toHaveLength(1);
    expect(await store.listOutboxMutations()).toHaveLength(1);
    expect(await store.getMeta(SYNC_CURSOR_META_KEY)).not.toBeNull();
    expect(usePurchaseFollowupStore.getState().entries).toHaveLength(1);

    // ...and nothing was traded away: the very next real account switch still wipes.
    fake.write(userBSnapshot);
    await wiring.settle();

    await expectStoreFullyEmpty(store);
    expect(usePurchaseFollowupStore.getState().entries).toEqual([]);
    wiring.unsubscribe();
  });

  /** Cold start restoring `restored`, then one real transition to `next`. True = it wiped. */
  async function wipesAfterHydration(restored: SessionSnapshot, next: SessionSnapshot): Promise<boolean> {
    const store = createMemoryOfflineStore();
    await seedUserScopedState(store);
    const fake = createFakePersistedSessionStore(loggedOutSnapshot);
    const wiring = mountControllerTeardownSubscription(fake, store);

    fake.rehydrateAs(restored);
    await wiring.settle();
    fake.write(next);
    await wiring.settle();
    wiring.unsubscribe();

    return (await store.listOutboxMutations()).length === 0;
  }

  it("every real transition after hydration still wipes, exactly as before the guard", async () => {
    // Explicit logout, A -> B switch, demo toggle.
    expect(await wipesAfterHydration(userASnapshot, loggedOutSnapshot)).toBe(true);
    expect(await wipesAfterHydration(userASnapshot, userBSnapshot)).toBe(true);
    expect(await wipesAfterHydration(userASnapshot, demoSnapshot)).toBe(true);
    // ...including the login that follows a cold start into a logged-out state.
    expect(await wipesAfterHydration(loggedOutSnapshot, userBSnapshot)).toBe(true);
  });

  it("a token refresh and a same-user re-login after hydration still keep the outbox", async () => {
    expect(await wipesAfterHydration(userASnapshot, { ...userASnapshot, accessToken: "rotated" })).toBe(false);
    // The AUTH-127 loop in full: cold start into the expired session, then the same user back in.
    expect(await wipesAfterHydration(expiredUserASnapshot, userASnapshot)).toBe(false);
  });

  it("a later hydration pass is ignored too — persist.rehydrate() re-opens the identical hole", async () => {
    const store = createMemoryOfflineStore();
    await seedUserScopedState(store);
    const fake = createFakePersistedSessionStore(loggedOutSnapshot);
    const wiring = mountControllerTeardownSubscription(fake, store);

    fake.rehydrateAs(expiredUserASnapshot);
    await wiring.settle();
    // Any notification emitted while a hydration pass is running is state being restored, not a
    // session changing -- whatever the two userIds happen to be.
    fake.rehydrateAs(userBSnapshot);
    await wiring.settle();

    expect(wiring.order).toEqual([]);
    expect(await store.listOutboxMutations()).toHaveLength(1);
    wiring.unsubscribe();
  });

  it("unmounting before hydration finishes never leaves a subscription behind", () => {
    const fake = createFakePersistedSessionStore(loggedOutSnapshot);
    const wiring = mountControllerTeardownSubscription(fake, createMemoryOfflineStore());

    // Nothing is subscribed while the store is still un-hydrated.
    expect(fake.listenerCount()).toBe(0);

    wiring.unsubscribe();
    fake.rehydrateAs(userASnapshot);
    fake.write(userBSnapshot);

    expect(fake.listenerCount()).toBe(0);
    expect(wiring.order).toEqual([]);
  });

  it("sync-controller wires the teardown through the hydration guard, not a raw subscription (source verification -- the controller is not runtime-testable under vitest)", () => {
    const controllerSource = readFileSync(join(process.cwd(), "src/offline/sync-controller.ts"), "utf8");
    expect(controllerSource).toContain(
      "subscribeToHydratedSessionTransitions(useSessionStore, (state, previous) => {"
    );
    // Exactly one raw subscription is left: the AUTH-127 expiry redirect, which is edge-triggered
    // on lastEndReason and deliberately not gated (a cold start into an expired session does
    // belong on the login screen).
    expect(controllerSource.match(/useSessionStore\.subscribe\(/g) ?? []).toHaveLength(1);
  });
});

describe("AUTH-127 (round27 H-1) against the real persisted session store", () => {
  it("a real persist.rehydrate() notifies raw subscribers but never the guarded listener, and real transitions still land", async () => {
    const rawTransitions: Array<[string | null, string | null]> = [];
    const guardedTransitions: Array<[string | null, string | null]> = [];

    // The pre-hydration state zustand hands the subscription as `previous` on a cold start.
    useSessionStore.setState({
      accessToken: null,
      refreshToken: null,
      userId: null,
      defaultHouseholdId: null,
      isTestSession: false,
      lastEndReason: null
    });
    await secureSessionStorage.setItem(
      "wooriai-session",
      JSON.stringify({
        state: {
          accessToken: null,
          refreshToken: null,
          userId: "user-a",
          defaultHouseholdId: "household-a",
          isTestSession: false,
          lastEndReason: "expired"
        },
        version: 2
      })
    );

    const unsubscribeRaw = useSessionStore.subscribe((state, previous) => {
      rawTransitions.push([previous.userId, state.userId]);
    });
    const unsubscribeGuarded = subscribeToHydratedSessionTransitions(useSessionStore, (state, previous) => {
      if (isSessionIdentityChange(previous, state)) guardedTransitions.push([previous.userId, state.userId]);
    });

    await useSessionStore.persist.rehydrate();

    // The hazard, live: the raw subscriber is told about a null -> "user-a" transition...
    expect(rawTransitions).toEqual([[null, "user-a"]]);
    // ...and the teardown listener is not.
    expect(guardedTransitions).toEqual([]);
    expect(useSessionStore.getState().userId).toBe("user-a");

    // A genuine A -> B login afterwards is delivered exactly as it always was.
    useSessionStore.getState().setSession({
      accessToken: "access-b",
      refreshToken: "refresh-b",
      userId: "user-b"
    });
    expect(guardedTransitions).toEqual([["user-a", "user-b"]]);

    unsubscribeRaw();
    unsubscribeGuarded();
    useSessionStore.getState().clearSession();
  });
});

describe("AUTH-127 (round27 M-1) the query-cache clear runs ahead of the async store teardown", () => {
  beforeEach(() => {
    resetAppQueryClientRegistryForTests();
  });

  afterEach(() => {
    resetAppQueryClientRegistryForTests();
  });

  it("clearSessionScopedQueryCache empties a registered client synchronously (the contract the ordering rests on)", () => {
    const client = new QueryClient();
    registerAppQueryClient(client);
    client.setQueryData(["children"], { children: [{ id: "child-of-user-a" }] });

    // No await: the function is synchronous by contract, and the assertion below runs in the
    // same tick as the call.
    clearSessionScopedQueryCache();

    expect(client.getQueryCache().getAll()).toEqual([]);
  });

  it("is a no-op before app/_layout.tsx registers a client", () => {
    expect(() => clearSessionScopedQueryCache()).not.toThrow();
  });

  it("an A -> B switch clears the cache in the same tick as the session write, while the store teardown is still parked behind its promise hop", async () => {
    const client = new QueryClient();
    registerAppQueryClient(client);
    client.setQueryData(["children"], { children: [{ id: "child-of-user-a" }] });
    const store = createMemoryOfflineStore();
    await seedUserScopedState(store);

    const fake = createFakePersistedSessionStore(loggedOutSnapshot);
    const wiring = mountControllerTeardownSubscription(fake, store);
    fake.rehydrateAs(userASnapshot);
    await wiring.settle();

    // The setSession that admits B. Nothing is awaited between here and the assertions.
    fake.write(userBSnapshot);

    // Cache already empty; the offline-store teardown has not even started (its marker is pushed
    // from the `then` callback, still queued).
    expect(client.getQueryCache().getAll()).toEqual([]);
    expect(wiring.order).toEqual(["query-cache-cleared"]);
    // Limitation, stated plainly: vitest mounts no navigator and no screens, so what is pinned
    // here is "the clear completes in the same tick as the store notification, ahead of the
    // async teardown" -- not the React commit itself. That tick is the one in which the store's
    // `set` schedules B's re-render, which is what puts the clear on the right side of the
    // boundary.

    await wiring.settle();

    expect(wiring.order).toEqual(["query-cache-cleared", "offline-store-torn-down"]);
    await expectStoreFullyEmpty(store);
    wiring.unsubscribe();
  });

  it("sync-controller clears the cache from the subscription body, before the promise hop (source verification)", () => {
    const controllerSource = readFileSync(join(process.cwd(), "src/offline/sync-controller.ts"), "utf8");
    const body = controllerSource.slice(
      controllerSource.indexOf("subscribeToHydratedSessionTransitions(useSessionStore")
    );
    const clearAt = body.indexOf("clearSessionScopedQueryCache();");
    const storeAt = body.indexOf("void getOfflineStore()");
    expect(clearAt).toBeGreaterThan(-1);
    expect(storeAt).toBeGreaterThan(-1);
    expect(clearAt).toBeLessThan(storeAt);
    // Nothing may yield between the session-store notification and the clear.
    expect(body.slice(0, clearAt)).not.toContain("await ");
    expect(body.slice(0, clearAt)).not.toContain(".then(");
  });
});

describe("PRIV-104 OfflineStore.clearAll", () => {
  it("wipes local_expenses, mutation_outbox, and the whole sync_meta area", async () => {
    const store = createMemoryOfflineStore();
    await recordLocalCreate(store, payload);
    await recordLocalCreate(store, { ...payload, itemName: "물티슈" });
    await store.setMeta("some-other-meta", "value");
    await saveSyncCursor(store, "user-a", "cursor-abc");
    expect(await store.listLocalExpenses()).toHaveLength(2);
    expect(await store.listOutboxMutations()).toHaveLength(2);

    await store.clearAll();

    await expectStoreFullyEmpty(store);
    expect(await store.getMeta("some-other-meta")).toBeNull();
  });

  it("leaves the store usable for the next session (insert after clearAll works)", async () => {
    const store = createMemoryOfflineStore();
    await recordLocalCreate(store, payload);
    await store.clearAll();

    const row = await recordLocalCreate(store, { ...payload, childId: "child-of-user-b" });
    expect(await store.getLocalExpense(row.localId)).not.toBeNull();
    expect(await store.listOutboxMutations()).toHaveLength(1);
  });

  it("sqlite implementation deletes all three tables in one transaction (source verification -- vitest cannot run native SQLite, see sqlite-offline-store.ts's header)", () => {
    const source = readFileSync(join(process.cwd(), "src/offline/sqlite-offline-store.ts"), "utf8");
    const clearAllBody = source.slice(source.indexOf("async clearAll()"));
    const transactionBlock = clearAllBody.slice(0, clearAllBody.indexOf("COMMIT;"));
    expect(transactionBlock).toContain("BEGIN;");
    expect(transactionBlock).toContain("DELETE FROM local_expenses;");
    expect(transactionBlock).toContain("DELETE FROM mutation_outbox;");
    // 라운드 51 C-10: 준비템 상태 큐도 같은 트랜잭션 안이다(네 테이블).
    expect(transactionBlock).toContain("DELETE FROM item_status_outbox;");
    expect(transactionBlock).toContain("DELETE FROM sync_meta;");
  });
});

describe("PRIV-104 isSessionIdentityChange policy", () => {
  it("does NOT wipe on a same-user token refresh (identity fields unchanged)", () => {
    // setTokens only touches accessToken/refreshToken -- the identity snapshot is identical.
    expect(isSessionIdentityChange(userA, { ...userA })).toBe(false);
  });

  it("does NOT wipe when the same user re-establishes their session (userId unchanged)", () => {
    expect(isSessionIdentityChange(userA, { userId: "user-a", isTestSession: false })).toBe(false);
    expect(isSessionIdentityChange(loggedOut, { ...loggedOut })).toBe(false);
  });

  it("wipes on an A -> B account switch", () => {
    expect(isSessionIdentityChange(userA, userB)).toBe(true);
  });

  it("wipes on explicit logout (clearSession sets userId to null)", () => {
    expect(isSessionIdentityChange(userA, loggedOut)).toBe(true);
  });

  it("wipes on the null -> new-user transition (belt-and-braces half of the between-accounts wipe)", () => {
    expect(isSessionIdentityChange(loggedOut, userB)).toBe(true);
  });

  it("wipes when the demo/test session toggles, in both directions", () => {
    expect(isSessionIdentityChange(loggedOut, demoSession)).toBe(true);
    expect(isSessionIdentityChange(demoSession, loggedOut)).toBe(true);
    expect(isSessionIdentityChange(demoSession, userA)).toBe(true);
  });

  it("clearSession really does null the userId on an explicit logout (the premise the logout wipe keys on)", () => {
    // AUTH-127 replaced the old source-grep with the real thing: the store is plain zustand and
    // loads fine under vitest, so drive it instead of pattern-matching its source.
    useSessionStore.setState({
      accessToken: "access",
      refreshToken: "refresh",
      userId: "user-a",
      defaultHouseholdId: "household-a",
      isTestSession: false,
      lastEndReason: null
    });

    // No argument = the pre-AUTH-127 meaning, which every existing call site relies on.
    useSessionStore.getState().clearSession();

    const state = useSessionStore.getState();
    expect(state.userId).toBeNull();
    expect(state.defaultHouseholdId).toBeNull();
    expect(state.isTestSession).toBe(false);
    expect(state.accessToken).toBeNull();
    expect(state.refreshToken).toBeNull();
    expect(state.lastEndReason).toBe("logout");
  });
});

describe("PRIV-104 teardownOfflineSessionState", () => {
  it("logout wipes all three tables, the sync cursor, and the purchase-followup store", async () => {
    const store = createMemoryOfflineStore();
    await seedUserScopedState(store);
    expect(usePurchaseFollowupStore.getState().entries).toHaveLength(1);

    await simulateSessionTransition(store, userA, loggedOut);

    await expectStoreFullyEmpty(store);
    expect(usePurchaseFollowupStore.getState().entries).toEqual([]);
  });

  it("an A -> B account switch wipes A's state before B's session uses the store", async () => {
    const store = createMemoryOfflineStore();
    await seedUserScopedState(store);

    await simulateSessionTransition(store, userA, userB);

    await expectStoreFullyEmpty(store);
    expect(usePurchaseFollowupStore.getState().entries).toEqual([]);
  });

  it("a demo/test session toggle wipes (fixture rows and real-account rows never mix)", async () => {
    const store = createMemoryOfflineStore();
    await seedUserScopedState(store);

    await simulateSessionTransition(store, userA, demoSession);

    await expectStoreFullyEmpty(store);
  });

  it("a same-user token refresh does NOT wipe pending offline data", async () => {
    const store = createMemoryOfflineStore();
    await seedUserScopedState(store);

    await simulateSessionTransition(store, userA, { ...userA });

    expect(await store.listLocalExpenses()).toHaveLength(1);
    expect(await store.listOutboxMutations()).toHaveLength(1);
    expect(await store.getMeta(SYNC_CURSOR_META_KEY)).not.toBeNull();
    expect(usePurchaseFollowupStore.getState().entries).toHaveLength(1);
    // 라운드 35 F5: 같은 사용자의 토큰 갱신에는 홈 첫 실행 상태도 그대로 남는다 -- 지우면
    // 이미 닫은 준비템 안내가 다시 뜨고, 첫 기록 축하가 한 번 더 뜬다.
    expect(useHomeFirstRunGuideStore.getState().dismissedItemsGuideChildIds).toEqual(["child-1"]);
    expect(useFirstRecordCelebrationStore.getState().celebratedChildIds).toEqual({ "child-1": true });
  });

  it("라운드 35 F5: 홈 첫 실행 상태 두 스토어도 정체성 변경 때 함께 초기화된다 (NOTI-102 관례)", async () => {
    const store = createMemoryOfflineStore();
    await seedUserScopedState(store);
    // 사전 조건: 두 스토어 모두 A 계정의 아이 id를 들고 있다.
    expect(useHomeFirstRunGuideStore.getState().isItemsGuideDismissed("child-1")).toBe(true);
    expect(useFirstRecordCelebrationStore.getState().everHadRecordChildIds["child-1"]).toBe(true);

    await simulateSessionTransition(store, userA, userB);

    // persist되는 준비템 안내 플래그: 떠난 계정의 아이 id가 기기에 남지 않고, B의 첫 안내가
    // A가 남긴 목록에 걸려 삼켜지지도 않는다.
    expect(useHomeFirstRunGuideStore.getState().dismissedItemsGuideChildIds).toEqual([]);
    // 세션 스토어인 첫 기록 축하: 관찰 이력·F3 래치·축하 여부가 모두 비워진다.
    const celebration = useFirstRecordCelebrationStore.getState();
    expect(celebration.observedHasRecord).toEqual({});
    expect(celebration.celebratedChildIds).toEqual({});
    expect(celebration.everHadRecordChildIds).toEqual({});
    expect(celebration.activeChildId).toBeNull();
  });

  it("라운드 35 F5: 로그아웃에서도 같은 두 스토어가 비워진다", async () => {
    const store = createMemoryOfflineStore();
    await seedUserScopedState(store);

    await simulateSessionTransition(store, userA, loggedOut);

    expect(useHomeFirstRunGuideStore.getState().dismissedItemsGuideChildIds).toEqual([]);
    expect(useFirstRecordCelebrationStore.getState().everHadRecordChildIds).toEqual({});
  });

  /**
   * 라운드 51 QA(P3-10) — 지운 뒤에 화면이 읽는 사본까지 다시 만든다.
   *
   * 스냅샷(sync-controller.ts의 latestSnapshot)은 저장소를 구독하지 않는 메모리 사본이라, 테이블을
   * 비워도 그 사본에는 떠난 계정의 대기/실패 행이 남는다. 그 사본을 읽는 것이 기록 탭 배지와
   * 동기화 상태 화면이므로, 계정을 바꾼 직후 새 사용자가 이전 계정의 건수를 본다.
   */
  it("라운드 51 QA(P3-10): wipe가 **끝난 뒤에** 화면 스냅샷을 다시 만든다", async () => {
    const store = createMemoryOfflineStore();
    await seedUserScopedState(store);
    const observed: Array<{ expenses: number; itemStatuses: number }> = [];

    await teardownOfflineSessionState(store, {
      authToken: null,
      refreshSyncSnapshot: async () => {
        observed.push({
          expenses: (await store.listLocalExpenses()).length,
          itemStatuses: (await store.listItemStatusMutations()).length
        });
      }
    });

    // 정확히 한 번, 그리고 그 순간 저장소는 이미 비어 있다 -- 순서가 반대면 지우기 전 사본을
    // 다시 만들어 아무것도 고쳐지지 않는다.
    expect(observed).toEqual([{ expenses: 0, itemStatuses: 0 }]);
  });

  it("스냅샷 갱신 함수를 넘기지 않으면 종전 그대로다 (선택 인자)", async () => {
    const store = createMemoryOfflineStore();
    await seedUserScopedState(store);

    await teardownOfflineSessionState(store, { authToken: null });

    await expectStoreFullyEmpty(store);
  });

  it("sync-controller mounts the teardown from the same session-store subscription as the cursor invalidation (source verification -- the controller is not runtime-testable under vitest, see its header comment)", () => {
    const controllerSource = readFileSync(join(process.cwd(), "src/offline/sync-controller.ts"), "utf8");
    const subscriptionBody = controllerSource.slice(controllerSource.indexOf("useSessionStore.subscribe"));
    expect(subscriptionBody).toContain("isSessionIdentityChange(previous, state)");
    expect(subscriptionBody).toContain("teardownOfflineSessionState(store, {");
    expect(subscriptionBody).toContain("authToken: outgoingToken,");
    // 라운드 51 QA(P3-10): wipe가 끝나면 화면이 읽는 스냅샷도 다시 만든다 -- 컨트롤러가 그
    // 함수를 넘긴다(순환 import 회피, session-teardown.ts의 컨텍스트 주석 참고).
    expect(subscriptionBody).toContain("refreshSyncSnapshot: refreshSnapshot");
    // FIX-118A: the token handed to teardown is the OUTGOING session's (the store already holds
    // the incoming one when the subscription fires).
    expect(subscriptionBody).toContain(
      "previous.accessToken ?? (previous.isTestSession ? LOCAL_SESSION_TOKEN : null)"
    );
  });
});

describe("FIX-118A (M-3) react-query cache is cleared on teardown", () => {
  beforeEach(() => {
    resetAppQueryClientRegistryForTests();
  });

  afterEach(() => {
    resetAppQueryClientRegistryForTests();
  });

  /** Seeds the exact user-scoped keys that carry no user identifier -- the ones that leaked. */
  function seedUserScopedCaches(client: QueryClient) {
    client.setQueryData(["children"], { children: [{ id: "child-of-user-a", nickname: "다온이" }] });
    client.setQueryData(["my-devices"], { devices: [{ id: "device-of-user-a" }] });
    client.setQueryData(["household-members"], { members: [{ id: "member-of-user-a" }] });
    client.setQueryData(["home", "child-of-user-a"], { totalKrw: 123_000 });
  }

  it("an A -> B account switch leaves no cached response of A behind", async () => {
    const client = new QueryClient();
    registerAppQueryClient(client);
    seedUserScopedCaches(client);
    expect(client.getQueryData(["children"])).toBeDefined();

    const store = createMemoryOfflineStore();
    await seedUserScopedState(store);
    await simulateSessionTransition(store, userA, userB);

    expect(client.getQueryCache().getAll()).toEqual([]);
    expect(client.getQueryData(["children"])).toBeUndefined();
    expect(client.getQueryData(["my-devices"])).toBeUndefined();
    expect(client.getQueryData(["household-members"])).toBeUndefined();
    expect(client.getQueryData(["home", "child-of-user-a"])).toBeUndefined();
  });

  it("logout clears the cache too (the next login must never render the previous account's rows)", async () => {
    const client = new QueryClient();
    registerAppQueryClient(client);
    seedUserScopedCaches(client);

    const store = createMemoryOfflineStore();
    await simulateSessionTransition(store, userA, loggedOut);

    expect(client.getQueryCache().getAll()).toEqual([]);
  });

  it("a same-user token refresh keeps the cache warm (no gratuitous refetch storm)", async () => {
    const client = new QueryClient();
    registerAppQueryClient(client);
    seedUserScopedCaches(client);

    const store = createMemoryOfflineStore();
    await simulateSessionTransition(store, userA, { ...userA });

    expect(client.getQueryData(["children"])).toBeDefined();
    expect(client.getQueryData(["my-devices"])).toBeDefined();
  });

  it("is a no-op (never throws) when no client was ever registered -- the pre-_layout window", async () => {
    const store = createMemoryOfflineStore();
    await expect(simulateSessionTransition(store, userA, userB)).resolves.toBeUndefined();
  });

  it("app/_layout.tsx registers its QueryClient (source verification -- expo-router is not loadable under vitest)", () => {
    const layoutSource = readFileSync(join(process.cwd(), "app/_layout.tsx"), "utf8");
    expect(layoutSource).toContain(
      'import { registerAppQueryClient } from "../src/query/query-client-registry";'
    );
    expect(layoutSource).toContain("registerAppQueryClient(queryClient);");
  });
});

describe("FIX-118A (M-4 client half) push device deactivation on teardown", () => {
  beforeEach(() => {
    resetPushRegistrationForTests();
  });

  it("turns this device's push row off under the OUTGOING token and forgets the registration", async () => {
    usePushRegistrationStore.getState().setRegisteredDeviceId("device-77");
    const calls: Array<[string, string, boolean]> = [];

    await deactivateRegisteredPushDevice("outgoing-token", {
      update: async (token, deviceId, enabled) => {
        calls.push([token, deviceId, enabled]);
        return {};
      }
    });

    expect(calls).toEqual([["outgoing-token", "device-77", false]]);
    expect(usePushRegistrationStore.getState().registeredDeviceId).toBeNull();
  });

  it("swallows a failing request but still resets the store (best-effort contract)", async () => {
    usePushRegistrationStore.getState().setRegisteredDeviceId("device-77");

    await expect(
      deactivateRegisteredPushDevice("outgoing-token", {
        update: async () => {
          throw new Error("Network request failed");
        }
      })
    ).resolves.toBeUndefined();

    expect(usePushRegistrationStore.getState().registeredDeviceId).toBeNull();
  });

  it("does nothing over the wire when this device was never registered, or the token is already gone", async () => {
    const calls: string[] = [];
    const update = async () => {
      calls.push("called");
      return {};
    };

    await deactivateRegisteredPushDevice("outgoing-token", { update });
    usePushRegistrationStore.getState().setRegisteredDeviceId("device-77");
    await deactivateRegisteredPushDevice(null, { update });

    expect(calls).toEqual([]);
  });

  it("teardown starts the deactivation with the outgoing token, without awaiting it", async () => {
    usePushRegistrationStore.getState().setRegisteredDeviceId("device-77");
    const store = createMemoryOfflineStore();

    await teardownOfflineSessionState(store, { authToken: "outgoing-token" });

    // The store reset is synchronous inside the fire-and-forget call, so it has already happened
    // by the time teardown resolves -- proof the deactivation really was kicked off.
    expect(usePushRegistrationStore.getState().registeredDeviceId).toBeNull();
  });

  it("teardown without a token still succeeds (logout after the token was already dropped)", async () => {
    usePushRegistrationStore.getState().setRegisteredDeviceId("device-77");
    const store = createMemoryOfflineStore();

    await expect(teardownOfflineSessionState(store)).resolves.toBeUndefined();
    expect(usePushRegistrationStore.getState().registeredDeviceId).toBeNull();
  });
});

describe("PRIV-104 wipe vs in-flight flush sequencing", () => {
  /** Fake remote whose first create blocks until the test releases it, so a flush pass can be
   * held open mid-request. */
  function createBlockingRemote() {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const calls: string[] = [];
    const remote: RemoteExpenseApi = {
      async createExpense(_payload, idempotencyKey) {
        calls.push(`create:${idempotencyKey}`);
        await gate;
        return { id: `server-${calls.length}`, version: 1 };
      },
      async updateExpense(_canonicalId, _payload, expectedVersion) {
        calls.push("update");
        return { version: expectedVersion + 1 };
      },
      async deleteExpense() {
        calls.push("delete");
      }
    };
    return { remote, calls, release };
  }

  it("a wipe requested while a flush is in-flight waits for the flush pass, then clears whatever it left", async () => {
    const store = createMemoryOfflineStore();
    await recordLocalCreate(store, payload);
    const { remote, calls, release } = createBlockingRemote();
    const order: string[] = [];

    const flushPromise = flushOutbox(store, remote).then(() => order.push("flush-settled"));
    // Let the pass reach the blocked network call before requesting the wipe.
    await Promise.resolve();
    const wipePromise = wipeOfflineStore(store).then(() => order.push("wipe-settled"));

    // The wipe must NOT have deleted anything while the flush still holds the store.
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(order).toEqual([]);
    expect(await store.listOutboxMutations()).toHaveLength(1);

    release();
    await Promise.all([flushPromise, wipePromise]);

    // Flush completed first (the outgoing user's in-flight write reached the server), then the
    // wipe cleared the store -- never interleaved.
    expect(order).toEqual(["flush-settled", "wipe-settled"]);
    expect(calls).toHaveLength(1);
    await expectStoreFullyEmpty(store);
  });

  it("a flush requested while a wipe is in-flight waits for the wipe and then sees an empty outbox (never re-sends wiped mutations)", async () => {
    const inner = createMemoryOfflineStore();
    await recordLocalCreate(inner, payload);
    // Wrap the store so clearAll blocks until released, holding the wipe open mid-run.
    let releaseClear!: () => void;
    const clearGate = new Promise<void>((resolve) => {
      releaseClear = resolve;
    });
    const store: OfflineStore = {
      ...inner,
      async clearAll() {
        await clearGate;
        await inner.clearAll();
      }
    };
    const { remote, calls, release } = createBlockingRemote();
    release(); // remote never needs to block in this test

    const wipePromise = wipeOfflineStore(store);
    const flushPromise = flushOutbox(store, remote);

    await new Promise((resolve) => setTimeout(resolve, 0));
    // The flush is parked behind the wipe: nothing has gone over the wire.
    expect(calls).toEqual([]);

    releaseClear();
    const summary = await flushPromise;
    await wipePromise;

    // Post-wipe pass found an empty queue -- the wiped mutation was never sent.
    expect(calls).toEqual([]);
    expect(summary.synced).toBe(0);
    await expectStoreFullyEmpty(inner);
  });

  it("a flush arriving while teardown is still clearing the sync cursor parks behind the wipe and never delivers the old account's rows under the new token", async () => {
    // Regression for the PRIV-104 teardown ordering race: teardownOfflineSessionState used to
    // `await clearSyncCursor(store)` BEFORE calling wipeOfflineStore. A flushOutbox call that
    // landed during that await found inFlightWipes empty, passed the wipe-guard, and flushed
    // the OLD account's outbox rows under the NEW account's token. The wipe must be registered
    // synchronously at teardown start so that flush parks behind it instead.
    const inner = createMemoryOfflineStore();
    await recordLocalCreate(inner, payload);
    // Hold the cursor clear open, exactly the await window the old ordering leaked through.
    let releaseCursorClear!: () => void;
    const cursorClearGate = new Promise<void>((resolve) => {
      releaseCursorClear = resolve;
    });
    const store: OfflineStore = {
      ...inner,
      async deleteMeta(key) {
        await cursorClearGate;
        await inner.deleteMeta(key);
      }
    };
    const { remote, calls, release } = createBlockingRemote();
    release(); // the remote itself never needs to block in this test

    // Teardown starts (userA -> userB switch) but is stuck mid-clearSyncCursor...
    const teardownPromise = simulateSessionTransition(store, userA, userB);
    // ...and the NEW session's first flush arrives in exactly that window.
    const flushPromise = flushOutbox(store, remote);

    await new Promise((resolve) => setTimeout(resolve, 0));
    // Nothing has gone over the wire: the flush is parked behind the wipe.
    expect(calls).toEqual([]);

    releaseCursorClear();
    const summary = await flushPromise;
    await teardownPromise;

    // The flush saw the post-wipe empty queue -- user A's mutation was never sent under
    // user B's token.
    expect(calls).toEqual([]);
    expect(summary.synced).toBe(0);
    await expectStoreFullyEmpty(inner);
  });

  it("teardown starts the wipe before its first await (source verification of the ordering the race regression test relies on)", () => {
    const teardownSource = readFileSync(join(process.cwd(), "src/offline/session-teardown.ts"), "utf8");
    const body = teardownSource.slice(teardownSource.indexOf("export async function teardownOfflineSessionState"));
    const wipeStart = body.indexOf("const wipe = wipeOfflineStore(store);");
    // First await STATEMENT (line-start match so the word "await" in comments doesn't count).
    const firstAwait = body.indexOf("\n  await ");
    expect(wipeStart).toBeGreaterThan(-1);
    expect(firstAwait).toBeGreaterThan(-1);
    expect(wipeStart).toBeLessThan(firstAwait);
    // And sync-engine's wipe registers itself in inFlightWipes synchronously (before any await
    // inside the wipe body could yield), which is what makes starting-first sufficient.
    const engineSource = readFileSync(join(process.cwd(), "src/offline/sync-engine.ts"), "utf8");
    const wipeBody = engineSource.slice(engineSource.indexOf("export function wipeOfflineStore"));
    expect(wipeBody).toContain("inFlightWipes.set(store, wipe);");
    expect(wipeBody.indexOf("inFlightWipes.set(store, wipe);")).toBeLessThan(wipeBody.indexOf("return wipe;"));
  });

  it("concurrent wipe requests coalesce into a single wipe", async () => {
    const inner = createMemoryOfflineStore();
    let clearCount = 0;
    const store: OfflineStore = {
      ...inner,
      async clearAll() {
        clearCount += 1;
        await inner.clearAll();
      }
    };
    await recordLocalCreate(store, payload);

    const first = wipeOfflineStore(store);
    const second = wipeOfflineStore(store);
    expect(second).toBe(first);
    await Promise.all([first, second]);
    expect(clearCount).toBe(1);
  });
});
