import { describe, expect, it } from "vitest";
import { reconcileMonthlyExpenses } from "./expense-list-reconciliation";
import type { LocalExpenseRow } from "./types";

const childId = "child-1";

function offlineRow(overrides: Partial<LocalExpenseRow>): LocalExpenseRow {
  return {
    scopeKey: "test-scope",
    localId: "local-1",
    canonicalId: null,
    childId,
    payload: { childId, categoryId: "cat-1", amountKrw: 10_000, spentOn: "2026-07-05", itemName: "기저귀" },
    version: null,
    syncState: "pending",
    pendingDelete: false,
    conflictCurrent: null,
    lastError: null,
    failureKind: null,
    createdAt: "2026-07-05T00:00:00.000Z",
    updatedAt: "2026-07-05T00:00:00.000Z",
    ...overrides
  };
}

type ServerExpense = { id: string; amountKrw: number; expenseType: string };

function serverExpense(overrides: Partial<ServerExpense>): ServerExpense {
  return { id: "server-1", amountKrw: 10_000, expenseType: "expense", ...overrides };
}

describe("reconcileMonthlyExpenses (H-2 fix: no duplicate display / no double-summing)", () => {
  it("hides the stale server row for an unsynced edit and shows only the local pending row, with a total using the new amount once", () => {
    const server = [serverExpense({ id: "server-1", amountKrw: 10_000 })];
    const offline = [
      offlineRow({
        localId: "local-1",
        canonicalId: "server-1",
        syncState: "pending",
        payload: { childId, categoryId: "cat-1", amountKrw: 25_000, spentOn: "2026-07-05", itemName: "새 이름" }
      })
    ];

    const result = reconcileMonthlyExpenses(server, offline, "2026-07");

    expect(result.visibleServerExpenses).toHaveLength(0);
    expect(result.offlinePendingRows).toHaveLength(1);
    expect(result.offlinePendingRows[0].payload.amountKrw).toBe(25_000);
    // Not 10_000 (old) + 25_000 (new) = 35_000 -- exactly the new amount, once.
    expect(result.monthlyTotalKrw).toBe(25_000);
  });

  it("hides the stale server row for a pending delete and shows nothing in its place, excluding it from the total entirely", () => {
    const server = [serverExpense({ id: "server-1", amountKrw: 10_000 })];
    const offline = [
      offlineRow({
        localId: "local-1",
        canonicalId: "server-1",
        syncState: "pending",
        pendingDelete: true
      })
    ];

    const result = reconcileMonthlyExpenses(server, offline, "2026-07");

    expect(result.visibleServerExpenses).toHaveLength(0);
    expect(result.offlinePendingRows).toHaveLength(0);
    expect(result.monthlyTotalKrw).toBe(0);
  });

  it("keeps a genuinely new offline-only create (no canonicalId) additive alongside the untouched server list", () => {
    const server = [serverExpense({ id: "server-1", amountKrw: 10_000 })];
    const offline = [offlineRow({ localId: "local-new", canonicalId: null, syncState: "pending", payload: { ...offlineRow({}).payload, amountKrw: 5_000 } })];

    const result = reconcileMonthlyExpenses(server, offline, "2026-07");

    expect(result.visibleServerExpenses).toHaveLength(1);
    expect(result.offlinePendingRows).toHaveLength(1);
    expect(result.monthlyTotalKrw).toBe(15_000);
  });

  it("does not exclude a server row once the corresponding local row is fully 'synced'", () => {
    const server = [serverExpense({ id: "server-1", amountKrw: 10_000 })];
    const offline = [offlineRow({ localId: "local-1", canonicalId: "server-1", syncState: "synced" })];

    const result = reconcileMonthlyExpenses(server, offline, "2026-07");

    expect(result.visibleServerExpenses).toHaveLength(1);
    expect(result.offlinePendingRows).toHaveLength(0);
    expect(result.monthlyTotalKrw).toBe(10_000);
  });

  it("excludes the stale server row for a conflicted edit too (not just plain pending), showing only the local conflict row", () => {
    const server = [serverExpense({ id: "server-1", amountKrw: 10_000 })];
    const offline = [
      offlineRow({
        localId: "local-1",
        canonicalId: "server-1",
        syncState: "conflict",
        payload: { childId, categoryId: "cat-1", amountKrw: 25_000, spentOn: "2026-07-05", itemName: "내가 바꾼 이름" },
        conflictCurrent: {
          deleted: false,
          expense: { childId, categoryId: "cat-1", amountKrw: 12_000, spentOn: "2026-07-05", itemName: "다른기기", id: "server-1", version: 2 }
        }
      })
    ];

    const result = reconcileMonthlyExpenses(server, offline, "2026-07");

    // The stale server row (still showing the pre-conflict amount) is hidden -- the conflict
    // row itself is what the records screen renders (with a "확인 필요" affordance), not a
    // duplicate of the server's old value.
    expect(result.visibleServerExpenses).toHaveLength(0);
    expect(result.offlinePendingRows).toHaveLength(1);
    expect(result.offlinePendingRows[0].syncState).toBe("conflict");
    expect(result.monthlyTotalKrw).toBe(25_000);
  });

  it("excludes gifts from the total the same way the server's own aggregate does", () => {
    const server = [serverExpense({ id: "server-1", amountKrw: 10_000, expenseType: "gift" })];
    const offline = [offlineRow({ localId: "local-new", canonicalId: null, payload: { ...offlineRow({}).payload, amountKrw: 5_000, expenseType: "gift" } })];

    const result = reconcileMonthlyExpenses(server, offline, "2026-07");

    expect(result.monthlyTotalKrw).toBe(0);
  });
});
