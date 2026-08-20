// Type surface for expo-config.shared.js (plain CJS shared by apps/mobile/app.config.js
// and the monorepo-root app.config.js) so TypeScript consumers -- currently only
// src/expo-config.test.ts -- typecheck without enabling checkJs.
export interface WooriaiAndroidConfig {
  package?: string;
  versionCode?: number;
  [key: string]: unknown;
}

export interface WooriaiExpoConfig {
  version?: string;
  android?: WooriaiAndroidConfig;
  plugins?: unknown[];
  [key: string]: unknown;
}

export function applyWooriaiConfig(
  baseExpo: WooriaiExpoConfig
): WooriaiExpoConfig & { android: WooriaiAndroidConfig };
