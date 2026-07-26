import { describe, expect, it } from "vitest";
import { notificationRouteHref } from "./route";

describe("notification route allowlist", () => {
  it("maps only known route identifiers", () => {
    expect(notificationRouteHref("preparation")).toBe("/(tabs)/items");
    expect(notificationRouteHref("preparation", null, "safety")).toBe("/(tabs)/items?surface=overview");
    expect(notificationRouteHref("preparation", null, "replacement")).toBe("/(tabs)/items");
    expect(notificationRouteHref("family")).toBe("/family");
    expect(notificationRouteHref("reports")).toBe("/(tabs)/reports");
    expect(notificationRouteHref(null)).toBeNull();
    expect(notificationRouteHref("https://attacker.example" as never)).toBeNull();
    expect(notificationRouteHref("../settings/privacy" as never)).toBeNull();
  });

  it("builds only UUID-scoped item links and rejects malformed navigation payloads", () => {
    const itemId = "11111111-1111-4111-8111-111111111111";
    const childId = "22222222-2222-4222-8222-222222222222";
    expect(notificationRouteHref("preparation", {
      kind: "item",
      householdId: "33333333-3333-4333-8333-333333333333",
      childId,
      itemId
    })).toBe(`/items/${itemId}?contextType=child&contextId=${childId}`);
    expect(notificationRouteHref("preparation", {
      kind: "item",
      householdId: "33333333-3333-4333-8333-333333333333",
      childId,
      itemId
    }, "safety")).toBe(`/(tabs)/items?surface=overview&contextType=child&contextId=${childId}`);
    expect(notificationRouteHref("preparation", { kind: "item", childId: "../privacy", itemId })).toBe("/(tabs)/items");
    expect(notificationRouteHref(null, { kind: "item", childId, itemId: "javascript:alert(1)" })).toBeNull();
    expect(notificationRouteHref(null, { kind: "item", childId, itemId: "a".repeat(2_000) })).toBeNull();
    expect(notificationRouteHref(null, { kind: "item", childId, itemId: `${itemId}%2Fprivacy` })).toBeNull();
  });
});
