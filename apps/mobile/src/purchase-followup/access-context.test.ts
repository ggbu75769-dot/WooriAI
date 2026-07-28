import { describe, expect, it } from "vitest";
import { canManagePurchaseFollowup } from "./store";
import { resolveVerifiedPurchaseRole } from "./access-context";

describe("purchase follow-up selected-child household boundary", () => {
  const ownerA = {
    userId: "user-1",
    householdId: "household-a",
    role: "owner" as const,
    status: "active" as const
  };
  const viewerB = {
    userId: "user-1",
    householdId: "household-b",
    role: "viewer" as const,
    status: "active" as const
  };

  it("uses the selected child's B-household viewer role instead of an A-household owner role", () => {
    const role = resolveVerifiedPurchaseRole({
      expectedChildId: "child-b",
      child: { id: "child-b", householdId: "household-b" },
      queriedHouseholdId: "household-b",
      currentUserId: "user-1",
      members: [viewerB]
    });
    expect(role).toBe("viewer");
    expect(
      canManagePurchaseFollowup({
        childContext: true,
        isTestSession: false,
        role
      })
    ).toBe(false);
    expect(ownerA.role).toBe("owner");
  });

  it("uses the selected child's A-household owner role even when the user is only a viewer in B", () => {
    const role = resolveVerifiedPurchaseRole({
      expectedChildId: "child-a",
      child: { id: "child-a", householdId: "household-a" },
      queriedHouseholdId: "household-a",
      currentUserId: "user-1",
      members: [ownerA]
    });
    expect(role).toBe("owner");
    expect(
      canManagePurchaseFollowup({
        childContext: true,
        isTestSession: false,
        role
      })
    ).toBe(true);
    expect(viewerB.role).toBe("viewer");
  });

  it("fails closed when the child result, requested household, or current member does not match", () => {
    expect(
      resolveVerifiedPurchaseRole({
        expectedChildId: "child-b",
        child: { id: "child-b", householdId: "household-b" },
        queriedHouseholdId: "household-a",
        currentUserId: "user-1",
        members: [ownerA]
      })
    ).toBeNull();
    expect(
      resolveVerifiedPurchaseRole({
        expectedChildId: "child-b",
        child: { id: "child-a", householdId: "household-b" },
        queriedHouseholdId: "household-b",
        currentUserId: "user-1",
        members: [viewerB]
      })
    ).toBeNull();
    expect(
      resolveVerifiedPurchaseRole({
        expectedChildId: "child-a",
        child: { id: "child-a", householdId: "household-a" },
        queriedHouseholdId: "household-a",
        currentUserId: "user-1",
        members: [{ ...ownerA, status: "removed" }]
      })
    ).toBeNull();
  });
});
