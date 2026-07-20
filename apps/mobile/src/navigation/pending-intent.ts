const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type PendingNavigationIntent = {
  kind: "item";
  householdId: string;
  childId: string;
  itemId: string;
  fingerprint: string;
  boundUserId: string | null;
};

export function parsePendingNavigationIntent(input: string): PendingNavigationIntent | null {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return null;
  }
  if (url.protocol !== "wooriai:" || url.hostname !== "items") return null;
  const itemId = url.pathname.replace(/^\//, "");
  const householdId = url.searchParams.get("householdId") ?? "";
  const childId = url.searchParams.get("childId") ?? "";
  if (![itemId, householdId, childId].every((value) => value.length <= 36 && UUID.test(value))) return null;
  if ([...url.searchParams.keys()].some((key) => !["householdId", "childId"].includes(key))) return null;
  return {
    kind: "item",
    householdId,
    childId,
    itemId,
    fingerprint: `${householdId}:${childId}:${itemId}`,
    boundUserId: null
  };
}

export function bindPendingIntentToUser(intent: PendingNavigationIntent, userId: string | null) {
  return { ...intent, boundUserId: userId };
}

export function bindPendingIntentOnAuthentication(
  intent: PendingNavigationIntent,
  currentUserId: string | null
) {
  if (intent.boundUserId !== null || currentUserId === null) return intent;
  return bindPendingIntentToUser(intent, currentUserId);
}

export function canConsumePendingIntentForUser(intent: PendingNavigationIntent, currentUserId: string | null) {
  return intent.boundUserId === null || intent.boundUserId === currentUserId;
}

export function canRestoreItemIntent(
  intent: PendingNavigationIntent,
  currentHouseholdId: string | null,
  children: Array<{ id: string }>
) {
  return currentHouseholdId === intent.householdId && children.some((child) => child.id === intent.childId);
}
