import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { evaluateBudgetWarning } from "./budget-warning";

const BUDGET = 1_000_000;

describe("HOME-BUDGET-113 evaluateBudgetWarning boundaries", () => {
  it("stays silent below 80% usage (79%)", () => {
    expect(evaluateBudgetWarning({ budgetKrw: BUDGET, spentKrw: 790_000 })).toBeNull();
    expect(evaluateBudgetWarning({ budgetKrw: BUDGET, spentKrw: 799_999 })).toBeNull();
  });

  it("warns 'approaching' from exactly 80%", () => {
    expect(evaluateBudgetWarning({ budgetKrw: BUDGET, spentKrw: 800_000 })).toEqual({
      level: "approaching",
      usedPercent: 80,
      overAmountKrw: 0,
      title: "이번 달 예산의 80%를 사용했어요",
      body: "남은 예산을 확인해보세요."
    });
  });

  it("still warns 'approaching' at 99%", () => {
    const warning = evaluateBudgetWarning({ budgetKrw: BUDGET, spentKrw: 990_000 });
    expect(warning?.level).toBe("approaching");
    expect(warning?.title).toBe("이번 달 예산의 99%를 사용했어요");
  });

  it("floors the displayed percent -- 99.99% shows 99%, never a false '100%'", () => {
    const warning = evaluateBudgetWarning({ budgetKrw: BUDGET, spentKrw: 999_999 });
    expect(warning?.level).toBe("approaching");
    expect(warning?.usedPercent).toBe(99);
    expect(warning?.title).toBe("이번 달 예산의 99%를 사용했어요");
  });

  it("treats exactly 100% as the exceeded bucket but never claims '0원 초과'", () => {
    expect(evaluateBudgetWarning({ budgetKrw: BUDGET, spentKrw: BUDGET })).toEqual({
      level: "exceeded",
      usedPercent: 100,
      overAmountKrw: 0,
      title: "이번 달 예산을 모두 사용했어요",
      body: "이번 달 지출을 확인해 볼까요?"
    });
  });

  it("reports the exact over amount at 101%", () => {
    expect(evaluateBudgetWarning({ budgetKrw: BUDGET, spentKrw: 1_010_000 })).toEqual({
      level: "exceeded",
      usedPercent: 101,
      overAmountKrw: 10_000,
      title: "이번 달 예산을 10,000원 초과했어요",
      body: "이번 달 지출을 확인해 볼까요?"
    });
  });

  it("formats the over amount with comma grouping (formatKrw)", () => {
    const warning = evaluateBudgetWarning({ budgetKrw: BUDGET, spentKrw: 2_234_567 });
    expect(warning?.title).toBe("이번 달 예산을 1,234,567원 초과했어요");
  });

  it("never warns when no budget is set (amountKrw 0 from the home API, or nullish)", () => {
    expect(evaluateBudgetWarning({ budgetKrw: 0, spentKrw: 999_999_999 })).toBeNull();
    expect(evaluateBudgetWarning({ budgetKrw: null, spentKrw: 999_999_999 })).toBeNull();
    expect(evaluateBudgetWarning({ budgetKrw: undefined, spentKrw: 999_999_999 })).toBeNull();
    expect(evaluateBudgetWarning({ budgetKrw: -1, spentKrw: 999_999_999 })).toBeNull();
    expect(evaluateBudgetWarning({ budgetKrw: Number.NaN, spentKrw: 999_999_999 })).toBeNull();
  });

  it("never warns on zero/invalid spend", () => {
    expect(evaluateBudgetWarning({ budgetKrw: BUDGET, spentKrw: 0 })).toBeNull();
    expect(evaluateBudgetWarning({ budgetKrw: BUDGET, spentKrw: -1 })).toBeNull();
    expect(evaluateBudgetWarning({ budgetKrw: BUDGET, spentKrw: Number.NaN })).toBeNull();
    expect(evaluateBudgetWarning({ budgetKrw: BUDGET, spentKrw: null })).toBeNull();
  });

  it("compares the 80% threshold exactly in integer KRW (no floating-point drift)", () => {
    // budget 3원: 80% is 2.4원, so 2원 (66.6%) must stay silent and 3원 is exactly-on-budget.
    expect(evaluateBudgetWarning({ budgetKrw: 3, spentKrw: 2 })).toBeNull();
    expect(evaluateBudgetWarning({ budgetKrw: 3, spentKrw: 3 })?.level).toBe("exceeded");
    // budget 5원: 4원 is exactly 80%.
    expect(evaluateBudgetWarning({ budgetKrw: 5, spentKrw: 4 })?.level).toBe("approaching");
  });

  it("operates on the gift-excluded total (DNC-015): gifts must not push usage over a threshold", () => {
    // The banner input is HomeSummary.monthly.usedAmountKrw, which both backends compute by
    // summing only expenseType === "expense" records. Mirror that contract here: the same
    // month with a large gift record must be evaluated WITHOUT the gift amount.
    const monthRecords = [
      { expenseType: "expense" as const, amountKrw: 700_000 },
      { expenseType: "gift" as const, amountKrw: 500_000 },
      { expenseType: "expense" as const, amountKrw: 90_000 }
    ];
    const giftExcludedTotal = monthRecords
      .filter((record) => record.expenseType === "expense")
      .reduce((sum, record) => sum + record.amountKrw, 0);
    expect(giftExcludedTotal).toBe(790_000);
    // Gift-excluded: 79% -> silent. A naive gift-included sum (1,290,000) would falsely warn.
    expect(evaluateBudgetWarning({ budgetKrw: BUDGET, spentKrw: giftExcludedTotal })).toBeNull();
  });
});

describe("HOME-BUDGET-113 home screen wiring contract", () => {
  const homeSource = readFileSync(join(process.cwd(), "app/(tabs)/index.tsx"), "utf8");

  it("renders the banner from the pure module, announced as an alert with its text", () => {
    expect(homeSource).toContain("evaluateBudgetWarning");
    expect(homeSource).toContain('accessibilityRole="alert"');
    expect(homeSource).toContain('testID="home-budget-warning-banner"');
    // Meaning is carried by text (title + body), not color alone.
    expect(homeSource).toContain("{budgetWarning.title}");
    expect(homeSource).toContain("{budgetWarning.body}");
  });

  it("keeps the logged-out preview inert (session-gated like NOTI-102)", () => {
    expect(homeSource).toContain(
      "hasSession ? evaluateBudgetWarning({ budgetKrw: budget, spentKrw: monthlyUsed }) : null"
    );
  });

  it("uses the brand semantic warning/danger tokens for the two tones", () => {
    expect(homeSource).toContain("theme.colors.warning");
    expect(homeSource).toContain("theme.colors.danger");
  });
});
