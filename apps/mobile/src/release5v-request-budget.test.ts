import { afterEach, describe, expect, it, vi } from "vitest";
import { completeOnboarding, previewOnboardingStarterItems } from "./api/client";
import { createSingleFlightGuard } from "./onboarding/single-flight";
import { invalidateOnboardingCompletionQueries } from "./query/onboarding-invalidation";
import { childScopedRequestEnabled } from "./query/child-scope";

afterEach(() => vi.unstubAllGlobals());

describe("Release 5V onboarding request budget", () => {
  it("issues one starter request and one final mutation with the idempotency header", async () => {
    const requests: Array<{ url: string; init: RequestInit }> = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit) => {
      requests.push({ url, init });
      const body = url.endsWith("/complete")
        ? {
            child: {
              id: "child-1",
              nickname: "봄이",
              stageMode: "born",
              dueDate: null,
              birthDate: "2025-05-01",
              manualStage: null,
              gender: "unknown",
              profileImageUrl: null,
              currentStage: "infant_7_12",
              stageLabel: "영아 7~12개월"
            },
            prepared: { state: "skipped", appliedCount: 0 },
            budget: null,
            onboardingCompleted: true
          }
        : { availability: "external_blocked", blockerCode: "EXTERNAL_BLOCKED_ONBOARDING_CATALOG", eligibleCount: 0, items: [], rankingPolicy: "published-only" };
      return new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });
    }));

    await previewOnboardingStarterItems("real-token", { stageMode: "born", birthDate: "2025-05-01" });
    await completeOnboarding("real-token", {
      householdId: "11111111-1111-4111-8111-111111111111",
      draftVersion: 2,
      child: { nickname: "봄이", stageMode: "born", birthDate: "2025-05-01", stageOverride: false, gender: "unknown" },
      prepared: { state: "skipped", itemDefinitionIds: [] },
      budget: null
    }, "onboarding-idempotency-1");

    expect(requests.map((request) => new URL(request.url).pathname)).toEqual([
      "/api/v1/onboarding/starter-items/preview",
      "/api/v1/onboarding/complete"
    ]);
    expect((requests[1]!.init.headers as Record<string, string>)["Idempotency-Key"]).toBe("onboarding-idempotency-1");
  });

  it("allows only one duplicate-tap side effect across 30 explicit barriers", () => {
    for (let repeat = 0; repeat < 30; repeat += 1) {
      const guard = createSingleFlightGuard();
      let effects = 0;
      if (guard.tryStart()) effects += 1;
      if (guard.tryStart()) effects += 1;
      expect(effects).toBe(1);
      guard.finish();
      expect(guard.tryStart()).toBe(true);
    }
  });

  it("keeps no-child requests at zero and invalidates only six child-related keys", async () => {
    for (let repeat = 0; repeat < 30; repeat += 1) {
      expect(childScopedRequestEnabled(`token-${repeat}`, null)).toBe(false);
    }
    const keys: unknown[][] = [];
    await invalidateOnboardingCompletionQueries({
      invalidateQueries: async ({ queryKey }) => { keys.push([...queryKey]); }
    }, "child-1");
    expect(keys).toEqual([
      ["children"],
      ["home", "child-1"],
      ["catalog-v2", "preparation-context", "child:child-1"],
      ["catalog-v2", "timeline", "child:child-1"],
      ["budget", "child-1"],
      ["reports", "child-1"]
    ]);
  });
});
