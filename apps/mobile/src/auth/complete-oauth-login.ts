import { router } from "expo-router";
import { upsertConsents, type OAuthLoginResult } from "../api/client";
import { useOnboardingProgressStore } from "../stores/onboarding-progress.store";
import { useSessionStore } from "../stores/session.store";

export async function completeOAuthLogin(result: OAuthLoginResult): Promise<void> {
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
  await upsertConsents(result.tokens.accessToken);
  router.replace("/");
}
