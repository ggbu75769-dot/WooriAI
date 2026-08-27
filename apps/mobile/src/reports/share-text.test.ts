import { describe, expect, it } from "vitest";
import { buildMonthlyInsight } from "./monthly-insight";
import {
  buildMonthlyShareMessage,
  joinShareLines,
  partialMonthRangeLine,
  SHARE_APP_LINE,
  shareTopCategoryLine,
  shareTotalLine
} from "./share-text";

const categoryLabel = (categoryId: string) =>
  ({ "cat-diaper": "기저귀/위생", "cat-feed": "수유/이유식", "cat-cloth": "의류" })[categoryId] ?? "기타";

/**
 * 월간 요약 공유는 화면이 그린 인사이트를 그대로 싣는다. 그래서 테스트도 문장을 손으로
 * 짓지 않고 `buildMonthlyInsight`를 그대로 돌려(화면과 같은 경로) 그 결과를 넘긴다 --
 * 인사이트 문구가 바뀌면 공유 문구도 자동으로 따라간다(DNC-013/015).
 */
function insightFor(overrides: {
  yearMonth: string;
  todayIso: string;
  totalExpenseKrw: number;
  budgetAmountKrw?: number | null;
  previousMonthTotalKrw?: number | null;
}) {
  return buildMonthlyInsight({
    yearMonth: overrides.yearMonth,
    todayIso: overrides.todayIso,
    totalExpenseKrw: overrides.totalExpenseKrw,
    budgetAmountKrw: overrides.budgetAmountKrw ?? null,
    categoryTop: [
      { categoryId: "cat-diaper", amountKrw: 400_000 },
      { categoryId: "cat-feed", amountKrw: 300_000 },
      { categoryId: "cat-cloth", amountKrw: 300_000 }
    ],
    categoryLabel,
    previousMonthTotalKrw: overrides.previousMonthTotalKrw ?? null
  });
}

describe("UX-H 공유 문구 조각", () => {
  it("금액 줄은 앱 전역 포맷(formatKrw)을 그대로 쓴다", () => {
    expect(shareTotalLine(1_245_700)).toBe("함께한 지출 1,245,700원");
    expect(shareTotalLine(0)).toBe("함께한 지출 0원");
    expect(shareTotalLine(1_245_700)).not.toContain("₩");
  });

  it("카테고리 줄은 '·'로 잇고, 이름이 없으면 줄 자체를 만들지 않는다", () => {
    expect(shareTopCategoryLine(["기저귀/위생"])).toBe("가장 많이 준비한 것: 기저귀/위생");
    expect(shareTopCategoryLine(["기저귀/위생", "수유/이유식"])).toBe("가장 많이 준비한 것: 기저귀/위생·수유/이유식");
    expect(shareTopCategoryLine([])).toBeNull();
    expect(shareTopCategoryLine(["", "  "])).toBeNull();
  });

  it("진행 중인 달의 구간 줄은 오늘까지를 명시한다", () => {
    expect(partialMonthRangeLine("2026-08", "2026-08-27")).toBe("8월 1일~27일 기준");
    // 달의 첫날이면 하루치라는 사실이 그대로 드러난다.
    expect(partialMonthRangeLine("2026-08", "2026-08-01")).toBe("8월 1일~1일 기준");
    // 보고 있는 달이 오늘의 달이 아니면 구간 줄이 없다(머리글의 달 이름이 곧 구간).
    expect(partialMonthRangeLine("2026-07", "2026-08-27")).toBeNull();
    expect(partialMonthRangeLine("2026-8", "2026-08-27")).toBeNull();
    expect(partialMonthRangeLine("2026-08", "2026-08")).toBeNull();
  });

  it("빈 줄은 걸러 내고 개행으로 잇는다", () => {
    expect(joinShareLines(["a", null, "b", undefined, "   ", "c"])).toBe("a\nb\nc");
    expect(joinShareLines([null, undefined])).toBe("");
  });
});

describe("UX-H 월간 요약 공유 문구", () => {
  it("진행 중인 달은 '8월 1일~27일 기준'을 금액 바로 아래에 밝힌다", () => {
    const insight = insightFor({ yearMonth: "2026-08", todayIso: "2026-08-27", totalExpenseKrw: 1_000_000 });
    const message = buildMonthlyShareMessage({
      yearMonth: "2026-08",
      monthLabel: "2026년 8월",
      todayIso: "2026-08-27",
      childName: "다온이",
      totalExpenseKrw: 1_000_000,
      insight
    });

    expect(message).not.toBeNull();
    expect(message!.split("\n")).toEqual([
      "📊 다온이의 2026년 8월",
      "함께한 지출 1,000,000원",
      "8월 1일~27일 기준",
      insight!.headline,
      SHARE_APP_LINE
    ]);
  });

  it("이미 끝난 달에는 구간 줄을 붙이지 않는다 (머리글의 달 이름이 곧 구간)", () => {
    const insight = insightFor({
      yearMonth: "2026-07",
      todayIso: "2026-08-27",
      totalExpenseKrw: 1_000_000,
      previousMonthTotalKrw: 1_200_000
    });
    const message = buildMonthlyShareMessage({
      yearMonth: "2026-07",
      monthLabel: "2026년 7월",
      todayIso: "2026-08-27",
      childName: "다온이",
      totalExpenseKrw: 1_000_000,
      insight
    });

    expect(message).not.toBeNull();
    expect(message).not.toContain("기준");
    expect(message!.split("\n")).toEqual([
      "📊 다온이의 2026년 7월",
      "함께한 지출 1,000,000원",
      insight!.headline,
      SHARE_APP_LINE
    ]);
  });

  it("금액은 화면이 그린 총액을 그대로 쓰고 formatKrw 포맷을 지킨다", () => {
    const message = buildMonthlyShareMessage({
      yearMonth: "2026-08",
      monthLabel: "2026년 8월",
      todayIso: "2026-08-27",
      childName: "다온이",
      totalExpenseKrw: 1_245_700,
      insight: insightFor({ yearMonth: "2026-08", todayIso: "2026-08-27", totalExpenseKrw: 1_245_700 })
    });

    expect(message).toContain("함께한 지출 1,245,700원");
    expect(message).not.toContain("₩");
    expect(message).not.toContain("1245700");
  });

  it("화면 카드의 첫 문장만 싣는다 -- 예산·하루 평균은 가족에게 보내는 카드에 얹지 않는다", () => {
    const insight = insightFor({
      yearMonth: "2026-08",
      todayIso: "2026-08-27",
      totalExpenseKrw: 1_000_000,
      budgetAmountKrw: 1_500_000
    });
    // 화면 카드는 두 문장이다(카테고리 1위 + 예산·하루 평균).
    expect(insight!.detail).not.toBeNull();

    const message = buildMonthlyShareMessage({
      yearMonth: "2026-08",
      monthLabel: "2026년 8월",
      todayIso: "2026-08-27",
      childName: "다온이",
      totalExpenseKrw: 1_000_000,
      insight
    });

    expect(message).toContain(insight!.headline);
    expect(message).not.toContain(insight!.detail!);
    expect(message).not.toContain("예산");
    expect(message!.split("\n")).toHaveLength(5);
  });

  it("말할 근거가 없으면(인사이트 없음·총액 0원) null이라 공유 버튼도 붙지 않는다", () => {
    const base = {
      yearMonth: "2026-08",
      monthLabel: "2026년 8월",
      todayIso: "2026-08-27",
      childName: "다온이"
    };

    expect(buildMonthlyShareMessage({ ...base, totalExpenseKrw: 1_000_000, insight: null })).toBeNull();
    expect(
      buildMonthlyShareMessage({
        ...base,
        totalExpenseKrw: 0,
        insight: insightFor({ yearMonth: "2026-08", todayIso: "2026-08-27", totalExpenseKrw: 1_000_000 })
      })
    ).toBeNull();
  });

  it("앱 홍보는 마지막 한 줄뿐이고, 식별 정보는 넘긴 아이 이름 하나뿐이다", () => {
    const message = buildMonthlyShareMessage({
      yearMonth: "2026-08",
      monthLabel: "2026년 8월",
      todayIso: "2026-08-27",
      childName: "콩콩이",
      totalExpenseKrw: 1_000_000,
      insight: insightFor({ yearMonth: "2026-08", todayIso: "2026-08-27", totalExpenseKrw: 1_000_000 })
    });

    expect(message!.endsWith(SHARE_APP_LINE)).toBe(true);
    expect(message!.split("\n").filter((line) => line.includes("우리아이 앱"))).toHaveLength(1);
    expect(message).toContain("콩콩이");
    expect(message).not.toContain("@");
    expect(message).not.toContain("cat-diaper");
    expect(message).not.toMatch(/https?:\/\//);
  });

  /** DNC-018: 사실 서술만. 평가·조언·죄책감 문구가 공유 문구로 새 나가지 않는다. */
  it("keeps the tone factual -- no 칭찬/조언/죄책감 문구", () => {
    const message = buildMonthlyShareMessage({
      yearMonth: "2026-08",
      monthLabel: "2026년 8월",
      todayIso: "2026-08-27",
      childName: "다온이",
      totalExpenseKrw: 1_000_000,
      insight: insightFor({ yearMonth: "2026-08", todayIso: "2026-08-27", totalExpenseKrw: 1_000_000 })
    })!;

    for (const banned of ["잘하고 있어요", "줄여보세요", "아껴", "최고예요", "절약"]) {
      expect(message, banned).not.toContain(banned);
    }
  });
});
