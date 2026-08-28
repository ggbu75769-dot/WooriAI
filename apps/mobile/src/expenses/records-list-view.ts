import { categoryCatalog, categoryNameFor, selectableCategories, type SelectableCategory } from "../categories";
import { EXPENSE_VIEW_ONLY_EMPTY_TITLE } from "../family/record-permissions";
import { formatKrw } from "../money";

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
  /** 칩에 그려지는 한국어 라벨. */
  label: string;
  /**
   * 라운드 34 L7: 문장에 넣는 **순수 이름**(F8 스코프 줄 · 달력 범례).
   *
   * 이 필드가 생긴 이유는 당시 폴백 칩(서버 목록이 없을 때 쓰는 8타일)의 라벨에 아이콘
   * 이모지가 붙어 있었기 때문이다("🧷 기저귀"). 그 라벨이 그대로 문장으로 흘러가면
   * 스크린리더가 이모지 이름("반창고")을 카테고리 이름처럼 읽었다.
   *
   * D1 후속(실기기 피드백 2)으로 8타일의 `icon`이 텍스트 글리프에서 Ionicons **이름**이
   * 되면서, 폴백 칩도 이름만 쓴다 -- 지금은 두 필드의 값이 언제나 같다. 그래도 필드를
   * 유지하는 이유는 "표시용 라벨"과 "문장용 이름"이 개념상 다른 값이고, 다시 갈라질 때
   * (아이콘 접두를 되살리는 등) 문장 쪽이 조용히 오염되지 않게 하기 위해서다.
   */
  plainLabel: string;
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
    // D1 후속(실기기 피드백 2): 카탈로그의 `icon`은 더 이상 텍스트 글리프가 아니라 Ionicons
    // **이름**("water-outline" …)이라, 예전처럼 라벨 앞에 붙이면 칩에 "water-outline 기저귀"가
    // 적힌다. 칩은 CategoryChip의 문자열 라벨이므로 아이콘을 그릴 자리가 없고, 서버 목록이
    // 있는 아래 정상 경로도 이미 이름만 쓴다(line: `label: name`) -- 폴백만 글리프를 달고
    // 있던 불일치가 사라진다.
    return categoryCatalog.map((entry) => ({
      id: entry.id,
      label: entry.label,
      // L7: 문장에 들어가는 것은 아이콘 없는 이름이다.
      plainLabel: entry.label,
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
    return { id: category.id, label: name, plainLabel: name, matchIds: [...matchIds] };
  });

  if (selectedCategoryId && !chips.some((chip) => chip.matchIds.includes(selectedCategoryId))) {
    const fallbackName = categoryNameFor(selectedCategoryId);
    chips.unshift({
      id: selectedCategoryId,
      label: fallbackName,
      plainLabel: fallbackName,
      matchIds: [selectedCategoryId]
    });
  }

  return chips;
}

/**
 * F8: 기록 탭 상단 요약의 **스코프 줄** — 카테고리 칩/검색이 걸렸을 때만 나타난다.
 *
 * 왜 필요한가: UX-B가 날짜 그룹 헤더에 **일별 소계**를 그리면서, 화면 위쪽의 월 요약 줄
 * ("이번 달 42건 · 합계 1,200,000원")과 아래 소계들이 한 화면에서 직접 검산 가능해졌다. 그런데
 * 두 숫자의 모집단이 다르다 — 월 요약은 **필터와 무관한 그 달 전체**(reconcileMonthlyExpenses의
 * monthlyTotalKrw)이고, 일별 소계는 **화면에 실제로 보이는 행**(카테고리 칩·검색이 걸린 listData)의
 * 합이다. 필터를 켜면 "42건 · 1,200,000원"이라고 적힌 화면에서 소계를 다 더해도 180,000원밖에
 * 안 나오는, 스스로 어긋나 보이는 상태가 된다.
 *
 * 고치는 방향은 **월 합계를 필터에 맞춰 줄이는 것이 아니다**(그러면 "이번 달 얼마 썼나"라는
 * 화면의 핵심 숫자가 칩 하나에 흔들린다). 대신 **필터가 켜졌을 때만** 그 아래에 필터 스코프의
 * 건수·합계를 한 줄 더 적어, 위 숫자가 무엇의 합이고 아래 소계들이 무엇의 합인지 화면이 직접
 * 말하게 한다. 필터가 없으면 `null`을 돌려주므로 기존 화면은 한 글자도 바뀌지 않는다.
 *
 * 합계는 **새로 계산하지 않는다**: 화면이 날짜 그룹(records-date-groups.ts)의 `subtotalKrw`를
 * 그대로 더해 넘긴다. 그래서 이 줄의 금액은 정의상 "화면에 보이는 일별 소계의 합"이고,
 * 선물·환불 제외 기준(DNC-015 `countsTowardMonthlyTotal`)도 소계·월 합계와 같은 한 술어에서 나온다.
 * 건수는 월 요약 줄과 같은 관례로 **보이는 행 전부**를 센다(소계에서 빠지는 선물·환불 행도 목록에는
 * 그대로 보이므로 건수에서까지 지우면 그게 또 다른 불일치가 된다).
 */
export type RecordsFilterScopeSummary = {
  /** 스코프 이름만 — "기저귀/위생 필터", "검색 결과", "기저귀/위생 필터 · 검색 결과". */
  scopeLabel: string;
  /** 화면에 그대로 그리는 한 줄. */
  text: string;
  /** TalkBack 라벨("·" 대신 쉼표, 금액에 "합계"를 붙인다). */
  accessibilityLabel: string;
  recordCount: number;
  totalKrw: number;
};

function nonNegativeInteger(value: number): number {
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

export function buildRecordsFilterScopeSummary(input: {
  /** 선택된 카테고리 칩의 라벨. 칩을 찾지 못했으면 null/빈 문자열이어도 된다. */
  categoryLabel?: string | null;
  /**
   * 카테고리 필터가 걸려 있는지. 라벨을 해석하지 못한 경우(칩 목록 폴백 중 선택 등)와
   * "필터 없음"을 구분하기 위해 별도로 받는다. 생략하면 라벨 유무로 판단한다.
   */
  categoryFiltered?: boolean;
  /** 검색어 원본(트림 전). */
  searchText?: string | null;
  /** 필터가 걸린 목록의 행 수(선물·환불 포함 — 위 doc comment 참고). */
  recordCount: number;
  /** 그 목록의 일별 소계 합. */
  totalKrw: number;
}): RecordsFilterScopeSummary | null {
  const categoryLabel = input.categoryLabel?.trim() ?? "";
  const categoryFiltered = input.categoryFiltered ?? categoryLabel.length > 0;
  const searchQuery = input.searchText?.trim() ?? "";
  // 전체(무필터)에서는 아무것도 만들지 않는다 — 기존 요약 줄만 남는다.
  if (!categoryFiltered && searchQuery.length === 0) return null;

  const scopeParts: string[] = [];
  // 이름을 못 찾았다고 그럴듯한 카테고리 이름을 지어내지 않는다(허위 표시 금지) — 그때는
  // 필터가 걸렸다는 사실만 말한다.
  if (categoryFiltered) scopeParts.push(categoryLabel.length > 0 ? `${categoryLabel} 필터` : "카테고리 필터");
  if (searchQuery.length > 0) scopeParts.push("검색 결과");
  const scopeLabel = scopeParts.join(" · ");

  const recordCount = nonNegativeInteger(input.recordCount);
  const totalKrw = nonNegativeInteger(input.totalKrw);
  const amountText = formatKrw(totalKrw);
  return {
    scopeLabel,
    text: `${scopeLabel}: ${recordCount}건 · ${amountText}`,
    accessibilityLabel: `${scopeLabel}, ${recordCount}건, 합계 ${amountText}`,
    recordCount,
    totalKrw
  };
}

/**
 * 라운드 39 UX-P: 기록 탭 상단 **월 요약 줄** — "2026년 8월 42건 · 합계 1,200,000원".
 *
 * 무엇이 문제였나: 이 줄은 달을 옮겨도 늘 "이번 달 N건 · 합계 …"라고 적혀 있었다. 화면 바로
 * 위 월 이동 라벨은 "2026년 6월"인데 그 아래 줄은 "이번 달"이라고 말하니, 같은 화면 안에서
 * 두 문장이 서로 다른 달을 가리켰다. 아래 합계 카드는 진작부터 `{recordsMonthLabel} 합계`였으므로
 * 표기가 셋으로 갈려 있던 셈이다(DNC-018 톤 일관성, 허위 표시 금지).
 *
 * 고치는 방향은 **화면이 이미 들고 있는 달 라벨을 그대로 쓰는 것**이다 — 새 날짜 계산을
 * 하지 않으므로 라벨이 어긋날 여지 자체가 없다(월 이동 라벨·합계 카드·이 줄이 한 문자열).
 * 이번 달을 보고 있으면 "2026년 8월 …"이 되어 종전의 "이번 달 …"보다 오히려 더 명확하다.
 *
 * 접근성 라벨은 F8 스코프 줄·날짜 섹션 헤더와 같은 관례다 — "·"를 쉼표로 풀고 금액 앞에
 * "합계"를 붙인다.
 */
export function buildRecordsMonthSummary(input: {
  monthLabel: string;
  /** 그 달의 행 수(선물·환불 포함 — 위 스코프 줄과 같은 관례). */
  recordCount: number;
  /** 그 달의 합계(DNC-015 countsTowardMonthlyTotal 기준). */
  totalKrw: number;
}): { text: string; accessibilityLabel: string } {
  const monthLabel = input.monthLabel.trim();
  const recordCount = nonNegativeInteger(input.recordCount);
  const amountText = formatKrw(nonNegativeInteger(input.totalKrw));
  // 라벨을 모르면 없는 달 이름을 지어내지 않는다 — 건수·합계만 말한다(허위 표시보다 생략).
  const prefix = monthLabel.length > 0 ? `${monthLabel} ` : "";
  return {
    text: `${prefix}${recordCount}건 · 합계 ${amountText}`,
    accessibilityLabel: `${prefix}${recordCount}건, 합계 ${amountText}`
  };
}

/**
 * 라운드 39 UX-P: 기록 탭 검색의 **범위 고지** 한 줄.
 *
 * 무엇이 문제였나: 이 화면의 검색은 `["expenses", childId, recordsYearMonth]` — 즉 **보고 있는
 * 한 달치 응답**에만 걸린다. 그런데 화면 어디에도 그 사실이 없어서, "유모차"를 검색해 0건이
 * 나오면 사용자는 "이 앱에 유모차 기록이 없다"고 읽는다. 실제로는 지난달에 적어 뒀을 뿐이다.
 *
 * 그래서 **검색어가 있을 때만** 요약 줄 아래 한 줄로 범위를 밝힌다. 검색을 하지 않는 동안에는
 * `null`이라 화면이 한 글자도 바뀌지 않는다(F8 스코프 줄과 같은 규칙).
 *
 * GAP-054 D#8 — 범위는 **두 가지**다: 어느 달인가(위)와 **어느 필드인가**. 예전에는 필드 범위를
 * placeholder("품목명, 메모로 검색")만 말했고, 그 문구는 판매처가 검색 대상이 된 뒤로는 사실도
 * 아니게 됐다. 이제 이 줄이 두 범위를 함께 말하고(`RECORDS_SEARCH_FIELDS_LABEL`),
 * placeholder는 같은 필드 목록을 같은 순서로 적는다 — 0건이 나왔을 때 "달이 달라서인지,
 * 훑지 않는 곳에 적어 둬서인지"를 한 문장 안에서 가릴 수 있다.
 *
 * 검색어를 문장에 그대로 싣는 이유: 무엇을 어디에서 찾았는지가 한 문장에 다 있어야 0건 카드의
 * "지난달에서 찾기"가 무슨 뜻인지 따로 설명하지 않아도 된다. 검색어는 사용자가 방금 친 값이고
 * 화면(검색창)에 이미 그대로 보이므로 새로 노출되는 정보가 없다.
 */
export function buildRecordsSearchScopeNotice(input: {
  /** 검색어 원본(트림 전). */
  searchText?: string | null;
  /** 보고 있는 달의 라벨 — 화면의 월 이동 라벨과 **같은 문자열**을 넘긴다. */
  monthLabel: string;
}): string | null {
  const query = input.searchText?.trim() ?? "";
  const monthLabel = input.monthLabel.trim();
  // 검색 중이 아니거나 달 라벨을 모르면 아무 말도 하지 않는다 — 범위를 반만 말하면
  // "어디에서만"이 빠져 고지의 의미가 없다.
  if (query.length === 0 || monthLabel.length === 0) return null;
  return `'${query}' 검색은 ${monthLabel}의 ${RECORDS_SEARCH_FIELDS_LABEL}에서만 찾아요`;
}

/** 0건 카드에서 검색어를 유지한 채 이전 달로 넘어가는 보조 액션의 라벨. */
export const RECORDS_SEARCH_PREVIOUS_MONTH_ACTION_LABEL = "지난달에서 찾기";

/**
 * 스코프 줄(F8)과 **같은 관례**로 만든 카테고리 필터 이름 — 이름을 못 찾으면 지어내지 않고
 * "카테고리 필터"라고만 말한다. 필터가 없으면 null이라 문장에서 통째로 빠진다.
 */
function categoryFilterName(input: { categoryFiltered?: boolean; categoryLabel?: string | null }): string | null {
  const label = input.categoryLabel?.trim() ?? "";
  const filtered = input.categoryFiltered ?? label.length > 0;
  if (!filtered) return null;
  return label.length > 0 ? `${label} 필터` : "카테고리 필터";
}

/**
 * 라운드 39 UX-P: 검색 0건 카드의 **보조 액션**.
 *
 * 기존 0건 카드의 유일한 액션은 "검색어 지우기"였다 — 즉 앱이 제안하는 유일한 다음 행동이
 * "찾기를 포기하는 것"이었다. 정작 사용자가 하려던 일(그 물건을 언제 샀는지 찾기)은 대개 한 달
 * 뒤에 있고, 그 이동은 이미 화면에 있는 ‹ 버튼 하나다. 그래서 같은 이동을 카드 안에서 바로
 * 제안한다 — **검색어는 건드리지 않으므로**(달만 바뀐다) 넘어간 달에서 같은 검색이 이어진다.
 *
 * 라벨은 상대 표현("지난달")이고 접근성 라벨은 **실제 달 이름**을 말한다: 버튼 자리가 좁아
 * 짧은 쪽이 읽기 쉽지만, 스크린리더에서는 지금 보고 있는 달이 무엇인지 모른 채 듣게 되므로
 * "2026년 7월에서 '유모차' 계속 찾기"가 되어야 어디로 가는지가 문장 안에 있다.
 *
 * 라운드 39 I-4 — **카테고리 필터가 함께 걸려 있으면 그 사실도 말한다**: 이 이동은 검색어만
 * 유지하는 것이 아니라 화면의 필터 상태를 통째로 들고 간다. 칩이 걸린 채로 "2026년 7월에서
 * '유모차' 계속 찾기"라고만 읽어 주면, 넘어간 달에서 0건이 나왔을 때 그것이 "그 달에 유모차
 * 기록이 없다"로 들린다 — 실제로는 그 카테고리 안에서만 없는 것이다. 그래서 필터가 켜져 있으면
 * 라벨 끝에 "(기저귀/위생 필터 유지)"를 덧붙인다(보이는 라벨은 자리가 좁아 그대로 둔다).
 */
export function buildRecordsSearchPreviousMonthAction(input: {
  /** 검색어 원본(트림 전). 비어 있으면 이 액션 자체가 없다. */
  searchText?: string | null;
  /** 이동해 갈 달의 라벨(현재 달의 한 달 전) — 화면이 월 이동에 쓰는 것과 같은 계산에서 온다. */
  previousMonthLabel: string;
  /** 카테고리 칩이 걸려 있는지(스코프 줄과 같은 관례로 라벨과 따로 받는다). */
  categoryFiltered?: boolean;
  /** 그 칩의 이모지 없는 이름. 모르면 이름 없이 "카테고리 필터"라고만 말한다. */
  categoryLabel?: string | null;
}): { label: string; accessibilityLabel: string } | null {
  const query = input.searchText?.trim() ?? "";
  if (query.length === 0) return null;
  const monthLabel = input.previousMonthLabel.trim();
  const filterName = categoryFilterName(input);
  const filterSuffix = filterName ? `(${filterName} 유지)` : "";
  return {
    label: RECORDS_SEARCH_PREVIOUS_MONTH_ACTION_LABEL,
    // 달 이름을 모르면 지어내지 않고 보이는 라벨을 그대로 읽어준다(필터 고지는 그때도 붙인다).
    accessibilityLabel:
      monthLabel.length > 0
        ? `${monthLabel}에서 '${query}' 계속 찾기${filterSuffix}`
        : `${RECORDS_SEARCH_PREVIOUS_MONTH_ACTION_LABEL}${filterSuffix}`
  };
}

/** 필터/검색 0건 카드가 제안하는 다음 행동 — 화면은 이 키로 어느 필터를 풀지 정한다. */
export type RecordsEmptyFilterAction = "clear-category" | "clear-search";

export type RecordsFilteredEmptyState = {
  /** 0건 카드 제목. */
  title: string;
  /** 기본 액션 버튼 라벨. */
  actionLabel: string;
  /** 그 버튼이 실제로 하는 일. */
  action: RecordsEmptyFilterAction;
};

/**
 * 라운드 39 I-4 — 카테고리 칩과 검색이 **함께** 걸린 0건 카드.
 *
 * 무엇이 문제였나: 화면은 둘 중 하나만 걸린 것처럼 말했다. 칩이 걸려 있으면 제목이 무조건
 * "이 카테고리의 기록이 없어요"였고(검색어를 친 사실이 사라진다), 그 아래 보조 액션은
 * "지난달에서 찾기"라 검색 프레이밍으로 말했다 — 한 카드 안에서 두 문장이 서로 다른 이야기를
 * 했다. 반대로 검색만 걸린 것처럼 "검색 결과가 없어요"라고만 말하면, 칩 때문에 가려진 기록을
 * "이 앱에 없다"로 읽게 된다.
 *
 * 규칙:
 *  - 검색어가 있으면 **검색 프레이밍이 우선**이고, 무엇을 찾았는지 제목에 그대로 싣는다
 *    ("'유모차' 검색 결과가 없어요."). 검색어는 사용자가 방금 친 값이라 새로 노출되는 정보가 없다.
 *  - 카테고리 칩이 함께 걸려 있으면 **그 필터를 푸는 것**을 기본 액션으로 제안하고, 라벨에
 *    필터 이름을 적어 지금 무엇이 걸려 있는지 카드 안에서 말하게 한다("기저귀/위생 필터 해제").
 *    검색어를 지우는 것보다 범위를 넓히는 쪽이 사용자가 하려던 일(그 물건 찾기)에 가깝다.
 *  - 둘 다 없으면 null — 그 달에 기록이 없다는 뜻이라 화면이 다른 카드를 그린다.
 */
export function buildRecordsFilteredEmptyState(input: {
  searchText?: string | null;
  categoryFiltered?: boolean;
  categoryLabel?: string | null;
}): RecordsFilteredEmptyState | null {
  const query = input.searchText?.trim() ?? "";
  const filterName = categoryFilterName(input);

  if (filterName) {
    return {
      title: query.length > 0 ? `'${query}' 검색 결과가 없어요.` : "이 카테고리의 기록이 없어요.",
      actionLabel: `${filterName} 해제`,
      action: "clear-category"
    };
  }
  if (query.length === 0) return null;
  return { title: `'${query}' 검색 결과가 없어요.`, actionLabel: "검색어 지우기", action: "clear-search" };
}

/**
 * 라운드 39 I-5 — 그 달에 기록이 하나도 없을 때의 카드 제목.
 *
 * 종전 문구는 어느 달을 보고 있든 "첫 기록을 남기면 **이번 달** 비용을 바로 보여드릴게요."였다.
 * 기록 탭은 ‹ ›로 달을 옮기는 화면이라, 6월을 보면서 "이번 달"을 안내받으면 그 문장이 가리키는
 * 달이 화면의 월 라벨·합계 카드와 갈린다(라운드 39 UX-P가 월 요약 줄에서 이미 고친 것과 같은
 * 종류의 어긋남이다).
 *
 * 현재 달에서는 "이번 달"이 가장 자연스럽고 홈 화면의 같은 카드와도 한 글자도 다르지 않다
 * (refresh-wiring-contract.test.ts가 두 화면의 문구 일치를 고정한다 — 홈은 언제나 현재 달이다).
 * 과거 달을 보고 있을 때만 그 달의 이름을 쓴다.
 *
 * 라운드 40 J-5 — 보기 전용 세션에서는 이 문장이 **약속**이 된다("첫 기록을 남기면 …"의 조건을
 * 이 사람은 만족시킬 수 없다). 그때는 홈의 빈 카드와 같은 사실 한 줄로 바꾼다(문구는
 * src/family/record-permissions.ts가 단일 소스). 잠금은 실세션 + 알려진 보기 전용 역할에서만
 * 참이므로 기본값(false)에서는 한 글자도 바뀌지 않는다.
 */
export function buildRecordsEmptyMonthTitle(input: {
  monthLabel: string;
  isCurrentMonth: boolean;
  expenseEntryLocked?: boolean;
}): string {
  if (input.expenseEntryLocked) return EXPENSE_VIEW_ONLY_EMPTY_TITLE;
  const monthLabel = input.monthLabel.trim();
  // 달 이름을 모르면 지어내지 않고 종전 문구를 쓴다.
  const monthPart = input.isCurrentMonth || monthLabel.length === 0 ? "이번 달" : monthLabel;
  return `첫 기록을 남기면 ${monthPart} 비용을 바로 보여드릴게요.`;
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
 * FAM-127 공동 기록 작성자 표기: 지출 행/상세에 "누가 기록했는지"를 붙일지 정한다.
 *
 * 왜 모듈인가: 서버 `toExpenseDto`는 진작부터 `createdByUserId`를 내려주고 있었는데(apps/api/
 * src/onboarding/store-shared.ts) 모바일에는 이 값을 읽는 곳이 하나도 없었다. 그래서 부모 둘이
 * 같은 가구를 쓰면 기록 탭에서 내가 적은 기저귀와 배우자가 적은 기저귀가 **완전히 같은 행**으로
 * 보였고, "이거 자기가 적은 거야?"를 앱 밖에서 물어야 했다.
 *
 * 의도적 규칙 -- 라벨은 **가구 구성원이 2명 이상일 때만** 나타난다. 1인 가구에서는 모든 행에
 * 내 이름이 똑같이 붙을 뿐이라 정보가 아니라 소음이고, 1인 가구의 픽셀·문구가 한 글자도
 * 바뀌지 않아야 한다(R20-C 알림함 다자녀 라벨 `resolveNotificationChildLabel`과 같은 판단).
 *
 * 내가 적은 행도 **똑같이** 이름을 붙인다. 내 행만 비워 두면 "라벨 없음"이 '나'와 '이름을 못
 * 찾음' 두 가지를 동시에 뜻하게 되어, 오히려 읽는 사람이 추측을 해야 한다.
 *
 * 이름을 풀지 못하면 행을 이 기능이 없던 때와 **정확히 같게** 남긴다 -- "· " 빈 접두도, "가족"
 * 같은 자리표시자도 만들지 않는다(앱의 허위/빈 표시 금지 관례).
 */

/** `HouseholdMember`(src/api/client.ts)에서 이 모듈이 필요로 하는 구조적 최소치. */
export type ExpenseAuthorRef = {
  userId: string;
  displayName: string;
  /**
   * 구성원 상태. `GET /households/:id/members`는 **`active`와 `pending`을 함께** 내려준다
   * (household-runtime.service.ts listMembers) -- 아직 초대를 수락하지 않은 사람도 목록에 있다.
   * 아래 "2명 이상" 판정은 `active`만 센다: 초대만 보내 두고 상대가 수락하지 않은 1인 가구에서
   * 갑자기 모든 행에 내 이름이 붙는 것을 막기 위해서다(수락 전에는 그 사람이 기록을 남길 수도
   * 없으므로 세어야 할 이유도 없다). 값이 없으면 active로 본다(로컬 목업/구버전 호환).
   */
  status?: string | null;
};

/**
 * 서버가 내려주는 `createdByUserId`를 타입 안전하게 꺼낸다.
 *
 * 모바일의 `Expense` 타입(src/api/client.ts)은 서버 DTO의 **수기 미러**라서 이 필드가 아직
 * 선언돼 있지 않다. 응답에는 실제로 들어 있으므로, 타입에 없는 필드를 캐스팅으로 읽는 대신
 * 여기서 한 번만 방어적으로 좁힌다 -- 값이 없거나(구버전 서버·로컬 목업·오프라인 대기 행)
 * 문자열이 아니면 `undefined`가 되어 아래 해석이 조용히 라벨을 생략한다.
 */
export function expenseCreatedByUserId(expense: unknown): string | undefined {
  if (!expense || typeof expense !== "object") return undefined;
  const value = (expense as { createdByUserId?: unknown }).createdByUserId;
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

/** `Child`(src/api/client.ts)에서 이 모듈이 필요로 하는 구조적 최소치. */
export type ChildHouseholdRef = {
  id: string;
  householdId?: string | null;
};

/**
 * 라운드 27 L-4: 작성자 라벨을 물어볼 **가구**를 고른다.
 *
 * 왜 필요한가: 기록 탭과 지출 상세는 구성원 목록을 세션의 `defaultHouseholdId`로 불러왔는데,
 * 화면에 보이는 지출은 **선택된 아이**의 것이다. 두 가구에 속한 계정(예: 본가구 2인 + 배우자
 * 쪽 가구 1인)에서는 두 값이 갈려서, 1인 가구 아이의 기록 행에 엉뚱한 라벨이 붙거나(기본 가구가
 * 2인) 2인 가구 아이의 라벨이 통째로 사라졌다(기본 가구가 1인). `resolveExpenseAuthorLabel`의
 * "2명 이상일 때만" 판정 자체가 잘못된 가구 위에서 돌던 셈이다.
 *
 * 규칙 -- **모르면 추측하지 않는다**:
 *  - 고른 아이가 없으면 `null` (표시 대상 자체가 없다);
 *  - `["children"]` 캐시가 아직 없으면(로딩·실패) `null`. 여기서 `defaultHouseholdId`로 폴백하면
 *    다가구 계정에서 잠깐이나마 **틀린 가구의 라벨**이 그려진다. 라벨은 없어도 화면이 예전과
 *    같지만(FAM-127), 틀린 라벨은 허위 표시다;
 *  - 목록에 그 아이가 없어도 `null` (같은 이유);
 *  - 아이를 찾았는데 `householdId`가 비어 있으면(MOB-118 이전 캐시·구버전 목업) 그때만
 *    `fallbackHouseholdId`를 쓴다.
 *
 * 1가구 계정에서는 아이의 `householdId`가 곧 `defaultHouseholdId`라 결과가 예전과 같다.
 */
export function resolveExpenseHouseholdId(input: {
  children: readonly ChildHouseholdRef[] | null | undefined;
  childId: string | null | undefined;
  fallbackHouseholdId?: string | null;
}): string | null {
  const { children, childId, fallbackHouseholdId = null } = input;
  if (!childId || !children) return null;
  const child = children.find((candidate) => candidate?.id === childId);
  if (!child) return null;
  const householdId = child.householdId?.trim();
  return householdId ? householdId : fallbackHouseholdId;
}

/**
 * 행에 표시할 작성자 이름, 또는 표시하지 않을 때 `null`.
 *
 * @param createdByUserId `expenseCreatedByUserId`가 꺼낸 값.
 * @param members         `["household-members", householdId]` 캐시의 구성원 목록. 로딩 중이거나
 *                        비활성(로그아웃·미리보기)이면 `undefined`.
 */
export function resolveExpenseAuthorLabel(
  createdByUserId: string | undefined,
  members: readonly ExpenseAuthorRef[] | undefined
): string | null {
  if (!members) return null;
  // 초대 수락 전(pending) 구성원은 세지 않는다 -- 위 ExpenseAuthorRef.status 주석 참고.
  const joined = members.filter((member) => (member.status ?? "active") === "active");
  // 1인 가구(또는 아직 구성원 수를 모름): 모든 행에 같은 이름이 붙을 뿐이다.
  if (joined.length < 2) return null;
  if (!createdByUserId) return null;
  const match = joined.find((member) => member.userId === createdByUserId);
  if (!match) return null;
  const displayName = match.displayName.trim();
  return displayName.length > 0 ? displayName : null;
}

/**
 * 지출 구분(`Expense.expenseType`)의 한국어 라벨 -- 기록 행 부제와 CSV '구분' 열의 단일 소스.
 *
 * CSV-127로 내보내기가 같은 구분을 열로 갖게 되면서 생겼다. 화면과 파일이 같은 단어를 쓰지
 * 않으면 사용자가 앱에서 "선물"로 본 행이 엑셀에서는 다른 이름으로 보이게 되고, 그건
 * DNC-015(선물은 합계에서 제외) 표시의 신뢰를 그대로 깎는다.
 */
const EXPENSE_TYPE_LABELS_KO = { expense: "지출", gift: "선물", refund: "환불" } as const;

/**
 * CSV '구분' 열용 라벨: 일반 지출도 **명시적으로** "지출"이 된다(열은 비어 있으면 안 된다).
 *
 * 모르는 값은 `sourceLabelKo`와 같은 관례로 **원본을 그대로 통과**시킨다 -- 서버가 나중에
 * 구분을 하나 더 늘렸을 때 그것을 "지출"로 둔갑시키는 것이 빈 칸보다 나쁘다. 값이 아예 없으면
 * 빈 칸으로 둔다(없는 구분을 지어내지 않는다).
 */
export function expenseTypeLabelKo(expenseType?: string | null): string {
  if (!expenseType) return "";
  return EXPENSE_TYPE_LABELS_KO[expenseType as keyof typeof EXPENSE_TYPE_LABELS_KO] ?? expenseType;
}

/**
 * 기록/홈 행 부제의 구분 접두사, 또는 접두사를 붙이지 않을 때 `null`.
 *
 * 목록 행에서는 기본값 "지출"에 접두를 붙이지 않는다 -- 거의 모든 행에 같은 단어가 붙으면
 * 정보가 아니라 소음이고, 눈에 띄어야 하는 선물/환불이 오히려 묻힌다(R20-C 다자녀 라벨이
 * "2명 이상일 때만" 붙는 것과 같은 판단). CSV는 열이 비면 안 되므로 위 `expenseTypeLabelKo`를
 * 쓴다 -- 두 규칙의 차이는 여기 한 곳에만 있다.
 */
export function expenseTypeSubtitlePrefix(expenseType?: string | null): string | null {
  if (expenseType === "gift" || expenseType === "refund") return EXPENSE_TYPE_LABELS_KO[expenseType];
  return null;
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
 *
 * FAM-127: `authorLabel` (공동 기록 작성자) is an OPTIONAL addition -- omitting it produces the
 * exact string this function produced before, which is what keeps the 홈 화면 caller
 * (`homeRecentExpenseSubtitle`, and through it app/(tabs)/index.tsx) working untouched.
 *
 * Token order is 구분 → 작성자 → 카테고리 → 날짜, i.e. the author slots in AFTER the
 * 선물/환불 prefix rather than in front of it. 구분 keeps the leading slot it already owned, so a
 * 1인 가구(작성자 미표시)·선물 행은 예전과 한 글자도 다르지 않다.
 */
export function recordsRowSubtitle(input: {
  expenseType?: string | null;
  authorLabel?: string | null;
  categoryLabel?: string | null;
  dateLabel: string;
  /**
   * 라운드 41 UX-T(C) → GAP-054 D#8: 행 제목(품목명)에는 없는 곳에서 검색어가 맞았을 때 붙는
   * 근거 조각(`matchRecordSearch(...).snippet` -- 메모·판매처·경계 걸침).
   *
   * 이름이 `memoSnippet`이 아닌 이유: D#8이 판매처 갈래를 더하면서 이 자리에 "판매처 쿠팡"도
   * 들어온다. 필드 이름이 메모라고 말하는데 판매처가 담기면, 이 파일이 다른 자리에서 지키는
   * 규칙(라벨은 실제 출처를 말한다)을 필드 이름이 먼저 어긴다.
   *
   * 검색 중이 아니거나 품목명이 이미 맞은 행에서는 null이고, 그때 부제는 이 기능이 없던 때와
   * **한 글자도 다르지 않다** -- 기존 호출부(홈 `homeRecentExpenseSubtitle` 포함)는 이 필드를
   * 넘기지 않으므로 그대로다.
   */
  searchSnippet?: string | null;
}): string {
  const parts: string[] = [];
  const typePrefix = expenseTypeSubtitlePrefix(input.expenseType);
  if (typePrefix) parts.push(typePrefix);
  const authorLabel = input.authorLabel?.trim();
  if (authorLabel) parts.push(authorLabel);
  const categoryLabel = input.categoryLabel?.trim();
  if (categoryLabel) parts.push(categoryLabel);
  parts.push(input.dateLabel);
  // 스니펫은 **맨 끝**이다: 앞쪽 토큰(구분·작성자·카테고리·날짜)의 자리가 검색 여부에 따라
  // 움직이면 같은 행이 검색 중에만 다르게 읽힌다.
  const searchSnippet = input.searchSnippet?.trim();
  if (searchSnippet) parts.push(searchSnippet);
  return parts.join(" · ");
}

/**
 * 라운드 41 UX-T(C) → K-12: 기록 탭 검색의 **판정과 근거 조각을 한 함수**로 낸다.
 *
 * 무엇이 문제였나 — 기록 탭 검색은 품목명과 **메모**를 함께 훑고(placeholder도 그렇게
 * 약속한다) 행에 그려지는 것은 품목명 + "카테고리 · 날짜"뿐이라, "조리원"으로 검색해
 * 3건이 나와도 **화면 어디에도 '조리원'이 없다**. 그래서 UX-T(C)가 메모에서만 맞은 행에 근거
 * 조각을 붙였다.
 *
 * 그런데 그때 **판정이 두 벌**이었다. 화면의 필터는 `${itemName} ${memo}` 연결 문자열 하나를
 * 훑고(app/(tabs)/records.tsx), 조각은 품목명·메모를 따로 봤다. 두 규칙은 대부분 같은 답을
 * 내지만 **경계에 걸친 검색어**에서 갈린다: 품목명 "기저귀" + 메모 "조리원"인 행은 연결
 * 문자열이 "기저귀 조리원"이라 "귀 조"로 검색하면 필터를 통과하는데, 조각 쪽은 품목명에도
 * 메모에도 그 글자가 없어 null이었다 — 근거 없는 결과가 정확히 그 자리에서 되살아났다.
 *
 * 그래서 K-12는 판정을 **한 곳으로 합치고 명시적으로 분해**한다:
 *   품목명 매치 | 메모 매치 | 경계 걸침 매치 — 셋 중 하나면 결과에 남고, 각 갈래가 자기 근거를
 *   함께 낸다. 필터가 통과시키는데 조각이 설명하지 못하는 조합이 정의상 존재하지 않는다.
 *
 * 갈래별 근거:
 *  - **품목명 매치**: 조각 없음. 행 제목이 곧 근거라, 같은 사실을 두 번 말하면서 부제만 길어진다
 *    (선물/작성자 라벨이 "정보가 아니라 소음일 때는 빠진다"는 이 파일의 다른 규칙과 같은 판단).
 *  - **메모 매치**: "메모 …조리원 2주 이용료…". 메모 전체를 싣지 않는다 -- 긴 메모를 그대로
 *    부제에 넣으면 행 높이가 들쭉날쭉해지고(PERF-102 가상화가 싫어하는 모양) 정작 검색어가 잘려
 *    나갈 수 있어서, **검색어 주변만** 잘라내고 잘린 쪽에 말줄임표를 붙인다.
 *  - **경계 걸침 매치**: 검색어가 품목명 끝과 메모 앞에 나뉘어 있으므로 메모의 어느 조각도
 *    검색어를 품지 못한다. 그 자리에 검색어가 든 척하는 조각을 놓으면 그것이야말로 허위 표시라,
 *    **왜 걸렸는지를 사실로 말하고**(품목명과 메모에 걸쳐 일치) 사용자가 볼 수 없던 나머지 절반,
 *    즉 메모 앞부분을 함께 준다.
 *
 * 검색어가 없으면 모든 행이 남고 조각은 항상 null이다 -- 검색하지 않는 동안 화면은 한 글자도
 * 바뀌지 않는다(F8 스코프 줄·UX-P 범위 고지와 같은 규칙).
 *
 * 만들어 내는 것은 없다: 조각은 사용자가 직접 적어 둔 메모의 **원문 일부**이고, 앞에 붙는
 * "메모"는 그 출처를 밝히는 라벨이다(입력 폼·CSV 열이 쓰는 것과 같은 단어).
 *
 * ## GAP-054 D#8 — 판매처 갈래
 *
 * 라운드 49 C-03이 빠른 기록 시트·지출 상세에 **판매처 입력칸**을 붙이면서 이 값은 사용자가
 * 직접 적는 필드가 됐다(그 전에는 엑셀 가져오기로만 들어왔다). 그런데 검색은 여전히 품목명·
 * 메모만 훑어서, "쿠팡에서 산 것"을 찾는 가장 자연스러운 검색어가 0건을 냈다 — 그 값은 지출
 * 상세와 CSV의 "판매처" 열에 멀쩡히 들어 있는데도.
 *
 * 그래서 갈래를 하나 더 둔다. 규칙은 **메모 갈래를 그대로 재사용**한다: 같은 정규화(공백 접기),
 * 같은 대소문자 기준, 같은 창 자르기(`searchSnippetWindow`), 같은 "라벨 + 원문 조각" 모양.
 * 새로 만든 것은 라벨 하나뿐이고, 그 라벨도 입력칸·CSV 열이 쓰는 같은 단어("판매처")다.
 *
 * 갈래 **순서**는 품목명 → 판매처 → 메모 → 경계 걸침이다. 판매처가 메모보다 앞인 이유:
 * 판매처는 "쿠팡" 같은 짧은 고정 필드라 조각이 곧 값 전체이고("판매처 쿠팡"), 메모 창은
 * 잘린 문맥이라 근거로서 덜 또렷하다 — 둘 다 맞았다면 더 또렷한 쪽을 보여 준다.
 * 경계 걸침은 예전 화면 필터가 `${itemName} ${memo}` 연결 문자열을 훑던 자리를 그대로
 * 보존하는 갈래라 **판매처를 끼워 넣지 않는다**: 없던 연결(품목명+판매처)을 새로 만들면
 * 그건 호환 보존이 아니라 새 매치를 지어내는 것이다.
 */
export const MEMO_SEARCH_SNIPPET_LABEL = "메모";
/**
 * GAP-054 D#8: 판매처에서 맞은 행의 조각 앞에 붙는 출처 라벨. 지출 상세 행·입력칸·CSV 열이
 * 쓰는 것과 **같은 단어**라, 사용자가 화면에서 본 이름 그대로 근거를 읽는다.
 */
export const MERCHANT_SEARCH_SNIPPET_LABEL = "판매처";
/**
 * GAP-054 D#8: 검색이 훑는 필드를 문장에 넣을 때 쓰는 이름 — 범위 고지 한 줄과 검색창
 * placeholder가 같은 사실을 말하도록 여기 한 번만 적는다(순서는 갈래 우선순위와 같다).
 */
export const RECORDS_SEARCH_FIELDS_LABEL = "품목명·판매처·메모";
/** 조각의 최대 길이(라벨·말줄임표 제외). 한 줄 부제에 얹을 수 있는 만큼만. */
export const MEMO_SEARCH_SNIPPET_MAX_LENGTH = 24;
/** 검색어 앞에 남기는 문맥 길이 -- 어디에 나온 말인지 보이되 검색어가 끝으로 밀리지 않게. */
const MEMO_SEARCH_SNIPPET_LEAD_LENGTH = 6;
const ELLIPSIS = "…";
/** 라운드 41 K-12: 검색어가 품목명과 메모의 경계에 걸쳐 맞았을 때 그 사실을 말하는 라벨. */
export const RECORD_SEARCH_SPANNING_LABEL = "품목명과 메모에 걸쳐 일치";

/**
 * 라운드 41 K-12 — 검색이 보는 문자열 정규화의 **단일 소스**: 줄바꿈·연속 공백을 한 칸으로 접고
 * 앞뒤를 자른다. 대소문자는 여기서 건드리지 않는다 -- 조각은 사용자가 적은 그대로 보여 주고,
 * 비교할 때만 아래에서 `toLowerCase()`를 건다.
 *
 * 예전에는 화면 필터가 원본 문자열을, 조각 쪽이 접은 문자열을 봐서 여러 줄 메모에서 두 판정이
 * 또 한 번 갈릴 수 있었다. 접기를 한 곳에만 두어 그 자리를 없앤다.
 */
export function normalizeRecordSearchText(value: string | null | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

/** 검색어가 어디서 맞았는가. `none`은 "검색 중이 아님" 또는 "맞지 않음"이다(`matches`가 가른다). */
export type RecordSearchMatchKind = "none" | "item" | "merchant" | "memo" | "spanning";

export type RecordSearchMatch = {
  /** 이 행이 검색 결과에 남는가. 검색어가 없으면 항상 true. */
  matches: boolean;
  kind: RecordSearchMatchKind;
  /** 부제 끝에 붙일 근거 한 조각. 붙일 것이 없으면 null. */
  snippet: string | null;
};

/**
 * 원문(메모·판매처)에서 잘라 낸 한 조각. `focusIndex` 주변을 창으로 잡되 창이 원문 끝을 넘지
 * 않게 뒤에서 한 번 더 민다. 원문이 짧으면 통째로 돌려준다(말줄임표도 붙지 않는다).
 *
 * GAP-054 D#8에서 이름만 일반화했다 — 판매처 갈래가 **같은 자르기 규칙**을 쓰도록 하기 위해서다
 * (판매처는 대개 짧아 통째로 나가지만, 긴 값이 들어와도 행 높이가 흔들리지 않는다).
 */
function searchSnippetWindow(text: string, focusIndex: number): string {
  if (text.length <= MEMO_SEARCH_SNIPPET_MAX_LENGTH) return text;
  const start = Math.max(
    0,
    Math.min(focusIndex - MEMO_SEARCH_SNIPPET_LEAD_LENGTH, text.length - MEMO_SEARCH_SNIPPET_MAX_LENGTH)
  );
  const end = Math.min(text.length, start + MEMO_SEARCH_SNIPPET_MAX_LENGTH);
  return `${start > 0 ? ELLIPSIS : ""}${text.slice(start, end)}${end < text.length ? ELLIPSIS : ""}`;
}

export function matchRecordSearch(input: {
  /** 행 제목(품목명). 여기서 맞으면 화면이 이미 근거를 보여 주고 있다. */
  itemName?: string | null;
  /**
   * GAP-054 D#8: `Expense.merchant`(또는 오프라인 행의 payload.merchant) -- 없으면 null.
   * 넘기지 않으면 이 갈래가 통째로 빠져 D#8 이전과 한 글자도 다르지 않다.
   */
  merchant?: string | null;
  /** `Expense.memo`(또는 오프라인 행의 payload.memo) -- 없으면 null. */
  memo?: string | null;
  /** 검색어 원본(트림 전). 비어 있으면 모든 행이 남는다. */
  searchText?: string | null;
}): RecordSearchMatch {
  const query = normalizeRecordSearchText(input.searchText).toLowerCase();
  if (query.length === 0) return { matches: true, kind: "none", snippet: null };

  const itemName = normalizeRecordSearchText(input.itemName);
  const merchant = normalizeRecordSearchText(input.merchant);
  const memo = normalizeRecordSearchText(input.memo);

  if (itemName.toLowerCase().includes(query)) return { matches: true, kind: "item", snippet: null };

  // GAP-054 D#8: 판매처 — 메모와 같은 규칙, 라벨만 다르다. 짧은 고정 필드라 조각이 곧 값이다.
  const merchantIndex = merchant.toLowerCase().indexOf(query);
  if (merchantIndex >= 0) {
    return {
      matches: true,
      kind: "merchant",
      snippet: `${MERCHANT_SEARCH_SNIPPET_LABEL} ${searchSnippetWindow(merchant, merchantIndex)}`
    };
  }

  const memoIndex = memo.toLowerCase().indexOf(query);
  if (memoIndex >= 0) {
    return {
      matches: true,
      kind: "memo",
      snippet: `${MEMO_SEARCH_SNIPPET_LABEL} ${searchSnippetWindow(memo, memoIndex)}`
    };
  }

  // 경계 걸침: 품목명 끝 + 메모 앞이 이어져야만 맞는 검색어. 예전 필터의 연결 문자열이 통과
  // 시키던 바로 그 갈래이고, 이제는 그 사실을 근거로 말한다(메모가 비어 있으면 이을 것이 없다).
  if (memo.length > 0 && `${itemName} ${memo}`.toLowerCase().includes(query)) {
    return {
      matches: true,
      kind: "spanning",
      snippet: `${RECORD_SEARCH_SPANNING_LABEL} · ${MEMO_SEARCH_SNIPPET_LABEL} ${searchSnippetWindow(memo, 0)}`
    };
  }

  return { matches: false, kind: "none", snippet: null };
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
