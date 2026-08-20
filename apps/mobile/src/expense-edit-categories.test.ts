import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { listCategories, LOCAL_SESSION_TOKEN } from "./api/client";
import * as localBackend from "./api/local-backend";
import { LOCAL_CATEGORY_IMPORT, LOCAL_CHILD_ID, localSeedExpenses } from "./api/local-fixtures";
import { categoryCatalog } from "./categories";
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
    expect(detailSource).toContain('import { getExpense, listCategories, LOCAL_SESSION_TOKEN } from "../../src/api/client";');
    expect(detailSource).toContain('queryKey: ["categories"]');
    expect(detailSource).toContain("listCategories(authToken!)");
    // Fallback list so the chip row keeps working while the query is loading/failing (offline).
    expect(detailSource).toContain("categoryCatalog.map");
    // Unknown/legacy current category still gets a (preselected) chip.
    expect(detailSource).toContain("categoryNameFor(categoryId)");
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
