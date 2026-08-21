import { AppState, Platform } from "react-native";
import { focusManager, onlineManager } from "@tanstack/react-query";
import { isCurrentlyOnline } from "../offline/connectivity";
import { wireFocusManagerToAppState, wireOnlineManagerToConnectivity } from "./app-refetch";

/**
 * MOB-117 네이티브 글루: app/_layout.tsx 모듈 스코프에서 1회 호출된다. 결정 로직은 전부
 * app-refetch.ts(단위 테스트됨)에 있고, 이 파일은 connectivity.ts처럼 네이티브 import만 담는
 * 얇은 배선층이라 vitest 대상이 아니다(소스 계약은 refresh-wiring-contract.test.ts가 고정).
 */
let installed = false;

export function installAppQueryRefetchWiring(): void {
  // 웹(픽셀락 미리보기 포함)에서는 react-query 기본 리스너(window focus/online 이벤트)가
  // 이미 올바르게 동작하므로 교체하지 않는다 -- 이벤트 기반을 15초 폴링으로 바꾸면 오히려
  // 후퇴다. 이 연결은 기본 리스너가 전혀 발화하지 않는 네이티브(iOS/Android) 전용.
  if (Platform.OS === "web") return;
  // 멱등: ErrorBoundary 리마운트/핫리로드로 다시 불려도 리스너를 중복 교체하지 않는다.
  if (installed) return;
  installed = true;
  wireFocusManagerToAppState(focusManager, AppState);
  wireOnlineManagerToConnectivity(onlineManager, isCurrentlyOnline);
}
