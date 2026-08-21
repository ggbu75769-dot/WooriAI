/**
 * MOB-117: react-query의 기본 focusManager는 웹 전용 이벤트(window focus)를 듣기 때문에 React
 * Native에서는 "포그라운드 복귀 시 재조회"가 전혀 동작하지 않았다. 이 모듈은 그 연결
 * (포커스=AppState "active" 전환)을 담당하는 **transport-agnostic 코어**다.
 *
 * connectivity.ts / sync-controller.ts 선례를 그대로 따른다: 네이티브 모듈(AppState,
 * expo-network)은 vitest node 환경에서 import조차 불가능하므로, 실제 네이티브 import는
 * install-app-refetch.ts(얇은 글루, 테스트 안 함)에 두고 여기의 로직은 전부 주입식
 * 인터페이스로 받아 단위 테스트한다(app-refetch.test.ts).
 *
 * ## FIX-118A: onlineManager 배선은 의도적으로 없다
 *
 * 이 모듈에는 한때 `wireOnlineManagerToConnectivity`(expo-network 15초 폴링 -> onlineManager)가
 * 같이 있었지만, 실버그 3건(M-1/M-2/m-10)의 단일 원인이라 제거했다. react-query는 online=false인
 * 동안 쿼리를 **일시정지(paused)** 시키는데, RN 기본값은 항상 online=true라 그 상태가 생길 일이
 * 없었다. 폴러가 실제로 false를 넣기 시작하면서:
 *
 *   - 오프라인에서 당겨서 새로고침 -> invalidateQueries가 refetch 완료를 기다리다 영구 pending
 *     -> RefreshControl 스피너가 영원히 도는 문제(전 탭);
 *   - paused 쿼리는 isLoading/isError가 모두 false -> 아이 관리/알림 화면이 백지, 탭은 영구
 *     스켈레톤(로딩도 에러도 아닌 제3의 상태를 화면들이 다루지 않는다).
 *
 * 오프라인 감지는 "요청이 실제로 실패하는 것"이 신호라는 connectivity.ts isCurrentlyOnline의
 * 웹 fallback 철학과 같고, 그 실패는 각 화면의 기존 isError 경로가 이미 처리한다. 아웃박스
 * flush의 재연결 트리거는 connectivity.ts의 watcher가 계속 담당하므로 잃는 기능도 없다.
 * 다시 배선하고 싶다면 먼저 모든 화면에 paused 상태 UI를 만들어야 한다.
 */

/** AppState의 "active" 상태만 포커스로 취급 -- "inactive"(iOS 앱 전환 중)/"background" 모두
 * 비포커스. sync-controller의 포그라운드 훅(connectivity.ts handleAppStateChange)과 동일 기준. */
export function isForegroundAppState(status: string): boolean {
  return status === "active";
}

// 구조적 타입: @tanstack/query-core의 FocusManager.setEventListener 시그니처와 react-native
// AppState.addEventListener 시그니처에 각각 구조적으로 맞춘 최소 인터페이스.
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
