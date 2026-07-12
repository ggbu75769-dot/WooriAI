import { Redirect, Tabs } from "expo-router";
import { Text } from "react-native";
import { BottomTabPixelStyles } from "../../src/pixelLock/styles";
import { useOnboardingProgressStore } from "../../src/stores/onboarding-progress.store";
import { useSessionStore } from "../../src/stores/session.store";
import { theme } from "../../src/theme";

const tabs = {
  index: { title: "홈", icon: "⌂" },
  records: { title: "기록", icon: "▣" },
  items: { title: "준비템", icon: "☆" },
  reports: { title: "리포트", icon: "▥" },
  more: { title: "더보기", icon: "☰" }
} as const;

function icon(name: keyof typeof tabs, focused: boolean) {
  return (
    <Text style={{ color: focused ? theme.colors.mainCoral : theme.colors.gray600, fontSize: BottomTabPixelStyles.iconSize }}>
      {tabs[name].icon}
    </Text>
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
      return <Redirect href="/onboarding/child-status" />;
    }
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.mainCoral,
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
