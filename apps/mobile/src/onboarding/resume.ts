import type { Href } from "expo-router";
import type { ChildStageMode, OnboardingDraft } from "@wooriai/domain";
import type { OnboardingNextStep } from "../api/client";

/**
 * MOB-101 (round5a-sprint1-plan.md §4): maps the server's onboarding `nextStep` to the route a
 * resuming session should land on. "consents" returns to the authenticated legal-consent
 * boundary so the current document can be opened and explicitly accepted; "child-profile"
 * resolves to ONB-001. "prepared-items" and "budget" jump straight past the screens that already
 * succeeded (skipping ONB-001/ONB-002 entirely) instead of re-running child creation, which is
 * what used to produce a duplicate child on every app restart before this fix.
 */
export function routeForOnboardingNextStep(nextStep: OnboardingNextStep): Href {
  switch (nextStep) {
    case "prepared-items":
      return "/onboarding/prepared-items";
    case "budget":
      return "/onboarding/budget";
    case "home":
      return "/(tabs)";
    case "consents":
      return "/login";
    case "child-profile":
    default:
      return "/onboarding/child-status";
  }
}

export function routeForDraftCurrentStep(currentStep: OnboardingDraft["currentStep"]): Href {
  switch (currentStep) {
    case "pregnant":
      return "/onboarding/pregnant" as Href;
    case "born":
      return "/onboarding/born" as Href;
    case "direct-stage":
      return "/onboarding/direct-stage" as Href;
    case "prepared-items":
      return "/onboarding/prepared-items" as Href;
    case "budget":
      return "/onboarding/budget" as Href;
    case "review":
      return "/onboarding/review" as Href;
    case "child-status":
    default:
      return "/onboarding/child-status" as Href;
  }
}

export function routeForOnboardingPath(path: ChildStageMode): Href {
  switch (path) {
    case "pregnant":
      return "/onboarding/pregnant" as Href;
    case "born":
      return "/onboarding/born" as Href;
    case "manual":
      return "/onboarding/direct-stage" as Href;
  }
}
