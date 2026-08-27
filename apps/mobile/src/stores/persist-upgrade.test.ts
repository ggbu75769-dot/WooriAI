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
 * LOCAL_SESSION_TOKEN : null)` prefers a non-null `accessToken` over the local/test session, and
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
    });

    it("drops a leftover lastEndReason with the leftover token, so a demo build never claims a session expired (AUTH-127 round27 L-1)", async () => {
      process.env.EXPO_PUBLIC_TEST_LOGIN = "1";
      const { secureSessionStorage } = await loadModules();

      // The same in-place upgrade as the test above, but the real build it replaced had ended its
      // last session on a refresh-401. A standalone build can never *have* an expiry (client.ts's
      // isLocalToken short-circuits before any 401 handling), so the inherited reason is corrupt
      // state exactly like the inherited token -- and left in place it puts AUTH-127's
      // "세션이 만료됐어요" notice on the demo build's login screen.
      await secureSessionStorage.setItem(
        SESSION_KEY,
        JSON.stringify({
          state: {
            accessToken: "leftover-real-access-token",
            refreshToken: "leftover-real-refresh-token",
            userId: "user-from-old-build",
            defaultHouseholdId: "household-from-old-build",
            isTestSession: false,
            lastEndReason: "expired"
          },
          version: 2
        })
      );

      const { useSessionStore } = await import("./session.store");
      const { shouldShowSessionExpiredNotice } = await import("../offline/session-expiry");
      await useSessionStore.persist.rehydrate();

      const state = useSessionStore.getState();
      expect(state.accessToken).toBeNull();
      expect(state.lastEndReason).toBeNull();
      expect(
        shouldShowSessionExpiredNotice({
          accessToken: state.accessToken,
          isTestSession: state.isTestSession,
          lastEndReason: state.lastEndReason
        })
      ).toBe(false);
    });

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

    /**
     * 라운드 40 J-9(1) — UX-R(M)의 역할 표(version 3)와 J-2의 가구 목록(version 4)이 **없던**
     * 블롭에서 올라올 때. 이 자리의 계약은 하나다: 모르는 것은 null로 남고, **모름은 아무것도
     * 잠그지 않는다**(잘못 잠그면 정상 사용자의 핵심 루프가 통째로 죽는다).
     */
    it("version-2 블롭(역할 표 없음)은 householdRoles/householdIds가 null이고 아무것도 잠기지 않는다", async () => {
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
            isTestSession: false,
            lastEndReason: null
            // householdRoles / householdIds: 이 버전에는 아예 없던 키다.
          },
          version: 2
        })
      );

      const { useSessionStore } = await import("./session.store");
      const { isExpenseEntryLocked, resolveHouseholdRole } = await import("../family/record-permissions");
      await useSessionStore.persist.rehydrate();

      const state = useSessionStore.getState();
      expect(state.accessToken).toBe("real-prod-access-token");
      expect(state.householdRoles).toBeNull();
      expect(state.householdIds).toBeNull();
      // 이어 붙인 실제 경로: 표가 없으면 역할은 모름이고, 모름은 잠그지 않는다.
      const role = resolveHouseholdRole({
        householdRoles: state.householdRoles,
        householdId: state.defaultHouseholdId,
        knownHouseholdIds: state.householdIds
      });
      expect(role).toBeUndefined();
      expect(isExpenseEntryLocked({ hasSession: true, role })).toBe(false);
    });

    /**
     * 라운드 41 K-3 — v3 블롭: **역할 표는 있는데 가구 목록(householdIds)이 없다**.
     *
     * 이 조합이 위 version-2 블롭보다 나쁜 이유: 표가 있으므로 "모름"이 아닌데도
     * `isSingleKnownHousehold`가 목록을 요구해 거짓이 되고, 결국 역할이 undefined로 떨어져
     * **보기 전용이 잠기지 않는다**. 잠기지 않으니 잠금 안내도 없고, 안내가 없으니 J-3의
     * 재검증도 발화하지 않아 재로그인 전까지 회복 경로가 아예 없었다. 그래서 이 상태는
     * "고쳐야 할 상태"로 판정되고(`needsHouseholdIdsRepair`), 호출부가 백그라운드 재검증으로
     * 스스로 빠져나온다.
     */
    it("v3 블롭(역할 표 있음 · 가구 목록 없음)은 잠기지 않은 채로 남고, 자가 치유 대상으로 판정된다", async () => {
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
            isTestSession: false,
            lastEndReason: null,
            householdRoles: { "household-1": "viewer" }
            // householdIds: version 4에서 추가된 키 -- v3 블롭에는 없다.
          },
          version: 3
        })
      );

      const { useSessionStore } = await import("./session.store");
      const { isExpenseEntryLocked, needsHouseholdIdsRepair, resolveHouseholdRole } = await import(
        "../family/record-permissions"
      );
      await useSessionStore.persist.rehydrate();

      const state = useSessionStore.getState();
      expect(state.householdRoles).toEqual({ "household-1": "viewer" });
      expect(state.householdIds).toBeNull();

      // 실제 화면 경로: 아이-가구 해석이 아직 없으면(홈 첫 프레임) 폴백이 꺼져 있어 잠기지 않는다.
      const unresolvedRole = resolveHouseholdRole({
        householdRoles: state.householdRoles,
        knownHouseholdIds: state.householdIds
      });
      expect(unresolvedRole).toBeUndefined();
      expect(isExpenseEntryLocked({ hasSession: true, role: unresolvedRole })).toBe(false);

      // 그래서 이 세션은 재검증으로 스스로 고쳐야 하는 상태다.
      expect(
        needsHouseholdIdsRepair({ householdRoles: state.householdRoles, knownHouseholdIds: state.householdIds })
      ).toBe(true);

      // 재검증이 서버 응답 한 벌(표 + 목록)을 넣고 나면 같은 경로가 정확히 잠긴다.
      useSessionStore.getState().setHouseholdRoles([{ id: "household-1", role: "viewer" }]);
      const healed = useSessionStore.getState();
      expect(healed.householdIds).toEqual(["household-1"]);
      expect(
        needsHouseholdIdsRepair({ householdRoles: healed.householdRoles, knownHouseholdIds: healed.householdIds })
      ).toBe(false);
      const healedRole = resolveHouseholdRole({
        householdRoles: healed.householdRoles,
        knownHouseholdIds: healed.householdIds
      });
      expect(healedRole).toBe("viewer");
      expect(isExpenseEntryLocked({ hasSession: true, role: healedRole })).toBe(true);
    });

    /**
     * 라운드 41 K-3 — 같은 상태를 만드는 다른 경로: 로그인 시점에 가구가 없던 계정
     * (`households: []`)이 초대를 수락한 순간. `setHouseholdRole`은 **한 가구에 대한 사실**만
     * 담으므로 목록은 계속 null이고, 그래서 v3 블롭과 똑같이 잠기지 않는다.
     */
    it("초대 수락 계정(로그인 시 households: [])도 같은 '표 있음 · 목록 없음' 상태가 된다", async () => {
      process.env.EXPO_PUBLIC_TEST_LOGIN = "0";
      await loadModules();
      const { useSessionStore } = await import("./session.store");
      const { needsHouseholdIdsRepair } = await import("../family/record-permissions");

      useSessionStore.getState().setSession({
        accessToken: "real-prod-access-token",
        refreshToken: "real-prod-refresh-token",
        userId: "user-1",
        households: []
      });
      expect(useSessionStore.getState().householdRoles).toBeNull();
      expect(useSessionStore.getState().householdIds).toBeNull();

      useSessionStore.getState().setHouseholdRole("household-new", "viewer");
      const joined = useSessionStore.getState();
      expect(joined.householdRoles).toEqual({ "household-new": "viewer" });
      expect(joined.householdIds).toBeNull();
      expect(
        needsHouseholdIdsRepair({ householdRoles: joined.householdRoles, knownHouseholdIds: joined.householdIds })
      ).toBe(true);
    });

    it("손상된 역할 표(배열·숫자·빈 값)를 정규화한다 — 남는 게 없으면 null(모름)", async () => {
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
            isTestSession: false,
            // 손으로 고친 저장소·미래 빌드·버그가 남길 수 있는 모양들.
            householdRoles: ["viewer", "owner"],
            householdIds: 12345
          },
          version: 4
        })
      );

      const { useSessionStore } = await import("./session.store");
      await useSessionStore.persist.rehydrate();

      expect(useSessionStore.getState().householdRoles).toBeNull();
      expect(useSessionStore.getState().householdIds).toBeNull();
    });

    it("역할 표에서 쓸 수 있는 쌍만 남기고, 가구 목록의 쓰레기 값은 걸러낸다", async () => {
      process.env.EXPO_PUBLIC_TEST_LOGIN = "0";
      const { secureSessionStorage } = await loadModules();

      await secureSessionStorage.setItem(
        SESSION_KEY,
        JSON.stringify({
          state: {
            accessToken: "real-prod-access-token",
            refreshToken: "real-prod-refresh-token",
            userId: "user-1",
            defaultHouseholdId: "h-1",
            isTestSession: false,
            householdRoles: { "h-1": "viewer", "h-2": 7, "h-3": "", "h-4": null },
            householdIds: ["h-1", "", 7, null, "h-1"]
          },
          version: 4
        })
      );

      const { useSessionStore } = await import("./session.store");
      await useSessionStore.persist.rehydrate();

      const state = useSessionStore.getState();
      expect(state.householdRoles).toEqual({ "h-1": "viewer" });
      // 중복·빈 값·잘못된 타입은 사라진다.
      expect(state.householdIds).toEqual(["h-1"]);
    });

    it("데모(standalone) 빌드는 남의 역할 표와 가구 목록을 토큰과 함께 버린다", async () => {
      process.env.EXPO_PUBLIC_TEST_LOGIN = "1";
      const { secureSessionStorage } = await loadModules();

      await secureSessionStorage.setItem(
        SESSION_KEY,
        JSON.stringify({
          state: {
            accessToken: "leftover-real-access-token",
            refreshToken: "leftover-real-refresh-token",
            userId: "user-from-old-build",
            defaultHouseholdId: "household-from-old-build",
            isTestSession: false,
            householdRoles: { "household-from-old-build": "viewer" },
            householdIds: ["household-from-old-build"]
          },
          version: 4
        })
      );

      const { useSessionStore } = await import("./session.store");
      await useSessionStore.persist.rehydrate();

      const state = useSessionStore.getState();
      expect(state.accessToken).toBeNull();
      expect(state.householdRoles).toBeNull();
      expect(state.householdIds).toBeNull();
    });
  });

  describe("selected-child.store.ts", () => {
    it("keeps a round4-shaped selectedChildId intact", async () => {
      const { persistStorage } = await loadModules();
      await persistStorage.setItem(
        SELECTED_CHILD_KEY,
        JSON.stringify({ state: { selectedChildId: "local-child-daon" }, version: 0 })
      );

      const { useSelectedChildStore } = await import("./selected-child.store");
      await useSelectedChildStore.persist.rehydrate();

      expect(useSelectedChildStore.getState().selectedChildId).toBe("local-child-daon");
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
    it("backfills expense.version, preparedItemsCompleted, and idempotencyKeys from a round4-shaped blob, and getHome/listItems/getMonthlyReport all still resolve", async () => {
      const { persistStorage } = await loadModules();
      const { LOCAL_CHILD_ID } = await import("../api/local-fixtures");

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
      expect(migrated.expenses[0].version).toBe(1);
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
