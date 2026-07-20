import { describe, expect, it } from "vitest";
import {
  bindPendingIntentToUser,
  bindPendingIntentOnAuthentication,
  canConsumePendingIntentForUser,
  canRestoreItemIntent,
  parsePendingNavigationIntent
} from "./pending-intent";

const householdId = "11111111-1111-4111-8111-111111111111";
const childId = "22222222-2222-4222-8222-222222222222";
const itemId = "33333333-3333-4333-8333-333333333333";

describe("pending protected navigation intent", () => {
  it("accepts only the exact item deep-link contract", () => {
    const intent = parsePendingNavigationIntent(
      `wooriai://items/${itemId}?householdId=${householdId}&childId=${childId}`
    );
    expect(intent).toMatchObject({ kind: "item", householdId, childId, itemId });
    expect(intent?.fingerprint).toBe(`${householdId}:${childId}:${itemId}`);
  });

  it.each([
    "https://example.com/items/33333333-3333-4333-8333-333333333333",
    "javascript:alert(1)",
    `wooriai://settings/${itemId}?householdId=${householdId}&childId=${childId}`,
    `wooriai://items/..%2Fsettings?householdId=${householdId}&childId=${childId}`,
    `wooriai://items/${itemId}?householdId=${householdId}&childId=${childId}&next=javascript:alert(1)`,
    `wooriai://items/${"a".repeat(2_000)}?householdId=${householdId}&childId=${childId}`
  ])("rejects a non-allowlisted or malformed URL: %s", (url) => {
    expect(parsePendingNavigationIntent(url)).toBeNull();
  });

  it("restores only when household and child membership both match", () => {
    const intent = parsePendingNavigationIntent(
      `wooriai://items/${itemId}?householdId=${householdId}&childId=${childId}`
    )!;
    expect(canRestoreItemIntent(intent, householdId, [{ id: childId }])).toBe(true);
    expect(canRestoreItemIntent(intent, "44444444-4444-4444-8444-444444444444", [{ id: childId }])).toBe(false);
    expect(canRestoreItemIntent(intent, householdId, [])).toBe(false);
  });

  it("never consumes user A's authenticated intent after switching directly to user B", () => {
    const intent = bindPendingIntentToUser(
      parsePendingNavigationIntent(`wooriai://items/${itemId}?householdId=${householdId}&childId=${childId}`)!,
      "user-a"
    );
    expect(canConsumePendingIntentForUser(intent, "user-a")).toBe(true);
    expect(canConsumePendingIntentForUser(intent, "user-b")).toBe(false);
  });

  it("allows a logged-out intent to be checked against the user who later authenticates", () => {
    const intent = parsePendingNavigationIntent(
      `wooriai://items/${itemId}?householdId=${householdId}&childId=${childId}`
    )!;
    expect(canConsumePendingIntentForUser(intent, "user-a")).toBe(true);
  });

  it("binds a logged-out intent to the first authenticated user before protected validation", () => {
    const anonymous = parsePendingNavigationIntent(
      `wooriai://items/${itemId}?householdId=${householdId}&childId=${childId}`
    )!;
    const bound = bindPendingIntentOnAuthentication(anonymous, "user-a");
    expect(bound.boundUserId).toBe("user-a");
    expect(canConsumePendingIntentForUser(bound, "user-a")).toBe(true);
    expect(canConsumePendingIntentForUser(bound, "user-b")).toBe(false);
    expect(bindPendingIntentOnAuthentication(bound, "user-b")).toBe(bound);
  });
});
