import { describe, expect, it } from "vitest";
import {
  AUTH_PROVIDERS,
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
    expect(EXPENSE_SOURCES).toEqual(["manual", "excel_import", "purchase_followup", "receipt", "admin"]);
    expect(EXPENSE_TYPES).toEqual(["expense", "gift", "refund", "support"]);
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

  it("checks child stage codes at runtime", () => {
    expect(isChildStageCode("pregnancy_late")).toBe(true);
    expect(isChildStageCode("teenager")).toBe(false);
  });
});
