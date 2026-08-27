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
    // REP-128: 6개월 추이를 한 번에 받는 함수. 기존 getMonthlyReport는 그대로 남는다
    // (서버의 GET /reports/monthly도 하위호환으로 불변).
    expect(client.getTrendReport).toEqual(expect.any(Function));
  });

  it("creates the locked Batch 06 route files without changing the bottom tabs", () => {
    const routeExpectations = [
      ["app/(tabs)/_layout.tsx", "홈"],
      ["app/(tabs)/_layout.tsx", "기록"],
      ["app/(tabs)/_layout.tsx", "준비템"],
      ["app/(tabs)/_layout.tsx", "리포트"],
      ["app/(tabs)/_layout.tsx", "더보기"],
      ["app/(tabs)/index.tsx", "HOME-001"],
      ["app/(tabs)/index.tsx", "getHome"],
      ["app/(tabs)/records.tsx", "EXP-004"],
      ["app/(tabs)/records.tsx", "listExpenses"],
      ["app/expenses/new.tsx", "EXP-001"],
      ["app/expenses/new.tsx", "createExpense"],
      ["app/expenses/[expenseId].tsx", "EXP-003"],
      ["app/expenses/[expenseId].tsx", "deleteExpense"],
      ["app/budget.tsx", "BUD-001"],
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

  it("lets the records list be filtered by category without changing the monthly total", () => {
    const recordsSource = readFileSync(join(mobileRoot, "app/(tabs)/records.tsx"), "utf8");

    expect(recordsSource).toContain("selectedCategoryId");
    expect(recordsSource).toContain("CategoryChip");
    // REC-121: the chip row used to be the static 8-tile `categoryCatalog`, and this line used to
    // assert exactly that -- which pinned a broken behavior: those 8 ids only match expenses
    // created through the quick-input screen, so on a real session (canonical 12 categories,
    // random per-database UUIDs) every chip filtered down to 0건. The chips now come from the
    // shared ["categories"] cache, with the 8 tiles kept only as the loading/offline fallback
    // inside buildRecordsCategoryChips (src/expenses/records-list-view.ts).
    expect(recordsSource).toContain('queryKey: ["categories"]');
    expect(recordsSource).toContain("buildRecordsCategoryChips(serverCategories, selectedCategoryId)");
    expect(recordsSource).not.toContain("categoryCatalog.map(");
    // MOB-102 H-2 fix (round5a-sprint1-plan.md §3, diff review): the total card now reads
    // `monthlyTotalKrw` (reconciled against outstanding local mutations -- see
    // src/offline/expense-list-reconciliation.ts) instead of the raw
    // `expenses.data.totalAmountKrw` server aggregate, but the underlying behavior this test
    // guards -- the total card is computed from the full month's data, not the
    // category/search-filtered `visibleExpenses` list -- is unchanged.
    expect(recordsSource).toContain("formatKrw(monthlyTotalKrw)");
    expect(recordsSource).toContain("reconcileMonthlyExpenses(");
    expect(recordsSource).not.toContain("formatKrw(visibleExpenses");
  });
});
