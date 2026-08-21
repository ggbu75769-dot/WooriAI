import { Redirect } from "expo-router";
import { useEffect, useState } from "react";
import { Platform, Text, View } from "react-native";
import { trackAndFlushAnalyticsEvent } from "../src/analytics/client";
import { getOnboardingProgress } from "../src/api/client";
import { ensureLocalBackendSeeded } from "../src/api/local-backend";
import { LOCAL_CHILD_ID } from "../src/api/local-fixtures";
import {
  shouldAttemptSelectedChildRecovery,
  useSelectedChildRecovery
} from "../src/onboarding/selected-child-recovery";
import { useOnboardingProgressStore } from "../src/stores/onboarding-progress.store";
import { useOnboardingResumeStore } from "../src/stores/onboarding-resume.store";
import { useSelectedChildStore } from "../src/stores/selected-child.store";
import { useSessionStore } from "../src/stores/session.store";
import { theme } from "../src/theme";
import { AppScreen, Card, SecondaryButton } from "../src/ui";

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

/**
 * ANA-103: app_opened fires at most once per cold start (module-level flag, reset only when the
 * JS bundle reloads) -- re-renders and re-navigations through "/" within one launch never fire
 * it again. Only fired once hydration finished and a real (token-holding) session exists, so a
 * logged-out landing-screen visit or the loginless test session never emits it. A no-op unless
 * the ANA-102 consent toggle (app/settings/index.tsx) is ON -- see src/analytics/flag.ts.
 */
let hasTrackedAppOpenedThisLaunch = false;

export default function IndexScreen() {
  const accessToken = useSessionStore((state) => state.accessToken);
  const isTestSession = useSessionStore((state) => state.isTestSession);
  const hasReachedHome = useOnboardingProgressStore((state) => state.hasReachedHome);
  const markHomeReached = useOnboardingProgressStore((state) => state.markHomeReached);
  const resetOnboarding = useOnboardingProgressStore((state) => state.resetOnboarding);
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
    if (!hydrated || !accessToken || hasTrackedAppOpenedThisLaunch) {
      return;
    }
    hasTrackedAppOpenedThisLaunch = true;
    trackAndFlushAnalyticsEvent(accessToken, {
      eventName: "app_opened",
      payload: {},
      platform: Platform.OS === "ios" || Platform.OS === "android" ? Platform.OS : undefined
    });
  }, [hydrated, accessToken]);

  useEffect(() => {
    if (!hydrated || isTestSession || !accessToken || hasReachedHome || progressFetch !== "idle") {
      return;
    }
    setProgressFetch("loading");
    getOnboardingProgress(accessToken)
      .then((progress) => {
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
  }, [hydrated, isTestSession, accessToken, hasReachedHome, progressFetch, markHomeReached, setResumeProgress]);

  // Safety valve for the server progress check itself, mirroring the hydration fallback above:
  // getOnboardingProgress rejects on HTTP errors but a hung request (no response, no network
  // error surfaced) would leave progressFetch at "loading" -- which renders null -- forever.
  // After the same 3s grace period we proceed as if the check found nothing (progressFetch
  // "done" with no resume target), which routes to onboarding/tabs via the default redirect
  // below; a late response is harmless since every store update it makes is idempotent.
  useEffect(() => {
    if (progressFetch !== "loading") {
      return;
    }
    const fallback = setTimeout(() => setProgressFetch("done"), 3000);
    return () => clearTimeout(fallback);
  }, [progressFetch]);

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

  /**
   * MOB-116: same lost-selectedChildId hole for a REAL session. hasReachedHome lives in a
   * separate persisted store, so a missing/corrupt `wooriai-selected-child` blob leaves
   * hasReachedHome=true while selectedChildId is null -- the /(tabs) redirect below would then
   * pin every screen's `Boolean(authToken && childId)` gate false forever (logged-out preview
   * data, unrecoverable short of reinstalling). There is no fixture id to fall back to here, so
   * the hook re-derives the child from GET /onboarding/status (the ONB-006 resume precedent);
   * an account with no server-side child instead resets local onboarding progress so the
   * ordinary MOB-101 flow routes back through onboarding. See
   * src/onboarding/selected-child-recovery.ts.
   */
  const childRecoveryInput = { hydrated, isTestSession, accessToken, hasReachedHome, selectedChildId };
  const childRecovery = useSelectedChildRecovery(childRecoveryInput, { setSelectedChildId, resetOnboarding });

  if (process.env.EXPO_PUBLIC_PIXEL_LOCK === "1") {
    return <Redirect href="/pixel-lock?screen=HOME-001" />;
  }

  if (!hydrated) {
    return null;
  }

  if (!accessToken && !isTestSession) {
    return <Redirect href="/launch-animation" />;
  }

  // MOB-116: while the real-session child recovery above is still needed, hold the /(tabs)
  // redirect. Both success outcomes flip this condition off by themselves (recovered sets
  // selectedChildId; no-child clears hasReachedHome), so only the in-flight and error states
  // ever render here -- and the hook's internal timeout valve guarantees the in-flight null
  // cannot outlive the grace period, so no infinite spinner/blank is possible.
  if (shouldAttemptSelectedChildRecovery(childRecoveryInput)) {
    if (childRecovery.status === "error") {
      return (
        <AppScreen>
          <View testID="screen-child-recovery-error" style={{ gap: theme.spacing.section }}>
            <Card style={{ gap: 10 }}>
              <Text style={{ color: theme.colors.danger }}>
                아이 정보를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.
              </Text>
              <SecondaryButton label="다시 시도" onPress={childRecovery.retry} />
            </Card>
          </View>
        </AppScreen>
      );
    }
    return null;
  }

  if (!isTestSession && !hasReachedHome) {
    if (progressFetch === "loading") {
      return null;
    }
    if (progressFetch === "done" && hasResumeTarget) {
      return <Redirect href="/onboarding/resume" />;
    }
  }

  return <Redirect href={hasReachedHome || isTestSession ? "/(tabs)" : "/onboarding/child-status"} />;
}
