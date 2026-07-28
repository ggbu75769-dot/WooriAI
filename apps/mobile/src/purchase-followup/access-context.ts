export type PurchaseHouseholdRole =
  | "owner"
  | "co_parent"
  | "viewer"
  | "gift_participant";

export function resolveVerifiedPurchaseRole(input: {
  expectedChildId: string;
  child: { id: string; householdId?: string } | null | undefined;
  queriedHouseholdId: string | null | undefined;
  currentUserId: string | null | undefined;
  members: Array<{
    userId: string;
    householdId: string;
    role: PurchaseHouseholdRole;
    status: "pending" | "active" | "removed" | "left";
  }>;
}): PurchaseHouseholdRole | null {
  if (
    !input.child?.householdId ||
    input.child.id !== input.expectedChildId ||
    input.child.householdId !== input.queriedHouseholdId ||
    !input.currentUserId
  ) {
    return null;
  }
  return (
    input.members.find(
      (member) =>
        member.userId === input.currentUserId &&
        member.householdId === input.child?.householdId &&
        member.status === "active"
    )?.role ??
    null
  );
}
