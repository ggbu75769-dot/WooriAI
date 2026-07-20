import type { NotificationInboxItem } from "../api/client";

export type NotificationHref =
  | "/(tabs)/items"
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

export function notificationRouteHref(
  route: unknown,
  navigation?: NotificationInboxItem["navigation"] | unknown
): NotificationHref | null {
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
  return routeAllowlist[route as keyof typeof routeAllowlist];
}
