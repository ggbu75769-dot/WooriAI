import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { ensureLocalBackendSeeded } from "../api/local-backend";
import { LOCAL_CHILD_ID } from "../api/local-fixtures";
import { secureSessionStorage } from "./secure-session-storage";
import { useSelectedChildStore } from "./selected-child.store";

/**
 * AUTH-127 — why a session ended.
 *
 * - `"logout"`: the user asked for it (설정 로그아웃, 계정 삭제, 픽셀락 진입). Deliberate, and the
 *   user does not expect anything of theirs to survive on this device.
 * - `"expired"`: involuntary. The refresh token was rejected with 401 — its 30-day TTL ran out, or
 *   the server revoked the family after a reuse detection. The user did nothing and still expects
 *   their unsynced records to be there when they log back in.
 *
 * The distinction is what `clearSession` branches on (see below) and what the login screen reads to
 * decide whether to explain the interruption.
 */
export type SessionEndReason = "logout" | "expired";

export type SessionState = {
  accessToken: string | null;
  refreshToken: string | null;
  userId: string | null;
  defaultHouseholdId: string | null;
  isTestSession: boolean;
  /** AUTH-127: how the last session ended, or null while a session is live / never had one. */
  lastEndReason: SessionEndReason | null;
  setSession: (session: {
    accessToken: string;
    refreshToken: string;
    userId: string;
    defaultHouseholdId?: string | null;
  }) => void;
  setTokens: (accessToken: string, refreshToken: string) => void;
  startTestSession: () => void;
  /**
   * AUTH-127: `reason` defaults to `"logout"`, which is byte-for-byte the pre-AUTH-127 behavior —
   * every existing call site (app/settings/index.tsx, app/settings/privacy.tsx, app/pixel-lock.tsx,
   * tests) means an explicit logout and keeps it without passing anything. Only client.ts's
   * refresh-401 paths pass `"expired"`.
   */
  clearSession: (reason?: SessionEndReason) => void;
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
  "accessToken" | "refreshToken" | "userId" | "defaultHouseholdId" | "isTestSession" | "lastEndReason"
>;

/** AUTH-127: a persisted blob can carry anything under `lastEndReason` (older build that never
 * wrote it, hand-edited storage, a future build's new reason). Anything outside the union collapses
 * to null — an unknown reason must never make the login screen claim a session expired. */
function normalizeEndReason(value: unknown): SessionEndReason | null {
  return value === "logout" || value === "expired" ? value : null;
}

function sanitizeSessionState<T extends SessionData>(state: T): T {
  const normalized: T = { ...state, lastEndReason: normalizeEndReason(state.lastEndReason) };
  if (process.env.EXPO_PUBLIC_TEST_LOGIN === "1" && normalized.accessToken) {
    return { ...normalized, accessToken: null, refreshToken: null };
  }
  return normalized;
}

const initialSessionState: SessionData = {
  accessToken: null,
  refreshToken: null,
  userId: null,
  defaultHouseholdId: null,
  isTestSession: false,
  lastEndReason: null
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
          defaultHouseholdId: session.defaultHouseholdId ?? null,
          isTestSession: false,
          // AUTH-127: a live session has no "how it ended" — clearing this is what takes the
          // expiry notice off the login screen once the user is back in.
          lastEndReason: null
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
          defaultHouseholdId: null,
          isTestSession: true,
          lastEndReason: null
        });
      },
      /**
       * AUTH-127 — two shapes, one for each reason.
       *
       * `"logout"` (default, unchanged): drops credentials AND identity. PRIV-104's teardown keys
       * on exactly that `userId` → null transition (see src/offline/session-teardown.ts), so the
       * outbox/local rows/query cache are wiped with it — which is right, because after a
       * deliberate logout there is no token left to ever flush those rows with.
       *
       * `"expired"`: drops ONLY the credentials. The refresh token died; the person holding the
       * phone did not change. Keeping `userId`/`defaultHouseholdId` means the session-store
       * *identity* is unchanged, so `isSessionIdentityChange` stays false and PRIV-104's teardown
       * never fires — the unsynced outbox survives, and a re-login by the SAME user (setSession
       * with the same userId — still not an identity change) resumes flushing it. A login by a
       * DIFFERENT user is still an A → B identity change and still wipes everything first, so the
       * cross-account leak PRIV-104 exists to prevent is untouched. Every auth gate in the app
       * reads `accessToken` (app/index.tsx, app/(tabs)/_layout.tsx, every screen's
       * `Boolean(authToken && childId)`), never `userId`, so a retained userId cannot make the app
       * look logged in.
       */
      clearSession: (reason: SessionEndReason = "logout") =>
        set(
          reason === "expired"
            ? { accessToken: null, refreshToken: null, lastEndReason: "expired" }
            : {
                accessToken: null,
                refreshToken: null,
                userId: null,
                defaultHouseholdId: null,
                isTestSession: false,
                lastEndReason: "logout"
              }
        )
    }),
    {
      name: "wooriai-session",
      storage: createJSONStorage(() => secureSessionStorage),
      // MOB-107: bump whenever this store's persisted shape changes so `migrate` below has a
      // chance to run against anything written by an older build (round4 and earlier wrote no
      // `version` at all, which zustand treats as version 0).
      // AUTH-127: 2 adds `lastEndReason`. Purely additive — a version-1 blob simply lacks the key
      // and `{...initialSessionState, ...persisted}` fills in null — but the rule above is bumped
      // anyway so the shape and the version never drift apart.
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
