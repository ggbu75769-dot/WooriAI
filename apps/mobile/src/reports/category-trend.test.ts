import { describe, expect, it } from "vitest";

import {
  buildCategoryTrendChips,
  buildCategoryTrendView,
  buildCategoryTrendWindow,
  CATEGORY_TREND_EMPTY_TEXT,
  CATEGORY_TREND_MONTH_COUNT,
  CATEGORY_TREND_NO_RECORD_NOTE,
  CATEGORY_TREND_SECTION_GUIDE,
  type CategoryTrendMonthInput
} from "./category-trend";

/** 여섯 달 성공 응답 한 벌 — 필요한 달만 덮어쓴다. */
function successMonths(
  window: string[],
  byMonth: Record<string, CategoryTrendMonthInput["categories"]> = {}
): CategoryTrendMonthInput[] {
  return window.map((yearMonth) => ({
    yearMonth,
    status: "success" as const,
    categories: byMonth[yearMonth] ?? []
  }));
}

describe("buildCategoryTrendWindow — 6개월 창 산출", () => {
  it("보고 있는 달로 끝나는 오름차순 6개월을 만든다", () => {
    expect(buildCategoryTrendWindow("2026-08")).toEqual([
      "2026-03",
      "2026-04",
      "2026-05",
      "2026-06",
      "2026-07",
      "2026-08"
    ]);
  });

  it("연 경계를 넘는 창은 앞해의 달을 정확히 센다", () => {
    expect(buildCategoryTrendWindow("2026-01")).toEqual([
      "2025-08",
      "2025-09",
      "2025-10",
      "2025-11",
      "2025-12",
      "2026-01"
    ]);
    // 창 전체가 앞해에 걸치는 2월 끝 창도 같은 산술이다.
    expect(buildCategoryTrendWindow("2026-02")).toEqual([
      "2025-09",
      "2025-10",
      "2025-11",
      "2025-12",
      "2026-01",
      "2026-02"
    ]);
  });

  it("기본 크기는 월간 총액 추이와 같은 6이다", () => {
    expect(CATEGORY_TREND_MONTH_COUNT).toBe(6);
    expect(buildCategoryTrendWindow("2026-08")).toHaveLength(CATEGORY_TREND_MONTH_COUNT);
  });

  it("형식이 어긋난 입력으로는 창을 지어내지 않는다", () => {
    for (const bad of ["2026-8", "2026/08", "2026-13", "2026-00", "", "202608"]) {
      expect(buildCategoryTrendWindow(bad), bad).toBeNull();
    }
    expect(buildCategoryTrendWindow("2026-08", 0)).toBeNull();
    expect(buildCategoryTrendWindow("2026-08", 2.5)).toBeNull();
  });

  it("크기를 넘기면 그 개월 수로 끝 달을 포함해 만든다", () => {
    expect(buildCategoryTrendWindow("2026-03", 3)).toEqual(["2026-01", "2026-02", "2026-03"]);
  });
});

describe("buildCategoryTrendChips — 칩 모집단", () => {
  it("0원·음수·비정상 금액과 id 없는 조각을 떨어뜨리고 순서를 지킨다", () => {
    expect(
      buildCategoryTrendChips([
        { label: "기저귀/위생", amountKrw: 45_900, categoryId: "cat-diaper" },
        { label: "분유/유제품", amountKrw: 0, categoryId: "cat-formula" },
        { label: "의류/잡화", amountKrw: -100, categoryId: "cat-clothes" },
        { label: "장난감/도서", amountKrw: Number.NaN, categoryId: "cat-toys" },
        { label: "이름뿐", amountKrw: 10_000 },
        { label: "세제", amountKrw: 18_900, categoryId: "cat-detergent" }
      ])
    ).toEqual([
      { categoryId: "cat-diaper", label: "기저귀/위생" },
      { categoryId: "cat-detergent", label: "세제" }
    ]);
  });

  it("입력이 없으면 빈 목록이다(카드 자체가 서지 않는다)", () => {
    expect(buildCategoryTrendChips(undefined)).toEqual([]);
    expect(buildCategoryTrendChips(null)).toEqual([]);
    expect(buildCategoryTrendChips([])).toEqual([]);
  });
});

describe("buildCategoryTrendView — 표시 판정", () => {
  const window = buildCategoryTrendWindow("2026-08")!;

  it("여섯 달이 다 오면 막대·요약·낭독을 만든다 (금액은 그 카테고리 항목의 합)", () => {
    const view = buildCategoryTrendView({
      categoryId: "cat-diaper",
      categoryLabel: "기저귀/위생",
      months: successMonths(window, {
        "2026-03": [{ categoryId: "cat-diaper", amountKrw: 30_000, count: 2 }],
        "2026-05": [
          { categoryId: "cat-diaper", amountKrw: 20_000, count: 1 },
          { categoryId: "cat-diaper", amountKrw: 10_000, count: 1 },
          { categoryId: "cat-formula", amountKrw: 99_000, count: 1 }
        ],
        "2026-08": [{ categoryId: "cat-diaper", amountKrw: 60_000, count: 3 }]
      })
    });
    expect(view.kind).toBe("ready");
    if (view.kind !== "ready") return;
    expect(view.bars.map((bar) => bar.amountKrw)).toEqual([30_000, 0, 30_000, 0, 0, 60_000]);
    expect(view.bars.map((bar) => bar.monthLabel)).toEqual(["3월", "4월", "5월", "6월", "7월", "8월"]);
    // 다른 카테고리 금액(99,000)은 섞이지 않는다.
    expect(view.summaryText).toBe("2026년 3월~8월 합계 120,000원");
    // 최대(8월 60,000) 대비 비율 — 화면은 여기에 높이만 곱한다.
    expect(view.bars.map((bar) => bar.heightRatio)).toEqual([0.5, 0, 0.5, 0, 0, 1]);
  });

  it("낭독은 달·금액 전부를 말하고, 기록 없는 달은 0원 대신 '기록 없음'이라 말한다", () => {
    const view = buildCategoryTrendView({
      categoryId: "cat-diaper",
      categoryLabel: "기저귀/위생",
      months: successMonths(window, {
        // 4월: 기록은 있는데 이 카테고리는 0원 — 낭독도 0원(사실).
        "2026-04": [{ categoryId: "cat-formula", amountKrw: 5_000, count: 1 }],
        "2026-08": [{ categoryId: "cat-diaper", amountKrw: 12_000, count: 1 }]
      })
    });
    expect(view.kind).toBe("ready");
    if (view.kind !== "ready") return;
    expect(view.accessibilityLabel).toBe(
      "기저귀/위생 월별 추이 차트, 2026년 3월~8월, " +
        "3월 기록 없음, 4월 0원, 5월 기록 없음, 6월 기록 없음, 7월 기록 없음, 8월 12,000원"
    );
    // 기록 없는 달이 섞였으므로 보이는 쪽에도 구분 문구가 선다.
    expect(view.emptyMonthNote).toBe(CATEGORY_TREND_NO_RECORD_NOTE);
    // 기록 있는 0원 달과 기록 없는 달이 막대 판정에서도 갈린다.
    expect(view.bars[1]).toMatchObject({ amountKrw: 0, hasRecords: true });
    expect(view.bars[0]).toMatchObject({ amountKrw: 0, hasRecords: false });
  });

  it("여섯 달 전부에 기록이 있으면 구분 문구는 서지 않는다", () => {
    const byMonth = Object.fromEntries(
      window.map((yearMonth, index) => [
        yearMonth,
        [{ categoryId: "cat-diaper", amountKrw: (index + 1) * 1_000, count: 1 }]
      ])
    );
    const view = buildCategoryTrendView({
      categoryId: "cat-diaper",
      categoryLabel: "기저귀/위생",
      months: successMonths(window, byMonth)
    });
    expect(view.kind).toBe("ready");
    if (view.kind !== "ready") return;
    expect(view.emptyMonthNote).toBeNull();
  });

  it("연 경계를 넘는 창은 양끝에 해를 다 적는다", () => {
    const crossWindow = buildCategoryTrendWindow("2026-01")!;
    const view = buildCategoryTrendView({
      categoryId: "cat-diaper",
      categoryLabel: "기저귀/위생",
      months: successMonths(crossWindow, {
        "2025-11": [{ categoryId: "cat-diaper", amountKrw: 7_000, count: 1 }]
      })
    });
    expect(view.kind).toBe("ready");
    if (view.kind !== "ready") return;
    expect(view.summaryText).toBe("2025년 8월~2026년 1월 합계 7,000원");
    expect(view.accessibilityLabel).toContain("2025년 8월~2026년 1월");
  });

  it("여섯 달 전부 0원이면 막대 대신 빈 상태 한 줄이다 (카테고리 0건)", () => {
    const view = buildCategoryTrendView({
      categoryId: "cat-diaper",
      categoryLabel: "기저귀/위생",
      months: successMonths(window, {
        "2026-06": [{ categoryId: "cat-formula", amountKrw: 5_000, count: 1 }]
      })
    });
    expect(view).toEqual({ kind: "empty", text: CATEGORY_TREND_EMPTY_TEXT });
  });

  it("하나라도 실패하면 부분 차트 대신 실패 상태다 (문구는 화면의 공용 단일 소스 몫)", () => {
    const months = successMonths(window, {
      "2026-08": [{ categoryId: "cat-diaper", amountKrw: 12_000, count: 1 }]
    });
    months[2] = { yearMonth: window[2], status: "error" };
    expect(
      buildCategoryTrendView({ categoryId: "cat-diaper", categoryLabel: "기저귀/위생", months })
    ).toEqual({ kind: "error" });
  });

  it("실패는 로딩보다 먼저다 — 남은 달을 기다려도 부분 차트가 되지는 않는다", () => {
    const months: CategoryTrendMonthInput[] = window.map((yearMonth) => ({ yearMonth, status: "pending" }));
    months[0] = { yearMonth: window[0], status: "error" };
    expect(
      buildCategoryTrendView({ categoryId: "cat-diaper", categoryLabel: "기저귀/위생", months }).kind
    ).toBe("error");
  });

  it("아직 다 안 왔으면(실패 0건) 로딩이다 — 빈 입력도 로딩으로 둔다", () => {
    const months = successMonths(window);
    months[5] = { yearMonth: window[5], status: "pending" };
    expect(buildCategoryTrendView({ categoryId: "cat-diaper", categoryLabel: "기저귀/위생", months })).toEqual({
      kind: "loading"
    });
    expect(buildCategoryTrendView({ categoryId: "cat-diaper", categoryLabel: "기저귀/위생", months: [] })).toEqual({
      kind: "loading"
    });
  });

  it("비정상 금액은 더하지 않고, count만 있는 달도 '기록 있음'으로 읽는다", () => {
    const view = buildCategoryTrendView({
      categoryId: "cat-diaper",
      categoryLabel: "기저귀/위생",
      months: successMonths(window, {
        "2026-07": [
          { categoryId: "cat-diaper", amountKrw: Number.NaN, count: 1 },
          { categoryId: "cat-diaper", amountKrw: -5_000, count: 1 }
        ],
        "2026-08": [{ categoryId: "cat-diaper", amountKrw: 9_000, count: 1 }]
      })
    });
    expect(view.kind).toBe("ready");
    if (view.kind !== "ready") return;
    expect(view.bars[4]).toMatchObject({ amountKrw: 0, hasRecords: true });
  });

  it("문구는 해요체이고(DNC-018) 평가·재촉이 없다", () => {
    for (const copy of [CATEGORY_TREND_SECTION_GUIDE, CATEGORY_TREND_EMPTY_TEXT, CATEGORY_TREND_NO_RECORD_NOTE]) {
      expect(copy.endsWith("요.")).toBe(true);
      expect(copy).not.toContain("아껴");
      expect(copy).not.toContain("절약");
    }
  });
});
