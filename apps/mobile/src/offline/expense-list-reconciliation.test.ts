import { describe, expect, it } from "vitest";
import { countsTowardMonthlyTotal, reconcileMonthlyExpenses } from "./expense-list-reconciliation";
import type { LocalExpenseRow } from "./types";

const childId = "child-1";

function offlineRow(overrides: Partial<LocalExpenseRow>): LocalExpenseRow {
  return {
    localId: "local-1",
    canonicalId: null,
    childId,
    payload: { childId, categoryId: "cat-1", amountKrw: 10_000, spentOn: "2026-07-05", itemName: "기저귀" },
    version: null,
    syncState: "pending",
    pendingDelete: false,
    conflictCurrent: null,
    lastError: null,
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

  it("hides the stale server row for a (still uncontested) pending delete and shows nothing in its place, excluding it from the total entirely", () => {
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

  it("keeps a CONTESTED delete (syncState 'conflict' + pendingDelete) visible as a conflict row, counted by its local payload amount like every other conflict row", () => {
    // COV-T5 bug 3 fix: unlike a merely-queued pending delete (test above), a delete the
    // server answered 409 to concerns an expense that is still live server-side. Hiding both
    // the stale server row AND the local row made the contested expense vanish from the list
    // and the monthly total. It now surfaces exactly like a non-delete conflict row.
    const server = [serverExpense({ id: "server-1", amountKrw: 55_000 })];
    const offline = [
      offlineRow({
        localId: "local-1",
        canonicalId: "server-1",
        syncState: "conflict",
        pendingDelete: true,
        conflictCurrent: {
          deleted: false,
          expense: { childId, categoryId: "cat-1", amountKrw: 55_000, spentOn: "2026-07-05", itemName: "다른기기", id: "server-1", version: 7 }
        }
      })
    ];

    const result = reconcileMonthlyExpenses(server, offline, "2026-07");

    // Shown exactly once: the stale server row is hidden, the conflict row renders in its
    // place (records.tsx gives it the ⚠ conflict icon and "삭제 대기 중" subtitle).
    expect(result.visibleServerExpenses).toHaveLength(0);
    expect(result.offlinePendingRows).toHaveLength(1);
    expect(result.offlinePendingRows[0].syncState).toBe("conflict");
    expect(result.offlinePendingRows[0].pendingDelete).toBe(true);
    // Counted from the local payload (10_000), consistent with the non-delete conflict case.
    expect(result.monthlyTotalKrw).toBe(10_000);
  });

  it("excludes gifts from the total the same way the server's own aggregate does", () => {
    const server = [serverExpense({ id: "server-1", amountKrw: 10_000, expenseType: "gift" })];
    const offline = [offlineRow({ localId: "local-new", canonicalId: null, payload: { ...offlineRow({}).payload, amountKrw: 5_000, expenseType: "gift" } })];

    const result = reconcileMonthlyExpenses(server, offline, "2026-07");

    expect(result.monthlyTotalKrw).toBe(0);
  });

  // REC-121b: 서버 sumExpenses(expenseType === "expense")와 같은 술어를 쓴다 — 환불도 제외.
  it("excludes refunds from the total too, matching the server's `expenseType === 'expense'` aggregate", () => {
    const server = [serverExpense({ id: "server-1", amountKrw: 10_000, expenseType: "refund" })];

    const result = reconcileMonthlyExpenses(server, [], "2026-07");

    // 종전에는 `!== "gift"`로만 걸러 환불이 지출처럼 더해졌다(합계 10_000) -- 홈/리포트는
    // 같은 달에 0을 보여주므로 두 숫자가 어긋났다.
    expect(result.monthlyTotalKrw).toBe(0);
    // 행 자체는 목록에 그대로 남는다(기록 탭은 환불도 "환불 ·" 부제로 보여준다) -- 합계 규칙만 바뀐다.
    expect(result.visibleServerExpenses).toHaveLength(1);
  });

  it("sums only the real expenses in a month mixing expense + gift + refund rows (server and offline)", () => {
    const server = [
      serverExpense({ id: "server-expense", amountKrw: 30_000, expenseType: "expense" }),
      serverExpense({ id: "server-gift", amountKrw: 50_000, expenseType: "gift" }),
      serverExpense({ id: "server-refund", amountKrw: 12_000, expenseType: "refund" })
    ];
    const offline = [
      offlineRow({
        localId: "local-expense",
        canonicalId: null,
        payload: { ...offlineRow({}).payload, amountKrw: 7_000, expenseType: "expense" }
      }),
      offlineRow({
        localId: "local-gift",
        canonicalId: null,
        payload: { ...offlineRow({}).payload, amountKrw: 9_000, expenseType: "gift" }
      })
    ];

    const result = reconcileMonthlyExpenses(server, offline, "2026-07");

    // 30_000 + 7_000 -- 선물(50_000/9_000)도 환불(12_000)도 더하지 않는다.
    expect(result.monthlyTotalKrw).toBe(37_000);
    // 목록은 여전히 전부 보여준다: 제외는 합계 규칙일 뿐 표시 규칙이 아니다.
    expect(result.visibleServerExpenses).toHaveLength(3);
    expect(result.offlinePendingRows).toHaveLength(2);
  });

  it("counts a legacy offline row with no expenseType field as a plain expense (recent-items.ts 관례)", () => {
    // 오프라인 페이로드의 expenseType은 선택 필드다(offline/types.ts) -- 필드가 도입되기 전에
    // 저장된 행이 합계에서 통째로 빠지면 안 된다.
    const offline = [offlineRow({ localId: "local-legacy", canonicalId: null, payload: { ...offlineRow({}).payload, amountKrw: 8_000 } })];

    const result = reconcileMonthlyExpenses([], offline, "2026-07");

    expect(result.offlinePendingRows[0].payload.expenseType).toBeUndefined();
    expect(result.monthlyTotalKrw).toBe(8_000);
  });

  it("재조정은 넘긴 yearMonth의 로컬 대기 행만 집는다 (지난달 재조정을 같은 함수로 할 수 있어야 한다)", () => {
    // F3: 기록 탭이 지난달 목록에도 이 함수를 그대로 걸 수 있는지 -- 월 파라미터가 로컬 행
    // 선택에 실제로 반영되는지 고정한다.
    const offline = [
      offlineRow({ localId: "local-jul", canonicalId: null, payload: { ...offlineRow({}).payload, amountKrw: 3_000, spentOn: "2026-07-09" } }),
      offlineRow({ localId: "local-aug", canonicalId: null, payload: { ...offlineRow({}).payload, amountKrw: 4_000, spentOn: "2026-08-02" } })
    ];

    const july = reconcileMonthlyExpenses([], offline, "2026-07");
    const august = reconcileMonthlyExpenses([], offline, "2026-08");

    expect(july.offlinePendingRows.map((row) => row.localId)).toEqual(["local-jul"]);
    expect(july.monthlyTotalKrw).toBe(3_000);
    expect(august.offlinePendingRows.map((row) => row.localId)).toEqual(["local-aug"]);
    expect(august.monthlyTotalKrw).toBe(4_000);
  });
});

/**
 * 정밀 리뷰 F3(부수): 이 술어는 이제 src/home/last-month-comparison.ts의
 * sumMonthExpensesThroughDay도 import해서 쓰는 **단일 소스**다. 기록 탭 델타의 두 항이 같은
 * 규칙으로 나오도록 하는 것이 목적이라 규칙 자체를 여기서 못 박는다.
 */
describe("countsTowardMonthlyTotal (월 합계 화이트리스트, DNC-015)", () => {
  it("일반 지출만 센다 -- 선물·환불 제외", () => {
    expect(countsTowardMonthlyTotal("expense")).toBe(true);
    expect(countsTowardMonthlyTotal("gift")).toBe(false);
    expect(countsTowardMonthlyTotal("refund")).toBe(false);
  });

  it("서버가 새 expenseType을 추가해도 자동으로 지출로 세지 않는다 (블랙리스트가 아니라 화이트리스트)", () => {
    expect(countsTowardMonthlyTotal("reimbursement")).toBe(false);
  });

  it("필드가 없는 레거시 로컬 페이로드는 지출로 간주한다 (합계에서 통째로 빠지면 안 된다)", () => {
    expect(countsTowardMonthlyTotal(undefined)).toBe(true);
    expect(countsTowardMonthlyTotal(null)).toBe(true);
  });
});
