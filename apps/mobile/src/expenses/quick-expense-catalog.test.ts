import { describe, expect, it } from "vitest";
import { categoryCatalog } from "../categories";
import {
  amountAfterQuickExpenseSelection,
  defaultQuickExpenseItemIds,
  quickExpenseCatalogItemForLabel,
  quickExpenseItemCatalog,
  quickExpenseItemsForCategory
} from "./quick-expense-catalog";

describe("quick expense item catalog", () => {
  it("keeps three distinct quick items mapped to every accounting category", () => {
    expect(quickExpenseItemCatalog).toHaveLength(categoryCatalog.length * 3);
    for (const category of categoryCatalog) {
      expect(quickExpenseItemsForCategory(category.code)).toHaveLength(3);
    }
    expect(new Set(quickExpenseItemCatalog.map((item) => item.id)).size).toBe(quickExpenseItemCatalog.length);
  });

  it("keeps common one-tap defaults valid and resolves labels without changing the accounting taxonomy", () => {
    const ids = new Set(quickExpenseItemCatalog.map((item) => item.id));
    expect(defaultQuickExpenseItemIds.every((id) => ids.has(id))).toBe(true);
    expect(quickExpenseCatalogItemForLabel(" 기저귀 ")).toMatchObject({
      categoryCode: "diaper_hygiene",
      label: "기저귀"
    });
    expect(quickExpenseCatalogItemForLabel("없는 품목")).toBeUndefined();
  });

  it("clears stale amounts across items, preserves the same item, and lets explicit preset amounts win", () => {
    const base = {
      currentItemName: "기저귀",
      currentCategoryId: "diaper",
      currentAmountText: "38500",
      nextCategoryId: "diaper"
    };
    expect(amountAfterQuickExpenseSelection({ ...base, nextItemName: "기저귀" })).toBe("38500");
    expect(amountAfterQuickExpenseSelection({ ...base, nextItemName: "물티슈" })).toBe("");
    expect(amountAfterQuickExpenseSelection({
      ...base,
      nextItemName: "물티슈",
      defaultAmountText: "12000"
    })).toBe("12000");
  });
});
