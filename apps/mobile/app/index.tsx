import { Redirect } from "expo-router";
import { useOnboardingProgressStore } from "../src/stores/onboarding-progress.store";
import { useSessionStore } from "../src/stores/session.store";

declare const __DEV__: boolean;

export default function IndexScreen() {
  const accessToken = useSessionStore((state) => state.accessToken);
  const isTestSession = useSessionStore((state) => state.isTestSession);
  const hasReachedHome = useOnboardingProgressStore((state) => state.hasReachedHome);

  if (process.env.EXPO_PUBLIC_PIXEL_LOCK === "1") {
    return <Redirect href="/pixel-lock?screen=HOME-001" />;
  }

  if (!accessToken && !isTestSession) {
    return <Redirect href="/launch-animation" />;
  }

  return <Redirect href={hasReachedHome || isTestSession ? "/(tabs)" : "/onboarding/child-status"} />;
}
