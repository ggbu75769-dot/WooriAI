import type { Href } from "expo-router";
import type { OnboardingNextStep } from "../api/client";

/**
 * MOB-101 (round5a-sprint1-plan.md §4): maps the server's onboarding `nextStep` to the route a
 * resuming session should land on. "consents" and "child-profile" both resolve to ONB-001
 * (child-status) -- neither has created a child yet, so restarting the flow from the top is
 * always safe there. "prepared-items" and "budget" jump straight past the screens that already
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
    case "child-profile":
    default:
      return "/onboarding/child-status";
  }
}
