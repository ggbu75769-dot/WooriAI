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
    expect(reportSource).toContain("deltaLabel={trendDirection || insightSpokeComparison ? null : deltaLabel}");
  });

  /**
   * 라운드 34 L1: 인사이트가 이미 "지난달 전체보다 …"를 말한 달에는 추이 방향 행을 접는다 --
   * 두 줄이 같은 두 달을 같은 방향으로 비교하므로 나란히 두면 한 화면에서 같은 사실을 두 번
   * 말한다(방향 행이 붙을 때 deltaLabel을 숨긴 것과 같은 기준).
   */
  it("L1: 인사이트에 비교 문장이 있으면 방향 행을 접고, 델타도 되살리지 않는다", () => {
    const reportSource = source("app/(tabs)/reports.tsx");

    // 판정은 모듈이 이미 돌려준 hasComparison 하나뿐이다(화면이 비교 여부를 다시 계산하지 않는다).
    expect(reportSource).toContain("const insightSpokeComparison = Boolean(monthlyInsight?.hasComparison);");
    expect(reportSource).toContain(
      "const showTrendDirectionRow = Boolean(trendDirection) && !insightSpokeComparison;"
    );
    // 행 렌더는 그 판정을 통과해야만 한다.
    expect(reportSource).toContain("{showTrendDirectionRow && trendDirection ? (");
    // 접은 자리에 카드 내장 델타가 되돌아오면 중복이 카드 안으로 옮겨 갈 뿐이다.
    expect(reportSource).toContain("deltaLabel={trendDirection || insightSpokeComparison ? null : deltaLabel}");
    expect(reportSource).not.toContain("deltaLabel={trendDirection ? null : deltaLabel}");
  });

  /**
   * 후속 F: 세션 경로의 "이번 달 절약 팁" 카드는 지난달 **월 전체** vs 이번 달 **부분** 합계를
   * 비교해 "절약했어요"라고 단언했다(진행 중인 달에서는 매달 1일에 언제나 참이 되는 허위 비교 --
   * src/home/last-month-comparison.ts가 규정한 바로 그 형태). 끝난 달의 정직한 비교는 위 인사이트
   * 카드가 "지난달 전체보다 …"로 이미 말하므로 카드를 제거했다.
   */
  it("removes the session-path 절약 팁 card -- no month-total vs partial-total claim survives", () => {
    const reportSource = source("app/(tabs)/reports.tsx");

    // 카드를 그리던 상태/분기가 전부 사라졌다.
    expect(reportSource).not.toContain("tipDeltaKrw");
    expect(reportSource).not.toContain("showTip");
    expect(reportSource).not.toContain("{showTip ? (");
    // 단언 문구 자체가 세션 경로에서 만들어질 수 없다(템플릿 리터럴 형태도 함께 막는다).
    expect(reportSource).not.toContain("절약했어요! ");
    expect(reportSource).not.toContain("{formatKrw(tipDeltaKrw)}");
    expect(reportSource).not.toContain("더 썼어요. 다음 구매 전에");
  });

  it("leaves the non-session REP-001 preview branch (and its fixed tip fixture) untouched", () => {
    const reportSource = source("app/(tabs)/reports.tsx");

    // 픽셀락 프리뷰는 고정 문구 픽스처 그대로다 -- 세션 경로만 고쳤다.
    expect(reportSource).toContain("{!hasSession ? (");
    expect(reportSource).toContain("<Text style={reportReferenceTipTitleStyle}>이번 달 절약 팁</Text>");
    expect(reportSource).toContain("지난 달보다 112,000원을 절약했어요!");
    expect(reportSource).toContain("절약 습관 최고예요!");
    // 팁 카드 스타일은 프리뷰와 인사이트 카드가 계속 공유한다(새 카드 룩 없음).
    expect(reportSource).toContain("const reportInsightCardStyle = reportReferenceTipCardStyle;");
    // 문구가 남은 곳은 프리뷰 한 군데뿐이다.
    expect(reportSource.match(/이번 달 절약 팁/g) ?? []).toHaveLength(1);
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
