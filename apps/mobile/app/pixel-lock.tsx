import { useEffect } from "react";
import { Redirect, router, useLocalSearchParams } from "expo-router";
import { useOnboardingProgressStore } from "../src/stores/onboarding-progress.store";
import { useSelectedChildStore } from "../src/stores/selected-child.store";
import { useSessionStore } from "../src/stores/session.store";

declare const __DEV__: boolean;

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

export default function PixelLockLauncher() {
  const params = useLocalSearchParams<{ screen?: string }>();
  const clearSession = useSessionStore((state) => state.clearSession);
  const clearSelectedChildId = useSelectedChildStore((state) => state.clearSelectedChildId);
  const resetOnboarding = useOnboardingProgressStore((state) => state.resetOnboarding);

  const screenId = String(params.screen ?? "SPL-001");
  const href = pixelLockRoutes[screenId as keyof typeof pixelLockRoutes] ?? pixelLockRoutes["SPL-001"];

  useEffect(() => {
    if (!__DEV__) return;
    clearSession();
    clearSelectedChildId();
    resetOnboarding();
    router.replace(href);
  }, [clearSelectedChildId, clearSession, href, resetOnboarding]);

  if (!__DEV__) {
    return <Redirect href="/" />;
  }

  return null;
}
