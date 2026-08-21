import { Platform } from "react-native";
import { focusManager } from "@tanstack/react-query";
import { subscribeAppStateChange } from "../offline/connectivity";
import { wireFocusManagerToAppState, type AppStateLike } from "./app-refetch";

/**
 * MOB-117 네이티브 글루: app/_layout.tsx 모듈 스코프에서 1회 호출된다. 결정 로직은 전부
 * app-refetch.ts(단위 테스트됨)에 있고, 이 파일은 connectivity.ts처럼 네이티브 import만 담는
 * 얇은 배선층이라 vitest 대상이 아니다(소스 계약은 refresh-wiring-contract.test.ts가 고정).
 *
 * FIX-118A: onlineManager 배선(expo-network 폴링)은 제거했다 -- react-query가 online=false인
 * 동안 쿼리를 paused로 두는 바람에 오프라인 당겨서 새로고침 무한 스피너/백지 화면을 만들었다.
 * 자세한 근거는 app-refetch.ts 헤더 참고. 여기 남는 것은 focus 배선뿐이고, 그마저도
 * connectivity.ts의 단일 AppState 구독(subscribeAppStateChange)에 얹어 네이티브 리스너가
 * 중복되지 않게 한다.
 */
let installed = false;

/** connectivity.ts의 공용 AppState 구독을 app-refetch.ts가 기대하는 AppStateLike 형태로 감싼다
 * (구독 해제 함수 -> { remove }). */
const sharedAppState: AppStateLike = {
  addEventListener: (_type, listener) => ({ remove: subscribeAppStateChange(listener) })
};

export function installAppQueryRefetchWiring(): void {
  // 웹(픽셀락 미리보기 포함)에서는 react-query 기본 리스너(window focus 이벤트)가 이미 올바르게
  // 동작하므로 교체하지 않는다. 이 연결은 기본 리스너가 전혀 발화하지 않는
  // 네이티브(iOS/Android) 전용.
  if (Platform.OS === "web") return;
  // 멱등: ErrorBoundary 리마운트/핫리로드로 다시 불려도 리스너를 중복 교체하지 않는다.
  if (installed) return;
  installed = true;
  wireFocusManagerToAppState(focusManager, sharedAppState);
}
