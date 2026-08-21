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

/**
 * Minimal structural shape of one `GET /categories` entry (client.ts's `CategoryListItem`).
 * Declared locally instead of imported so this module stays free of the API client (which
 * imports the category catalog above through src/api/local-backend.ts).
 */
export type ServerCategoryName = { id: string; name: string };

/** `categoryId` -> Korean display label. */
export type CategoryNameLookup = (categoryId: string) => string;

/**
 * REP/EXP: builds a `categoryId -> 이름` lookup from a `GET /categories` response.
 *
 * Why this exists: the server's report/CSV payloads carry only `categoryId`, and the 12 canonical
 * seed categories (apps/api/prisma/seed-data.ts `categorySeeds`) are seeded WITHOUT fixed ids, so
 * their ids are random UUIDs that differ per database. `categoryNameFor` above only knows the 8
 * quick-expense tiles and the demo fixtures, so on a real session every canonical category (the
 * ones reachable from the edit screen's `GET /categories` chip row) collapsed to "기타" in the
 * report donut legend and in the CSV export. Feeding the server list through this lookup keeps
 * the labels honest without any change to the server response contract.
 *
 * Falls back to `categoryNameFor` for ids the server list doesn't contain (offline first run,
 * deactivated categories, legacy ids), so the previous behavior is preserved — never a raw id.
 * Callers pass the react-query `["categories"]` cache, which is enough of an "offline memory":
 * the last successful list keeps resolving names until the query refetches.
 */
export function buildCategoryNameLookup(
  categories: readonly ServerCategoryName[] | null | undefined
): CategoryNameLookup {
  const nameById = new Map<string, string>();
  for (const category of categories ?? []) {
    const name = category?.name?.trim();
    if (category?.id && name) nameById.set(category.id, name);
  }
  return (categoryId: string) => nameById.get(categoryId) ?? categoryNameFor(categoryId);
}

/**
 * Minimal structural shape needed to decide whether a `GET /categories` entry belongs in a
 * user-facing picker: the id (chip key / stored value), the taxonomy `code` (which seed bundle
 * it came from) and the display `name` (what a duplicate looks like to the user).
 */
export type SelectableCategory = { id: string; code: string; name: string };

/**
 * Server category `code` prefix of the mobile quick-tile alias rows
 * (`mobileCategoryAliasSeeds` in apps/api/prisma/seed-data.ts). Those 8 rows exist only so the
 * UUIDs hardcoded in `categoryCatalog` above stay valid `categoryId`s; the 12 canonical rows
 * (`categorySeeds`) are the real taxonomy, so an alias never wins a name collision.
 */
const MOBILE_ALIAS_CODE_PREFIX = "mobile_";

/**
 * Server category `code` prefix of the Excel-import stub row (`importStubCategorySeeds`, code
 * `import_stub_default`, name "가져오기 기본"). It is an internal placeholder for import rows
 * that have no category yet — never something a user should pick on purpose.
 */
const IMPORT_STUB_CODE_PREFIX = "import_";

/**
 * R20-B: narrows a `GET /categories` response down to the entries worth OFFERING in the expense
 * edit screen's category chip row. Display-only — the server response, the report/CSV name
 * lookup above, and every other screen keep seeing the full list.
 *
 * Why: the endpoint returns every `active` row, and the seed is three bundles stacked together
 * (12 canonical + 8 mobile aliases + 1 import stub = 21 rows). Drawn verbatim, the chip row shows
 * "기타" twice and offers the internal "가져오기 기본" — see docs/operations/known-limitations.md.
 *
 * Rules, in order:
 *   (a) drop the import stub (`code` starts with `import_`);
 *   (b) collapse entries that share the exact same display name down to one;
 *   (c) `currentCategoryId` — the category the expense being edited is already saved with — is
 *       ALWAYS kept, even if (a) or (b) would have dropped it, so the chip row can still show
 *       and re-select the current value instead of silently losing it.
 *
 * Which entry survives a same-name group is deterministic: the current category first (so the
 * selection stays put), then a canonical row over a `mobile_`-prefixed alias, then input order.
 * The group takes the input position of its first member, so the caller's ordering
 * (displayOrder ascending) is preserved.
 *
 * NOTE: this only removes EXACT name duplicates. Near-duplicate pairs that read as redundant to
 * a user but are distinct labels ("기저귀/위생" vs the alias "기저귀", "수유/이유식" vs "분유/유제품")
 * are deliberately both kept — dropping one would remove a category that the 8-tile quick-input
 * screen (app/expenses/new.tsx) actively writes, which is a taxonomy decision for the server, not
 * a display filter. See known-limitations.md.
 */
export function selectableCategories<T extends SelectableCategory>(
  categories: readonly T[] | null | undefined,
  currentCategoryId?: string | null
): T[] {
  const current = currentCategoryId ?? "";
  const isCurrent = (category: T) => Boolean(current) && category.id === current;
  const isAlias = (category: T) => (category.code ?? "").startsWith(MOBILE_ALIAS_CODE_PREFIX);
  const isImportStub = (category: T) => (category.code ?? "").startsWith(IMPORT_STUB_CODE_PREFIX);

  const kept: T[] = [];
  // name -> index in `kept`, so a later entry can replace an earlier one in place (keeping the
  // group's original position) rather than being appended out of order.
  const slotByName = new Map<string, number>();

  for (const category of categories ?? []) {
    if (!category?.id) continue;
    const name = category.name?.trim() ?? "";
    if (!name) continue;
    if (isImportStub(category) && !isCurrent(category)) continue;

    const slot = slotByName.get(name);
    if (slot === undefined) {
      slotByName.set(name, kept.length);
      kept.push(category);
      continue;
    }

    const incumbent = kept[slot];
    // Ranked lower is better: the expense's current category, then a canonical row, then an alias.
    const rank = (entry: T) => (isCurrent(entry) ? 0 : isAlias(entry) ? 2 : 1);
    if (rank(category) < rank(incumbent)) kept[slot] = category;
  }

  return kept;
}
