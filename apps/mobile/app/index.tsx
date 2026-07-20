import { Redirect } from "expo-router";
import { useEffect, useState } from "react";
import { getOnboardingProgress } from "../src/api/client";
import { LOCAL_HOUSEHOLD_ID, LOCAL_USER_ID } from "../src/api/fixture-identifiers";
import { routeForDraftCurrentStep } from "../src/onboarding/resume";
import { useOnboardingDraftStore } from "../src/stores/onboarding-draft.store";
import { useOnboardingProgressStore } from "../src/stores/onboarding-progress.store";
import { useOnboardingResumeStore } from "../src/stores/onboarding-resume.store";
import { selectedChildScopeKey, useSelectedChildStore } from "../src/stores/selected-child.store";
import { useSessionStore } from "../src/stores/session.store";
import { AppScreen } from "../src/design-system/components/ApplicationPrimitives";
import { LoadingState } from "../src/design-system/patterns/AsyncState";

declare const __DEV__: boolean;

/**
 * The session store rehydrates from SecureStore (and the onboarding-progress/selected-child
 * stores from AsyncStorage) asynchronously. Redirecting before all three finish would always see
 * a null accessToken/selectedChildId on a cold start and either dump a logged-in user back onto
 * the landing screen or (MOB-107) send a test session to /(tabs) with no selectedChildId yet --
 * every screen's `Boolean(authToken && childId)` query gate would then race the same hydration,
 * so the index route must hold rendering until all three finish.
 */
function navigationStoresHydrated() {
  return (
    useSessionStore.persist.hasHydrated() &&
    useOnboardingProgressStore.persist.hasHydrated() &&
    useSelectedChildStore.persist.hasHydrated()
  );
}

function onboardingDraftHydrated() {
  return useOnboardingDraftStore.persist.hasHydrated();
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
  const userId = useSessionStore((state) => state.userId);
  const householdId = useSessionStore((state) => state.defaultHouseholdId);
  const draft = useOnboardingDraftStore((state) => state.draft);
  const hasReachedHome = useOnboardingProgressStore((state) => state.hasReachedHome);
  const markHomeReached = useOnboardingProgressStore((state) => state.markHomeReached);
  const setResumeProgress = useOnboardingResumeStore((state) => state.setProgress);
  const setSelectedChildId = useSelectedChildStore((state) => state.setSelectedChildId);
  const [hydrated, setHydrated] = useState(navigationStoresHydrated);
  const [draftHydrated, setDraftHydrated] = useState(onboardingDraftHydrated);
  const [progressFetch, setProgressFetch] = useState<ProgressFetchState>("idle");
  const [hasResumeTarget, setHasResumeTarget] = useState(false);

  useEffect(() => {
    if (hydrated) {
      return;
    }
    const unsubscribes = [
      useSessionStore.persist.onFinishHydration(() => setHydrated(navigationStoresHydrated())),
      useOnboardingProgressStore.persist.onFinishHydration(() => setHydrated(navigationStoresHydrated())),
      useSelectedChildStore.persist.onFinishHydration(() => setHydrated(navigationStoresHydrated()))
    ];
    // Never interpret a slow store as an empty store: doing so can route a valid persisted
    // session to onboarding or launch before its identity/scope arrives. Rejected/corrupt reads
    // already resolve through the resilient adapters, so a timeout should retry only and keep
    // the loading surface visible until all routing inputs have a settled value.
    const retry = setTimeout(() => {
      if (!navigationStoresHydrated()) {
        void useSessionStore.persist.rehydrate();
        void useOnboardingProgressStore.persist.rehydrate();
        void useSelectedChildStore.persist.rehydrate();
      }
    }, 3000);
    // Hydration may have finished between the initial render and effect registration.
    setHydrated(navigationStoresHydrated());
    return () => {
      clearTimeout(retry);
      for (const unsubscribe of unsubscribes) {
        unsubscribe();
      }
    };
  }, [hydrated]);

  useEffect(() => {
    if (draftHydrated) return;
    const unsubscribe = useOnboardingDraftStore.persist.onFinishHydration(() => {
      setDraftHydrated(onboardingDraftHydrated());
    });
    const retry = setTimeout(() => {
      if (!onboardingDraftHydrated()) void useOnboardingDraftStore.persist.rehydrate();
    }, 3000);
    setDraftHydrated(onboardingDraftHydrated());
    return () => {
      clearTimeout(retry);
      unsubscribe();
    };
  }, [draftHydrated]);

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

  useEffect(() => {
    if (!hydrated || !draftHydrated) return;
    const scopedUserId = userId ?? (isTestSession ? LOCAL_USER_ID : null);
    const scopedHouseholdId = householdId ?? (isTestSession ? LOCAL_HOUSEHOLD_ID : null);
    if (scopedUserId && scopedHouseholdId) {
      useOnboardingDraftStore.getState().activateScope(scopedUserId, scopedHouseholdId);
      useSelectedChildStore.getState().activateScope(selectedChildScopeKey(scopedUserId, scopedHouseholdId));
    }
  }, [draftHydrated, householdId, hydrated, isTestSession, userId]);

  if (!hydrated) {
    return (
      <AppScreen>
        <LoadingState
          description="저장된 세션과 아이 정보를 확인하고 있어요."
          title="시작 화면을 준비하고 있어요"
        />
      </AppScreen>
    );
  }

  if (!accessToken && !isTestSession) {
    return <Redirect href="/launch-animation" />;
  }

  if (hasReachedHome) {
    return <Redirect href="/(tabs)" />;
  }

  if (!isTestSession && !hasReachedHome) {
    if (progressFetch === "loading") {
      return (
        <AppScreen>
          <LoadingState
            description="마지막으로 진행한 온보딩 단계를 확인하고 있어요."
            title="시작 화면을 준비하고 있어요"
          />
        </AppScreen>
      );
    }
    if (progressFetch === "done" && hasResumeTarget) {
      return <Redirect href="/onboarding/resume" />;
    }
  }

  if (!draftHydrated) {
    return (
      <AppScreen>
        <LoadingState
          description="저장된 온보딩 정보를 안전하게 불러오고 있어요."
          title="시작 화면을 준비하고 있어요."
        />
      </AppScreen>
    );
  }

  return (
    <Redirect
      href={routeForDraftCurrentStep(draft?.currentStep ?? "child-status")}
    />
  );
}
