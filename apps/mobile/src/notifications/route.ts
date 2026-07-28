import type { NotificationInboxItem } from "../api/client";

export type NotificationHref =
  | "/(tabs)/items"
  | "/(tabs)/items?surface=overview"
  | `/(tabs)/items?surface=overview&contextType=child&contextId=${string}`
  | "/family"
  | "/(tabs)/reports"
  | `/items/${string}?contextType=child&contextId=${string}`;

const routeAllowlist: Record<
  Exclude<NotificationInboxItem["route"], null>,
  NotificationHref
> = {
  preparation: "/(tabs)/items",
  family: "/family",
  reports: "/(tabs)/reports"
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const LOCAL_FIXTURE_CHILD_ID = /^local-child-[a-z0-9]+(?:-[a-z0-9]+)*$/i;

function isSafeChildId(value: unknown): value is string {
  return typeof value === "string" &&
    value.length <= 96 &&
    (UUID.test(value) || LOCAL_FIXTURE_CHILD_ID.test(value));
}

export function notificationRouteHref(
  route: unknown,
  navigation?: NotificationInboxItem["navigation"] | unknown,
  category?: NotificationInboxItem["category"] | unknown
): NotificationHref | null {
  if (
    category === "safety" &&
    navigation &&
    typeof navigation === "object" &&
    "kind" in navigation &&
    navigation.kind === "item" &&
    "childId" in navigation &&
    isSafeChildId(navigation.childId)
  ) {
    return `/(tabs)/items?surface=overview&contextType=child&contextId=${navigation.childId}`;
  }
  if (
    navigation &&
    typeof navigation === "object" &&
    "kind" in navigation &&
    navigation.kind === "item" &&
    "itemId" in navigation &&
    "childId" in navigation &&
    typeof navigation.itemId === "string" &&
    typeof navigation.childId === "string" &&
    navigation.itemId.length <= 36 &&
    navigation.childId.length <= 36 &&
    UUID.test(navigation.itemId) &&
    UUID.test(navigation.childId)
  ) {
    return `/items/${navigation.itemId}?contextType=child&contextId=${navigation.childId}`;
  }
  if (typeof route !== "string" || !(route in routeAllowlist)) return null;
  if (route === "preparation" && category === "safety") return "/(tabs)/items?surface=overview";
  return routeAllowlist[route as keyof typeof routeAllowlist];
}
