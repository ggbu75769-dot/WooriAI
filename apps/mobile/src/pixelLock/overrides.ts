import generatedOverrides from "./generated-overrides.json";

type PixelLockOverrideMap = Record<string, Record<string, number>>;

declare const __DEV__: boolean;

const pixelLockStyleOverridesEnabled = __DEV__ || process.env.EXPO_PUBLIC_PIXEL_LOCK === "1";

function runtimeOverrides() {
  const globalWithOverrides = globalThis as typeof globalThis & {
    __WOORIAI_PIXEL_LOCK_OVERRIDES__?: PixelLockOverrideMap;
  };
  return globalWithOverrides.__WOORIAI_PIXEL_LOCK_OVERRIDES__ ?? {};
}

export function pixelNumber(screenId: string, key: string, fallback: number) {
  if (!pixelLockStyleOverridesEnabled) return fallback;
  const generated = generatedOverrides as PixelLockOverrideMap;
  const override = runtimeOverrides()[screenId]?.[key] ?? generated[screenId]?.[key];
  return Number.isFinite(override) ? override : fallback;
}
