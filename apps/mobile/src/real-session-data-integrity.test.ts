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
    expect(homeSource).toContain("home.isLoading");
    expect(homeSource).toContain("home.isError");

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
});
