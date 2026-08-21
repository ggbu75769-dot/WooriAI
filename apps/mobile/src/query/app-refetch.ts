/**
 * MOB-117: react-query의 기본 focusManager/onlineManager는 웹 전용 이벤트(window focus /
 * online)를 듣기 때문에 React Native에서는 "포그라운드 복귀 시 재조회"와 "네트워크 복구 시
 * 재조회"가 전혀 동작하지 않았다. 이 모듈은 그 연결(포커스=AppState "active" 전환,
 * 온라인=기존 오프라인 connectivity 폴링 관례)을 담당하는 **transport-agnostic 코어**다.
 *
 * connectivity.ts / sync-controller.ts 선례를 그대로 따른다: 네이티브 모듈(AppState,
 * expo-network)은 vitest node 환경에서 import조차 불가능하므로, 실제 네이티브 import는
 * install-app-refetch.ts(얇은 글루, 테스트 안 함)에 두고 여기의 로직은 전부 주입식
 * 인터페이스로 받아 단위 테스트한다(app-refetch.test.ts).
 */

/** offline/connectivity.ts의 POLL_INTERVAL_MS와 같은 값. expo-network에는 push 이벤트가
 * 없어 폴링이 유일한 감지 수단이고, 15초는 이미 오프라인 outbox 감지에 쓰는 검증된 주기다
 * (더 짧게 잡아 배터리를 더 쓰지 않는다). */
export const ONLINE_POLL_INTERVAL_MS = 15_000;

/** AppState의 "active" 상태만 포커스로 취급 -- "inactive"(iOS 앱 전환 중)/"background" 모두
 * 비포커스. sync-controller의 포그라운드 훅(connectivity.ts handleAppStateChange)과 동일 기준. */
export function isForegroundAppState(status: string): boolean {
  return status === "active";
}

// 구조적 타입: @tanstack/query-core의 FocusManager/OnlineManager.setEventListener 시그니처와
// react-native AppState.addEventListener 시그니처에 각각 구조적으로 맞춘 최소 인터페이스.
// (install-app-refetch.ts가 실물을 넘기며, 호환성은 tsc --noEmit이 검증한다.)
export type FocusManagerLike = {
  setEventListener: (setup: (setFocused: (focused?: boolean) => void) => (() => void) | undefined) => void;
};

export type AppStateSubscriptionLike = { remove: () => void };

export type AppStateLike = {
  addEventListener: (type: "change", listener: (status: string) => void) => AppStateSubscriptionLike;
};

/** focusManager를 AppState에 연결: "active" 전환 시 focused=true가 되면서 react-query가
 * stale한 활성 쿼리를 재조회한다(refetchOnWindowFocus 기본값 유지 -- staleTime 게이트는
 * app/_layout.tsx의 QueryClient 기본값 주석 참고). */
export function wireFocusManagerToAppState(manager: FocusManagerLike, appState: AppStateLike): void {
  manager.setEventListener((setFocused) => {
    const subscription = appState.addEventListener("change", (status) => {
      setFocused(isForegroundAppState(status));
    });
    return () => subscription.remove();
  });
}

export type OnlineManagerLike = {
  setEventListener: (setup: (setOnline: (online: boolean) => void) => (() => void) | undefined) => void;
};

export type IntervalScheduler = {
  setInterval: (handler: () => void, ms: number) => unknown;
  clearInterval: (handle: unknown) => void;
};

const defaultScheduler: IntervalScheduler = {
  setInterval: (handler, ms) => setInterval(handler, ms),
  clearInterval: (handle) => clearInterval(handle as ReturnType<typeof setInterval>)
};

/**
 * onlineManager를 기존 오프라인 connectivity 관례(expo-network 폴링)에 연결. 상태가 실제로
 * 바뀐 폴 틱에서만 setOnline을 호출한다 -- 매 틱 호출하면 react-query가 offline->online
 * 전환으로 오인할 일은 없지만(내부에서 diff), 불필요한 notify 경로를 아예 타지 않는 편이
 * 보수적이다. 초기 상태는 건드리지 않는다(react-query 기본 online=true; 실패한 fetch가
 * 실제 신호라는 connectivity.ts isCurrentlyOnline의 웹 fallback 철학과 동일).
 */
export function wireOnlineManagerToConnectivity(
  manager: OnlineManagerLike,
  checkOnline: () => Promise<boolean>,
  scheduler: IntervalScheduler = defaultScheduler,
  pollIntervalMs: number = ONLINE_POLL_INTERVAL_MS
): void {
  manager.setEventListener((setOnline) => {
    let lastKnownOnline: boolean | null = null;
    const timer = scheduler.setInterval(() => {
      void checkOnline().then((online) => {
        if (online === lastKnownOnline) return;
        lastKnownOnline = online;
        setOnline(online);
      });
    }, pollIntervalMs);
    return () => scheduler.clearInterval(timer);
  });
}
