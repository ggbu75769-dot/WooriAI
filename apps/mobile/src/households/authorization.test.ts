import { describe, expect, it, vi } from "vitest";
import { resolveAuthorizedHouseholdScope } from "./authorization";

const DEFAULT_ID = "a1170a17-0000-4a17-8a17-000000000001";
const AUTHORIZED_ID = "a1170a17-0000-4a17-8a17-000000000006";
const FOREIGN_ID = "a1170a17-0000-4a17-8a17-000000000099";

describe("exact-household route authorization", () => {
  it("honors an authorized non-default household", () => {
    expect(resolveAuthorizedHouseholdScope({
      requestedHouseholdId: AUTHORIZED_ID.toUpperCase(),
      defaultHouseholdId: DEFAULT_ID,
      authorizedHouseholdIds: [DEFAULT_ID, AUTHORIZED_ID]
    })).toEqual({ householdId: AUTHORIZED_ID, rejectedRequestedHousehold: false });
  });

  it("never passes a foreign UUID to the member loader", async () => {
    const loadMembers = vi.fn();
    const scope = resolveAuthorizedHouseholdScope({
      requestedHouseholdId: FOREIGN_ID,
      defaultHouseholdId: DEFAULT_ID,
      authorizedHouseholdIds: [DEFAULT_ID]
    });
    await loadMembers(scope.householdId);
    expect(loadMembers).toHaveBeenCalledTimes(1);
    expect(loadMembers).toHaveBeenCalledWith(DEFAULT_ID);
    expect(loadMembers).not.toHaveBeenCalledWith(FOREIGN_ID);
    expect(scope.rejectedRequestedHousehold).toBe(true);
  });
});
