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
 * legacy ids), so the previous behavior is preserved — never a raw id. Deactivated categories
 * are NOT such a case any more: R28-F3 makes `?includeAll=1` return `active: false` rows too, so
 * switching a category off in the admin no longer relabels past expenses as "기타" (it only stops
 * the category being OFFERED — see `selectableCategories` below).
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
 * Minimal structural shape of one `GET /categories` entry needed to map it onto a quick-expense
 * tile: the id an expense is stored under, and the taxonomy `code` that says which of the 12
 * canonical categories it is.
 */
export type ServerCategoryCode = { id: string; code: string };

/** `categoryId` -> the 8타일 catalog id that represents it, or `null` when no tile does. */
export type TileCategoryIdResolver = (categoryId: string) => string | null;

/**
 * 라운드 39 I-1 — 매핑 결과 한 건. `tileCategoryId`만으로는 **그 타일이 확실한지**를 알 수 없어
 * 따로 낸다.
 *
 * `ambiguous`는 "서버 `code` 하나에 이 앱의 타일이 둘 이상 걸려 있어, 그 중 하나를 임의로 골랐다"는
 * 뜻이다(현재 `feeding_babyfood` = "분유/유제품" + "식비"). 프리필처럼 **어느 쪽이든 골라야 하는**
 * 경로에서는 결정적 선택이면 충분하지만, 카테고리별 **합계를 말하는** 경로에서는 그 선택이 곧
 * 틀린 사실 진술이 된다(식비 행이 분유 합계로 가고, 그 합계가 화면에 숫자로 적힌다). 그래서 합계
 * 경로는 이 플래그를 보고 "모르는 분류"로 되돌린다 — entry-context-line.ts의 G-4 침묵 규칙.
 */
export type TileCategoryResolution = {
  tileCategoryId: string | null;
  ambiguous: boolean;
};

/** `categoryId` -> 타일 매핑 결과(모호 여부 포함). */
export type TileCategoryResolver = (categoryId: string) => TileCategoryResolution;

/**
 * 타일이 둘 이상 걸린 서버 `code` 집합 — `code`만으로는 타일을 특정할 수 없는 분류다.
 * 카탈로그에서 파생되므로 타일을 늘리거나 code를 바꿔도 손으로 고칠 목록이 없다.
 */
export const ambiguousTileCategoryCodes: ReadonlySet<string> = new Set(
  categoryCatalog
    .map((entry) => entry.code)
    .filter((code, index, codes) => codes.indexOf(code) !== codes.lastIndexOf(code))
);

/**
 * 라운드 38 H-6 / H-11 — 서버 카테고리 UUID를 **이 앱의 8타일 중 하나**로 옮기는 공용 매핑.
 *
 * 왜 필요한가: 8타일(`categoryCatalog`)의 id는 코드에 박힌 고정 UUID지만, 엑셀 임포트나 지출
 * 수정 화면을 거친 행은 서버가 시드한 **정식 카테고리 UUID**(DB마다 다른 랜덤 값,
 * `categorySeeds`)를 달고 들어온다. 두 값은 같은 분류를 가리키면서도 문자열이 다르므로,
 * id 완전 일치만 보는 코드는 그런 행에서 전부 "모르는 분류"로 떨어진다 — "또 기록"은 카테고리
 * 복사에 실패하고(H-6), 입력 화면 맥락 줄은 카테고리 항을 통째로 생략한다(H-11).
 *
 * 다리 역할을 하는 것이 `code`다. `["categories"]` 캐시(전량 21행 규약)가 `id -> code`를 주고,
 * `categoryCatalog`이 `code -> 타일 id`를 준다. 그래서 **새 요청 없이** 이미 받아 둔 목록만으로
 * 매핑이 된다. 캐시가 없으면(콜드 스타트·오프라인 첫 실행) 매핑도 없다 — 그때는 id 완전 일치만
 * 남아 종전 동작 그대로다(지어낸 분류를 쓰느니 모른다고 말한다).
 *
 * 판단 두 가지:
 * - 타일 id는 **그대로 통과**시킨다. 8타일의 별칭 행(`mobileCategoryAliasSeeds`, code
 *   `mobile_*`)은 애초에 타일과 같은 id라 이 규칙 하나로 해결되고, 캐시가 비어 있어도 동작한다.
 * - 한 code에 타일이 둘인 경우(`feeding_babyfood` = "분유/유제품"과 "식비")는 **카탈로그 순서상
 *   첫 타일**로 보내되, 그 결과에 `ambiguous: true`를 함께 실어 준다. 서버 code만으로는 둘을
 *   구별할 수 없으므로 어느 쪽이든 임의 선택이고, 결정적(deterministic)이기만 하면 같은 행이
 *   화면마다 다른 타일로 가는 일은 없다 — 다만 **그 임의 선택을 사실처럼 말해도 되는 경로**와
 *   그렇지 않은 경로가 갈린다(위 `TileCategoryResolution` 주석 · 라운드 39 I-1).
 * - 8타일에 대응 code가 없는 분류(임신/산모·수면/가구·보험/저축 …)와 임포트 스텁
 *   (`import_stub_default`)은 `null`이다. 이 화면이 고를 수 없는 분류를 지어내지 않는다.
 */
export function buildTileCategoryResolver(
  categories: readonly ServerCategoryCode[] | null | undefined
): TileCategoryResolver {
  const tileIds = new Set(categoryCatalog.map((entry) => entry.id));
  const tileIdByCode = new Map<string, string>();
  for (const entry of categoryCatalog) {
    if (!tileIdByCode.has(entry.code)) tileIdByCode.set(entry.code, entry.id);
  }
  const codeById = new Map<string, string>();
  for (const category of categories ?? []) {
    const code = category?.code?.trim();
    if (category?.id && code) codeById.set(category.id, code);
  }

  return (categoryId: string) => {
    if (typeof categoryId !== "string" || categoryId.length === 0) {
      return { tileCategoryId: null, ambiguous: false };
    }
    // 타일 id는 그 타일 자신이다 — code를 거치지 않으므로 모호할 수 없다.
    if (tileIds.has(categoryId)) return { tileCategoryId: categoryId, ambiguous: false };
    const code = codeById.get(categoryId);
    if (!code) return { tileCategoryId: null, ambiguous: false };
    const tileCategoryId = tileIdByCode.get(code) ?? null;
    return {
      tileCategoryId,
      // 갈 곳이 아예 없으면(대응 타일 없음) 모호한 게 아니라 그냥 모르는 분류다.
      ambiguous: tileCategoryId !== null && ambiguousTileCategoryCodes.has(code)
    };
  };
}

/**
 * 위 매핑의 **타일 id만** 필요한 호출부용 얇은 래퍼(프리필처럼 어느 쪽이든 하나를 골라야 하는
 * 경로). 모호한 code에서도 결정적으로 첫 타일을 돌려주므로 라운드 38 H-6의 동작 그대로다.
 */
export function buildTileCategoryIdResolver(
  categories: readonly ServerCategoryCode[] | null | undefined
): TileCategoryIdResolver {
  const resolve = buildTileCategoryResolver(categories);
  return (categoryId: string) => resolve(categoryId).tileCategoryId;
}

/**
 * Minimal structural shape needed to decide whether a `GET /categories` entry belongs in a
 * user-facing picker: the id (chip key / stored value), the taxonomy `code` (which seed bundle
 * it came from) and the display `name` (what a duplicate looks like to the user).
 */
export type SelectableCategory = {
  id: string;
  code: string;
  name: string;
  /**
   * CAT-124: server-side "is this a choice we offer?" flag (`GET /categories`). Optional so a
   * response/cache from before the flag existed still type-checks and still behaves as it did.
   */
  selectable?: boolean;
  /**
   * R28-F3: server-side "is this row still in use?" flag (`GET /categories`). `?includeAll=1` now
   * returns inactive rows too — deliberately, so a category an operator switched off keeps
   * resolving the NAME of expenses already recorded under it instead of collapsing them to "기타".
   * Optional for the same reason as `selectable`: a response/cache from before the flag existed
   * must keep behaving exactly as it did (missing = offer it).
   */
  active?: boolean;
};

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
 *   (a) drop rows the server marks `selectable: false` (CAT-124 — the 8 mobile quick-tile aliases
 *       and the excel-import stub) or `active: false` (R28-F3 — a category an operator switched
 *       off: it must not be OFFERED any more, while `buildCategoryNameLookup` above keeps using
 *       the full list so past expenses still show the name they were recorded under). A MISSING
 *       flag means "offer it": that is what a response or cache from before those flags existed
 *       looks like, and dropping those would empty the row;
 *   (b) drop the import stub by `code` prefix (`import_`) — kept as a belt-and-braces rule for the
 *       pre-CAT-124 payloads rule (a) deliberately lets through, and for the demo backend;
 *   (c) collapse entries that share the exact same display name down to one;
 *   (d) `currentCategoryId` — the category the expense being edited is already saved with — is
 *       ALWAYS kept, even if (a), (b) or (c) would have dropped it, so the chip row can still show
 *       and re-select the current value instead of silently losing it. This is what keeps an
 *       expense recorded through the 8-tile quick input (alias id) editable after CAT-124.
 *
 * Which entry survives a same-name group is deterministic: the current category first (so the
 * selection stays put), then a canonical row over a `mobile_`-prefixed alias, then input order.
 * The group takes the input position of its first member, so the caller's ordering
 * (displayOrder ascending) is preserved.
 *
 * CAT-124 changed what "near-duplicate" costs: pairs that read as redundant but are distinct
 * labels ("기저귀/위생" vs the alias "기저귀", "수유/이유식" vs "분유/유제품") used to both survive,
 * because dropping one client-side would have removed a category the 8-tile quick-input screen
 * (app/expenses/new.tsx) actively writes. That was a taxonomy decision for the server — and the
 * server has now made it: the alias rows are `selectable: false`, still exist, still accept new
 * expenses, and still resolve names (the app fetches `?includeAll=1`), they are just no longer
 * OFFERED. Rule (c) still matters for exact duplicates in the demo backend's fixture list.
 */
export function selectableCategories<T extends SelectableCategory>(
  categories: readonly T[] | null | undefined,
  currentCategoryId?: string | null
): T[] {
  const current = currentCategoryId ?? "";
  const isCurrent = (category: T) => Boolean(current) && category.id === current;
  const isAlias = (category: T) => (category.code ?? "").startsWith(MOBILE_ALIAS_CODE_PREFIX);
  const isImportStub = (category: T) => (category.code ?? "").startsWith(IMPORT_STUB_CODE_PREFIX);
  // CAT-124 / R28-F3: strictly `=== false`. `undefined` (a server/cache from before the flag)
  // means "offer it" — never let a missing field empty the chip row.
  const isHiddenByServer = (category: T) => category.selectable === false || category.active === false;

  const kept: T[] = [];
  // name -> index in `kept`, so a later entry can replace an earlier one in place (keeping the
  // group's original position) rather than being appended out of order.
  const slotByName = new Map<string, number>();

  for (const category of categories ?? []) {
    if (!category?.id) continue;
    const name = category.name?.trim() ?? "";
    if (!name) continue;
    if ((isHiddenByServer(category) || isImportStub(category)) && !isCurrent(category)) continue;

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
