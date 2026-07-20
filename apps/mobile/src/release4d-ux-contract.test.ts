import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import * as localBackend from "./api/local-backend";
import { LOCAL_HOUSEHOLD_ID } from "./api/fixture-runtime";

const source = (relativePath: string) => readFileSync(join(process.cwd(), relativePath), "utf8");

describe("Release 4D mobile UX contracts", () => {
  beforeEach(() => localBackend.resetLocalBackendForTests());

  it("keeps owner transfer eligible-role filtering and local role updates consistent", () => {
    const before = localBackend.listHouseholdMembers(LOCAL_HOUSEHOLD_ID).members;
    const target = before.find((member) => member.role === "co_parent");
    expect(target).toBeDefined();

    localBackend.transferHouseholdOwnership(LOCAL_HOUSEHOLD_ID, target!.userId);
    const after = localBackend.listHouseholdMembers(LOCAL_HOUSEHOLD_ID).members;
    expect(after.find((member) => member.userId === target!.userId)?.role).toBe("owner");
    expect(after.find((member) => member.id === "local-member-self")?.role).toBe("co_parent");
  });

  it("renders notification states and uses only allowlisted route identifiers", () => {
    const notifications = source("app/notifications.tsx");
    expect(notifications).toContain("useInfiniteQuery");
    expect(notifications).toContain("현재 목록 모두 읽음");
    expect(notifications).toContain("새 알림이 없어요.");
    expect(notifications).toContain("저장된 알림을 보여드리고 있어요");
    expect(notifications).toContain("notificationRouteHref");
    expect(notifications).not.toContain("router.push(item.");
  });

  it("exposes confirmed owner transfer and progressive item details", () => {
    const family = source("app/family/index.tsx");
    const detail = source("src/preparation/Release4ItemDetailScreen.tsx");
    expect(family).toContain("eligibleOwners");
    expect(family).toContain("confirmOwnerTransfer");
    expect(family).toContain("먼저 소유권을 이전해 주세요");
    expect(detail).toContain("세부 정보 더 입력");
    expect(detail).toContain("itemPlanFieldVisibility");
    expect(detail).toContain("변경 내용을 저장하지 않았어요");
    expect(detail).toContain("최신 값 다시 불러오기");
  });
});
