import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { categoryCatalog } from "../categories";
import {
  nextQuickExpenseLimit,
  QUICK_EXPENSE_DEFAULT_LIMIT,
  quickExpenseItemCatalog,
  quickExpenseItemsForCategory
} from "./quick-expense-catalog";

const newExpenseSource = readFileSync(join(process.cwd(), "app/expenses/new.tsx"), "utf8");

describe("quick-expense-catalog — 분류별 빠른 품목 (DSN-053 P2-C)", () => {
  it("모든 품목이 8타일 중 하나의 실제 id를 달고 있다 (지어낸 분류가 없다)", () => {
    const tileIds = new Set(categoryCatalog.map((category) => category.id));
    expect(quickExpenseItemCatalog.length).toBeGreaterThan(0);
    for (const item of quickExpenseItemCatalog) {
      expect(tileIds.has(item.categoryId), `${item.label}: ${item.categoryId}`).toBe(true);
    }
  });

  it("품목 id가 카탈로그 전체에서 유일하다 (React key 충돌 방지)", () => {
    const ids = quickExpenseItemCatalog.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  /**
   * 표의 키는 타일 **라벨**이라 오타가 나면 그 타일의 목록이 조용히 비어 버린다. 기본 6개를
   * 채우지 못하는 타일이 하나라도 있으면 여기서 잡힌다.
   */
  it("8타일 모두 기본 노출 개수(6개) 이상을 갖는다", () => {
    for (const category of categoryCatalog) {
      const items = quickExpenseItemsForCategory(category.id);
      expect(items.length, category.label).toBeGreaterThanOrEqual(QUICK_EXPENSE_DEFAULT_LIMIT);
    }
  });

  /**
   * "분유/유제품"과 "식비"는 서버 시드 code가 같다(feeding_babyfood). code로 묶었다면 두 타일이
   * 같은 목록을 보여 줬을 것이다 -- 그러면 "식비" 타일이 젖병·유축용품을 자기 품목이라고 말한다.
   */
  it("code를 공유하는 두 타일이 서로 다른 목록을 갖는다", () => {
    const formula = categoryCatalog.find((category) => category.label === "분유/유제품");
    const meal = categoryCatalog.find((category) => category.label === "식비");
    expect(formula?.code).toBe(meal?.code);
    const formulaLabels = quickExpenseItemsForCategory(formula!.id).map((item) => item.label);
    const mealLabels = quickExpenseItemsForCategory(meal!.id).map((item) => item.label);
    expect(formulaLabels).toContain("분유");
    expect(mealLabels).toContain("장보기");
    expect(formulaLabels.some((label) => mealLabels.includes(label))).toBe(false);
  });

  it("더 보기가 6 -> 12 -> 24로 넓히되 총 개수를 넘지 않는다", () => {
    expect(nextQuickExpenseLimit(6, 8)).toBe(8);
    expect(nextQuickExpenseLimit(6, 40)).toBe(12);
    expect(nextQuickExpenseLimit(12, 40)).toBe(24);
    expect(nextQuickExpenseLimit(24, 40)).toBe(24);
  });
});

describe("DSN-053 P2-C 화면 배선 (app/expenses/new.tsx)", () => {
  it("아코디언이 순수 모듈에서 목록·상한을 받아 온다 (화면에 표를 다시 적지 않는다)", () => {
    expect(newExpenseSource).toContain('from "../../src/expenses/quick-expense-catalog"');
    expect(newExpenseSource).toContain("quickExpenseItemsForCategory(category.id)");
    expect(newExpenseSource).toContain("nextQuickExpenseLimit(categoryLimit, categoryItems.length)");
    expect(newExpenseSource).toContain("QUICK_EXPENSE_DEFAULT_LIMIT");
  });

  it("펼친 분류 카드가 승인 원본의 수치를 그대로 쓴다", () => {
    expect(newExpenseSource).toContain("borderColor: expanded ? theme.colors.mainCoral :");
    expect(newExpenseSource).toContain("minHeight: 68");
    expect(newExpenseSource).toContain("backgroundColor: theme.colors.categoryColors[category.code]");
  });

  it("펼친 마지막 타일이 직접 입력이고, 품목명 입력으로 이어진다", () => {
    expect(newExpenseSource).toContain('label="직접 입력"');
    expect(newExpenseSource).toContain("startCustomItem(category)");
  });

  /**
   * 아코디언 품목 타일도 분류를 확정한다 -- 사용자가 고른 품목의 분류를 자동 추천이 뒤에서
   * 다른 것으로 바꾸면, 기록에 사용자가 고른 적 없는 분류가 남는다.
   */
  it("품목을 고르면 분류가 확정되고 저장 안내도 함께 눕는다", () => {
    const start = newExpenseSource.indexOf("const selectQuickExpenseItem = (");
    expect(start).toBeGreaterThan(0);
    const block = newExpenseSource.slice(start, newExpenseSource.indexOf("\n  };", start));
    expect(block).toContain("categoryTouchedRef.current = true;");
    expect(block).toContain("setAutoPickedCategory(null);");
    expect(block).toContain("setCategoryNoticeRequested(false);");
  });
});
