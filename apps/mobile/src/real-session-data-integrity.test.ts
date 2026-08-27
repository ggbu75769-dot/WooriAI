import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const mobileRoot = process.cwd();
const source = (relativePath: string) => readFileSync(join(mobileRoot, relativePath), "utf8");

describe("Real session data integrity contract", () => {
  it("exposes the yearly report and household member removal API client functions", async () => {
    const client = await import("./api/client");

    expect(client.getYearlyReport).toEqual(expect.any(Function));
    expect(client.removeHouseholdMember).toEqual(expect.any(Function));
  });

  it("never falls back to preview/fixture data once a real session is present", () => {
    const homeSource = source("app/(tabs)/index.tsx");
    expect(homeSource).toContain("const hasSession = Boolean(authToken && childId);");
    expect(homeSource).toContain("const visibleHome = hasSession ? home.data! : previewHome;");
    // MOB-130: 로딩/에러 판정은 resolveScreenPhase가 한다 -- 손으로 적은
    // `home.isLoading || !home.data`가 에러 분기를 가로채던 형태로 되돌아가지 않는다.
    // 분기 순서 자체는 src/screen-phase.test.ts가 고정한다.
    expect(homeSource).toContain("isPending: home.isPending");
    expect(homeSource).toContain("isError: home.isError");
    expect(homeSource).toContain("hasData: Boolean(home.data)");

    const itemsSource = source("app/(tabs)/items.tsx");
    expect(itemsSource).toContain("const visibleItems = hasSession ? items.data!.items : previewItems;");

    const itemDetailSource = source("app/items/[itemTemplateId].tsx");
    expect(itemDetailSource).toContain("const visibleDetail = hasSession ? detail.data! : previewDetail(itemTemplateId);");

    const familySource = source("app/family/index.tsx");
    expect(familySource).toContain("const visibleMembers = hasSession ? members.data!.members : previewMembers;");
  });

  it("wires the home screen's 전체 보기 action to the records list", () => {
    const homeSource = source("app/(tabs)/index.tsx");

    expect(homeSource).toContain('accessibilityLabel="최근 지출 전체 보기"');
    expect(homeSource).toContain('router.push("/(tabs)/records")');
  });

  it("runs real monthly, quarterly, and yearly report queries when a session exists", () => {
    const reportSource = source("app/(tabs)/reports.tsx");

    expect(reportSource).toContain("getYearlyReport(authToken!, childId!, yearStart.getFullYear())");
    expect(reportSource).toContain('period === "분기"');
    expect(reportSource).toContain("quarterQueries");
    // REP-104: the category breakdown must follow the selected 월간/분기/연간 period
    // instead of the old period-less all-time call.
    expect(reportSource).toContain("getCategoryReport(authToken!, childId!, categoryPeriod)");
    expect(reportSource).not.toContain("dummyQuarterlyData");
  });

  /**
   * REP-128: 월간 탭의 6개월 추이 차트는 `getMonthlyReport`를 막대 하나당 한 번씩 6번 부르는
   * 워터폴이었다(useQueries). 서버가 한 번의 범위 질의로 접어 주는 `getTrendReport` 단일
   * 쿼리로 바뀌었고, 달 이동 시에는 캐시 키의 endYearMonth만 달라진다. 렌더 결과(막대 6개와
   * 라벨)는 그대로다 — 아래 monthlyTrendPoints 배선이 그것을 고정한다.
   */
  it("fetches the 월간 tab's 6-month trend in one request instead of six monthly calls (REP-128)", () => {
    const reportSource = source("app/(tabs)/reports.tsx");

    expect(reportSource).toContain("getTrendReport(authToken!, childId!, reportYearMonth, MONTHLY_TREND_MONTHS)");
    expect(reportSource).toContain('queryKey: ["report", "trend", childId, reportYearMonth, MONTHLY_TREND_MONTHS]');
    expect(reportSource).toContain("const MONTHLY_TREND_MONTHS = 6;");
    expect(reportSource).toContain("monthlyTrend.data!.months.map((month) => month.totalExpenseKrw)");

    // 워터폴 잔재가 되살아나지 않아야 한다: 추이용 useQueries도, 6개월 배열 생성도 없다.
    expect(reportSource).not.toContain("monthlyTrendQueries");
    expect(reportSource).not.toContain("monthlyTrendMonths");
    // getMonthlyReport 호출부는 세 곳만 남는다: 이번 달 카드, 지난 달 카드(둘 다 예산·
    // 카테고리 분해를 쓴다), 그리고 분기 탭의 3개월 useQueries. 추이용 호출은 없다.
    expect(reportSource.match(/getMonthlyReport\(/g) ?? []).toHaveLength(3);
    expect(reportSource).toContain("getMonthlyReport(authToken!, childId!, reportYearMonth)");
    expect(reportSource).toContain("getMonthlyReport(authToken!, childId!, previousMonthYearMonth)");
    expect(reportSource).toContain("getMonthlyReport(authToken!, childId!, ym)");
  });
});
