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
  /**
   * UX-R(M) — 가구 id → 이 계정의 역할("owner" | "co_parent" | "viewer" | "gift_participant").
   *
   * 왜 세션 스토어인가: 역할은 자격증명과 같은 수명을 갖는 **세션 정체성** 데이터다. 로그인
   * 응답(`user.households[].role` — src/api/client.ts의 oauthLogin/kakaoExchange)과 초대 수락
   * 응답(`household.role`)이 이미 내려주므로 새 엔드포인트가 없고, `clearSession`/`setSession`이
   * 토큰과 **같은 set()** 으로 이 값을 갈아 끼우므로 토큰만 바뀌고 역할이 남는 창이 없다.
   *
   * 그래서 src/offline/session-teardown.ts에는 등록하지 않는다 — 그 모듈은 세션 **밖**의
   * 사용자 단위 상태(SQLite·outbox·purchase-followup·알림·홈 첫 실행)를 지우는 자리이고,
   * 그 teardown 자체가 이 스토어의 전이에서 촉발된다(sync-controller.ts). 여기 값을 그 목록에
   * 넣으면 자기 자신을 지우는 순환이 된다. 대신 아래 세 지점이 teardown과 같은 규칙을 지킨다:
   *   - `clearSession("logout")` → null (떠난 계정의 역할을 기기에 남기지 않는다);
   *   - `clearSession("expired")` → 유지 (AUTH-127 — 사람도 계정도 그대로다);
   *   - `setSession` / `startTestSession` → 들어오는 세션 값으로 **덮어쓴다**(누적하지 않는다).
   *
   * null은 "모름"이다(구세션·데모 세션). 판정은 모름을 절대 잠그지 않는다 —
   * src/family/record-permissions.ts 주석 참고.
   */
  householdRoles: Record<string, string> | null;
  /**
   * 라운드 40 J-2 — **서버가 말한** 이 계정의 가구 id 전체. 모르면 null.
   *
   * 왜 따로 드는가: 위 `householdRoles`는 세 경로에서 채워지는데(로그인 응답 = 전체 표,
   * 초대 수락·가족 화면 = 한 가구씩) 앞의 둘이 만든 **부분 표**를 전체로 착각하면
   * "가구가 하나뿐이니 이 역할을 쓰자"는 폴백이 남의 가구 역할로 자기 아이를 잠근다
   * (H1 owner + H2 viewer 사용자가 마이그레이션으로 표를 잃고 가족 화면에서 {H2:"viewer"}
   * 한 줄만 복구한 상태 — src/family/record-permissions.ts의 resolveHouseholdRole 참고).
   * 표의 행 수는 "내가 아는 것"이고, 이 목록은 "서버가 말한 것"이다. 둘이 일치할 때만
   * 폴백을 쓴다.
   *
   * 수명은 `householdRoles`와 똑같다(로그아웃 → null, 만료 → 유지, setSession → 덮어쓰기).
   */
  householdIds: string[] | null;
  setSession: (session: {
    accessToken: string;
    refreshToken: string;
    userId: string;
    defaultHouseholdId?: string | null;
    /** 로그인 응답의 `user.households`. 없으면 역할 미상(null)으로 둔다. */
    households?: ReadonlyArray<{ id: string; role?: string | null }> | null;
  }) => void;
  setTokens: (accessToken: string, refreshToken: string) => void;
  /**
   * UX-R(M): 한 가구의 역할만 갱신한다(초대 수락 직후, 그리고 가족 화면이 구성원 목록에서
   * 자기 역할을 확인했을 때). 표 전체를 갈아 끼우지 않으므로 다가구 계정의 다른 가구 역할이
   * 지워지지 않는다. 세션이 없으면(로그아웃 직후 늦게 도착한 응답) 아무것도 하지 않는다.
   */
  setHouseholdRole: (householdId: string, role: string) => void;
  /**
   * 라운드 40 J-3: 서버가 방금 말한 **가구 목록 전체**로 역할 표를 통째로 갈아 끼운다
   * (GET /me 재조회 응답). 승격(viewer → co_parent)이나 새 가구 참여가 여기서 한 번에
   * 반영되고, `householdIds`도 같은 응답으로 갱신되므로 부분 표가 남지 않는다.
   * 세션이 없으면(응답이 늦게 도착한 로그아웃 뒤) 아무것도 하지 않는다.
   */
  setHouseholdRoles: (households: ReadonlyArray<{ id: string; role?: string | null }>) => void;
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
  | "accessToken"
  | "refreshToken"
  | "userId"
  | "defaultHouseholdId"
  | "isTestSession"
  | "lastEndReason"
  | "householdRoles"
  | "householdIds"
>;

/** AUTH-127: a persisted blob can carry anything under `lastEndReason` (older build that never
 * wrote it, hand-edited storage, a future build's new reason). Anything outside the union collapses
 * to null — an unknown reason must never make the login screen claim a session expired. */
function normalizeEndReason(value: unknown): SessionEndReason | null {
  return value === "logout" || value === "expired" ? value : null;
}

/**
 * UX-R(M): 저장된 블롭이 `householdRoles` 자리에 무엇을 들고 있든(구버전 = 키 없음, 손으로 고친
 * 저장소, 배열/숫자) "문자열 → 비어 있지 않은 문자열" 쌍만 남긴다. 모양이 아니면 통째로 null —
 * 즉 "모름"이고, 판정은 모름을 잠그지 않으므로 최악의 결과가 예전 동작이다.
 */
function normalizeHouseholdRoles(value: unknown): Record<string, string> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const normalized: Record<string, string> = {};
  for (const [householdId, role] of Object.entries(value as Record<string, unknown>)) {
    if (householdId.length > 0 && typeof role === "string" && role.length > 0) normalized[householdId] = role;
  }
  return Object.keys(normalized).length > 0 ? normalized : null;
}

/** 로그인/초대 수락 응답의 households 배열 → 스토어가 들고 갈 표. 빈 배열이면 null(모름)이다. */
function householdRolesFrom(
  households: ReadonlyArray<{ id: string; role?: string | null }> | null | undefined
): Record<string, string> | null {
  if (!households) return null;
  return normalizeHouseholdRoles(
    Object.fromEntries(households.map((household) => [household.id, household.role ?? ""]))
  );
}

/**
 * 라운드 40 J-2: 저장된 블롭·응답이 `householdIds` 자리에 무엇을 들고 있든 "비어 있지 않은
 * 문자열"만 중복 없이 남긴다. 배열이 아니거나 남는 게 없으면 null — 즉 "모름"이고, 모름은
 * 가구 수를 근거로 한 폴백을 켜지 않으므로(= 잠그지 않는다) 최악의 결과가 예전 동작이다.
 */
function normalizeHouseholdIds(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const ids = Array.from(
    new Set(value.filter((id): id is string => typeof id === "string" && id.length > 0))
  );
  return ids.length > 0 ? ids : null;
}

/** 응답의 households 배열 → 서버가 말한 가구 id 목록. 없으면 null(모름)이다. */
function householdIdsFrom(
  households: ReadonlyArray<{ id: string; role?: string | null }> | null | undefined
): string[] | null {
  if (!households) return null;
  return normalizeHouseholdIds(households.map((household) => household.id));
}

function sanitizeSessionState<T extends SessionData>(state: T): T {
  const normalized: T = {
    ...state,
    lastEndReason: normalizeEndReason(state.lastEndReason),
    householdRoles: normalizeHouseholdRoles(state.householdRoles),
    householdIds: normalizeHouseholdIds(state.householdIds)
  };
  if (process.env.EXPO_PUBLIC_TEST_LOGIN === "1") {
    // AUTH-127 (round27 L-1): `lastEndReason` is part of the same leftover blob and has to go with
    // the tokens. A standalone/demo build can never *have* an expiry — client.ts's `isLocalToken`
    // short-circuits the refresh flow before any 401 handling — so a reason inherited from the
    // real-login build this one was installed over is corrupt state by the same MOB-107 rule that
    // condemns the token, and keeping it would put "세션이 만료됐어요" on the demo build's login
    // screen for a session that never existed on it. The reason is cleared even when the blob
    // carries no leftover token (the previous install's session had already expired, so its
    // tokens were null but the "expired" marker survived) — same corrupt-state rule.
    // UX-R(M): `householdRoles`도 같은 잔여 블롭의 일부다. 데모 빌드에는 실제 가구가 없으므로
    // 앞선 실로그인 설치가 남긴 역할 표는 정의상 남의 것이고, 남겨 두면 데모 세션에서 남의
    // 역할로 기록 입구가 잠길 수 있다 — 토큰과 같은 손상 상태 규칙으로 함께 지운다.
    if (
      !normalized.accessToken &&
      !normalized.refreshToken &&
      normalized.lastEndReason === null &&
      normalized.householdRoles === null &&
      normalized.householdIds === null
    ) {
      return normalized;
    }
    return {
      ...normalized,
      accessToken: null,
      refreshToken: null,
      lastEndReason: null,
      householdRoles: null,
      householdIds: null
    };
  }
  return normalized;
}

const initialSessionState: SessionData = {
  accessToken: null,
  refreshToken: null,
  userId: null,
  defaultHouseholdId: null,
  isTestSession: false,
  lastEndReason: null,
  householdRoles: null,
  householdIds: null
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
          lastEndReason: null,
          // UX-R(M): 들어오는 세션의 역할 표로 **덮어쓴다**. 로그인 응답이 households를 주지
          // 않으면(구 스텁 응답 등) null = 모름이고, 모름은 아무 진입점도 잠그지 않는다.
          householdRoles: householdRolesFrom(session.households),
          // 라운드 40 J-2: 같은 응답이 말한 가구 목록. 로그인 응답은 이 계정의 **전체**이므로
          // 이 순간의 역할 표는 전체 표다(그래서 폴백을 써도 안전하다).
          householdIds: householdIdsFrom(session.households)
        }),
      setTokens: (accessToken, refreshToken) => set({ accessToken, refreshToken }),
      setHouseholdRole: (householdId, role) =>
        set((state) => {
          if (!householdId || !role) return state;
          // 세션이 끝난 뒤 늦게 도착한 응답이 역할 표를 되살리지 않게 한다(로그아웃은
          // userId까지 지운다 — 위 clearSession 참고). 데모 세션은 isTestSession이 true다.
          if (!state.userId && !state.isTestSession) return state;
          // 라운드 40 J-2: 이 갱신은 **한 가구**에 대한 사실이다. 서버가 말한 가구 목록을
          // 여기서 "이게 전부"라고 넓히지 않는다 — 이미 알고 있는 목록에 없는 가구라면
          // (초대 수락으로 방금 늘었다) 그 하나만 더해 두고, 목록 자체를 모르면 계속 모른다.
          // 그래야 부분 표가 "가구가 하나뿐"으로 오해되지 않는다.
          const householdIds =
            state.householdIds && !state.householdIds.includes(householdId)
              ? [...state.householdIds, householdId]
              : state.householdIds;
          if (state.householdRoles?.[householdId] === role) {
            return householdIds === state.householdIds ? state : { householdIds };
          }
          return { householdRoles: { ...(state.householdRoles ?? {}), [householdId]: role }, householdIds };
        }),
      setHouseholdRoles: (households) =>
        set((state) => {
          if (!state.userId && !state.isTestSession) return state;
          const householdRoles = householdRolesFrom(households);
          // 서버가 "가구가 하나도 없다"고 말할 수도 있다(전부 탈퇴). 그때도 표를 비우는 것이
          // 정직한 결과다 — 모름(null)이 되어 아무것도 잠기지 않는다.
          return { householdRoles, householdIds: householdIdsFrom(households) };
        }),
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
          // UX-R(M): 데모 세션에는 서버 가구가 없다. 역할을 지어내지 않고 "모름"으로 두면
          // 데모는 예전과 한 글자도 다르지 않게 동작한다(모름은 잠그지 않는다).
          householdRoles: null,
          householdIds: null,
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
       *
       * UX-R(M): `householdRoles`는 정체성 쪽에 붙는다 — 로그아웃에서는 userId와 함께 지우고
       * (떠난 계정의 역할을 기기에 남기지 않는다), 만료에서는 그대로 둔다(같은 사람이 다시
       * 로그인하면 setSession이 서버 값으로 덮어쓴다). 자세한 근거는 위 필드 주석 참고.
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
                householdRoles: null,
                householdIds: null,
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
      // UX-R(M): 3 adds `householdRoles`. 역시 순수 추가라 version-2 블롭은 키가 없어 null(모름)로
      // 채워지고, 모름은 아무 진입점도 잠그지 않으므로 기존 세션의 동작이 바뀌지 않는다.
      // 라운드 40 J-2: 4 adds `householdIds`(서버가 말한 가구 목록). 같은 이유로 순수 추가이고,
      // 없으면 null = 모름이다 — 모르면 "가구가 하나뿐"이라는 폴백을 쓰지 않으므로, 옛 블롭에서
      // 올라온 세션은 부분 표 때문에 잘못 잠기는 일이 없다.
      version: 4,
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
