import { describe, expect, it } from "vitest";
import { BASE_DELAY_MS, MAX_DELAY_MS, computeBackoffDelayMs, computeNextRetryAtIso } from "./backoff";

describe("offline outbox backoff", () => {
  it("doubles the delay on each successive attempt", () => {
    expect(computeBackoffDelayMs(1)).toBe(BASE_DELAY_MS);
    expect(computeBackoffDelayMs(2)).toBe(BASE_DELAY_MS * 2);
    expect(computeBackoffDelayMs(3)).toBe(BASE_DELAY_MS * 4);
    expect(computeBackoffDelayMs(4)).toBe(BASE_DELAY_MS * 8);
  });

  it("caps the delay at MAX_DELAY_MS instead of growing unbounded", () => {
    expect(computeBackoffDelayMs(20)).toBe(MAX_DELAY_MS);
    expect(computeBackoffDelayMs(100)).toBe(MAX_DELAY_MS);
  });

  it("treats a zero/negative attempt count the same as the first attempt", () => {
    expect(computeBackoffDelayMs(0)).toBe(BASE_DELAY_MS);
    expect(computeBackoffDelayMs(-5)).toBe(BASE_DELAY_MS);
  });

  it("computes next_retry_at as now + the backed-off delay", () => {
    const now = "2026-07-12T00:00:00.000Z";
    const nextRetryAt = computeNextRetryAtIso(now, 1);
    expect(new Date(nextRetryAt).getTime() - new Date(now).getTime()).toBe(BASE_DELAY_MS);
  });
});
