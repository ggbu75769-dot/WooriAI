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
   * absorbed same-name duplicates or `mobile_` aliases of its own taxonomy code (see below)
   * matches all of their ids -- otherwise selecting the surviving "기타" chip would hide the
   * expenses stored under the dropped duplicate's id.
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
 *  - the offered set is R20-B's `selectableCategories` (rows the server marks `selectable: false`
 *    and the import stub dropped, exact same-name duplicates collapsed), so the row does not show
 *    "기타" twice or offer "가져오기 기본". After CAT-124 that is the canonical 12 on a real
 *    session, since the 8 quick-tile aliases are `selectable: false`;
 *  - a chip still FILTERS on every id it stands for (`matchIds`), from two sources:
 *      (1) the same-name group it absorbed -- load-bearing on the demo backend (catalog "기저귀"
 *          + the local fixture "기저귀" the seeded demo expenses use), and on any pre-CAT-124
 *          server/cache payload where the alias rows are still offered (canonical "기타" +
 *          `mobile_etc` alias "기타");
 *      (2) CAT-124: the quick-tile alias ids that share the chip's taxonomy `code`, taken from the
 *          static `categoryCatalog` (whose ids ARE the server's alias-row ids -- see
 *          `mobileCategoryAliasSeeds` in apps/api/prisma/seed-data.ts). This is what keeps the
 *          alias-id expenses the 8-tile quick input writes visible now that the alias chips
 *          themselves are gone: tapping "기저귀/위생" also matches the "기저귀" tile's id, and
 *          "수유/이유식" matches both the "분유/유제품" and "식비" tiles. Without it, every
 *          quick-recorded expense would vanish from every chip -- reachable only via "전체";
 *  - `selectedCategoryId` is passed through to `selectableCategories` so the current selection
 *    always survives the dedupe, and a selection the server list does not contain at all
 *    (legacy/inactive/demo id, or a chip picked while the fallback below was showing) is
 *    prepended so the row never loses the chip the list is currently filtered by;
 *  - an empty/loading/failed list falls back to the static 8 tiles, so the row never disappears
 *    offline and preview/demo capture keeps its icons.
 *
 * Known gap (deliberate): the import stub category ("가져오기 기본") has no taxonomy code in the
 * catalog and is not offered, so import-stub rows stay reachable only through "전체"
 * -- see docs/operations/known-limitations.md.
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

  // CAT-124: taxonomy `code` -> the quick-tile ids that record under it. The catalog's ids are
  // byte-for-byte the server's `mobile_*` alias-row ids, so this maps a canonical chip to the
  // alias ids whose rows the server no longer offers.
  const catalogIdsByCode = new Map<string, string[]>();
  for (const entry of categoryCatalog) {
    const group = catalogIdsByCode.get(entry.code);
    if (group) group.push(entry.id);
    else catalogIdsByCode.set(entry.code, [entry.id]);
  }
  // An alias that still has a chip of its own keeps its expenses -- absorbing it into the
  // canonical chip too would make the same expense answer to two chips. Only orphans get adopted.
  const offeredIds = new Set(offered.map((category) => category.id));

  const chips = offered.map((category): RecordsCategoryChip => {
    const name = category.name.trim();
    const matchIds = new Set<string>([category.id]);
    for (const id of idsByName.get(name) ?? []) matchIds.add(id);
    for (const id of catalogIdsByCode.get(category.code ?? "") ?? []) {
      if (!offeredIds.has(id)) matchIds.add(id);
    }
    return { id: category.id, label: name, matchIds: [...matchIds] };
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
 * HOME-124: "YYYY-MM-DD"(서버 toExpenseDto의 date-only 포맷) → "8월 4일".
 *
 * 원래 app/(tabs)/records.tsx 안의 파일 지역 함수였는데, 홈의 "최근 지출" 행(app/(tabs)/index.tsx)이
 * 이 함수를 쓰지 못해 `subtitle={expense.spentOn}`으로 **ISO 원본("2026-08-27")을 그대로** 그리고
 * 있었다. 같은 지출이 홈에서는 "2026-08-27", 기록 탭에서는 "8월 27일"로 보이던 불일치를 없애려고
 * 이 모듈로 승격했다(두 화면의 단일 소스).
 *
 * 파싱할 수 없는 값은 **그대로 돌려준다**. 비세션 픽셀락 미리보기(previewHome)의 고정 픽스처는
 * 날짜가 아니라 이미 사람이 읽는 문자열("오늘", "05.20")이므로, 이 통과 규칙 덕분에 HOME-001
 * 캡처가 한 글자도 바뀌지 않는다. `Number()`가 NaN을 내는 값("2026-ab-cd")도 "NaN월 NaN일" 대신
 * 원본을 보여준다 -- 허위 표시보다 원본이 정직하다.
 */
export function formatSpentOn(spentOn: string): string {
  const parts = spentOn.split("-");
  if (parts.length !== 3) return spentOn;
  const month = Number(parts[1]);
  const day = Number(parts[2]);
  if (!Number.isInteger(month) || !Number.isInteger(day)) return spentOn;
  return `${month}월 ${day}일`;
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

/**
 * HOME-124: 홈 "최근 지출" 행의 부제 -- "[선물|환불 ·] 8월 27일".
 *
 * 홈은 `GET /home` 응답만 읽고 `["categories"]` 캐시를 구독하지 않으므로(그러려고 요청을 하나
 * 더 붙이면 홈 첫 화면 비용이 늘어난다) 카테고리 라벨 없이 같은 규칙을 쓴다. 구분 접두사는
 * **새 규칙을 만들지 않고** 위의 `recordsRowSubtitle`에 그대로 위임한다 -- 선물/환불 표기가
 * 두 화면에서 갈리면 그 자체가 DNC-015(선물 제외) 표시의 신뢰를 깎는다. 카테고리 라벨을 넘기지
 * 않으면 "선물 · 8월 27일" / "8월 27일"이 되어 기록 탭 행에서 카테고리만 빠진 형태가 된다.
 */
export function homeRecentExpenseSubtitle(expense: { expenseType?: string | null; spentOn: string }): string {
  return recordsRowSubtitle({ expenseType: expense.expenseType, dateLabel: formatSpentOn(expense.spentOn) });
}
