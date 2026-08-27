import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { usePurchaseFollowupStore } from "../commerce/purchase-followup.store";
import {
  deactivateRegisteredPushDevice,
  resetPushRegistrationForTests,
  usePushRegistrationStore
} from "../notifications/usePushDeviceRegistration";
import {
  registerAppQueryClient,
  resetAppQueryClientRegistryForTests
} from "../query/query-client-registry";
import { saveSyncCursor, SYNC_CURSOR_META_KEY } from "./delta-sync";
import { createMemoryOfflineStore } from "./memory-offline-store";
import {
  isSessionIdentityChange,
  teardownOfflineSessionState,
  type SessionIdentity
} from "./session-teardown";
import { flushOutbox, recordLocalCreate, wipeOfflineStore, type RemoteExpenseApi } from "./sync-engine";
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
  await saveSyncCursor(store, "user-a", "cursor-abc");
  usePurchaseFollowupStore.getState().recordLinkClick({
    itemTemplateId: "item-diaper",
    itemName: "기저귀",
    childId: "child-1",
    clickedAt: 1_700_000_000_000
  });
}

async function expectStoreFullyEmpty(store: OfflineStore): Promise<void> {
  expect(await store.listLocalExpenses()).toEqual([]);
  expect(await store.listOutboxMutations()).toEqual([]);
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
  });

  it("sync-controller mounts the teardown from the same session-store subscription as the cursor invalidation (source verification -- the controller is not runtime-testable under vitest, see its header comment)", () => {
    const controllerSource = readFileSync(join(process.cwd(), "src/offline/sync-controller.ts"), "utf8");
    const subscriptionBody = controllerSource.slice(controllerSource.indexOf("useSessionStore.subscribe"));
    expect(subscriptionBody).toContain("isSessionIdentityChange(previous, state)");
    expect(subscriptionBody).toContain("teardownOfflineSessionState(store, { authToken: outgoingToken })");
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
