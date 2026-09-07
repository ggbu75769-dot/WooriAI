import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { buildCategoryNameLookup, selectableCategories, type SelectableCategory } from "../categories";
import { buildCategoryBudgetForm } from "./category-budget-form";
import { buildRecordsCategoryChips } from "./records-list-view";

/**
 * 라운드 103 리뷰 M-2 — **다가구 사용자에게 "고를 수는 있는데 저장하면 400"인 분류 칩**.
 *
 * ## 무엇이 어긋나 있었나
 * 읽기와 쓰기의 스코프가 갈려 있다. `GET /categories`의 읽기는 **속한 가구 전부의 합집합**이고
 * (apps/api/src/finance/categories.controller.ts — 서버 설계 §1.3), 쓰기 검증은 전부 **가구
 * 하나**로 좁힌다(`requireExistingCategory` · `requireBudgetableCategories` · 가져오기 확정).
 * 클라이언트에는 그 축이 아예 없어서, 두 가구 A·B에 모두 속한 사용자에게 B의 커스텀
 * "산후도우미"가 A의 화면에 **활성·selectable인 정상 칩으로** 섰다:
 *
 *   ⓐ 지출 수정 — 탭 → 저장 → 400 EXPENSE_CATEGORY_INVALID("존재하지 않는 카테고리예요").
 *   ⓑ 카테고리 예산 — 같은 칩이 폼 행으로 서고, 저장 400이 **그 달의 총액 예산까지 함께**
 *      막는다(replace-set은 한 요청이다).
 *   ⓒ 가져오기 검수 — 행 저장은 실재·소유를 묻지 않아 통과하고(FK는 실재하는 행이라 통과한다),
 *      뒤이은 확정이 400을 던지며 **배치 전체가 롤백**된다.
 *
 * ## 이 스위트가 무는 것 — **두 사실을 언제나 함께**
 *  1. 다른 가구의 커스텀은 **내미는 목록**(칩·예산 행)에 서지 않는다;
 *  2. 그런데 **이름 해석은 여전히 그 분류를 해석한다**(`buildCategoryNameLookup`은 합집합 전량을
 *     본다). 둘 중 하나만 지키면 다른 쪽이 깨진다 — 해석까지 좁히면 다른 가구 분류로 기록된 과거
 *     지출이 기록 탭·리포트 범례·CSV에서 일제히 "기타"로 무너지고, 그것이 라운드 28 F3가 허위
 *     표시로 판정한 바로 그 상태다.
 *  3. 가구를 **아직 모르는 갈래**(콜드 진입 · `["children"]` 캐시 없음 → `householdId === null`)
 *     에서는 아무것도 좁히지 않는다 — 자기 가구 분류 칩이 잠깐 사라졌다 돌아오는 깜빡임을 만들지
 *     않는다. 1가구 계정에서는 합집합이 곧 그 가구라 이 축이 켜지든 꺼지든 결과가 같다.
 */

const mobileRoot = process.cwd();
const source = (relativePath: string) => readFileSync(join(mobileRoot, relativePath), "utf8");

const HOUSEHOLD_A = "household-a";
const HOUSEHOLD_B = "household-b";

/** 시드 행 — `householdId` **키 자체가 없다**(서버 §2.2의 가산 필드 규칙). */
const SEED_DIAPER: SelectableCategory = {
  id: "seed-diaper",
  code: "diaper_hygiene",
  name: "기저귀/위생",
  selectable: true,
  active: true
};
const SEED_ETC: SelectableCategory = {
  id: "seed-etc",
  code: "etc",
  name: "기타",
  selectable: true,
  active: true
};
/** 우리 가구(A)의 커스텀 — 커스텀은 언제나 `selectable: true`이고 `active`가 보관 축이다. */
const MINE_POSTPARTUM: SelectableCategory = {
  id: "custom-a-postpartum",
  code: "custom_aaaa",
  name: "산후조리",
  selectable: true,
  active: true,
  householdId: HOUSEHOLD_A
};
/** 다른 가구(B)의 커스텀 — 합집합 응답에 그대로 실려 온다. 화면이 걸러야 하는 유일한 행이다. */
const THEIRS_HELPER: SelectableCategory = {
  id: "custom-b-helper",
  code: "custom_bbbb",
  name: "산후도우미",
  selectable: true,
  active: true,
  householdId: HOUSEHOLD_B
};

/** 다가구 사용자가 실제로 받는 목록 = 시드 + A의 커스텀 + B의 커스텀(합집합). */
const UNION_LIST: SelectableCategory[] = [SEED_DIAPER, SEED_ETC, MINE_POSTPARTUM, THEIRS_HELPER];

describe("라운드 103 M-2 — 내미는 목록의 소유자 축 (selectableCategories)", () => {
  it("다른 가구의 커스텀은 목록에 서지 않고, 시드와 우리 가구 커스텀은 그대로 선다", () => {
    const ids = selectableCategories(UNION_LIST, null, HOUSEHOLD_A).map((category) => category.id);

    // 양쪽 끝(라운드 78 E): 부정 단언만 두면 목록이 통째로 비어도 영원히 초록이다.
    expect(ids).toContain(SEED_DIAPER.id);
    expect(ids).toContain(SEED_ETC.id);
    expect(ids).toContain(MINE_POSTPARTUM.id);
    expect(ids).not.toContain(THEIRS_HELPER.id);
  });

  it("그런데 **이름 해석은 그 분류를 계속 해석한다** — 같은 응답 하나로 두 사실이 함께 성립한다", () => {
    const nameOf = buildCategoryNameLookup(UNION_LIST);

    // 좁힌 목록에서 사라진 그 id가, 이름 해석에서는 그대로 자기 이름을 준다.
    expect(nameOf(THEIRS_HELPER.id)).toBe("산후도우미");
    // 양쪽 끝: 해석 자체가 죽으면(전부 "기타") 위 단언 하나로는 알 수 없다.
    expect(nameOf(MINE_POSTPARTUM.id)).toBe("산후조리");
    expect(nameOf(SEED_DIAPER.id)).toBe("기저귀/위생");
    // 이 목록에 없는 id만 폴백으로 떨어진다(종전 규칙 그대로).
    expect(nameOf("id-that-is-not-in-the-list")).toBe("기타");
  });

  it("가구를 아직 모르면(콜드 진입 · 생략 · null) 아무것도 좁히지 않는다 — 칩이 깜빡이지 않는다", () => {
    const withoutScope = selectableCategories(UNION_LIST).map((category) => category.id);
    const withNullScope = selectableCategories(UNION_LIST, null, null).map((category) => category.id);

    expect(withoutScope).toEqual([SEED_DIAPER.id, SEED_ETC.id, MINE_POSTPARTUM.id, THEIRS_HELPER.id]);
    expect(withNullScope).toEqual(withoutScope);
  });

  it("규칙 (d)는 여전히 먼저다: 이미 그 분류로 저장된 값이면 다른 가구 것이어도 칩이 남는다", () => {
    // 그 행을 지우면 화면이 **현재 값을 잃는다** — 무엇으로 기록돼 있는지 보여 줄 자리가 없어진다.
    const ids = selectableCategories(UNION_LIST, THEIRS_HELPER.id, HOUSEHOLD_A).map((category) => category.id);

    expect(ids).toContain(THEIRS_HELPER.id);
    // 다른 값이 현재 값이면 다시 사라진다(규칙 (d)가 만든 예외이지 축의 무력화가 아니다).
    expect(
      selectableCategories(UNION_LIST, MINE_POSTPARTUM.id, HOUSEHOLD_A).map((category) => category.id)
    ).not.toContain(THEIRS_HELPER.id);
  });

  it("소유자 축은 노출 두 축과 독립이다: 우리 가구의 **보관된** 커스텀은 종전대로 active가 거른다", () => {
    const archivedMine: SelectableCategory = { ...MINE_POSTPARTUM, id: "custom-a-archived", active: false };
    const ids = selectableCategories([...UNION_LIST, archivedMine], null, HOUSEHOLD_A).map(
      (category) => category.id
    );

    expect(ids).toContain(MINE_POSTPARTUM.id);
    expect(ids).not.toContain(archivedMine.id);
  });
});

describe("라운드 103 M-2 — 기록 탭 칩 대장(buildRecordsCategoryChips)", () => {
  it("다른 가구 커스텀은 칩으로 서지 않고, 우리 가구 커스텀 칩은 자기 이름으로 선다", () => {
    const chips = buildRecordsCategoryChips(UNION_LIST, null, HOUSEHOLD_A);
    const chipIds = chips.map((chip) => chip.id);

    expect(chipIds).toContain(MINE_POSTPARTUM.id);
    expect(chips.find((chip) => chip.id === MINE_POSTPARTUM.id)?.plainLabel).toBe("산후조리");
    expect(chipIds).not.toContain(THEIRS_HELPER.id);
    // 어느 칩의 matchIds로도 흡수되지 않는다 — 동명이 아니므로 흡수될 이유가 없다.
    expect(chips.flatMap((chip) => chip.matchIds)).not.toContain(THEIRS_HELPER.id);
  });

  it("칩이 사라진 그 분류의 **이름**은 같은 응답에서 계속 나온다(두 사실을 한 자리에서 함께 문다)", () => {
    const chipIds = buildRecordsCategoryChips(UNION_LIST, null, HOUSEHOLD_A).map((chip) => chip.id);
    const nameOf = buildCategoryNameLookup(UNION_LIST);

    expect(chipIds).not.toContain(THEIRS_HELPER.id);
    expect(nameOf(THEIRS_HELPER.id)).toBe("산후도우미");
    // 양쪽 끝: 칩 대장 자체가 비어 있지 않다(비면 8타일 폴백이 서고 위 부정 단언이 공짜로 참이 된다).
    expect(chipIds).toContain(SEED_DIAPER.id);
    expect(chipIds).toContain(MINE_POSTPARTUM.id);
  });

  it("가구를 모르면 종전 그대로 — 합집합의 커스텀이 둘 다 칩으로 선다", () => {
    const chipIds = buildRecordsCategoryChips(UNION_LIST, null).map((chip) => chip.id);

    expect(chipIds).toContain(MINE_POSTPARTUM.id);
    expect(chipIds).toContain(THEIRS_HELPER.id);
  });
});

describe("라운드 103 M-2 — 카테고리 예산 폼(buildCategoryBudgetForm)", () => {
  it("다른 가구 커스텀은 예산 행으로 서지 않는다 (그 행의 저장 400이 총액 예산까지 막았다)", () => {
    const form = buildCategoryBudgetForm({
      categories: UNION_LIST,
      draft: {},
      totalBudgetKrw: 500000,
      householdId: HOUSEHOLD_A
    });

    const rowIds = (form?.rows ?? []).map((row) => row.categoryId);
    // 양쪽 끝: 폼 자체가 null이거나 행이 0개면 아래 부정 단언이 공짜로 참이 된다.
    expect(form).not.toBeNull();
    expect(rowIds).toContain(SEED_DIAPER.id);
    expect(rowIds).toContain(MINE_POSTPARTUM.id);
    expect(rowIds).not.toContain(THEIRS_HELPER.id);
  });

  it("가구를 모르면 종전 그대로 행이 선다 — 이 축은 아는 순간에만 켜진다", () => {
    const form = buildCategoryBudgetForm({ categories: UNION_LIST, draft: {}, totalBudgetKrw: 500000 });

    expect((form?.rows ?? []).map((row) => row.categoryId)).toContain(THEIRS_HELPER.id);
  });

  it("이미 저장된 예산 행은 끼워 유지 규칙이 계속 살린다(§6.5) — 좁히기가 값 수정을 막지 않는다", () => {
    const form = buildCategoryBudgetForm({
      categories: UNION_LIST,
      draft: { [THEIRS_HELPER.id]: "30000" },
      totalBudgetKrw: 500000,
      householdId: HOUSEHOLD_A
    });

    const kept = (form?.rows ?? []).find((row) => row.categoryId === THEIRS_HELPER.id);
    // 행은 남고, 이름은 합집합 목록이 해석한 그 이름이다(끼워 유지의 nameOf는 좁히지 않는다).
    expect(kept?.name).toBe("산후도우미");
  });
});

describe("라운드 103 M-2 — 화면 배선(현재 가구를 넘기는 자리)", () => {
  it("지출 수정 화면은 이 지출이 속한 아이의 가구를 목록 필터에 넘긴다", () => {
    const screen = source("app/expenses/[expenseId].tsx");

    expect(screen).toContain("resolveExpenseHouseholdId({");
    expect(screen).toContain("selectableCategories(categories.data?.categories ?? [], categoryId, householdId)");
  });

  it("기록 탭은 보고 있는 아이의 가구를 칩 대장에 넘기고, 이름 해석에는 넘기지 않는다", () => {
    const screen = source("app/(tabs)/records.tsx");

    expect(screen).toContain("buildRecordsCategoryChips(serverCategories, selectedCategoryId, householdId)");
    // ⚠️ 짝 단언: 이름 해석은 합집합 전량이어야 한다(좁히면 과거 지출이 "기타"로 무너진다).
    expect(screen).toContain("buildCategoryNameLookup(serverCategories)");
    expect(screen).not.toContain("buildCategoryNameLookup(serverCategories,");
  });

  it("가져오기 검수는 **잡에 박힌 아이**(job.childId)의 가구로 칩 목록을 좁힌다", () => {
    const screen = source("app/import/[importJobId].tsx");

    // 기준이 선택 아이 스토어가 아니라 잡의 아이라는 사실을 문다 — 서버가 지출을 붙이는 곳이다.
    expect(screen).toContain("const importHouseholdId = resolveExpenseHouseholdId({");
    expect(screen).toContain("childId: job.data?.childId");
    expect(screen).toContain("selectableCategories(serverCategories ?? [], null, importHouseholdId)");
    // 이름 해석은 좁히지 않는다(스텁·별칭·타 가구 id의 라벨이 이 화면에서도 계속 풀려야 한다).
    expect(screen).toContain("importCategoryNameResolver(serverCategories)");
  });

  it("예산 화면은 이 아이의 가구를 카테고리 행 모집단에 넘긴다", () => {
    const screen = source("app/budget.tsx");

    expect(screen).toContain("const categoryHouseholdId = resolveExpenseHouseholdId({");
    expect(screen).toContain("householdId: categoryHouseholdId");
  });

  it("네 화면 모두 가구 판정을 **같은 함수 한 벌**에서 가져온다 (규칙 두 벌 금지)", () => {
    const screens = [
      "app/expenses/[expenseId].tsx",
      "app/(tabs)/records.tsx",
      "app/import/[importJobId].tsx",
      "app/budget.tsx"
    ];

    // 양쪽 끝: 목록이 비면 아래 for가 통째로 건너뛴다.
    expect(screens).toHaveLength(4);
    for (const path of screens) {
      const screen = source(path);
      expect(screen, `${path} 는 공용 가구 판정을 써야 한다`).toContain("resolveExpenseHouseholdId");
      // 새 판정을 화면에 다시 적지 않는다.
      expect(screen, `${path} 에 가구 판정 사본이 있다`).not.toContain("function resolveExpenseHouseholdId");
    }
  });

  it("소유자 축의 판정은 src/categories.ts 한 곳에만 있다 (화면·칩 모듈에 사본 0건)", () => {
    // 판정의 모양: 행의 householdId가 있고 현재 가구와 다른가.
    expect(source("src/categories.ts")).toContain("category.householdId !== scope");

    for (const path of [
      "src/expenses/records-list-view.ts",
      "src/expenses/category-budget-form.ts",
      "app/expenses/[expenseId].tsx",
      "app/(tabs)/records.tsx",
      "app/import/[importJobId].tsx",
      "app/budget.tsx"
    ]) {
      expect(source(path), `${path} 에 소유자 판정 사본이 있다`).not.toContain("category.householdId !==");
    }
  });
});
