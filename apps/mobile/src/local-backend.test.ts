import { beforeEach, describe, expect, it } from "vitest";
import { getSeoulToday } from "@wooriai/domain";
import * as localBackend from "./api/local-backend";
import { LOCAL_CHILD_ID, LOCAL_ITEM_BLOCKS, LOCAL_ITEM_CARRIER, LOCAL_ITEM_DIAPER } from "./api/local-fixtures";

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

  /**
   * REP-128: 데모 세션의 추이 미러도 서버와 같은 동치를 만족해야 한다 — 6개월 추이의 각
   * 달이 같은 달의 월간 리포트와 정확히 일치하고, 마지막 원소가 요청한 endYearMonth,
   * 기록 없는 달은 0으로 채워 길이가 항상 요청한 개월 수와 같다.
   */
  it("assembles the 6-month trend from the same fixture months getMonthlyReport folds (REP-128)", () => {
    localBackend.createExpense(childId, {
      categoryId: "local-category-diaper",
      amountKrw: 33_000,
      spentOn: getSeoulToday(),
      itemName: "이번 달 지출"
    });

    const endYearMonth = currentYearMonth();
    const trend = localBackend.getTrendReport(childId, endYearMonth, 6);

    expect(trend.childId).toBe(childId);
    expect(trend.months).toHaveLength(6);
    expect(trend.months.at(-1)!.yearMonth).toBe(`${endYearMonth}-01`);
    // 오름차순 연속: 인접한 두 달의 간격이 정확히 1개월이다(연 경계 포함).
    const absoluteMonth = (yearMonth: string) => {
      const [year, month] = yearMonth.split("-").map(Number) as [number, number];
      return year * 12 + month;
    };
    for (let index = 1; index < trend.months.length; index += 1) {
      expect(absoluteMonth(trend.months[index]!.yearMonth) - absoluteMonth(trend.months[index - 1]!.yearMonth)).toBe(1);
    }
    // 동치: 종전 화면이 보내던 6번의 getMonthlyReport와 같은 값·같은 순서.
    expect(trend.months).toEqual(
      trend.months.map(({ yearMonth }) => {
        const monthly = localBackend.getMonthlyReport(childId, yearMonth);
        return { yearMonth: monthly.yearMonth, totalExpenseKrw: monthly.totalExpenseKrw };
      })
    );
    expect(trend.months.at(-1)!.totalExpenseKrw).toBe(localBackend.getMonthlyReport(childId, endYearMonth).totalExpenseKrw);

    // 연 경계를 넘는 창(1월로 끝나는 6개월)도 12월/11월... 로 이어진다.
    const crossYear = localBackend.getTrendReport(childId, `${Number(endYearMonth.slice(0, 4)) + 1}-01`, 6);
    expect(crossYear.months.map((month) => month.yearMonth.slice(5, 7))).toEqual(["08", "09", "10", "11", "12", "01"]);
    // 미래 창이라 데모 지출이 하나도 없는 달은 0으로 채워진다(막대가 빠지지 않는다).
    expect(crossYear.months.at(-1)).toEqual({
      yearMonth: `${Number(endYearMonth.slice(0, 4)) + 1}-01-01`,
      totalExpenseKrw: 0
    });
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

  /**
   * CLN-131: 합산 술어(DNC-015)를 countsTowardMonthlyTotal 한 곳으로 모은 뒤에도 데모 세션의
   * **모든** 집계가 같은 기준을 쓴다는 것을 값으로 못 박는다. 예전에는 홈·카테고리·누적·
   * 마일스톤이 각자 `expenseType === "expense"`를 인라인으로 들고 있어서, 한 곳만 고쳐지면
   * 같은 세션의 두 화면이 다른 총액을 보여줄 수 있었다.
   */
  it("선물 행은 홈·카테고리·누적·마일스톤 집계에서 모두 똑같이 빠진다 (CLN-131)", () => {
    const beforeCategoryCount = localBackend
      .getCategoryReport(childId)
      .categories.reduce((sum, entry) => sum + entry.count, 0);
    const beforeCumulative = localBackend.getCumulativeReport(childId);
    const beforeMilestone = localBackend.getMilestoneReport(childId, "d100");

    localBackend.createExpense(childId, {
      categoryId: "local-category-diaper",
      amountKrw: 70_000,
      spentOn: getSeoulToday(),
      itemName: "선물 받은 유모차",
      expenseType: "gift"
    });

    const afterCategoryCount = localBackend
      .getCategoryReport(childId)
      .categories.reduce((sum, entry) => sum + entry.count, 0);
    expect(afterCategoryCount).toBe(beforeCategoryCount);
    expect(localBackend.getCumulativeReport(childId).totalExpenseKrw).toBe(beforeCumulative.totalExpenseKrw);
    const afterMilestone = localBackend.getMilestoneReport(childId, "d100");
    expect(afterMilestone.totalKrw).toBe(beforeMilestone.totalKrw);
    expect(afterMilestone.expenseCount).toBe(beforeMilestone.expenseCount);
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

  /**
   * R19-B (DNC-002 핵심 루프의 마지막 고리): 준비템에 연결된 지출을 기록하면 그 준비템이
   * 자동으로 준비 완료가 된다 — 실제 API(apps/api store-shared.ts markLinkedItemPrepared)와
   * 같은 규칙을 데모/테스트 세션의 로컬 백엔드도 지켜야 두 세션이 서로 다르게 굴지 않는다.
   */
  it("marks a linked preparation item prepared on expense create, preserving gifted and ignoring unlinked expenses", () => {
    localBackend.createExpense(childId, {
      categoryId: "local-category-diaper",
      amountKrw: 24_900,
      spentOn: getSeoulToday(),
      itemName: "기저귀 한 박스",
      linkedItemTemplateId: LOCAL_ITEM_DIAPER
    });
    expect(localBackend.getItemDetail(childId, LOCAL_ITEM_DIAPER).status).toBe("prepared");
    expect(localBackend.listItems(childId, "prepared").items.some((item) => item.id === LOCAL_ITEM_DIAPER)).toBe(true);

    // 사용자가 이미 "선물로 받았어요"로 정리한 항목은 연결 지출이 생겨도 그대로 둔다.
    localBackend.updateItemStatus(childId, LOCAL_ITEM_CARRIER, "gifted");
    localBackend.createExpense(childId, {
      categoryId: "local-category-diaper",
      amountKrw: 15_000,
      spentOn: getSeoulToday(),
      itemName: "아기띠 부속품",
      linkedItemTemplateId: LOCAL_ITEM_CARRIER
    });
    expect(localBackend.getItemDetail(childId, LOCAL_ITEM_CARRIER).status).toBe("gifted");

    // 연결이 없는 일반 지출은 어떤 준비템 상태도 건드리지 않는다.
    localBackend.createExpense(childId, {
      categoryId: "local-category-diaper",
      amountKrw: 8_000,
      spentOn: getSeoulToday(),
      itemName: "연결 없는 지출"
    });
    expect(localBackend.getItemDetail(childId, LOCAL_ITEM_BLOCKS).status).toBe("not_prepared");
  });
});
