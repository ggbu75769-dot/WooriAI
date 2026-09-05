import { describe, expect, it } from "vitest";
import { MAX_MONEY_KRW } from "@wooriai/domain";
import { buildRecentExpenseDateChips, EXPENSE_MEMO_MAX_LENGTH, formatExpenseAmountInput, formatExpenseDate, sanitizeExpenseAmountText, validateExpenseDateInput, validateExpenseForm, validateExpenseMemo } from "./form-contract";

describe("shared expense create/edit form contract", () => {
  it("uses one money normalization and positive-won validation path", () => {
    expect(sanitizeExpenseAmountText("1,234,000원")).toBe("1234000");
    expect(formatExpenseAmountInput("1234000")).toBe("1,234,000");
    expect(validateExpenseForm({ itemName: "기저귀", amountText: "1234000", spentOn: "2024-02-29" })).toMatchObject({ valid: true, amountKrw: 1234000 });
    expect(validateExpenseForm({ itemName: "", amountText: "0", spentOn: "2024-02-29" })).toMatchObject({ valid: false, itemNameError: "품목을 입력해 주세요.", amountError: "0보다 큰 금액을 입력해 주세요." });
    expect(validateExpenseForm({ itemName: "기저귀", amountText: String(MAX_MONEY_KRW + 1), spentOn: "2024-02-29" })).toMatchObject({ valid: false, amountError: `입력 가능한 최대 금액은 ${MAX_MONEY_KRW.toLocaleString("ko-KR")}원이에요.` });
    expect(validateExpenseMemo("메".repeat(EXPENSE_MEMO_MAX_LENGTH))).toBeNull();
    expect(validateExpenseMemo("메".repeat(EXPENSE_MEMO_MAX_LENGTH + 1))).toBe("메모는 500자까지 입력할 수 있어요.");
  });

  it("keeps date-only values local and rejects calendar rollover", () => {
    expect(formatExpenseDate(new Date(2024, 1, 29, 23, 59)).iso).toBe("2024-02-29");
    expect(validateExpenseDateInput("2024-02-29")).toBeNull();
    expect(validateExpenseDateInput("2025-02-29")).toBe("존재하지 않는 날짜예요.");
  });

  it("offers yesterday, today, and tomorrow as the fixed quick-date contract", () => {
    expect(buildRecentExpenseDateChips(new Date(2026, 6, 28, 12))).toEqual([
      { iso: "2026-07-27", shortLabel: "어제" },
      { iso: "2026-07-28", shortLabel: "오늘" },
      { iso: "2026-07-29", shortLabel: "내일" }
    ]);
  });
});
