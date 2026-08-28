import { describe, expect, it } from "vitest";
import {
  buildCategoryDrilldownTarget,
  categoryDrilldownHint,
  categoryDrilldownNote,
  drilldownMonthLabel,
  isDrilldownCategoryId,
  RECORDS_TAB_PATHNAME,
  resolveDrilldownCategoryIdParam,
  resolveDrilldownMonth
} from "./category-drilldown";

const TODAY = "2026-08-27";

describe("C-03 착지 월 규칙", () => {
  it("lands on the month being viewed for the 월간 tab", () => {
    expect(resolveDrilldownMonth({ startYearMonth: "2026-06", monthCount: 1, todayIso: TODAY })).toBe("2026-06");
    expect(resolveDrilldownMonth({ startYearMonth: "2026-08", monthCount: 1, todayIso: TODAY })).toBe("2026-08");
  });

  it("lands on the current month while the quarter/year is still running", () => {
    // 2026년 3분기(7~9월)를 8월에 보는 중.
    expect(resolveDrilldownMonth({ startYearMonth: "2026-07", monthCount: 3, todayIso: TODAY })).toBe("2026-08");
    // 2026년 연간을 8월에 보는 중.
    expect(resolveDrilldownMonth({ startYearMonth: "2026-01", monthCount: 12, todayIso: TODAY })).toBe("2026-08");
  });

  it("lands on the period's last month once the period is over", () => {
    expect(resolveDrilldownMonth({ startYearMonth: "2026-04", monthCount: 3, todayIso: TODAY })).toBe("2026-06");
    expect(resolveDrilldownMonth({ startYearMonth: "2025-01", monthCount: 12, todayIso: TODAY })).toBe("2025-12");
  });

  it("never leaves the period, even for a wholly-future one (navigation blocks it anyway)", () => {
    expect(resolveDrilldownMonth({ startYearMonth: "2027-01", monthCount: 12, todayIso: TODAY })).toBe("2027-01");
  });

  it("refuses to guess a month from an unparseable period", () => {
    expect(resolveDrilldownMonth({ startYearMonth: "2026-13", monthCount: 12, todayIso: TODAY })).toBeNull();
    expect(resolveDrilldownMonth({ startYearMonth: "2026-01", monthCount: 0, todayIso: TODAY })).toBeNull();
    expect(resolveDrilldownMonth({ startYearMonth: "2026-01", monthCount: 12, todayIso: "2026-08" })).toBeNull();
  });
});

describe("C-03 드릴다운 링크", () => {
  it("builds the records-tab link the month param convention already understands", () => {
    expect(
      buildCategoryDrilldownTarget({
        startYearMonth: "2026-01",
        monthCount: 12,
        todayIso: TODAY,
        categoryId: "cat-diaper"
      })
    ).toEqual({ pathname: RECORDS_TAB_PATHNAME, params: { month: "2026-08", categoryId: "cat-diaper" } });
    expect(RECORDS_TAB_PATHNAME).toBe("/(tabs)/records");
  });

  it("returns null rather than navigating somewhere arbitrary", () => {
    const period = { startYearMonth: "2026-01", monthCount: 12, todayIso: TODAY };
    expect(buildCategoryDrilldownTarget({ ...period, categoryId: undefined })).toBeNull();
    expect(buildCategoryDrilldownTarget({ ...period, categoryId: "" })).toBeNull();
    expect(buildCategoryDrilldownTarget({ ...period, categoryId: "../../settings" })).toBeNull();
    expect(buildCategoryDrilldownTarget({ ...period, todayIso: "nope", categoryId: "cat-diaper" })).toBeNull();
  });

  it("accepts both server UUIDs and the mobile quick-tile alias ids", () => {
    expect(isDrilldownCategoryId("2f1c1b2e-4a5f-4c11-9d2b-1a2b3c4d5e6f")).toBe(true);
    expect(isDrilldownCategoryId("mobile_etc")).toBe(true);
    expect(isDrilldownCategoryId("기저귀")).toBe(false);
    expect(isDrilldownCategoryId("a b")).toBe(false);
    expect(isDrilldownCategoryId("x".repeat(65))).toBe(false);
    expect(isDrilldownCategoryId(42)).toBe(false);
  });
});

describe("C-03 착지 월을 누르기 전에 말한다", () => {
  it("labels the landing month for the hint", () => {
    expect(drilldownMonthLabel("2026-08")).toBe("2026년 8월");
    expect(drilldownMonthLabel("2026-8")).toBeNull();
    expect(categoryDrilldownHint("2026-08")).toBe("두 번 누르면 2026년 8월 기록에서 이 카테고리만 볼 수 있어요");
    expect(categoryDrilldownHint("nope")).toBeNull();
  });

  it("only adds the visible note when the period is more than one month", () => {
    expect(categoryDrilldownNote("2026-08", 12)).toBe("카테고리를 누르면 2026년 8월 기록을 보여드려요");
    expect(categoryDrilldownNote("2026-08", 3)).toBe("카테고리를 누르면 2026년 8월 기록을 보여드려요");
    // 월간 탭: 착지 월이 보고 있는 달 그대로라 말할 것이 없다.
    expect(categoryDrilldownNote("2026-08", 1)).toBeNull();
  });
});

describe("C-03 기록 탭이 읽는 categoryId 파라미터", () => {
  it("takes the first value and ignores anything malformed", () => {
    expect(resolveDrilldownCategoryIdParam("cat-diaper")).toBe("cat-diaper");
    expect(resolveDrilldownCategoryIdParam(["cat-diaper", "cat-other"])).toBe("cat-diaper");
    expect(resolveDrilldownCategoryIdParam(undefined)).toBeNull();
    expect(resolveDrilldownCategoryIdParam(null)).toBeNull();
    expect(resolveDrilldownCategoryIdParam("")).toBeNull();
    expect(resolveDrilldownCategoryIdParam("<script>")).toBeNull();
    expect(resolveDrilldownCategoryIdParam([])).toBeNull();
  });

  it("round-trips what the report side puts on the link", () => {
    const target = buildCategoryDrilldownTarget({
      startYearMonth: "2026-07",
      monthCount: 3,
      todayIso: TODAY,
      categoryId: "mobile_etc"
    });
    expect(resolveDrilldownCategoryIdParam(target!.params.categoryId)).toBe("mobile_etc");
  });
});
