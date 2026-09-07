import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const mobileRoot = process.cwd();
const source = (relativePath: string) => readFileSync(join(mobileRoot, relativePath), "utf8");

/**
 * 라운드 102 T3 — 리포트 월간 탭 "카테고리 예산" 블록의 배선 계약
 * (docs/5차/round102-category-budget-design.md §4.3·§5.1·§6.6).
 * (readFileSync 계약 테스트 관례는 src/reports/monthly-insight-flow.test.ts와 같다.)
 */
describe("라운드 102 리포트 카테고리 예산 블록 배선", () => {
  const reportScreen = () => source("app/(tabs)/reports.tsx");

  it("새 요청 0건 — 세 재료 전부 이 화면이 이미 받는 응답·캐시다 (§4.3)", () => {
    const src = reportScreen();
    expect(src).toContain('from "../../src/reports/category-budget-usage"');
    // 예산: 월간 리포트 응답의 가산 필드(§2.4).
    expect(src).toContain("budgets: monthly.data.categoryBudgets");
    // 사용액: 도넛과 **같은** 카테고리 분해 응답 — 두 숫자의 모집단이 같다(§4.3).
    expect(src).toContain("breakdown: activeCategory.data?.categories");
    // 이름·별칭 가족: 이미 켜져 있는 ["categories"] 캐시.
    expect(src).toContain("categories: categories.data?.categories");
    // 요청 구성은 종전 그대로다: getMonthlyReport 호출부 둘(이번 달·지난 달), 지출 행 목록 0건.
    expect(src.match(/getMonthlyReport\(/g) ?? []).toHaveLength(2);
    expect(src).not.toContain("listExpenses(");
  });

  it("게이트: 세션 · 월간 탭 · 세 쿼리 성공 — 모르면(목록 부재) 행을 만들지 않는다", () => {
    expect(reportScreen()).toContain(
      'hasSession && period === "월간" && monthly.isSuccess && activeCategory.isSuccess && categories.isSuccess'
    );
    // 행이 0건이면 블록 자체가 서지 않는다(예산 없는 달·분기·연간·구 캐시).
    expect(reportScreen()).toContain("{categoryBudgetUsageRows.length > 0 ? (");
  });

  it("게이트는 그 넷뿐이다 — 그 달 지출 0건이어도 예산이 있으면 블록이 선다 (리뷰 L-4)", () => {
    // ⚠️ 두 시점: 블록이 도넛 갈래(`categoryData.length === 0`의 else) **안**에 있어, 그 달
    // 지출이 0건이면 예산을 세워 두었어도 블록이 통째로 사라졌다 — 설계 §4.3에 없는 넷째
    // 게이트다. 이제 블록은 그 삼항의 **형제**이고, 자리는 종전 그대로 도넛(또는 그 자리의 빈
    // 카드) 아래·추이 카드 위다.
    const src = reportScreen();
    const emptyBranch = src.indexOf("categoryData.length === 0 ? (");
    // 그 삼항의 else(도넛 묶음)가 닫히는 자리 — 같은 스타일 이름이 화면 위쪽에도 있으므로
    // **빈 상태 갈래 이후**에서만 찾는다.
    const branchEnd = src.indexOf("<View style={reportCardCaptionGroupStyle}>", emptyBranch);
    const blockMarker = src.indexOf('testID="reports-category-budget-usage"');
    const trendMarker = src.indexOf("{trendChips.length > 0 ? (");
    expect(emptyBranch).toBeGreaterThan(-1);
    expect(branchEnd).toBeGreaterThan(emptyBranch);
    // 블록은 도넛 갈래가 **닫힌 뒤**에 서고(빈 상태 갈래에서도 렌더된다), 추이 카드보다는 앞이다.
    expect(blockMarker).toBeGreaterThan(branchEnd);
    expect(trendMarker).toBeGreaterThan(blockMarker);
    // 도넛 갈래(빈 상태 카드 ~ 도넛 묶음)에는 블록이 남아 있지 않다.
    expect(src.slice(emptyBranch, branchEnd)).not.toContain("categoryBudgetUsageRows");
    // 지출 0건인 달의 행 문장은 순수 모듈이 관측 톤으로 만든다(화면에 새 빈 상태 문구 0건).
    expect(source("src/reports/category-budget-usage.test.ts")).toContain("예산의 0%를 썼어요");
  });

  it("REP-001 픽셀락 무접촉 — 블록은 세션 데이터 갈래 안이고, 비세션 미리보기 분기는 종전 그대로다 (§6.6)", () => {
    const src = reportScreen();
    const previewBranch = src.indexOf("{!hasSession ? (");
    const blockMarker = src.indexOf('testID="reports-category-budget-usage"');
    expect(previewBranch).toBeGreaterThan(-1);
    // 블록은 비세션 분기(및 그 픽스처 카드들)보다 뒤, 세션 else 갈래 안에 선다.
    expect(blockMarker).toBeGreaterThan(previewBranch);
    // 비세션 미리보기의 도넛은 종전 한 줄 그대로이고, 도넛 카드 자리는 둘(미리보기·세션)뿐이다 —
    // 범례 줄에 예산 주석을 달지 않았다(§4.3 기각 — DonutChartCard·ui.tsx 0바이트).
    expect(src).toContain('<DonutChartCard title="카테고리 비중" />');
    expect(src.match(/<DonutChartCard/g) ?? []).toHaveLength(2);
    expect(src).toContain("onSelect={(slice) => openCategoryDrilldown(slice.categoryId)}");
  });

  it("블록 구간에 경고색이 없다 — 초과여도 문장이 사실만 말한다 (DNC-018 · §4.3 관측 톤)", () => {
    const src = reportScreen();
    const blockStart = src.indexOf('testID="reports-category-budget-usage"');
    const blockEnd = src.indexOf("{trendChips.length > 0 ? (");
    expect(blockStart).toBeGreaterThan(-1);
    expect(blockEnd).toBeGreaterThan(blockStart);
    const blockSlice = src.slice(blockStart, blockEnd);
    expect(blockSlice).not.toContain("theme.colors.danger");
    expect(blockSlice).not.toContain("semantic.warning");
    // 행이 실제로 그 구간 안에 있다(빈 구간 방지 — 표식 실재 확인).
    expect(blockSlice).toContain("{row.primaryText}");
    expect(blockSlice).toContain("{row.secondaryText}");
  });

  it("행 낭독은 모듈 문장 하나다 — 눈과 귀가 같은 사실을 말한다", () => {
    expect(reportScreen()).toContain("accessibilityLabel={row.accessibilityLabel}");
  });

  it("대기 고지를 다시 말하지 않는다 — 화면 머리의 기간 고지가 같은 달을 이미 덮는다 (§4.3)", () => {
    const src = reportScreen();
    const blockStart = src.indexOf('testID="reports-category-budget-usage"');
    const blockEnd = src.indexOf("{trendChips.length > 0 ? (");
    expect(blockStart).toBeGreaterThan(-1);
    expect(blockEnd).toBeGreaterThan(blockStart);
    expect(src.slice(blockStart, blockEnd)).not.toContain("pendingScopeNotice");
    // 그 고지 자체는 종전 그대로 화면 머리에 있다.
    expect(src).toContain("evaluateReportPendingScopeNotice({");
  });
});
