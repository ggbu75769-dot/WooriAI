import AsyncStorage from "@react-native-async-storage/async-storage";
import { appConfigSchema, type AppConfig } from "@wooriai/contracts";

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? "http://localhost:3000/api/v1";
const CONFIG_KEY = "wooriai.app-config.v1";
const ETAG_KEY = "wooriai.app-config.etag.v1";

export type { AppConfig };
type Storage = { getItem(key: string): Promise<string | null>; setItem(key: string, value: string): Promise<void> };
type Fetcher = typeof fetch;

export const SAFE_APP_CONFIG: AppConfig = {
  minimumSupportedVersion: "0.0.0",
  latestVersion: "0.0.0",
  maintenanceMode: false,
  readOnlyMode: false,
  emergencyMessage: null,
  authProviders: [],
  featureFlags: { analytics: false, affiliate: false, import: false, notification: false },
  policyVersions: {},
  analyticsEnabled: false,
  affiliateEnabled: false,
  importEnabled: false,
  notificationEnabled: false,
  priceMaxAgeDays: null,
  configVersion: 1,
  updatedAt: new Date(0).toISOString()
};

function failClosed(config: AppConfig): AppConfig {
  return {
    ...config,
    authProviders: [],
    featureFlags: { analytics: false, affiliate: false, import: false, notification: false },
    analyticsEnabled: false,
    affiliateEnabled: false,
    importEnabled: false,
    notificationEnabled: false
  };
}

async function readCached(storage: Storage): Promise<AppConfig | null> {
  const raw = await storage.getItem(CONFIG_KEY);
  if (!raw) return null;
  try {
    const parsed = appConfigSchema.strip().safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export async function fetchAppConfig(
  storage: Storage = AsyncStorage,
  fetcher: Fetcher = fetch
): Promise<{ config: AppConfig; source: "network" | "cache_fail_closed" | "safe_fallback" }> {
  const [cached, etag] = await Promise.all([readCached(storage), storage.getItem(ETAG_KEY)]);
  try {
    const response = await fetcher(`${API_BASE_URL}/app-config`, {
      headers: etag ? { "If-None-Match": etag } : undefined
    });
    if (response.status === 304 && cached) return { config: cached, source: "network" };
    if (!response.ok) throw new Error("APP_CONFIG_FETCH_FAILED");
    const parsed = appConfigSchema.strip().safeParse(await response.json());
    if (!parsed.success) throw new Error("APP_CONFIG_INVALID");
    await Promise.all([
      storage.setItem(CONFIG_KEY, JSON.stringify(parsed.data)),
      response.headers.get("etag") ? storage.setItem(ETAG_KEY, response.headers.get("etag")!) : Promise.resolve()
    ]);
    return { config: parsed.data, source: "network" };
  } catch {
    if (cached) return { config: failClosed(cached), source: "cache_fail_closed" };
    return { config: SAFE_APP_CONFIG, source: "safe_fallback" };
  }
}
