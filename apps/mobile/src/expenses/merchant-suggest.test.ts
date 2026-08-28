import { describe, expect, it } from "vitest";
import {
  buildMerchantSuggestions,
  buildRecentMerchantSuggestions,
  formatMerchantSuggestionChipLabel,
  merchantSuggestionChipAccessibilityLabel,
  MERCHANT_SUGGEST_LIMIT,
  MERCHANT_SUGGEST_RECENT_LIMIT,
  type MerchantSuggestSourceRow
} from "./merchant-suggest";
import { matchRecordSearch } from "./records-list-view";

function row(overrides: {
  merchant?: string | null;
  spentOn?: string;
  expenseType?: string;
}): MerchantSuggestSourceRow {
  return {
    // `?? "쿠팡"`이면 null을 넘긴 테스트가 조용히 기본값을 받는다 -- 키 유무로만 가른다.
    merchant: "merchant" in overrides ? overrides.merchant : "쿠팡",
    ...(overrides.spentOn !== undefined ? { spentOn: overrides.spentOn } : {}),
    ...(overrides.expenseType !== undefined ? { expenseType: overrides.expenseType } : {})
  };
}

function names(suggestions: { merchant: string }[]): string[] {
  return suggestions.map((suggestion) => suggestion.merchant);
}

describe("GAP-056 #2 판매처 자동완성", () => {
  it("친 글자가 들어간 판매처만 후보로 만든다", () => {
    const rows = [
      row({ merchant: "쿠팡", spentOn: "2026-08-20" }),
      row({ merchant: "이마트", spentOn: "2026-08-19" })
    ];

    expect(buildMerchantSuggestions("쿠", rows)).toEqual([
      { merchant: "쿠팡", count: 1, lastSpentOn: "2026-08-20" }
    ]);
    expect(buildMerchantSuggestions("없는곳", rows)).toEqual([]);
  });

  it("판정은 기록 탭 검색의 판매처 갈래와 같은 답을 낸다 (규칙 두 벌 금지)", () => {
    const rows = [row({ merchant: "쿠팡 로켓프레시", spentOn: "2026-08-20" })];
    // 중간 일치·대소문자·공백 접기 모두 검색과 같은 규칙이어야 한다.
    for (const query of ["로켓", "쿠팡  로켓", "쿠팡 로켓프레시", "이마트"]) {
      const searchHits = matchRecordSearch({ merchant: "쿠팡 로켓프레시", searchText: query }).kind === "merchant";
      const suggested = buildMerchantSuggestions(query, rows).length > 0;
      // 완전히 다 친 값은 제안하지 않는 규칙(아래 테스트)만 예외다.
      expect(suggested).toBe(searchHits && query.replace(/\s+/g, " ").trim() !== "쿠팡 로켓프레시");
    }
  });

  it("빈도 내림차순이 1순위다 (최근 한 번보다 자주 가는 곳)", () => {
    const rows = [
      row({ merchant: "이마트", spentOn: "2026-08-25" }),
      row({ merchant: "쿠팡", spentOn: "2026-08-20" }),
      row({ merchant: "쿠팡", spentOn: "2026-08-10" }),
      row({ merchant: "쿠팡", spentOn: "2026-08-02" })
    ];

    expect(buildMerchantSuggestions("", rows)).toEqual([
      { merchant: "쿠팡", count: 3, lastSpentOn: "2026-08-20" },
      { merchant: "이마트", count: 1, lastSpentOn: "2026-08-25" }
    ]);
  });

  it("빈도가 같으면 최근 기록이 먼저다", () => {
    const rows = [
      row({ merchant: "약국", spentOn: "2026-08-03" }),
      row({ merchant: "약국", spentOn: "2026-08-01" }),
      row({ merchant: "이마트", spentOn: "2026-08-24" }),
      row({ merchant: "이마트", spentOn: "2026-08-11" })
    ];

    expect(names(buildMerchantSuggestions("", rows))).toEqual(["이마트", "약국"]);
  });

  it("날짜가 없는 행은 맨 뒤로 간다 (없는 최근성을 지어내지 않는다)", () => {
    const rows = [row({ merchant: "무날짜상점" }), row({ merchant: "이마트", spentOn: "2026-08-01" })];

    expect(buildMerchantSuggestions("", rows)).toEqual([
      { merchant: "이마트", count: 1, lastSpentOn: "2026-08-01" },
      { merchant: "무날짜상점", count: 1, lastSpentOn: null }
    ]);
  });

  it("대소문자·앞뒤·연속 공백만 다른 상호는 한 후보로 묶고, 최신 표기를 보여 준다", () => {
    const rows = [
      row({ merchant: "  Coupang  ", spentOn: "2026-08-20" }),
      row({ merchant: "coupang", spentOn: "2026-08-10" }),
      row({ merchant: "COUPANG", spentOn: "2026-08-01" })
    ];

    expect(buildMerchantSuggestions("cou", rows)).toEqual([
      { merchant: "Coupang", count: 3, lastSpentOn: "2026-08-20" }
    ]);
  });

  it("판매처 안쪽 공백은 접기만 하고 지우지 않는다 (품목명 정규화와 다른 규칙)", () => {
    const rows = [row({ merchant: "쿠팡\n 로켓프레시", spentOn: "2026-08-20" })];
    expect(names(buildMerchantSuggestions("쿠팡 로켓", rows))).toEqual(["쿠팡 로켓프레시"]);
    // 공백을 통째로 지우는 규칙이었다면 이 검색어도 걸렸을 것이다 -- 걸리지 않아야 한다.
    expect(buildMerchantSuggestions("쿠팡로켓", rows)).toEqual([]);
  });

  it("이미 다 친 값과 똑같은 후보는 내지 않는다 (눌러도 바뀌는 것이 없다)", () => {
    const rows = [row({ merchant: "쿠팡", spentOn: "2026-08-20" }), row({ merchant: "쿠팡몰", spentOn: "2026-08-19" })];

    expect(names(buildMerchantSuggestions("쿠팡", rows))).toEqual(["쿠팡몰"]);
    expect(names(buildMerchantSuggestions("  쿠팡  ", rows))).toEqual(["쿠팡몰"]);
    // 표기가 다르면(대소문자 교정) 그대로 제안한다.
    expect(names(buildMerchantSuggestions("coupang", [row({ merchant: "Coupang", spentOn: "2026-08-20" })]))).toEqual([
      "Coupang"
    ]);
  });

  it("판매처가 없거나 공백뿐인 행, 선물·환불 행은 후보가 아니다", () => {
    const rows = [
      row({ merchant: null, spentOn: "2026-08-20" }),
      row({ merchant: "   ", spentOn: "2026-08-19" }),
      row({ merchant: "선물가게", spentOn: "2026-08-18", expenseType: "gift" }),
      row({ merchant: "환불가게", spentOn: "2026-08-17", expenseType: "refund" }),
      // 구버전/오프라인 행처럼 expenseType이 없으면 일반 지출로 본다(형제 모듈과 같은 규칙).
      row({ merchant: "이마트", spentOn: "2026-08-16" }),
      row({ merchant: "약국", spentOn: "2026-08-15", expenseType: "expense" })
    ];

    expect(names(buildMerchantSuggestions("", rows))).toEqual(["이마트", "약국"]);
  });

  it("캐시가 비면 빈 배열이다 (후보를 지어내지 않는다)", () => {
    expect(buildMerchantSuggestions("쿠", [])).toEqual([]);
    expect(buildMerchantSuggestions("", [])).toEqual([]);
    expect(buildRecentMerchantSuggestions([])).toEqual([]);
    // 판매처를 한 번도 적지 않은 달도 같다.
    expect(buildRecentMerchantSuggestions([row({ merchant: "", spentOn: "2026-08-20" })])).toEqual([]);
  });

  it("빈 입력이면 최근 판매처 상위 N을 돌려준다 (폼 포커스 칩)", () => {
    expect(MERCHANT_SUGGEST_RECENT_LIMIT).toBe(5);
    const rows = Array.from({ length: 7 }, (_, index) =>
      row({ merchant: `상점${index}`, spentOn: `2026-08-0${index + 1}` })
    );

    const chips = buildRecentMerchantSuggestions(rows);
    expect(chips).toHaveLength(5);
    expect(names(chips)).toEqual(["상점6", "상점5", "상점4", "상점3", "상점2"]);
    expect(buildMerchantSuggestions("", rows)).toEqual(chips);
    expect(buildRecentMerchantSuggestions(rows, 2)).toHaveLength(2);
  });

  it("타이핑 중 기본 상한은 3개이고, 0 이하 상한은 빈 배열이다", () => {
    expect(MERCHANT_SUGGEST_LIMIT).toBe(3);
    const rows = Array.from({ length: 6 }, (_, index) =>
      row({ merchant: `쿠팡 ${index}`, spentOn: `2026-08-0${index + 1}` })
    );

    expect(buildMerchantSuggestions("쿠팡", rows)).toHaveLength(3);
    expect(buildMerchantSuggestions("쿠팡", rows, { limit: 1 })).toHaveLength(1);
    expect(buildMerchantSuggestions("쿠팡", rows, { limit: 0 })).toEqual([]);
    expect(buildRecentMerchantSuggestions(rows, 0)).toEqual([]);
  });

  it("첫 글자를 쳐도 칩 순서가 뒤집히지 않는다 (같은 정렬로 좁혀지기만 한다)", () => {
    const rows = [
      row({ merchant: "쿠팡", spentOn: "2026-08-20" }),
      row({ merchant: "쿠팡", spentOn: "2026-08-12" }),
      row({ merchant: "쿠팡몰", spentOn: "2026-08-25" }),
      row({ merchant: "이마트", spentOn: "2026-08-26" })
    ];

    expect(names(buildRecentMerchantSuggestions(rows))).toEqual(["쿠팡", "이마트", "쿠팡몰"]);
    expect(names(buildMerchantSuggestions("쿠", rows))).toEqual(["쿠팡", "쿠팡몰"]);
  });

  it("칩 문구는 상호 그대로이고, 스크린리더 라벨은 출처를 말한다", () => {
    const suggestion = { merchant: "쿠팡", count: 3, lastSpentOn: "2026-08-20" };
    expect(formatMerchantSuggestionChipLabel(suggestion)).toBe("쿠팡");
    expect(merchantSuggestionChipAccessibilityLabel(suggestion)).toBe("판매처 쿠팡 입력");
  });
});
