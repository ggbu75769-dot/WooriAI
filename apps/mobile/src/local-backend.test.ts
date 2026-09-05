import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getSeoulToday } from "@wooriai/domain";
import * as localBackend from "./api/local-backend";
import { LOCAL_CHILD_ID, LOCAL_HOUSEHOLD_ID, LOCAL_ITEM_DIAPER } from "./api/local-fixtures";
import { notificationRouteHref } from "./notifications/route";

const childId = LOCAL_CHILD_ID;

function currentYearMonth() {
  return getSeoulToday().slice(0, 7);
}

function nextDate(dateOnly: string) {
  const [year, month, day] = dateOnly.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + 1)).toISOString().slice(0, 10);
}

function capturedError(run: () => unknown) {
  try {
    run();
  } catch (error) {
    return error;
  }
  throw new Error("Expected the operation to fail.");
}

describe("Local test-mode backend data layer", () => {
  beforeEach(() => {
    localBackend.resetLocalBackendForTests();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("persists exact-child Today snooze with create-only CAS and fixture provenance", () => {
    const before = localBackend.getLocalTodayCenter(childId);
    expect(before.source).toBe("local_fixture");
    const ordinary = before.actions.find((entry) => entry.kind !== "safety_acknowledgement")!;
    expect(ordinary.preferenceScope).toEqual({ kind: "child", childId });
    expect(ordinary.preferenceVersion).toBe(0);

    const saved = localBackend.updateTodayPreference({
      householdId: LOCAL_HOUSEHOLD_ID,
      childId,
      actionKey: ordinary.actionKey,
      mode: "snooze",
      expectedVersion: 0
    });
    expect(saved).toMatchObject({
      actionKey: ordinary.actionKey,
      mode: "snooze",
      snoozedUntil: nextDate(getSeoulToday()),
      version: 1
    });
    expect(localBackend.getLocalTodayCenter(childId).actions.map((entry) => entry.actionKey))
      .not.toContain(ordinary.actionKey);
    expect(capturedError(() => localBackend.updateTodayPreference({
      householdId: LOCAL_HOUSEHOLD_ID,
      childId,
      actionKey: ordinary.actionKey,
      mode: "snooze",
      expectedVersion: 0
    }))).toMatchObject({ code: "TODAY_PREFERENCE_CONFLICT" });
  });

  it("rejects safety and foreign Today preference scopes without writes", () => {
    const safety = localBackend.getLocalTodayCenter(childId).actions
      .find((entry) => entry.kind === "safety_acknowledgement")!;
    expect(capturedError(() => localBackend.updateTodayPreference({
      householdId: LOCAL_HOUSEHOLD_ID,
      childId,
      actionKey: safety.actionKey,
      mode: "snooze",
      expectedVersion: 0
    }))).toMatchObject({ code: "SAFETY_ACTION_NOT_SNOOZABLE" });
    expect(capturedError(() => localBackend.updateTodayPreference({
      householdId: "433599cf-5a9e-4a9f-854d-c708139fd342",
      childId,
      actionKey: "local:ordinary",
      mode: "snooze",
      expectedVersion: 0
    }))).toMatchObject({ code: "HOUSEHOLD_FORBIDDEN" });
    expect(localBackend.useLocalBackendStore.getState().todayActionPreferences).toEqual([]);
  });

  it("resolves exact preference state independently of the ranked Home projection", () => {
    const ordinary = localBackend.getLocalTodayCenter(childId).actions
      .find((entry) => entry.kind !== "safety_acknowledgement")!;
    expect(localBackend.getTodayPreferenceResolution({
      householdId: LOCAL_HOUSEHOLD_ID,
      childId,
      actionKey: ordinary.actionKey
    }).preference).toBeNull();
    const saved = localBackend.updateTodayPreference({
      householdId: LOCAL_HOUSEHOLD_ID,
      childId,
      actionKey: ordinary.actionKey,
      mode: "snooze",
      expectedVersion: 0
    });
    expect(localBackend.getTodayPreferenceResolution({
      householdId: LOCAL_HOUSEHOLD_ID,
      childId,
      actionKey: ordinary.actionKey
    }).preference).toEqual(saved);
  });

  it("completes and persists the local safety acknowledgement journey", () => {
    const safety = localBackend.getLocalTodayCenter(childId).actions
      .find((entry) => entry.kind === "safety_acknowledgement")!;
    const inbox = localBackend.listLocalNotifications();
    expect(inbox.items).toEqual(expect.arrayContaining([
      expect.objectContaining({ category: "safety", importance: "critical", requiresAcknowledgement: true })
    ]));
    const alert = localBackend.getCatalogSafetyAlerts(childId).alerts
      .find((entry) => entry.itemDefinitionId === safety.sourceId)!;
    expect(alert.item?.nameKo).toBe("기저귀");

    localBackend.acknowledgeCatalogSafetyAlert(alert.id, alert.version);

    expect(localBackend.getCatalogSafetyAlerts(childId).alerts).toEqual([]);
    expect(localBackend.getLocalTodayCenter(childId).actions.map((entry) => entry.actionKey))
      .not.toContain(safety.actionKey);
  });

  it("scopes safety Inbox navigation and acknowledgement to the exact child", () => {
    localBackend.getHome(childId);
    const secondChildId = localBackend.createChild({
      nickname: "둘째",
      stageMode: "born",
      birthDate: "2025-07-26",
      gender: "unknown"
    }).id;
    const firstSafety = localBackend.getLocalTodayCenter(childId).actions
      .find((entry) => entry.kind === "safety_acknowledgement")!;
    const secondSafety = localBackend.getLocalTodayCenter(secondChildId).actions
      .find((entry) => entry.kind === "safety_acknowledgement")!;
    expect(firstSafety.actionKey).not.toBe(secondSafety.actionKey);

    const inbox = localBackend.listLocalNotifications();
    expect(inbox.items.map((item) => item.navigation)).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: "item", childId }),
      expect.objectContaining({ kind: "item", childId: secondChildId })
    ]));
    expect(inbox.items.map((item) =>
      notificationRouteHref(item.route, item.navigation, item.category)
    )).toEqual(expect.arrayContaining([
      `/(tabs)/items?surface=overview&contextType=child&contextId=${childId}`,
      `/(tabs)/items?surface=overview&contextType=child&contextId=${secondChildId}`
    ]));

    const firstAlert = localBackend.getCatalogSafetyAlerts(childId).alerts[0]!;
    localBackend.acknowledgeCatalogSafetyAlert(firstAlert.id, firstAlert.version);

    expect(localBackend.getCatalogSafetyAlerts(childId).alerts).toEqual([]);
    expect(localBackend.getLocalTodayCenter(childId).actions.map((entry) => entry.actionKey))
      .not.toContain(firstSafety.actionKey);
    expect(localBackend.getCatalogSafetyAlerts(secondChildId).alerts).toHaveLength(1);
    expect(localBackend.getLocalTodayCenter(secondChildId).actions.map((entry) => entry.actionKey))
      .toContain(secondSafety.actionKey);
    expect(localBackend.listLocalNotifications().items.map((item) => item.navigation))
      .toEqual([expect.objectContaining({ kind: "item", childId: secondChildId })]);
  });

  it("isolates and persists alternative-fixture safety acknowledgement per child", () => {
    vi.stubEnv("EXPO_PUBLIC_SAFETY_ALTERNATIVE_FIXTURE", "1");
    const secondChildId = localBackend.createChild({
      nickname: "둘째",
      stageMode: "born",
      birthDate: "2025-07-26",
      gender: "unknown"
    }).id;
    const firstAlert = localBackend.getCatalogSafetyAlerts(childId).alerts[0]!;
    const secondAlert = localBackend.getCatalogSafetyAlerts(secondChildId).alerts[0]!;
    expect(firstAlert.id).not.toBe(secondAlert.id);
    expect(localBackend.getCatalogSafetyAlternatives(firstAlert.id).alternatives).toHaveLength(1);
    expect(localBackend.getCatalogSafetyAlternatives(secondAlert.id).alternatives).toHaveLength(1);

    localBackend.acknowledgeCatalogSafetyAlert(firstAlert.id, firstAlert.version);

    expect(localBackend.getCatalogSafetyAlerts(childId).alerts).toEqual([]);
    expect(localBackend.getCatalogSafetyAlerts(secondChildId).alerts)
      .toEqual([expect.objectContaining({ id: secondAlert.id })]);
  });

  it("increments both the cumulative home total and the current-month report after a new expense", () => {
    const before = localBackend.getHome(childId);
    const monthlyBefore = localBackend.getMonthlyReport(childId, currentYearMonth());
    localBackend.createExpense(childId, {
      categoryId: "local-category-diaper",
      amountKrw: 12_345,
      spentOn: getSeoulToday(),
      itemName: "테스트 지출"
    });

    const after = localBackend.getHome(childId);
    const monthly = localBackend.getMonthlyReport(childId, currentYearMonth());

    expect(after.totalExpenseKrw).toBe(before.totalExpenseKrw + 12_345);
    expect(monthly.totalExpenseKrw).toBe(monthlyBefore.totalExpenseKrw + 12_345);
  });

  it("accepts 100 consecutive expense records without losing rows or totals", () => {
    const before = localBackend.listExpenses(childId, currentYearMonth());
    const addedTotalKrw = Array.from({ length: 100 }, (_, index) => 1_000 + index)
      .reduce((sum, amountKrw, index) => {
        localBackend.createExpense(childId, {
          categoryId: "local-category-diaper",
          amountKrw,
          spentOn: getSeoulToday(),
          itemName: `100건 검증 ${String(index + 1).padStart(3, "0")}`
        });
        return sum + amountKrw;
      }, 0);

    const after = localBackend.listExpenses(childId, currentYearMonth());
    expect(after.expenses).toHaveLength(before.expenses.length + 100);
    expect(after.totalAmountKrw).toBe(before.totalAmountKrw + addedTotalKrw);
    expect(new Set(after.expenses.map((expense) => expense.id)).size).toBe(after.expenses.length);

    const firstPage = localBackend.listExpenses(childId, currentYearMonth(), { limit: 50, search: "100건 검증" });
    const secondPage = localBackend.listExpenses(childId, currentYearMonth(), { cursor: firstPage.nextCursor, limit: 50, search: "100건 검증" });
    expect(firstPage.expenses).toHaveLength(50);
    expect(secondPage.expenses).toHaveLength(50);
    expect(firstPage.filteredRecordCount).toBe(100);
    expect(firstPage.filteredExpenseCount).toBe(100);
    expect(firstPage.filteredTotalAmountKrw).toBe(addedTotalKrw);
    expect(firstPage.nextCursor).not.toBeNull();
    expect(secondPage.nextCursor).toBeNull();
    expect(new Set([...firstPage.expenses, ...secondPage.expenses].map((expense) => expense.id)).size).toBe(100);
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

  it("keeps tomorrow visible as scheduled while excluding it from realized totals", () => {
    const before = localBackend.getHome(childId).totalExpenseKrw;
    const scheduledDate = nextDate(getSeoulToday());
    const scheduledMonth = scheduledDate.slice(0, 7);
    const monthlyBefore = localBackend.getMonthlyReport(childId, scheduledMonth).totalExpenseKrw;
    const scheduled = localBackend.createExpense(childId, {
      categoryId: "local-category-diaper",
      amountKrw: 22_000,
      spentOn: scheduledDate,
      itemName: "내일 예정 지출"
    });

    expect(localBackend.listExpenses(childId, scheduledMonth).expenses).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: scheduled.id, spentOn: scheduledDate })])
    );
    expect(localBackend.getHome(childId).totalExpenseKrw).toBe(before);
    expect(localBackend.getMonthlyReport(childId, scheduledMonth).totalExpenseKrw).toBe(monthlyBefore);
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

  it("provides a 100-record local import fixture for installed-app volume testing", () => {
    const job = localBackend.createExcelImport(childId, "wooriai-100-records.csv");
    const rows = localBackend.listImportRows(job.id).rows;

    expect(job.rowCount).toBe(100);
    expect(rows).toHaveLength(100);
    expect(rows.every((row) => row.selected && row.validationStatus === "valid")).toBe(true);

    const result = localBackend.confirmImport(job.id, rows.map((row) => row.id));
    expect(result).toEqual({ importedCount: 100, skippedCount: 0 });
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

  it("returns human-readable category names to the report instead of raw UUIDs", () => {
    const categoryId = "c0a7e901-0000-4c01-8c01-c47e900ec001";
    localBackend.createExpense(childId, {
      categoryId,
      amountKrw: 12_000,
      spentOn: getSeoulToday(),
      itemName: "기저귀"
    });

    const report = localBackend.getReportV2Categories(childId, "month", getSeoulToday());
    expect(report.categories.find((category) => category.categoryId === categoryId)).toMatchObject({
      categoryNameKo: "기저귀·위생"
    });
  });

  it("keeps preparation item names and necessity groups readable in report evidence", () => {
    const thermometer = localBackend.listCatalogItems({
      childId,
      query: "아기 체온계",
      limit: 10
    }).items.find((item) => item.nameKo === "아기 체온계");
    expect(thermometer).toBeDefined();

    localBackend.putCatalogItemPlan(childId, thermometer!.code, {
      state: "planned",
      budgetKrw: 35_000
    });

    const sources = localBackend.getReportV3Sources(
      childId,
      "month",
      getSeoulToday(),
      "planned"
    );
    expect(sources.items).toEqual(expect.arrayContaining([
      expect.objectContaining({
        itemDefinitionId: thermometer!.code,
        itemName: "아기 체온계",
        signedAmountKrw: 35_000
      })
    ]));

    const report = localBackend.getReportV3(childId, "month", getSeoulToday());
    expect(report.necessitySplit.find((entry) => entry.key === "essential"))
      .toMatchObject({ plannedCostKrw: 35_000, planCount: 1 });
  });

  it("keeps the item status change reflected on subsequent reads", () => {
    const updated = localBackend.updateItemStatus(childId, LOCAL_ITEM_DIAPER, "prepared");
    expect(updated.status).toBe("prepared");

    const preparedList = localBackend.listItems(childId, "prepared").items;
    expect(preparedList.some((item) => item.id === LOCAL_ITEM_DIAPER)).toBe(true);

    const nowList = localBackend.listItems(childId, "now").items;
    expect(nowList.some((item) => item.id === LOCAL_ITEM_DIAPER)).toBe(false);
  });

  it("keeps multiple child profiles and their budget, expense, and item state separate", () => {
    const second = localBackend.createChild({
      nickname: "하린이",
      stageMode: "manual",
      manualStage: "infant_4_6"
    });

    expect(localBackend.listChildren().children.map((child) => child.id)).toEqual([childId, second.id]);
    expect(localBackend.getChild(second.id)).toMatchObject({ nickname: "하린이", currentStage: "infant_4_6" });

    localBackend.updateChild(second.id, { nickname: "하린", manualStage: "toddler_1_3" });
    expect(localBackend.getChild(second.id)).toMatchObject({ nickname: "하린", currentStage: "toddler_1_3" });

    expect(localBackend.getHome(second.id).totalExpenseKrw).toBe(0);
    localBackend.createExpense(second.id, {
      categoryId: "local-category-diaper",
      amountKrw: 20_000,
      spentOn: getSeoulToday(),
      itemName: "둘째 지출"
    });
    expect(localBackend.getHome(second.id).totalExpenseKrw).toBe(20_000);
    expect(localBackend.getHome(childId).totalExpenseKrw).not.toBe(20_000);

    localBackend.upsertBudget(second.id, 300_000, currentYearMonth());
    expect(localBackend.getBudget(second.id, currentYearMonth()).amountKrw).toBe(300_000);
    expect(localBackend.getBudget(childId, currentYearMonth()).amountKrw).not.toBe(300_000);

    localBackend.updateItemStatus(second.id, LOCAL_ITEM_DIAPER, "prepared");
    expect(localBackend.listItems(second.id, "prepared").items.some((item) => item.id === LOCAL_ITEM_DIAPER)).toBe(true);
    expect(localBackend.listItems(childId, "prepared").items.some((item) => item.id === LOCAL_ITEM_DIAPER)).toBe(false);
  });

  it("stores only a safe payment-method label and keeps past expense linkage after deactivation", () => {
    expect(localBackend.listPaymentMethods().paymentMethods).toEqual([]);
    expect(() =>
      localBackend.createPaymentMethod({ type: "card", label: "1234-5678-9012-3456" })
    ).toThrow();

    const method = localBackend.createPaymentMethod({ type: "card", label: "생활비 카드", isDefault: true });
    const expense = localBackend.createExpense(childId, {
      categoryId: "local-category-diaper",
      amountKrw: 25_000,
      spentOn: getSeoulToday(),
      itemName: "기저귀",
      paymentMethodId: method.id
    });
    expect(expense).toMatchObject({ paymentMethod: "card", paymentMethodId: method.id });

    localBackend.deactivatePaymentMethod(method.id);
    expect(localBackend.getExpense(expense.id)).toMatchObject({ paymentMethodId: method.id });
    expect(() =>
      localBackend.createExpense(childId, {
        categoryId: "local-category-diaper",
        amountKrw: 1_000,
        spentOn: getSeoulToday(),
        itemName: "재사용 금지",
        paymentMethodId: method.id
      })
    ).toThrow();

    expect(localBackend.reactivatePaymentMethod(method.id)).toMatchObject({ id: method.id, active: true, isDefault: false });
    expect(localBackend.createExpense(childId, {
      categoryId: "local-category-diaper",
      amountKrw: 1_000,
      spentOn: getSeoulToday(),
      itemName: "다시 사용",
      paymentMethodId: method.id
    })).toMatchObject({ paymentMethodId: method.id });
  });

  it("derives at most six recent shortcuts while leaving amount confirmation to the form", () => {
    for (let index = 0; index < 3; index += 1) {
      localBackend.createExpense(childId, {
        categoryId: "local-category-diaper",
        amountKrw: 40_000 + index,
        spentOn: getSeoulToday(),
        itemName: "반복 기저귀"
      });
    }
    for (const [index, itemName] of ["분유", "물티슈", "간식", "병원", "도서", "장난감", "의류"].entries()) {
      localBackend.createExpense(childId, {
        categoryId: "local-category-diaper",
        amountKrw: 10_000 + index,
        spentOn: getSeoulToday(),
        itemName
      });
    }

    const shortcuts = localBackend.listExpenseShortcuts(childId).shortcuts;
    expect(shortcuts).toHaveLength(6);
    expect(shortcuts[0]).toMatchObject({ itemName: "반복 기저귀", useCount: 3 });
    expect(shortcuts[0]).toHaveProperty("lastAmountKrw");
    expect(shortcuts[0]).not.toHaveProperty("confirmedAmountKrw");
  });

  it("matches catalog initials and typo queries locally and reports missing items idempotently", () => {
    for (const query of ["ㅋㅅㅌ", "카시드"]) {
      const result = localBackend.listCatalogItems({ childId, query, limit: 10 });
      expect(result.items.slice(0, 3).map((item) => item.nameKo), `query=${query}`).toContain("신생아용 카시트");
      expect(result.items[0]?.searchMatch?.reason).toMatch(/initials|typo/);
      expect(result.search).toMatchObject({ rawQueryStored: false });
    }
    const codeResult = localBackend.listCatalogItems({ childId, query: "R4-C10-001", limit: 10 });
    expect(codeResult.items[0]).toMatchObject({ code: "R4-C10-001", searchMatch: { reason: "code" } });
    const first = localBackend.reportMissingCatalogItem("없는 품목 예시");
    const second = localBackend.reportMissingCatalogItem("없는 품목 예시");
    expect(first).toMatchObject({ idempotent: false, report: { reasonCode: "missing_item", state: "open" } });
    expect(second).toMatchObject({ idempotent: true, report: { id: first.report.id } });
  });

  it("keeps gender optional and outside recommendation ranking inputs", () => {
    const itemIdsBefore = localBackend.listItems(childId, "now").items.map((item) => item.id);
    localBackend.updateChild(childId, { gender: "직접 입력값" });
    const itemIdsAfter = localBackend.listItems(childId, "now").items.map((item) => item.id);

    expect(localBackend.getChild(childId).gender).toBe("직접 입력값");
    expect(itemIdsAfter).toEqual(itemIdsBefore);
    localBackend.updateChild(childId, { gender: "" });
    expect(localBackend.getChild(childId).gender).toBeNull();
  });

  it("creates a downloadable privacy export without exposing authentication or device secrets", () => {
    const request = localBackend.requestDataExport();
    expect(request).toMatchObject({ requestType: "export", state: "completed" });
    expect(localBackend.getPrivacyRequest(request.id)).toEqual(request);

    const payload = localBackend.getPrivacyExportPayload(request.id);
    expect(payload).toMatchObject({
      schemaVersion: 1,
      requestId: request.id,
      data: { profile: { displayName: "로컬 테스트 사용자" } }
    });
    const serialized = JSON.stringify(payload);
    expect(serialized).not.toContain("pushToken");
    expect(serialized).not.toContain("refreshToken");
    expect(serialized).not.toContain("providerSubject");
  });
});
