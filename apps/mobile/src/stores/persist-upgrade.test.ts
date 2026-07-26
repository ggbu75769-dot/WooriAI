import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * MOB-107 regression coverage: simulates a standalone-APK "upgrade install" (adb install -r over
 * an older build without ever clearing app storage) by seeding the same in-memory
 * persistStorage/secureSessionStorage backing that a real device's AsyncStorage/SecureStore would
 * have, using JSON shapes exactly as older builds wrote them (confirmed against `git show
 * a334140:...` -- the commit tagged as the round4 completion report, "docs: 라운드 4 개발 완료
 * 보고서"), then importing the *current* store modules fresh and asserting what comes out the
 * other end of rehydration.
 *
 * Round4 (a334140) vs current persisted shapes (see runtime-fix-progress.md for the full diff):
 *   - wooriai-session (session.store.ts): byte-identical. No schema drift here.
 *   - wooriai-selected-child (selected-child.store.ts): byte-identical. No schema drift here.
 *   - wooriai-onboarding-progress (onboarding-progress.store.ts): gained `childCreateIdempotencyKey`
 *     (MOB-101/Sprint1), additive/optional in practice.
 *   - wooriai-local-backend (local-backend.ts): gained `preparedItemsCompleted`, `idempotencyKeys`
 *     (both additive), and every `expenses[i]` record gained a *required* `version: number`
 *     (MOB-102/103/Sprint1) that round4 records never wrote -- `expense.version` would be
 *     `undefined` on every old expense without the migrate added here.
 *
 * None of those four diffs, on their own, explain the reported "무한 로딩" (Home/준비템 stuck
 * loading forever while 리포트 shows an explicit error) -- session/selectedChild are unchanged,
 * and the local-backend field gaps are either additive-safe (zustand's shallow merge keeps the
 * store's own defaults for keys absent from the persisted JSON) or don't affect any Home/Items
 * code path. What *does* reproduce it: client.ts's `authToken = accessToken ?? (isTestSession ?
 * fixtureSessionToken : null)` prefers a non-null `accessToken` over the local/test session, and
 * a *pre-test-login* build (or any build where a real Kakao login was exercised even once on the
 * same device, before test-login existed / was the only path) would have persisted a real,
 * non-null accessToken. Reinstalling a standalone (EXPO_PUBLIC_TEST_LOGIN=1) build over that
 * device inherits the leftover token, `hasSession` becomes true using a *real* token, and every
 * Home/Items/Reports query routes through `fetch()` against the standalone build's unreachable
 * `http://localhost:3000` default API host -- see client.ts's `fetchWithTimeout` doc comment,
 * which documents this exact failure from an on-device logcat repro. The tests below simulate
 * that leftover-real-session shape and assert the new migrate/merge sanitization in
 * session.store.ts neutralizes it.
 */

const SESSION_KEY = "wooriai-session";
const SELECTED_CHILD_KEY = "wooriai-selected-child";
const ONBOARDING_PROGRESS_KEY = "wooriai-onboarding-progress";
const LOCAL_BACKEND_KEY = "wooriai-local-backend";

async function loadModules() {
  const [{ persistStorage }, { secureSessionStorage }] = await Promise.all([
    import("./persist-storage"),
    import("./secure-session-storage")
  ]);
  return { persistStorage, secureSessionStorage };
}

describe("MOB-107: persisted-store upgrade compatibility", () => {
  const originalTestLoginEnv = process.env.EXPO_PUBLIC_TEST_LOGIN;

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    process.env.EXPO_PUBLIC_TEST_LOGIN = originalTestLoginEnv;
  });

  describe("session.store.ts", () => {
    it("drops a leftover real (non-test) accessToken on a standalone build instead of routing queries through it", async () => {
      process.env.EXPO_PUBLIC_TEST_LOGIN = "1";
      const { secureSessionStorage } = await loadModules();

      // A pre-test-login (or otherwise real-Kakao-login-exercised) build's persisted session --
      // isTestSession didn't exist yet on the very earliest builds, but even round4's shape
      // (isTestSession present, just false) reproduces the same bug once a real token exists.
      await secureSessionStorage.setItem(
        SESSION_KEY,
        JSON.stringify({
          state: {
            accessToken: "leftover-real-access-token",
            refreshToken: "leftover-real-refresh-token",
            userId: "user-from-old-build",
            defaultHouseholdId: "household-from-old-build",
            isTestSession: false
          },
          version: 0
        })
      );

      const { useSessionStore } = await import("./session.store");
      await useSessionStore.persist.rehydrate();

      const state = useSessionStore.getState();
      expect(state.accessToken).toBeNull();
      expect(state.refreshToken).toBeNull();
      // Non-token fields are not the source of the bug and are harmless to keep.
      expect(state.userId).toBe("user-from-old-build");
    }, 15_000);

    it("leaves a genuine test session (round4 shape) untouched", async () => {
      process.env.EXPO_PUBLIC_TEST_LOGIN = "1";
      const { secureSessionStorage } = await loadModules();

      await secureSessionStorage.setItem(
        SESSION_KEY,
        JSON.stringify({
          state: {
            accessToken: null,
            refreshToken: null,
            userId: null,
            defaultHouseholdId: null,
            isTestSession: true
          },
          version: 1
        })
      );

      const { useSessionStore } = await import("./session.store");
      await useSessionStore.persist.rehydrate();

      expect(useSessionStore.getState()).toMatchObject({
        accessToken: null,
        refreshToken: null,
        isTestSession: true
      });
    });

    it("keeps a real accessToken intact on a non-standalone (production) build", async () => {
      process.env.EXPO_PUBLIC_TEST_LOGIN = "0";
      const { secureSessionStorage } = await loadModules();

      await secureSessionStorage.setItem(
        SESSION_KEY,
        JSON.stringify({
          state: {
            accessToken: "real-prod-access-token",
            refreshToken: "real-prod-refresh-token",
            userId: "user-1",
            defaultHouseholdId: "household-1",
            isTestSession: false
          },
          version: 0
        })
      );

      const { useSessionStore } = await import("./session.store");
      await useSessionStore.persist.rehydrate();

      expect(useSessionStore.getState().accessToken).toBe("real-prod-access-token");
    });

    it("resets to a clean logged-out state instead of crashing on a malformed persisted blob", async () => {
      process.env.EXPO_PUBLIC_TEST_LOGIN = "1";
      const { persistStorage } = await loadModules();
      // Something unparseable-as-a-session (e.g. truncated write, or a completely different
      // schema from a much older/unrelated build) sitting under the same storage key.
      await persistStorage.setItem(SESSION_KEY, JSON.stringify({ state: { accessToken: 12345 }, version: 0 }));

      const { useSessionStore } = await import("./session.store");
      await expect(useSessionStore.persist.rehydrate()).resolves.not.toThrow();
      expect(useSessionStore.getState()).toMatchObject({ accessToken: null, refreshToken: null, isTestSession: false });
    });
  });

  describe("selected-child.store.ts", () => {
    it("clears the exact legacy synthetic selectedChildId during upgrade", async () => {
      const { persistStorage } = await loadModules();
      await persistStorage.setItem(
        SELECTED_CHILD_KEY,
        JSON.stringify({ state: { selectedChildId: "local-child-daon" }, version: 0 })
      );

      const { useSelectedChildStore } = await import("./selected-child.store");
      await useSelectedChildStore.persist.rehydrate();

      expect(useSelectedChildStore.getState().selectedChildId).toBeNull();
    });

    it("resets a corrupt (wrong-typed) selectedChildId to null instead of poisoning every query's enabled check", async () => {
      const { persistStorage } = await loadModules();
      await persistStorage.setItem(SELECTED_CHILD_KEY, JSON.stringify({ state: { selectedChildId: 12345 }, version: 0 }));

      const { useSelectedChildStore } = await import("./selected-child.store");
      await useSelectedChildStore.persist.rehydrate();

      expect(useSelectedChildStore.getState().selectedChildId).toBeNull();
    });
  });

  describe("onboarding-progress.store.ts", () => {
    it("backfills childCreateIdempotencyKey (absent in round4) without disturbing existing progress", async () => {
      const { persistStorage } = await loadModules();
      await persistStorage.setItem(
        ONBOARDING_PROGRESS_KEY,
        JSON.stringify({
          state: {
            completedStepIds: ["ONB-001", "ONB-002"],
            hasReachedHome: true,
            childDraft: { stageMode: "born", nickname: "다온이", dueDate: "", birthDate: "2024-01-01", manualStage: null }
            // childCreateIdempotencyKey intentionally absent (round4 shape).
          },
          version: 0
        })
      );

      const { useOnboardingProgressStore } = await import("./onboarding-progress.store");
      await useOnboardingProgressStore.persist.rehydrate();

      const state = useOnboardingProgressStore.getState();
      expect(state.hasReachedHome).toBe(true);
      expect(state.completedStepIds).toEqual(["ONB-001", "ONB-002"]);
      expect(state.childDraft.nickname).toBe("다온이");
      expect(state.childCreateIdempotencyKey).toBeNull();
    });
  });

  describe("local-backend.ts", () => {
    it("backfills expense.version, preparedItemsCompleted, idempotencyKeys, and additionalChildren from a round4-shaped blob, and getHome/listItems/getMonthlyReport all still resolve", async () => {
      const { persistStorage } = await loadModules();
      const { LOCAL_CHILD_ID, LOCAL_HOUSEHOLD_ID, LOCAL_USER_ID } = await import("../api/local-fixtures");

      await persistStorage.setItem(
        LOCAL_BACKEND_KEY,
        JSON.stringify({
          state: {
            seeded: true,
            child: { id: LOCAL_CHILD_ID, nickname: "다온이", birthDate: "2024-01-01", deletedAt: null },
            budgets: { "2026-01": 1_600_000 },
            expenses: [
              {
                id: "local-expense-old-1",
                childId: LOCAL_CHILD_ID,
                categoryId: "local-category-diaper",
                amountKrw: 45900,
                spentOn: "2026-01-05",
                itemName: "기저귀",
                merchant: null,
                memo: null,
                paymentMethod: "unknown",
                linkedItemTemplateId: null,
                expenseType: "expense",
                source: "manual",
                createdAt: "2026-01-05T00:00:00.000Z",
                updatedAt: "2026-01-05T00:00:00.000Z",
                deletedAt: null
                // `version` intentionally absent -- round4 never wrote it.
              }
            ],
            itemStatuses: {},
            todayActionPreferences: [
              {
                userId: LOCAL_USER_ID,
                householdId: LOCAL_HOUSEHOLD_ID,
                childId: LOCAL_CHILD_ID,
                scopeKey: LOCAL_CHILD_ID,
                actionKey: "safety:persisted-suppression",
                mode: "snooze",
                snoozedUntil: "2099-01-01",
                version: 1
              },
              {
                userId: "foreign-user",
                householdId: LOCAL_HOUSEHOLD_ID,
                childId: LOCAL_CHILD_ID,
                scopeKey: LOCAL_CHILD_ID,
                actionKey: "foreign-principal",
                mode: "snooze",
                snoozedUntil: "2099-01-01",
                version: 1
              },
              {
                userId: LOCAL_USER_ID,
                householdId: LOCAL_HOUSEHOLD_ID,
                childId: LOCAL_CHILD_ID,
                scopeKey: LOCAL_CHILD_ID,
                actionKey: "invalid-date",
                mode: "snooze",
                snoozedUntil: "2099-02-31",
                version: 0
              }
            ],
            acknowledgedSafetyAlertIds: [
              "foreign-safety-alert",
              `local-safety-alternative-alert:${LOCAL_CHILD_ID}`
            ],
            members: [],
            invites: [],
            importJobs: [],
            importRows: {},
            consents: [
              { type: "terms", version: "2026-07-06", accepted: true },
              { type: "privacy", version: "2026-07-06", accepted: true }
            ],
            accountDeletedAt: null
            // `preparedItemsCompleted` and `idempotencyKeys` intentionally absent -- round4 shape.
          },
          version: 1
        })
      );

      const localBackendModule = await import("../api/local-backend");
      const { useLocalBackendStore } = localBackendModule;
      await useLocalBackendStore.persist.rehydrate();

      const migrated = useLocalBackendStore.getState();
      expect(migrated.preparedItemsCompleted).toBe(false);
      expect(migrated.idempotencyKeys).toEqual({});
      expect(migrated.additionalChildren).toEqual([]);
      expect(migrated.todayActionPreferences).toEqual([]);
      expect(migrated.acknowledgedSafetyAlertIds)
        .toEqual([`local-safety-alternative-alert:${LOCAL_CHILD_ID}`]);
      expect(migrated.expenses[0].version).toBe(1);
      expect(migrated.expenses[0].paymentMethodId).toBeNull();
      expect(migrated.seeded).toBe(true);

      // The concrete Home/준비템/리포트 code paths must not throw against migrated data --
      // exactly what would otherwise leave those screens' react-query queries permanently
      // rejected/unresolved.
      expect(() => localBackendModule.getHome(LOCAL_CHILD_ID)).not.toThrow();
      expect(() => localBackendModule.listItems(LOCAL_CHILD_ID, "now")).not.toThrow();
      expect(() => localBackendModule.getMonthlyReport(LOCAL_CHILD_ID, "2026-01")).not.toThrow();

      const home = localBackendModule.getHome(LOCAL_CHILD_ID);
      expect(home.recentExpenses[0].id).toBe("local-expense-old-1");
    });

    it("safely reseeds instead of crashing when the persisted blob is fundamentally corrupt", async () => {
      const { persistStorage } = await loadModules();
      await persistStorage.setItem(LOCAL_BACKEND_KEY, JSON.stringify({ state: { expenses: "not-an-array" }, version: 1 }));

      const localBackendModule = await import("../api/local-backend");
      const { useLocalBackendStore } = localBackendModule;
      await expect(useLocalBackendStore.persist.rehydrate()).resolves.not.toThrow();

      expect(useLocalBackendStore.getState().expenses).toEqual([]);
      const { LOCAL_CHILD_ID } = await import("../api/local-fixtures");
      expect(() => localBackendModule.getHome(LOCAL_CHILD_ID)).not.toThrow();
    });
  });

  describe("full upgrade simulation (all four stores seeded with round4 shapes at once)", () => {
    it("produces a working demo session end-to-end: hasSession resolves true and getHome succeeds", async () => {
      process.env.EXPO_PUBLIC_TEST_LOGIN = "1";
      const { persistStorage, secureSessionStorage } = await loadModules();
      const { LOCAL_CHILD_ID } = await import("../api/local-fixtures");

      await secureSessionStorage.setItem(
        SESSION_KEY,
        JSON.stringify({
          state: { accessToken: null, refreshToken: null, userId: null, defaultHouseholdId: null, isTestSession: true },
          version: 1
        })
      );
      await persistStorage.setItem(
        SELECTED_CHILD_KEY,
        JSON.stringify({ state: { selectedChildId: LOCAL_CHILD_ID }, version: 0 })
      );
      await persistStorage.setItem(
        ONBOARDING_PROGRESS_KEY,
        JSON.stringify({ state: { completedStepIds: [], hasReachedHome: true, childDraft: {} }, version: 0 })
      );
      await persistStorage.setItem(
        LOCAL_BACKEND_KEY,
        JSON.stringify({
          state: {
            seeded: true,
            child: { id: LOCAL_CHILD_ID, nickname: "다온이", birthDate: "2024-01-01", deletedAt: null },
            budgets: { "2026-01": 1_600_000 },
            expenses: [],
            itemStatuses: {},
            members: [],
            invites: [],
            importJobs: [],
            importRows: {},
            consents: [],
            accountDeletedAt: null
          },
          version: 1
        })
      );

      const { useSessionStore } = await import("./session.store");
      const { useSelectedChildStore } = await import("./selected-child.store");
      const localBackendModule = await import("../api/local-backend");
      await Promise.all([
        useSessionStore.persist.rehydrate(),
        useSelectedChildStore.persist.rehydrate(),
        localBackendModule.useLocalBackendStore.persist.rehydrate()
      ]);

      const accessToken = useSessionStore.getState().accessToken;
      const isTestSession = useSessionStore.getState().isTestSession;
      const childId = useSelectedChildStore.getState().selectedChildId;
      // Mirrors app/(tabs)/index.tsx's own derivation exactly.
      const authToken = accessToken ?? (isTestSession ? "wooriai-local-session" : null);
      const hasSession = Boolean(authToken && childId);

      expect(hasSession).toBe(true);
      expect(() => localBackendModule.getHome(childId!)).not.toThrow();
    });
  });
});
