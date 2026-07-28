const legacyCategoryNameKo: Record<string, string> = {
  "local-category-diaper": "기저귀",
  "local-category-formula": "분유/유제품",
  "local-category-detergent": "유아용 세제",
  "local-category-import": "가져오기"
};

/**
 * Category codes seeded on the server -- see "5. SEED CATEGORIES" in
 * docs/3차/db_api/wooriai_phase3_schema_v0_3.sql. Kept here (rather than re-derived) so the
 * mobile quick-expense catalog stays traceable to the server's category taxonomy.
 */
export type CategoryCode =
  | "pregnancy_mother"
  | "hospital_checkup"
  | "birth_postpartum"
  | "diaper_hygiene"
  | "feeding_babyfood"
  | "clothes_laundry"
  | "sleep_furniture"
  | "outing_mobility"
  | "toys_books"
  | "care_education"
  | "insurance_savings"
  | "etc";

export type CategoryCatalogEntry = {
  /** Stable, deterministic id stored as `expenses.categoryId`. Unique per catalog entry. */
  id: string;
  code: CategoryCode;
  label: string;
  icon: string;
};

/**
 * Accounting taxonomy used consistently by expense entry, filters, and reports. Quick items
 * (기저귀, 분유, 병원비, 책...) are defined separately by the expense screen and map into one of
 * these 12 categories, so an item name can never masquerade as a category again.
 */
// Ids are fixed v4-shaped UUID literals (not slugs) because the real API's DTOs validate
// `categoryId` with @IsUUID; a readable slug like "cat-diaper_hygiene" would 400 on the real
// server path. The trailing hex pair encodes the tile index so the literals stay deterministic.
export const categoryCatalog: CategoryCatalogEntry[] = [
  { id: "c0a7e901-0000-4c09-8c09-c47e900ec009", code: "pregnancy_mother", label: "임신·산모", icon: "mother-heart" },
  { id: "c0a7e901-0000-4c06-8c06-c47e900ec006", code: "hospital_checkup", label: "병원·건강", icon: "hospital-box-outline" },
  { id: "c0a7e901-0000-4c0a-8c0a-c47e900ec00a", code: "birth_postpartum", label: "출산·산후", icon: "baby-carriage" },
  { id: "c0a7e901-0000-4c01-8c01-c47e900ec001", code: "diaper_hygiene", label: "기저귀·위생", icon: "baby-face-outline" },
  { id: "c0a7e901-0000-4c02-8c02-c47e900ec002", code: "feeding_babyfood", label: "수유·이유식", icon: "baby-bottle-outline" },
  { id: "c0a7e901-0000-4c04-8c04-c47e900ec004", code: "clothes_laundry", label: "의류·세탁", icon: "tshirt-crew-outline" },
  { id: "c0a7e901-0000-4c0b-8c0b-c47e900ec00b", code: "sleep_furniture", label: "수면·가구", icon: "bed-outline" },
  { id: "c0a7e901-0000-4c05-8c05-c47e900ec005", code: "outing_mobility", label: "외출·이동", icon: "stroller" },
  { id: "c0a7e901-0000-4c07-8c07-c47e900ec007", code: "toys_books", label: "장난감·책", icon: "toy-brick-outline" },
  { id: "c0a7e901-0000-4c0c-8c0c-c47e900ec00c", code: "care_education", label: "돌봄·교육", icon: "school-outline" },
  { id: "c0a7e901-0000-4c0d-8c0d-c47e900ec00d", code: "insurance_savings", label: "보험·저축", icon: "shield-outline" },
  { id: "c0a7e901-0000-4c08-8c08-c47e900ec008", code: "etc", label: "기타", icon: "dots-horizontal-circle-outline" }
];

/**
 * Resolves a stored `categoryId` (from the quick-expense catalog above, or from the
 * local-backend seed fixtures in src/api/local-fixtures.ts) to a Korean display label.
 * Falls back to "기타" when the id matches neither source, so unknown/legacy ids never leak
 * a raw id string into the UI (see apps/mobile/app/(tabs)/reports.tsx category legend).
 */
export function categoryNameFor(categoryId: string): string {
  if (categoryId === "c0a7e901-0000-4c03-8c03-c47e900ec003") return "수유·이유식";
  const catalogMatch = categoryCatalog.find((entry) => entry.id === categoryId);
  if (catalogMatch) return catalogMatch.label;

  const legacyMatch = legacyCategoryNameKo[categoryId];
  if (legacyMatch) return legacyMatch;

  return "기타";
}
