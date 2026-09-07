import { Ionicons } from "@expo/vector-icons";
import { Redirect, Tabs } from "expo-router";
import { useWindowDimensions } from "react-native";
import { LOCAL_SESSION_TOKEN } from "../../src/api/client";
import { adaptiveTabBarHeight } from "../../src/design-system/responsive";
import { usePushDeviceRegistration } from "../../src/notifications/usePushDeviceRegistration";
import { BottomTabPixelStyles } from "../../src/pixelLock/styles";
import { useOnboardingProgressStore } from "../../src/stores/onboarding-progress.store";
import { useSessionStore } from "../../src/stores/session.store";
import { theme } from "../../src/theme";

// D1 (docs/5차/round5a-design-spec.md §D1) + UX-5B-4: one unified icon family, each tab an
// outlined/filled Ionicons pair (consistent stroke weight and proportion across all 5 tabs,
// replacing the previous text glyphs ○●□■☆★◇◆). Inactive tabs render the outlined variant;
// the active tab renders the filled variant tinted coral-500.
const tabs = {
  index: { title: "홈", outline: "home-outline", filled: "home" },
  records: { title: "기록", outline: "receipt-outline", filled: "receipt" },
  items: { title: "준비템", outline: "cube-outline", filled: "cube" },
  reports: { title: "리포트", outline: "bar-chart-outline", filled: "bar-chart" },
  more: { title: "더보기", outline: "menu-outline", filled: "menu" }
} as const;

function icon(name: keyof typeof tabs, focused: boolean) {
  return (
    <Ionicons
      color={focused ? theme.colors.coral[500] : theme.colors.gray600}
      name={focused ? tabs[name].filled : tabs[name].outline}
      size={BottomTabPixelStyles.iconSize}
    />
  );
}

export default function TabsLayout() {
  const accessToken = useSessionStore((state) => state.accessToken);
  const isTestSession = useSessionStore((state) => state.isTestSession);
  const hasReachedHome = useOnboardingProgressStore((state) => state.hasReachedHome);
  // PUSH-116 부팅 등록: 세션이 준비된 첫 지점에서 이 기기를 /me/devices에 멱등 등록한다.
  // 플래그 off / expo-notifications 미설치 / 토큰 없음이면 훅 내부에서 완전 no-op이고,
  // 실패도 조용히 무시되므로 탭 렌더/리다이렉트 흐름에는 어떤 영향도 없다 (early return보다
  // 앞에 두어 훅 순서를 고정한다).
  usePushDeviceRegistration(accessToken ?? (isTestSession ? LOCAL_SESSION_TOKEN : null));
  // A11Y-TAB-001 두 시점 ①: 종전에는 탭바 높이가 `BottomTabPixelStyles.height`(72) 리터럴 하나였다
  // -- 캡처 시점(글꼴 배율 1.0)에는 참이었다. 이제는 OS 글꼴 배율을 함께 읽는다. 근거: 이 바의
  // 콘텐츠 칸은 72 - paddingTop 8 - paddingBottom 10 = 54dp이고, 그 안에서 라이브러리가 탭 한 칸에
  // padding 5(@react-navigation/bottom-tabs `tabVerticalUiKit`)와 아이콘 래퍼 28dp(`ICON_SIZE_TALL`)를
  // 고정으로 쓰므로 라벨에 남는 자리는 54 - 10 - 28 = 16dp뿐이다. 아이콘 글리프(19)는
  // `@expo/vector-icons`가 `allowFontScaling: false`로 그려 배율과 무관하지만 라벨(10)은 배율을 타서,
  // 기본 줄높이 비율 약 1.2 기준 배율 1.33쯤에서 16dp를 넘어선다 -- 앱이 "큰 글자 레이아웃"으로
  // 치는 1.5(LARGE_TEXT_SCALE_THRESHOLD)보다도 먼저다. `useWindowDimensions`는 훅이므로 아래 early
  // return(Redirect)보다 위에 둔다(FIX-A).
  const { fontScale } = useWindowDimensions();
  const isPixelLockMode = process.env.EXPO_PUBLIC_PIXEL_LOCK === "1";

  if (!isPixelLockMode) {
    if (!accessToken && !isTestSession) {
      return <Redirect href="/launch-animation" />;
    }

    // 실기기 피드백 1: `&& !isTestSession` 예외를 뺐다 -- 테스트 로그인도 실계정과 같이
    // 아이 정보 입력을 포함한 온보딩을 마쳐야 탭에 들어온다.
    if (!hasReachedHome) {
      // MOB-101: defer to "/" instead of hardcoding ONB-001 -- app/index.tsx is the single
      // place that checks server onboarding progress and can route straight to the resume
      // screen (ONB-006) or the correct interrupted step, instead of always restarting the
      // flow from the top.
      return <Redirect href="/" />;
    }
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.coral[500],
        tabBarInactiveTintColor: theme.colors.gray600,
        tabBarLabelStyle: { fontSize: BottomTabPixelStyles.labelSize, fontWeight: "700" },
        tabBarStyle: {
          backgroundColor: theme.colors.white,
          borderTopColor: theme.colors.presentation.hairline,
          // A11Y-TAB-001 두 시점 ②: 종전 `BottomTabPixelStyles.height`(=72 고정) → 이제
          // `adaptiveTabBarHeight(72, fontScale)`. 픽셀락 캡처 여덟 장은 글꼴 배율 1.0에서 찍혔고
          // `adaptiveTabBarHeight(72, 1) === 72`이므로 캡처 재대조는 필요 없다(아래 계약 테스트가
          // 이 불변을 리터럴로 고정한다). 배율이 오를 때만 최대 +24dp까지 자란다.
          height: adaptiveTabBarHeight(BottomTabPixelStyles.height, fontScale),
          paddingBottom: BottomTabPixelStyles.paddingBottom,
          paddingTop: BottomTabPixelStyles.paddingTop
        }
      }}
    >
      <Tabs.Screen name="index" options={{ title: tabs.index.title, tabBarIcon: ({ focused }) => icon("index", focused) }} />
      <Tabs.Screen name="records" options={{ title: tabs.records.title, tabBarIcon: ({ focused }) => icon("records", focused) }} />
      <Tabs.Screen name="items" options={{ title: tabs.items.title, tabBarIcon: ({ focused }) => icon("items", focused) }} />
      <Tabs.Screen name="reports" options={{ title: tabs.reports.title, tabBarIcon: ({ focused }) => icon("reports", focused) }} />
      <Tabs.Screen name="more" options={{ href: null }} />
    </Tabs>
  );
}
