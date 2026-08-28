import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const mobileRoot = process.cwd();
const source = (relativePath: string) => readFileSync(join(mobileRoot, relativePath), "utf8");

/**
 * 라운드 52 T2 배선 계약 — C-02(미래 달 0원 절벽) · C-03(카테고리 드릴다운).
 * (readFileSync 계약 테스트 관례는 src/reports/monthly-insight-flow.test.ts와 같다 —
 * 리포트/기록 탭은 vitest에서 렌더되지 않는다.)
 */

describe("C-02 분기·연간 추이의 미래 달 절벽", () => {
  const reportSource = source("app/(tabs)/reports.tsx");

  it("routes the quarter/year points through the pure trimming module", () => {
    expect(reportSource).toContain('from "../../src/reports/period-trend-points"');
    expect(reportSource).toContain("buildPeriodTrendPoints({");
    expect(reportSource).toContain("todayIso: seoulToday");
    // 잘린 배열이 실제로 차트에 간다 -- 원본 quarterPoints/yearlyPoints를 그대로 넘기지 않는다.
    expect(reportSource).toContain('const activePoints = period === "월간" ? monthlyTrendPoints : periodTrend.points;');
  });

  it("leaves the 월간 tab and the server untouched", () => {
    // 월간 탭은 종전 그대로(getTrendReport는 선택한 달로 끝나는 6개월이라 미래 달이 없다).
    expect(reportSource).toContain("evaluateTrendDirection({ points: monthlyTrendPoints, monthStatus })");
    // 서버 응답을 자르는 것이지 요청을 바꾸는 것이 아니다.
    expect(reportSource.match(/getYearlyReport\(/g) ?? []).toHaveLength(1);
    expect(reportSource.match(/getMonthlyReport\(/g) ?? []).toHaveLength(3);
  });

  it("draws the truncation as a fact under the chart, session-only", () => {
    expect(reportSource).toContain("{periodTrend.caption ? (");
    expect(reportSource).toContain('testID="reports-period-trend-caption"');
    expect(reportSource).toContain("accessibilityLabel={periodTrend.accessibilityLabel ?? periodTrend.caption}");
    // REP-001 픽셀락: 캡션은 세션 분기(activeIsError/activeIsLoading을 지난 뒤) 안에만 있고,
    // 비세션 미리보기 분기는 LineChartCard/DonutChartCard 두 줄 그대로다.
    const previewStart = reportSource.indexOf("{!hasSession ? (");
    const previewEnd = reportSource.indexOf(") : activeIsLoading ? (");
    expect(previewStart).toBeGreaterThan(0);
    expect(previewEnd).toBeGreaterThan(previewStart);
    const previewBranch = reportSource.slice(previewStart, previewEnd);
    expect(previewBranch).not.toContain("periodTrend");
    expect(previewBranch).not.toContain("onSelect");
    expect(reportSource).toContain('<LineChartCard title="총 지출" value={formatKrw(monthlyTotal)} />');
    expect(reportSource).toContain('<DonutChartCard title="카테고리 비중" />');
  });

  /**
   * 라운드 52 QA P2-3 — 점 하나짜리 기간의 **가짜 장식 추이선**.
   *
   * LineChartCard는 점이 2개 미만이면 장식용 고정 좌표로 폴백한다(비세션 픽셀락 캡처를 위한
   * 설계). 세션 경로에서도 그 폴백이 일어나 1월의 연간 탭·분기 첫 달에 그럴듯한 우상향 선이
   * 사용자의 기록인 척 그려졌다. 이제 그 자리에는 사실 한 줄만 남는다.
   */
  it("hands the chart an honest empty state instead of the decorative line (session path)", () => {
    expect(reportSource).toContain("const trendChartNotice = period === \"월간\" ? null : periodTrend.chartNotice;");
    // 점 자체를 넘기지 않는다 -- 넘기면 카드가 다시 장식 좌표로 폴백한다.
    expect(reportSource).toContain("points={trendChartNotice ? undefined : activePoints}");
    expect(reportSource).toContain("chartNotice={trendChartNotice}");

    // 비세션 장식 분기는 이 prop에 닿지 않는다(REP-001 픽셀락).
    const previewBranch = reportSource.slice(
      reportSource.indexOf("{!hasSession ? ("),
      reportSource.indexOf(") : activeIsLoading ? (")
    );
    expect(previewBranch).not.toContain("chartNotice");

    // 카드는 빈 상태에서 선·점·격자를 통째로 비우고, 읽히는 라벨도 "추이 차트"가 아니다.
    const uiSource = source("src/ui.tsx");
    const chartBlock = uiSource.slice(
      uiSource.indexOf("export function LineChartCard"),
      uiSource.indexOf("const categoryShareBarHeight")
    );
    expect(chartBlock).toContain("const activePoints = noticeText ? [] : drawnPoints;");
    expect(chartBlock).toContain("const gridLineTops = noticeText ? [] : [25, 50, 75];");
    expect(chartBlock).toContain("`${title} 합계 ${value}, ${noticeText}`");
    expect(chartBlock).toContain('testID={noticeText ? "line-chart-empty-notice" : undefined}');
  });
});

describe("C-03 리포트 → 기록 드릴다운", () => {
  const reportSource = source("app/(tabs)/reports.tsx");
  const recordsSource = source("app/(tabs)/records.tsx");
  const uiSource = source("src/ui.tsx");

  it("stops throwing the categoryId away when the donut legend is built", () => {
    expect(reportSource).toContain("categoryId: entry.categoryId");
    expect(reportSource).toContain("label: categoryName(entry.categoryId)");
  });

  it("wires the legend rows to the shared drilldown module", () => {
    expect(reportSource).toContain('from "../../src/reports/category-drilldown"');
    expect(reportSource).toContain("onSelect={(slice) => openCategoryDrilldown(slice.categoryId)}");
    expect(reportSource).toContain("selectHint={drilldownHint}");
    // QA P1-1/P2-1: 링크에는 이번 탭의 회차가 함께 실린다(category-drilldown.test.ts가 규칙을 진다).
    expect(reportSource).toContain("buildCategoryDrilldownTarget({ ...drilldownPeriod, categoryId, nonce })");
    // 착지 월을 누르기 전에 말한다(분기·연간에서만 보이는 줄).
    expect(reportSource).toContain('testID="reports-category-drilldown-note"');
  });

  it("makes the legend row a real button only when a handler is given -- decorative branch untouched", () => {
    const donutBlock = uiSource.slice(uiSource.indexOf("export function DonutChartCard"), uiSource.indexOf("export function EmptyStateCard"));

    expect(donutBlock).toContain("onSelect?: (slice: CategoryShareSlice, index: number) => void;");
    expect(donutBlock).toContain('accessibilityRole="button"');
    expect(donutBlock).toContain("onPress={() => onSelect(slice, index)}");
    // 44dp 터치 타깃은 눌리는 줄에만 생긴다.
    expect(donutBlock).toContain("minHeight: 44");
    // A11Y-117 라벨 계약은 두 분기 모두 한 글자도 바뀌지 않는다.
    expect(
      donutBlock.match(/accessibilityLabel=\{`\$\{slice\.label\}, \$\{slice\.percentLabel\}, \$\{formatKrw\(slice\.amountKrw\)\}`\}/g) ?? []
    ).toHaveLength(2);
    // REP-001 픽셀락: 비세션 장식 도넛(범례 픽스처 + -22deg 아크)에는 손대지 않았다.
    expect(donutBlock).toContain("reportCategoryLegend.map(([label, percent])");
    expect(donutBlock).toContain('transform: [{ rotate: "-22deg" }]');
    const decorativeBranch = donutBlock.slice(donutBlock.indexOf("const legendItems = reportCategoryLegend"));
    expect(decorativeBranch).not.toContain("onSelect");
    expect(decorativeBranch).not.toContain("Pressable");
  });

  it("applies the categoryId param exactly once, with the same appliedRef convention as month", () => {
    expect(recordsSource).toContain('from "../../src/reports/category-drilldown"');
    // 라운드 56 D#10에서 `view`(달력 착지)가, 라운드 57 QA(P1-1)에서 `viewNonce`(그 착지의 회차)가
    // 이 목록에 합류했다 — 드릴다운이 쓰는 세 키는 그대로다.
    for (const key of ["month?: string;", "categoryId?: string;", "drilldown?: string;", "view?: string;", "viewNonce?: string;"]) {
      expect(recordsSource, key).toContain(`    ${key}`);
    }
    expect(recordsSource).toContain("resolveDrilldownCategoryIdParam(categoryIdParam)");
    expect(recordsSource).toContain("const appliedCategoryParamRef = useRef<string | undefined>(categoryIdParam);");
    expect(recordsSource).toContain("if (appliedCategoryParamRef.current === categoryIdParam) return;");
    // 사용자가 착지 뒤에 칩을 바꾸면 그 선택이 유지된다 -- 파라미터는 값이 바뀔 때만 다시 적용된다.
    expect(recordsSource).toContain("}, [categoryIdParam]);");
    // 기존 month 파라미터 처리(라운드 51 C-#11)는 그대로다.
    expect(recordsSource).toContain("const appliedMonthParamRef = useRef<string | undefined>(monthParam);");
  });
});
