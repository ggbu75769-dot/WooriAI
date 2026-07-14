import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { ensureLocalBackendSeeded } from "../api/local-backend";
import { LOCAL_CHILD_ID } from "../api/local-fixtures";
import { secureSessionStorage } from "./secure-session-storage";
import { useSelectedChildStore } from "./selected-child.store";

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
  startTestSession: () => void;
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
  if (process.env.EXPO_PUBLIC_TEST_LOGIN === "1" && state.accessToken) {
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
    (set) => ({
      ...initialSessionState,
      setSession: (session) =>
        set({
          accessToken: session.accessToken,
          refreshToken: session.refreshToken,
          userId: session.userId,
          displayName: session.displayName ?? null,
          email: session.email ?? null,
          authProvider: session.authProvider ?? null,
          defaultHouseholdId: session.defaultHouseholdId ?? null,
          isTestSession: false
        }),
      setTokens: (accessToken, refreshToken) => set({ accessToken, refreshToken }),
      startTestSession: () => {
        ensureLocalBackendSeeded();
        if (!useSelectedChildStore.getState().selectedChildId) {
          useSelectedChildStore.getState().setSelectedChildId(LOCAL_CHILD_ID);
        }
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
      },
      clearSession: () =>
        set({
          accessToken: null,
          refreshToken: null,
          userId: null,
          displayName: null,
          email: null,
          authProvider: null,
          defaultHouseholdId: null,
          isTestSession: false
        })
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
