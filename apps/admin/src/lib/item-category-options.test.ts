import { describe, expect, it } from "vitest";
import type { AdminCategory } from "./admin-api";
import { UNKNOWN_ITEM_CATEGORY_LABEL, itemCategoryOptions } from "./item-category-options";

function category(overrides: Partial<AdminCategory> = {}): AdminCategory {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    code: "diaper_hygiene",
    name: "기저귀/위생",
    iconName: "diaper",
    displayOrder: 40,
    isSystem: true,
    active: true,
    selectable: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides
  };
}

// 라운드 49 C-02(어드민 조각): 준비템 분류 셀렉트의 선택지.
describe("itemCategoryOptions", () => {
  it("offers only the categories the app itself offers (active AND selectable)", () => {
    const options = itemCategoryOptions(
      [
        category({ id: "cat-canonical", name: "정식", displayOrder: 10 }),
        category({ id: "cat-inactive", name: "사용 꺼짐", displayOrder: 20, active: false }),
        category({ id: "cat-alias", name: "별칭", code: "mobile_diaper_hygiene", displayOrder: 30, selectable: false })
      ],
      ""
    );

    expect(options.map((option) => option.id)).toEqual(["cat-canonical"]);
  });

  it("sorts by displayOrder, then by name", () => {
    const options = itemCategoryOptions(
      [
        category({ id: "c", name: "나중", displayOrder: 20 }),
        category({ id: "b", name: "나", displayOrder: 10 }),
        category({ id: "a", name: "가", displayOrder: 10 })
      ],
      ""
    );

    expect(options.map((option) => option.id)).toEqual(["a", "b", "c"]);
  });

  it("keeps a saved category that is no longer offered, so the select never misreports it as 분류 없음", () => {
    const options = itemCategoryOptions(
      [
        category({ id: "cat-canonical", name: "정식", displayOrder: 10 }),
        category({ id: "cat-retired", name: "내린 분류", displayOrder: 20, active: false })
      ],
      "cat-retired"
    );

    expect(options).toEqual([
      { id: "cat-canonical", name: "정식" },
      { id: "cat-retired", name: "내린 분류" }
    ]);
  });

  it("keeps an unknown saved id visible under a label that does not invent a name", () => {
    const options = itemCategoryOptions([category({ id: "cat-canonical", name: "정식" })], "cat-gone");

    expect(options).toEqual([
      { id: "cat-canonical", name: "정식" },
      { id: "cat-gone", name: UNKNOWN_ITEM_CATEGORY_LABEL }
    ]);
  });

  it("never duplicates the saved category when it is already offered", () => {
    const options = itemCategoryOptions([category({ id: "cat-canonical" })], "cat-canonical");

    expect(options.map((option) => option.id)).toEqual(["cat-canonical"]);
  });

  it("does not mutate the input array's order", () => {
    const categories = [
      category({ id: "c", displayOrder: 30 }),
      category({ id: "a", displayOrder: 10 }),
      category({ id: "b", displayOrder: 20 })
    ];

    itemCategoryOptions(categories, "");

    expect(categories.map((entry) => entry.id)).toEqual(["c", "a", "b"]);
  });
});
