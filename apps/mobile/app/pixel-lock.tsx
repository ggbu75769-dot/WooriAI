import { useEffect, useState } from "react";
import { Redirect, router, useLocalSearchParams, useRootNavigationState, type Href } from "expo-router";
import * as Linking from "expo-linking";
import { LogBox } from "react-native";
import { useOnboardingProgressStore } from "../src/stores/onboarding-progress.store";
import { useSelectedChildStore } from "../src/stores/selected-child.store";
import { useSessionStore } from "../src/stores/session.store";
import { parsePixelLockRequest, type PixelLockRequest } from "../src/pixelLock/deep-link";
import { isPixelLockBuild } from "../src/pixelLock/build-profile";

const pixelLockRoutes = {
  "SPL-001": "/launch-animation?pixelLock=1",
  "HOME-001": "/(tabs)",
  "EXP-001": "/expenses/new",
  "ITEM-001": "/(tabs)/items",
  "ITEM-002": "/items/preview-diaper-party-pack",
  "REP-001": "/(tabs)/reports",
  "FAM-001": "/family",
  "IMP-003": "/import",
  "SET-001": "/(tabs)/more",
  "PAY-001": "/payment-methods?evidence=PAY-001",
  "PAY-002": "/payment-methods?evidence=PAY-002",
  "EXP-PAY-001": "/expenses/new?evidence=EXP-PAY-001",
  "PROFILE-GENDER-001": "/children/new?evidence=PROFILE-GENDER-001",
  "ITEM-CATALOG-001": "/(tabs)/items",
  "ITEM-COVERAGE-001": "/catalog-coverage-evidence"
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
  const pixelLockEnabled = isPixelLockBuild();
  const params = useLocalSearchParams<{ screen?: string; overrides?: string }>();
  const rootNavigationState = useRootNavigationState();
  const clearSession = useSessionStore((state) => state.clearSession);
  const clearSelectedChildId = useSelectedChildStore((state) => state.clearSelectedChildId);
  const resetOnboarding = useOnboardingProgressStore((state) => state.resetOnboarding);
  const [nativeRequest, setNativeRequest] = useState<PixelLockRequest | null>(null);
  const [nativeLinkResolved, setNativeLinkResolved] = useState(Boolean(params.screen));

  const screenId = String(params.screen ?? nativeRequest?.screen ?? "SPL-001");
  const href = pixelLockRoutes[screenId as keyof typeof pixelLockRoutes] ?? pixelLockRoutes["SPL-001"];
  const rawOverrides = String(params.overrides ?? nativeRequest?.overrides ?? "");

  useEffect(() => {
    if (params.screen) {
      setNativeLinkResolved(true);
      return;
    }
    let active = true;
    void Linking.getInitialURL().then((url) => {
      if (!active) return;
      setNativeRequest(url ? parsePixelLockRequest(url) : null);
      setNativeLinkResolved(true);
    });
    return () => {
      active = false;
    };
  }, [params.screen]);

  useEffect(() => {
    if (!pixelLockEnabled || !rootNavigationState?.key || !nativeLinkResolved) return;
    LogBox.ignoreAllLogs(true);
    applyPixelLockOverrides(rawOverrides);
    clearSession();
    clearSelectedChildId();
    resetOnboarding();
    const timer = setTimeout(() => router.replace(href as Href), 0);
    return () => clearTimeout(timer);
  }, [clearSelectedChildId, clearSession, href, nativeLinkResolved, rawOverrides, resetOnboarding, rootNavigationState?.key]);

  if (!pixelLockEnabled) {
    return <Redirect href="/" />;
  }

  if (!nativeLinkResolved) return null;

  return null;
}
