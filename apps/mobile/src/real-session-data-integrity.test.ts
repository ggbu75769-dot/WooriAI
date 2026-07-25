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

  it("makes the local fixture token unreachable in a production profile", () => {
    const clientSource = source("src/api/client.ts");
    const fixtureIdentifiersSource = source("src/api/fixture-identifiers.ts");
    const productionRuntimeSource = source("src/api/fixture-runtime.production.ts");
    const buildSource = source("../../scripts/build-android-apk.ts");
    expect(clientSource).toContain("internalFixtureRuntimeEnabled && token === fixtureSessionToken");
    expect(fixtureIdentifiersSource).toContain("isTestLoginBuild()");
    expect(productionRuntimeSource).toContain("fixtureRuntimeEnabled = false");
    expect(productionRuntimeSource).not.toContain("wooriai-local-session");
    expect(buildSource).toContain('production: "0"');
    expect(buildSource).toContain('EXPO_PUBLIC_PIXEL_LOCK: "0"');
  });

  it("never falls back to preview/fixture data once a real session is present", () => {
    const homeSource = source("app/(tabs)/index.tsx");
    const childScopeSource = source("src/query/child-scope.ts");
    expect(homeSource).toContain("const hasSession = childScopedRequestEnabled(authToken, childId);");
    expect(childScopeSource).toContain("return Boolean(authToken && childId);");
    expect(homeSource).toContain("const visibleHome = hasSession ? home.data : isPixelLockMode ? previewHome : null;");
    expect(homeSource).toContain('if (!hasSession && !isPixelLockMode)');
    expect(homeSource).toContain("home.isLoading");
    expect(homeSource).toContain("home.isError");

    const itemsSource = source("app/(tabs)/items.tsx");
    const preparationSource = source("src/preparation/Release4PreparationScreen.tsx");
    expect(itemsSource).toContain("isPixelLockMode ? <PixelItemsScreen /> : <Release4PreparationScreen />");
    expect(preparationSource).toContain("const hasSession = Boolean(token && activeContextKey);");
    expect(preparationSource).toContain("enabled: hasSession");
    expect(preparationSource).toContain("PreparationListParity");

    const itemDetailSource = source("app/items/[itemTemplateId].tsx");
    expect(itemDetailSource).toContain("const visibleDetail = hasSession ? detail.data! : previewDetail(itemTemplateId);");
    expect(itemDetailSource).toContain('if (!hasSession && !isPixelLockMode)');

    const familySource = source("app/family/index.tsx");
    expect(familySource).toContain("const visibleMembers = hasSession ? members.data!.members : previewMembers;");
    expect(familySource).toContain('if (!hasSession && !isPixelLockMode)');
  });

  it("wires the home screen's 전체 보기 action to the records list", () => {
    const homeSource = source("app/(tabs)/index.tsx");

    expect(homeSource).toContain('accessibilityLabel="최근 기록 전체 보기"');
    expect(homeSource).toContain('router.push("/(tabs)/records")');
  });

  it("runs real monthly, quarterly, and yearly report queries when a session exists", () => {
    const reportSource = source("app/(tabs)/reports.tsx");

    expect(reportSource).toContain("getYearlyReport(authToken!, childId!, yearStart.getFullYear())");
    expect(reportSource).toContain('period === "분기"');
    expect(reportSource).toContain("quarterQueries");
    expect(reportSource).toContain("categoryYearMonths");
    expect(reportSource).toContain("getCategoryReport(authToken!, childId!, yearMonth)");
    expect(reportSource).not.toContain("getCategoryReport(authToken!, childId!)");
    expect(reportSource).toContain('<ScreenScaffold testID="release4-report-screen">');
    expect(reportSource).toContain('<TopAppBar title="리포트" />');
    expect(reportSource).toContain("AccessibleDataTable");
    expect(reportSource).toContain("getReportV3(authToken!, childId!, reportApiPeriod, reportAnchor)");
    expect(reportSource).not.toContain("getReportV2Summary(");
    expect(reportSource).not.toContain("getReportV2Categories(");
    expect(reportSource).toContain('reportState.displayState === "planned_only"');
    expect(reportSource).toContain('reportState.displayState === "complete_empty"');
    expect(reportSource).toContain("남은 예정 비용");
    expect(reportSource).toContain("기록이 충분하지 않아 예측을 만들지 않았어요.");
    expect(reportSource).not.toContain("dummyQuarterlyData");
  });
});
