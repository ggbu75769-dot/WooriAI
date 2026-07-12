import { Redirect } from "expo-router";
import { useEffect, useState } from "react";
import { useOnboardingProgressStore } from "../src/stores/onboarding-progress.store";
import { useSessionStore } from "../src/stores/session.store";

declare const __DEV__: boolean;

/**
 * The session store rehydrates from SecureStore (and the onboarding-progress store from
 * AsyncStorage) asynchronously. Redirecting before both finish would always see a null
 * accessToken on a cold start and dump a logged-in user back onto the landing screen,
 * so the index route must hold rendering until hydration completes.
 */
function storesHydrated() {
  return (
    useSessionStore.persist.hasHydrated() && useOnboardingProgressStore.persist.hasHydrated()
  );
}

export default function IndexScreen() {
  const accessToken = useSessionStore((state) => state.accessToken);
  const isTestSession = useSessionStore((state) => state.isTestSession);
  const hasReachedHome = useOnboardingProgressStore((state) => state.hasReachedHome);
  const [hydrated, setHydrated] = useState(storesHydrated);

  useEffect(() => {
    if (hydrated) {
      return;
    }
    const unsubscribes = [
      useSessionStore.persist.onFinishHydration(() => setHydrated(storesHydrated())),
      useOnboardingProgressStore.persist.onFinishHydration(() => setHydrated(storesHydrated()))
    ];
    // Hydration may have finished between the initial render and effect registration.
    setHydrated(storesHydrated());
    return () => {
      for (const unsubscribe of unsubscribes) {
        unsubscribe();
      }
    };
  }, [hydrated]);

  if (process.env.EXPO_PUBLIC_PIXEL_LOCK === "1") {
    return <Redirect href="/pixel-lock?screen=HOME-001" />;
  }

  if (!hydrated) {
    return null;
  }

  if (!accessToken && !isTestSession) {
    return <Redirect href="/launch-animation" />;
  }

  return <Redirect href={hasReachedHome || isTestSession ? "/(tabs)" : "/onboarding/child-status"} />;
}
