import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { LOCAL_CATEGORY_DETERGENT } from "./api/local-fixtures";
import { buildCategoryNameLookup, categoryCatalog, categoryNameFor } from "./categories";

const mobileRoot = process.cwd();
const source = (relativePath: string) => readFileSync(join(mobileRoot, relativePath), "utf8");

// A canonical seed category as the real server returns it: apps/api/prisma/seed-data.ts's
// `categorySeeds` are seeded WITHOUT fixed ids, so every database assigns its own UUID -- which is
// exactly why the static 8-tile mapping could not name them.
const serverSeedCategories = [
  { id: "0f3d0f1a-1f2b-4c3d-8e4f-000000000001", name: "임신/산모" },
  { id: "0f3d0f1a-1f2b-4c3d-8e4f-000000000002", name: "수유/이유식" },
  { id: "0f3d0f1a-1f2b-4c3d-8e4f-000000000003", name: "보험/저축" }
];

describe("buildCategoryNameLookup (server GET /categories -> 카테고리 이름)", () => {
  it("names the canonical seed categories the static tile mapping could only call 기타", () => {
    const lookup = buildCategoryNameLookup(serverSeedCategories);

    for (const category of serverSeedCategories) {
      expect(categoryNameFor(category.id)).toBe("기타"); // the bug being fixed
      expect(lookup(category.id)).toBe(category.name);
    }
  });

  it("falls back to the static catalog / demo fixture mapping for ids the server list omits", () => {
    const lookup = buildCategoryNameLookup(serverSeedCategories);

    // 8 quick-expense tiles (offline-created expenses carry these ids).
    expect(lookup(categoryCatalog[0].id)).toBe("기저귀");
    // Demo (local test session) fixture ids.
    expect(lookup(LOCAL_CATEGORY_DETERGENT)).toBe("유아용 세제");
    // Unknown/legacy id: still the safe "기타" label, never a raw id leaking into the UI/CSV.
    expect(lookup("00000000-dead-4bee-8fff-000000000000")).toBe("기타");
  });

  it("keeps working with no list at all (first launch / offline / failed query)", () => {
    for (const empty of [undefined, null, []] as const) {
      const lookup = buildCategoryNameLookup(empty);
      expect(lookup(categoryCatalog[1].id)).toBe(categoryCatalog[1].label);
      expect(lookup(serverSeedCategories[0].id)).toBe("기타");
    }
  });

  it("ignores blank names and later duplicates instead of rendering an empty category cell", () => {
    const lookup = buildCategoryNameLookup([
      { id: "dup", name: "먼저" },
      { id: "dup", name: "나중" },
      { id: "blank", name: "   " }
    ]);

    expect(lookup("dup")).toBe("나중"); // last write wins -- deterministic, documented
    expect(lookup("blank")).toBe("기타");
  });

  /**
   * CAT-124: 노출 제외(selectable=false) 행은 "고르라고 내밀지" 않을 뿐 이름은 계속 필요하다.
   * 그래서 앱은 이름 해석용으로 `?includeAll=1` 전량을 받는다 — 이 테스트는 그 전량 목록이
   * 실제로 별칭 라벨을 지켜 준다는 것과, 기본 목록만 받았을 때 무엇이 무너지는지를 함께 고정한다.
   */
  it("CAT-124: 전량 목록은 노출 제외 별칭·스텁 라벨을 그대로 해석한다", () => {
    const aliasId = categoryCatalog[0].id; // 퀵타일 "기저귀" = 서버 mobile_diaper_hygiene 별칭
    const importStubId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const includeAllList = [
      ...serverSeedCategories,
      { id: aliasId, name: "기저귀" },
      { id: importStubId, name: "가져오기 기본" }
    ];

    const lookup = buildCategoryNameLookup(includeAllList);
    expect(lookup(aliasId)).toBe("기저귀");
    expect(lookup(importStubId)).toBe("가져오기 기본");

    // 기본(노출 대상만) 목록이었다면 가져오기 스텁 라벨이 "기타"로 무너진다.
    // (별칭 8개는 정적 카탈로그 폴백이 우연히 받아 주지만, 스텁은 폴백에도 없다.)
    const selectableOnly = buildCategoryNameLookup(serverSeedCategories);
    expect(selectableOnly(aliasId)).toBe("기저귀"); // categoryNameFor 폴백
    expect(selectableOnly(importStubId)).toBe("기타"); // 무너지는 지점
  });
});

// ---------------------------------------------------------------------------
// Screen wiring (source verification -- follows the export-flow.test.ts / offline
// ui-wiring.test.ts convention; the screens aren't runtime-rendered because react-native has no
// native binding under vitest).
// ---------------------------------------------------------------------------

describe("리포트 카테고리 비중 라벨 wiring", () => {
  const reportSource = source("app/(tabs)/reports.tsx");

  it("resolves the category report's ids through the shared ['categories'] query", () => {
    expect(reportSource).toContain('import { buildCategoryNameLookup } from "../../src/categories";');
    expect(reportSource).toContain('queryKey: ["categories"]');
    // CAT-124: 기본 목록은 노출 대상 12개뿐이라 별칭 id로 저장된 지출의 범례 라벨이
    // "기타"로 무너진다. 이름 해석 경로는 반드시 전량(includeAll=1)을 받아야 한다.
    expect(reportSource).toContain("listCategories(authToken!, { includeAll: true })");
    expect(reportSource).toContain("const categoryName = buildCategoryNameLookup(categories.data?.categories);");
    expect(reportSource).toContain("label: categoryName(entry.categoryId)");
    // The donut legend must no longer read from the static 8-tile mapping directly.
    expect(reportSource).not.toContain("categoryNameFor(entry.categoryId)");
  });
});
