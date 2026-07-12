import { localCategoryNameKo } from "./api/local-fixtures";

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
 * Single source of truth for the 8 quick-expense category tiles rendered in
 * apps/mobile/app/expenses/new.tsx. Each entry has a distinct `id` so that tapping a different
 * tile always records a different `categoryId` -- previously all 8 tiles shared the literal id
 * "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", which made category aggregation meaningless.
 *
 * Judgment calls on ambiguous label -> code mappings (server has 12 seed codes, tiles need 8):
 * - "식비" has no dedicated adult meal-cost code in the server seed, so it shares the
 *   `feeding_babyfood` family with "분유/유제품" (distinct id, same code) rather than colliding
 *   with the "기타" tile's `etc` code.
 * - "약품/교통" maps to `outing_mobility` (외출/이동 covers transport); the medication half is
 *   already covered by the separate "병원/약" tile (`hospital_checkup`).
 * - "교육/도서" maps to `toys_books` (장난감/책 explicitly covers "책"/books) rather than
 *   `care_education` (돌봄/교육, which is care-centric rather than book/education-material centric).
 */
// Ids are fixed v4-shaped UUID literals (not slugs) because the real API's DTOs validate
// `categoryId` with @IsUUID; a readable slug like "cat-diaper_hygiene" would 400 on the real
// server path. The trailing hex pair encodes the tile index so the literals stay deterministic.
export const categoryCatalog: CategoryCatalogEntry[] = [
  { id: "c0a7e901-0000-4c01-8c01-c47e900ec001", code: "diaper_hygiene", label: "기저귀", icon: "▱" },
  { id: "c0a7e901-0000-4c02-8c02-c47e900ec002", code: "feeding_babyfood", label: "분유/유제품", icon: "▤" },
  { id: "c0a7e901-0000-4c03-8c03-c47e900ec003", code: "feeding_babyfood", label: "식비", icon: "⌘" },
  { id: "c0a7e901-0000-4c04-8c04-c47e900ec004", code: "clothes_laundry", label: "의류", icon: "⌂" },
  { id: "c0a7e901-0000-4c05-8c05-c47e900ec005", code: "outing_mobility", label: "약품/교통", icon: "▭" },
  { id: "c0a7e901-0000-4c06-8c06-c47e900ec006", code: "hospital_checkup", label: "병원/약", icon: "▣" },
  { id: "c0a7e901-0000-4c07-8c07-c47e900ec007", code: "toys_books", label: "교육/도서", icon: "▥" },
  { id: "c0a7e901-0000-4c08-8c08-c47e900ec008", code: "etc", label: "기타", icon: "⊕" }
];

/**
 * Resolves a stored `categoryId` (from the quick-expense catalog above, or from the
 * local-backend seed fixtures in src/api/local-fixtures.ts) to a Korean display label.
 * Falls back to "기타" when the id matches neither source, so unknown/legacy ids never leak
 * a raw id string into the UI (see apps/mobile/app/(tabs)/reports.tsx category legend).
 */
export function categoryNameFor(categoryId: string): string {
  const catalogMatch = categoryCatalog.find((entry) => entry.id === categoryId);
  if (catalogMatch) return catalogMatch.label;

  const localMatch = localCategoryNameKo[categoryId];
  if (localMatch) return localMatch;

  return "기타";
}
