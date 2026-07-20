/**
 * Node/web fallback. React Native resolves build-profile.native.ts first; tests retain explicit
 * environment control without loading React Native's Flow entry through Vite.
 */
export function isPixelLockBuild() {
  return process.env.EXPO_PUBLIC_PIXEL_LOCK === "1";
}

export function isTestLoginBuild() {
  return process.env.EXPO_PUBLIC_TEST_LOGIN === "1";
}

export function embeddedBuildProfile() {
  return process.env.WOORIAI_BUILD_PROFILE ?? "unknown";
}
