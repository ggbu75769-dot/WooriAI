/**
 * UX-C — 과거 항목 자동완성(타이핑 연동)의 순수 로직.
 *
 * 품목명을 몇 글자 치면, 같은 이름으로 이미 기록해 둔 지출을 찾아 **이름·금액·카테고리를
 * 한 번에** 채울 수 있는 칩 후보를 만든다("기저귀 38,500원 · 기저귀/위생"). 반복 구매
 * 품목이라면 이 한 번의 탭으로 입력이 사실상 끝난다.
 *
 * EXP-113의 "최근 품목" 칩(recent-items.ts)과의 역할 구분 — 둘은 겹치지 않는다:
 *  - 최근 품목 칩: 폼 **상단**, 타이핑과 무관하게 항상 최근 N건을 보여 준다(아무 생각 없이
 *    다시 사는 것들). 데이터 원천은 오프라인 저장소 스냅숏.
 *  - 이 자동완성: 품목명 입력칸 **바로 아래**, 친 글자에 걸리는 것만 상위 3개. 데이터 원천은
 *    이번 달 지출 캐시(["expenses", childId, ym])다.
 * 즉 위치도 트리거도 다르고, 이 모듈은 "이미 뭘 치기 시작한 사람"만 상대한다.
 *
 * 새 네트워크 요청은 0건이다 — 화면이 이미 받아 둔 캐시를 그대로 넘긴다. 캐시가 비어 있으면
 * 칩이 안 뜰 뿐, 기록 흐름에는 아무 영향이 없다.
 *
 * GAP-058 #6 — **원천은 이제 그 한 달치보다 넓힐 수 있다.** 위 "데이터 원천은 이번 달 지출 캐시"는
 * 화면이 그것만 넘겨서 그런 것이지 이 모듈의 한계가 아니었다: 그래서 오프라인 대기 행이 빠지고
 * (같은 화면의 최근 칩에는 보이는 품목이 여기서는 안 걸린다) 매달 1일이면 후보가 통째로 사라졌다.
 * `suggest-source.ts`가 오프라인 스냅숏 + 서버 이번 달·지난달 캐시를 한 벌로 합쳐 주고, 그
 * 통합 행은 아래 소스 타입에 **그대로 대입된다** — 이 함수의 시그니처는 그대로다(아래 주석).
 *
 * 저장소/네트워크/React에 의존하지 않는 계산만 담아 vitest 단위 테스트 대상으로 둔다.
 */

import { formatKrw } from "../money";
import { itemNameMatchRank, normalizeItemName, sortByRecency } from "./item-name-match";

/**
 * 과거 기록 행 중 이 모듈이 읽는 필드만 구조적으로 요구한다 — `Expense`가 그대로 대입된다.
 *
 * GAP-058 #6: 통합 원천의 행(`SuggestSourceRow` — suggest-source.ts)도 그대로 대입되고, 그
 * 사실을 그쪽 타입(`SuggestSourceRowFitsItemAutocomplete`)이 컴파일 타임에 고정한다. 즉 화면은
 * `buildItemAutocompleteSuggestions(itemName, suggestSourceRows)`로 인자만 바꿔 끼우면 되고,
 * 배선 전인 지금의 호출부(서버 캐시 배열)도 한 글자도 바꾸지 않고 그대로 동작한다.
 */
export type ItemAutocompleteSourceRow = {
  itemName: string;
  amountKrw: number;
  categoryId: string;
  /** 지출 발생일(ISO `YYYY-MM-DD`). 같은 이름이 여러 번이면 가장 최근 금액을 제안한다. */
  spentOn?: string;
  /** "expense" | "gift" | "refund". 칩을 누르면 일반 지출로 채워지므로 선물/환불은 제외한다
   * (필드가 없는 레거시 행은 expense로 간주 — recent-items.ts와 같은 규칙). */
  expenseType?: string;
};

export type ItemAutocompleteSuggestion = {
  itemName: string;
  amountKrw: number;
  categoryId: string;
};

/** 입력칸 아래 한 줄에 자연스럽게 들어가고, 고르는 부담도 없는 개수. */
export const ITEM_AUTOCOMPLETE_LIMIT = 3;

/**
 * 지금 친 품목명에 걸리는 과거 기록에서 자동완성 후보를 만든다.
 *
 * - 빈 입력이면 빈 배열(칩 영역 자체가 렌더되지 않는다).
 * - 선물/환불 행, 품목명이 빈 행, 금액이 양의 정수가 아닌 행 제외(DNC-013과 같은 규칙).
 * - 매칭 등급(완전일치 > 접두 > 포함 > 역포함)이 우선, 같은 등급이면 최신 기록이 먼저.
 * - 같은 품목명은 하나만(가장 최근 금액/카테고리) 남긴다.
 * - 최대 `limit`개(기본 3).
 */
export function buildItemAutocompleteSuggestions(
  query: string,
  rows: readonly ItemAutocompleteSourceRow[],
  limit: number = ITEM_AUTOCOMPLETE_LIMIT
): ItemAutocompleteSuggestion[] {
  if (normalizeItemName(query).length === 0) return [];
  if (limit <= 0) return [];

  const matched: { rank: number; row: ItemAutocompleteSourceRow }[] = [];
  for (const row of sortByRecency(rows)) {
    if (!row?.itemName || row.itemName.trim().length === 0) continue;
    if (row.expenseType !== undefined && row.expenseType !== "expense") continue;
    if (!Number.isInteger(row.amountKrw) || row.amountKrw <= 0) continue;
    const rank = itemNameMatchRank(query, row.itemName);
    if (rank === null) continue;
    matched.push({ rank, row });
  }

  // sortByRecency로 이미 최신순이고 Array#sort는 안정 정렬이라, 등급만 다시 정렬하면
  // "등급 우선 · 동률이면 최신" 순서가 된다.
  matched.sort((a, b) => a.rank - b.rank);

  const seenItemNames = new Set<string>();
  const suggestions: ItemAutocompleteSuggestion[] = [];
  for (const { row } of matched) {
    const itemName = row.itemName.trim();
    const dedupeKey = normalizeItemName(itemName);
    if (seenItemNames.has(dedupeKey)) continue;
    seenItemNames.add(dedupeKey);
    suggestions.push({ itemName, amountKrw: row.amountKrw, categoryId: row.categoryId });
    if (suggestions.length >= limit) break;
  }
  return suggestions;
}

/**
 * 칩에 보이는 텍스트: "기저귀 38,500원 · 기저귀/위생".
 * 카테고리 이름은 화면이 해석해 넘긴다(서버 카테고리 캐시 → src/categories.ts의
 * buildCategoryNameLookup). 이름을 못 구한 경우엔 금액까지만 보여 준다.
 */
export function formatItemAutocompleteChipLabel(
  suggestion: ItemAutocompleteSuggestion,
  categoryName?: string
): string {
  const head = `${suggestion.itemName} ${formatKrw(suggestion.amountKrw)}`;
  const tail = categoryName?.trim();
  return tail ? `${head} · ${tail}` : head;
}

/** 스크린리더용 라벨: "기저귀 38,500원 기저귀/위생 한 번에 입력". */
export function itemAutocompleteChipAccessibilityLabel(
  suggestion: ItemAutocompleteSuggestion,
  categoryName?: string
): string {
  const tail = categoryName?.trim();
  const head = `${suggestion.itemName} ${formatKrw(suggestion.amountKrw)}`;
  return tail ? `${head} ${tail} 한 번에 입력` : `${head} 한 번에 입력`;
}
