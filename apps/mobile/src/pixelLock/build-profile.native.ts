import Constants from "expo-constants";

declare const __DEV__: boolean;

type WooriAiEmbeddedExtra = {
  wooriaiBuildProfile?: string;
  wooriaiPixelLockEnabled?: boolean;
  wooriaiTestLoginEnabled?: boolean;
};

function embeddedExtra() {
  return (Constants.expoConfig?.extra ?? {}) as WooriAiEmbeddedExtra;
}

/**
 * Release behavior comes from app.config embedded in the APK, not only from Metro-transformed
 * process.env values. Development keeps an explicit env fallback for Metro-driven tuning.
 */
export function isPixelLockBuild() {
  const embedded = embeddedExtra().wooriaiPixelLockEnabled;
  if (typeof embedded === "boolean") return embedded;
  return __DEV__ && process.env.EXPO_PUBLIC_PIXEL_LOCK === "1";
}

export function isTestLoginBuild() {
  const embedded = embeddedExtra().wooriaiTestLoginEnabled;
  if (typeof embedded === "boolean") return embedded;
  return __DEV__ && process.env.EXPO_PUBLIC_TEST_LOGIN === "1";
}

export function embeddedBuildProfile() {
  return embeddedExtra().wooriaiBuildProfile ?? "unknown";
}

