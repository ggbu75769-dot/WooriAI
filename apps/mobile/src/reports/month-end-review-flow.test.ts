import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { MONTHLY_INSIGHT_MAX_SENTENCES } from "./monthly-insight";

const mobileRoot = process.cwd();
const source = (relativePath: string) => readFileSync(join(mobileRoot, relativePath), "utf8");

/**
 * GAP-066 트랙 A — **월말 정리 여정**의 배선 계약(#1 끝난 달의 예산 결과 · #2 달 점프).
 *
 * (readFileSync 계약 테스트 관례는 src/reports/monthly-insight-flow.test.ts와 같다.)
 *
 * 이 라운드의 두 변경은 **조건부 렌더**라, 계약이 붙들어야 하는 것의 절반이 부정 조건이다:
 * 진행 중인 달에는 예산 줄이 없고, 분기·연간에는 아예 없으며, 비세션 캡처 경로(REP-001)는
 * 한 글자도 바뀌지 않는다.
 */

describe("GAP-066 A(#1) 끝난 달의 예산 결과 한 줄", () => {
  it("이 화면이 이미 받아 둔 값만 순수 모듈에 넘긴다 — 새 요청도 재집계도 0건", () => {
    const reportSource = source("app/(tabs)/reports.tsx");

    expect(reportSource).toContain('from "../../src/reports/completed-month-budget"');
    expect(reportSource).toContain("buildCompletedMonthBudgetLine({");
    expect(reportSource).toContain("budgetAmountKrw: monthly.data.budgetAmountKrw");
    expect(reportSource).toContain("totalExpenseKrw: monthly.data.totalExpenseKrw");
    // REP-128의 요청 예산은 그대로다: getMonthlyReport 호출부는 여전히 셋이고, 지출 행 목록을
    // 새로 불러오지도 않는다(예산 줄은 서버가 이미 실어 보낸 budgetAmountKrw를 그대로 쓴다).
    expect(reportSource.match(/getMonthlyReport\(/g) ?? []).toHaveLength(3);
    expect(reportSource).not.toContain("listExpenses(");
  });

  it("예산 판정은 홈 히어로·인사이트와 **같은 함수** 하나뿐이다 (퍼센트 규칙을 두 벌로 만들지 않는다)", () => {
    const moduleSource = source("src/reports/completed-month-budget.ts");
    expect(moduleSource).toContain('import { evaluateHomeBudgetProgress } from "../home/budget-progress";');
    // 화면도, 이 모듈도 퍼센트를 직접 계산하지 않는다.
    expect(moduleSource).not.toContain("/ budget");
    expect(moduleSource).not.toContain("* 100");
  });

  it("월간 탭 · 끝난 달 · 인사이트가 말하지 않은 달에서만 선다 (게이트 셋)", () => {
    const reportSource = source("app/(tabs)/reports.tsx");
    expect(reportSource).toContain(
      'hasSession && period === "월간" && monthly.isSuccess && !monthlyInsightSpokeBudget(monthlyInsight)'
    );
    // "끝난 달인가"는 화면이 다시 판정하지 않는다 -- 이미 계산해 둔 monthStatus를 그대로 넘긴다.
    expect(reportSource).toContain("monthStatus,");
    expect(reportSource).toContain("testID={COMPLETED_MONTH_BUDGET_LINE_TEST_ID}");
    expect(reportSource).toContain("{completedMonthBudgetLine ? (");
  });

  it("인사이트 카드의 문장 규칙은 한 글자도 바뀌지 않는다 (상한 2문장 · 끝난 달 우선순위)", () => {
    expect(MONTHLY_INSIGHT_MAX_SENTENCES).toBe(2);
    const insightSource = source("src/reports/monthly-insight.ts");
    expect(insightSource).toContain("export const MONTHLY_INSIGHT_MAX_SENTENCES = 2;");
    expect(insightSource).toContain("[topCategorySentence, comparisonSentence, budgetSentence]");
    // 예산 줄은 카드 **밖**의 줄이다 -- 인사이트 모듈은 이 라운드가 읽기만 한다.
    expect(insightSource).not.toContain("completed-month-budget");
  });

  it("새 카드 룩을 만들지 않는다 — 방향 행·드릴다운 안내와 같은 12/18 gray600 캡션이다", () => {
    const reportSource = source("app/(tabs)/reports.tsx");
    expect(reportSource).toContain("const reportCompletedMonthBudgetStyle = {");
    expect(reportSource).toContain("style={reportCompletedMonthBudgetStyle}");
  });
});

describe("GAP-066 A(#2) 달 점프 — 라벨이 곧 월 선택 시트의 입구", () => {
  const screens = [
    { path: "app/(tabs)/records.tsx", testIdPrefix: "records" },
    { path: "app/(tabs)/reports.tsx", testIdPrefix: "reports" }
  ] as const;

  it("두 탭 모두 라벨을 **감싸기만** 한다 — 라벨의 스타일·문자열은 종전 그대로다", () => {
    const recordsSource = source("app/(tabs)/records.tsx");
    const reportsSource = source("app/(tabs)/reports.tsx");

    // 라운드 49 C-09의 선례: Pressable 안팎의 <Text>가 **같은 한 줄**이라 렌더가 바뀌지 않는다.
    const recordsLabel =
      '<Text style={{ color: theme.colors.brown, fontSize: 16, fontWeight: "800" }}>{recordsMonthLabel}</Text>';
    expect(recordsSource.match(new RegExp(recordsLabel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) ?? []).toHaveLength(2);
    expect(reportsSource.match(/<Text style=\{reportReferencePeriodTextStyle\}>\{periodLabel\}<\/Text>/g) ?? []).toHaveLength(4);
  });

  it("두 탭 모두 트리거와 시트를 한 벌씩만 붙인다 (판정은 순수 모듈이 한다)", () => {
    for (const screen of screens) {
      const screenSource = source(screen.path);
      expect(screenSource, `${screen.path}`).toContain('from "../../src/month-jump"');
      expect(screenSource, `${screen.path}`).toContain('import { MonthJumpSheet } from "../../src/MonthJumpSheet";');
      expect(screenSource, `${screen.path}`).toContain(`testID="${screen.testIdPrefix}-month-jump-trigger"`);
      expect(screenSource, `${screen.path}`).toContain(`testID="${screen.testIdPrefix}-month-jump-sheet"`);
      expect(screenSource, `${screen.path}`).toContain("accessibilityHint={MONTH_JUMP_TRIGGER_HINT}");
      expect(screenSource, `${screen.path}`).toContain("monthJumpTriggerAccessibilityLabel(");
      // 고른 달은 **기존 monthOffset으로 환산**한다(화면 상태의 모양이 바뀌지 않는다).
      expect(screenSource, `${screen.path}`).toContain("resolveMonthJumpOffset(");
      expect(screenSource, `${screen.path}`).toContain("setMonthOffset(nextOffset)");
      // 이동 안내는 화살표 이동과 같은 계산이다(A11Y-117).
      expect(screenSource, `${screen.path}`).toContain('announceForA11y(periodLabelForOffset(baseDate, "month", nextOffset))');
    }
  });

  it("하한은 **아이 날짜에서 파생**하고 새 요청을 내지 않는다 (모르면 두지 않는다)", () => {
    for (const screen of screens) {
      const screenSource = source(screen.path);
      expect(screenSource, `${screen.path}`).toContain("resolveMonthJumpEarliestMonth(");
      // 두 화면 모두 이미 읽고 있는 ["children"] 캐시를 그대로 쓴다 — 새 쿼리 키가 없다.
      expect(screenSource, `${screen.path}`).toContain("earliestYearMonth: resolveMonthJumpEarliestMonth(");
      expect(screenSource, `${screen.path}`).not.toContain("useQuery({\n    queryKey: [\"expenses-earliest\"");
    }
    // 판정 자체는 화면 파일에 한 줄도 없다(이 라운드의 안전선).
    const moduleSource = source("src/month-jump.ts");
    expect(moduleSource).not.toContain('from "react"');
    expect(moduleSource).not.toContain('from "react-native"');
    expect(moduleSource).toContain('from "./expenses/import-landing-month"');
  });

  it("분기·연간 라벨에는 붙이지 않는다 (그 라벨은 이미 한 번에 3·12개월을 건넌다)", () => {
    const reportsSource = source("app/(tabs)/reports.tsx");
    expect(reportsSource.match(/reports-month-jump-trigger/g) ?? []).toHaveLength(1);
    expect(reportsSource).toContain('{hasSession && period === "월간" && monthJumpOpen ? (');
  });

  it("REP-001 비세션 캡처 경로는 한 글자도 바뀌지 않는다", () => {
    const reportsSource = source("app/(tabs)/reports.tsx");
    // 트리거·시트·예산 줄은 전부 hasSession 뒤에 있다.
    expect(reportsSource).toContain("{hasSession ? (");
    // 비세션 미리보기의 픽스처 문장들은 그대로다.
    expect(reportsSource).toContain("지난 달보다 112,000원을 절약했어요!");
    expect(reportsSource).toContain("다온이와의 오늘도 소중한 하루였어요");
    expect(reportsSource).toContain('<LineChartCard title="총 지출" value={formatKrw(monthlyTotal)} />');
  });
});

describe("GAP-066 A(#2 후속) 리포트 탭의 달 착지 파라미터", () => {
  it("읽기 쪽 방어는 링크를 만드는 쪽과 **같은 모듈**에서 온다", () => {
    const reportsSource = source("app/(tabs)/reports.tsx");
    expect(reportsSource).toContain('from "../../src/reports/month-landing"');
    expect(reportsSource).toContain("resolveReportsMonthLandingParam(reportParams[REPORTS_MONTH_PARAM])");
    expect(reportsSource).toContain("resolveReportsMonthLandingNonceParam(reportParams[REPORTS_MONTH_NONCE_PARAM])");
  });

  it("**회차 단위로** 적용한다 (같은 달로 두 번째 들어와도 살아 있고, 재렌더가 되감지 않는다)", () => {
    const reportsSource = source("app/(tabs)/reports.tsx");
    expect(reportsSource).toContain("const appliedMonthLandingNonceRef = useRef<string | null | undefined>(undefined);");
    expect(reportsSource).toContain("if (appliedMonthLandingNonceRef.current === monthLandingNonce) return;");
    expect(reportsSource).toContain("appliedMonthLandingNonceRef.current = monthLandingNonce;");
  });

  it("착지는 월간 탭의 사실이고, 세그먼트 초기화가 그 오프셋을 지우지 않는다", () => {
    const reportsSource = source("app/(tabs)/reports.tsx");
    expect(reportsSource).toContain('if (period !== "월간") {');
    expect(reportsSource).toContain("pendingPeriodResetOffsetRef.current = landedOffset;");
    // 맡긴 값이 없으면 종전과 똑같이 0이다(세그먼트를 손으로 바꾸는 경로는 그대로다).
    expect(reportsSource).toContain("setMonthOffset(landedOffset ?? 0);");
  });
});
