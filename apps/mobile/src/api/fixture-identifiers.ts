import { isPixelLockBuild, isTestLoginBuild } from "../pixelLock/build-profile";

// Startup-safe fixture identity. Keep this module free of fixture data and backend imports so
// session hydration can select a scope before the local backend is evaluated.
export const LOCAL_CHILD_ID = "local-child-qualification";
export const LOCAL_HOUSEHOLD_ID = "local-household-qualification";
export const LOCAL_MOTHER_PROFILE_ID = "local-mother-profile";
export const LOCAL_USER_ID = "local-user-self";
export const LOCAL_DAD_USER_ID = "local-user-dad";

export const fixtureSessionToken = "wooriai-local-session";
export const fixtureRuntimeEnabled =
  isTestLoginBuild() ||
  isPixelLockBuild() ||
  process.env.NODE_ENV === "test";

export function pixelEvidenceId(screenIds: string): string {
  return `pixel-screen-${screenIds}`;
}
