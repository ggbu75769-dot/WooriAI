import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  __resetAnalyticsClientForTests,
  bucketSyncLatencyMs,
  flushAnalyticsQueue,
  getQueuedAnalyticsEventCount,
  trackAnalyticsEvent,
  trackAndFlushAnalyticsEvent
} from "./client";
import { useAnalyticsConsentStore } from "./flag";

describe("bucketSyncLatencyMs", () => {
  it("buckets durations into the same enum literals as the expense_synced contract", () => {
    expect(bucketSyncLatencyMs(0)).toBe("lt1s");
    expect(bucketSyncLatencyMs(999)).toBe("lt1s");
    expect(bucketSyncLatencyMs(1_000)).toBe("1s_5s");
    expect(bucketSyncLatencyMs(4_999)).toBe("1s_5s");
    expect(bucketSyncLatencyMs(5_000)).toBe("5s_30s");
    expect(bucketSyncLatencyMs(29_999)).toBe("5s_30s");
    expect(bucketSyncLatencyMs(30_000)).toBe("30s_2m");
    expect(bucketSyncLatencyMs(119_999)).toBe("30s_2m");
    expect(bucketSyncLatencyMs(120_000)).toBe("gte2m");
    expect(bucketSyncLatencyMs(999_999)).toBe("gte2m");
  });
});

/**
 * ANA-101 (round5a-sprint2-plan.md §5): "opt-in 플래그(기본 OFF) — ANA-102(동의)
 * 전까지 실전송 없음". This is the test that pins that guarantee: while the
 * consent flag is OFF (its default), trackAnalyticsEvent must not even queue
 * an event, and no fetch call can ever be made -- there is nothing sitting
 * around that a later flush could accidentally send.
 */
describe("mobile analytics client (opt-in, default OFF)", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    useAnalyticsConsentStore.setState({ enabled: false });
    __resetAnalyticsClientForTests();
    fetchMock = vi.fn(async () => new Response(JSON.stringify({ accepted: 1, rejected: [] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("defaults to disabled", () => {
    expect(useAnalyticsConsentStore.getState().enabled).toBe(false);
  });

  it("does not queue an event while disabled", () => {
    trackAnalyticsEvent({ eventName: "app_opened", payload: {} });
    expect(getQueuedAnalyticsEventCount()).toBe(0);
  });

  it("never calls fetch while disabled, even via the track-and-flush convenience helper", async () => {
    trackAndFlushAnalyticsEvent("some-token", { eventName: "app_opened", payload: {} });
    // trackAndFlushAnalyticsEvent fires the flush without awaiting it internally;
    // give any (incorrectly scheduled) microtask a chance to run before asserting.
    await Promise.resolve();
    await Promise.resolve();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(getQueuedAnalyticsEventCount()).toBe(0);
  });

  it("flushAnalyticsQueue is a no-op while disabled even if events were somehow queued earlier", async () => {
    useAnalyticsConsentStore.setState({ enabled: true });
    trackAnalyticsEvent({ eventName: "app_opened", payload: {} });
    expect(getQueuedAnalyticsEventCount()).toBe(1);

    useAnalyticsConsentStore.setState({ enabled: false });
    await flushAnalyticsQueue("some-token");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  describe("once opted in", () => {
    beforeEach(() => {
      useAnalyticsConsentStore.setState({ enabled: true });
    });

    it("queues a well-formed envelope with a real v4 uuid eventId", () => {
      trackAnalyticsEvent({ eventName: "onboarding_completed", payload: { stepCount: 4 }, platform: "ios" });
      expect(getQueuedAnalyticsEventCount()).toBe(1);
    });

    it("sends a queued batch to POST /analytics/events and clears the queue on success", async () => {
      trackAnalyticsEvent({ eventName: "app_opened", payload: {} });
      trackAnalyticsEvent({ eventName: "onboarding_completed", payload: { stepCount: 4 } });
      expect(getQueuedAnalyticsEventCount()).toBe(2);

      await flushAnalyticsQueue("test-token");

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toMatch(/\/analytics\/events$/);
      expect(init.method).toBe("POST");
      expect((init.headers as Record<string, string>).Authorization).toBe("Bearer test-token");

      const body = JSON.parse(init.body as string) as { events: unknown[] };
      expect(body.events).toHaveLength(2);
      expect(getQueuedAnalyticsEventCount()).toBe(0);
    });

    it("does nothing when there is no token to authenticate with", async () => {
      trackAnalyticsEvent({ eventName: "app_opened", payload: {} });
      await flushAnalyticsQueue(null);
      expect(fetchMock).not.toHaveBeenCalled();
      expect(getQueuedAnalyticsEventCount()).toBe(1);
    });

    it("sends at most 50 events per batch, leaving the rest queued", async () => {
      for (let i = 0; i < 55; i += 1) {
        trackAnalyticsEvent({ eventName: "app_opened", payload: {} });
      }
      expect(getQueuedAnalyticsEventCount()).toBe(55);

      await flushAnalyticsQueue("test-token");

      const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      const body = JSON.parse(init.body as string) as { events: unknown[] };
      expect(body.events).toHaveLength(50);
      expect(getQueuedAnalyticsEventCount()).toBe(5);
    });

    it("requeues the batch (at the front) on a non-2xx response instead of dropping it", async () => {
      fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ error: {} }), { status: 500 }));
      trackAnalyticsEvent({ eventName: "app_opened", payload: {} });

      await flushAnalyticsQueue("test-token");

      expect(getQueuedAnalyticsEventCount()).toBe(1);
    });

    it("requeues the batch on a network error instead of throwing", async () => {
      fetchMock.mockRejectedValueOnce(new Error("network down"));
      trackAnalyticsEvent({ eventName: "app_opened", payload: {} });

      await expect(flushAnalyticsQueue("test-token")).resolves.toBeUndefined();
      expect(getQueuedAnalyticsEventCount()).toBe(1);
    });

    it("caps the in-memory queue so a long-offline device doesn't grow it unbounded", () => {
      for (let i = 0; i < 260; i += 1) {
        trackAnalyticsEvent({ eventName: "app_opened", payload: {} });
      }
      expect(getQueuedAnalyticsEventCount()).toBeLessThanOrEqual(200);
    });
  });
});
