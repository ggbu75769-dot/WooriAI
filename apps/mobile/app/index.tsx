import { Redirect } from "expo-router";
import { useEffect, useState } from "react";
import { getOnboardingProgress } from "../src/api/client";
import { ensureLocalBackendSeeded } from "../src/api/local-backend";
import { LOCAL_CHILD_ID } from "../src/api/local-fixtures";
import { useOnboardingProgressStore } from "../src/stores/onboarding-progress.store";
import { useOnboardingResumeStore } from "../src/stores/onboarding-resume.store";
import { useSelectedChildStore } from "../src/stores/selected-child.store";
import { useSessionStore } from "../src/stores/session.store";

declare const __DEV__: boolean;

/**
 * The session store rehydrates from SecureStore (and the onboarding-progress/selected-child
 * stores from AsyncStorage) asynchronously. Redirecting before all three finish would always see
 * a null accessToken/selectedChildId on a cold start and either dump a logged-in user back onto
 * the landing screen or (MOB-107) send a test session to /(tabs) with no selectedChildId yet --
 * every screen's `Boolean(authToken && childId)` query gate would then race the same hydration,
 * so the index route must hold rendering until all three finish.
 */
function storesHydrated() {
  return (
    useSessionStore.persist.hasHydrated() &&
    useOnboardingProgressStore.persist.hasHydrated() &&
    useSelectedChildStore.persist.hasHydrated()
  );
}

/**
 * MOB-101 (round5a-sprint1-plan.md §4): once hydrated with a real (non-test) session that
 * hasn't locally reached home yet, this is the single place that asks the server where
 * onboarding was left off, so app restart / re-login / token refresh restores the exact
 * interrupted step instead of always sending the user back to ONB-001. `hasReachedHome` is
 * trusted once true (no repeat network round trip needed for already-onboarded sessions); the
 * server check only runs for the "not sure yet" case.
 */
type ProgressFetchState = "idle" | "loading" | "done";

export default function IndexScreen() {
  const accessToken = useSessionStore((state) => state.accessToken);
  const isTestSession = useSessionStore((state) => state.isTestSession);
  const hasReachedHome = useOnboardingProgressStore((state) => state.hasReachedHome);
  const markHomeReached = useOnboardingProgressStore((state) => state.markHomeReached);
  const setResumeProgress = useOnboardingResumeStore((state) => state.setProgress);
  const selectedChildId = useSelectedChildStore((state) => state.selectedChildId);
  const setSelectedChildId = useSelectedChildStore((state) => state.setSelectedChildId);
  const [hydrated, setHydrated] = useState(storesHydrated);
  const [progressFetch, setProgressFetch] = useState<ProgressFetchState>("idle");
  const [hasResumeTarget, setHasResumeTarget] = useState(false);

  useEffect(() => {
    if (hydrated) {
      return;
    }
    const unsubscribes = [
      useSessionStore.persist.onFinishHydration(() => setHydrated(storesHydrated())),
      useOnboardingProgressStore.persist.onFinishHydration(() => setHydrated(storesHydrated())),
      useSelectedChildStore.persist.onFinishHydration(() => setHydrated(storesHydrated()))
    ];
    // Safety valve: zustand persist never fires onFinishHydration (and never flips
    // hasHydrated) when the storage read itself rejects or the stored JSON is
    // corrupt. Without a timeout the app would sit on a blank screen forever in
    // that case -- after a short grace period we proceed with whatever state we
    // have (no token -> the landing screen), which is always recoverable.
    const fallback = setTimeout(() => setHydrated(true), 3000);
    // Hydration may have finished between the initial render and effect registration.
    setHydrated(storesHydrated());
    return () => {
      clearTimeout(fallback);
      for (const unsubscribe of unsubscribes) {
        unsubscribe();
      }
    };
  }, [hydrated]);

  useEffect(() => {
    if (!hydrated || isTestSession || !accessToken || hasReachedHome || progressFetch !== "idle") {
      return;
    }
    setProgressFetch("loading");
    getOnboardingProgress(accessToken)
      .then((progress) => {
        if (progress.summary.child?.id) {
          setSelectedChildId(progress.summary.child.id);
        }
        if (progress.completed) {
          markHomeReached();
          return;
        }
        // Only worth an interstitial resume screen once there is real progress to show
        // (consents already accepted, i.e. past the very first step) -- otherwise this is
        // just a fresh account and should start at ONB-001 like today.
        if (progress.summary.consentsAccepted) {
          setResumeProgress(progress);
          setHasResumeTarget(true);
        }
      })
      .catch(() => {
        // Offline / server unreachable: fall back to the local-only default below instead of
        // blocking the user indefinitely (local zustand persist is the offline-tolerant
        // fallback per round5a-sprint1-plan.md §4).
      })
      .finally(() => setProgressFetch("done"));
  }, [hydrated, isTestSession, accessToken, hasReachedHome, progressFetch, markHomeReached, setResumeProgress, setSelectedChildId]);

  /**
   * MOB-107: a hydrated test session with no selectedChildId (e.g. an upgrade install whose
   * `wooriai-selected-child` blob was missing/corrupt and got reset by that store's `migrate`)
   * would otherwise redirect straight to /(tabs) below with every screen's
   * `Boolean(authToken && childId)` query gate permanently false -- Home/준비템/리포트 would
   * each silently fall back to their logged-out preview UI forever instead of showing real data,
   * with no way for the user to recover short of reinstalling. The demo/test-session child is
   * always the same well-known fixture id, so it's always safe to re-derive it here rather than
   * leave the session stuck.
   */
  useEffect(() => {
    if (!hydrated || !isTestSession || selectedChildId) {
      return;
    }
    ensureLocalBackendSeeded();
    setSelectedChildId(LOCAL_CHILD_ID);
  }, [hydrated, isTestSession, selectedChildId, setSelectedChildId]);

  if (process.env.EXPO_PUBLIC_PIXEL_LOCK === "1") {
    return <Redirect href="/pixel-lock?screen=HOME-001" />;
  }

  if (!hydrated) {
    return null;
  }

  if (!accessToken && !isTestSession) {
    return <Redirect href="/launch-animation" />;
  }

  if (!isTestSession && !hasReachedHome) {
    if (progressFetch === "loading") {
      return null;
    }
    if (progressFetch === "done" && hasResumeTarget) {
      return <Redirect href="/onboarding/resume" />;
    }
  }

  return <Redirect href={hasReachedHome ? "/(tabs)" : "/onboarding/child-status"} />;
}
