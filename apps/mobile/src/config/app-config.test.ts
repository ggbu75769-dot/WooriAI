import { describe, expect, it, vi } from "vitest";
import { fetchAppConfig, SAFE_APP_CONFIG } from "./app-config";

function memoryStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: vi.fn(async (key: string) => values.get(key) ?? null),
    setItem: vi.fn(async (key: string, value: string) => { values.set(key, value); })
  };
}

describe("mobile app config", () => {
  it("stores a valid network response and ignores unknown future flags", async () => {
    const storage = memoryStorage();
    const response = { ...SAFE_APP_CONFIG, latestVersion: "3.0.0", futureField: true };
    const fetcher = vi.fn(async () => new Response(JSON.stringify(response), {
      status: 200,
      headers: { "content-type": "application/json", etag: '"v2"' }
    }));
    const result = await fetchAppConfig(storage, fetcher as typeof fetch);
    expect(result).toMatchObject({ source: "network", config: { latestVersion: "3.0.0" } });
    expect(result.config).not.toHaveProperty("futureField");
  });

  it("uses last-known-good core settings but closes every risky flag on fetch failure", async () => {
    const cached = {
      ...SAFE_APP_CONFIG,
      readOnlyMode: true,
      authProviders: ["kakao"],
      featureFlags: { analytics: true, affiliate: true, import: true, notification: true },
      analyticsEnabled: true,
      affiliateEnabled: true,
      importEnabled: true,
      notificationEnabled: true
    };
    const storage = memoryStorage({ "wooriai.app-config.v1": JSON.stringify(cached) });
    const result = await fetchAppConfig(storage, vi.fn(async () => { throw new Error("offline"); }) as typeof fetch);
    expect(result.source).toBe("cache_fail_closed");
    expect(result.config.readOnlyMode).toBe(true);
    expect(result.config.authProviders).toEqual([]);
    expect(Object.values(result.config.featureFlags)).toEqual([false, false, false, false]);
  });
});
