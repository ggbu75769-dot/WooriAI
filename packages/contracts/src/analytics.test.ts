import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  analyticsEventEnvelopeSchema,
  analyticsEventRegistry,
  getAnalyticsEventPayloadSchema,
  isAllowedAnalyticsFieldSchema,
  isForbiddenAnalyticsPayloadKey,
  ANALYTICS_FORBIDDEN_PAYLOAD_KEYS
} from "./analytics";

describe("analytics event envelope (ANA-101, round5a-sprint2-plan.md §5)", () => {
  it("accepts a well-formed envelope", () => {
    const envelope = {
      eventName: "app_opened",
      eventVersion: 1,
      eventId: randomUUID(),
      occurredAt: new Date().toISOString(),
      appVersion: "1.2.3",
      platform: "ios",
      payload: {}
    };
    expect(analyticsEventEnvelopeSchema.parse(envelope)).toMatchObject(envelope);
  });

  it("accepts an envelope without the optional appVersion/platform fields", () => {
    expect(
      analyticsEventEnvelopeSchema.parse({
        eventName: "app_opened",
        eventVersion: 1,
        eventId: randomUUID(),
        occurredAt: new Date().toISOString(),
        payload: {}
      })
    ).toBeTruthy();
  });

  it("is strict: rejects unknown top-level fields (e.g. client-supplied anon ids)", () => {
    expect(() =>
      analyticsEventEnvelopeSchema.parse({
        eventName: "app_opened",
        eventVersion: 1,
        eventId: randomUUID(),
        occurredAt: new Date().toISOString(),
        payload: {},
        userAnonId: "client-should-not-set-this"
      })
    ).toThrow();
  });

  it("rejects a non-uuid eventId and a non-ISO occurredAt", () => {
    expect(() =>
      analyticsEventEnvelopeSchema.parse({
        eventName: "app_opened",
        eventVersion: 1,
        eventId: "not-a-uuid",
        occurredAt: new Date().toISOString(),
        payload: {}
      })
    ).toThrow();

    expect(() =>
      analyticsEventEnvelopeSchema.parse({
        eventName: "app_opened",
        eventVersion: 1,
        eventId: randomUUID(),
        occurredAt: "not-a-date",
        payload: {}
      })
    ).toThrow();
  });

  it("rejects an invalid platform value", () => {
    expect(() =>
      analyticsEventEnvelopeSchema.parse({
        eventName: "app_opened",
        eventVersion: 1,
        eventId: randomUUID(),
        occurredAt: new Date().toISOString(),
        platform: "windows",
        payload: {}
      })
    ).toThrow();
  });
});

describe("analytics event registry lookup", () => {
  it("has the seven approved events at version 1", () => {
    const keys = analyticsEventRegistry.map((entry) => `${entry.eventName}@${entry.eventVersion}`).sort();
    expect(keys).toEqual(
      [
        "app_opened@1",
        "onboarding_completed@1",
        "expense_recorded@1",
        "expense_synced@1",
        "expense_catalog_search_missed@1",
        "item_status_changed@1",
        "affiliate_link_clicked@1"
      ].sort()
    );
  });

  it("returns the payload schema for a registered eventName@version", () => {
    const schema = getAnalyticsEventPayloadSchema("onboarding_completed", 1);
    expect(schema).toBeDefined();
    expect(schema!.parse({ stepCount: 4 })).toEqual({ stepCount: 4 });
  });

  it("returns undefined for an unregistered event name or version", () => {
    expect(getAnalyticsEventPayloadSchema("does_not_exist", 1)).toBeUndefined();
    expect(getAnalyticsEventPayloadSchema("app_opened", 99)).toBeUndefined();
  });

  it("each registered payload schema rejects unknown/free-form fields via strict()", () => {
    for (const entry of analyticsEventRegistry) {
      expect(() => entry.payloadSchema.parse({ unexpectedField: "value" })).toThrow();
    }
  });
});

describe("expense_catalog_search_missed v1 payload", () => {
  it("accepts only coarse category and query-length buckets, never the query text", () => {
    const schema = getAnalyticsEventPayloadSchema("expense_catalog_search_missed", 1)!;
    expect(schema.parse({
      categoryCode: "diaper_hygiene",
      queryLengthBucket: "4_7"
    })).toEqual({
      categoryCode: "diaper_hygiene",
      queryLengthBucket: "4_7"
    });
    expect(() => schema.parse({
      categoryCode: "diaper_hygiene",
      queryLengthBucket: "4_7",
      query: "raw search text"
    })).toThrow();
  });
});

describe("expense_recorded v1 payload", () => {
  it("accepts a valid bucketed payload", () => {
    const schema = getAnalyticsEventPayloadSchema("expense_recorded", 1)!;
    expect(
      schema.parse({
        categoryCode: "diaper_hygiene",
        amountBucket: "10k_50k",
        source: "manual",
        offline: false
      })
    ).toMatchObject({ categoryCode: "diaper_hygiene", amountBucket: "10k_50k" });
  });

  it("rejects a free-form category string outside the locked enum", () => {
    const schema = getAnalyticsEventPayloadSchema("expense_recorded", 1)!;
    expect(() =>
      schema.parse({
        categoryCode: "some random free text",
        amountBucket: "10k_50k",
        source: "manual",
        offline: false
      })
    ).toThrow();
  });
});

/**
 * PII-safety lint: iterates `analyticsEventRegistry` itself (not a hardcoded
 * list of event names), so any event added later is automatically covered --
 * no separate checklist to remember when extending the registry.
 */
describe("analytics payload PII lint", () => {
  it("registry is non-empty (sanity check that the loop below actually exercises something)", () => {
    expect(analyticsEventRegistry.length).toBeGreaterThan(0);
  });

  for (const entry of analyticsEventRegistry) {
    describe(`${entry.eventName}@${entry.eventVersion}`, () => {
      const shape = entry.payloadSchema.shape;
      const keys = Object.keys(shape);

      it("has no property key on the forbidden PII key list", () => {
        for (const key of keys) {
          expect(isForbiddenAnalyticsPayloadKey(key)).toBe(false);
        }
      });

      it("has only enum literal / boolean / integer fields (no free-form strings)", () => {
        for (const key of keys) {
          expect(isAllowedAnalyticsFieldSchema(shape[key])).toBe(true);
        }
      });
    });
  }

  it("forbidden-key matcher catches every documented PII key name (sanity check of the matcher itself)", () => {
    for (const key of ANALYTICS_FORBIDDEN_PAYLOAD_KEYS) {
      expect(isForbiddenAnalyticsPayloadKey(key)).toBe(true);
    }
    expect(isForbiddenAnalyticsPayloadKey("categoryCode")).toBe(false);
  });

  it("a hypothetical payload with a free z.string() field would be rejected by the type check", () => {
    // Guards against the lint itself silently passing everything -- proves
    // isAllowedAnalyticsFieldSchema actually rejects free-form strings.
    expect(isAllowedAnalyticsFieldSchema(z.string())).toBe(false);
    expect(isAllowedAnalyticsFieldSchema(z.number())).toBe(false); // non-int number
  });
});
