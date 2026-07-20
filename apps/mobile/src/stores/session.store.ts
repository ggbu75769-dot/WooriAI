import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { LOCAL_HOUSEHOLD_ID, LOCAL_USER_ID } from "../api/fixture-identifiers";
import { resolveOfflineScopeKey } from "../offline/session-scope";
import { isTestLoginBuild } from "../pixelLock/build-profile";
import { secureSessionStorage } from "./secure-session-storage";
import { selectedChildScopeKey, useSelectedChildStore } from "./selected-child.store";

export type SessionState = {
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
  "accessToken" | "refreshToken" | "userId" | "displayName" | "email" | "authProvider" | "defaultHouseholdId" | "isTestSession"
>;

function sanitizeSessionState<T extends SessionData>(state: T): T {
  if (isTestLoginBuild() && state.accessToken) {
    return { ...state, accessToken: null, refreshToken: null, displayName: null, email: null, authProvider: null };
  }
  return state;
}

const initialSessionState: SessionData = {
  accessToken: null,
  refreshToken: null,
  userId: null,
  displayName: null,
  email: null,
  authProvider: null,
  defaultHouseholdId: null,
  isTestSession: false
};

/** Defensive shape check for a persisted blob from an unknown/older app version -- anything that
 * doesn't look like a session falls back to a clean logged-out state instead of feeding
 * malformed data (wrong types) into the store. */
function isPlausibleSessionShape(value: unknown): value is Partial<SessionData> {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  const stringOrNull = (field: unknown) => field === null || field === undefined || typeof field === "string";
  return (
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
        const nextHouseholdId = session.defaultHouseholdId ?? null;
        if (current.userId !== session.userId || current.defaultHouseholdId !== nextHouseholdId) {
          useSelectedChildStore.getState().clearSelectedChildId();
          void import("./onboarding-draft.store").then(({ clearOnboardingDraft }) => clearOnboardingDraft());
        }
        useSelectedChildStore.getState().activateScope(nextHouseholdId ? selectedChildScopeKey(session.userId, nextHouseholdId) : null);
        set({
          accessToken: session.accessToken,
          refreshToken: session.refreshToken,
          userId: session.userId,
          displayName: session.displayName ?? null,
          email: session.email ?? null,
          authProvider: session.authProvider ?? null,
          defaultHouseholdId: nextHouseholdId,
          isTestSession: false
        });
      },
      setTokens: (accessToken, refreshToken) => set({ accessToken, refreshToken }),
      startTestSession: () => {
        useSelectedChildStore.getState().activateScope(selectedChildScopeKey(LOCAL_USER_ID, LOCAL_HOUSEHOLD_ID));
        useSelectedChildStore.getState().clearSelectedChildId();
        set({
          accessToken: null,
          refreshToken: null,
          userId: null,
          displayName: "테스트 사용자",
          email: null,
          authProvider: "test",
          defaultHouseholdId: null,
          isTestSession: true
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
        const receiptScopeKey = resolveOfflineScopeKey(current);
        if (receiptScopeKey) {
          void import("../receipts/offline-draft").then(({ clearReceiptOfflineDraft }) => clearReceiptOfflineDraft(receiptScopeKey));
        }
        void import("./onboarding-draft.store").then(({ clearOnboardingDraft }) => clearOnboardingDraft());
        useSelectedChildStore.getState().clearSelectedChildId();
        useSelectedChildStore.getState().activateScope(null);
        set({
          accessToken: null,
          refreshToken: null,
          userId: null,
          displayName: null,
          email: null,
          authProvider: null,
          defaultHouseholdId: null,
          isTestSession: false
        });
      }
    }),
    {
      name: "wooriai-session",
      storage: createJSONStorage(() => secureSessionStorage),
      // MOB-107: bump whenever this store's persisted shape changes so `migrate` below has a
      // chance to run against anything written by an older build (round4 and earlier wrote no
      // `version` at all, which zustand treats as version 0).
      version: 2,
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
