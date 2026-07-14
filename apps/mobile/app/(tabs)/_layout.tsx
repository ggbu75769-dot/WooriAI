import { Redirect, Tabs } from "expo-router";
import { BottomTabPixelStyles } from "../../src/pixelLock/styles";
import { useOnboardingProgressStore } from "../../src/stores/onboarding-progress.store";
import { useSessionStore } from "../../src/stores/session.store";
import { theme } from "../../src/theme";
import { AppIcon, type AppIconName } from "../../src/ui";

// D1 (docs/5차/round5a-design-spec.md §D1): one unified icon family, each tab an
// outlined/filled glyph pair from the same geometric-shape set (consistent stroke weight and
// proportion across all 5 tabs, replacing the previous mismatched one-off glyphs). Inactive tabs
// render the outlined glyph; the active tab renders the filled glyph tinted coral-500.
const tabs: Record<"index" | "records" | "items" | "reports" | "more", { title: string; outline: AppIconName; filled: AppIconName }> = {
  index: { title: "홈", outline: "home-outline", filled: "home" },
  records: { title: "기록", outline: "notebook-outline", filled: "notebook" },
  items: { title: "준비템", outline: "package-variant-closed", filled: "package-variant" },
  reports: { title: "리포트", outline: "chart-bar", filled: "chart-bar" },
  more: { title: "더보기", outline: "account-circle-outline", filled: "account-circle" }
};

function icon(name: keyof typeof tabs, focused: boolean) {
  return (
    <AppIcon
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
