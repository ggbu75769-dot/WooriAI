import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const mobileRoot = process.cwd();

describe("Batch 06 mobile expense, home, budget, and report contract", () => {
  it("exposes the expense/home/report API client functions", async () => {
    const client = await import("./api/client");

    expect(client.createExpense).toEqual(expect.any(Function));
    expect(client.listExpenses).toEqual(expect.any(Function));
    expect(client.getExpense).toEqual(expect.any(Function));
    expect(client.updateExpense).toEqual(expect.any(Function));
    expect(client.deleteExpense).toEqual(expect.any(Function));
    expect(client.getBudget).toEqual(expect.any(Function));
    expect(client.getHome).toEqual(expect.any(Function));
    expect(client.getMonthlyReport).toEqual(expect.any(Function));
    expect(client.getCumulativeReport).toEqual(expect.any(Function));
    expect(client.getCategoryReport).toEqual(expect.any(Function));
  });

  it("creates the locked Batch 06 route files without changing the bottom tabs", () => {
    const routeExpectations = [
      ["app/(tabs)/_layout.tsx", "홈"],
      ["app/(tabs)/_layout.tsx", "기록"],
      ["app/(tabs)/_layout.tsx", "준비템"],
      ["app/(tabs)/_layout.tsx", "리포트"],
      ["app/(tabs)/_layout.tsx", 'name="more" options={{ title: tabs.more.title'],
      ["app/(tabs)/index.tsx", "HOME-001"],
      ["app/(tabs)/index.tsx", "getHome"],
      ["app/(tabs)/records.tsx", "EXP-004"],
      ["app/(tabs)/records.tsx", "listExpenses"],
      ["app/expenses/new.tsx", "EXP-001"],
      ["app/expenses/new.tsx", "createExpense"],
      ["app/expenses/[expenseId].tsx", "EXP-003"],
      ["app/expenses/[expenseId].tsx", "deleteExpense"],
      ["app/budget.tsx", "PF-04"],
      ["app/(tabs)/reports.tsx", "REP-001"],
      ["app/(tabs)/reports.tsx", "REP-002"],
      ["app/(tabs)/reports.tsx", "getMonthlyReport"],
      ["app/(tabs)/reports.tsx", "getCumulativeReport"]
    ];

    for (const [relativePath, expectedText] of routeExpectations) {
      const filePath = join(mobileRoot, relativePath);
      expect(existsSync(filePath), `${relativePath} should exist`).toBe(true);
      expect(existsSync(filePath) ? readFileSync(filePath, "utf8") : "").toContain(expectedText);
    }
  });

  it("shows a filter-specific summary without losing the unfiltered monthly totals", () => {
    const recordsSource = readFileSync(join(mobileRoot, "app/(tabs)/records.tsx"), "utf8");

    expect(recordsSource).toContain("selectedCategoryId");
    expect(recordsSource).toContain("CategoryChip");
    expect(recordsSource).toContain("categoryCatalog");
    expect(recordsSource).toContain("filteredTotalAmountKrw");
    expect(recordsSource).toContain("totalAmountKrw");
    expect(recordsSource).toContain("formatKrw(summaryTotalKrw)");
    expect(recordsSource).toContain("합계 대상 {summaryExpenseCount}건 · 선물과 예정 기록 제외");
    expect(recordsSource).toContain("reconcileMonthlyExpenses(");
    expect(recordsSource).not.toContain("formatKrw(visibleExpenses");
  });

  it("keeps a 100-record workflow virtualized, repeatable, and explicit about invalid fields", () => {
    const recordsSource = readFileSync(join(mobileRoot, "app/(tabs)/records.tsx"), "utf8");
    const expenseSource = readFileSync(join(mobileRoot, "app/expenses/new.tsx"), "utf8");
    const detailSource = readFileSync(join(mobileRoot, "app/expenses/[expenseId].tsx"), "utf8");
    const clientSource = readFileSync(join(mobileRoot, "src/api/client.ts"), "utf8");

    expect(recordsSource).toContain("SectionList<RecordListItem, RecordListSection>");
    expect(recordsSource).toContain("ListHeaderComponent={(");
    expect(recordsSource).toContain("ListFooterComponent={(");
    expect(recordsSource).toContain("const amountKrw = includedInExpenseTotal(record) ? record.amountKrw : 0");
    expect(recordsSource).toContain("initialNumToRender={12}");
    expect(recordsSource).toContain("<AppScreen scrollable={false}>");
    expect(recordsSource).not.toContain("group.expenses.map((expense) => {");
    expect(recordsSource).toContain("useInfiniteQuery<");
    expect(recordsSource).toContain("fetchNextPage()");
    expect(recordsSource).toContain("const combinedRecordItems");
    expect(recordsSource).not.toContain('key: "offline"');
    expect(recordsSource).toContain("filteredTotalAmountKrw");
    expect(recordsSource).toContain("setDebouncedSearch(\"\")");
    expect(recordsSource).toContain("엑셀로 한 번에 가져오기");
    expect(recordsSource).toContain('accessibilityLabel="지출 기록 추가"');
    expect(recordsSource).toContain('accessibilityLabel="검색어 지우기"');
    expect(recordsSource).toContain('placeholder="품목명, 판매처, 메모로 검색"');
    expect(recordsSource).toContain("onSubmitEditing={Keyboard.dismiss}");
    expect(recordsSource).toContain('expenses.isFetchingNextPage ? "다음 기록 불러오는 중" : "다음 기록 더 보기"');
    expect(recordsSource).toContain('? "더 내려 합계 보기"');
    expect(recordsSource).not.toContain('bottom: 18');
    expect(recordsSource).not.toContain('width: 56');
    expect(recordsSource).toContain('disabled={monthOffset >= 0}');

    expect(expenseSource).toContain('label={saveExpense.isPending ? "저장 중" : "저장하고 하나 더"}');
    expect(expenseSource).toContain("saveExpense.mutate(true)");
    expect(expenseSource).toContain("setItemName(\"\")");
    expect(expenseSource).toContain("const inlineValidationMessage = authToken");
    expect(expenseSource).toContain('accessibilityLiveRegion="polite"');
    expect(expenseSource).toContain("EXPENSE_MEMO_MAX_LENGTH");
    expect(expenseSource).toContain("pendingSyncCount");
    expect(expenseSource).toContain("navigationTimerRef.current = setTimeout");
    expect(expenseSource).toContain("const clearPendingQuickExpenseDraft = async () =>");
    expect(expenseSource).toContain("clearTimeout(draftSaveTimerRef.current)");
    expect(expenseSource).toContain("await clearQuickExpenseDraft()");
    expect(expenseSource).toContain("await clearPendingQuickExpenseDraft()");
    expect(expenseSource).toContain("void clearPendingQuickExpenseDraft().then(() => router.back())");
    expect(expenseSource).toContain("<PaymentMethodPicker");
    expect(expenseSource).toContain('accessibilityLabel="상세 입력 바로 열기"');
    expect(detailSource).toContain("<PaymentMethodPicker");
    expect(detailSource).not.toContain("cyclePaymentMethod");
    expect(detailSource).toContain('onBack={() => router.back()}');
    expect(detailSource).toContain("const hasChanges = Boolean");
    expect(detailSource).toContain("useConfirmDiscardChanges(hasChanges && !allowExit)");
    expect(detailSource).toContain('message="삭제하지 못했어요. 잠시 후 다시 시도해 주세요."');
    expect(detailSource).toContain('linkPlan.isPending ? "연결하는 중" : "이 준비 계획과 연결"');
    expect(clientSource).toContain("Promise<ExpenseListResponse>");
    expect(clientSource).toContain('params.set("cursor", effectiveOptions.cursor)');
  });

  it("keeps compact navigation, grids, and report summaries readable with large system text", () => {
    const tabsSource = readFileSync(join(mobileRoot, "app/(tabs)/_layout.tsx"), "utf8");
    const homeSource = readFileSync(join(mobileRoot, "app/(tabs)/index.tsx"), "utf8");
    const expenseSource = readFileSync(join(mobileRoot, "app/expenses/new.tsx"), "utf8");
    const reportSource = readFileSync(join(mobileRoot, "app/(tabs)/reports.tsx"), "utf8");
    const moreSource = readFileSync(join(mobileRoot, "app/(tabs)/more.tsx"), "utf8");

    expect(tabsSource).toContain("KoreanText as Text");
    expect(tabsSource).not.toContain("maxFontSizeMultiplier");
    expect(tabsSource).not.toContain("numberOfLines");
    expect(homeSource).toContain("usesLargeTextLayout(fontScale)");
    expect(expenseSource).toContain("compactGridColumnCount(width, fontScale)");
    expect(reportSource).toContain("실제 기록");
    expect(reportSource).toContain("예정 제외");
    expect(moreSource).toContain('isPixelLockMode ? "프로필" : "더보기"');
    expect(reportSource).toContain("largeTextLayout");
    expect(moreSource).toContain("usesLargeTextLayout(fontScale)");
    expect(moreSource).toContain('alignItems: "stretch"');
  });
});
