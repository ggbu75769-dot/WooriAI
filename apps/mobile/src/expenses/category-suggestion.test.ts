import { describe, expect, it } from "vitest";
import { categoryCatalog } from "../categories";
import {
  AUTO_CATEGORY_CAPTION,
  CATEGORY_KEYWORD_RULES,
  isSameAutoPickedCategory,
  resolveAutoCategorySelection,
  suggestCategoryId,
  type CategorySuggestionHistoryRow
} from "./category-suggestion";
import { ITEM_NAME_MATCH_RANK, itemNameMatchRank, normalizeItemName, sortByRecency } from "./item-name-match";

/** 8타일의 실제 id — 추천 결과는 반드시 이 중 하나여야 화면에서 선택될 수 있다. */
const tileId = (label: string) => categoryCatalog.find((entry) => entry.label === label)!.id;

const DIAPER = tileId("기저귀");
const FEEDING = tileId("분유/유제품");
const CLOTHES = tileId("의류");
const MOBILITY = tileId("약품/교통");
const HOSPITAL = tileId("병원/약");
const TOYS = tileId("교육/도서");
const ETC = tileId("기타");

function row(overrides: {
  itemName: string;
  categoryId?: string;
  spentOn?: string;
  expenseType?: string;
}): CategorySuggestionHistoryRow {
  return {
    itemName: overrides.itemName,
    categoryId: overrides.categoryId ?? DIAPER,
    ...(overrides.spentOn !== undefined ? { spentOn: overrides.spentOn } : {}),
    ...(overrides.expenseType !== undefined ? { expenseType: overrides.expenseType } : {})
  };
}

describe("UX-C 품목명 부분일치 규칙 (item-name-match)", () => {
  it("공백·대소문자를 무시하고 비교한다", () => {
    expect(normalizeItemName("  물 티슈 ")).toBe("물티슈");
    expect(normalizeItemName("Baby Lotion")).toBe("babylotion");
    expect(itemNameMatchRank("물티슈", "물 티슈")).toBe(ITEM_NAME_MATCH_RANK.exact);
  });

  it("완전일치 > 접두 > 포함 > 역포함 순으로 등급을 매긴다", () => {
    expect(itemNameMatchRank("기저귀", "기저귀")).toBe(ITEM_NAME_MATCH_RANK.exact);
    expect(itemNameMatchRank("기저", "기저귀 대형")).toBe(ITEM_NAME_MATCH_RANK.prefix);
    expect(itemNameMatchRank("대형", "기저귀 대형")).toBe(ITEM_NAME_MATCH_RANK.contains);
    expect(itemNameMatchRank("기저귀 대형 2팩", "기저귀")).toBe(ITEM_NAME_MATCH_RANK.containedBy);
    expect(itemNameMatchRank("기저귀", "분유")).toBeNull();
    expect(itemNameMatchRank("", "기저귀")).toBeNull();
  });

  it("1글자짜리 과거 이름이 긴 입력에 우연히 삼켜지지 않는다", () => {
    // "약"이 "약국"의 부분이라는 이유로 과거의 1글자 기록이 최상위로 올라오면 엉뚱한 추천이 된다.
    expect(itemNameMatchRank("기저귀 크림", "귀")).toBeNull();
    expect(itemNameMatchRank("귀", "귀")).toBe(ITEM_NAME_MATCH_RANK.exact);
  });

  it("최신순 정렬은 원본을 건드리지 않고, 날짜 없는 행을 뒤로 보낸다", () => {
    const rows = [{ spentOn: "2026-08-01" }, {}, { spentOn: "2026-08-20" }];
    expect(sortByRecency(rows)).toEqual([{ spentOn: "2026-08-20" }, { spentOn: "2026-08-01" }, {}]);
    expect(rows[0]).toEqual({ spentOn: "2026-08-01" });
  });
});

describe("UX-C 카테고리 자동 추천", () => {
  it("1순위: 과거에 같은 이름으로 기록한 카테고리를 그대로 쓴다 (사전보다 사용자 습관이 우선)", () => {
    // 사전대로면 "분유"는 수유/이유식이지만, 이 사용자는 식비 타일로 적어 왔다.
    const history = [row({ itemName: "분유", categoryId: tileId("식비"), spentOn: "2026-08-10" })];
    expect(suggestCategoryId("분유", history)).toEqual({ categoryId: tileId("식비"), source: "history" });
  });

  it("과거 기록은 부분일치(접두/포함/역포함)로도 걸린다", () => {
    const history = [row({ itemName: "하기스 기저귀 대형", categoryId: DIAPER, spentOn: "2026-08-10" })];
    expect(suggestCategoryId("하기스", history)?.source).toBe("history");
    expect(suggestCategoryId("기저귀", history)?.source).toBe("history");
    expect(suggestCategoryId("하기스 기저귀 대형 2팩", history)?.source).toBe("history");
  });

  it("매칭 등급이 같으면 더 최근에 기록한 분류가 이긴다", () => {
    const history = [
      row({ itemName: "물티슈", categoryId: ETC, spentOn: "2026-08-01" }),
      row({ itemName: "물티슈", categoryId: DIAPER, spentOn: "2026-08-20" })
    ];
    expect(suggestCategoryId("물티슈", history)).toEqual({ categoryId: DIAPER, source: "history" });
  });

  it("더 좋은 등급이 오래된 기록이어도 최신 약한 매칭을 이긴다", () => {
    const history = [
      row({ itemName: "기저귀", categoryId: DIAPER, spentOn: "2026-08-01" }),
      row({ itemName: "기저귀 정리함", categoryId: ETC, spentOn: "2026-08-20" })
    ];
    // "기저귀"는 완전일치(0)와 접두(1) 두 후보가 있고, 완전일치가 이긴다.
    expect(suggestCategoryId("기저귀", history)).toEqual({ categoryId: DIAPER, source: "history" });
  });

  it("선물/환불 행과 8타일 밖 카테고리 행은 근거로 삼지 않고 키워드로 내려간다", () => {
    const gift = [row({ itemName: "물티슈", categoryId: ETC, spentOn: "2026-08-10", expenseType: "gift" })];
    expect(suggestCategoryId("물티슈", gift)).toMatchObject({ categoryId: DIAPER, source: "keyword" });

    // 엑셀 가져오기/지출 수정 화면을 거친 행은 서버 정식 카테고리(DB마다 다른 UUID)를 달고 있어
    // 이 화면에서는 선택할 수 없는 값이다 -- 추천했다면 어떤 타일도 안 눌렸을 것이다.
    const serverCategoryRow = [
      row({ itemName: "물티슈", categoryId: "11111111-2222-4333-8444-555555555555", spentOn: "2026-08-10" })
    ];
    expect(suggestCategoryId("물티슈", serverCategoryRow)).toMatchObject({ source: "keyword" });
  });

  it("2순위: 과거가 없으면 정적 키워드 사전으로 고른다", () => {
    expect(suggestCategoryId("기저귀 대형", [])).toMatchObject({ categoryId: DIAPER, source: "keyword" });
    expect(suggestCategoryId("아기 분유 800g", [])).toMatchObject({ categoryId: FEEDING, source: "keyword" });
    expect(suggestCategoryId("내복 세트", [])).toMatchObject({ categoryId: CLOTHES, source: "keyword" });
    expect(suggestCategoryId("소아과 진료비", [])).toMatchObject({ categoryId: HOSPITAL, source: "keyword" });
    expect(suggestCategoryId("그림책", [])).toMatchObject({ categoryId: TOYS, source: "keyword" });
  });

  /**
   * 라운드 33 F2: outing_mobility 코드를 가진 8타일의 라벨은 "약품/교통"이다. 유모차·카시트·
   * 아기띠를 그 타일로 추천하면 코드 의미와 사용자 표시가 어긋난 추천이 된다 -- 기대에 맞는
   * 타일이 없으므로 재매핑할 곳도 없고, 추천 없음(사용자가 직접 고름)이 오표시보다 낫다.
   */
  it("F2: 외출/이동 품목은 '약품/교통' 타일로 추천하지 않는다", () => {
    expect(tileId("약품/교통")).toBe(MOBILITY);
    expect(categoryCatalog.find((entry) => entry.id === MOBILITY)?.code).toBe("outing_mobility");

    for (const itemName of ["유모차", "카시트", "아기띠", "디럭스 유모차", "카시트 거치대"]) {
      expect(suggestCategoryId(itemName, []), itemName).toBeNull();
    }
    // 어떤 규칙도 이 타일로 가지 않는다.
    for (const rule of CATEGORY_KEYWORD_RULES) {
      expect(suggestCategoryId(rule.keyword, [])?.categoryId, rule.keyword).not.toBe(MOBILITY);
    }
  });

  it("F2: 기저귀가방은 억제 규칙이라 짧은 '기저귀'로 흘러내리지 않는다", () => {
    // 규칙을 통째로 지웠다면 "기저귀"가 걸려 기저귀 타일이 눌렸을 것이다 -- 기저귀가방은
    // 기저귀가 아니므로 그것도 오추천이다.
    expect(suggestCategoryId("기저귀가방", [])).toBeNull();
    expect(suggestCategoryId("기저귀 가방 하나", [])).toBeNull();
    // 억제는 사전(2순위)에만 적용된다 -- 사용자가 직접 그렇게 기록해 온 과거(1순위)는 그대로 이긴다.
    const history = [row({ itemName: "기저귀가방", categoryId: ETC, spentOn: "2026-08-10" })];
    expect(suggestCategoryId("기저귀가방", history)).toEqual({ categoryId: ETC, source: "history" });
  });

  it("근거가 없으면 null -- 화면은 아무것도 바꾸지 않는다", () => {
    expect(suggestCategoryId("", [])).toBeNull();
    expect(suggestCategoryId("   ", [])).toBeNull();
    expect(suggestCategoryId("정체불명의 무언가", [])).toBeNull();
    // 과거 기록 인자를 생략해도(캐시가 아직 비어 있는 콜드 스타트) 키워드 폴백은 그대로 돈다.
    expect(suggestCategoryId("정체불명의 무언가")).toBeNull();
    expect(suggestCategoryId("기저귀")).toMatchObject({ categoryId: DIAPER, source: "keyword" });
  });

  it("사전은 20~30개 규모이고, 모든 규칙이 실제 8타일로 해석된다 (억제 규칙 제외)", () => {
    expect(CATEGORY_KEYWORD_RULES.length).toBeGreaterThanOrEqual(20);
    expect(CATEGORY_KEYWORD_RULES.length).toBeLessThanOrEqual(30);

    const keywords = CATEGORY_KEYWORD_RULES.map((rule) => rule.keyword);
    expect(new Set(keywords).size).toBe(keywords.length);

    for (const rule of CATEGORY_KEYWORD_RULES) {
      expect(normalizeItemName(rule.keyword), `${rule.keyword}는 정규화된 형태여야 한다`).toBe(rule.keyword);
      const suggestion = suggestCategoryId(rule.keyword, []);
      // code가 null인 억제 규칙은 "추천하지 않는다"가 정답이다(F2).
      if (rule.code === null) {
        expect(suggestion, `${rule.keyword}는 억제 규칙이라 추천이 없어야 한다`).toBeNull();
        continue;
      }
      expect(suggestion, `${rule.keyword}는 추천을 만들어야 한다`).not.toBeNull();
      expect(categoryCatalog.some((entry) => entry.id === suggestion!.categoryId)).toBe(true);
    }
  });

  it("기타 타일을 추천하는 규칙은 두지 않는다 (알려 주는 것이 없다)", () => {
    for (const rule of CATEGORY_KEYWORD_RULES) {
      expect(suggestCategoryId(rule.keyword, [])?.categoryId).not.toBe(ETC);
    }
  });

  it("캡션 문구는 DNC-018 해요체를 유지한다", () => {
    expect(AUTO_CATEGORY_CAPTION).toBe("자동으로 골라드렸어요");
  });
});

/**
 * 라운드 33 F3 — 근거가 사라지면 자동 선택도 사라진다.
 *
 * 예전에는 화면이 "추천이 null이면 캡션만 끈다"로 처리해서 직전 자동 선택이 타일에 남았고,
 * 사용자가 카테고리를 고른 적이 없는데도 그 분류로 저장될 수 있었다.
 */
describe("F3 자동 선택 되돌리기 (resolveAutoCategorySelection)", () => {
  const DEFAULT_TILE = categoryCatalog[0].id;
  const base = { history: [] as CategorySuggestionHistoryRow[], defaultCategoryId: DEFAULT_TILE };

  it("추천이 있으면 그 타일을 고르고, 어떤 이름으로 골랐는지 함께 남긴다", () => {
    const picked = resolveAutoCategorySelection({
      ...base,
      itemName: "물티슈",
      currentCategoryId: DEFAULT_TILE,
      autoPicked: null
    });
    expect(picked).toEqual({
      categoryId: DIAPER,
      autoPicked: { itemName: "물티슈", categoryId: DIAPER }
    });
  });

  it("가습기 시나리오: 근거가 사라지면 자동으로 골랐던 타일을 기본 타일로 되돌린다", () => {
    // "병원"으로 병원/약 타일이 자동 선택된 상태에서 이름을 "가습기"로 바꾼다
    // (사전에도, 과거 기록에도 없는 이름이라 추천 근거가 사라진다).
    const afterTyping = resolveAutoCategorySelection({
      ...base,
      itemName: "가습기",
      currentCategoryId: HOSPITAL,
      autoPicked: { itemName: "병원 진료비", categoryId: HOSPITAL }
    });
    expect(afterTyping.autoPicked).toBeNull();
    expect(afterTyping.categoryId).toBe(DEFAULT_TILE);
    expect(afterTyping.categoryId).not.toBe(HOSPITAL);
  });

  it("이름을 통째로 지운 경우에도 되돌린다", () => {
    const cleared = resolveAutoCategorySelection({
      ...base,
      itemName: "",
      currentCategoryId: DIAPER,
      autoPicked: { itemName: "물티슈", categoryId: DIAPER }
    });
    expect(cleared).toEqual({ categoryId: DEFAULT_TILE, autoPicked: null });
  });

  it("자동으로 고른 값이 아니면 되돌리지 않는다 (사람의 선택은 건드리지 않는다)", () => {
    // 화면은 사용자가 타일을 직접 고른 뒤에는 이 판정을 아예 부르지 않지만(categoryTouchedRef),
    // 판정 자체도 "지금 눌린 것이 기계가 고른 그 값일 때만" 되돌린다 -- 이중 안전장치.
    const untouched = resolveAutoCategorySelection({
      ...base,
      itemName: "가습기",
      currentCategoryId: TOYS,
      autoPicked: { itemName: "병원 진료비", categoryId: HOSPITAL }
    });
    expect(untouched).toEqual({ categoryId: TOYS, autoPicked: null });

    const neverAutoPicked = resolveAutoCategorySelection({
      ...base,
      itemName: "가습기",
      currentCategoryId: TOYS,
      autoPicked: null
    });
    expect(neverAutoPicked).toEqual({ categoryId: TOYS, autoPicked: null });
  });

  it("추천 근거가 다시 생기면 곧바로 다시 골라 준다 (일회성으로 꺼지지 않는다)", () => {
    // 칩을 눌렀지만 그 칩의 카테고리가 8타일 밖이라 화면이 카테고리를 못 바꾼 경우 --
    // 화면은 categoryTouchedRef를 세우지 않으므로 이 판정이 계속 돌고, 채워진 품목명으로
    // 다시 추천이 나온다.
    const again = resolveAutoCategorySelection({
      ...base,
      itemName: "하기스 기저귀 대형",
      currentCategoryId: DEFAULT_TILE,
      autoPicked: null
    });
    expect(again).toEqual({
      categoryId: DIAPER,
      autoPicked: { itemName: "하기스 기저귀 대형", categoryId: DIAPER }
    });
  });

  /**
   * 라운드 51 C-#5 — 화면이 실제로 넘기는 값(미선택 시작).
   *
   * 세션이 있는 입력 경로에서는 `defaultCategoryId`가 null이고 초기 `currentCategoryId`도
   * null이다. 되돌아가는 자리만 바뀌고 추천 규칙 자체는 한 줄도 달라지지 않는다.
   */
  describe("미선택으로 시작하는 화면(defaultCategoryId: null)", () => {
    const unselected = { history: [] as CategorySuggestionHistoryRow[], defaultCategoryId: null };

    it("아직 아무것도 안 고른 상태에서 추천이 붙으면 종전과 똑같이 골라 준다", () => {
      expect(
        resolveAutoCategorySelection({ ...unselected, itemName: "물티슈", currentCategoryId: null, autoPicked: null })
      ).toEqual({ categoryId: DIAPER, autoPicked: { itemName: "물티슈", categoryId: DIAPER } });
    });

    it("추천 근거가 없으면 아무 타일도 고르지 않는다 (기저귀로 떨어지지 않는다)", () => {
      const noEvidence = resolveAutoCategorySelection({
        ...unselected,
        itemName: "가습기",
        currentCategoryId: null,
        autoPicked: null
      });
      expect(noEvidence).toEqual({ categoryId: null, autoPicked: null });
      expect(noEvidence.categoryId).not.toBe(DIAPER);
    });

    it("가습기 시나리오: 근거가 사라지면 첫 타일이 아니라 미선택으로 되돌아간다", () => {
      const afterTyping = resolveAutoCategorySelection({
        ...unselected,
        itemName: "가습기",
        currentCategoryId: HOSPITAL,
        autoPicked: { itemName: "병원 진료비", categoryId: HOSPITAL }
      });
      expect(afterTyping).toEqual({ categoryId: null, autoPicked: null });
    });

    it("사람이 고른 선택은 미선택으로도 되돌리지 않는다", () => {
      expect(
        resolveAutoCategorySelection({
          ...unselected,
          itemName: "가습기",
          currentCategoryId: TOYS,
          autoPicked: null
        })
      ).toEqual({ categoryId: TOYS, autoPicked: null });
    });
  });

  /**
   * GAP-081 #1 (라운드 81 트랙 A) — **매달 1일의 구멍**을 순수 함수로 재현한다.
   *
   * 화면이 이 판정에 넘기던 이력은 이번 달 서버 캐시 하나였다(`["expenses", childId, 이번 달]`).
   * 그 배열은 매달 1일 아침에 **정의상 비어 있고**, 그러면 1순위(과거 기록) 갈래는 입력이 없어
   * 반드시 실패한다 — 남는 것은 2순위 정적 키워드 사전 하나이고, 사전에 없는 이름이면 분류는
   * 미선택이라 저장 버튼이 막힌다. 사용자의 이력은 하나도 사라지지 않았는데도.
   *
   * ⚠️ **이 절은 모듈 소스를 한 글자도 바꾸지 않는다.** 달라지는 것은 화면이 넘기는 배열의
   * 범위(한 달 → 두 달)뿐이고, 여기 선 단언들은 그 두 입력에 대한 **같은 규칙의 답**이다.
   */
  describe("GAP-081 #1 매달 1일 — 원천의 범위가 판정을 살린다 (규칙 무변경)", () => {
    /** 9월 1일 아침의 이번 달 캐시 — 정의상 빈 배열이다. */
    const CURRENT_MONTH_EMPTY: CategorySuggestionHistoryRow[] = [];
    /** 지난달(8월)에 이 사용자가 직접 그렇게 적어 둔 행. 사전에는 없는 이름이다. */
    const LAST_MONTH = [row({ itemName: "가습기", categoryId: ETC, spentOn: "2026-08-28" })];
    const unselected = { currentCategoryId: null, autoPicked: null, defaultCategoryId: null };

    it("오늘의 답(이번 달 캐시 하나): 근거가 없어 아무 타일도 눌리지 않는다", () => {
      expect(suggestCategoryId("가습기", CURRENT_MONTH_EMPTY)).toBeNull();
      // 그래서 저장 버튼이 분류를 요구한다(isCategoryMissingForSave) — 어제까지는 없던 탭이다.
      expect(resolveAutoCategorySelection({ ...unselected, itemName: "가습기", history: CURRENT_MONTH_EMPTY })).toEqual(
        { categoryId: null, autoPicked: null }
      );
    });

    it("넓힌 뒤(두 달을 이어 붙인 한 배열): 지난달에 적어 둔 그 분류가 다시 눌린다", () => {
      // 화면이 넘기는 배열은 [...이번 달, ...지난달] 하나다(new.tsx의 recentItemServerRows).
      const twoMonths = [...CURRENT_MONTH_EMPTY, ...LAST_MONTH];
      expect(suggestCategoryId("가습기", twoMonths)).toEqual({ categoryId: ETC, source: "history" });
      expect(resolveAutoCategorySelection({ ...unselected, itemName: "가습기", history: twoMonths })).toEqual({
        categoryId: ETC,
        autoPicked: { itemName: "가습기", categoryId: ETC }
      });
    });

    it("바이트 불변: 이번 달에 같은 등급의 이력이 있으면 답이 종전 그대로다 (최신이 이긴다)", () => {
      // 오늘 대다수 경로가 이것이다 — 2일부터 말일까지는 이번 달 캐시에 그 이름이 이미 있다.
      const thisMonth = [row({ itemName: "가습기", categoryId: TOYS, spentOn: "2026-09-12" })];
      const before = suggestCategoryId("가습기", thisMonth);
      const after = suggestCategoryId("가습기", [...thisMonth, ...LAST_MONTH]);
      expect(after).toEqual(before);
      expect(after).toEqual({ categoryId: TOYS, source: "history" });
    });

    /**
     * ⚠️ 답이 달라질 수 있는 **유일한 방향**을 값으로 적는다. 규칙은 종전 그대로다(매칭 등급이
     * 먼저, 동률이면 최신 행) — 지난달 행이 더 좋은 등급이면 그 행이 이기는 것은 이번 달 안에서
     * 이미 그랬던 일이고(오래된 완전일치가 최신 접두를 이긴다), 두 달을 이어 붙여도 같은 규칙이
     * 그대로 답을 정한다. 넓어진 것은 모집단이지 판정이 아니다.
     */
    it("달라지는 유일한 방향: 지난달 행이 더 좋은 등급이면 그 행이 이긴다 (등급 우선 규칙 그대로)", () => {
      const thisMonth = [row({ itemName: "가습기 필터", categoryId: TOYS, spentOn: "2026-09-12" })];
      const lastMonthExact = [row({ itemName: "가습기", categoryId: ETC, spentOn: "2026-08-28" })];
      // 이번 달만 보면 접두 매칭 하나뿐이다.
      expect(suggestCategoryId("가습기", thisMonth)).toEqual({ categoryId: TOYS, source: "history" });
      // 두 달을 합치면 완전일치가 생기고, 등급 우선 규칙이 그것을 고른다.
      expect(suggestCategoryId("가습기", [...thisMonth, ...lastMonthExact])).toEqual({
        categoryId: ETC,
        source: "history"
      });
    });

    it("어느 달에도 근거가 없으면 종전대로 2순위 키워드 사전으로 내려간다", () => {
      const twoMonths = [...CURRENT_MONTH_EMPTY, ...LAST_MONTH];
      expect(suggestCategoryId("물티슈", twoMonths)).toMatchObject({ categoryId: DIAPER, source: "keyword" });
      // 지난달 행이 선물/환불이거나 8타일 밖 분류면 여전히 근거로 삼지 않는다(달이 늘어도 같다).
      const lastMonthGift = [row({ itemName: "가습기", categoryId: ETC, spentOn: "2026-08-28", expenseType: "gift" })];
      expect(suggestCategoryId("가습기", [...CURRENT_MONTH_EMPTY, ...lastMonthGift])).toBeNull();
    });
  });

  it("같은 상태끼리는 같다고 판정한다 (화면 렌더 루프 방지)", () => {
    expect(isSameAutoPickedCategory(null, null)).toBe(true);
    expect(isSameAutoPickedCategory({ itemName: "물티슈", categoryId: DIAPER }, null)).toBe(false);
    expect(
      isSameAutoPickedCategory({ itemName: "물티슈", categoryId: DIAPER }, { itemName: "물티슈", categoryId: DIAPER })
    ).toBe(true);
    expect(
      isSameAutoPickedCategory({ itemName: "물티슈", categoryId: DIAPER }, { itemName: "물티슈 2팩", categoryId: DIAPER })
    ).toBe(false);
  });
});
