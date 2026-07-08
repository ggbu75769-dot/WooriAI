import { useEffect } from "react";
import { Redirect, router, useLocalSearchParams, useRootNavigationState } from "expo-router";
import { LogBox } from "react-native";
import { useOnboardingProgressStore } from "../src/stores/onboarding-progress.store";
import { useSelectedChildStore } from "../src/stores/selected-child.store";
import { useSessionStore } from "../src/stores/session.store";

declare const __DEV__: boolean;

const pixelLockEnabled = __DEV__ || process.env.EXPO_PUBLIC_PIXEL_LOCK === "1";

const pixelLockRoutes = {
  "SPL-001": "/launch-animation?pixelLock=1",
  "HOME-001": "/(tabs)",
  "EXP-001": "/expenses/new",
  "ITEM-001": "/(tabs)/items",
  "ITEM-002": "/items/preview-diaper-party-pack",
  "REP-001": "/(tabs)/reports",
  "FAM-001": "/family",
  "IMP-003": "/import",
  "SET-001": "/(tabs)/more"
} as const;

type PixelLockOverrideMap = Record<string, Record<string, number>>;

function applyPixelLockOverrides(rawOverrides?: string) {
  const globalWithOverrides = globalThis as typeof globalThis & {
    __WOORIAI_PIXEL_LOCK_OVERRIDES__?: PixelLockOverrideMap;
  };

  if (!rawOverrides) {
    globalWithOverrides.__WOORIAI_PIXEL_LOCK_OVERRIDES__ = {};
    return;
  }

  try {
    const parsed = JSON.parse(decodeURIComponent(rawOverrides)) as PixelLockOverrideMap;
    globalWithOverrides.__WOORIAI_PIXEL_LOCK_OVERRIDES__ = parsed;
  } catch {
    globalWithOverrides.__WOORIAI_PIXEL_LOCK_OVERRIDES__ = {};
  }
}

export default function PixelLockLauncher() {
  const params = useLocalSearchParams<{ screen?: string; overrides?: string }>();
  const rootNavigationState = useRootNavigationState();
  const clearSession = useSessionStore((state) => state.clearSession);
  const clearSelectedChildId = useSelectedChildStore((state) => state.clearSelectedChildId);
  const resetOnboarding = useOnboardingProgressStore((state) => state.resetOnboarding);

  const screenId = String(params.screen ?? "SPL-001");
  const href = pixelLockRoutes[screenId as keyof typeof pixelLockRoutes] ?? pixelLockRoutes["SPL-001"];

  useEffect(() => {
    if (!pixelLockEnabled || !rootNavigationState?.key) return;
    LogBox.ignoreAllLogs(true);
    applyPixelLockOverrides(String(params.overrides ?? ""));
    clearSession();
    clearSelectedChildId();
    resetOnboarding();
    const timer = setTimeout(() => router.replace(href), 0);
    return () => clearTimeout(timer);
  }, [clearSelectedChildId, clearSession, href, params.overrides, resetOnboarding, rootNavigationState?.key]);

  if (!pixelLockEnabled) {
    return <Redirect href="/" />;
  }

  return null;
}
