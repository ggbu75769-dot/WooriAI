import { useCallback, useEffect, useRef, useState } from "react";
import { listChildren, type Child } from "../api/client";
// 라운드 71 트랙 C: 오프라인 갈래의 문장은 **이미 있는 것을 읽는다**(새 문구를 짓지 않는다).
// 이 방향의 import는 사이클을 만들지 않는다 -- messages.ts가 끌어오는 것은 src/api/api-error.ts
// 하나이고(나머지는 타입 전용), 그 파일은 src/onboarding/을 부르지 않는다.
import { OFFLINE_RETRY_NOTICE } from "../offline/messages";

/**
 * MOB-116: real-session counterpart to app/index.tsx's MOB-107 test-session recovery. When the
 * persisted `wooriai-selected-child` blob is lost/corrupt (its store's `migrate`/`merge` reset it
 * to null) but `wooriai-onboarding-progress` survived with hasReachedHome=true, a real session
 * would redirect to /(tabs) where every screen's `Boolean(authToken && childId)` query gate is
 * permanently false -- Home/준비템/리포트 silently show their logged-out preview UI (fixture
 * "다온이" data) forever, with no way to recover short of reinstalling. Unlike the test session
 * there is no well-known fixture id to fall back to, so the child id must be re-derived from the
 * server.
 *
 * R19-C(F1) 다자녀: 복구 소스를 GET /onboarding/status(summary.child)에서 GET /children 목록으로
 * 바꿨다. status 요약은 childId를 주지 않으면 가구의 "첫째"만 돌려주므로, 둘째를 쓰던 사용자는
 * 매번 조용히 첫째로 되돌아갔다(그리고 그 사실을 알 방법이 없었다). 목록을 쓰면 (i) 아이가 한
 * 명이면 확실히 그 아이를 고르고, (ii) 여러 명이면 여전히 첫째를 고르되 `ambiguous` 플래그로
 * "다시 골랐다"는 사실을 사용자에게 알릴 수 있다 -- 침묵 오선택 대신 눈에 보이는 안내.
 *
 * Split into pure, dependency-injected pieces (should/recover/apply) so the decision table is
 * unit-testable without a React renderer, plus a thin useSelectedChildRecovery hook that
 * app/index.tsx mounts (wiring pinned by source-scan tests, per the ui-wiring.test.ts
 * convention).
 *
 * 라운드 71 트랙 C(#3): 이 실패 카드는 탭 셸 **앞**에 서므로, 복구가 실패하는 동안 홈·기록·
 * 준비템·리포트 어디에도 갈 수 없다 -- 오프라인 우선을 근간으로 만든 앱의 **유일한 전면 차단**
 * 이었고, 재시도는 사용자가 누르는 것뿐이라 오프라인에서는 [다시 시도]가 영원히 같은 답이었다.
 * 그래서 셋을 더한다(판정은 전부 이 파일의 순수 함수이고, 훅은 여전히 얇다):
 *
 *  1. **문구가 사실을 갈라 말한다**(resolveSelectedChildRecoveryErrorCopy) -- 오프라인이면
 *     그 사실을, 그 밖에는 종전 문장을 **한 글자도 바꾸지 않고** 그대로 쓴다.
 *  2. **스스로 한 번 다시 시도한다**(shouldAutoRetrySelectedChildRecovery) -- 트리거는 상태
 *     전이(재연결 · background→active)뿐이고 새 타이머·새 폴러는 0건이다.
 *  3. **잃지 않은 것을 말한다**(SELECTED_CHILD_RECOVERY_DATA_INTACT_NOTICE) -- 이 갈래는
 *     세션도 아웃박스도 건드리지 않으므로(아래 apply의 `error` 갈래) 지킬 수 있는 약속이다.
 *
 * ⚠️ 하지 않는 것: childId 없이 탭 셸로 통과시키지 않는다(위 MOB-116 문단이 그 이유다 --
 * 막다른 길을 비로그인 미리보기 픽스처의 허위 표시로 바꾸는 것은 개선이 아니다), 로컬 SQLite
 * 대기 행에서 childId를 유추하지 않는다(R19-C(F1)가 막은 침묵 오선택 -- 하려면 안내와 짝지어야
 * 하고 그건 별도 결정이다).
 */

export type SelectedChildRecoveryStatus = "idle" | "loading" | "recovered" | "no-child" | "error";

export type SelectedChildRecoveryOutcome =
  /** `ambiguous`: 아이가 여러 명이라 첫째를 "골라줬다"는 뜻 -- 사용자에게 알려야 한다. */
  | { kind: "recovered"; childId: string; ambiguous: boolean }
  | { kind: "no-child" }
  | { kind: "error" };

/**
 * 다자녀 계정에서 복구가 임의로 첫째를 고른 뒤 보여줄 안내. 침묵 오선택(둘째 사용자가 아무 말
 * 없이 첫째 화면을 보게 되는 것)을 막는 것이 목적이라 전환 경로까지 함께 알려준다.
 */
export const MULTI_CHILD_RECOVERY_NOTICE = "아이를 다시 선택했어요 — 설정 > 아이 관리에서 바꿀 수 있어요.";

export type SelectedChildRecoveryInput = {
  hydrated: boolean;
  isTestSession: boolean;
  accessToken: string | null;
  hasReachedHome: boolean;
  selectedChildId: string | null;
};

/**
 * The exact "stuck" state and nothing else: a hydrated, real (token-holding) session that already
 * reached home but has no selected child. Test sessions keep their existing MOB-107 fixture-id
 * path; sessions that never reached home keep the existing MOB-101 onboarding-resume flow (which
 * sets the selected child itself on ONB-006's 이어서 하기).
 */
export function shouldAttemptSelectedChildRecovery(input: SelectedChildRecoveryInput): boolean {
  return (
    input.hydrated &&
    !input.isTestSession &&
    Boolean(input.accessToken) &&
    input.hasReachedHome &&
    !input.selectedChildId
  );
}

/**
 * Maps the server's child list to a recovery outcome. An empty list means the local
 * hasReachedHome=true was itself stale/corrupt and the account truly has no child (any more).
 * With exactly one child the pick is unambiguous; with several, the first one (the server orders
 * by createdAt asc) is picked and flagged `ambiguous` so the caller can say so out loud.
 */
export function selectedChildRecoveryOutcome(
  children: ReadonlyArray<Pick<Child, "id">>
): Exclude<SelectedChildRecoveryOutcome, { kind: "error" }> {
  const first = children.find((child) => typeof child?.id === "string" && child.id.length > 0);
  if (!first) {
    return { kind: "no-child" };
  }
  return { kind: "recovered", childId: first.id, ambiguous: children.length > 1 };
}

/**
 * One recovery attempt. Never throws: offline / server errors become `{ kind: "error" }` so the
 * caller can render a retry affordance instead of an unhandled rejection or an infinite spinner.
 * `fetchChildren` is injectable for tests; production uses the real GET /children client.
 */
export async function recoverSelectedChild(
  accessToken: string,
  fetchChildren: (token: string) => Promise<{ children: Child[] }> = listChildren
): Promise<SelectedChildRecoveryOutcome> {
  try {
    const { children } = await fetchChildren(accessToken);
    return selectedChildRecoveryOutcome(children ?? []);
  } catch {
    return { kind: "error" };
  }
}

/**
 * Applies an outcome to the stores and returns the resulting status.
 * - recovered: re-select the server's child -- the /(tabs) redirect then sees real data again.
 *   R19-C(F1): 여러 명 중 첫째를 골라준 경우에는 `notify`로 안내 문구를 흘려보낸다(선택적 효과라
 *   테스트/다른 호출자는 생략 가능).
 * - no-child: the local hasReachedHome=true was wrong (server has no child), so reset the
 *   onboarding-progress store; app/index.tsx's existing routing then walks the normal
 *   MOB-101 flow (server progress check -> resume screen or ONB-001) exactly as for a fresh
 *   account. Nothing else is touched -- the session/token stays intact.
 * - error: leave every store untouched so the attempt stays fully retryable.
 */
export function applySelectedChildRecoveryOutcome(
  outcome: SelectedChildRecoveryOutcome,
  effects: {
    setSelectedChildId: (childId: string) => void;
    resetOnboarding: () => void;
    notify?: (message: string) => void;
  }
): SelectedChildRecoveryStatus {
  switch (outcome.kind) {
    case "recovered":
      effects.setSelectedChildId(outcome.childId);
      if (outcome.ambiguous) {
        effects.notify?.(MULTI_CHILD_RECOVERY_NOTICE);
      }
      return "recovered";
    case "no-child":
      effects.resetOnboarding();
      return "no-child";
    case "error":
      return "error";
  }
}

/* ---------------------------------------------------------------------------------------- */
/* 라운드 71 트랙 C(#3) — 현관 실패 카드의 문구                                                */
/* ---------------------------------------------------------------------------------------- */

/**
 * 종전 카드 문구. **한 글자도 바뀌지 않았다** -- 화면의 리터럴이던 것이 판정 함수의 한 갈래로
 * 자리만 옮겼다(온라인이거나 연결 상태를 알 수 없을 때 나오는 그 문장 그대로).
 */
export const SELECTED_CHILD_RECOVERY_ERROR_NOTICE = "아이 정보를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.";

/**
 * 이 카드가 새로 짓는 **유일한 문장**이고, 그 이유는 이 상태에서만 참인 사실이기 때문이다.
 *
 * 이 자리에서 사용자가 실제로 겪는 최악은 "앱이 고장 났다"고 판단해 **재설치**하는 것이다 --
 * 그러면 아직 서버에 올라가지 않은 아웃박스 행이 함께 사라진다. 그런데 이 갈래에서 잃은 것은
 * 아무것도 없다: `applySelectedChildRecoveryOutcome`의 `error` 갈래는 어떤 스토어도 건드리지
 * 않고(세션·토큰 그대로), SQLite의 지출·아웃박스도 그대로다. 앱은 그 사실을 말한 적이 없었다.
 *
 * 왜 홈 실패 카드의 `OFFLINE_RECORDING_STILL_AVAILABLE_NOTICE`("기록은 지금도 남길 수 있어요.")를
 * 쓰지 않는가: 그 문장은 **기록 입구를 함께 내주는 화면**의 것이다(use-load-error-copy.ts의
 * 그 판단). 이 카드는 탭 셸 앞에 서서 기록 입구조차 없으므로 그 문장은 지킬 수 없는 약속이 된다.
 * 여기서 참인 것은 "지금 적을 수 있다"가 아니라 **"이미 적은 것이 그대로 있다"**뿐이다.
 *
 * 해요체·비난 없음(DNC-018). 건수를 말하지 않는다 -- 이 시점의 앱은 저장소를 세어 본 적이 없다.
 */
export const SELECTED_CHILD_RECOVERY_DATA_INTACT_NOTICE = "이 기기에 저장한 기록은 그대로 있어요.";

export type SelectedChildRecoveryErrorCopy = { title: string; body: string };

/**
 * 순수 판정 함수: 연결 상태만 보고 카드의 두 줄을 고른다(구조·버튼은 그대로다).
 *
 * `isOnline: true`가 기본 안전값인 이유는 `resolveLoadErrorCopy`와 같다 -- 폴이 끝나기 전 첫
 * 프레임과 연결 상태를 보고할 수 없는 플랫폼(web)에서 **종전 문장**이 그대로 나온다. 새 문구는
 * "오프라인이라고 확인된" 경우에만 대체한다.
 *
 * 오프라인 문장은 `src/offline/messages.ts`의 기존 한 줄을 **그대로 읽는다**
 * (`OFFLINE_RETRY_NOTICE` -- 라운드 52 C-05가 같은 상황을 화면마다 다른 말로 부르지 않으려고
 * 동작에 묶지 않은 이름으로 적어 둔 그 문장이다). [다시 시도]는 오프라인에서도 숨기지 않는다:
 * 연결 판정은 point-in-time 폴 한 번이라 틀릴 수 있고, 틀렸을 때 사용자가 되돌릴 유일한 수단이다.
 */
export function resolveSelectedChildRecoveryErrorCopy({
  isOnline
}: {
  isOnline: boolean;
}): SelectedChildRecoveryErrorCopy {
  return {
    title: isOnline ? SELECTED_CHILD_RECOVERY_ERROR_NOTICE : OFFLINE_RETRY_NOTICE,
    body: SELECTED_CHILD_RECOVERY_DATA_INTACT_NOTICE
  };
}

/* ---------------------------------------------------------------------------------------- */
/* 라운드 71 트랙 C(#3) — 자동 1회 재시도의 판정                                               */
/* ---------------------------------------------------------------------------------------- */

/**
 * 앱이 **관측한** 두 사실. 아직 관측 전이면 `null`이고, `null`은 어느 쪽으로도 전이가 아니다.
 *
 * `appState`가 `string`인 이유: 이 모듈은 순수하게 남아야 하므로(vitest node 환경에서 그대로
 * import된다) react-native의 `AppStateStatus` 타입을 끌어오지 않는다. 값의 의미는 그 열거형과
 * 같고, 이 판정이 보는 것은 `"active"`인지 아닌지 하나뿐이다.
 */
export type SelectedChildRecoveryWake = {
  appState: string | null;
  isOnline: boolean | null;
};

/** 아직 아무것도 관측하지 않은 상태. 실패 카드가 뜰 때마다 여기서 다시 시작한다. */
export const SELECTED_CHILD_RECOVERY_WAKE_UNKNOWN: SelectedChildRecoveryWake = {
  appState: null,
  isOnline: null
};

/**
 * "지금 스스로 한 번 더 시도해야 하는가"의 **유일한 판정**.
 *
 * ## 왜 상태 전이만 트리거인가
 *
 * 무한 루프를 만들지 않는 것이 이 함수의 계약이다. 트리거를 "지금 오프라인이다" 같은 **상태**로
 * 두면 같은 상태가 유지되는 동안 계속 발화한다. 그래서 보는 것은 언제나 **전이**다 --
 * 같은 값이 다시 들어오면 `false`이고(`previous`와 `next`가 같으면 두 조건 모두 거짓),
 * 실패 카드가 떠 있지 않거나 애초에 복구가 필요 없으면 그 앞에서 멈춘다.
 *
 * ## 두 전이
 *
 *  - **background→active**: `subscribeAppStateChange`가 주는 그 전이 하나다. 네이티브 구독은
 *    `src/offline/connectivity.ts`가 이미 하나로 모아 두었으므로 추가 비용이 0이다(FIX-118A).
 *    AppState는 값이 **바뀔 때만** 발화하므로 "active"가 연달아 두 번 오지 않고, 그래도
 *    `previous.appState !== "active"` 가드를 함께 둔다.
 *  - **재연결(offline→online)**: 연결 사실은 앱이 이미 네트워크를 보는 순간에만 관측한다 --
 *    실패 카드로 전환될 때의 폴 한 번, 그리고 위 AppState 전이마다 한 번. **새 15초 폴러를
 *    돌리지 않는다**: 이 저장소의 재연결 감시자(`startConnectivityWatcher`)는 아웃박스 flush의
 *    소유물이고(sync-controller.ts), 같은 것을 하나 더 켜는 것은 이 트랙의 금지 사항이다.
 *
 * 두 전이가 같은 순간에 함께 도착해도 재시도는 **한 번**이다(`retry`가 attempt를 1 올리고,
 * 그 뒤 상태는 더 이상 "error"가 아니라 이 판정이 곧바로 false가 된다).
 */
export function shouldAutoRetrySelectedChildRecovery(input: {
  status: SelectedChildRecoveryStatus;
  shouldAttempt: boolean;
  previous: SelectedChildRecoveryWake;
  next: SelectedChildRecoveryWake;
}): boolean {
  if (!input.shouldAttempt || input.status !== "error") {
    return false;
  }
  const returnedToForeground = input.next.appState === "active" && input.previous.appState !== "active";
  const reconnected = input.next.isOnline === true && input.previous.isOnline === false;
  return returnedToForeground || reconnected;
}

/**
 * Mirrors app/index.tsx's existing 3s safety valves (hydration + progressFetch): a hung request
 * that surfaces neither a response nor a network error must not blank the screen forever, so
 * after this grace period the attempt is presented as a retryable error. A late success is still
 * applied (store updates are idempotent) and simply routes the user onward.
 */
export const SELECTED_CHILD_RECOVERY_TIMEOUT_MS = 3000;

export type UseSelectedChildRecoveryEffects = {
  setSelectedChildId: (childId: string) => void;
  resetOnboarding: () => void;
};

/**
 * 훅이 바깥에서 **주입받는** 배선. 전부 선택이고, 넘기지 않으면 동작이 종전과 같다
 * (연결 판정 없음 = 종전 문구, 자동 재시도 없음 = [다시 시도] 버튼만).
 *
 * 왜 import가 아니라 주입인가: `src/offline/connectivity.ts`는 react-native의 `AppState`와
 * expo-network를 들고 있어 **vitest(node)에서 import조차 되지 않는다**(그 파일 머리말). 이
 * 모듈은 판정표의 단위 테스트 대상이라 순수하게 남아야 하므로, 네이티브를 건드리는 두 함수는
 * 화면(app/index.tsx)이 넘긴다 -- `fetchChildren`이 이미 그렇게 주입돼 있던 것과 같은 관례이고,
 * `use-load-error-copy.ts`가 같은 이유로 얇은 배선층을 따로 둔 것과 같은 판단이다.
 * 실제로 넘기는지는 소스 스캔 계약이 고정한다(ui-wiring.test.ts 관례).
 */
export type SelectedChildRecoveryWiring = {
  /** 기본값은 실제 GET /children 클라이언트. 테스트가 갈아끼운다. */
  fetchChildren?: (token: string) => Promise<{ children: Child[] }>;
  /** point-in-time 폴 1회(`src/offline/connectivity.ts`의 `isCurrentlyOnline`). */
  isCurrentlyOnline?: () => Promise<boolean>;
  /** 단일 네이티브 AppState 구독(`src/offline/connectivity.ts`의 `subscribeAppStateChange`). */
  subscribeAppStateChange?: (listener: (status: string) => void) => () => void;
};

/**
 * Thin React wiring over the pure pieces above. While shouldAttemptSelectedChildRecovery(input)
 * is true the hook fetches the server child list and applies the outcome; `retry` re-arms a
 * failed attempt. Note both success paths flip the attempt condition itself off (recovered sets
 * selectedChildId, no-child clears hasReachedHome), so the caller only ever renders the
 * pending/error states while the condition holds.
 *
 * R19-C(F1): `notice`는 다자녀 계정에서 첫째를 골라준 뒤 한 번 보여줄 안내 문구다. 조건이 이미
 * false로 뒤집힌 뒤에도 남아 있어야 하므로(복구 직후 렌더에서 읽는다) 별도 state에 담는다.
 *
 * 라운드 71 트랙 C(#3): `copy`(실패 카드의 두 줄)와 자동 1회 재시도가 더해졌다. 둘 다 판정은
 * 위 순수 함수 둘이 하고, 여기서 하는 일은 **관측과 전달**뿐이다 -- 3초 밸브·`stale` 가드·
 * `attempt` 재무장 규칙·성공/`no-child` 갈래는 한 줄도 바뀌지 않았다.
 */
export function useSelectedChildRecovery(
  input: SelectedChildRecoveryInput,
  effects: UseSelectedChildRecoveryEffects,
  wiring: SelectedChildRecoveryWiring = {}
): {
  status: SelectedChildRecoveryStatus;
  notice: string | null;
  copy: SelectedChildRecoveryErrorCopy;
  retry: () => void;
} {
  const { fetchChildren = listChildren, isCurrentlyOnline, subscribeAppStateChange } = wiring;
  const [status, setStatus] = useState<SelectedChildRecoveryStatus>("idle");
  const [notice, setNotice] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  // 실패 카드로 **전환되는 순간**의 연결 사실. 기본값 true = 종전 문구(resolve…Copy 머리말).
  const [isOnline, setIsOnline] = useState(true);
  const shouldAttempt = shouldAttemptSelectedChildRecovery(input);
  const { accessToken } = input;
  const { setSelectedChildId, resetOnboarding } = effects;

  const retry = useCallback(() => {
    setNotice(null);
    setAttempt((count) => count + 1);
  }, []);

  useEffect(() => {
    if (!shouldAttempt || !accessToken) {
      return;
    }
    // `stale` guards against a superseded attempt (deps changed / unmount) overwriting the
    // status of a newer one; the store writes themselves stay safe either way because they are
    // idempotent re-derivations of server state.
    let stale = false;
    setStatus("loading");
    void recoverSelectedChild(accessToken, fetchChildren).then((outcome) => {
      if (stale) {
        return;
      }
      setStatus(
        applySelectedChildRecoveryOutcome(outcome, {
          setSelectedChildId,
          resetOnboarding,
          notify: setNotice
        })
      );
    });
    const valve = setTimeout(() => {
      if (!stale) {
        setStatus("error");
      }
    }, SELECTED_CHILD_RECOVERY_TIMEOUT_MS);
    return () => {
      stale = true;
      clearTimeout(valve);
    };
  }, [shouldAttempt, accessToken, attempt, setSelectedChildId, resetOnboarding, fetchChildren]);

  /**
   * 라운드 71 트랙 C(#3) — 실패 카드가 떠 있는 **동안에만** 두 사실을 관측하고, 전이가 있으면
   * 판정 함수에 물어 한 번 다시 시도한다.
   *
   * `useErrorTimeConnectivity`(src/offline/use-load-error-copy.ts)와 같은 cancelled 패턴이다:
   * 카드가 사라지면(복구 성공 · 재시도 진행 중 · 언마운트) 그 전에 띄운 폴의 결과를 **버리고**
   * 관측을 초기화한다 -- 사라진 화면에 setState가 걸리지 않고, 늦게 도착한 옛 판정이 최신 판정을
   * 덮어쓰지도 않는다. 재시도가 실패해 카드가 다시 서면 그때의 사실로 처음부터 다시 관측한다.
   *
   * **새 타이머·새 폴러 0건**: 여기서 도는 것은 `subscribeAppStateChange` 구독 하나와, 그 전이
   * 시점(및 카드 전환 시점)의 point-in-time 폴뿐이다.
   */
  const showingRecoveryError = shouldAttempt && status === "error";
  const wakeRef = useRef<SelectedChildRecoveryWake>(SELECTED_CHILD_RECOVERY_WAKE_UNKNOWN);

  useEffect(() => {
    if (!showingRecoveryError || !isCurrentlyOnline) {
      wakeRef.current = SELECTED_CHILD_RECOVERY_WAKE_UNKNOWN;
      setIsOnline(true);
      return;
    }
    let cancelled = false;
    const observe = (next: SelectedChildRecoveryWake) => {
      if (cancelled) {
        return;
      }
      const previous = wakeRef.current;
      wakeRef.current = next;
      if (next.isOnline !== null) {
        setIsOnline(next.isOnline);
      }
      if (shouldAutoRetrySelectedChildRecovery({ status: "error", shouldAttempt: true, previous, next })) {
        retry();
      }
    };
    const observeConnectivity = () => {
      void isCurrentlyOnline().then((online) => observe({ ...wakeRef.current, isOnline: online }));
    };
    observeConnectivity();
    const unsubscribe = subscribeAppStateChange?.((appState) => {
      observe({ ...wakeRef.current, appState });
      observeConnectivity();
    });
    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [showingRecoveryError, isCurrentlyOnline, subscribeAppStateChange, retry]);

  return {
    status,
    notice,
    copy: resolveSelectedChildRecoveryErrorCopy({ isOnline }),
    retry
  };
}
