import { Stack } from "expo-router";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { LOCAL_SESSION_TOKEN } from "../src/api/client";
import { PurchaseFollowupLifecycle } from "../src/commerce/PurchaseFollowupPrompt";
import { ErrorBoundary } from "../src/errors/ErrorBoundary";
import { useOfflineSyncLifecycle } from "../src/offline/sync-controller";
import { installAppQueryRefetchWiring } from "../src/query/install-app-refetch";
import { registerAppQueryClient } from "../src/query/query-client-registry";
import { useSessionStore } from "../src/stores/session.store";

// MOB-117: react-query의 기본 focus/online 리스너는 웹 전용(window focus/online 이벤트)이라
// 네이티브에서는 포그라운드 복귀·네트워크 복구 시 재조회가 전혀 없었다. focusManager를
// AppState("active" 전환)에, onlineManager를 기존 오프라인 connectivity 폴링 관례에 연결한다
// (src/query/install-app-refetch.ts -- 멱등이라 모듈 스코프 1회 호출로 충분하고, ErrorBoundary
// 리마운트에도 중복 설치되지 않는다).
installAppQueryRefetchWiring();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // MOB-117 보수적 기본값: staleTime 기본값 0이면 위 포커스 연결 이후 짧은 앱 전환(알림
      // 확인, 공유 시트 등)마다 모든 활성 쿼리가 통째로 재조회돼 배터리/트래픽 폭주 위험이
      // 있다. 30초면 "복귀하면 최신"이라는 체감은 유지하면서 연속 전환 폭주만 막는다. 기존
      // 동작 영향 최소화 근거: invalidateQueries(뮤테이션 후 갱신, 오프라인 flush, 당겨서
      // 새로고침)는 staleTime과 무관하게 즉시 refetch하고, 마운트 시 최초 조회도 그대로다.
      // 그 외 기본값(gcTime, retry, refetchOnWindowFocus/Reconnect 등)은 건드리지 않는다.
      staleTime: 30_000
    }
  }
});

// FIX-118A (M-3): 사용자 스코프 쿼리 키(["children"], ["my-devices"] 등)에는 사용자 식별자가
// 없어서, 로그아웃/계정 전환 teardown이 zustand·SQLite만 지우면 위 staleTime(30초) 동안 이전
// 계정의 응답이 그대로 렌더된다. 레지스트리에 등록해 두면 session-teardown.ts가 순환 import
// 없이 이 클라이언트의 캐시를 비울 수 있다(등록 전이면 no-op).
registerAppQueryClient(queryClient);

/**
 * MOB-102 (round5a-sprint1-plan.md §3.2 point 4): mounted once at the app root so the offline
 * outbox flush-on-reconnect/foreground wiring runs for the whole app lifetime, independent of
 * which screen/tab is currently focused.
 */
function OfflineSyncLifecycle() {
  const accessToken = useSessionStore((state) => state.accessToken);
  const isTestSession = useSessionStore((state) => state.isTestSession);
  const token = accessToken ?? (isTestSession ? LOCAL_SESSION_TOKEN : null);
  const client = useQueryClient();
  useOfflineSyncLifecycle(token, client);
  return null;
}

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      {/* MOB-108: global render-crash boundary. Wraps the navigator AND the lifecycle mounts
          (OfflineSyncLifecycle, PurchaseFollowupLifecycle) so a crash in any of them shows the
          warm recovery screen instead of a white screen; [다시 시도] remounts this whole subtree.
          Kept inside QueryClientProvider — the boundary itself has no provider/store deps. */}
      <ErrorBoundary>
        <OfflineSyncLifecycle />
        <Stack screenOptions={{ headerShown: false }} />
        {/* COM-108: mounted after <Stack> so the 구매하셨나요? follow-up card overlays whatever
            screen is focused. Inert without a real/demo session and never blocks navigation --
            see src/commerce/PurchaseFollowupPrompt.tsx. */}
        <PurchaseFollowupLifecycle />
      </ErrorBoundary>
    </QueryClientProvider>
  );
}
