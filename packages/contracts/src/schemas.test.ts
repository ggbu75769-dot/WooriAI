import { describe, expect, it } from "vitest";
import {
  childSchema,
  createExpenseRequestSchema,
  deleteExpenseRequestSchema,
  listCategoriesResponseSchema,
  expenseSchema,
  homeMonthlyBudgetSchema,
  homeSummarySchema,
  importRowSchema,
  itemSummarySchema,
  moneyKrwSchema,
  productLinkSchema,
  reportCategorySchema,
  reportMonthlySchema,
  reportYearlySchema,
  updateExpenseRequestSchema,
  versionConflictResponseSchema
} from "./schemas";

describe("shared contract schemas", () => {
  it("shares the MoneyKRW positive integer contract", () => {
    expect(moneyKrwSchema.parse(49800)).toBe(49800);
    expect(() => moneyKrwSchema.parse(0)).toThrow();
    expect(() => moneyKrwSchema.parse(1.5)).toThrow();
  });

  it("validates CreateExpenseRequest shape from OpenAPI", () => {
    expect(
      createExpenseRequestSchema.parse({
        categoryId: "11111111-1111-4111-8111-111111111111",
        amountKrw: 49800,
        spentOn: "2026-07-05",
        itemName: "기저귀",
        paymentMethod: "card"
      })
    ).toMatchObject({ itemName: "기저귀", amountKrw: 49800, expenseType: "expense" });

    expect(() =>
      createExpenseRequestSchema.parse({
        categoryId: "not-a-uuid",
        amountKrw: 0,
        spentOn: "2026-07-05",
        itemName: "기저귀"
      })
    ).toThrow();
  });

  it("accepts an explicit gift expenseType on the create request and rejects unsupported values", () => {
    expect(
      createExpenseRequestSchema.parse({
        categoryId: "11111111-1111-4111-8111-111111111111",
        amountKrw: 49800,
        spentOn: "2026-07-05",
        itemName: "기저귀",
        expenseType: "gift"
      })
    ).toMatchObject({ expenseType: "gift" });

    expect(() =>
      createExpenseRequestSchema.parse({
        categoryId: "11111111-1111-4111-8111-111111111111",
        amountKrw: 49800,
        spentOn: "2026-07-05",
        itemName: "기저귀",
        expenseType: "refund"
      })
    ).toThrow();
  });

  it("keeps createdByUserId optional on the expense response contract", () => {
    const base = {
      id: "11111111-1111-4111-8111-111111111111",
      childId: "22222222-2222-4222-8222-222222222222",
      categoryId: "44444444-4444-4444-8444-444444444444",
      amountKrw: 49800,
      spentOn: "2026-07-05",
      itemName: "기저귀",
      version: 1
    };

    expect(expenseSchema.parse(base).createdByUserId).toBeUndefined();
    expect(
      expenseSchema.parse({
        ...base,
        createdByUserId: "33333333-3333-4333-8333-333333333333"
      }).createdByUserId
    ).toBe("33333333-3333-4333-8333-333333333333");
  });

  // CON-115: categoryId(DB not-null)와 version(MOB-103, 생성 시 1)은 required.
  it("requires categoryId and a positive integer version on the expense response contract", () => {
    const base = {
      id: "11111111-1111-4111-8111-111111111111",
      childId: "22222222-2222-4222-8222-222222222222",
      categoryId: "44444444-4444-4444-8444-444444444444",
      amountKrw: 49800,
      spentOn: "2026-07-05",
      itemName: "기저귀",
      version: 3
    };

    expect(expenseSchema.parse(base).version).toBe(3);

    const { categoryId: _categoryId, ...withoutCategory } = base;
    expect(() => expenseSchema.parse(withoutCategory)).toThrow();

    const { version: _version, ...withoutVersion } = base;
    expect(() => expenseSchema.parse(withoutVersion)).toThrow();
    expect(() => expenseSchema.parse({ ...base, version: 0 })).toThrow();
    expect(() => expenseSchema.parse({ ...base, version: 1.5 })).toThrow();
  });

  // CON-115: PATCH/DELETE의 expectedVersion 요청 계약.
  it("validates the expectedVersion update/delete request contracts and rejects refund on update", () => {
    expect(
      updateExpenseRequestSchema.parse({ amountKrw: 59800, expectedVersion: 2 })
    ).toEqual({ amountKrw: 59800, expectedVersion: 2 });
    // expectedVersion 없는 레거시 수정도 계속 유효하다.
    expect(updateExpenseRequestSchema.parse({ memo: "수정" })).toEqual({ memo: "수정" });
    expect(() => updateExpenseRequestSchema.parse({ expectedVersion: 0 })).toThrow();
    expect(() => updateExpenseRequestSchema.parse({ expenseType: "refund" })).toThrow();
    expect(updateExpenseRequestSchema.parse({ expenseType: "gift" }).expenseType).toBe("gift");

    expect(deleteExpenseRequestSchema.parse({ expectedVersion: 1 }).expectedVersion).toBe(1);
    expect(deleteExpenseRequestSchema.parse({}).expectedVersion).toBeUndefined();
    expect(() => deleteExpenseRequestSchema.parse({ expectedVersion: -1 })).toThrow();
  });

  // CON-115: 409 VERSION_CONFLICT 바디 계약 — {error:{...}, current}.
  it("validates the 409 VERSION_CONFLICT body with live, tombstone, and null current snapshots", () => {
    const error = {
      code: "VERSION_CONFLICT" as const,
      message: "다른 곳에서 먼저 변경됐어요. 최신 내용을 다시 불러와 주세요.",
      requestId: "req-1"
    };
    const liveCurrent = {
      id: "11111111-1111-4111-8111-111111111111",
      childId: "22222222-2222-4222-8222-222222222222",
      categoryId: "44444444-4444-4444-8444-444444444444",
      amountKrw: 30000,
      spentOn: "2026-07-05",
      itemName: "기저귀",
      merchant: null,
      memo: null,
      expenseType: "expense",
      source: "manual",
      createdByUserId: "33333333-3333-4333-8333-333333333333",
      version: 3
    };

    expect(versionConflictResponseSchema.parse({ error, current: liveCurrent }).current).toMatchObject({
      version: 3
    });
    expect(
      versionConflictResponseSchema.parse({
        error,
        current: { id: liveCurrent.id, deleted: true, version: 2 }
      }).current
    ).toEqual({ id: liveCurrent.id, deleted: true, version: 2 });
    expect(versionConflictResponseSchema.parse({ error, current: null }).current).toBeNull();

    // 다른 에러 코드는 이 계약이 아니다.
    expect(() =>
      versionConflictResponseSchema.parse({
        error: { ...error, code: "IDEMPOTENCY_KEY_CONFLICT" },
        current: null
      })
    ).toThrow();
  });

  it("lets the home summary budget be 0 when no monthly budget is set, unlike the strict budget endpoint contract", () => {
    const child = {
      id: "11111111-1111-4111-8111-111111111111",
      householdId: "22222222-2222-4222-8222-222222222222",
      nickname: "뽀미",
      stageMode: "manual" as const,
      manualStage: "infant_4_6" as const,
      currentStage: "infant_4_6" as const,
      stageLabel: "수동 선택: 4~6개월"
    };

    expect(
      homeMonthlyBudgetSchema.parse({
        childId: child.id,
        yearMonth: "2026-07-01",
        amountKrw: 0,
        usedAmountKrw: 0,
        remainingAmountKrw: 0
      }).amountKrw
    ).toBe(0);

    expect(
      homeSummarySchema.parse({
        child,
        totalExpenseKrw: 0,
        monthly: {
          childId: child.id,
          yearMonth: "2026-07-01",
          amountKrw: 0,
          usedAmountKrw: 0,
          remainingAmountKrw: 0
        },
        recommendedItems: [],
        recentExpenses: []
      }).monthly.amountKrw
    ).toBe(0);
  });

  it("validates child and item enums from the domain package", () => {
    expect(
      childSchema.parse({
        id: "11111111-1111-4111-8111-111111111111",
        householdId: "22222222-2222-4222-8222-222222222222",
        nickname: "뽀미",
        stageMode: "manual",
        manualStage: "infant_4_6",
        currentStage: "infant_4_6",
        stageLabel: "수동 선택: 4~6개월"
      }).currentStage
    ).toBe("infant_4_6");

    expect(() =>
      itemSummarySchema.parse({
        id: "33333333-3333-4333-8333-333333333333",
        name: "카시트",
        necessityLevel: "paid",
        status: "not_prepared"
      })
    ).toThrow();
  });

  it("keeps affiliate disclosure and import preview contracts explicit", () => {
    expect(
      productLinkSchema.parse({
        id: "44444444-4444-4444-8444-444444444444",
        platform: "coupang",
        title: "카시트 보기",
        isAffiliate: true,
        isSponsored: false,
        disclosureText: "이 링크로 구매하면 우리아이가 수수료를 받을 수 있어요."
      }).disclosureText
    ).toContain("수수료");

    expect(
      importRowSchema.parse({
        id: "55555555-5555-4555-8555-555555555555",
        rowIndex: 1,
        parsedDate: "2026-07-05",
        parsedItemName: "기저귀",
        parsedAmountKrw: 49800,
        confidence: 0.69,
        selected: false,
        validationStatus: "ready"
      }).selected
    ).toBe(false);
  });

  // CAT-101: GET /categories 응답 계약.
  it("validates the categories list contract including nullable iconName and display order", () => {
    const parsed = listCategoriesResponseSchema.parse({
      categories: [
        {
          id: "77777777-7777-4777-8777-777777777777",
          code: "diaper_hygiene",
          name: "기저귀/위생",
          iconName: "diaper",
          displayOrder: 40,
          isSystem: true,
          active: true
        },
        {
          id: "88888888-8888-4888-8888-888888888888",
          code: "etc",
          name: "기타",
          iconName: null,
          displayOrder: 999,
          isSystem: false,
          active: true
        }
      ]
    });
    expect(parsed.categories).toHaveLength(2);
    expect(parsed.categories[1].iconName).toBeNull();

    expect(() =>
      listCategoriesResponseSchema.parse({
        categories: [
          {
            id: "not-a-uuid",
            code: "diaper_hygiene",
            name: "기저귀/위생",
            displayOrder: 40,
            isSystem: true,
            active: true
          }
        ]
      })
    ).toThrow();
  });

  // CON-121(CON-115 권고 잔여분): categoryTop이 z.record(z.unknown())였을 때는
  // 아무 객체나 통과했다. 실응답 형태({categoryId, amountKrw, count})로 조인 뒤의 계약.
  it("pins the monthly report categoryTop rows to the real category breakdown shape", () => {
    const parsed = reportMonthlySchema.parse({
      childId: "66666666-6666-4666-8666-666666666666",
      yearMonth: "2026-07-01",
      totalExpenseKrw: 49800,
      budgetAmountKrw: 100000,
      categoryTop: [
        { categoryId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", amountKrw: 49800, count: 1 }
      ]
    });
    expect(parsed.categoryTop[0].count).toBe(1);

    // 예산 미설정 월은 budgetAmountKrw가 null이다.
    expect(
      reportMonthlySchema.parse({
        childId: "66666666-6666-4666-8666-666666666666",
        yearMonth: "2026-07-01",
        totalExpenseKrw: 0,
        budgetAmountKrw: null,
        categoryTop: []
      }).budgetAmountKrw
    ).toBeNull();

    // 임의의 객체는 더 이상 통과하지 않는다 (조이기 전 계약이 놓치던 것).
    expect(() =>
      reportMonthlySchema.parse({
        childId: "66666666-6666-4666-8666-666666666666",
        yearMonth: "2026-07-01",
        totalExpenseKrw: 49800,
        categoryTop: [{ 아무거나: "값" }]
      })
    ).toThrow();

    // 카테고리 리포트는 같은 항목 계약을 공유한다.
    expect(
      reportCategorySchema.parse({
        childId: "66666666-6666-4666-8666-666666666666",
        categories: [
          { categoryId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", amountKrw: 20000, count: 2 }
        ]
      }).categories
    ).toHaveLength(1);
    expect(() =>
      reportCategorySchema.parse({
        childId: "66666666-6666-4666-8666-666666666666",
        categories: [{ categoryId: "not-a-uuid", amountKrw: 20000, count: 2 }]
      })
    ).toThrow();
  });

  it("requires all 12 months in the yearly report contract", () => {
    const monthlyTotals = Array.from({ length: 12 }, (_, index) => ({
      yearMonth: `2026-${String(index + 1).padStart(2, "0")}`,
      totalExpenseKrw: 0
    }));

    expect(
      reportYearlySchema.parse({
        childId: "66666666-6666-4666-8666-666666666666",
        year: "2026",
        totalExpenseKrw: 0,
        monthlyTotals
      }).monthlyTotals
    ).toHaveLength(12);

    expect(() =>
      reportYearlySchema.parse({
        childId: "66666666-6666-4666-8666-666666666666",
        year: "2026",
        totalExpenseKrw: 0,
        monthlyTotals: monthlyTotals.slice(0, 11)
      })
    ).toThrow();
  });
});
