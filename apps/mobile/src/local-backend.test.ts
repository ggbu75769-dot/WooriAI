import { beforeEach, describe, expect, it } from "vitest";
import { getSeoulToday } from "@wooriai/domain";
import * as localBackend from "./api/local-backend";
import { LOCAL_CHILD_ID, LOCAL_ITEM_DIAPER } from "./api/local-fixtures";

const childId = LOCAL_CHILD_ID;

function currentYearMonth() {
  return getSeoulToday().slice(0, 7);
}

describe("Local test-mode backend data layer", () => {
  beforeEach(() => {
    localBackend.resetLocalBackendForTests();
  });

  it("keeps the home total and the monthly report total in sync after a new expense", () => {
    const before = localBackend.getHome(childId);
    localBackend.createExpense(childId, {
      categoryId: "local-category-diaper",
      amountKrw: 12_345,
      spentOn: getSeoulToday(),
      itemName: "테스트 지출"
    });

    const after = localBackend.getHome(childId);
    const monthly = localBackend.getMonthlyReport(childId, currentYearMonth());

    expect(after.totalExpenseKrw).toBe(before.totalExpenseKrw + 12_345);
    expect(after.totalExpenseKrw).toBe(monthly.totalExpenseKrw);
  });

  it("excludes soft-deleted expenses from the total once removed", () => {
    const created = localBackend.createExpense(childId, {
      categoryId: "local-category-diaper",
      amountKrw: 9_900,
      spentOn: getSeoulToday(),
      itemName: "삭제될 지출"
    });
    const totalBeforeDelete = localBackend.getHome(childId).totalExpenseKrw;

    localBackend.deleteExpense(created.id);

    const totalAfterDelete = localBackend.getHome(childId).totalExpenseKrw;
    expect(totalAfterDelete).toBe(totalBeforeDelete - 9_900);
    expect(() => localBackend.getExpense(created.id)).toThrow();
  });

  it("rejects a future-dated expense", () => {
    const futureDate = `${Number(getSeoulToday().slice(0, 4)) + 1}-01-01`;
    expect(() =>
      localBackend.createExpense(childId, {
        categoryId: "local-category-diaper",
        amountKrw: 10_000,
        spentOn: futureDate,
        itemName: "미래 지출"
      })
    ).toThrow();
  });

  it("rejects a zero or negative amount", () => {
    expect(() =>
      localBackend.createExpense(childId, {
        categoryId: "local-category-diaper",
        amountKrw: 0,
        spentOn: getSeoulToday(),
        itemName: "0원 지출"
      })
    ).toThrow();

    expect(() =>
      localBackend.createExpense(childId, {
        categoryId: "local-category-diaper",
        amountKrw: -500,
        spentOn: getSeoulToday(),
        itemName: "음수 지출"
      })
    ).toThrow();
  });

  it("keeps gift-type expenses out of the expense total", () => {
    const before = localBackend.getHome(childId).totalExpenseKrw;
    localBackend.createExpense(childId, {
      categoryId: "local-category-diaper",
      amountKrw: 50_000,
      spentOn: getSeoulToday(),
      itemName: "선물 받은 옷",
      expenseType: "gift"
    });

    const after = localBackend.getHome(childId).totalExpenseKrw;
    expect(after).toBe(before);
  });

  it("rejects a manually entered future date the same way an automatic future date is rejected", () => {
    const futureDate = `${Number(getSeoulToday().slice(0, 4)) + 1}-06-15`;
    expect(() =>
      localBackend.createExpense(childId, {
        categoryId: "local-category-diaper",
        amountKrw: 15_000,
        spentOn: futureDate,
        itemName: "직접 입력한 미래 지출"
      })
    ).toThrow();
  });

  it("rejects a calendar-invalid date such as 2026-02-31", () => {
    expect(() =>
      localBackend.createExpense(childId, {
        categoryId: "local-category-diaper",
        amountKrw: 15_000,
        spentOn: "2026-02-31",
        itemName: "존재하지 않는 날짜 지출"
      })
    ).toThrow();
  });

  it("rejects updating an expense to a calendar-invalid or future date", () => {
    const created = localBackend.createExpense(childId, {
      categoryId: "local-category-diaper",
      amountKrw: 12_000,
      spentOn: getSeoulToday(),
      itemName: "수정 대상 지출"
    });

    expect(() => localBackend.updateExpense(created.id, { spentOn: "2026-02-31" })).toThrow();

    const futureDate = `${Number(getSeoulToday().slice(0, 4)) + 1}-01-15`;
    expect(() => localBackend.updateExpense(created.id, { spentOn: futureDate })).toThrow();
  });

  it("does not create expenses from an import job until it is confirmed, and only imports the selected rows", () => {
    const job = localBackend.createExcelImport(childId, "wooriai-import.csv");
    const totalBeforeConfirm = localBackend.listExpenses(childId).expenses.length;

    const rows = localBackend.listImportRows(job.id).rows;
    expect(localBackend.listExpenses(childId).expenses.length).toBe(totalBeforeConfirm);

    const selectedIds = rows.filter((row) => row.selected).map((row) => row.id);
    const result = localBackend.confirmImport(job.id, selectedIds);

    const expensesAfterConfirm = localBackend.listExpenses(childId).expenses;
    expect(result.importedCount).toBe(selectedIds.length);
    expect(expensesAfterConfirm.length).toBe(totalBeforeConfirm + selectedIds.length);

    // Confirming twice must not create duplicate expenses.
    expect(() => localBackend.confirmImport(job.id, selectedIds)).toThrow();
    expect(localBackend.listExpenses(childId).expenses.length).toBe(totalBeforeConfirm + selectedIds.length);
  });

  it("does not select the low-confidence import row by default", () => {
    const job = localBackend.createExcelImport(childId, "wooriai-import.csv");
    const rows = localBackend.listImportRows(job.id).rows;
    const lowConfidenceRow = rows.find((row) => row.confidence < 0.7);

    expect(lowConfidenceRow).toBeDefined();
    expect(lowConfidenceRow?.selected).toBe(false);
    expect(rows.some((row) => row.confidence >= 0.7 && row.selected)).toBe(true);
  });

  it("sums the yearly report from the twelve monthly totals", () => {
    const today = getSeoulToday();
    const year = Number(today.slice(0, 4));
    localBackend.createExpense(childId, {
      categoryId: "local-category-diaper",
      amountKrw: 7_000,
      spentOn: today,
      itemName: "연간 합계 확인용 지출"
    });

    const yearly = localBackend.getYearlyReport(childId, year);
    const sumOfMonths = yearly.monthlyTotals.reduce((sum, month) => sum + month.totalExpenseKrw, 0);

    expect(yearly.monthlyTotals.length).toBe(12);
    expect(yearly.totalExpenseKrw).toBe(sumOfMonths);
  });

  it("keeps the item status change reflected on subsequent reads", () => {
    const updated = localBackend.updateItemStatus(childId, LOCAL_ITEM_DIAPER, "prepared");
    expect(updated.status).toBe("prepared");

    const preparedList = localBackend.listItems(childId, "prepared").items;
    expect(preparedList.some((item) => item.id === LOCAL_ITEM_DIAPER)).toBe(true);

    const nowList = localBackend.listItems(childId, "now").items;
    expect(nowList.some((item) => item.id === LOCAL_ITEM_DIAPER)).toBe(false);
  });
});
