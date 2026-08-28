/**
 * GAP-056 #2 — 판매처 자동완성(타이핑 연동 + 포커스 칩)의 순수 로직.
 *
 * 라운드 49 C-03이 빠른 기록 시트·지출 상세에 판매처 입력칸을 붙일 때 남긴 주석은
 * "상호를 후보 목록에서 고르게 하려면 어딘가에 상호 사전이 있어야 하는데 그런 것은 없다"였다
 * (app/expenses/new.tsx). 그 문장은 **더 이상 사실이 아니다**: 두 화면 모두 이미
 * `["expenses", childId, 이번 달]` 캐시를 손에 들고 있고(자동완성·이 품목 이력이 그것을 읽는다),
 * 그 안의 행들에는 사용자가 직접 적어 둔 판매처가 들어 있다. 외부 상호 사전이 아니라
 * **이 사용자가 이번 달에 실제로 적은 이름**이 사전이다.
 *
 * 그래서 이 모듈은 새 데이터 원천을 만들지 않는다 — **새 네트워크 요청 0건**이다. 화면이 이미
 * 받아 둔 캐시 행을 그대로 넘기면 후보를 계산해 준다. 캐시가 비어 있으면(콜드 스타트·다른 달·
 * 판매처를 한 번도 안 적은 사용자) 빈 배열이고, 그때 화면은 이 기능이 없던 때와 한 글자도
 * 다르지 않다. 없는 상호를 지어내거나 "추천 판매처" 같은 것을 만들어 넣지 않는다(허위 표시 금지).
 *
 * ## 이웃 모듈과의 역할 구분
 *  - `item-autocomplete.ts`: 같은 캐시를 읽는 **품목명** 자동완성. 이 모듈은 그 문법(순수 함수,
 *    구조적 소스 타입, 상한 상수, 칩 라벨 헬퍼)을 그대로 본떴다.
 *  - `recent-items.ts`: 폼 상단의 최근 품목 칩. 판매처 쪽에서 같은 자리(타이핑 전 포커스 칩)를
 *    맡는 것은 **이 함수 자신**이다 — 빈 입력이면 최근 판매처 상위 N을 돌려주므로 두 갈래가
 *    한 함수·한 정렬이고, 첫 글자를 치는 순간 칩이 뒤집히지 않는다.
 *    (GAP-058 P3: 그 갈래에 이름만 다른 얇은 별칭 `buildRecentMerchantSuggestions`가 있었는데
 *    호출부가 0건이라 지웠다. 두 화면 모두 사용자가 친 값을 그대로 넘기므로 — `merchantFocused`가
 *    칩 표시 여부를 가르고 값은 빈 문자열일 수 있다 — 별칭이 들어갈 자리가 애초에 없다.)
 *  - `suggest-source.ts`: GAP-058 #6의 공용 원천. 이 모듈에 넘길 행 목록(`SuggestSourceRow[]`)을
 *    오프라인 스냅숏 + 서버 이번 달·지난달 캐시에서 한 벌로 만든다 — 아래 소스 타입 주석 참고.
 *
 * ## 정규화·매칭 규칙은 한 벌뿐이다
 * 판매처 문자열을 다루는 규칙은 이미 기록 탭 검색에 있다(GAP-054 D#8의 판매처 갈래 —
 * `records-list-view.ts`의 `normalizeRecordSearchText` + `matchRecordSearch`). 여기서 규칙을
 * 새로 쓰면 **같은 글자로 검색하면 나오는데 제안은 안 되는**(혹은 그 반대의) 어긋남이 생긴다.
 * 그래서 이 모듈은 판정을 직접 구현하지 않고 그 두 함수에 위임한다 — 이 모듈이 제안한 판매처는
 * 정의상 같은 글자로 검색했을 때 그 행이 걸리는 판매처다.
 *
 * 주의: `item-name-match.ts`의 `normalizeItemName`은 **내부 공백까지 지우는** 다른 규칙이라
 * 여기서 쓰지 않는다(품목명은 "물 티슈"/"물티슈"가 같은 물건이지만, 판매처는 사용자가 적은
 * 상호를 그대로 되돌려 주는 것이 목적이라 공백을 접기만 한다). 최신순 정렬만은 같은 기준이라
 * `sortByRecency`를 그대로 재사용한다.
 *
 * 저장소/네트워크/React에 의존하지 않는 계산만 담아 vitest 단위 테스트 대상으로 둔다.
 */

import { sortByRecency } from "./item-name-match";
import { matchRecordSearch, normalizeRecordSearchText } from "./records-list-view";

/**
 * 과거 기록 행 중 이 모듈이 읽는 필드만 구조적으로 요구한다 — `Expense`(src/api/client.ts)가
 * 그대로 대입되고, 오프라인 대기 행도 `{ merchant: row.payload.merchant, spentOn: … }` 한 줄로
 * 맞춰 넣을 수 있다.
 *
 * GAP-058 #6: 그 "한 줄로 맞춰 넣는" 일을 화면마다 다시 하지 않도록, 두 원천을 합친 통합 행
 * `SuggestSourceRow`(suggest-source.ts)가 **이 타입에 그대로 대입되도록** 고정해 두었다
 * (그쪽의 `SuggestSourceRowFitsMerchantSuggest` — 어긋나면 tsc가 먼저 막는다). 그래서 이 함수의
 * 시그니처를 바꾸지 않고도 `buildMerchantSuggestions(merchant, suggestSourceRows)`가 그대로
 * 동작한다 — 배선 전인 지금의 호출부(서버 캐시 배열)도 물론 그대로다.
 */
export type MerchantSuggestSourceRow = {
  /** `Expense.merchant` — 선택 입력이라 대개 비어 있다. 비면 이 행은 후보가 아니다. */
  merchant?: string | null;
  /** 지출 발생일(ISO `YYYY-MM-DD`). 최근성 정렬의 기준이며, 없으면 맨 뒤로 간다. */
  spentOn?: string;
  /**
   * "expense" | "gift" | "refund". 형제 모듈(recent-items·item-autocomplete)과 **같은 규칙**으로
   * 일반 지출만 본다 — 필드가 없는 레거시 행은 expense로 간주한다. 선물 행의 "판매처"는 보통
   * 산 곳이 아니라 준 사람 쪽 맥락이라, 그것을 내 단골 상호처럼 제안하면 사실이 흐려진다.
   */
  expenseType?: string;
};

export type MerchantSuggestion = {
  /**
   * 화면·입력칸에 그대로 넣는 값. 사용자가 적은 **원문**이되 공백만 접힌 형태이고
   * (`normalizeRecordSearchText`), 대소문자는 손대지 않는다 — 같은 상호를 여러 번 적었다면
   * 가장 최근에 적은 표기를 쓴다.
   */
  merchant: string;
  /** 이 판매처가 넘겨받은 행에서 나온 횟수(정렬의 1순위 키). 화면에 그리는 값은 아니다 — 아래 참고. */
  count: number;
  /** 가장 최근에 이 판매처로 기록한 날(ISO). 날짜가 없는 행만 있으면 null. */
  lastSpentOn: string | null;
};

/** 입력칸 아래 한 줄에 들어가는 개수 — 품목 자동완성(3개)과 같은 자리·같은 부담. */
export const MERCHANT_SUGGEST_LIMIT = 3;

/**
 * 빈 입력(폼 포커스) 때 보여 주는 칩 개수 — 최근 품목 칩(`RECENT_ITEM_CHIP_LIMIT`)과 같은 5개.
 * 아직 아무것도 치지 않은 상태에서는 고를 것이 조금 더 있어야 "칠 필요가 없다"가 성립한다.
 */
export const MERCHANT_SUGGEST_RECENT_LIMIT = 5;

export type MerchantSuggestOptions = {
  /**
   * 상한. 생략하면 갈래별 기본값(타이핑 중 3개 / 빈 입력 5개)을 쓴다. 0 이하면 빈 배열이다
   * (item-autocomplete와 같은 관례).
   */
  limit?: number;
};

type MerchantGroup = {
  merchant: string;
  count: number;
  lastSpentOn: string | null;
  /** 최신순 목록에서 이 상호가 처음 나온 자리 — 모든 키가 동률일 때의 마지막 결정자. */
  order: number;
};

/**
 * 지금 친 판매처 글자에 걸리는 과거 기록에서 후보를 만든다. 빈 입력이면 **최근 판매처 상위 N**을
 * 돌려준다(폼 포커스 시 칩).
 *
 * 규칙:
 *  - 판매처가 비었거나 공백뿐인 행, 선물/환불 행 제외.
 *  - 같은 상호는 하나로 묶는다. 묶는 키는 검색과 같은 정규화(공백 접기) + 소문자화라,
 *    "쿠팡  "과 "쿠팡", "Coupang"과 "coupang"이 한 후보가 된다. 보여 주는 표기는 **가장 최근**
 *    행의 것이다.
 *  - 정렬은 **빈도 내림차순 → 최근성 내림차순 → 최신순에서 먼저 나온 순**. 자주 가는 곳이
 *    먼저이고, 같은 횟수면 최근에 간 곳이 먼저다. (품목 자동완성처럼 매칭 등급을 1순위로 두지
 *    않았다: 판매처는 한 달치 안에서 후보가 몇 개 되지 않고, 그 몇 개 사이에서 사용자가 기대하는
 *    것은 "내가 늘 쓰는 그곳"이다. 등급 어휘를 하나 더 들이면 규칙만 두 벌이 된다.)
 *  - 이미 다 친 값과 **똑같은 후보는 내지 않는다**: 눌러도 아무것도 바뀌지 않는 칩이라
 *    자리만 차지한다. 표기가 다르면(대소문자 교정 등) 그대로 제안한다.
 *  - 최대 `options.limit`개.
 *
 * 매칭 판정은 기록 탭 검색의 판매처 갈래(`matchRecordSearch`)를 그대로 쓴다 — 여기서 제안된
 * 이름으로 검색하면 그 행이 반드시 걸린다.
 */
export function buildMerchantSuggestions(
  query: string,
  rows: readonly MerchantSuggestSourceRow[],
  options: MerchantSuggestOptions = {}
): MerchantSuggestion[] {
  const normalizedQuery = normalizeRecordSearchText(query);
  const typing = normalizedQuery.length > 0;
  const limit = options.limit ?? (typing ? MERCHANT_SUGGEST_LIMIT : MERCHANT_SUGGEST_RECENT_LIMIT);
  if (limit <= 0) return [];

  // 캐시가 비어 있으면 여기서 바로 빈 배열이다 — 후보를 지어내지 않는다.
  const groups = new Map<string, MerchantGroup>();
  // 최신순으로 훑기 때문에, 각 상호를 **처음 만나는 순간**이 곧 그 상호의 최신 기록이다
  // (표기·마지막 날짜를 그때 확정하고 이후에는 횟수만 센다).
  for (const row of sortByRecency(rows)) {
    if (row?.expenseType !== undefined && row.expenseType !== "expense") continue;
    const merchant = normalizeRecordSearchText(row?.merchant);
    if (merchant.length === 0) continue;

    const key = merchant.toLowerCase();
    const existing = groups.get(key);
    if (existing) {
      existing.count += 1;
      continue;
    }
    groups.set(key, {
      merchant,
      count: 1,
      lastSpentOn: row.spentOn && row.spentOn.length > 0 ? row.spentOn : null,
      order: groups.size
    });
  }

  const candidates = [...groups.values()].filter((group) => {
    // 이미 그 값을 다 친 사람에게 같은 값을 다시 제안하지 않는다.
    if (group.merchant === normalizedQuery) return false;
    if (!typing) return true;
    return matchRecordSearch({ merchant: group.merchant, searchText: normalizedQuery }).kind === "merchant";
  });

  candidates.sort(compareMerchantGroups);

  return candidates
    .slice(0, limit)
    .map(({ merchant, count, lastSpentOn }) => ({ merchant, count, lastSpentOn }));
}

/** 빈도 → 최근성 → 등장 순서. 날짜가 없는 후보는 날짜가 있는 후보보다 뒤다. */
function compareMerchantGroups(a: MerchantGroup, b: MerchantGroup): number {
  if (a.count !== b.count) return b.count - a.count;
  if (a.lastSpentOn !== b.lastSpentOn) {
    if (a.lastSpentOn === null) return 1;
    if (b.lastSpentOn === null) return -1;
    // ISO 날짜 문자열은 사전순 비교가 시간순 비교와 일치한다(sortByRecency와 같은 근거).
    return a.lastSpentOn < b.lastSpentOn ? 1 : -1;
  }
  return a.order - b.order;
}

/**
 * 칩에 보이는 텍스트: 상호 그대로("쿠팡").
 *
 * 횟수("쿠팡 3건")를 적지 않는다. 그 숫자는 **이번 달 캐시 안에서의 횟수**라 "이번 달"이라는
 * 범위 단어 없이는 사실을 반만 말하는 값이고(기록 탭이 검색 범위를 한 줄로 따로 고지하는 것과
 * 같은 문제), 좁은 입력칸 밑 한 줄에 그 범위까지 적으면 정작 상호가 밀린다. 횟수는 순서를
 * 정하는 근거로만 쓰고 화면에 주장하지 않는다.
 */
export function formatMerchantSuggestionChipLabel(suggestion: MerchantSuggestion): string {
  return suggestion.merchant;
}

/** 스크린리더용 라벨: "판매처 쿠팡 입력". 두 화면·두 갈래(타이핑·포커스 칩)가 같은 문장을 쓴다. */
export function merchantSuggestionChipAccessibilityLabel(suggestion: MerchantSuggestion): string {
  return `판매처 ${suggestion.merchant} 입력`;
}
