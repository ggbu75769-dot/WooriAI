import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as localBackend from "./api/local-backend";
import { LOCAL_HOUSEHOLD_ID, LOCAL_USER_ID } from "./api/fixture-runtime";

const source = (relativePath: string) => readFileSync(join(process.cwd(), relativePath), "utf8");

function errorCode(action: () => unknown) {
  try {
    action();
    return null;
  } catch (error) {
    return error && typeof error === "object" && "code" in error ? error.code : null;
  }
}

describe("household authority recovery contract", () => {
  beforeEach(() => localBackend.resetLocalBackendForTests());
  afterEach(() => {
    vi.unstubAllEnvs();
    localBackend.resetLocalBackendForTests();
  });

  it("keeps fixture ownership rules and stable codes aligned with the API", () => {
    const members = localBackend.listHouseholdMembers(LOCAL_HOUSEHOLD_ID).members;
    const owner = members.find((member) => member.userId === LOCAL_USER_ID)!;
    const coParent = members.find((member) => member.role === "co_parent")!;

    expect(errorCode(() => localBackend.leaveHousehold(LOCAL_HOUSEHOLD_ID))).toBe("OWNER_TRANSFER_REQUIRED");
    expect(errorCode(() => localBackend.confirmHouseholdLeave(LOCAL_HOUSEHOLD_ID, "LEAVE HOUSEHOLD")))
      .toBe("OWNER_TRANSFER_REQUIRED");
    expect(errorCode(() => localBackend.removeHouseholdMember(LOCAL_HOUSEHOLD_ID, owner.id)))
      .toBe("OWNER_TRANSFER_REQUIRED");

    localBackend.transferHouseholdOwnership(LOCAL_HOUSEHOLD_ID, coParent.userId);
    expect(localBackend.leaveHousehold(LOCAL_HOUSEHOLD_ID)).toMatchObject({ success: true, flowId: "household_leave" });
  });

  it("provides a deterministic non-default blocker, retry and cancel fixture", () => {
    vi.stubEnv("EXPO_PUBLIC_AUTHORITY_RECOVERY_FIXTURE", "1");
    localBackend.resetLocalBackendForTests();
    const confirmed = localBackend.confirmAccountDeletion("DELETE ACCOUNT");
    const blocked = confirmed.deletion!;
    expect(blocked).toMatchObject({
      state: "failed",
      failureCode: "OWNER_TRANSFER_REQUIRED",
      details: { accessRevoked: false }
    });
    expect(blocked.details?.householdId).not.toBe(LOCAL_HOUSEHOLD_ID);

    const recoveryMembers = localBackend.listHouseholdMembers(blocked.details!.householdId).members;
    expect(recoveryMembers.every((member) => member.householdId === blocked.details!.householdId)).toBe(true);
    expect(errorCode(() => localBackend.retryAccountDeletion(blocked.id))).toBe("OWNER_TRANSFER_REQUIRED");
    const target = recoveryMembers.find((member) => member.role === "co_parent")!;
    localBackend.transferHouseholdOwnership(blocked.details!.householdId, target.userId);
    expect(localBackend.retryAccountDeletion(blocked.id)).toMatchObject({
      state: "requested",
      failureCode: null,
      details: undefined
    });

    localBackend.resetLocalBackendForTests();
    const cancellable = localBackend.confirmAccountDeletion("DELETE ACCOUNT").deletion!;
    expect(localBackend.cancelAccountDeletion(cancellable.id)).toMatchObject({ state: "cancelled", failureCode: null });
    expect(localBackend.getCurrentAccountDeletion()).toBeNull();
  });

  it("keeps exact-household routing, stale recovery and accessible feedback in existing screens", () => {
    const family = source("app/family/index.tsx");
    const privacy = source("app/settings/privacy.tsx");
    const client = source("src/api/client.ts");

    expect(family).toContain('useLocalSearchParams<{ householdId?');
    expect(family).toContain('["household-members", householdId]');
    expect(family).toContain("OWNER_TRANSFER_TARGET_CHANGED");
    expect(family).toContain('accessibilityLiveRegion="polite"');
    expect(family).toContain('accessibilityRole="radiogroup"');
    expect(privacy).toContain("삭제는 시작되지 않았고 계정 접근도 그대로 유지돼요");
    expect(privacy).toContain("소유권 이전하러 가기");
    expect(privacy).toContain("삭제 다시 시도");
    expect(privacy).toContain("!activeDeletion");
    expect(privacy).toContain("deletionPresentation!.canCancel");
    expect(privacy).toContain("accountDeletionPresentation");
    expect(privacy).toContain("isHouseholdOwner");
    expect(privacy).toContain("if (!canLeaveHousehold");
    expect(privacy).toContain("가족 소유자는 바로 나갈 수 없어요");
    expect(privacy).toContain('pathname: "/family"');
    expect(privacy).toContain("accountDelete.reset();");
    expect(client).toContain("/privacy/account-deletion/${requestId}/retry");
    expect(client).toContain("errorRecord?.details");
  });
});
