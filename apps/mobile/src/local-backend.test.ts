import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getSeoulToday } from "@wooriai/domain";
import { createJSONStorage, type StateStorage } from "zustand/middleware";
import { getHome as clientGetHome, LOCAL_SESSION_TOKEN } from "./api/client";
import * as localBackend from "./api/local-backend";
import { persistStorage } from "./stores/persist-storage";
import {
  LOCAL_CHILD_ID,
  LOCAL_HOUSEHOLD_ID,
  LOCAL_ITEM_BLOCKS,
  LOCAL_ITEM_CARRIER,
  LOCAL_ITEM_DIAPER
} from "./api/local-fixtures";

const childId = LOCAL_CHILD_ID;

function currentYearMonth() {
  return getSeoulToday().slice(0, 7);
}

/** 서울 기준 오늘에서 n개월 전(YYYY-MM-DD). 아이 생년월일을 고정 날짜로 박지 않기 위한 헬퍼. */
function seoulMonthsAgo(months: number): string {
  const [year, month, day] = getSeoulToday().split("-").map(Number);
  const total = year * 12 + (month - 1) - months;
  const nextYear = Math.floor(total / 12);
  const nextMonth = (total % 12) + 1;
  const lastDay = new Date(Date.UTC(nextYear, nextMonth, 0)).getUTCDate();
  return `${nextYear}-${String(nextMonth).padStart(2, "0")}-${String(Math.min(day, lastDay)).padStart(2, "0")}`;
}

describe("Local test-mode backend data layer", () => {
  beforeEach(() => {
    localBackend.resetLocalBackendForTests();
    localBackend.seedLocalDemoFixturesForTests();
  });

  it("keeps the home total and the monthly report total in sync after a new expense", () => {
    // ⚠️ 라운드 90 리뷰 후속 — 홈 총액은 서버와 같이 **전 기간** 합계다(PERF-121:
    // "range를 생략하면 전 기간 합계다(홈의 totalExpenseKrw)"). 종전 단언은
    // `홈 총액 == 이번 달 리포트 총액`이라는 등호를 물었는데, 그 등호는 시드 지출
    // (daysAgo 0·1·2)이 전부 이번 달 안에 있을 때만 참이다 — KST로 달이 바뀐 1~2일에는
    // 시드 일부가 지난달로 넘어가 홈(전 기간) > 이번 달이 되고, 실제로 2026-09-01
    // KST 00시에 109,545 vs 58,245로 빨개졌다(시계 의존 픽스처). 이 테스트의 뜻은
    // "새 지출이 두 장부에 같은 값으로 실린다"이므로, 달 경계와 무관한 **증분 동치**로
    // 다시 물었다 — 화면 동작·픽스처는 한 바이트도 바꾸지 않았다.
    const before = localBackend.getHome(childId);
    const monthlyBefore = localBackend.getMonthlyReport(childId, currentYearMonth());
    localBackend.createExpense(childId, {
      categoryId: "local-category-diaper",
      amountKrw: 12_345,
      spentOn: getSeoulToday(),
      itemName: "테스트 지출"
    });

    const after = localBackend.getHome(childId);
    const monthlyAfter = localBackend.getMonthlyReport(childId, currentYearMonth());

    expect(after.totalExpenseKrw).toBe(before.totalExpenseKrw + 12_345);
    expect(monthlyAfter.totalExpenseKrw).toBe(monthlyBefore.totalExpenseKrw + 12_345);
    // 시드가 전부 이번 달 안에 있는 창(한 달의 3일째부터)에서는 종전 등호도 그대로
    // 성립한다 — 그 창에서만 옛 단언을 유지해 회귀 감지 폭을 잃지 않는다.
    if (getSeoulToday().split("-")[2]! >= "03") {
      expect(after.totalExpenseKrw).toBe(monthlyAfter.totalExpenseKrw);
    }
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

/**
 * 실기기 피드백 1: 테스트 로그인이 실제로 도착하는 상태 -- 사용자 데이터 0, 콘텐츠만 있음.
 * 위 describe와 달리 데모 픽스처를 arrange 하지 않는다(그것이 이 계약의 전부다).
 */
describe("Local test-mode backend zero start (테스트 로그인 = 신규 가입)", () => {
  beforeEach(() => {
    localBackend.resetLocalBackendForTests();
  });

  it("has no child, no expenses and no budget until the user creates them", () => {
    expect(localBackend.listChildren().children).toEqual([]);
    expect(localBackend.localChildId()).toBeNull();
    expect(() => localBackend.getHome(LOCAL_CHILD_ID)).toThrow("아이 프로필을 찾을 수 없어요.");
    // 카탈로그(앱 콘텐츠)는 아이가 없어도 그대로 있다.
    expect(localBackend.listCategories().categories.length).toBeGreaterThan(0);
  });

  it("starts onboarding at the consents step and then asks for the child profile", () => {
    expect(localBackend.onboardingStatus()).toMatchObject({ completed: false, nextStep: "consents" });
    localBackend.upsertConsents();
    // 예전에는 시드 아이 때문에 곧바로 prepared-items였다 -- 이제 실계정과 같이 아이부터 받는다.
    expect(localBackend.onboardingStatus()).toMatchObject({ completed: false, nextStep: "child-profile" });
    expect(localBackend.onboardingStatus().summary.child).toBeNull();
  });

  it("keeps a half-created child (단계 미설정) invisible until the stage input lands", () => {
    localBackend.createChild({ nickname: "여정이" });
    expect(localBackend.listChildren().children).toEqual([]);
    expect(localBackend.onboardingStatus().nextStep).toBe("consents");

    localBackend.updateChild(LOCAL_CHILD_ID, { stageMode: "born", birthDate: seoulMonthsAgo(2) });
    const [child] = localBackend.listChildren().children;
    expect(child).toMatchObject({ nickname: "여정이", stageMode: "born", dueDate: null, manualStage: null });
    expect(child.currentStage).toBe("newborn_0_3");
  });

  it("mirrors the server's per-mode required stage input", () => {
    localBackend.createChild({ nickname: "튼튼이" });
    expect(() => localBackend.updateChild(LOCAL_CHILD_ID, { stageMode: "pregnant" })).toThrow(
      "출산 예정일을 입력해 주세요."
    );
    expect(() => localBackend.updateChild(LOCAL_CHILD_ID, { stageMode: "born" })).toThrow(
      "아이 생년월일을 입력해 주세요."
    );
    expect(() => localBackend.updateChild(LOCAL_CHILD_ID, { stageMode: "manual" })).toThrow(
      "아이 단계를 선택해 주세요."
    );
    expect(() =>
      localBackend.updateChild(LOCAL_CHILD_ID, { stageMode: "born", birthDate: "2999-01-01" })
    ).toThrow("출생일은 오늘보다 미래일 수 없어요.");
  });

  it("allows only the 임신 중 → 태어남 transition once the stage is set (실서버 CHILD-127 규칙)", () => {
    localBackend.createChild({ nickname: "튼튼이" });
    localBackend.updateChild(LOCAL_CHILD_ID, { stageMode: "pregnant", dueDate: "2999-01-01" });
    expect(localBackend.listChildren().children[0].currentStage).toBe("pregnancy_early");

    // 임신 중인 아이에게는 100일/첫돌 리포트를 만들 수 없다(실서버 MILESTONE_UNAVAILABLE).
    expect(() => localBackend.getMilestoneReport(LOCAL_CHILD_ID, "d100")).toThrow("아이 생년월일이 등록되어야");

    const birthDate = seoulMonthsAgo(1);
    localBackend.updateChild(LOCAL_CHILD_ID, { stageMode: "born", birthDate });
    expect(localBackend.listChildren().children[0]).toMatchObject({ stageMode: "born", birthDate, dueDate: "2999-01-01" });
    // 되돌리기는 막는다.
    expect(() => localBackend.updateChild(LOCAL_CHILD_ID, { stageMode: "pregnant" })).toThrow(
      "아이 상태는 '임신 중'에서 '태어났어요'로만 바꿀 수 있어요."
    );
  });

  /**
   * 온보딩을 ONB-002까지만 하고 앱을 끈 뒤 다시 시작한 사용자. 이번엔 다른 시기를 골라도
   * 저장이 막히면 안 된다 -- createChild가 프로필을 통째로 교체하므로 전환 규칙에 걸리지 않는다.
   */
  it("lets a restarted onboarding pick a different stage mode without dead-ending", () => {
    localBackend.createChild({ nickname: "튼튼이" });
    localBackend.updateChild(LOCAL_CHILD_ID, { stageMode: "born", birthDate: seoulMonthsAgo(3) });

    localBackend.createChild({ nickname: "튼튼이" });
    expect(() =>
      localBackend.updateChild(LOCAL_CHILD_ID, { stageMode: "pregnant", dueDate: "2999-01-01" })
    ).not.toThrow();
    expect(localBackend.listChildren().children[0]).toMatchObject({
      stageMode: "pregnant",
      dueDate: "2999-01-01",
      birthDate: null
    });
  });

  /**
   * 라운드 49 QA(P2-1): 아이를 지우고 다시 만들면 **새 아이는 0에서 시작한다**.
   *
   * 로컬 백엔드의 아이 자리는 하나뿐이고 createChild가 언제나 같은 LOCAL_CHILD_ID를 쓴다.
   * 예전에는 삭제가 아이 행과 지출만 건드려서, 새로 만든 아이가 지운 아이의 예산·준비
   * 상태·준비물 단계 완료 표시를 그대로 물려받았다 -- 설정한 적 없는 예산과 체크한 적 없는
   * 준비율을 자기 것으로 읽게 되는 허위 표시다.
   */
  it("wipes the deleted child's budget/prepared state so a re-created child starts empty (P2-1)", () => {
    const yearMonth = currentYearMonth();
    localBackend.createChild({ nickname: "튼튼이" });
    localBackend.updateChild(LOCAL_CHILD_ID, { stageMode: "born", birthDate: seoulMonthsAgo(20) });
    localBackend.upsertBudget(LOCAL_CHILD_ID, 500_000, yearMonth);
    localBackend.setPreparedItems(LOCAL_CHILD_ID, [LOCAL_ITEM_DIAPER]);
    localBackend.createExpense(LOCAL_CHILD_ID, {
      categoryId: "local-category-diaper",
      amountKrw: 11_000,
      spentOn: getSeoulToday(),
      itemName: "지워질 아이의 지출"
    });

    localBackend.confirmChildProfileDeletion(LOCAL_CHILD_ID, "DELETE CHILD");

    localBackend.createChild({ nickname: "여정이" });
    localBackend.updateChild(LOCAL_CHILD_ID, { stageMode: "manual", manualStage: "toddler_1_3" });

    // 예산: 설정한 적 없는 달이므로 "찾을 수 없어요"여야 한다(0원이라고 지어내지도 않는다).
    expect(() => localBackend.getBudget(LOCAL_CHILD_ID, yearMonth)).toThrow("월 예산을 찾을 수 없어요.");
    expect(localBackend.getMonthlyReport(LOCAL_CHILD_ID, yearMonth).budgetAmountKrw).toBeNull();
    // 준비 상태: 전 아이가 체크해 둔 항목이 새 아이의 "준비 완료"로 남지 않는다.
    expect(localBackend.listItems(LOCAL_CHILD_ID, "prepared").items).toEqual([]);
    expect(localBackend.getItemDetail(LOCAL_CHILD_ID, LOCAL_ITEM_DIAPER).status).toBe("not_prepared");
    // 지출도 새 아이의 합계에 섞이지 않는다(soft delete).
    expect(localBackend.getHome(LOCAL_CHILD_ID).totalExpenseKrw).toBe(0);
    // 온보딩도 준비물 단계를 다시 묻는다(전 아이의 단계 완료 표시를 물려받지 않는다).
    localBackend.upsertConsents();
    expect(localBackend.onboardingStatus().nextStep).toBe("prepared-items");
  });

  it("starts the household with the owner alone and names invites after the child", () => {
    expect(localBackend.listHouseholdMembers(LOCAL_HOUSEHOLD_ID).members.map((member) => member.role)).toEqual([
      "owner"
    ]);
    localBackend.createChild({ nickname: "여정이" });
    localBackend.updateChild(LOCAL_CHILD_ID, { stageMode: "manual", manualStage: "toddler_1_3" });
    expect(localBackend.createInvite(LOCAL_HOUSEHOLD_ID, "co_parent", "link").householdName).toBe("여정이 패밀리");
  });
});

/**
 * GAP-070 D 거울: 되돌릴 수 없는 두 흐름의 "진행하면 이렇게 돼요"가 **요청자의 역할에서
 * 파생**된다(정적 리터럴 금지 — 아이 삭제 미리보기가 이미 쓰는 형식).
 *
 * 데모 세션을 함께 고치는 이유는 라운드 46이 세운 "impact 서버-데모 통일" 규율이다 —
 * 어긋나면 데모에서 본 문장과 실세션 문장이 달라지고, 그 화면(app/settings/privacy.tsx의
 * PreviewSummary)은 배열을 한 줄씩 **그대로** 그린다.
 *
 * 회귀 좌표는 넷(관리자/비관리자 × 가구 탈퇴/계정 삭제)이고, 비관리자 둘은 **종전과 바이트
 * 단위로 같아야 한다**.
 */
describe("GAP-070 D 데모 거울: 탈퇴·계정 삭제 미리보기의 관리자 상실 고지", () => {
  const LEAVE_BASE = "이 가구에 공유된 아이 기록을 볼 수 없어요";
  const DELETE_BASE = ["이 계정으로는 다시 로그인할 수 없어요", "참여 중인 가구에서 모두 나가게 돼요"];
  const OWNER_LINE = "관리자인 내가 나가면 그 가족에 관리자가 없어져서 새 구성원 초대와 구성원 관리를 아무도 할 수 없어요";

  beforeEach(() => {
    localBackend.resetLocalBackendForTests();
  });

  it("관리자 좌표 둘: 두 미리보기에 같은 한 줄이 더 선다", () => {
    // 데모 세션의 기본값은 실계정 신규 가입과 같다 — 내가 이 가구의 유일한 관리자다.
    expect(localBackend.listHouseholdMembers(LOCAL_HOUSEHOLD_ID).members.map((member) => member.role)).toEqual([
      "owner"
    ]);

    expect(localBackend.previewHouseholdLeave(LOCAL_HOUSEHOLD_ID).impact).toEqual([LEAVE_BASE, OWNER_LINE]);
    expect(localBackend.previewAccountDeletion().impact).toEqual([...DELETE_BASE, OWNER_LINE]);
  });

  it("비관리자 좌표 둘: 종전과 바이트 단위로 같다", () => {
    // 탈퇴를 마치면 내 구성원 행이 `left`가 되어 어느 가구의 관리자도 아니게 된다
    // (실서버 householdsForUser가 status: "active"만 싣는 것과 같은 규칙).
    localBackend.confirmHouseholdLeave(LOCAL_HOUSEHOLD_ID, "LEAVE HOUSEHOLD");

    expect(localBackend.previewHouseholdLeave(LOCAL_HOUSEHOLD_ID).impact).toEqual([LEAVE_BASE]);
    expect(localBackend.previewAccountDeletion().impact).toEqual(DELETE_BASE);
  });

  it("설정 화면의 흐름 목록은 종전 그대로다 — 역할 파생은 미리보기의 몫이다", () => {
    // 실서버의 흐름 목록(onboarding-core.service.ts getPrivacySettings)은 이 라운드가 손대지
    // 않았다. 거울도 같아야 한다 — 목록만 늘면 두 표면이 다른 이야기를 한다.
    const flows = localBackend.getPrivacySettings().flows;
    expect(flows.find((flow) => flow.id === "household_leave")?.impact).toEqual([LEAVE_BASE]);
    expect(flows.find((flow) => flow.id === "account_delete")?.impact).toEqual(DELETE_BASE);
  });

  it("서버 상수와 글자까지 같다 (라운드 46 impact 서버-데모 통일)", () => {
    const controllerSource = readFileSync(
      join(process.cwd(), "../../apps/api/src/settings/settings.controller.ts"),
      "utf8"
    );

    expect(controllerSource).toContain(`"${OWNER_LINE}"`);
    // 그리고 서버가 그 줄을 **역할에서** 고르는지까지 본다 — 정적 배열로 되돌아가면 빨개진다.
    expect(controllerSource).toContain("isHouseholdOwner(request.user!, householdId)");
    expect(controllerSource).toContain("ownsAnyHousehold(request.user!)");
  });
});

/**
 * FIX-A(실기기): standalone APK 첫 진입 전면 에러의 재현 계약.
 *
 * 실기기에서 로컬 백엔드 스토어의 persist 재수화(AsyncStorage 읽기)는 비동기이고, 첫 기동이
 * 느린 기기에서는 앱 라우팅의 3초 안전 밸브(app/index.tsx)가 재수화보다 먼저 열린다. 그때
 * 두 개의 레이스가 실재했다:
 *
 *  1. **늦은 재수화의 덮어쓰기**: zustand persist는 저장소가 비어 있어도(merge 인자
 *     undefined) merge를 부르는데, 종전 merge는 그 갈래에서도 initialState로 현재 상태를
 *     통째로 갈아 끼웠다 — 밸브 뒤에서 온보딩을 진행한 사용자의 **방금 등록한 아이**가
 *     메모리에서 지워진다.
 *  2. **초기화 전 조회**: 재수화가 끝나기 전의 첫 요청(getHome)이 child: null인 초기 상태를
 *     읽고 "아이 프로필을 찾을 수 없어요"로 실패한다 — 사용자에게는 첫 화면의 전면 에러
 *     카드(🍼 "앗, 문제가 생겼어요")로 보였고 [다시 시도]가 지나면(그 사이 재수화가 끝나)
 *     성공했다.
 *
 * 수리: merge는 저장된 것이 없으면 현재 상태를 보존하고(1), client.ts의 local()이 모든 로컬
 * 세션 요청 앞에서 whenLocalBackendReady()로 재수화를 기다린다(2 — 밸브로 진행된 호출의
 * 실패는 1회 내장 재시도). 아래 테스트는 수리 전 빨강이었다.
 *
 * 그리고 셋째 — expo web(EXPO_OFFLINE=1 + 테스트 로그인)에서 온보딩 → 첫 진입을 실제로
 * 통과시켜 보니, 사용자가 찍어 보낸 그 카드의 **직접 원인은 홈 화면의 훅 순서 위반**이었다:
 * app/(tabs)/index.tsx의 훅 네 개(useRecurringExpenseStore ×2 · useMemo ×2, 라운드 55 트랙 C /
 * DSN-053 P2-A)가 로딩·에러·아이 대기 조기 반환 **아래**에 있어, 로딩 스켈레톤(렌더 1) →
 * /home 도착(렌더 2) 전환에서 React가 "Rendered more hooks than during the previous render"를
 * 던지고 전역 ErrorBoundary가 화면을 대체했다. [다시 시도]는 리마운트 첫 렌더가 캐시된
 * 데이터로 전체 경로를 타서 지나갔다 — "일시 에러"의 실체다. 넷을 조기 반환 위로 옮겼고,
 * 아래 마지막 테스트가 그 순서를 계약으로 문다(레이스 1·2는 그 크래시 아래 숨어 있던,
 * 같은 첫 진입을 실패시키는 실기기 시나리오다).
 */
describe("FIX-A: 로컬 백엔드 재수화 레이스 (standalone 첫 진입 전면 에러)", () => {
  const store = localBackend.useLocalBackendStore;

  function deferred<T>() {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((res) => {
      resolve = res;
    });
    return { promise, resolve };
  }

  /** 재수화 도착 시점을 손에 쥐는 저장소 — getItem만 지연되고 쓰기는 조용히 삼킨다. */
  function controlledStorage(getItemImpl: () => Promise<string | null>): StateStorage {
    return {
      getItem: () => getItemImpl(),
      setItem: () => {},
      removeItem: () => {}
    };
  }

  beforeEach(() => {
    localBackend.resetLocalBackendForTests();
  });

  afterEach(async () => {
    // 다른 describe들이 쓰는 동기 메모리 저장소로 되돌리고 재수화를 끝난 상태로 복원한다.
    store.persist.setOptions({ storage: createJSONStorage(() => persistStorage) });
    await store.persist.rehydrate();
    localBackend.resetLocalBackendForTests();
  });

  it("빈 저장소의 늦은 재수화가 그 사이 등록된 아이를 지우지 않는다 (레이스 1)", async () => {
    const gate = deferred<string | null>();
    store.persist.setOptions({ storage: createJSONStorage(() => controlledStorage(() => gate.promise)) });
    const rehydration = store.persist.rehydrate();
    expect(store.persist.hasHydrated()).toBe(false);

    // 밸브가 먼저 열린 콜드 스타트: 사용자가 온보딩을 진행한다(테스트 로그인 → 아이 등록).
    localBackend.ensureLocalBackendSeeded();
    localBackend.createChild({ nickname: "첫째" });
    localBackend.updateChild(LOCAL_CHILD_ID, { stageMode: "born", birthDate: seoulMonthsAgo(1) });

    // 첫 설치라 저장소는 비어 있다 — 그 재수화가 이제서야 도착한다.
    gate.resolve(null);
    await rehydration;

    // 수리 전: merge(undefined, current)가 initialState로 덮어 아이가 사라졌다(getHome 실패).
    expect(localBackend.localChildId()).toBe(LOCAL_CHILD_ID);
    expect(() => localBackend.getHome(LOCAL_CHILD_ID)).not.toThrow();
    expect(localBackend.getHome(LOCAL_CHILD_ID).child.nickname).toBe("첫째");
  });

  it("첫 진입 요청(getHome)이 재수화를 기다렸다가 저장된 아이로 답한다 (레이스 2)", async () => {
    // 온보딩을 마친 기기의 저장 블롭(버전 3)을 실제 상태에서 만든다.
    localBackend.ensureLocalBackendSeeded();
    localBackend.createChild({ nickname: "여정이" });
    localBackend.updateChild(LOCAL_CHILD_ID, { stageMode: "born", birthDate: seoulMonthsAgo(2) });
    const persistedBlob = JSON.stringify({ state: store.getState(), version: 3 });

    // 프로세스 재시작 모사: 메모리는 초기 상태, 저장소 읽기는 아직 도착 전.
    const gate = deferred<string | null>();
    store.persist.setOptions({ storage: createJSONStorage(() => controlledStorage(() => gate.promise)) });
    localBackend.resetLocalBackendForTests();
    const rehydration = store.persist.rehydrate();

    // 라우팅 밸브가 먼저 열려 첫 요청이 지금 나간다 — 수리 전에는 초기 상태를 읽고
    // "아이 프로필을 찾을 수 없어요"로 즉시 거부됐다(전면 에러 카드의 실체).
    const firstEntry = clientGetHome(LOCAL_SESSION_TOKEN, LOCAL_CHILD_ID).then(
      (home) => ({ ok: true as const, home }),
      (error: unknown) => ({ ok: false as const, error })
    );

    gate.resolve(persistedBlob);
    await rehydration;

    const outcome = await firstEntry;
    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.home.child).toMatchObject({ id: LOCAL_CHILD_ID, nickname: "여정이" });
    }
  });

  it("재수화가 이미 끝난 평상시에는 준비 대기가 즉시 풀린다", async () => {
    await expect(localBackend.whenLocalBackendReady()).resolves.toBe(true);
  });

  it("재수화가 영영 끝나지 않아도 요청이 매달리지 않는다 (밸브)", async () => {
    store.persist.setOptions({
      storage: createJSONStorage(() => controlledStorage(() => new Promise<string | null>(() => {})))
    });
    void store.persist.rehydrate();

    await expect(localBackend.whenLocalBackendReady(50)).resolves.toBe(false);
  });

  it("첫 진입 요청 경로가 준비 대기를 실제로 배선한다 (바이트 계약)", () => {
    const clientSource = readFileSync(join(process.cwd(), "src/api/client.ts"), "utf8");
    // local()이 재수화 대기를 지나지 않으면 초기화 전 조회 레이스가 되살아난다.
    expect(clientSource).toContain("localBackend.whenLocalBackendReady().then((ready) =>");
    const backendSource = readFileSync(join(process.cwd(), "src/api/local-backend.ts"), "utf8");
    // merge의 빈-저장소 보존 갈래 — 이 갈래가 사라지면 늦은 재수화가 온보딩 입력을 덮는다.
    expect(backendSource).toContain("persisted === undefined || persisted === null");
  });

  /**
   * 전면 에러 카드의 직접 원인(위 머리말 셋째 문단): 홈 화면의 훅이 조기 반환 아래로 내려가면
   * 로딩 → 데이터 전환의 두 번째 렌더가 훅을 더 부르고, React가 던진 오류를 ErrorBoundary가
   * 받아 첫 진입이 통째로 🍼 카드가 된다. HomeScreen 본문의 모든 훅 호출은 첫 조기 반환
   * (`if (hasSession && homePhase === "error")`)보다 앞서야 한다.
   */
  it("홈 화면의 훅은 전부 조기 반환보다 먼저 선다 (첫 진입 훅 순서 계약)", () => {
    const homeSource = readFileSync(join(process.cwd(), "app/(tabs)/index.tsx"), "utf8");
    const firstEarlyReturn = homeSource.indexOf('if (hasSession && homePhase === "error")');
    expect(firstEarlyReturn).toBeGreaterThan(0);

    // 라운드 55 트랙 C / DSN-053 P2-A가 조기 반환 아래 두었던 네 선언이 위로 올라와 있다.
    for (const declaration of [
      "const recurringTemplates = useRecurringExpenseStore(",
      "const skipRecurringThisMonth = useRecurringExpenseStore(",
      "const recurringReminder = useMemo(",
      "const quickRecordChips = useMemo("
    ]) {
      const at = homeSource.indexOf(declaration);
      expect(at, declaration).toBeGreaterThan(0);
      expect(at, `${declaration} — 조기 반환보다 먼저 서야 한다`).toBeLessThan(firstEarlyReturn);
    }

    // 그리고 조기 반환 아래에는 훅 호출이 하나도 새로 들어오지 않는다(주석 제외).
    const hookCallsAfterEarlyReturns = homeSource
      .slice(firstEarlyReturn)
      .split("\n")
      .filter((line) => {
        if (/^\s*(\*|\/\/|\{\/\*)/.test(line)) return false;
        const code = line.split("//")[0];
        return /(?:^|[^.\w])use[A-Z][A-Za-z]*\(/.test(code);
      });
    expect(hookCallsAfterEarlyReturns).toEqual([]);
  });
});
