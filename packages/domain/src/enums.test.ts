import { describe, expect, it } from "vitest";
import {
  AUTH_PROVIDERS,
  MEMBER_STATUSES,
  CHILD_STAGE_CODES,
  CHILD_STAGE_MODES,
  EXPENSE_SOURCES,
  EXPENSE_TYPES,
  IMPORT_STATUSES,
  ITEM_STATUSES,
  MEMBER_ROLES,
  NECESSITY_LEVELS,
  PAYMENT_METHODS,
  PRODUCT_PLATFORMS,
  USER_STATUSES,
  isChildStageCode
} from "./enums";

describe("locked domain enums", () => {
  it("matches the Phase 3 DB enum values", () => {
    expect(AUTH_PROVIDERS).toEqual(["kakao", "apple", "google"]);
    expect(MEMBER_ROLES).toEqual(["owner", "co_parent", "viewer", "gift_participant"]);
    expect(CHILD_STAGE_MODES).toEqual(["pregnant", "born", "manual"]);
    expect(CHILD_STAGE_CODES).toEqual([
      "pregnancy_early",
      "pregnancy_mid",
      "pregnancy_late",
      "newborn_0_3",
      "infant_4_6",
      "infant_7_12",
      "toddler_1_3",
      "kid_4_7",
      "elementary",
      "middle_school"
    ]);
    expect(EXPENSE_SOURCES).toEqual(["manual", "excel_import", "purchase_followup", "admin"]);
    expect(EXPENSE_TYPES).toEqual(["expense", "gift", "refund"]);
    expect(PAYMENT_METHODS).toEqual(["unknown", "cash", "card", "transfer", "mobile_pay"]);
    expect(NECESSITY_LEVELS).toEqual(["essential", "convenience", "optional"]);
    expect(ITEM_STATUSES).toEqual(["not_prepared", "prepared", "gifted", "not_needed", "interested"]);
    expect(PRODUCT_PLATFORMS).toEqual(["coupang", "naver", "custom"]);
    expect(IMPORT_STATUSES).toEqual([
      "uploaded",
      "analyzing",
      "preview_ready",
      "confirmed",
      "failed",
      "cancelled"
    ]);
  });

  /**
   * 라운드 106 T10 — 위 표에 **없던 enum 배열 둘**을 같은 방식으로 잠근다.
   *
   * `USER_STATUSES`·`MEMBER_STATUSES`는 이 파일의 "Phase 3 DB enum values" 표에서 빠져 있었다
   * (enums.boundary.test.ts는 두 배열을 중복 없음 검사에만 넣는다 — 값 자체는 어느 테스트도
   * 문지 않았다). 둘 다 Prisma 스키마의 실제 enum이고(`user_status` · `member_status`,
   * apps/api/prisma/schema.prisma), 값이 갈리면 DB가 거절하거나 조용히 다른 상태로 읽힌다.
   * 순서까지 함께 무는 것은 표의 나머지 열한 배열과 같은 관례다.
   */
  it("matches the Phase 3 DB enum values — user/member status (라운드 106 T10 보강)", () => {
    expect(USER_STATUSES).toEqual(["active", "withdrawn", "blocked"]);
    expect(MEMBER_STATUSES).toEqual(["pending", "active", "removed", "left"]);
  });

  it("checks child stage codes at runtime", () => {
    expect(isChildStageCode("pregnancy_late")).toBe(true);
    expect(isChildStageCode("teenager")).toBe(false);
  });
});
