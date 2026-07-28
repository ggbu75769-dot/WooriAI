import { useEffect, useState } from "react";
import { Redirect, Slot } from "expo-router";
import { LOCAL_HOUSEHOLD_ID, LOCAL_USER_ID } from "../../src/api/fixture-runtime";
import { AppScreen, LoadingState } from "../../src/design-system";
import { useOnboardingDraftStore } from "../../src/stores/onboarding-draft.store";
import { useSessionStore } from "../../src/stores/session.store";

function isDraftHydrated() {
  return useOnboardingDraftStore.persist.hasHydrated();
}

export default function OnboardingLayout() {
  const accessToken = useSessionStore((state) => state.accessToken);
  const defaultHouseholdId = useSessionStore((state) => state.defaultHouseholdId);
  const isTestSession = useSessionStore((state) => state.isTestSession);
  const userId = useSessionStore((state) => state.userId);
  const draft = useOnboardingDraftStore((state) => state.draft);
  const activateScope = useOnboardingDraftStore((state) => state.activateScope);
  const [hydrated, setHydrated] = useState(isDraftHydrated);

  const scopedUserId = userId ?? (isTestSession ? LOCAL_USER_ID : null);
  const scopedHouseholdId = defaultHouseholdId ?? (isTestSession ? LOCAL_HOUSEHOLD_ID : null);
  const authenticated = Boolean(accessToken || isTestSession);
  const scopeReady = Boolean(
    scopedUserId &&
    scopedHouseholdId &&
    draft?.userId === scopedUserId &&
    draft.householdId === scopedHouseholdId
  );

  useEffect(() => {
    if (hydrated) return;
    const unsubscribe = useOnboardingDraftStore.persist.onFinishHydration(() => setHydrated(true));
    setHydrated(isDraftHydrated());
    return unsubscribe;
  }, [hydrated]);

  useEffect(() => {
    if (!hydrated || !scopedUserId || !scopedHouseholdId || scopeReady) return;
    activateScope(scopedUserId, scopedHouseholdId);
  }, [activateScope, hydrated, scopeReady, scopedHouseholdId, scopedUserId]);

  if (!authenticated || !scopedUserId || !scopedHouseholdId) return <Redirect href="/login" />;
  if (!hydrated || !scopeReady) {
    return (
      <AppScreen>
        <LoadingState description="저장된 입력을 안전하게 확인하고 있어요." title="온보딩을 준비하고 있어요" />
      </AppScreen>
    );
  }
  return <Slot />;
}
