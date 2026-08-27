import { describe, expect, it } from "vitest";
import type { AdminCategory } from "./admin-api";
import {
  CATEGORY_GROUP_LABELS,
  categoryDraftError,
  categoryDraftPatch,
  categoryGroup,
  emptyCategoryFilter,
  filterCategories,
  isAliasLikeCategory,
  isOfferedInApp,
  selectableToggleWarning,
  toCategoryDraft
} from "./category-rows";

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

// ADM-127: 시드 21행은 정식 12 + 모바일 퀵타일 별칭 8 + 가져오기 스텁 1로 나뉜다
// (apps/api/prisma/seed-data.ts). 분류는 code 접두로만 하고, selectable 현재값에
// 기대지 않는다 — 토글한 순간 분류가 바뀌면 경고를 낼 수 없기 때문.
describe("categoryGroup (ADM-127)", () => {
  it("classifies canonical, mobile-alias and import-stub rows by code prefix", () => {
    expect(categoryGroup({ code: "diaper_hygiene" })).toBe("canonical");
    expect(categoryGroup({ code: "etc" })).toBe("canonical");
    expect(categoryGroup({ code: "mobile_diaper_hygiene" })).toBe("mobile_alias");
    expect(categoryGroup({ code: "mobile_etc" })).toBe("mobile_alias");
    expect(categoryGroup({ code: "import_stub_default" })).toBe("import_stub");
  });

  it("keeps the classification stable when selectable is toggled back on", () => {
    const alias: AdminCategory = category({ code: "mobile_etc", selectable: false });
    expect(isAliasLikeCategory(alias)).toBe(true);
    const reExposedAlias: AdminCategory = { ...alias, selectable: true };
    expect(isAliasLikeCategory(reExposedAlias)).toBe(true);
    expect(isAliasLikeCategory(category())).toBe(false);
  });

  it("labels every group in Korean", () => {
    expect(CATEGORY_GROUP_LABELS.canonical).toBe("정식");
    expect(CATEGORY_GROUP_LABELS.mobile_alias).toBe("앱 별칭");
    expect(CATEGORY_GROUP_LABELS.import_stub).toBe("가져오기 스텁");
  });
});

describe("selectableToggleWarning (CAT-124 규약 안내)", () => {
  it("warns only when an alias-like row is being turned back into a user-facing choice", () => {
    const alias = category({ code: "mobile_diaper_hygiene", name: "기저귀", selectable: false });
    const warning = selectableToggleWarning(alias, true);
    expect(warning).toContain("기저귀");
    expect(warning).toContain("앱 선택 목록에 다시 나타나");
  });

  it("stays silent for canonical rows and for hiding a row", () => {
    expect(selectableToggleWarning(category(), true)).toBeNull();
    expect(selectableToggleWarning(category(), false)).toBeNull();
    expect(selectableToggleWarning(category({ code: "mobile_etc", name: "기타" }), false)).toBeNull();
  });
});

describe("isOfferedInApp", () => {
  it("requires both active and selectable (CAT-124 기본 조회 조건)", () => {
    expect(isOfferedInApp({ active: true, selectable: true })).toBe(true);
    expect(isOfferedInApp({ active: true, selectable: false })).toBe(false);
    expect(isOfferedInApp({ active: false, selectable: true })).toBe(false);
  });
});

describe("filterCategories", () => {
  const rows = [
    category({ id: "a", code: "diaper_hygiene", name: "기저귀/위생" }),
    category({ id: "b", code: "mobile_diaper_hygiene", name: "기저귀", selectable: false }),
    category({ id: "c", code: "import_stub_default", name: "가져오기 기본", selectable: false }),
    category({ id: "d", code: "toys_books", name: "장난감/책" })
  ];

  it("returns everything with the empty filter", () => {
    expect(filterCategories(rows, emptyCategoryFilter())).toHaveLength(4);
  });

  it("matches code or name, case-insensitively", () => {
    expect(filterCategories(rows, { search: "DIAPER", group: "all" }).map((row) => row.id)).toEqual(["a", "b"]);
    expect(filterCategories(rows, { search: "장난감", group: "all" }).map((row) => row.id)).toEqual(["d"]);
    expect(filterCategories(rows, { search: "  ", group: "all" })).toHaveLength(4);
  });

  it("narrows by group and combines with the search term", () => {
    expect(filterCategories(rows, { search: "", group: "mobile_alias" }).map((row) => row.id)).toEqual(["b"]);
    expect(filterCategories(rows, { search: "diaper", group: "canonical" }).map((row) => row.id)).toEqual(["a"]);
    expect(filterCategories(rows, { search: "diaper", group: "import_stub" })).toHaveLength(0);
  });
});

describe("category inline edit draft", () => {
  it("prefills from the row", () => {
    expect(toCategoryDraft(category({ displayOrder: 40 }))).toEqual({
      name: "기저귀/위생",
      displayOrder: "40",
      active: true,
      selectable: true
    });
  });

  it("rejects blank names, over-long names and non-integer orders", () => {
    const base = toCategoryDraft(category());
    expect(categoryDraftError({ ...base, name: "   " })).toContain("이름");
    expect(categoryDraftError({ ...base, name: "가".repeat(51) })).toContain("50자");
    expect(categoryDraftError({ ...base, displayOrder: "" })).toContain("표시 순서");
    expect(categoryDraftError({ ...base, displayOrder: "-1" })).toContain("0 이상");
    expect(categoryDraftError({ ...base, displayOrder: "1.5" })).toContain("0 이상");
    expect(categoryDraftError({ ...base, displayOrder: "100001" })).toContain("100000");
    expect(categoryDraftError(base)).toBeNull();
  });

  it("builds a patch containing only the axes that actually changed", () => {
    const row = category({ name: "기저귀/위생", displayOrder: 40, active: true, selectable: true });
    expect(categoryDraftPatch(row, { ...toCategoryDraft(row), name: "기저귀·위생" })).toEqual({ name: "기저귀·위생" });
    expect(categoryDraftPatch(row, { ...toCategoryDraft(row), displayOrder: "45" })).toEqual({ displayOrder: 45 });
    expect(categoryDraftPatch(row, { ...toCategoryDraft(row), selectable: false })).toEqual({ selectable: false });
    expect(categoryDraftPatch(row, { ...toCategoryDraft(row), active: false, selectable: false })).toEqual({
      active: false,
      selectable: false
    });
  });

  it("returns null when nothing changed, so no phantom audit-log entry is written", () => {
    const row = category();
    expect(categoryDraftPatch(row, toCategoryDraft(row))).toBeNull();
    // 앞뒤 공백만 다른 이름도 변경으로 치지 않는다.
    expect(categoryDraftPatch(row, { ...toCategoryDraft(row), name: "  기저귀/위생  " })).toBeNull();
  });

  it("never produces a patch key for id or code (DNC-007: 행 삭제·id 변경 금지)", () => {
    const row = category();
    const patch = categoryDraftPatch(row, { ...toCategoryDraft(row), name: "새 이름", selectable: false });
    expect(patch).not.toBeNull();
    expect(Object.keys(patch ?? {}).sort()).toEqual(["name", "selectable"]);
  });
});
