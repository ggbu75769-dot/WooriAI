import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { useAnalyticsConsentStore } from "../analytics/flag";
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
import { useAppLockStore } from "../stores/app-lock.store";
import { useImportResumeStore } from "../stores/import-resume.store";
import { useQuickRecordPinsStore } from "../stores/quick-record-pins.store";
import { useRecentSearchesStore } from "../stores/recent-searches.store";
import { useRecurringExpenseStore } from "../stores/recurring-expense.store";
import { useSelectedChildStore } from "../stores/selected-child.store";
import { readAppLockRecord } from "../security/app-lock-storage";
import { secureSessionStorage } from "../stores/secure-session-storage";
import { saveSyncCursor, SYNC_CURSOR_META_KEY } from "./delta-sync";
import { createMemoryOfflineStore } from "./memory-offline-store";
import {
  clearSessionScopedChildSelection,
  clearSessionScopedQueryCache,
  isSessionIdentityChange,
  revokeOutgoingSessionOnServer,
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
import { shouldAttemptSelectedChildRecovery } from "../onboarding/selected-child-recovery";
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

/** 라운드 55 트랙 C: 계정 데이터를 담은 반복 지출 템플릿 하나(설계 §1.6). */
const recurringDraft = {
  childId: "child-1",
  itemName: "기저귀",
  amountKrw: 38_500,
  categoryId: "cat-diaper",
  paymentMethod: "card",
  dayOfMonth: 5
} as const;

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
  // 라운드 55 트랙 C: 반복 지출 템플릿(계정 데이터)과 앱 잠금 PIN(브릭 방지)도 같은 목록이다.
  useRecurringExpenseStore.getState().addTemplate(recurringDraft);
  // 라운드 56 트랙 D: 가져오기 이어보기 항목(childId·파일명)도 계정 데이터다.
  useImportResumeStore.getState().rememberImportReview({
    childId: "child-1",
    jobId: "job-1",
    fileName: "가계부.xlsx",
    createdAt: "2026-08-28T00:00:00.000Z"
  });
  await useAppLockStore.getState().enableLock("1234");
  // 라운드 99 M-1: 통계 수집 동의는 사용자 단위 선택이다 -- A가 켠 동의가 B의 세션으로 넘어가면
  // 로그인 화면 체크박스가 미리 켜진 채 B의 토큰으로 커밋된다.
  useAnalyticsConsentStore.getState().setEnabled(true);
  // 라운드 101 W2 F7: 기록 탭 최근 검색어는 사용자가 친 개인 텍스트다 -- A가 무엇을 찾았는지가
  // B의 검색창 아래에 칩으로 떠서는 안 된다(판단은 통계 동의와 같은 사용자 단위).
  useRecentSearchesStore.getState().add("조리원");
  // 라운드 102 F6b: 홈 빠른 기록 칩의 핀도 품목명(개인 텍스트)이다 -- 같은 사용자 단위 판단.
  useQuickRecordPinsStore.getState().togglePin("튼살크림");
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

beforeEach(async () => {
  usePurchaseFollowupStore.setState({ entries: [] });
  useHomeFirstRunGuideStore.getState().reset();
  useFirstRecordCelebrationStore.getState().reset();
  // 라운드 55 트랙 C: 잠금 기록은 SecureStore(vitest에서는 인메모리 폴백)에 남으므로 테스트
  // 사이에 지운다 -- 남기면 다음 테스트의 사전 조건이 조용히 달라진다.
  useRecurringExpenseStore.getState().resetAll();
  useImportResumeStore.getState().resetAll();
  await useAppLockStore.getState().resetAll();
  // 라운드 99 M-1: 동의 플래그도 테스트 사이에 초기화한다(남기면 다음 테스트의 사전 조건이 달라진다).
  useAnalyticsConsentStore.getState().reset();
  // 라운드 101 W2 F7: 최근 검색어도 같은 이유로 테스트 사이에 비운다.
  useRecentSearchesStore.getState().resetAll();
  // 라운드 102 F6b: 빠른 기록 칩 핀도 같은 이유로 테스트 사이에 비운다.
  useQuickRecordPinsStore.getState().resetAll();
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
    // 라운드 110: 컨트롤러가 같은 동기 자리에서 부르는 단계. 이 하네스는 그 거울이므로 함께 선다.
    clearSessionScopedChildSelection();
    order.push("selected-child-cleared");
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
    expect(wiring.order).toEqual(["query-cache-cleared", "selected-child-cleared"]);
    // Limitation, stated plainly: vitest mounts no navigator and no screens, so what is pinned
    // here is "the clear completes in the same tick as the store notification, ahead of the
    // async teardown" -- not the React commit itself. That tick is the one in which the store's
    // `set` schedules B's re-render, which is what puts the clear on the right side of the
    // boundary.

    await wiring.settle();

    expect(wiring.order).toEqual(["query-cache-cleared", "selected-child-cleared", "offline-store-torn-down"]);
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
    // 라운드 99 M-1: 같은 사람의 동의도 그대로다 -- 토큰 갱신이 동의를 철회하면 안 된다.
    expect(useAnalyticsConsentStore.getState().enabled).toBe(true);
    // 라운드 101 W2 F7: 같은 사람의 최근 검색어도 그대로다 -- 토큰 갱신이 이력을 지우면 안 된다.
    expect(useRecentSearchesStore.getState().searches).toEqual(["조리원"]);
    // 라운드 102 F6b: 같은 사람의 빠른 기록 칩 핀도 그대로다.
    expect(useQuickRecordPinsStore.getState().pinnedItemNames).toEqual(["튼살크림"]);
  });

  /**
   * 라운드 99 M-1 — 통계 수집 동의(ANA-102)가 계정 경계를 넘지 않는다.
   *
   * 유출 경로는 로그인 화면에 있다(app/(auth)/login.tsx 125-143): 동의 체크박스는 사용자가
   * 손대기 전까지 이 스토어의 현재 값을 따르므로(storedAnalyticsEnabled), A가 켠 값이 남아
   * 있으면 B의 체크박스가 미리 켜진 채 로그인 한 번에 B의 토큰으로 커밋된다. **로그인 화면은
   * 고치지 않는다**: teardown이 여기서 지우면 그 폴백은 미동의 기본(OFF)으로 서고, 그 폴백
   * 자체는 옳은 동작이다(같은 사용자의 재로그인이 자기 동의를 유지하는 근거 — 그 화면의
   * ANA-104 주석). 만료(expired)는 정체성이 그대로라 teardown이 발화하지 않으므로 같은
   * 사람의 동의를 빼앗지도 않는다(위 토큰 갱신 테스트).
   */
  it("라운드 99 M-1: 계정 전환·로그아웃·데모 전환에서 통계 수집 동의가 미동의(OFF)로 돌아간다", async () => {
    for (const next of [userB, loggedOut, demoSession]) {
      const store = createMemoryOfflineStore();
      await seedUserScopedState(store);
      expect(useAnalyticsConsentStore.getState().enabled).toBe(true);

      await simulateSessionTransition(store, userA, next);

      expect(useAnalyticsConsentStore.getState().enabled).toBe(false);
    }
  });

  /**
   * 라운드 101 W2 F7 — 기록 탭 최근 검색어가 계정 경계를 넘지 않는다.
   *
   * 검색어는 사용자가 검색창에 친 개인 텍스트다(품목명·판매처·메모의 조각 — 무엇을 샀고
   * 무엇을 찾았는지가 그대로 담긴다). 저장은 기기 단위 persist지만 **판단은 사용자 단위**
   * (통계 동의 라운드 99 M-1과 같은 선례)이고, 대조군 records-view(리스트/달력)·
   * notification-preferences는 "화면을 어떻게 볼까"류 기기 취향이라 일부러 유지된다.
   */
  it("라운드 101 W2 F7: 계정 전환·로그아웃·데모 전환에서 최근 검색어가 비워진다", async () => {
    for (const next of [userB, loggedOut, demoSession]) {
      const store = createMemoryOfflineStore();
      await seedUserScopedState(store);
      expect(useRecentSearchesStore.getState().searches).toEqual(["조리원"]);

      await simulateSessionTransition(store, userA, next);

      expect(useRecentSearchesStore.getState().searches).toEqual([]);
    }
  });

  /**
   * 라운드 102 F6b — 홈 빠른 기록 칩의 핀이 계정 경계를 넘지 않는다.
   *
   * 핀에 담기는 것은 사용자가 고른 품목명(개인 텍스트)이다. 저장은 기기 단위 persist지만
   * **판단은 사용자 단위**(최근 검색어 라운드 101 W2 F7과 같은 선례)다 — A가 무엇을 자주
   * 사는지가 B의 홈 칩에 고정된 채 떠서는 안 된다.
   */
  it("라운드 102 F6b: 계정 전환·로그아웃·데모 전환에서 빠른 기록 칩 핀이 비워진다", async () => {
    for (const next of [userB, loggedOut, demoSession]) {
      const store = createMemoryOfflineStore();
      await seedUserScopedState(store);
      expect(useQuickRecordPinsStore.getState().pinnedItemNames).toEqual(["튼살크림"]);

      await simulateSessionTransition(store, userA, next);

      expect(useQuickRecordPinsStore.getState().pinnedItemNames).toEqual([]);
    }
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
   * 라운드 55 트랙 C — 반복 지출 템플릿(설계 §1.6)과 앱 잠금 PIN(§2.8)의 teardown 합류.
   *
   * 두 스토어가 여기 드는 이유가 서로 다르다:
   *  - 템플릿은 품목명·금액·분류·판매처를 담은 **계정 데이터**다. 남으면 B가 A의 정기 지출을 본다.
   *  - PIN은 남으면 **브릭**이다. A 로그아웃 → B 로그인 → B가 A의 PIN 화면에 갇히고, 탈출구인
   *    로그아웃을 눌러도 다시 로그인하면 또 잠긴다.
   * 반대로 만료(`expired`)는 정체성이 그대로라 teardown 자체가 발화하지 않는다 — 같은 사람의
   * PIN과 템플릿을 빼앗지 않는다(수용 기준 #9-8).
   */
  it("라운드 55 트랙 C: 계정 전환에서 반복 지출 템플릿과 앱 잠금 PIN이 함께 지워진다", async () => {
    const store = createMemoryOfflineStore();
    await seedUserScopedState(store);
    // 사전 조건: A의 템플릿 1건과 A의 PIN이 실제로 저장돼 있다.
    expect(useRecurringExpenseStore.getState().templates).toHaveLength(1);
    expect(useAppLockStore.getState().record?.enabled).toBe(true);
    expect((await readAppLockRecord()).status).toBe("loaded");

    await simulateSessionTransition(store, userA, userB);

    expect(useRecurringExpenseStore.getState().templates).toEqual([]);
    // 라운드 56 트랙 D: 가져오기 이어보기 항목도 함께 비어야 한다(다음 계정에 파일명이 새지 않게).
    // 라운드 67 적대 리뷰 #1: 확정 칸도 같은 계정 데이터다 — 한 칸만 비우면 다음 사람의 화면에
    // 남의 파일명이 "방금 가져온 결과"로 뜬다.
    expect(useImportResumeStore.getState().entry).toBeNull();
    expect(useImportResumeStore.getState().confirmed).toBeNull();
    // 런타임 상태와 SecureStore 키가 **둘 다** 비어야 한다. 하나만 지우면 다음 부팅에서 되살아난다.
    expect(useAppLockStore.getState().record).toBeNull();
    expect(await readAppLockRecord()).toEqual({ status: "loaded", record: null });
    // 기록을 지운 직후의 사실은 "잠금 없음"이다 -- unknown으로 두면 B가 이유 없이 recovery를 본다.
    expect(useAppLockStore.getState().recordStatus).toBe("loaded");
    expect(useAppLockStore.getState().unlockedThisForeground).toBe(false);
  });

  it("라운드 55 트랙 C: 로그아웃에서도 템플릿과 PIN이 남지 않는다 (수용 기준 #4-8)", async () => {
    const store = createMemoryOfflineStore();
    await seedUserScopedState(store);

    await simulateSessionTransition(store, userA, loggedOut);

    expect(useRecurringExpenseStore.getState().templates).toEqual([]);
    expect(useImportResumeStore.getState().entry).toBeNull();
    expect(await readAppLockRecord()).toEqual({ status: "loaded", record: null });
  });

  it("라운드 55 트랙 C: 만료(expired, 같은 사람)로는 템플릿도 PIN도 잃지 않는다", async () => {
    const store = createMemoryOfflineStore();
    await seedUserScopedState(store);

    // `clearSession("expired")`가 남기는 상태: 정체성(userId·isTestSession)은 그대로다.
    await simulateSessionTransition(store, userA, { userId: "user-a", isTestSession: false });

    expect(useRecurringExpenseStore.getState().templates).toHaveLength(1);
    expect(useImportResumeStore.getState().entry).not.toBeNull();
    expect(useAppLockStore.getState().record?.enabled).toBe(true);
    expect((await readAppLockRecord()).status).toBe("loaded");
  });

  it("라운드 55 트랙 C: 앱 잠금 삭제는 teardown이 끝나기 전에 완료된다 (await -- 다음 부팅까지 남지 않는다)", async () => {
    const store = createMemoryOfflineStore();
    await seedUserScopedState(store);

    // teardown의 promise가 resolve된 시점에 SecureStore 키가 이미 없어야 한다.
    await teardownOfflineSessionState(store, { authToken: null });

    expect(await readAppLockRecord()).toEqual({ status: "loaded", record: null });
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


/**
 * 라운드 107 트랙 B(S1-2) — **로그아웃이 서버 토큰 family 폐기를 요청한다.**
 *
 * 종전: 이 파일이 잠그던 teardown은 전부 기기 안의 상태였고, 서버로 나가는 정리는 푸시 기기
 * 행 끄기 하나였다. 로그아웃한 계정의 refresh 토큰은 서버에서 최대 30일 살아 있었다.
 *
 * 여기서 잠그는 것은 **언제 나가는가**와 **어디에 배선돼 있는가**다. 전송 자체의 세 실패
 * 갈래(401 · 5xx · 오프라인)는 src/api/logout-revocation.test.ts에 있다.
 */
describe("라운드 107 트랙 B 나가는 세션의 서버 토큰 폐기", () => {
  const LOGOUT_URL = `${process.env.EXPO_PUBLIC_API_BASE_URL ?? "http://localhost:3000/api/v1"}/auth/logout`;

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("나가는 자격증명으로 POST /auth/logout을 **동기적으로 시작한다**(await하지 않는다)", () => {
    const calls: Array<{ url: string; auth: string | null; body: unknown }> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        calls.push({
          url,
          auth: (init?.headers as Record<string, string> | undefined)?.Authorization ?? null,
          body: JSON.parse(String(init?.body))
        });
        return new Response(JSON.stringify({ success: true }), { status: 200 });
      })
    );

    // 반환값이 void이고, 이 줄 뒤에 await가 없는데도 요청이 이미 나가 있다 -- 로그아웃이
    // 네트워크를 기다리지 않는다는 사실이 이 단언 하나에 들어 있다.
    revokeOutgoingSessionOnServer({ authToken: "outgoing-access", refreshToken: "outgoing-refresh" });

    expect(calls).toEqual([
      { url: LOGOUT_URL, auth: "Bearer outgoing-access", body: { refreshToken: "outgoing-refresh" } }
    ]);
  });

  it("서버가 죽었거나(5xx) 기기가 오프라인이어도 호출부로 예외가 새지 않는다", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("Network request failed");
      })
    );

    expect(() =>
      revokeOutgoingSessionOnServer({ authToken: "outgoing-access", refreshToken: "outgoing-refresh" })
    ).not.toThrow();
    // fire-and-forget이라 처리되지 않은 거부가 남으면 안 된다 -- 마이크로태스크를 한 바퀴 돌린다.
    await Promise.resolve();
  });

  it("나가는 refresh 토큰이 없으면 요청 0건이다(로그아웃 뒤 로그인 · 데모 세션)", () => {
    const fetchMock = vi.fn(async () => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    revokeOutgoingSessionOnServer({ authToken: "outgoing-access", refreshToken: null });

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sync-controller가 정체성 전이 구독에서, **getOfflineStore() 홉 앞에서** 나가는 자격증명으로 폐기를 시작한다 (source verification -- 컨트롤러는 vitest에서 실행되지 않는다)", () => {
    const controllerSource = readFileSync(join(process.cwd(), "src/offline/sync-controller.ts"), "utf8");
    const start = controllerSource.indexOf("isSessionIdentityChange(previous, state)");
    // 슬라이스 양쪽 끝 가드(라운드 78): 시작이 사라지면 -1에서 잘려 단언이 파일 전체를 보고,
    // 끝이 사라지면 아래 "홉 앞" 비교가 무의미해진다.
    expect(start).toBeGreaterThan(-1);
    const end = controllerSource.indexOf("refreshSyncSnapshot: refreshSnapshot", start);
    expect(end).toBeGreaterThan(start);
    const subscriptionBody = controllerSource.slice(start, end);

    expect(subscriptionBody).toContain(
      "revokeOutgoingSessionOnServer({ authToken: outgoingToken, refreshToken: previous.refreshToken });"
    );
    // 폐기는 저장소를 여는 프로미스 홉(그 실패는 .catch로 삼켜진다)보다 **앞**에 서야 한다 --
    // 뒤에 두면 SQLite를 못 여는 기기에서 토큰 폐기까지 함께 사라진다.
    expect(subscriptionBody.indexOf("revokeOutgoingSessionOnServer(")).toBeLessThan(
      // `void getOfflineStore()` -- 홉을 *여는 문장*으로 찾는다(위 주석도 그 이름을 언급한다).
      subscriptionBody.indexOf("void getOfflineStore()")
    );
  });

  it("사람이 쓰는 로그아웃 두 자리가 모두 같은 clearSession()을 지난다 -- 배선 한 벌이 둘을 덮는 근거 (source verification)", () => {
    // 설정 화면(SET-001)의 로그아웃 버튼과 PIN 분실 탈출구. 둘 중 하나가 자기만의 세션 정리를
    // 갖게 되면 그 경로만 조용히 폐기 없는 로그아웃으로 돌아간다.
    const settingsSource = readFileSync(join(process.cwd(), "app/settings/index.tsx"), "utf8");
    const overlaySource = readFileSync(join(process.cwd(), "src/security/AppLockOverlay.tsx"), "utf8");

    for (const source of [settingsSource, overlaySource]) {
      const start = source.indexOf('text: "로그아웃"');
      expect(start).toBeGreaterThan(-1);
      const end = source.indexOf('router.replace("/launch-animation")', start);
      expect(end).toBeGreaterThan(start);
      expect(source.slice(start, end)).toContain("clearSession();");
    }
  });
});

/**
 * 라운드 110 — **선택된 아이 id도 계정 경계에서 지운다.**
 *
 * 종전(그때는 참): 이 목록에 `useSelectedChildStore`가 없었던 것은 실수가 아니라 **사람이 누르는
 * 로그아웃 세 자리가 각자 지우고 있었기 때문**이다(설정 로그아웃 · PIN 분실 · 계정 삭제). 그래서
 * "로그아웃 → 다른 계정 로그인"은 선택이 null인 채 도착했고, 그 null이 곧 MOB-116 복구의
 * 방아쇠였다.
 *
 * 이제: 그 셋을 지나지 않는 정체성 전환이 하나 있다 — 만료(`clearSession("expired")`)는 userId를
 * 남겨 이 구독을 발화시키지 않으므로, 뒤이은 **타계정 로그인**만 A의 아이 id를 물고 도착했다.
 * app/index.tsx:209가 `hasReachedHome`이면 진행도 조회를 건너뛰어 FIX-119B/F5의 무효 감지도 돌지
 * 않고, MOB-116 복구는 값이 있어 서지 않는다 → 네 탭이 A의 childId로 조회한다. 그 비대칭을 여기서
 * 없앤다(근거 전문은 session-teardown.ts의 `clearSessionScopedChildSelection` 머리말).
 */
describe("라운드 110 계정 경계에서 선택된 아이 id", () => {
  beforeEach(() => {
    useSelectedChildStore.getState().clearSelectedChildId();
    resetAppQueryClientRegistryForTests();
  });

  afterEach(() => {
    useSelectedChildStore.getState().clearSelectedChildId();
    resetAppQueryClientRegistryForTests();
  });

  it("clearSessionScopedChildSelection은 **동기로** 비운다 (순서 계약이 기대는 사실)", () => {
    useSelectedChildStore.getState().setSelectedChildId("child-of-user-a");

    // await 없음: 계약상 동기이므로 같은 틱의 아래 단언이 이미 참이다.
    clearSessionScopedChildSelection();

    expect(useSelectedChildStore.getState().selectedChildId).toBeNull();
  });

  it("만료 뒤 타계정 로그인 — A의 아이 id가 B의 첫 렌더 **앞에서** 사라진다 (이 라운드가 고친 갈래)", async () => {
    const store = createMemoryOfflineStore();
    useSelectedChildStore.getState().setSelectedChildId("child-of-user-a");

    const fake = createFakePersistedSessionStore(loggedOutSnapshot);
    const wiring = mountControllerTeardownSubscription(fake, store);
    fake.rehydrateAs(userASnapshot);
    await wiring.settle();

    // 만료: 자격증명만 죽고 정체성은 남는다 -> 이 구독은 발화하지 않는다(그래서 선택도 그대로다).
    fake.write(expiredUserASnapshot);
    expect(wiring.order).toEqual([]);
    expect(useSelectedChildStore.getState().selectedChildId).toBe("child-of-user-a");

    // 같은 기기에서 B가 로그인한다. 여기서 비로소 정체성이 바뀐다.
    fake.write(userBSnapshot);

    // 프로미스 홉을 하나도 돌리지 않은 이 시점에 이미 비어 있어야 한다 -- B의 화면이 읽기 전이다.
    expect(useSelectedChildStore.getState().selectedChildId).toBeNull();
    expect(wiring.order).toEqual(["query-cache-cleared", "selected-child-cleared"]);

    await wiring.settle();
    expect(useSelectedChildStore.getState().selectedChildId).toBeNull();
    wiring.unsubscribe();
  });

  it("파생 단언 — 그 null이 곧 MOB-116 복구의 방아쇠다(검증을 여기서 새로 짓지 않는 근거)", async () => {
    const store = createMemoryOfflineStore();
    useSelectedChildStore.getState().setSelectedChildId("child-of-user-a");
    const fake = createFakePersistedSessionStore(loggedOutSnapshot);
    const wiring = mountControllerTeardownSubscription(fake, store);
    fake.rehydrateAs(userASnapshot);
    await wiring.settle();
    fake.write(expiredUserASnapshot);

    const recoveryInput = (selectedChildId: string | null, hasReachedHome = true) => ({
      hydrated: true,
      isTestSession: false,
      accessToken: userBSnapshot.accessToken,
      hasReachedHome,
      selectedChildId
    });

    // 지우기 전: 값이 있어 복구가 서지 않는다 -- 그래서 B가 그대로 /(tabs)로 들어갔다.
    expect(shouldAttemptSelectedChildRecovery(recoveryInput("child-of-user-a"))).toBe(false);

    fake.write(userBSnapshot);

    // 지운 뒤: 이미 있는 복구 경로(GET /children -> 재선택, 다자녀면 안내)가 이어받는다.
    expect(shouldAttemptSelectedChildRecovery(recoveryInput(useSelectedChildStore.getState().selectedChildId))).toBe(
      true
    );
    // 반대 방향 -- `hasReachedHome`까지 함께 지우면 그 복구가 **꺼진다**. 지나치게 지우지 않는
    // 근거가 이 한 줄이다(서버가 답하지 않는 갈래에서는 ONB-001로 떨어져 아이가 하나 더 생긴다).
    expect(shouldAttemptSelectedChildRecovery(recoveryInput(null, false))).toBe(false);

    await wiring.settle();
    wiring.unsubscribe();
  });

  it("정체성이 같으면 선택을 잃지 않는다 — 토큰 갱신 · 만료 뒤 같은 사람 재로그인", async () => {
    const store = createMemoryOfflineStore();
    const fake = createFakePersistedSessionStore(loggedOutSnapshot);
    const wiring = mountControllerTeardownSubscription(fake, store);
    fake.rehydrateAs(userASnapshot);
    await wiring.settle();
    useSelectedChildStore.getState().setSelectedChildId("child-of-user-a");

    // setTokens: 정체성 필드 무변화.
    fake.write({ ...userASnapshot, accessToken: "rotated-a" });
    await wiring.settle();
    expect(useSelectedChildStore.getState().selectedChildId).toBe("child-of-user-a");

    // 만료 -> 같은 사람이 다시 로그인(AUTH-127): userId가 유지되므로 전이가 아니다.
    fake.write(expiredUserASnapshot);
    fake.write(userASnapshot);
    await wiring.settle();
    expect(useSelectedChildStore.getState().selectedChildId).toBe("child-of-user-a");
    expect(wiring.order).toEqual([]);
    wiring.unsubscribe();
  });

  it("로그아웃 갈래는 종전 그대로다 — 화면이 이미 지운 뒤라 이 단계는 멱등한 no-op이다", async () => {
    const store = createMemoryOfflineStore();
    useSelectedChildStore.getState().setSelectedChildId("child-of-user-a");
    const fake = createFakePersistedSessionStore(loggedOutSnapshot);
    const wiring = mountControllerTeardownSubscription(fake, store);
    fake.rehydrateAs(userASnapshot);
    await wiring.settle();

    // app/settings/index.tsx는 clearSession() 직후 clearSelectedChild()를 부른다. 순서를 그대로 둔다.
    fake.write(loggedOutSnapshot);
    useSelectedChildStore.getState().clearSelectedChildId();
    await wiring.settle();
    expect(useSelectedChildStore.getState().selectedChildId).toBeNull();

    // 이어지는 B 로그인에서도 null 그대로 -- 종전 동작과 한 글자도 다르지 않다.
    fake.write(userBSnapshot);
    await wiring.settle();
    expect(useSelectedChildStore.getState().selectedChildId).toBeNull();
    wiring.unsubscribe();
  });

  it("데모 전환에서도 지운다 — startTestSession은 **비어 있을 때만** 데모 아이를 고른다", async () => {
    // 그 스토어의 전제를 값으로 확인한다: 선택이 남아 있으면 데모 세션이 A의 아이를 물고 간다.
    const sessionSource = readFileSync(join(process.cwd(), "src/stores/session.store.ts"), "utf8");
    expect(sessionSource).toContain("if (!selectedChild.selectedChildId) selectedChild.setSelectedChildId(existingChildId);");

    const store = createMemoryOfflineStore();
    useSelectedChildStore.getState().setSelectedChildId("child-of-user-a");
    const fake = createFakePersistedSessionStore(loggedOutSnapshot);
    const wiring = mountControllerTeardownSubscription(fake, store);
    fake.rehydrateAs(userASnapshot);
    await wiring.settle();

    fake.write(demoSnapshot);
    expect(useSelectedChildStore.getState().selectedChildId).toBeNull();
    await wiring.settle();
    wiring.unsubscribe();
  });

  it("teardownOfflineSessionState를 직접 불러도 지운다 (step 0c -- 멱등 반복이라 단위 테스트와 직접 호출자가 온전하다)", async () => {
    const store = createMemoryOfflineStore();
    await seedUserScopedState(store);
    useSelectedChildStore.getState().setSelectedChildId("child-of-user-a");

    await teardownOfflineSessionState(store);

    expect(useSelectedChildStore.getState().selectedChildId).toBeNull();
  });

  it("sync-controller가 **프로미스 홉 앞의 동기 자리**에서 부른다 (source verification -- 컨트롤러는 vitest에서 돌지 않는다)", () => {
    const controllerSource = readFileSync(join(process.cwd(), "src/offline/sync-controller.ts"), "utf8");
    const body = controllerSource.slice(
      controllerSource.indexOf("subscribeToHydratedSessionTransitions(useSessionStore")
    );
    const clearAt = body.indexOf("clearSessionScopedChildSelection();");
    const storeAt = body.indexOf("void getOfflineStore()");
    expect(clearAt).toBeGreaterThan(-1);
    expect(storeAt).toBeGreaterThan(-1);
    expect(clearAt).toBeLessThan(storeAt);
    // 세션 스토어 통지와 이 호출 사이에서 아무것도 양보하지 않는다(캐시 비우기와 같은 계약).
    expect(body.slice(0, clearAt)).not.toContain("await ");
    expect(body.slice(0, clearAt)).not.toContain(".then(");
  });

  it("teardown은 `hasReachedHome`(온보딩 진행도)을 지우지 않는다 — 로그아웃 세 자리도 지우지 않는 값이다", () => {
    // 주석은 그 판단의 **근거를 적는 자리**라 이름이 나온다(session-teardown.ts 머리말). 코드만 본다.
    const codeOf = (path: string) =>
      readFileSync(join(process.cwd(), path), "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, " ")
        .replace(/\/\/[^\n]*/g, " ");
    const teardownCode = codeOf("src/offline/session-teardown.ts");
    expect(teardownCode).not.toContain("useOnboardingProgressStore");
    expect(teardownCode).not.toContain("resetOnboarding");
    // 근거의 사실 확인: 사람이 누르는 세 로그아웃 자리 중 어느 것도 진행도를 지우지 않는다.
    // (지운다면 그 셋과 맞추기 위해 teardown도 지워야 했을 것이다.)
    for (const path of ["app/settings/index.tsx", "src/security/AppLockOverlay.tsx", "app/settings/privacy.tsx"]) {
      expect(codeOf(path), path).not.toContain("resetOnboarding");
    }
  });

  it("비대칭의 사실 확인 — 세 로그아웃 화면은 각자 지우고, 만료 갈래만 이 배선에 기대고 있었다 (source verification)", () => {
    for (const path of ["app/settings/index.tsx", "src/security/AppLockOverlay.tsx", "app/settings/privacy.tsx"]) {
      const source = readFileSync(join(process.cwd(), path), "utf8");
      expect(source, path).toContain("useSelectedChildStore((state) => state.clearSelectedChildId)");
    }
    // 만료는 정체성을 남긴다 -- 그래서 그 순간에는 어떤 정리도 발화하지 않는다(AUTH-127).
    expect(isSessionIdentityChange(userASnapshot, expiredUserASnapshot)).toBe(false);
    // 비로소 뒤이은 타계정 로그인이 전이다. 그 자리가 이 라운드가 채운 구멍이다.
    expect(isSessionIdentityChange(expiredUserASnapshot, userBSnapshot)).toBe(true);
  });
});
