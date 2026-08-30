/**
 * UX-C — 품목명으로 카테고리를 자동으로 골라주는 순수 로직.
 *
 * 지출 기록의 "3초 루프"에서 카테고리 타일 탭은 금액 다음으로 자주 반복되는 동작이다.
 * 기저귀를 백 번 사도 백 번 다 같은 타일을 눌러야 한다면 그건 사용자가 아니라 앱이 기억을
 * 안 하고 있는 것이다. 그래서 품목명을 치는 동안 카테고리를 대신 맞춰 준다.
 *
 * 우선순위는 두 단계다.
 *  1순위 — **이 사용자의 과거 기록**: 같은(혹은 부분일치하는) 이름으로 이미 기록한 지출이
 *          있으면 그때 고른 카테고리를 그대로 쓴다. 사전보다 사용자 본인의 분류가 항상 옳다
 *          ("분유"를 식비로 적는 사람도 있다).
 *  2순위 — **정적 키워드 사전**: 첫 기록이라 과거가 없을 때를 위한 폴백. 서버 시드 카테고리
 *          코드(src/categories.ts의 CategoryCode)로 매핑하고, 그 코드를 가진 8타일 중 첫
 *          항목으로 해석한다.
 *
 * 데이터 출처는 **이미 받아 둔 서버 지출 캐시 두 달치**뿐이다(화면이 react-query의
 * ["expenses", childId, ym] 이번 달 + getQueryData로 읽은 지난달 캐시를 이어 넘긴다 —
 * 라운드 81 A가 매달 1일 이번 달 캐시가 정의상 비어 1순위가 죽던 공백을 **지난달 캐시가 이미
 * 받아져 있을 때** 메운다. 그 캐시를 받아 오지는 않는다 — 새 요청 0건이 이 경로의 규율이라,
 * 콜드 스타트 직후의 1일 아침처럼 두 달치가 모두 비어 있는 순간에는 종전과 같이 1순위가 없다).
 * 새 요청이 0건이라 오프라인에서도 그대로 동작하고, 캐시가 비어 있으면 그냥 추천이
 * 없을 뿐 기록 흐름을 막지 않는다.
 *
 * 덮어쓰기 금지 규칙(화면 쪽 계약): 사용자가 카테고리를 **한 번이라도 직접 고른 뒤에는**
 * 이 추천을 적용하지 않는다. 추천은 "아직 안 고른 칸"을 채워 주는 것이지, 사용자의 선택을
 * 정정하는 것이 아니다 — 저장 직전에 분류가 조용히 바뀌면 그건 허위 기록이 된다.
 *
 * ## 기본값에 대한 사실 (라운드 33 F4 → 라운드 51 C-#5에서 고쳐졌다)
 * **예전 사실**: 이 화면의 카테고리 기본 선택값은 8타일 중 첫 타일인 "기저귀"였다
 * (app/expenses/new.tsx의 `useState(quickExpenseCategories[0])`, src/categories.ts의 카탈로그
 * 순서). 그래서 추천이 붙지 않는 품목은 사용자가 타일을 직접 누르지 않는 한 전부 기저귀로
 * 저장됐고, 리포트·인사이트·홈 타일이 그 오분류를 **사실인 것처럼** 그렸다. 라운드 33 F4는
 * 그 문제를 "픽셀 락(EXP-001)과 입력 흐름에 영향이 커서 범위 밖"으로 두고 기록만 해 뒀다.
 *
 * **지금 사실(라운드 51 C-#5)**: 세션이 있는 실제 입력 경로에서는 **아무것도 선택되지 않은
 * 상태("미선택")로 시작한다**. 타일에는 선택 하이라이트가 하나도 없고, 분류를 고르지 않은 채
 * 저장을 누르면 저장이 시작되지 않고 안내 한 줄이 뜬다(entry-form-guards.ts의
 * `isCategoryMissingForSave` / `CATEGORY_REQUIRED_NOTICE`). "저장하고 계속 기록"의 리셋도
 * 미선택으로 돌아간다. 즉 **앱이 사용자 대신 분류를 지어내는 자리는 이제 없다.**
 *
 * 두 가지는 종전 그대로다.
 *  - 자동 추천(아래 `resolveAutoCategorySelection`)과 "또 기록" 프리필은 예전과 똑같이 동작한다.
 *    추천이 붙으면 타일이 눌리고 캡션이 뜨며, 추천 근거가 사라지면 되돌아간다 — 되돌아가는
 *    자리가 "첫 타일"에서 "미선택"으로 바뀌었을 뿐이라 추가 탭은 0이다.
 *  - **세션 없는 픽셀 락 캡처 경로**(app/pixel-lock.tsx가 clearSession 후 /expenses/new로
 *    이동)는 여전히 첫 타일이 선택된 채로 렌더된다 — EXP-001 기준 이미지가 그 하이라이트를
 *    포함하므로, 비세션 초기 렌더만 종전 상태를 유지한다(entry-form-guards.ts의
 *    `resolveInitialCategoryId`).
 */

import { categoryCatalog, type CategoryCode } from "../categories";
import { itemNameMatchRank, normalizeItemName, sortByRecency } from "./item-name-match";

/** 과거 기록 행 중 이 모듈이 실제로 읽는 필드만 구조적으로 요구한다 —
 * src/api/client.ts의 `Expense`가 그대로 대입 가능하다. */
export type CategorySuggestionHistoryRow = {
  itemName: string;
  categoryId: string;
  /** 지출 발생일(ISO `YYYY-MM-DD`). 같은 이름이 여러 번이면 가장 최근 분류를 쓴다. */
  spentOn?: string;
  /** "expense" | "gift" | "refund". 선물/환불 행은 분류 습관의 근거로 삼지 않는다
   * (필드가 없는 레거시 행은 expense로 간주 — recent-items.ts와 같은 규칙). */
  expenseType?: string;
};

export type CategorySuggestionSource = "history" | "keyword";

export type CategorySuggestion = {
  /** 8타일(categoryCatalog) 중 하나의 id. 화면은 이 id로 타일을 찾아 선택 상태로 만든다. */
  categoryId: string;
  source: CategorySuggestionSource;
  /** source가 "keyword"일 때 실제로 걸린 단어(테스트·디버깅용). */
  matchedKeyword?: string;
};

export type CategoryKeywordRule = {
  /** 정규화된(공백 없는 소문자) 비교 대상 단어. */
  keyword: string;
  /**
   * 서버 시드 카테고리 코드 — src/categories.ts의 CategoryCode.
   *
   * `null`은 **억제 규칙**이다: "이 단어가 걸리면 아무 추천도 하지 않는다". 더 짧은 키워드로
   * 내려가지도 않는다(그게 이 규칙의 존재 이유다 — 아래 "기저귀가방" 참고).
   */
  code: CategoryCode | null;
};

/**
 * 첫 기록 사용자를 위한 정적 키워드 사전(26개 + 억제 규칙 1개).
 *
 * 코드는 8타일이 실제로 쓰는 코드로만 매핑한다(`etc`로 가는 규칙은 두지 않는다 — "기타" 타일은
 * 추천해 봐야 알려 주는 것이 없다). 같은 코드를 가진 타일이 둘이면 (feeding_babyfood =
 * "분유/유제품" + "식비") 카탈로그 순서상 첫 타일로 해석된다.
 *
 * 긴 단어가 먼저 이긴다(아래 keywordRulesByLength). 의학적 효능·진단을 단정하는 단어는 넣지
 * 않는다(DNC-020).
 *
 * ## 라운드 33 F2 — outing_mobility 규칙을 걷어냈다
 * 유모차·카시트·아기띠·기저귀가방은 코드로는 `outing_mobility`(외출/이동)가 맞지만, 이 화면의
 * 8타일 중 그 코드를 가진 타일의 **실제 라벨은 "약품/교통"**이다(src/categories.ts — 12개 서버
 * 코드를 8타일로 접으면서 "교통"이 외출/이동 코드를 물려받았다). 그래서 유모차를 치면 "약품/교통"
 * 타일이 눌린 채로 저장 화면이 뜨는, 코드 의미와 사용자 표시가 어긋난 추천이 됐다.
 *
 * 기대에 맞는 타일이 아예 없으므로(외출/이동 타일 없음) 재매핑할 곳도 없다. **추천 없음이
 * 오표시 추천보다 낫다** — 추천이 없으면 사용자가 직접 타일을 고를 뿐이지만, 틀린 타일이
 * 눌려 있으면 그대로 저장돼 분류가 실제와 다른 기록이 남는다. 그래서 세 규칙은 지웠다.
 *
 * "기저귀가방"만 `code: null` 억제 규칙으로 남긴다: 규칙을 통째로 지우면 더 짧은 "기저귀"가
 * 걸려 기저귀 타일을 추천하게 되는데, 기저귀가방은 기저귀가 아니다. 억제 규칙이 그 오추천을
 * 막고, 사용자는 직접 고른다.
 *
 * 타일 라벨이 바뀌거나 "외출/이동" 타일이 생기면 이 네 단어를 되살릴 수 있다(그때는 라벨을
 * 다시 확인하고 되살릴 것).
 */
export const CATEGORY_KEYWORD_RULES: readonly CategoryKeywordRule[] = [
  // 기저귀/위생
  { keyword: "기저귀", code: "diaper_hygiene" },
  { keyword: "물티슈", code: "diaper_hygiene" },
  { keyword: "로션", code: "diaper_hygiene" },
  { keyword: "목욕", code: "diaper_hygiene" },
  { keyword: "바디워시", code: "diaper_hygiene" },
  // 수유/이유식
  { keyword: "분유", code: "feeding_babyfood" },
  { keyword: "이유식", code: "feeding_babyfood" },
  { keyword: "젖병", code: "feeding_babyfood" },
  { keyword: "수유", code: "feeding_babyfood" },
  { keyword: "유축기", code: "feeding_babyfood" },
  // 의류/세탁
  { keyword: "내복", code: "clothes_laundry" },
  { keyword: "배냇저고리", code: "clothes_laundry" },
  { keyword: "우주복", code: "clothes_laundry" },
  { keyword: "양말", code: "clothes_laundry" },
  { keyword: "턱받이", code: "clothes_laundry" },
  { keyword: "세탁세제", code: "clothes_laundry" },
  // 외출/이동: 이 코드를 가진 8타일의 라벨이 "약품/교통"이라 추천하지 않는다(위 F2 주석).
  // 기저귀가방은 짧은 "기저귀" 규칙에 삼켜지지 않도록 억제 규칙으로 남긴다.
  { keyword: "기저귀가방", code: null },
  // 병원/검진
  { keyword: "병원", code: "hospital_checkup" },
  { keyword: "접종", code: "hospital_checkup" },
  { keyword: "진료", code: "hospital_checkup" },
  { keyword: "검진", code: "hospital_checkup" },
  { keyword: "소아과", code: "hospital_checkup" },
  { keyword: "약국", code: "hospital_checkup" },
  // 장난감/책
  { keyword: "장난감", code: "toys_books" },
  { keyword: "책", code: "toys_books" },
  { keyword: "모빌", code: "toys_books" },
  { keyword: "치발기", code: "toys_books" }
];

/** 자동으로 골라 줬음을 알리는 미세 캡션(DNC-018 해요체). 화면에서 한 줄로만 쓴다. */
export const AUTO_CATEGORY_CAPTION = "자동으로 골라드렸어요";

/** 긴 키워드 우선 — 같은 입력에 "기저귀"와 "기저귀가방"이 모두 걸리면 더 구체적인 쪽이 이긴다. */
const keywordRulesByLength: readonly CategoryKeywordRule[] = [...CATEGORY_KEYWORD_RULES].sort(
  (a, b) => b.keyword.length - a.keyword.length
);

const catalogIds = new Set(categoryCatalog.map((entry) => entry.id));

/** 서버 시드 코드를 이 화면이 실제로 선택할 수 있는 타일 id로 해석한다(없으면 null). */
function catalogIdForCode(code: CategoryCode): string | null {
  return categoryCatalog.find((entry) => entry.code === code)?.id ?? null;
}

/**
 * 품목명에 맞는 카테고리를 추천한다. 추천할 근거가 없으면 null(=화면은 아무것도 하지 않는다).
 *
 * 과거 기록에서 고를 때의 규칙:
 * - 선택된 아이의 이번 달 캐시 행을 그대로 받는다(필터링은 호출부 책임이 아니라 여기 있다).
 * - 선물/환불 행 제외, 품목명이 빈 행 제외.
 * - **8타일 중 하나로 기록된 행만** 후보다. 엑셀 가져오기나 지출 수정 화면을 거친 행은
 *   서버 정식 카테고리(DB마다 다른 UUID)를 달고 있어 이 화면에서는 선택할 수 없는 값이라,
 *   추천해 봐야 타일이 안 눌린다 — 그런 행은 조용히 건너뛰고 키워드 사전으로 내려간다.
 * - 매칭 등급(완전일치 > 접두 > 포함 > 역포함)이 우선, 같은 등급이면 최신 기록이 이긴다.
 */
export function suggestCategoryId(
  itemName: string,
  history: readonly CategorySuggestionHistoryRow[] = []
): CategorySuggestion | null {
  const historyMatch = suggestFromHistory(itemName, history);
  if (historyMatch) return historyMatch;
  return suggestFromKeywords(itemName);
}

function suggestFromHistory(
  itemName: string,
  history: readonly CategorySuggestionHistoryRow[]
): CategorySuggestion | null {
  let best: { rank: number; categoryId: string } | null = null;

  for (const row of sortByRecency(history)) {
    if (!row?.itemName) continue;
    if (row.expenseType !== undefined && row.expenseType !== "expense") continue;
    if (!catalogIds.has(row.categoryId)) continue;
    const rank = itemNameMatchRank(itemName, row.itemName);
    if (rank === null) continue;
    // sortByRecency가 최신순이므로 "더 좋은 등급"일 때만 교체하면 동률에서 최신이 남는다.
    if (best === null || rank < best.rank) best = { rank, categoryId: row.categoryId };
  }

  return best ? { categoryId: best.categoryId, source: "history" } : null;
}

/**
 * 자동 추천이 대신 눌러 준 타일의 출처 — **어떤 품목명 기준으로** 무엇을 골랐는지.
 * 화면(app/expenses/new.tsx)이 상태로 들고 있다가 매 타이핑마다 아래 판정에 되돌려 준다.
 */
export type AutoPickedCategory = {
  /** 이 추천의 근거가 된 품목명(그때 입력칸에 있던 값 그대로). */
  itemName: string;
  /** 그때 실제로 선택된 8타일 id. */
  categoryId: string;
};

export type AutoCategorySelectionInput = {
  /** 지금 입력칸의 품목명. */
  itemName: string;
  /** 이번 달 지출 캐시(1순위 근거). 없으면 키워드 사전만 쓴다. */
  history?: readonly CategorySuggestionHistoryRow[];
  /** 지금 선택돼 있는 타일 id. 아직 아무 타일도 안 눌렸으면 `null`(미선택). */
  currentCategoryId: string | null;
  /** 직전에 자동으로 골라 준 값(사용자가 직접 고른 뒤라면 화면이 아예 이 판정을 부르지 않는다). */
  autoPicked: AutoPickedCategory | null;
  /**
   * 근거가 사라졌을 때 돌아갈 값 — **화면의 초기 선택 상태와 같은 값**이다.
   *
   * 라운드 51 C-#5: 세션이 있는 실제 입력 경로에서는 이 값이 `null`(미선택)이다. 예전에는
   * 8타일 중 첫 타일 id("기저귀")였고, 그래서 추천이 사라진 자리에 아무도 고르지 않은 분류가
   * 눌린 채로 남았다. 되돌아갈 자리가 "미선택"이 되면서 그 오분류의 마지막 경로가 닫혔다.
   */
  defaultCategoryId: string | null;
};

export type AutoCategorySelection = {
  /** 선택돼 있어야 할 타일 id. `null`이면 아무 타일도 선택되지 않은 상태다. */
  categoryId: string | null;
  /** 자동 선택 상태(캡션은 이 값이 있을 때만 뜬다). */
  autoPicked: AutoPickedCategory | null;
};

/**
 * 라운드 33 F3 — **근거가 사라지면 자동 선택도 사라진다.**
 *
 * 예전에는 화면이 "추천이 null이면 캡션만 끈다"로 처리해서, 직전 추천으로 눌려 있던 타일이
 * 그대로 남았다. "물티슈"를 지우고 "가습기"를 치면(사전에도 과거 기록에도 없는 이름) 캡션은
 * 사라지는데 기저귀/위생 타일은 눌린 채라, 사용자가 카테고리를 고른 적이 한 번도 없는데도
 * 그 분류로 저장됐다 — 기록이 실제와 달라지는 종류의 버그다.
 *
 * 그래서 근거가 없을 때는 현재 선택이 **아직 기계가 고른 그 값 그대로인지**(autoPicked와 일치)
 * 보고, 그렇다면 `defaultCategoryId`로 되돌린다. 사용자가 한 번이라도 직접 골랐다면 화면이 이
 * 판정을 부르지 않으므로(categoryTouchedRef) 사람의 선택은 어떤 경우에도 되돌려지지 않는다.
 * 되돌린 뒤 남는 것은 처음 상태(라운드 51 C-#5 이후: 미선택 · 캡션 없음)뿐이라 이 판정이
 * 지어내는 값은 없다.
 */
export function resolveAutoCategorySelection(input: AutoCategorySelectionInput): AutoCategorySelection {
  const suggestion = suggestCategoryId(input.itemName, input.history ?? []);
  if (suggestion) {
    return {
      categoryId: suggestion.categoryId,
      autoPicked: { itemName: input.itemName, categoryId: suggestion.categoryId }
    };
  }

  const stillMachinePicked = input.autoPicked !== null && input.autoPicked.categoryId === input.currentCategoryId;
  return {
    categoryId: stillMachinePicked ? input.defaultCategoryId : input.currentCategoryId,
    autoPicked: null
  };
}

/** 같은 자동 선택 상태인지 — 화면이 같은 값으로 상태를 갈아끼워 렌더 루프를 만들지 않도록. */
export function isSameAutoPickedCategory(a: AutoPickedCategory | null, b: AutoPickedCategory | null): boolean {
  if (a === null || b === null) return a === b;
  return a.categoryId === b.categoryId && a.itemName === b.itemName;
}

function suggestFromKeywords(itemName: string): CategorySuggestion | null {
  // 키워드는 이미 정규화된 형태로 적혀 있으므로 입력만 같은 규칙으로 맞춘다.
  const normalized = normalizeItemName(itemName);
  if (normalized.length === 0) return null;

  for (const rule of keywordRulesByLength) {
    if (!normalized.includes(rule.keyword)) continue;
    // 억제 규칙(code: null): 여기서 멈춘다 -- 더 짧은 키워드로 내려가면 "기저귀가방"이 기저귀로
    // 추천되는, 이 규칙이 막으려던 바로 그 오추천이 다시 생긴다.
    if (rule.code === null) return null;
    const categoryId = catalogIdForCode(rule.code);
    if (!categoryId) continue;
    return { categoryId, source: "keyword", matchedKeyword: rule.keyword };
  }
  return null;
}
