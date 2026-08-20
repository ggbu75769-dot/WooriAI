import { Ionicons } from "@expo/vector-icons";
import { Redirect, Tabs } from "expo-router";
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
  const isPixelLockMode = process.env.EXPO_PUBLIC_PIXEL_LOCK === "1";

  if (!isPixelLockMode) {
    if (!accessToken && !isTestSession) {
      return <Redirect href="/launch-animation" />;
    }

    if (!hasReachedHome && !isTestSession) {
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
          borderTopColor: "rgba(74, 63, 53, 0.08)",
          height: BottomTabPixelStyles.height,
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
