import { describe, expect, it } from "vitest";
import {
  childSchema,
  createExpenseRequestSchema,
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
    ).toMatchObject({ itemName: "기저귀", amountKrw: 49800 });

    expect(() =>
      createExpenseRequestSchema.parse({
        categoryId: "not-a-uuid",
        amountKrw: 0,
        spentOn: "2026-07-05",
        itemName: "기저귀"
      })
    ).toThrow();
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
