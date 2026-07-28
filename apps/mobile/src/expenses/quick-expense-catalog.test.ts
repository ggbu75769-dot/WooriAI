import { describe, expect, it } from "vitest";
import { categoryCatalog } from "../categories";
import {
  amountAfterQuickExpenseSelection,
  defaultQuickExpenseItemIds,
  nextQuickExpenseLimit,
  quickExpenseCatalogItemForLabel,
  quickExpenseItemCatalog,
  quickExpenseItemsForCategory,
  searchQuickExpenseCatalog
} from "./quick-expense-catalog";

describe("quick expense item catalog", () => {
  it("keeps at least six distinct quick items mapped to every accounting category", () => {
    expect(quickExpenseItemCatalog).toHaveLength(categoryCatalog.length * 8);
    for (const category of categoryCatalog) {
      expect(quickExpenseItemsForCategory(category.code).length).toBeGreaterThanOrEqual(6);
    }
    expect(new Set(quickExpenseItemCatalog.map((item) => item.id)).size).toBe(quickExpenseItemCatalog.length);
  });

  it("searches labels, aliases, category names, and Hangul choseong with stable ranking", () => {
    expect(searchQuickExpenseCatalog("진료비")[0]).toMatchObject({ id: "hospital-cost" });
    expect(searchQuickExpenseCatalog("다이퍼")[0]).toMatchObject({ id: "diaper" });
    expect(searchQuickExpenseCatalog("ㄱㅈㄱ")[0]).toMatchObject({ id: "diaper" });
    expect(searchQuickExpenseCatalog("diaper").map((item) => item.id)).toEqual(["diaper"]);
    expect(searchQuickExpenseCatalog("기저귀 위생").map((item) => item.categoryCode)).toContain("diaper_hygiene");
    expect(new Set(searchQuickExpenseCatalog("아기").map((item) => item.id)).size).toBe(searchQuickExpenseCatalog("아기").length);
  });

  it("uses the 6 to 12 to 24 expansion contract without exceeding the result count", () => {
    expect(nextQuickExpenseLimit(6, 20)).toBe(12);
    expect(nextQuickExpenseLimit(12, 20)).toBe(20);
    expect(nextQuickExpenseLimit(24, 8)).toBe(8);
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
