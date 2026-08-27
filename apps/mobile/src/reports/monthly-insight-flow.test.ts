import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const mobileRoot = process.cwd();
const source = (relativePath: string) => readFileSync(join(mobileRoot, relativePath), "utf8");

/**
 * UX-F 배선 계약: 리포트 월간 탭의 인사이트 카드와 추이 방향 행.
 * (readFileSync 계약 테스트 관례는 src/reports/milestone-report-flow.test.ts와 같다.)
 */
describe("UX-F 리포트 인사이트 배선", () => {
  it("builds the insight from the report data already on screen -- no new request", () => {
    const reportSource = source("app/(tabs)/reports.tsx");

    expect(reportSource).toContain('from "../../src/reports/monthly-insight"');
    expect(reportSource).toContain("buildMonthlyInsight({");
    expect(reportSource).toContain("totalExpenseKrw: monthly.data.totalExpenseKrw");
    expect(reportSource).toContain("budgetAmountKrw: monthly.data.budgetAmountKrw");
    expect(reportSource).toContain("categoryLabel: categoryName");
    expect(reportSource).toContain("previousMonthTotalKrw: previousMonth.isSuccess ? previousMonth.data.totalExpenseKrw : null");

    // REP-128의 요청 예산을 그대로 지킨다: getMonthlyReport 호출부는 여전히 세 곳뿐이고,
    // 인사이트를 위해 지출 행 목록을 새로 불러오지도 않는다.
    expect(reportSource.match(/getMonthlyReport\(/g) ?? []).toHaveLength(3);
    expect(reportSource).not.toContain("listExpenses(");
  });

  it("gates the whole insight card behind a session and hides it when there is nothing to say", () => {
    const reportSource = source("app/(tabs)/reports.tsx");

    // 비세션 프리뷰(REP-001 픽셀락 캡처)에는 새 UI가 들어가지 않는다.
    expect(reportSource).toContain('hasSession && period === "월간" && monthly.isSuccess');
    // 문장이 없으면 카드 자체를 렌더하지 않는다.
    expect(reportSource).toContain("{monthlyInsight ? (");
    expect(reportSource).toContain("monthlyInsight.detail ? <Text");
    // 기존 카드 스타일 재사용(새 카드 룩을 만들지 않는다).
    expect(reportSource).toContain("const reportInsightCardStyle = reportReferenceTipCardStyle;");
    // 카드 전체가 한 요소로 읽힌다.
    expect(reportSource).toContain("accessibilityLabel={monthlyInsight.accessibilityLabel}");
  });

  it("draws the trend direction row from the chart's own points and one shared tone->token mapping", () => {
    const reportSource = source("app/(tabs)/reports.tsx");

    expect(reportSource).toContain('from "../../src/reports/trend-direction"');
    expect(reportSource).toContain("evaluateTrendDirection({ points: monthlyTrendPoints, monthStatus })");
    expect(reportSource).toContain("trendDirection.arrow");
    expect(reportSource).toContain("trendDirection.valueText");
    expect(reportSource).toContain("trendDirection.captionText");
    expect(reportSource).toContain("accessibilityLabel={trendDirection.accessibilityLabel}");

    // 색은 기존 토큰에서만 고른다. 증가/보합은 중립(gray600), 감소만 긍정(success) --
    // 지출 증가에 경고색(danger)을 찍지 않는다(DNC-017/018).
    expect(reportSource).toContain(
      'trendDirection?.tone === "positive" ? theme.colors.semantic.success : theme.colors.gray600'
    );
    expect(reportSource).not.toContain("theme.colors.danger");

    // 같은 비교를 두 번 말하지 않는다: 방향 행이 붙으면 카드 내장 델타는 숨긴다.
    expect(reportSource).toContain("deltaLabel={trendDirection ? null : deltaLabel}");
  });

  it("keeps both helpers pure (no react-native import) so they stay unit testable", () => {
    for (const helper of ["src/reports/monthly-insight.ts", "src/reports/trend-direction.ts"]) {
      expect(source(helper), `${helper} should not import react-native`).not.toContain("react-native");
    }
    // 집계·반올림 규칙은 기존 모듈에서 그대로 빌려 온다(새 계산 규칙 발명 금지, DNC-013/015).
    const insightSource = source("src/reports/monthly-insight.ts");
    expect(insightSource).toContain('from "./category-share"');
    expect(insightSource).toContain('from "../home/budget-progress"');
    expect(insightSource).toContain('from "../home/last-month-comparison"');
    expect(insightSource).toContain('import { formatKrw } from "../money"');
  });
});
