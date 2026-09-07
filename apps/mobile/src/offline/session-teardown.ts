import { revokeSessionOnServer } from "../api/client";
import { useAnalyticsConsentStore } from "../analytics/flag";
import { usePurchaseFollowupStore } from "../commerce/purchase-followup.store";
import { useFirstRecordCelebrationStore } from "../home/first-record-celebration";
import { useHomeFirstRunGuideStore } from "../home/first-run-guide.store";
import { useNotificationStore } from "../notifications/notification.store";
import { deactivateRegisteredPushDevice } from "../notifications/usePushDeviceRegistration";
import { clearAppQueryCache } from "../query/query-client-registry";
import { useAppLockStore } from "../stores/app-lock.store";
import { useBudgetWarningHapticStore } from "../stores/budget-warning-haptic.store";
import { useImportResumeStore } from "../stores/import-resume.store";
import { useQuickRecordPinsStore } from "../stores/quick-record-pins.store";
import { useRecentSearchesStore } from "../stores/recent-searches.store";
import { useRecurringExpenseStore } from "../stores/recurring-expense.store";
import { useSelectedChildStore } from "../stores/selected-child.store";
import { clearSyncCursor } from "./delta-sync";
import { wipeOfflineStore } from "./sync-engine";
import type { OfflineStore } from "./types";

/**
 * PRIV-104 — offline-state teardown on session identity change.
 *
 * The offline SQLite store (local_expenses / mutation_outbox / sync_meta) and the persisted
 * purchase-followup store are device-local and NOT keyed by user. Before this module existed,
 * `clearSession` (src/stores/session.store.ts) dropped only the tokens: user B logging in on
 * user A's device inherited A's local expense rows, A's pending outbox mutations (which the next
 * flush would then send under B's token, writing A's data into B's account), and A's
 * purchase-followup prompts.
 *
 * Wiring follows the exact pattern MOB-103b established for the delta-sync cursor: the session
 * store subscription in sync-controller.ts's `useOfflineSyncLifecycle` detects the identity
 * change and calls `teardownOfflineSessionState`. This module holds the (unit-testable) policy
 * and teardown steps; the controller stays a thin, untestable glue layer.
 */

/** The two session-store fields that constitute the session's *identity* (as opposed to its
 * credentials): which account's data the offline store is allowed to hold. Mirrors the fields
 * MOB-103b's cursor invalidation already keyed on. */
export type SessionIdentity = { userId: string | null; isTestSession: boolean };

/**
 * True exactly when the offline store must be wiped before the incoming session touches it:
 *
 *   - A → B account switch (`userId` changed between two non-null users);
 *   - explicit logout (`clearSession` sets `userId` non-null → null) — pending outbox rows are
 *     deliberately dropped with it: after logout there is no token left to ever flush them with,
 *     and keeping them is exactly the PRIV-104 leak once someone else logs in;
 *   - login after a logout (null → non-null). Normally a no-op (the logout transition already
 *     wiped), but it is the belt-and-braces half of the "wipe happens between accounts" rule:
 *     if the logout-time wipe never ran (app killed mid-logout, crash before the async wipe
 *     landed), the incoming user still starts clean;
 *   - demo/test session toggle (`isTestSession` flipped) — demo fixture rows and a real
 *     account's rows must never mix.
 *
 * False — data intentionally KEPT — when the identity is unchanged:
 *
 *   - token refresh (`setTokens` touches only accessToken/refreshToken);
 *   - the same user re-establishing their session (`setSession` with an unchanged userId), so a
 *     re-login never discards that same user's unsynced offline expenses.
 */
export function isSessionIdentityChange(previous: SessionIdentity, next: SessionIdentity): boolean {
  return next.userId !== previous.userId || next.isTestSession !== previous.isTestSession;
}

/**
 * The slice of a zustand `persist`-wrapped store this module's subscription helper needs. Kept
 * structural (rather than importing `useSessionStore`'s concrete type) so a unit test can hand in
 * a fake that reproduces the hydration sequence, and so this policy module keeps depending on
 * nothing but the store's shape.
 */
export type HydratablePersistedStore<TState> = {
  subscribe: (listener: (state: TState, previous: TState) => void) => () => void;
  persist: {
    hasHydrated: () => boolean;
    onFinishHydration: (listener: () => void) => () => void;
  };
};

/**
 * AUTH-127 (round27 H-1) — subscribe to REAL session transitions only, never to the notification
 * zustand's persist middleware emits when it rehydrates.
 *
 * The hazard: `persist` finishes hydration with `set(stateFromStorage, true)`, an ordinary
 * replace-set, so every `subscribe` listener is called with `(persistedState, preHydrationState)`
 * — and the pre-hydration state is the store's *initial* state (`userId: null`). On a cold start
 * that reads back a persisted `userId: "user-a"`, an unguarded listener therefore sees
 * `null → "user-a"`, which `isSessionIdentityChange` correctly classifies as "a login after a
 * logout" — and answers by wiping local_expenses / mutation_outbox / sync_meta / the delta cursor
 * / the purchase-followup store. That wipe destroys exactly what AUTH-127 promised to keep: the
 * user records a expense offline, the refresh token expires (`clearSession("expired")` keeps
 * `userId`, so nothing is wiped), the app is killed, and the next cold start's rehydration wipes
 * the queue the login screen is at that very moment promising to flush
 * ("저장하지 않은 기록도 이어서 반영할게요").
 *
 * The fix is to treat rehydration as what it is — restoring the state the app already had, not a
 * change of session — with two overlapping guards:
 *
 *   1. the transition subscription is not registered until hydration has finished
 *      (`hasHydrated()` already true at mount, or `onFinishHydration`, which persist fires in a
 *      `.then()` *after* the replace-set above — so the rehydration notification is provably not
 *      observable by a listener registered from it);
 *   2. once registered, notifications that arrive while a hydration pass is running are dropped.
 *      `persist.hasHydrated()` goes back to false for the whole duration of any later
 *      `persist.rehydrate()` call, which would otherwise re-open the identical hole.
 *
 * Everything after hydration is untouched: login, logout, A → B switch and the demo toggle all
 * reach `listener` exactly as before.
 *
 * Known edge, deliberately accepted: if a hydration pass never settles (persist swallows a
 * storage read failure and leaves `hasHydrated()` false forever), the subscription never arms and
 * a later account switch would not tear down. That device has no working persisted session at
 * all — nothing was restored, so the app is on the login screen with an empty store — and
 * delta-sync.ts's scope-key check still invalidates the cursor. The failure mode is "no
 * teardown", never "a teardown of the wrong thing"; the pre-guard behavior's failure mode was a
 * guaranteed wipe on every cold start after an expiry.
 */
export function subscribeToHydratedSessionTransitions<TState>(
  store: HydratablePersistedStore<TState>,
  listener: (state: TState, previous: TState) => void
): () => void {
  let unsubscribeTransitions: (() => void) | null = null;
  let disposed = false;

  const startListening = () => {
    if (disposed || unsubscribeTransitions) return;
    unsubscribeTransitions = store.subscribe((state, previous) => {
      // Guard 2: a *later* hydration pass (persist.rehydrate()) flips hasHydrated back to false
      // for its whole duration, replace-set included.
      if (!store.persist.hasHydrated()) return;
      listener(state, previous);
    });
  };

  if (store.persist.hasHydrated()) startListening();
  // Guard 1: nothing is subscribed until hydration finishes. Registered even when already
  // hydrated, so a later rehydrate() that lands between passes still re-arms the listener.
  const unsubscribeHydration = store.persist.onFinishHydration(startListening);

  return () => {
    disposed = true;
    unsubscribeHydration();
    unsubscribeTransitions?.();
  };
}

/**
 * FIX-118A / round27 M-1 — the SYNCHRONOUS half of the identity-change teardown.
 *
 * `teardownOfflineSessionState` below is async, and its caller in sync-controller.ts can only
 * reach it through `getOfflineStore()` (a promise: the SQLite module is imported lazily). Both
 * hops are microtasks, and React re-renders the subscribers of the session store from the same
 * `set()` that produced the identity change — so anything that must be true "before the incoming
 * account's screens render" cannot live behind those hops. The query-cache clear is exactly such
 * a step: user-scoped query keys carry no user id (`["children"]`, `["my-devices"]`, …), so B's
 * first render would otherwise read A's cached rows.
 *
 * Calling this from the subscription body, before any await/then, is what makes the ordering
 * real. Limitation worth naming: this pins "the clear runs in the same tick as the store
 * notification, ahead of the async teardown" — vitest cannot mount the real navigator/screens, so
 * the render itself is not what the tests observe (see session-teardown.test.ts).
 *
 * Idempotent: `teardownOfflineSessionState` calls it again as its step 0, which keeps direct
 * callers of the teardown (and its unit tests) whole.
 */
export function clearSessionScopedQueryCache(): void {
  clearAppQueryCache();
}

/**
 * 라운드 110 — **선택된 아이 id도 계정 경계에서 지운다.** (동기 절반)
 *
 * ## 종전 X(그때는 참)
 *
 * 이 목록의 열 항목은 전부 "떠난 계정의 값을 다음 계정이 보지 않게" 하는 것이었고,
 * `useSelectedChildStore`가 빠져 있던 것은 실수가 아니라 **사람이 쓰는 로그아웃 세 자리가
 * 각자 지우고 있었기 때문**이다: 설정 로그아웃(app/settings/index.tsx:282), PIN 분실
 * 로그아웃(src/security/AppLockOverlay.tsx:260), 계정 삭제(app/settings/privacy.tsx:562).
 * 그래서 "로그아웃 → 다른 계정 로그인"은 selectedChildId가 null인 상태로 도착했고, 그 null이
 * 곧 MOB-116 복구의 방아쇠라(`shouldAttemptSelectedChildRecovery` — 조건에 `!selectedChildId`가
 * 있다) 새 계정은 `GET /children`으로 자기 아이를 다시 골랐다. 그 세 자리만 보면 계약은 지켜졌다.
 *
 * ## 이제 Y, 근거
 *
 * 그 셋을 **지나지 않는** 정체성 전환이 하나 있다: `clearSession("expired")`다. 만료는 userId를
 * 남기므로(AUTH-127 — src/stores/session.store.ts) 위 `isSessionIdentityChange`가 거짓이고 이
 * 구독은 발화하지 않는다. 그 상태에서 **다른 계정 B가 같은 기기에서 로그인**하면
 * (`setSession(userId=B)`) 그때 비로소 정체성이 바뀌는데, selectedChildId는 여전히 **A의 아이**다.
 * 그리고 app/index.tsx:209가 `hasReachedHome`이면 진행도 조회 자체를 건너뛰므로 FIX-119B/F5의
 * 무효 childId 감지(:230 `clearSelectedChildId()`)도 돌지 않고, MOB-116 복구는 값이 있어서 서지
 * 않는다. B는 곧장 `/(tabs)`로 들어가 홈·기록·준비템·리포트 네 탭이 전부
 * `GET /children/<A의 아이>/…`를 친다 — 403 FORBIDDEN(저장값이 UUID일 때. 비-UUID면 P2023이
 * 500으로 올라오지만 그런 값을 쓰던 빌드가 있었는지는 이 저장소에서 잴 수 없다). 핵심 루프
 * 네 탭이 동시에 오류 카드가 된다.
 *
 * ## 왜 "지우기"이고 "검증하기"가 아닌가
 *
 * 대안은 B의 아이 목록에 그 childId가 있는지 물어보고 **맞으면 남기는** 것이다. 쓰지 않는다:
 *  ① 그 검증은 **이미 두 벌 있다** — MOB-116 복구(`GET /children` → 재선택, 다자녀면 안내,
 *    오프라인 문구·자동 1회 재시도·3초 밸브까지 갖춘 경로)와 FIX-119B/F5의 childScopeRejected.
 *    세 벌째를 여기 두는 것은 이 저장소가 라운드마다 걷어 온 그 모양이다;
 *  ② 이 모듈은 **기기 안의 정리**이고 네트워크는 전부 최선 노력이다(0b 푸시 끄기·서버 폐기
 *    둘 다 await하지 않는다). 검증은 답을 기다려야 성립하는데, 오프라인에서는 영영 답이 없다;
 *  ③ 무엇보다 **묻는 동안 값이 남아 있는 것** 자체가 위 403 창이다. 지우면 그 창이 0이 되고,
 *    판정은 이미 있는 복구 경로가 이어받는다 — 즉 이 한 줄이 하는 일은 "만료 갈래를 로그아웃
 *    갈래와 같은 상태로 만드는 것"이지 새 상태 기계를 만드는 것이 아니다.
 *
 * ## 왜 여기(동기)이고 async teardown 안이 아닌가
 *
 * 쿼리 캐시 비우기(FIX-118A / round27 M-1)와 **같은 이유·같은 자리**다. selectedChildId는 그
 * 캐시의 키를 짓는 값이고, 화면이 렌더에서 곧바로 읽는다. 프로미스 홉 뒤에 두면 index.tsx가
 * 이미 `/(tabs)`로 리다이렉트한 뒤에 값이 null이 될 수 있고, 그때 탭은 언마운트된 index로
 * 돌아가지 못해 **비로그인 미리보기 픽스처**(MOB-116이 막은 그 허위 표시)에 머문다 — 403 오류
 * 카드보다 나쁜 자리다. 동기로 두면 그 경합이 존재하지 않는다.
 *
 * ## 지나치게 지우지 않는다
 *
 *  - **`hasReachedHome`(useOnboardingProgressStore)은 지우지 않는다.** 그 값이 false가 되면
 *    MOB-116 복구 조건이 **꺼지고**(조건에 `hasReachedHome`이 있다), 서버가 답하지 않는 갈래
 *    (오프라인·느린 회선·3초 밸브)에서 `localOnboardingResumeRoute`는 아이 id가 없으면 null을
 *    돌려주므로 기본 목적지 `/onboarding/child-status`가 남는다 — 이미 아이가 있는 계정을
 *    ONB-001로 보내는 길이고, 그 길 끝이 `POST /children`(아이 중복 생성)이다
 *    (app/(auth)/login.tsx 라운드 99 트랙 F1(H)이 라우팅으로 만들었다고 적어 둔 그 오염).
 *    게다가 로그아웃 세 자리도 `resetOnboarding`을 부르지 않으므로, 여기서 지우면 **지금 잘
 *    도는 로그아웃 갈래까지** 함께 바꾸게 된다.
 *  - **정체성이 같으면 이 함수는 아예 불리지 않는다.** 토큰 갱신(`setTokens`)과 같은 사용자의
 *    재로그인(`setSession`에 같은 userId)은 위 `isSessionIdentityChange`가 거짓이고, 만료도
 *    userId를 남기므로 거짓이다 — 같은 사람은 자기 아이 선택을 잃지 않는다.
 *  - 데모 전환에서도 안전하다: `startTestSession`은 선택이 **비어 있을 때만** 데모 아이를
 *    고르므로(`if (!selectedChild.selectedChildId)`) 종전에는 A의 아이 id가 데모 세션까지
 *    따라갔다. 이 줄이 그것을 null로 만들고, app/index.tsx의 MOB-107 효과가 데모 아이를 고른다.
 */
export function clearSessionScopedChildSelection(): void {
  useSelectedChildStore.getState().clearSelectedChildId();
}

/**
 * 라운드 107 트랙 B(S1-2) — 떠나는 세션의 **서버 토큰 family를 폐기**한다.
 *
 * 종전: 이 파일이 지우는 것은 전부 기기 안의 상태였고, 서버 쪽으로 나가는 정리는 푸시 기기
 * 행 끄기(0b) 하나였다. 그래서 로그아웃한 계정의 refresh 토큰은 서버에서 **살아 있었다**
 * (근거·수명은 src/api/client.ts의 `revokeSessionOnServer` 머리말). 이제 세션 정체성이
 * 바뀌는 그 순간, 나가는 자격증명으로 폐기를 한 번 요청한다.
 *
 * ## 순서 — 로컬 정리가 먼저, 폐기는 최선 노력
 *
 * 이 함수가 불릴 때 `clearSession()`의 `set`은 **이미 끝나 있다**(구독은 그 set 안에서
 * 동기적으로 발화한다). 즉 토큰·정체성은 기기에서 이미 사라졌고, 화면 전이도 누른 자리에서
 * 곧바로 일어난다. 이 요청은 그 뒤에 붙는 부록이라 **비행기 모드에서도 로그아웃을 한 톨도
 * 막지 않는다** — await하지 않고, 실패는 값으로 삼켜지며(throw 없음), 되돌리는 화면 전이도
 * 없다. 반대 순서(폐기를 기다렸다가 로컬 정리)는 오프라인에서 "로그아웃을 눌렀는데 화면이
 * 안 넘어간다"가 되므로 쓰지 않는다.
 *
 * ## 왜 `teardownOfflineSessionState` 안이 아니라 이 자리(동기)인가
 *
 * 컨트롤러가 teardown에 닿는 길은 `getOfflineStore()` 프로미스 홉이고, 그 홉은 `.catch()`로
 * 삼켜진다(SQLite 모듈 적재 실패·저장소 열기 실패). 토큰 폐기를 그 뒤에 두면 **저장소를 못 여는
 * 기기에서는 폐기도 함께 사라진다** — 보안 조치가 오프라인 저장소의 건강에 묶이는 결합이다.
 * 그래서 쿼리 캐시 비우기(FIX-118A / round27 M-1)와 같은 자리, 같은 이유로 홉 **앞**에 선다.
 *
 * ## 오프라인 큐 판정 (라운드 107 트랙 B의 핵심 결정)
 *
 * **로그아웃은 세션 만료와 다른 축이다. 이 트랙은 큐 정책을 한 글자도 바꾸지 않는다.**
 *
 * 라운드 104가 세운 규율은 "만료는 큐를 보존한다"이고 그 근거는 *정체성*이다(AUTH-127 —
 * src/offline/session-expiry.ts): 자격증명만 죽었고 사람도 계정도 기기도 그대로라, 같은
 * 사용자가 다시 로그인하면 그 큐를 이어서 flush한다. 로그아웃은 사용자가 **그 관계를 끊겠다고
 * 직접 말한 것**이다 — 이 기기는 더 이상 이 계정의 것이 아니다. 그래서 위 `isSessionIdentityChange`가
 * 참이 되고 큐는 지워진다(PRIV-104). 그 손실은 숨기지 않는다: 확인 다이얼로그가 대기 건수까지
 * 세어 먼저 말하고(src/offline/messages.ts의 `logoutConfirmMessage`), PIN 분실 경로도 같은
 * 문장을 쓴다(src/security/app-lock.ts).
 *
 * 폐기가 그 판정을 **오히려 굳힌다**: 서버 family가 죽은 뒤에는 큐를 남겨도 보낼 방법이 없다
 * (refresh 토큰은 폐기됐고 액세스 토큰은 분 단위로 만료된다). 즉 "보존"은 사용자가 이미 사라진다고
 * 들은 행을, 영영 못 보낼 상태로 기기에 남기는 것뿐이다 — 그 자체가 PRIV-104가 막는 잔류다.
 *
 * 그리고 이 호출은 큐를 **방해하지도 않는다**: family 폐기는 access 토큰(JWT)을 무효화하지
 * 않으므로, 같은 순간 아직 날아가고 있는 flush 요청이 이 호출 때문에 실패하지 않는다.
 * 큐를 먼저 비워 주려는 시도(로그아웃 직전 강제 flush)는 이 트랙이 하지 않는다 — 그것은 위
 * 확인 문구의 계약(사라진다)을 바꾸는 별개의 변경이고, 오프라인에서는 로그아웃을 붙잡는다.
 *
 * ## 어떤 전이에서 실제로 나가는가
 *
 * `refreshToken`이 있을 때만이다(client.ts의 가드). 그래서:
 *   - 설정 로그아웃 · PIN 분실 로그아웃 → 나간다(둘 다 같은 `clearSession()`을 지난다);
 *   - 만료 → 정체성이 유지돼 이 구독 자체가 발화하지 않는다(그리고 그 토큰은 이미 죽었다);
 *   - 로그아웃 뒤 로그인(null → 사용자) → 나가는 refresh 토큰이 없어 skip;
 *   - 계정 삭제(app/settings/privacy.tsx) → 서버가 이미 `revokeAllForUser`로 전부 폐기했다.
 *     한 번 더 요청해도 같은 family를 다시 폐기할 뿐이라 해가 없다;
 *   - 데모 세션 토글 → 로컬 토큰이라 skip;
 *   - 픽셀락 QA 라우트(app/pixel-lock.tsx) → 캡처는 비세션 렌더라 나가는 refresh 토큰이
 *     없어 skip이고, 요청이 나가는 경우라면 그 라우트가 실제로 로그아웃을 시킨 것이 맞다.
 */
export function revokeOutgoingSessionOnServer(credentials: {
  authToken: string | null;
  refreshToken: string | null;
}): void {
  // fire-and-forget: await하지 않고, 이 함수는 절대 throw하지 않는다(호출부는 동기 구독 본문이다).
  void revokeSessionOnServer(credentials.authToken, credentials.refreshToken);
}

/**
 * The outgoing session's credentials, handed in by the caller (sync-controller.ts reads them off
 * the subscription's `previous` state — by the time teardown runs, the store already holds the
 * *incoming* session). Only used for best-effort server-side cleanup that must happen while the
 * leaving account's token is still valid; every step of the teardown works without it.
 */
export type SessionTeardownContext = {
  /** Access token of the session being torn down (or the local test-session token). */
  authToken: string | null;
  /**
   * 라운드 51 QA(P3-10) — wipe가 끝난 뒤 화면이 읽는 오프라인 스냅샷을 다시 만든다.
   *
   * 스냅샷(sync-controller.ts의 `latestSnapshot`)은 저장소를 구독하지 않고 **명시적으로 다시
   * 읽을 때만** 갱신되는 메모리 사본이라, 테이블을 비워도 그 사본에는 떠난 계정의 행이 그대로
   * 남는다. 그 사본을 읽는 화면이 기록 탭 배지·동기화 상태 화면이므로, 계정을 바꾼 직후 새
   * 사용자가 이전 계정의 대기/실패 건수를 본다(값 자체는 이미 지워졌는데 화면만 옛 사본이다).
   *
   * 함수를 **넘겨받는** 이유: sync-controller.ts가 이 모듈을 import하므로 여기서 컨트롤러를
   * import하면 순환이 된다(query-client-registry.ts 헤더가 같은 이유로 레지스트리를 쓴다).
   * 넘기지 않으면 그냥 건너뛴다 -- 단위 테스트와 직접 호출자는 종전 그대로다.
   */
  refreshSyncSnapshot?: () => void | Promise<void>;
};

/**
 * Wipes every piece of device-local, user-scoped offline state. Steps, in order:
 *
 *   0. react-query cache clear (FIX-118A / M-3) — user-scoped query keys in this app carry no
 *      user identifier (`["children"]`, `["my-devices"]`, …), so without this the incoming
 *      account renders the outgoing account's cached child list / device list for the whole
 *      30s staleTime window. Synchronous and first, so nothing can re-render stale rows while
 *      the rest of the teardown is still awaiting. A no-op if app/_layout.tsx never registered
 *      a client (unit tests) — see src/query/query-client-registry.ts. Round27 M-1: the real
 *      caller runs this one step *before* awaiting the offline store (see
 *      `clearSessionScopedQueryCache`), because "first inside an async function that is itself
 *      reached through a promise" was not early enough to precede the incoming account's first
 *      render; the repeat here is deliberate and idempotent;
 *   0b. push device deactivation (FIX-118A / M-4, client half) — started here, deliberately NOT
 *      awaited: it is a best-effort network call under the OUTGOING token, and teardown must
 *      never be delayed (or failed) by it. Kicked off before the awaits below so it uses the
 *      token while it is still valid;
 *   0c. 선택된 아이 id 비우기(라운드 110) — 0과 같은 자격의 **동기** 단계다: 실제 호출은
 *      컨트롤러가 프로미스 홉 **앞에서** 하고(`clearSessionScopedChildSelection`의 머리말),
 *      여기 한 번 더 부르는 것은 0과 똑같이 멱등한 반복이라 직접 호출자와 단위 테스트가 온전하다.
 *      만료 뒤 다른 계정 로그인이 A의 아이 id를 물고 `/(tabs)`로 들어가던 갈래를, 로그아웃
 *      갈래와 같은 상태(선택 없음 → MOB-116 복구)로 되돌린다;
 *   1. user-scoped zustand store resets (purchase-followup, notifications, since round 35's F5 the
 *      two home first-run stores, since 라운드 55 트랙 C the recurring-expense templates and
 *      the app-lock record, since 라운드 99 M-1 the analytics consent flag — the consent is a
 *      per-USER choice, unlike the deliberately-kept per-device notification-preferences /
 *      records-view stores — and since 라운드 101 W2 F7 the records-tab recent searches, which
 *      are personal text the user typed and follow the consent's per-user judgment) — synchronous sets, effective immediately. The app-lock reset also
 *      returns a promise for its SecureStore key deletion, awaited at the end (§2.8: leaving A's
 *      PIN behind bricks B — locked out with logout as the only exit, which locks them out again);
 *   2. `wipeOfflineStore` STARTED (not yet awaited) — this must come before any `await` in this
 *      function because the wipe registers itself in sync-engine.ts's `inFlightWipes` map
 *      synchronously. From that moment, any `flushOutbox` call — including one that arrives
 *      while the remaining teardown steps are still awaiting — parks behind the wipe and reads
 *      the post-wipe (empty) outbox, instead of flushing the outgoing account's queued
 *      mutations under the incoming account's token (the exact PRIV-104 leak). Awaiting the
 *      cursor clear first used to leave precisely that window open;
 *   3. delta-sync cursor removal — kept as an explicit step (same call MOB-103b made from the
 *      controller) even though the wipe clears sync_meta anyway: the wipe may be parked behind
 *      an in-flight flush pass, and the cursor must die *now*, not after that pass completes,
 *      so a concurrently-running delta pull for the new user can never resume from the old
 *      user's cursor. The wipe's own sync_meta clear afterwards is a harmless double-clear;
 *   4. await the wipe — local_expenses + mutation_outbox + sync_meta cleared, sequenced against
 *      any in-flight outbox flush (see its doc comment in sync-engine.ts for the exact race
 *      guarantees);
 *   5. 라운드 51 QA(P3-10): refresh the in-memory sync snapshot the screens read, if the caller
 *      handed one in (`context.refreshSyncSnapshot`) — the wipe empties the tables but not that
 *      copy, so without this the incoming account's 기록 탭 배지·동기화 상태 화면 still show the
 *      outgoing account's pending/failed counts until something else happens to re-read.
 *
 * Any store failure propagates to the caller (the controller subscription swallows it — same
 * best-effort stance as every other background offline operation there); the scope-key check in
 * delta-sync.ts's loadSyncCursor remains the last-resort fallback for the cursor specifically.
 */
export async function teardownOfflineSessionState(
  store: OfflineStore,
  context: SessionTeardownContext = { authToken: null }
): Promise<void> {
  // Step 0: drop every cached server response of the outgoing account (see doc comment). The
  // controller already did this synchronously at the moment of the identity change (round27 M-1);
  // repeating it here keeps every direct caller of the teardown — and its unit tests — whole.
  clearSessionScopedQueryCache();
  // Step 0b: best-effort, fire-and-forget — never awaited, never allowed to reject.
  void deactivateRegisteredPushDevice(context.authToken);
  // Step 0c (라운드 110): 떠난 계정의 아이 선택도 이 자리에서 지운다. 컨트롤러가 동기 자리에서
  // 이미 한 번 불렀고(머리말의 "왜 여기(동기)인가"), 이 반복은 0과 같은 이유로 멱등하다.
  clearSessionScopedChildSelection();
  usePurchaseFollowupStore.getState().resetAll();
  // NOTI-102: 알림 이력·중복 방지 키·시기 메타도 사용자 단위 상태이므로 함께 초기화한다.
  useNotificationStore.getState().resetAll();
  // UX-G / 라운드 35 F5: 홈 첫 실행 상태 두 가지도 **아이 id로 키가 잡힌 사용자 단위 상태**라
  // 같은 목록에 든다(NOTI-102와 같은 관례).
  //  - 준비템 안내 "닫음" 플래그는 persist된다 -- 지우지 않으면 B 계정의 첫 안내가 A가 남긴
  //    childId 목록에 걸려 조용히 삼켜질 수 있고, 떠난 계정의 아이 id가 기기에 남는다.
  //  - 첫 기록 축하는 세션 스토어지만 관찰 이력·F3 래치를 들고 있어서, 지우지 않으면 B의 첫
  //    기록이 A의 이력에 눌려 축하도 유도 카드도 어긋난다.
  useHomeFirstRunGuideStore.getState().reset();
  useFirstRecordCelebrationStore.getState().reset();
  // 라운드 55 트랙 C(설계 §1.6): 반복 지출 템플릿에 담기는 값(품목명·금액·분류·판매처)은 명백한
  // **계정 데이터**라 위 목록과 같은 자격으로 든다 -- first-run-guide가 "아이 id로 키가 잡힌
  // 사용자 단위 상태"라는 이유로 합류한 것과 같다. 대조군인 notification-preferences는 "이
  // 기기에서 어떤 알림을 볼까"라는 기기 단위 선택이라 일부러 빠져 있다(그 스토어의 헤더 참고).
  // 동기 set이므로 이 줄에서 이미 유효하다.
  useRecurringExpenseStore.getState().resetAll();
  // 라운드 56 트랙 D(GAP-056 #5): 가져오기 이어보기 항목에는 childId·파일명이 담긴다 --
  // 명백한 계정 데이터라 같은 자격으로 든다. 대조군 records-view(리스트/달력 선택)는
  // 기기 단위 선택이라 notification-preferences와 같은 범주로 일부러 빠져 있다.
  useImportResumeStore.getState().resetAll();
  // 라운드 99 M-1: 통계 수집 동의(ANA-102)는 **그 사람이 준 동의**라 사용자 단위다 --
  // notification-preferences("이 기기에서 어떤 알림을 볼까")·records-view(리스트/달력 선택)의
  // 기기 단위 범주와 갈린다. 지우지 않으면 로그인 화면의 동의 체크박스가 A의 값으로 미리 켜져
  // (app/(auth)/login.tsx의 storedAnalyticsEnabled 폴백), 무접촉 로그인 한 번에 A의 동의가
  // B의 토큰으로 커밋된다. 초기화 결과는 미동의 기본(OFF)이라 B는 스스로 켜기 전까지
  // 아무 이벤트도 내보내지 않는다(ANA-101 opt-in).
  useAnalyticsConsentStore.getState().reset();
  // 라운드 101 W2 F7: 기록 탭 최근 검색어는 사용자가 검색창에 친 **개인 텍스트**다(품목명·
  // 판매처·메모의 조각 — 무엇을 샀고 무엇을 찾았는지가 그대로 담긴다). 저장은 기기 단위
  // persist지만 판단은 통계 동의(라운드 99 M-1)와 같은 **사용자 단위**다: records-view(리스트/
  // 달력)·notification-preferences 같은 "화면을 어떻게 볼까"류 기기 취향과 달리, A가 무엇을
  // 찾았는지가 B의 검색창 아래에 칩으로 떠서는 안 된다. 동기 set이라 이 줄에서 이미 유효하다.
  useRecentSearchesStore.getState().resetAll();
  // 라운드 102 F6b: 홈 빠른 기록 칩의 핀도 같은 자격이다 — 담기는 것은 사용자가 고른
  // **품목명(개인 텍스트)**이라, 저장은 기기 단위 persist지만 판단은 최근 검색어(라운드 101
  // W2 F7)와 같은 **사용자 단위**다: A가 무엇을 자주 사는지가 B의 홈 칩에 고정된 채 떠서는
  // 안 된다. 동기 set이라 이 줄에서 이미 유효하다.
  useQuickRecordPinsStore.getState().resetAll();
  // 라운드 102 리뷰 M-1: 예산 경고 햅틱의 (아이, 월, 경계) 클레임도 사용자 단위다 — 담기는 것이
  // **아이 id**라 A의 아이에 대한 클레임이 남으면 B의 홈에서 B가 받아야 할 경고 진동이 삼켜진다
  // (푸시 클레임 표가 사용자·아이 축을 갖는 것과 같은 이유). 동기 set이라 이 줄에서 이미 유효하다.
  useBudgetWarningHapticStore.getState().resetAll();
  // 라운드 55 트랙 C(설계 §2.8) — **브릭 방지**. 앱 잠금 PIN이 정체성 변경에서 지워지지 않으면
  // A 로그아웃 → B 로그인 → B가 A의 PIN 화면에 갇히고, 탈출구는 로그아웃뿐이라 무한 루프가 된다.
  // 런타임 상태는 동기로 비고, SecureStore 키 삭제만 Promise다 -- 이 함수는 이미 async이므로
  // 아래에서 함께 await한다(삭제 실패가 다음 부팅까지 남는 창을 줄인다).
  // `clearSession("expired")`는 정체성을 유지하므로 여기 오지 않는다: 만료로 끝난 세션은 PIN을
  // 잃지 않는다 — 같은 사람이다.
  const appLockCleared = useAppLockStore.getState().resetAll();
  // Step 2: start the wipe BEFORE the first await so it registers in inFlightWipes
  // synchronously — see the ordering rationale in the doc comment above.
  const wipe = wipeOfflineStore(store);
  await clearSyncCursor(store);
  await wipe;
  await appLockCleared;
  // Step 5 (라운드 51 QA P3-10): 비운 저장소를 화면 스냅샷에도 반영한다 — 지출 대기 행과
  // 준비템 대기 행이 함께 사라져야 새 계정의 첫 화면이 이전 계정의 건수를 말하지 않는다.
  // wipe **뒤에** 있어야 의미가 있다(그 전에 읽으면 지우기 전 사본을 다시 만든다).
  await context.refreshSyncSnapshot?.();
}
