import { useEffect, useState } from "react";
import { AccessibilityInfo } from "react-native";
import { Stack } from "expo-router";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { LOCAL_SESSION_TOKEN } from "../src/api/client";
import { PurchaseFollowupLifecycle } from "../src/commerce/PurchaseFollowupPrompt";
import { ErrorBoundary } from "../src/errors/ErrorBoundary";
import { useOfflineSyncLifecycle } from "../src/offline/sync-controller";
import { installAppQueryRefetchWiring } from "../src/query/install-app-refetch";
import { registerAppQueryClient } from "../src/query/query-client-registry";
import { SHARED_CACHE_POLICIES } from "../src/query/shared-cache-policy";
import { AppLockOverlay, AppLockScreenShield } from "../src/security/AppLockOverlay";
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

/**
 * 라운드 83 트랙 D(GAP-083 #3) — **공유 캐시 키의 신선도를 키별로 한 벌씩 등록하는 유일한 자리.**
 *
 * 값도 이유도 여기에 적지 않는다 — 표는 src/query/shared-cache-policy.ts 한 곳에 있고 여기서는
 * 그것을 훑기만 한다(정책 원천이 둘이 되면 shared-cache-policy.test.ts의 ⓓ가 빨개진다).
 *
 * 우선순위는 `defaultOptions.queries` < 이 키별 기본 < 호출부 인라인 옵션이라, 위 전역 30초는
 * 표에 없는 모든 키에 종전 그대로 적용되고 화면이 직접 적은 staleTime도 여전히 이긴다.
 * `staleTimeMs: null`인 줄은 "전역 30초를 그대로 둔다"는 판정이라 등록하지 않는다.
 */
for (const policy of SHARED_CACHE_POLICIES) {
  if (policy.staleTimeMs === null) continue;
  queryClient.setQueryDefaults([...policy.queryKeyPrefix], { staleTime: policy.staleTimeMs });
}

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
  /**
   * 라운드 96 T3 — 지출 기록 시트(/expenses/new)의 전환.
   *
   * 그 화면은 시트 문법으로 그려진다(BottomSheetFrame·닫기 ×·하단 고정 요약바 — FAB가 여는
   * "빠른 기록"이다). 그런데 전환만 스택 기본값(좌우 push)이라, 화면이 옆에서 밀려 들어와
   * 문법과 몸짓이 어긋났다. 시트답게 아래에서 올라오게 한다(slide_from_bottom).
   *
   * reduce-motion이면 전환 애니메이션을 걸지 않는다 — 이 저장소의 관례(app/launch-animation.tsx
   * · src/ui/Skeleton.tsx의 AccessibilityInfo.isReduceMotionEnabled 폴링)를 그대로 따른다.
   * 값은 앱 루트에서 한 번 읽는다: 전환 방향은 프레임마다 갈리는 값이 아니고, 설정 변경은
   * 다음 앱 실행이 반영한다(launch-animation과 같은 판단).
   */
  const [reduceMotionEnabled, setReduceMotionEnabled] = useState(false);
  useEffect(() => {
    let isMounted = true;
    AccessibilityInfo.isReduceMotionEnabled?.()
      .then((enabled) => {
        if (isMounted && enabled) setReduceMotionEnabled(true);
      })
      .catch(() => {});
    return () => {
      isMounted = false;
    };
  }, []);
  return (
    <QueryClientProvider client={queryClient}>
      {/* MOB-108: global render-crash boundary. Wraps the navigator AND the lifecycle mounts
          (OfflineSyncLifecycle, PurchaseFollowupLifecycle) so a crash in any of them shows the
          warm recovery screen instead of a white screen; [다시 시도] remounts this whole subtree.
          Kept inside QueryClientProvider — the boundary itself has no provider/store deps. */}
      <ErrorBoundary>
        <OfflineSyncLifecycle />
        {/* GAP-059 #3: 잠금 중 **뒤 화면 트리**를 접근성 트리에서 가리는 방패. 오버레이는
            <Stack>과 형제라 z-order로만 위에 오고, 접근성 트리는 z-order로 잘리지 않는다 —
            덮여 있는 동안에도 TalkBack이 뒤의 금액·품목명을 읽었다. 감싸는 범위는 아래 둘
            (<Stack>과 구매 확인 카드) 뿐이고 잠금 오버레이는 **밖에** 둔다 — 안에 넣으면
            잠금 화면이 자기 자신을 접근성 트리에서 지운다. 잠금을 켜지 않은 사용자에게는 이
            노드가 생기지 않고(수용 기준 2), 픽셀락 빌드에서는 존재할 수 없다(수용 기준 6) —
            근거·대안 비교는 src/security/AppLockOverlay.tsx의 AppLockScreenShield 주석. */}
        <AppLockScreenShield>
          <Stack screenOptions={{ headerShown: false }}>
            {/* 라운드 96 T3: 시트 문법 화면은 시트처럼 아래에서 올라온다(위 RootLayout 주석).
                reduce-motion이면 "none" — 몸짓을 지어내지 않는다. */}
            <Stack.Screen
              name="expenses/new"
              options={{ animation: reduceMotionEnabled ? "none" : "slide_from_bottom" }}
            />
          </Stack>
          {/* COM-108: mounted after <Stack> so the 구매하셨나요? follow-up card overlays whatever
              screen is focused. Inert without a real/demo session and never blocks navigation --
              see src/commerce/PurchaseFollowupPrompt.tsx. */}
          <PurchaseFollowupLifecycle />
        </AppLockScreenShield>
        {/* 라운드 55 트랙 B (docs/5차/round55-plan.md §2.4): 앱 잠금 오버레이. <Stack>과 구매 확인
            카드 **뒤에** 마운트해야 그 둘을 덮는다 — 구매 확인 카드도 계정 데이터(품목명)를 전역
            오버레이로 그린다. 라우트가 아니라 오버레이인 이유는 뒤로가기·딥링크로 우회할 수 있는
            내비게이션 상태를 만들지 않기 위해서다. 픽셀락·비세션·PIN 미설정에서는 null을 반환해
            기존 화면 트리가 한 노드도 달라지지 않는다. */}
        <AppLockOverlay />
      </ErrorBoundary>
    </QueryClientProvider>
  );
}
