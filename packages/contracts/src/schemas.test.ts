import { describe, expect, it } from "vitest";
import { MAX_MONEY_KRW } from "@wooriai/domain";
import {
  childSchema,
  createExpenseRequestSchema,
  expenseSchema,
  homeMonthlyBudgetSchema,
  homeSummarySchema,
  importRowSchema,
  itemSummarySchema,
  moneyKrwSchema,
  productLinkSchema,
  reportYearlySchema
} from "./schemas";

describe("shared contract schemas", () => {
  it("shares the MoneyKRW positive integer contract", () => {
    expect(moneyKrwSchema.parse(49800)).toBe(49800);
    expect(() => moneyKrwSchema.parse(0)).toThrow();
    expect(() => moneyKrwSchema.parse(1.5)).toThrow();
    expect(moneyKrwSchema.parse(MAX_MONEY_KRW)).toBe(MAX_MONEY_KRW);
    expect(() => moneyKrwSchema.parse(MAX_MONEY_KRW + 1)).toThrow();
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
      amountKrw: 49800,
      spentOn: "2026-07-05",
      itemName: "기저귀"
    };

    expect(expenseSchema.parse(base).createdByUserId).toBeUndefined();
    expect(
      expenseSchema.parse({
        ...base,
        createdByUserId: "33333333-3333-4333-8333-333333333333"
      }).createdByUserId
    ).toBe("33333333-3333-4333-8333-333333333333");
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
