import generatedOverrides from "./generated-overrides.json";
import { isPixelLockBuild } from "./build-profile";

type PixelLockOverrideMap = Record<string, Record<string, number>>;

function runtimeOverrides() {
  const globalWithOverrides = globalThis as typeof globalThis & {
    __WOORIAI_PIXEL_LOCK_OVERRIDES__?: PixelLockOverrideMap;
  };
  return globalWithOverrides.__WOORIAI_PIXEL_LOCK_OVERRIDES__ ?? {};
}

export function pixelNumber(screenId: string, key: string, fallback: number) {
  if (!isPixelLockBuild()) return fallback;
  const generated = generatedOverrides as PixelLockOverrideMap;
  const override = runtimeOverrides()[screenId]?.[key] ?? generated[screenId]?.[key];
  return Number.isFinite(override) ? override : fallback;
}
