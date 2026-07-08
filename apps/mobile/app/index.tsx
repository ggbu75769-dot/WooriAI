import { Redirect } from "expo-router";
import { useOnboardingProgressStore } from "../src/stores/onboarding-progress.store";
import { useSessionStore } from "../src/stores/session.store";

export default function IndexScreen() {
  const accessToken = useSessionStore((state) => state.accessToken);
  const hasReachedHome = useOnboardingProgressStore((state) => state.hasReachedHome);

  if (!accessToken) {
    return <Redirect href="/launch-animation" />;
  }

  return <Redirect href={hasReachedHome ? "/(tabs)" : "/onboarding/child-status"} />;
}
