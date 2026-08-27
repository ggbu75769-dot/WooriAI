import { describe, expect, it } from "vitest";
import {
  buildItemAutocompleteSuggestions,
  formatItemAutocompleteChipLabel,
  itemAutocompleteChipAccessibilityLabel,
  ITEM_AUTOCOMPLETE_LIMIT,
  type ItemAutocompleteSourceRow
} from "./item-autocomplete";

function row(overrides: {
  itemName: string;
  amountKrw?: number;
  categoryId?: string;
  spentOn?: string;
  expenseType?: string;
}): ItemAutocompleteSourceRow {
  return {
    itemName: overrides.itemName,
    amountKrw: overrides.amountKrw ?? 10000,
    categoryId: overrides.categoryId ?? "cat-diaper",
    ...(overrides.spentOn !== undefined ? { spentOn: overrides.spentOn } : {}),
    ...(overrides.expenseType !== undefined ? { expenseType: overrides.expenseType } : {})
  };
}

describe("UX-C 과거 항목 자동완성", () => {
  it("친 글자에 걸리는 과거 기록만 후보로 만든다", () => {
    const rows = [
      row({ itemName: "기저귀", amountKrw: 38500, categoryId: "cat-diaper", spentOn: "2026-08-20" }),
      row({ itemName: "분유", amountKrw: 29000, categoryId: "cat-feeding", spentOn: "2026-08-19" })
    ];

    expect(buildItemAutocompleteSuggestions("기저", rows)).toEqual([
      { itemName: "기저귀", amountKrw: 38500, categoryId: "cat-diaper" }
    ]);
  });

  it("빈 입력이면 아무것도 제안하지 않는다 (타이핑 연동 -- 상단 최근 품목 칩과 다른 트리거)", () => {
    const rows = [row({ itemName: "기저귀", spentOn: "2026-08-20" })];
    expect(buildItemAutocompleteSuggestions("", rows)).toEqual([]);
    expect(buildItemAutocompleteSuggestions("   ", rows)).toEqual([]);
  });

  it("완전일치 > 접두 > 포함 > 역포함 순으로 정렬한다", () => {
    const rows = [
      row({ itemName: "기저귀 정리함", spentOn: "2026-08-20" }),
      row({ itemName: "대형 기저귀 밴드형", spentOn: "2026-08-19" }),
      row({ itemName: "기저귀", spentOn: "2026-08-01" })
    ];

    expect(buildItemAutocompleteSuggestions("기저귀", rows).map((chip) => chip.itemName)).toEqual([
      "기저귀",
      "기저귀 정리함",
      "대형 기저귀 밴드형"
    ]);
  });

  it("같은 등급이면 최신 기록이 먼저 오고, 같은 품목명은 최신 금액 하나만 남는다", () => {
    const rows = [
      row({ itemName: "기저귀", amountKrw: 30000, spentOn: "2026-08-01" }),
      row({ itemName: "기저귀", amountKrw: 38500, spentOn: "2026-08-20" }),
      row({ itemName: "기저 매트", amountKrw: 12000, spentOn: "2026-08-10" })
    ];

    const suggestions = buildItemAutocompleteSuggestions("기저", rows);
    expect(suggestions).toEqual([
      { itemName: "기저귀", amountKrw: 38500, categoryId: "cat-diaper" },
      { itemName: "기저 매트", amountKrw: 12000, categoryId: "cat-diaper" }
    ]);
  });

  it("띄어쓰기만 다른 같은 품목은 하나로 묶는다", () => {
    const rows = [
      row({ itemName: "물티슈", amountKrw: 9900, spentOn: "2026-08-20" }),
      row({ itemName: "물 티슈", amountKrw: 8800, spentOn: "2026-08-10" })
    ];
    expect(buildItemAutocompleteSuggestions("물티", rows)).toEqual([
      { itemName: "물티슈", amountKrw: 9900, categoryId: "cat-diaper" }
    ]);
  });

  it("선물/환불 행과 금액이 유효하지 않은 행은 제안하지 않는다 (DNC-013과 같은 규칙)", () => {
    const rows = [
      row({ itemName: "유모차", amountKrw: 450000, spentOn: "2026-08-20", expenseType: "gift" }),
      row({ itemName: "유모차 커버", amountKrw: 0, spentOn: "2026-08-19" }),
      row({ itemName: "유모차 정리함", amountKrw: 12000.5, spentOn: "2026-08-18" }),
      row({ itemName: "  ", amountKrw: 1000, spentOn: "2026-08-17" }),
      // expenseType이 없는 레거시 행은 일반 지출로 간주한다.
      row({ itemName: "유모차 장난감", amountKrw: 15000, spentOn: "2026-08-16" })
    ];

    expect(buildItemAutocompleteSuggestions("유모차", rows).map((chip) => chip.itemName)).toEqual(["유모차 장난감"]);
  });

  it("기본 상한은 3개다", () => {
    expect(ITEM_AUTOCOMPLETE_LIMIT).toBe(3);
    const rows = Array.from({ length: 6 }, (_, index) =>
      row({ itemName: `기저귀 ${index}`, amountKrw: 1000 * (index + 1), spentOn: `2026-08-0${index + 1}` })
    );
    expect(buildItemAutocompleteSuggestions("기저귀", rows)).toHaveLength(3);
    expect(buildItemAutocompleteSuggestions("기저귀", rows, 1)).toHaveLength(1);
    expect(buildItemAutocompleteSuggestions("기저귀", rows, 0)).toEqual([]);
  });

  it("칩 문구와 스크린리더 라벨에 품목·금액·카테고리가 모두 들어간다", () => {
    const suggestion = { itemName: "기저귀", amountKrw: 38500, categoryId: "cat-diaper" };
    expect(formatItemAutocompleteChipLabel(suggestion, "기저귀/위생")).toBe("기저귀 38,500원 · 기저귀/위생");
    expect(itemAutocompleteChipAccessibilityLabel(suggestion, "기저귀/위생")).toBe(
      "기저귀 38,500원 기저귀/위생 한 번에 입력"
    );
  });

  it("카테고리 이름을 못 구하면 품목·금액까지만 보여 준다 (빈 구분자를 남기지 않는다)", () => {
    const suggestion = { itemName: "기저귀", amountKrw: 38500, categoryId: "cat-diaper" };
    expect(formatItemAutocompleteChipLabel(suggestion)).toBe("기저귀 38,500원");
    expect(formatItemAutocompleteChipLabel(suggestion, "  ")).toBe("기저귀 38,500원");
    expect(itemAutocompleteChipAccessibilityLabel(suggestion)).toBe("기저귀 38,500원 한 번에 입력");
  });
});
