import { router } from "expo-router";
import { upsertConsents, type ConsentSelection, type OAuthLoginResult } from "../api/client";
import { useOnboardingProgressStore } from "../stores/onboarding-progress.store";
import { useSessionStore } from "../stores/session.store";

export async function completeOAuthLogin(
  result: OAuthLoginResult,
  consents?: ConsentSelection[]
): Promise<void> {
  useOnboardingProgressStore.getState().resetOnboarding();
  useSessionStore.getState().setSession({
    accessToken: result.tokens.accessToken,
    refreshToken: result.tokens.refreshToken,
    userId: result.user.id,
    displayName: result.user.displayName,
    email: result.user.email,
    authProvider: "kakao",
    defaultHouseholdId: result.user.households?.[0]?.id ?? null
  });
  if (consents) {
    await upsertConsents(result.tokens.accessToken, consents);
    router.replace("/");
    return;
  }
  router.replace("/login");
}
