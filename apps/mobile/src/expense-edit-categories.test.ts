import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { listCategories, LOCAL_SESSION_TOKEN } from "./api/client";
import * as localBackend from "./api/local-backend";
import { LOCAL_CATEGORY_IMPORT, LOCAL_CHILD_ID, localSeedExpenses } from "./api/local-fixtures";
import { buildCategoryNameLookup, categoryCatalog, selectableCategories } from "./categories";
import { createMemoryOfflineStore } from "./offline/memory-offline-store";
import { flushOutbox, recordLocalCreate, recordLocalUpdate, type RemoteExpenseApi } from "./offline/sync-engine";
import type { ExpensePayload } from "./offline/types";

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? "http://localhost:3000/api/v1";

const mobileRoot = process.cwd();
const source = (relativePath: string) => readFileSync(join(mobileRoot, relativePath), "utf8");

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

// ---------------------------------------------------------------------------
// CAT-101/UX-5B-EXP: local-backend demo category fixture behavior.
// ---------------------------------------------------------------------------

describe("local-backend listCategories (demo fixture categories)", () => {
  beforeEach(() => {
    localBackend.resetLocalBackendForTests();
    localBackend.seedLocalDemoFixturesForTests();
  });

  it("includes every category id the seeded demo expenses use, so edit-screen chip preselection matches them", () => {
    const categoryIds = new Set(localBackend.listCategories().categories.map((category) => category.id));
    for (const seed of localSeedExpenses) {
      expect(categoryIds.has(seed.categoryId), `seed category ${seed.categoryId} should be listed`).toBe(true);
    }
  });

  it("includes every category id an expense actually stored in the local backend can carry (seeded rows and excel-import rows alike)", () => {
    const job = localBackend.createExcelImport(LOCAL_CHILD_ID, "wooriai-import.csv");
    const rows = localBackend.listImportRows(job.id).rows;
    localBackend.confirmImport(
      job.id,
      rows.filter((row) => row.selected).map((row) => row.id)
    );

    const categoryIds = new Set(localBackend.listCategories().categories.map((category) => category.id));
    for (const expense of localBackend.listExpenses(LOCAL_CHILD_ID).expenses) {
      expect(categoryIds.has(expense.categoryId), `expense category ${expense.categoryId} should be listed`).toBe(true);
    }
    expect(categoryIds.has(LOCAL_CATEGORY_IMPORT)).toBe(true);
  });

  it("includes the quick-expense catalog ids (what app/expenses/new.tsx stores), so demo-created expenses also preselect", () => {
    const categoryIds = new Set(localBackend.listCategories().categories.map((category) => category.id));
    for (const entry of categoryCatalog) {
      expect(categoryIds.has(entry.id), `catalog category ${entry.id} should be listed`).toBe(true);
    }
  });

  it("mirrors the listCategoriesResponseSchema contract: active-only entries sorted by displayOrder ascending with the full field set", () => {
    const { categories } = localBackend.listCategories();
    expect(categories.length).toBeGreaterThan(0);

    for (const category of categories) {
      expect(typeof category.id).toBe("string");
      expect(category.code.length).toBeGreaterThan(0);
      expect(category.name.length).toBeGreaterThan(0);
      expect(typeof category.displayOrder).toBe("number");
      expect(category.isSystem).toBe(true);
      expect(category.active).toBe(true);
    }

    const orders = categories.map((category) => category.displayOrder);
    expect(orders).toEqual([...orders].sort((left, right) => left - right));

    // Ids must be unique -- duplicated ids would break chip keys and preselection.
    expect(new Set(categories.map((category) => category.id)).size).toBe(categories.length);
  });
});

// ---------------------------------------------------------------------------
// client.ts routing: local token -> local backend (no network), real token -> GET /categories.
// ---------------------------------------------------------------------------

describe("client.ts listCategories routing", () => {
  beforeEach(() => {
    localBackend.resetLocalBackendForTests();
    localBackend.seedLocalDemoFixturesForTests();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("serves a local test session from the local backend without touching the network", async () => {
    const fetchMock = vi.fn(async () => {
      throw new TypeError("Network request failed");
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await listCategories(LOCAL_SESSION_TOKEN);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.categories).toEqual(localBackend.listCategories().categories);
  });

  it("calls GET /categories with the bearer token for a real session", async () => {
    const serverCategories = [
      {
        id: "77777777-7777-4777-8777-777777777777",
        code: "diaper_hygiene",
        name: "기저귀/위생",
        iconName: null,
        displayOrder: 40,
        isSystem: true,
        active: true
      }
    ];
    const fetchMock = vi.fn(async () => jsonResponse(200, { categories: serverCategories }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await listCategories("real-access-token");

    expect(result.categories).toEqual(serverCategories);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(`${API_BASE_URL}/categories`);
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer real-access-token");
    expect(init.method ?? "GET").toBe("GET");
  });
});

// ---------------------------------------------------------------------------
// Edit screen wiring (source verification -- follows the src/offline/ui-wiring.test.ts
// convention; the screen isn't runtime-rendered because react-native has no binding in vitest).
// ---------------------------------------------------------------------------

describe("EXP-003 edit screen category/date wiring", () => {
  const detailSource = source("app/expenses/[expenseId].tsx");

  it("fetches the category chips from listCategories via react-query, with the static catalog as offline/preview fallback", () => {
    // FAM-127로 import가 여러 줄이 되면서 한 줄 통짜 비교를 그만뒀다 -- 고정하려는 것은
    // "이 화면이 client.ts에서 getExpense/listCategories를 가져다 쓴다"이지 줄바꿈 모양이 아니다.
    expect(detailSource).toContain('from "../../src/api/client"');
    expect(detailSource).toContain("getExpense");
    expect(detailSource).toContain("listCategories");
    expect(detailSource).toContain("LOCAL_SESSION_TOKEN");
    expect(detailSource).toContain('queryKey: ["categories"]');
    // CAT-124: 전량(includeAll=1)을 받아야 현재 지출이 노출 제외 별칭 id로 저장돼 있어도
    // 그 칩이 살아남는다(selectableCategories 규칙 d). 화면 목록 자체는 그 함수가 좁힌다.
    expect(detailSource).toContain("listCategories(authToken!, { includeAll: true })");
    // Fallback list so the chip row keeps working while the query is loading/failing (offline).
    expect(detailSource).toContain("categoryCatalog.map");
    // Unknown/legacy current category still gets a (preselected) chip.
    expect(detailSource).toContain("categoryNameFor(categoryId)");
  });

  it("routes the fetched category list through selectableCategories with the current selection (R20-B)", () => {
    expect(detailSource).toContain('selectableCategories } from "../../src/categories";');
    expect(detailSource).toContain("selectableCategories(categories.data?.categories ?? [], categoryId)");
  });

  it("preselects the expense's current category and sends the chosen categoryId + spentOn through the offline outbox update", () => {
    expect(detailSource).toContain("setCategoryId(expense.data.categoryId)");
    expect(detailSource).toContain("selected={chip.id === categoryId}");
    expect(detailSource).toContain("updateExpenseOffline(authToken, queryClient, localExpenseId,");
    expect(detailSource).toContain("spentOn: spentOnIso || undefined");
    expect(detailSource).toContain("categoryId: categoryId || undefined");
  });

  it("reuses the shared Seoul future-date validation for manually typed dates, same as the create screen", () => {
    const createSource = source("app/expenses/new.tsx");
    for (const screenSource of [detailSource, createSource]) {
      expect(screenSource).toContain("isFutureSeoulDate");
      expect(screenSource).toContain("validateExpenseDateInput");
      expect(screenSource).toContain('"존재하지 않는 날짜예요."');
    }
  });
});

// ---------------------------------------------------------------------------
// Outbox round-trip: spentOn/categoryId edited on EXP-003 must survive the offline outbox and
// reach the remote update call unchanged (no offline/** changes were needed -- this pins the
// existing passthrough so it stays that way).
// ---------------------------------------------------------------------------

describe("offline outbox passthrough of spentOn/categoryId", () => {
  it("delivers an updated spentOn and categoryId to the remote update call unchanged", async () => {
    const store = createMemoryOfflineStore();
    const updatePayloads: ExpensePayload[] = [];
    const remote: RemoteExpenseApi = {
      async createExpense() {
        return { id: "server-1", version: 1 };
      },
      async updateExpense(_canonicalId, payload, expectedVersion) {
        updatePayloads.push(payload);
        return { version: expectedVersion + 1 };
      },
      async deleteExpense() {
        throw new Error("not used");
      }
    };

    const row = await recordLocalCreate(store, {
      childId: "child-1",
      categoryId: "cat-before",
      amountKrw: 12_000,
      spentOn: "2026-07-01",
      itemName: "기저귀"
    });
    await flushOutbox(store, remote);

    await recordLocalUpdate(store, row.localId, { spentOn: "2026-06-15", categoryId: "cat-after" });
    const summary = await flushOutbox(store, remote);

    expect(summary.synced).toBe(1);
    expect(updatePayloads).toHaveLength(1);
    expect(updatePayloads[0].spentOn).toBe("2026-06-15");
    expect(updatePayloads[0].categoryId).toBe("cat-after");
    // Untouched fields ride along unchanged rather than being dropped by the patch merge.
    expect(updatePayloads[0].itemName).toBe("기저귀");
    expect(updatePayloads[0].amountKrw).toBe(12_000);

    const after = await store.getLocalExpense(row.localId);
    expect(after?.syncState).toBe("synced");
    expect(after?.payload.spentOn).toBe("2026-06-15");
    expect(after?.payload.categoryId).toBe("cat-after");
  });
});

// ---------------------------------------------------------------------------
// R20-B: selectableCategories -- display-only narrowing of the GET /categories list for the
// edit screen's chip row (import stub dropped, exact-name duplicates collapsed, current kept).
//
// The fixture rows below deliberately carry NO `selectable` field: they are what a pre-CAT-124
// server (or a react-query cache persisted before the upgrade) returns, so this whole block
// doubles as the backward-compatibility contract -- the narrowing must still land on 19 rows
// there. The CAT-124 block further down uses the same seed shape WITH the flag.
// ---------------------------------------------------------------------------

describe("selectableCategories", () => {
  type Row = { id: string; code: string; name: string; displayOrder: number };

  // Shape of the real seed (apps/api/prisma/seed-data.ts): 12 canonical + 8 mobile aliases + the
  // import stub, in displayOrder order -- exactly what GET /categories returns today.
  const serverRows: Row[] = [
    { id: "s-01", code: "pregnancy_mother", name: "임신/산모", displayOrder: 10 },
    { id: "s-02", code: "hospital_checkup", name: "병원/검사", displayOrder: 20 },
    { id: "s-03", code: "birth_postpartum", name: "출산/조리원", displayOrder: 30 },
    { id: "s-04", code: "diaper_hygiene", name: "기저귀/위생", displayOrder: 40 },
    { id: "s-05", code: "feeding_babyfood", name: "수유/이유식", displayOrder: 50 },
    { id: "s-06", code: "clothes_laundry", name: "의류/세탁", displayOrder: 60 },
    { id: "s-07", code: "sleep_furniture", name: "수면/가구", displayOrder: 70 },
    { id: "s-08", code: "outing_mobility", name: "외출/이동", displayOrder: 80 },
    { id: "s-09", code: "toys_books", name: "장난감/책", displayOrder: 90 },
    { id: "s-10", code: "care_education", name: "돌봄/교육", displayOrder: 100 },
    { id: "s-11", code: "insurance_savings", name: "보험/저축", displayOrder: 110 },
    { id: "s-12", code: "etc", name: "기타", displayOrder: 999 },
    { id: "m-01", code: "mobile_diaper_hygiene", name: "기저귀", displayOrder: 1001 },
    { id: "m-02", code: "mobile_feeding_dairy", name: "분유/유제품", displayOrder: 1002 },
    { id: "m-03", code: "mobile_feeding_meal", name: "식비", displayOrder: 1003 },
    { id: "m-04", code: "mobile_clothes_laundry", name: "의류", displayOrder: 1004 },
    { id: "m-05", code: "mobile_outing_mobility", name: "약품/교통", displayOrder: 1005 },
    { id: "m-06", code: "mobile_hospital_checkup", name: "병원/약", displayOrder: 1006 },
    { id: "m-07", code: "mobile_toys_books", name: "교육/도서", displayOrder: 1007 },
    { id: "m-08", code: "mobile_etc", name: "기타", displayOrder: 1008 },
    { id: "i-01", code: "import_stub_default", name: "가져오기 기본", displayOrder: 1009 }
  ];

  it("drops the excel-import stub row so '가져오기 기본' is never offered as a choice", () => {
    const result = selectableCategories(serverRows, "");
    expect(result.map((row) => row.code)).not.toContain("import_stub_default");
    expect(result.map((row) => row.name)).not.toContain("가져오기 기본");
  });

  it("collapses exact-name duplicates to one entry, keeping the canonical row over the mobile_ alias", () => {
    const result = selectableCategories(serverRows, "");
    const etcRows = result.filter((row) => row.name === "기타");
    expect(etcRows).toHaveLength(1);
    expect(etcRows[0].id).toBe("s-12");
    expect(etcRows[0].code).toBe("etc");
    // Every remaining display name is unique -- no chip label appears twice.
    const names = result.map((row) => row.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("preserves input order (displayOrder ascending) and keeps distinct-name rows untouched", () => {
    const result = selectableCategories(serverRows, "");
    expect(result.map((row) => row.displayOrder)).toEqual(
      [...result.map((row) => row.displayOrder)].sort((left, right) => left - right)
    );
    // Near-duplicate but differently named pairs are intentionally both kept (see the function's
    // doc comment): removing one would drop a category the 8-tile quick-input screen writes.
    expect(result.map((row) => row.name)).toEqual(expect.arrayContaining(["기저귀/위생", "기저귀"]));
    expect(result.map((row) => row.name)).toEqual(expect.arrayContaining(["수유/이유식", "분유/유제품"]));
    // Only the two rules above fired: 21 rows - 1 stub - 1 duplicate "기타" = 19.
    expect(result).toHaveLength(19);
  });

  it("always keeps the expense's current categoryId, even when it is the alias half of a name duplicate", () => {
    const result = selectableCategories(serverRows, "m-08");
    const etcRows = result.filter((row) => row.name === "기타");
    // The alias wins its own group so the chip stays selectable -- and still only one "기타".
    expect(etcRows).toHaveLength(1);
    expect(etcRows[0].id).toBe("m-08");
    expect(result.some((row) => row.id === "s-12")).toBe(false);
  });

  it("always keeps the expense's current categoryId, even when it is the import stub", () => {
    const result = selectableCategories(serverRows, "i-01");
    const stub = result.find((row) => row.id === "i-01");
    expect(stub?.name).toBe("가져오기 기본");
    // Nothing else changes: the stub is the only extra row over the no-selection case.
    expect(result).toHaveLength(selectableCategories(serverRows, "").length + 1);
  });

  it("keeps an unrelated current categoryId from changing which duplicate wins", () => {
    const result = selectableCategories(serverRows, "s-04");
    expect(result.filter((row) => row.name === "기타")[0].id).toBe("s-12");
    expect(result.some((row) => row.id === "s-04")).toBe(true);
  });

  it("returns an empty list for an empty/missing category list instead of inventing chips", () => {
    expect(selectableCategories([], "s-01")).toEqual([]);
    expect(selectableCategories(null, "s-01")).toEqual([]);
    expect(selectableCategories(undefined)).toEqual([]);
    // A current id that isn't in the list is NOT fabricated -- the screen prepends that chip
    // itself via categoryNameFor, which keeps this function purely a filter.
    expect(selectableCategories(serverRows, "not-in-list").some((row) => row.id === "not-in-list")).toBe(false);
  });

  it("skips malformed entries (missing id or blank name) rather than emitting an unlabeled chip", () => {
    const rows = [
      { id: "", code: "etc", name: "기타", displayOrder: 1 },
      { id: "ok", code: "etc", name: "  ", displayOrder: 2 },
      { id: "good", code: "diaper_hygiene", name: "기저귀/위생", displayOrder: 3 }
    ];
    expect(selectableCategories(rows, "").map((row) => row.id)).toEqual(["good"]);
  });

  it("also removes the demo-session duplicates the local backend produces (catalog + fixture rows)", () => {
    const rows = localBackend.listCategories().categories;
    const result = selectableCategories(rows, "");
    const names = result.map((row) => row.name);
    expect(new Set(names).size).toBe(names.length);
    expect(names).toContain("기저귀");
    expect(result.length).toBeLessThan(rows.length);
  });
});

// ---------------------------------------------------------------------------
// CAT-124: the server now says which rows are choices (`selectable`). Same seed shape as the
// R20-B block above, but as `GET /categories?includeAll=1` returns it after the migration.
// ---------------------------------------------------------------------------

describe("selectableCategories + CAT-124 selectable 플래그", () => {
  type Row = { id: string; code: string; name: string; displayOrder: number; selectable?: boolean };

  const canonical: Row[] = [
    { id: "s-01", code: "pregnancy_mother", name: "임신/산모", displayOrder: 10 },
    { id: "s-02", code: "hospital_checkup", name: "병원/검사", displayOrder: 20 },
    { id: "s-03", code: "birth_postpartum", name: "출산/조리원", displayOrder: 30 },
    { id: "s-04", code: "diaper_hygiene", name: "기저귀/위생", displayOrder: 40 },
    { id: "s-05", code: "feeding_babyfood", name: "수유/이유식", displayOrder: 50 },
    { id: "s-06", code: "clothes_laundry", name: "의류/세탁", displayOrder: 60 },
    { id: "s-07", code: "sleep_furniture", name: "수면/가구", displayOrder: 70 },
    { id: "s-08", code: "outing_mobility", name: "외출/이동", displayOrder: 80 },
    { id: "s-09", code: "toys_books", name: "장난감/책", displayOrder: 90 },
    { id: "s-10", code: "care_education", name: "돌봄/교육", displayOrder: 100 },
    { id: "s-11", code: "insurance_savings", name: "보험/저축", displayOrder: 110 },
    { id: "s-12", code: "etc", name: "기타", displayOrder: 999 }
  ].map((row) => ({ ...row, selectable: true }));

  const hidden: Row[] = [
    { id: "m-01", code: "mobile_diaper_hygiene", name: "기저귀", displayOrder: 1001 },
    { id: "m-02", code: "mobile_feeding_dairy", name: "분유/유제품", displayOrder: 1002 },
    { id: "m-03", code: "mobile_feeding_meal", name: "식비", displayOrder: 1003 },
    { id: "m-04", code: "mobile_clothes_laundry", name: "의류", displayOrder: 1004 },
    { id: "m-05", code: "mobile_outing_mobility", name: "약품/교통", displayOrder: 1005 },
    { id: "m-06", code: "mobile_hospital_checkup", name: "병원/약", displayOrder: 1006 },
    { id: "m-07", code: "mobile_toys_books", name: "교육/도서", displayOrder: 1007 },
    { id: "m-08", code: "mobile_etc", name: "기타", displayOrder: 1008 },
    { id: "i-01", code: "import_stub_default", name: "가져오기 기본", displayOrder: 1009 }
  ].map((row) => ({ ...row, selectable: false }));

  const allRows: Row[] = [...canonical, ...hidden];

  it("21행 전량을 받아도 선택 목록은 정식 12개다 (R20-B의 19개에서 좁혀짐)", () => {
    const result = selectableCategories(allRows, "");

    expect(result).toHaveLength(12);
    expect(result.map((row) => row.id)).toEqual(canonical.map((row) => row.id));
    // 이 티켓이 없애려던 "뜻은 같고 이름만 다른" 쌍이 더는 나란히 뜨지 않는다.
    const names = result.map((row) => row.name);
    expect(names).toContain("기저귀/위생");
    expect(names).not.toContain("기저귀");
    expect(names).toContain("수유/이유식");
    expect(names).not.toContain("분유/유제품");
    expect(names).not.toContain("가져오기 기본");
  });

  it("서버가 이미 좁혀 준 목록(기본 응답 12행)은 그대로 통과한다", () => {
    expect(selectableCategories(canonical, "")).toEqual(canonical);
  });

  it("현재 지출의 카테고리가 노출 제외 별칭이어도 칩으로 살아남는다 (빠른 기록 지출 수정 경로)", () => {
    const result = selectableCategories(allRows, "m-01");

    expect(result.find((row) => row.id === "m-01")?.name).toBe("기저귀");
    // 이름이 다르므로 정식 "기저귀/위생"도 그대로 남는다 = 12 + 1.
    expect(result).toHaveLength(13);
    expect(result.some((row) => row.id === "s-04")).toBe(true);
  });

  it("가져오기 스텁도 현재 선택이면 살아남는다", () => {
    const result = selectableCategories(allRows, "i-01");
    expect(result.find((row) => row.id === "i-01")?.name).toBe("가져오기 기본");
    expect(result).toHaveLength(13);
  });

  it("플래그가 없는 항목은 감추지 않는다 — 구 서버/구 캐시 응답 하위 호환", () => {
    const legacyRow: Row = { id: "legacy", code: "custom_thing", name: "예전 카테고리", displayOrder: 5 };
    const result = selectableCategories([legacyRow, ...allRows], "");

    expect(result.some((row) => row.id === "legacy")).toBe(true);
    expect(result).toHaveLength(13);
  });
});

// ---------------------------------------------------------------------------
// R28-F3: `active: false` (an operator switched the category off in the admin).
// `?includeAll=1` now returns those rows too, deliberately -- the picker must stop OFFERING them
// while `buildCategoryNameLookup` keeps resolving the NAME of expenses already recorded under
// them. Before F3 the server dropped the row from the full list as well, so those past expenses
// silently relabeled themselves "기타" -- a false display of what the user actually recorded.
// ---------------------------------------------------------------------------

describe("selectableCategories + R28-F3 active 플래그", () => {
  type Row = { id: string; code: string; name: string; displayOrder: number; selectable?: boolean; active?: boolean };

  const rows: Row[] = [
    { id: "s-04", code: "diaper_hygiene", name: "기저귀/위생", displayOrder: 40, selectable: true, active: true },
    { id: "s-11", code: "insurance_savings", name: "보험/저축", displayOrder: 110, selectable: true, active: false },
    { id: "s-12", code: "etc", name: "기타", displayOrder: 999, selectable: true, active: true }
  ];

  it("사용(active)이 꺼진 카테고리는 픽커에 나오지 않는다", () => {
    const result = selectableCategories(rows, "");
    expect(result.map((row) => row.id)).toEqual(["s-04", "s-12"]);
    expect(result.map((row) => row.name)).not.toContain("보험/저축");
  });

  it("그래도 이름 해석은 그대로다 — 그 카테고리로 기록된 과거 지출이 '기타'로 바뀌지 않는다", () => {
    const lookup = buildCategoryNameLookup(rows);
    expect(lookup("s-11")).toBe("보험/저축");
    expect(lookup("s-04")).toBe("기저귀/위생");
    // 목록에 아예 없는 id만 예전처럼 폴백한다.
    expect(lookup("unknown-id")).toBe("기타");
  });

  it("수정 중인 지출이 이미 그 카테고리면 칩은 남는다 (규칙 d — 선택을 조용히 잃지 않는다)", () => {
    const result = selectableCategories(rows, "s-11");
    expect(result.find((row) => row.id === "s-11")?.name).toBe("보험/저축");
    expect(result).toHaveLength(3);
  });

  it("active 필드가 없던 시절의 응답·캐시는 예전과 똑같이 동작한다 (없음 = 노출)", () => {
    const legacyRows: Row[] = [
      { id: "s-04", code: "diaper_hygiene", name: "기저귀/위생", displayOrder: 40 },
      { id: "s-11", code: "insurance_savings", name: "보험/저축", displayOrder: 110 }
    ];
    expect(selectableCategories(legacyRows, "").map((row) => row.id)).toEqual(["s-04", "s-11"]);
  });

  it("selectable=false 와 active=false 는 각각 독립적으로 제외 사유다", () => {
    const mixed: Row[] = [
      { id: "a", code: "etc", name: "A", displayOrder: 1, selectable: false, active: true },
      { id: "b", code: "etc", name: "B", displayOrder: 2, selectable: true, active: false },
      { id: "c", code: "etc", name: "C", displayOrder: 3, selectable: false, active: false },
      { id: "d", code: "etc", name: "D", displayOrder: 4, selectable: true, active: true }
    ];
    expect(selectableCategories(mixed, "").map((row) => row.id)).toEqual(["d"]);
  });
});
