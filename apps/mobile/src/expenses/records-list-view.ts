import { categoryCatalog, categoryNameFor, selectableCategories, type SelectableCategory } from "../categories";

/**
 * REC-121: pure presentation helpers for the 기록 탭 list (app/(tabs)/records.tsx).
 *
 * Kept free of React / React Native imports so both helpers are directly unit-testable
 * (same discipline as src/offline/expense-list-reconciliation.ts).
 */

/** One chip in the 기록 탭 category filter row. */
export type RecordsCategoryChip = {
  /** Chip identity (also the `selectedCategoryId` state value). */
  id: string;
  /** Korean display label. */
  label: string;
  /**
   * EVERY `expenses.categoryId` this chip must match. Usually just `[id]`, but a chip that
   * absorbed same-name duplicates (see below) matches all of their ids -- otherwise selecting
   * the surviving "기타" chip would hide the expenses stored under the dropped duplicate's id.
   */
  matchIds: string[];
};

/**
 * REC-121: builds the 기록 탭 category filter chips from a `GET /categories` response.
 *
 * Why this exists: the chip row used to be the static 8-tile `categoryCatalog`, whose ids only
 * ever match expenses created through the quick-input screen. On a real session the canonical 12
 * seed categories get random per-database UUIDs (see buildCategoryNameLookup's comment), so an
 * expense whose category was picked on the edit screen -- or imported -- matched NO chip and the
 * filter returned 0건 no matter what was tapped. The chips now come from the same `["categories"]`
 * cache the edit/report/more screens already share.
 *
 * Rules:
 *  - the offered set is R20-B's `selectableCategories` (import stub dropped, exact same-name
 *    duplicates collapsed), so the row does not show "기타" twice or offer "가져오기 기본";
 *  - a collapsed same-name group still FILTERS on every id in the group (`matchIds`). This is
 *    load-bearing on both the real seed (canonical "기타" + `mobile_etc` alias "기타", which the
 *    8-tile quick input actively writes) and the demo backend (catalog "기저귀" + the local
 *    fixture "기저귀" the seeded demo expenses use);
 *  - `selectedCategoryId` is passed through to `selectableCategories` so the current selection
 *    always survives the dedupe, and a selection the server list does not contain at all
 *    (legacy/inactive/demo id, or a chip picked while the fallback below was showing) is
 *    prepended so the row never loses the chip the list is currently filtered by;
 *  - an empty/loading/failed list falls back to the static 8 tiles, so the row never disappears
 *    offline and preview/demo capture keeps its icons.
 *
 * Known gap (deliberate): the import stub category ("가져오기 기본") is not offered, so
 * import-stub rows are only reachable through "전체" -- see docs/operations/known-limitations.md.
 */
export function buildRecordsCategoryChips(
  categories: readonly SelectableCategory[] | null | undefined,
  selectedCategoryId?: string | null
): RecordsCategoryChip[] {
  const offered = selectableCategories(categories ?? [], selectedCategoryId);

  if (offered.length === 0) {
    return categoryCatalog.map((entry) => ({
      id: entry.id,
      label: `${entry.icon} ${entry.label}`,
      matchIds: [entry.id]
    }));
  }

  const idsByName = new Map<string, string[]>();
  for (const category of categories ?? []) {
    const name = category?.name?.trim();
    if (!category?.id || !name) continue;
    const group = idsByName.get(name);
    if (group) group.push(category.id);
    else idsByName.set(name, [category.id]);
  }

  const chips = offered.map((category): RecordsCategoryChip => {
    const name = category.name.trim();
    const group = idsByName.get(name);
    return {
      id: category.id,
      label: name,
      matchIds: group && group.length > 0 ? [...group] : [category.id]
    };
  });

  if (selectedCategoryId && !chips.some((chip) => chip.matchIds.includes(selectedCategoryId))) {
    chips.unshift({
      id: selectedCategoryId,
      label: categoryNameFor(selectedCategoryId),
      matchIds: [selectedCategoryId]
    });
  }

  return chips;
}

/**
 * REC-121 (D2/K1): composes a 기록 행 subtitle -- "[선물|환불 ·] 카테고리 · 8월 4일".
 *
 * D2: the row used to show only 품목명 / 날짜 / 금액, so two rows for different categories were
 * indistinguishable and the newly server-backed category filter had nothing to confirm itself
 * against. The label is resolved by the caller through `buildCategoryNameLookup` -- the same
 * lookup the chips above are built from -- so it costs no extra request.
 *
 * K1: `refund` was drawn exactly like a plain 지출 (only `gift` got a prefix). It now gets its own
 * "환불 ·" prefix. The AMOUNT is deliberately left unsigned: `formatKrw` never emits a sign by
 * contract (src/money.ts) and this screen's 월 합계 does not subtract refunds either, so drawing
 * "-38,500원" next to a total that never went down would claim an arithmetic the app does not
 * perform. The label is the honest distinction -- see docs/operations/known-limitations.md.
 */
export function recordsRowSubtitle(input: {
  expenseType?: string | null;
  categoryLabel?: string | null;
  dateLabel: string;
}): string {
  const parts: string[] = [];
  if (input.expenseType === "gift") parts.push("선물");
  else if (input.expenseType === "refund") parts.push("환불");
  const categoryLabel = input.categoryLabel?.trim();
  if (categoryLabel) parts.push(categoryLabel);
  parts.push(input.dateLabel);
  return parts.join(" · ");
}
