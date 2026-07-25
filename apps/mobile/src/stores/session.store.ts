import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { LOCAL_HOUSEHOLD_ID, LOCAL_USER_ID } from "../api/fixture-identifiers";
import { resolveOfflineScopeKey } from "../offline/session-scope";
import { isTestLoginBuild } from "../pixelLock/build-profile";
import { secureSessionStorage } from "./secure-session-storage";
import {
  householdIdForSelectedChildScope,
  selectedChildScopeKey,
  useSelectedChildStore
} from "./selected-child.store";

export type SessionState = {
  /**
   * Monotonic identity epoch. Token rotation deliberately does not change it,
   * while login, logout, and test-session transitions always do. In-flight
   * requests use this to prove that a refresh result still belongs to the
   * session that initiated it before writing credentials back to the store.
   */
  sessionGeneration: number;
  accessToken: string | null;
  refreshToken: string | null;
  userId: string | null;
  displayName: string | null;
  email: string | null;
  authProvider: "kakao" | "apple" | "google" | "test" | null;
  defaultHouseholdId: string | null;
  isTestSession: boolean;
  setSession: (session: {
    accessToken: string;
    refreshToken: string;
    userId: string;
    displayName?: string | null;
    email?: string | null;
    authProvider?: "kakao" | "apple" | "google" | null;
    defaultHouseholdId?: string | null;
  }) => void;
  setTokens: (accessToken: string, refreshToken: string) => void;
  startTestSession: () => Promise<void>;
  clearSession: () => void;
};

/**
 * MOB-107: a standalone/demo APK build (EXPO_PUBLIC_TEST_LOGIN=1) has no reachable backend --
 * `startTestSession` never sets a real accessToken, so the only way this store can end up with a
 * non-null accessToken on such a build is leftover data from an earlier install on the same
 * device (e.g. a pre-test-login dev/debug build that used a real Kakao login, later upgraded
 * in-place without ever clearing app storage). client.ts's `authToken = accessToken ?? ...`
 * always prefers a non-null accessToken over the local session token, so that leftover value
 * silently routes every query through a real `fetch()` against an unreachable API host --
 * exactly the "무한 로딩" bug documented in client.ts's `fetchWithTimeout` comment. A standalone
 * build can never do anything useful with a real token anyway, so treat one as corrupt state and
 * drop it on every rehydration (not just a one-time migration) so this is self-healing even if a
 * later side-loaded build reintroduces the problem.
 */
type SessionData = Pick<
  SessionState,
  | "sessionGeneration"
  | "accessToken"
  | "refreshToken"
  | "userId"
  | "displayName"
  | "email"
  | "authProvider"
  | "defaultHouseholdId"
  | "isTestSession"
>;

function sanitizeSessionState<T extends SessionData>(state: T): T {
  if (isTestLoginBuild() && state.accessToken) {
    return { ...state, accessToken: null, refreshToken: null, displayName: null, email: null, authProvider: null };
  }
  return state;
}

const initialSessionState: SessionData = {
  sessionGeneration: 0,
  accessToken: null,
  refreshToken: null,
  userId: null,
  displayName: null,
  email: null,
  authProvider: null,
  defaultHouseholdId: null,
  isTestSession: false
};

function purchaseScopeForSession(
  session: Pick<SessionState, "accessToken" | "userId" | "defaultHouseholdId" | "isTestSession">,
  selectedChildId: string | null,
  selectedChildHouseholdId: string | null
) {
  return resolveOfflineScopeKey({
    ...session,
    defaultHouseholdId: householdIdForSelectedChildScope(
      selectedChildId,
      selectedChildHouseholdId,
      session.defaultHouseholdId
    ),
    testUserId: LOCAL_USER_ID,
    testHouseholdId: LOCAL_HOUSEHOLD_ID
  });
}

function schedulePurchaseFollowupCleanup(
  previousScopeKey: string | null,
  transitionGeneration: number,
  options: {
    clearAllWhenStillLoggedOut?: boolean;
    clearOtherScopes?: boolean;
  } = {}
) {
  void import("../purchase-followup/store").then(
    async ({
      clearAllPurchaseFollowups,
      clearPurchaseFollowupScope,
      clearPurchaseFollowupsExceptScope
    }) => {
      const current = useSessionStore.getState();
      const selectedChild = useSelectedChildStore.getState();
      const currentScopeKey = purchaseScopeForSession(
        current,
        selectedChild.selectedChildId,
        selectedChild.selectedChildHouseholdId
      );
      const transitionStillCurrent = current.sessionGeneration === transitionGeneration;
      if (
        options.clearAllWhenStillLoggedOut &&
        transitionStillCurrent &&
        !current.accessToken &&
        !current.isTestSession
      ) {
        await clearAllPurchaseFollowups();
        return;
      }
      if (options.clearAllWhenStillLoggedOut || options.clearOtherScopes) {
        await clearPurchaseFollowupsExceptScope(currentScopeKey);
        return;
      }
      // A rapid sign-out/sign-in must never let a stale async cleanup erase the
      // newly active identity's data, even when it is the same account.
      if (previousScopeKey && previousScopeKey !== currentScopeKey) {
        await clearPurchaseFollowupScope(previousScopeKey);
      }
    }
  ).catch(() => undefined);
}

function scheduleReceiptDraftCleanup(
  previousScopeKey: string | null,
  transitionGeneration: number,
  options: {
    clearAllWhenStillLoggedOut?: boolean;
    clearOtherScopes?: boolean;
  } = {}
) {
  void import("../receipts/offline-draft").then(async ({
    clearAllReceiptOfflineDrafts,
    clearReceiptOfflineDraft,
    clearReceiptOfflineDraftsExceptScope
  }) => {
    const current = useSessionStore.getState();
    const selectedChild = useSelectedChildStore.getState();
    const currentScopeKey = purchaseScopeForSession(
      current,
      selectedChild.selectedChildId,
      selectedChild.selectedChildHouseholdId
    );
    const transitionStillCurrent = current.sessionGeneration === transitionGeneration;
    if (
      options.clearAllWhenStillLoggedOut &&
      transitionStillCurrent &&
      !current.accessToken &&
      !current.isTestSession
    ) {
      await clearAllReceiptOfflineDrafts();
      return;
    }
    if (options.clearAllWhenStillLoggedOut || options.clearOtherScopes) {
      await clearReceiptOfflineDraftsExceptScope(currentScopeKey);
      return;
    }
    if (previousScopeKey !== currentScopeKey) {
      if (previousScopeKey) await clearReceiptOfflineDraft(previousScopeKey);
    }
  }).catch(() => undefined);
}

/** Defensive shape check for a persisted blob from an unknown/older app version -- anything that
 * doesn't look like a session falls back to a clean logged-out state instead of feeding
 * malformed data (wrong types) into the store. */
function isPlausibleSessionShape(value: unknown): value is Partial<SessionData> {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  const stringOrNull = (field: unknown) => field === null || field === undefined || typeof field === "string";
  return (
    (candidate.sessionGeneration === undefined ||
      (typeof candidate.sessionGeneration === "number" &&
        Number.isSafeInteger(candidate.sessionGeneration) &&
        candidate.sessionGeneration >= 0)) &&
    stringOrNull(candidate.accessToken) &&
    stringOrNull(candidate.refreshToken) &&
    stringOrNull(candidate.userId) &&
    stringOrNull(candidate.displayName) &&
    stringOrNull(candidate.email) &&
    stringOrNull(candidate.authProvider) &&
    stringOrNull(candidate.defaultHouseholdId)
  );
}

export const useSessionStore = create<SessionState>()(
  persist(
    (set, get) => ({
      ...initialSessionState,
      setSession: (session) => {
        const current = get();
        const identityChanged =
          current.userId !== session.userId ||
          current.isTestSession;
        const previousScopeKey = purchaseScopeForSession(
          current,
          useSelectedChildStore.getState().selectedChildId,
          useSelectedChildStore.getState().selectedChildHouseholdId
        );
        const nextHouseholdId = session.defaultHouseholdId ?? null;
        if (current.userId !== session.userId || current.defaultHouseholdId !== nextHouseholdId) {
          useSelectedChildStore.getState().clearSelectedChildId();
          void import("./onboarding-draft.store").then(({ clearOnboardingDraft }) => clearOnboardingDraft());
        }
        useSelectedChildStore.getState().activateScope(nextHouseholdId ? selectedChildScopeKey(session.userId, nextHouseholdId) : null);
        const nextGeneration = current.sessionGeneration + 1;
        set({
          sessionGeneration: nextGeneration,
          accessToken: session.accessToken,
          refreshToken: session.refreshToken,
          userId: session.userId,
          displayName: session.displayName ?? null,
          email: session.email ?? null,
          authProvider: session.authProvider ?? null,
          defaultHouseholdId: nextHouseholdId,
          isTestSession: false
        });
        schedulePurchaseFollowupCleanup(previousScopeKey, nextGeneration, {
          clearOtherScopes: identityChanged
        });
        scheduleReceiptDraftCleanup(previousScopeKey, nextGeneration, {
          clearOtherScopes: identityChanged
        });
      },
      setTokens: (accessToken, refreshToken) => set({ accessToken, refreshToken }),
      startTestSession: () => {
        const current = get();
        const previousScopeKey = purchaseScopeForSession(
          current,
          useSelectedChildStore.getState().selectedChildId,
          useSelectedChildStore.getState().selectedChildHouseholdId
        );
        useSelectedChildStore.getState().activateScope(selectedChildScopeKey(LOCAL_USER_ID, LOCAL_HOUSEHOLD_ID));
        useSelectedChildStore.getState().clearSelectedChildId();
        const nextGeneration = current.sessionGeneration + 1;
        set({
          sessionGeneration: nextGeneration,
          accessToken: null,
          refreshToken: null,
          userId: null,
          displayName: "테스트 사용자",
          email: null,
          authProvider: "test",
          defaultHouseholdId: null,
          isTestSession: true
        });
        schedulePurchaseFollowupCleanup(previousScopeKey, nextGeneration, {
          clearOtherScopes: true
        });
        scheduleReceiptDraftCleanup(previousScopeKey, nextGeneration, {
          clearOtherScopes: true
        });
        return Promise.all([
          import("./onboarding-progress.store"),
          import("./onboarding-draft.store"),
          import("../api/fixture-runtime")
        ]).then(([{ useOnboardingProgressStore }, { useOnboardingDraftStore }, { startLocalOnboardingSession }]) => {
          useOnboardingProgressStore.getState().resetOnboarding();
          useOnboardingDraftStore.getState().activateScope(LOCAL_USER_ID, LOCAL_HOUSEHOLD_ID);
          startLocalOnboardingSession();
        });
      },
      clearSession: () => {
        const current = get();
        const receiptScopeKey = purchaseScopeForSession(
          current,
          useSelectedChildStore.getState().selectedChildId,
          useSelectedChildStore.getState().selectedChildHouseholdId
        );
        void import("./onboarding-draft.store").then(({ clearOnboardingDraft }) => clearOnboardingDraft());
        useSelectedChildStore.getState().clearSelectedChildId();
        useSelectedChildStore.getState().activateScope(null);
        const nextGeneration = current.sessionGeneration + 1;
        set({
          sessionGeneration: nextGeneration,
          accessToken: null,
          refreshToken: null,
          userId: null,
          displayName: null,
          email: null,
          authProvider: null,
          defaultHouseholdId: null,
          isTestSession: false
        });
        schedulePurchaseFollowupCleanup(receiptScopeKey, nextGeneration, {
          clearAllWhenStillLoggedOut: true
        });
        scheduleReceiptDraftCleanup(receiptScopeKey, nextGeneration, {
          clearAllWhenStillLoggedOut: true
        });
      }
    }),
    {
      name: "wooriai-session",
      storage: createJSONStorage(() => secureSessionStorage),
      // MOB-107: bump whenever this store's persisted shape changes so `migrate` below has a
      // chance to run against anything written by an older build (round4 and earlier wrote no
      // `version` at all, which zustand treats as version 0).
      version: 3,
      migrate: (persisted) =>
        sanitizeSessionState(
          isPlausibleSessionShape(persisted)
            ? { ...initialSessionState, ...persisted } as SessionState
            : (initialSessionState as SessionState)
        ),
      // `merge` (unlike `migrate`) runs on every rehydration regardless of version, so the
      // leftover-real-token guard above self-heals even for already-migrated (version 1) data --
      // e.g. a different, older-but-still-version-1 build side-loaded onto the same device.
      merge: (persisted, current) =>
        sanitizeSessionState({
          ...current,
          ...(isPlausibleSessionShape(persisted) ? persisted : {})
        })
    }
  )
);
