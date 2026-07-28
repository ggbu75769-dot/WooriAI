import { Redirect } from "expo-router";
import { useOnboardingDraftStore } from "../../src/stores/onboarding-draft.store";

// ONB-002 is a route-only dispatcher. The three active V2 forms live in
// src/onboarding/PathFormScreens.tsx so this alias cannot submit a legacy child early.
export default function ChildProfileRoute() {
  const path = useOnboardingDraftStore((state) => state.draft?.selectedPath ?? null);
  if (path === "pregnant") return <Redirect href={"/onboarding/pregnant" as never} />;
  if (path === "born") return <Redirect href={"/onboarding/born" as never} />;
  if (path === "manual") return <Redirect href={"/onboarding/direct-stage" as never} />;
  return <Redirect href="/onboarding/child-status" />;
}
