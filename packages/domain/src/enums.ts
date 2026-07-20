export const AUTH_PROVIDERS = ["kakao", "apple", "google"] as const;
export type AuthProvider = (typeof AUTH_PROVIDERS)[number];

export const USER_STATUSES = ["active", "withdrawn", "blocked"] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export const MEMBER_ROLES = ["owner", "co_parent", "viewer", "gift_participant"] as const;
export type MemberRole = (typeof MEMBER_ROLES)[number];

export const MEMBER_STATUSES = ["pending", "active", "removed", "left"] as const;
export type MemberStatus = (typeof MEMBER_STATUSES)[number];

export const CHILD_STAGE_MODES = ["pregnant", "born", "manual"] as const;
export type ChildStageMode = (typeof CHILD_STAGE_MODES)[number];

export const CHILD_STAGE_CODES = [
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
] as const;
export type ChildStageCode = (typeof CHILD_STAGE_CODES)[number];

export const EXPENSE_SOURCES = ["manual", "excel_import", "purchase_followup", "receipt", "admin"] as const;
export type ExpenseSource = (typeof EXPENSE_SOURCES)[number];

export const EXPENSE_TYPES = ["expense", "gift", "refund", "support"] as const;
export type ExpenseType = (typeof EXPENSE_TYPES)[number];

export const PAYMENT_METHODS = ["unknown", "cash", "card", "transfer", "mobile_pay"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const NECESSITY_LEVELS = ["essential", "convenience", "optional"] as const;
export type NecessityLevel = (typeof NECESSITY_LEVELS)[number];

export const ITEM_STATUSES = [
  "not_prepared",
  "prepared",
  "gifted",
  "not_needed",
  "interested"
] as const;
export type ItemStatus = (typeof ITEM_STATUSES)[number];

export const PRODUCT_PLATFORMS = ["coupang", "naver", "custom"] as const;
export type ProductPlatform = (typeof PRODUCT_PLATFORMS)[number];

export const IMPORT_STATUSES = [
  "uploaded",
  "analyzing",
  "preview_ready",
  "confirmed",
  "failed",
  "cancelled"
] as const;
export type ImportStatus = (typeof IMPORT_STATUSES)[number];

export function isChildStageCode(value: unknown): value is ChildStageCode {
  return typeof value === "string" && CHILD_STAGE_CODES.includes(value as ChildStageCode);
}
