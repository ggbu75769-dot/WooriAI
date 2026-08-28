import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { countsTowardMonthlyTotal, reconcileMonthlyExpenses } from "./expense-list-reconciliation";
import { offlineRecordRowSubtitle } from "../expenses/records-list-view";
import { SYNC_ROW_FAILED_LABEL, SYNC_ROW_PENDING_LABEL } from "./messages";
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

/**
 * CLN-131 재인라인 가드 — src/offline/messages.test.ts의 "인라인 재발 방지" 관례와 같은 형태.
 *
 * 데모/로컬 세션 백엔드(src/api/local-backend.ts)는 홈 총액·카테고리·누적·마일스톤 네 곳에서
 * 합계를 낸다. 그 술어가 기록 탭(여기)과 갈리면 같은 데모 세션 안에서 화면마다 다른 총액이
 * 나오므로, 인라인 `expenseType === "expense"`로 되돌아가는 변경을 소스 수준에서 막는다.
 */
describe("CLN-131 합산 술어 단일 소스 (재인라인 가드)", () => {
  const localBackendSource = readFileSync(join(process.cwd(), "src/api/local-backend.ts"), "utf8");

  it("데모 백엔드는 술어를 여기서 import한다", () => {
    expect(localBackendSource).toContain('import { countsTowardMonthlyTotal } from "../offline/expense-list-reconciliation"');
  });

  it("합계를 내는 네 곳이 모두 그 함수를 통과한다 -- 인라인 엄격 비교가 다시 나타나면 실패", () => {
    expect(localBackendSource.match(/countsTowardMonthlyTotal\(/g) ?? []).toHaveLength(4);
    expect(
      localBackendSource,
      "local-backend must not re-inline the DNC-015 predicate -- use countsTowardMonthlyTotal"
    ).not.toMatch(/expenseType === "expense"/);
  });
});

/**
 * GAP-054 라운드 54 P1-2 — **대기 중인 환불 행이 지출로 둔갑하지 않는다.**
 *
 * 무슨 일이 있었나: `adoptServerExpense`가 로컬 payload를 만들 때 `refund`를 `undefined`로
 * 접었다. 값이 없는 payload는 레거시 관례상 **일반 지출**이므로(`countsTowardMonthlyTotal`),
 * 환불 기록을 오프라인에서 한 글자만 고쳐도 그 순간 기록 탭 합계가 그 금액만큼 부풀고 행의
 * "환불 ·" 표시가 사라졌다. 서버 값은 멀쩡한데 화면만 거짓을 말하는 상태다(DNC-015).
 *
 * 이제 로컬은 사실대로 들고(offline/types.ts `LocalExpenseKind`), 서버 쓰기 계약은
 * **전송 직전**에만 지킨다(remote-api.ts `expenseTypeForWire` — remote-api.test.ts가 고정).
 */
describe("GAP-054 P1-2 대기 중인 환불·선물 행", () => {
  it("환불 서버 행을 오프라인에서 고쳐도 합계에 더해지지 않는다", () => {
    const server = [serverExpense({ id: "server-refund", amountKrw: 38_500, expenseType: "refund" })];
    // adoptServerExpense가 만들어 두는 모양(라운드 54 이후): 서버가 말한 구분 그대로.
    const offline = [
      offlineRow({
        localId: "local-refund",
        canonicalId: "server-refund",
        syncState: "pending",
        payload: {
          ...offlineRow({}).payload,
          amountKrw: 38_500,
          itemName: "유모차 환불",
          expenseType: "refund"
        }
      })
    ];

    const result = reconcileMonthlyExpenses(server, offline, "2026-07");

    // 낡은 서버 행은 숨고 로컬 대기 행만 보이며, 합계에는 어느 쪽도 더해지지 않는다.
    expect(result.visibleServerExpenses).toHaveLength(0);
    expect(result.offlinePendingRows).toHaveLength(1);
    expect(result.offlinePendingRows[0].payload.expenseType).toBe("refund");
    expect(result.monthlyTotalKrw).toBe(0);
  });

  it("선물 행도 같다 — 대기 중이라고 합계에 섞이지 않는다", () => {
    const server = [serverExpense({ id: "server-gift", amountKrw: 50_000, expenseType: "gift" })];
    const offline = [
      offlineRow({
        localId: "local-gift",
        canonicalId: "server-gift",
        syncState: "pending",
        payload: { ...offlineRow({}).payload, amountKrw: 50_000, expenseType: "gift" }
      })
    ];

    const result = reconcileMonthlyExpenses(server, offline, "2026-07");

    expect(result.offlinePendingRows[0].payload.expenseType).toBe("gift");
    expect(result.monthlyTotalKrw).toBe(0);
  });

  it("일반 지출 대기 행은 종전 그대로 합계에 든다 (이 수정이 다른 행을 건드리지 않는다)", () => {
    const offline = [
      offlineRow({
        localId: "local-expense",
        canonicalId: null,
        payload: { ...offlineRow({}).payload, amountKrw: 7_000, expenseType: "expense" }
      })
    ];

    expect(reconcileMonthlyExpenses([], offline, "2026-07").monthlyTotalKrw).toBe(7_000);
  });

  it("대기 행 부제가 구분을 앞세운다 — 동기화 상태에 따라 '환불 ·'이 사라지지 않는다", () => {
    const statusLabel = `${SYNC_ROW_PENDING_LABEL} · 7월 5일`;
    expect(offlineRecordRowSubtitle({ statusLabel, expenseType: "refund" })).toBe(`환불 · ${statusLabel}`);
    expect(offlineRecordRowSubtitle({ statusLabel, expenseType: "gift" })).toBe(`선물 · ${statusLabel}`);
    // 기본값 "지출"에는 아무것도 붙지 않는다(서버 행과 같은 규칙) -- 기존 행은 한 글자도 안 바뀐다.
    for (const plain of ["expense", undefined, null, "reimbursement"]) {
      expect(offlineRecordRowSubtitle({ statusLabel, expenseType: plain }), String(plain)).toBe(statusLabel);
    }
    // 실패·충돌·삭제 대기 줄에도 같은 규칙이 적용된다.
    expect(offlineRecordRowSubtitle({ statusLabel: SYNC_ROW_FAILED_LABEL, expenseType: "refund" })).toBe(
      `환불 · ${SYNC_ROW_FAILED_LABEL}`
    );
  });

  it("기록 탭이 그 순수 모듈을 실제로 쓴다 (문자열 재인라인 금지)", () => {
    const recordsSource = readFileSync(join(process.cwd(), "app/(tabs)/records.tsx"), "utf8");
    expect(recordsSource).toContain("subtitle={offlineRecordRowSubtitle({");
    // adopt 경로가 다시 refund를 접으면 합계가 조용히 오염된다.
    const controllerSource = readFileSync(join(process.cwd(), "src/offline/sync-controller.ts"), "utf8");
    expect(controllerSource).not.toContain('expense.expenseType === "refund" ? undefined');
  });
});

/**
 * 라운드 59 트랙 A — **보낼 수 없는 행은 합계에서 빼지 않고, 건수로 말한다.**
 *
 * 네 자리 중 이 자리만 "제외"가 아니라 "유지 + 고지"인 이유는 모듈 주석(`permanentlyFailedCount`)
 * 참고: 그 행은 바로 위 목록에 그대로 보이므로, 합계에서만 빠지면 목록의 금액을 다 더해도 총액이
 * 나오지 않는 화면이 된다(사용자가 그 자리에서 반박할 수 있는 거짓).
 */
describe("라운드 59 트랙 A: 영구 실패 행 — 합계 유지 + 건수 노출", () => {
  const permanentlyFailed = (overrides: Partial<LocalExpenseRow> = {}) =>
    offlineRow({
      localId: "local-failed",
      syncState: "failed",
      lastError: "미래 날짜의 지출은 저장할 수 없어요.",
      lastErrorStatus: 400,
      lastErrorCode: "EXPENSE_FUTURE_DATE",
      ...overrides
    });

  it("영구 실패 행의 금액은 월 합계에 그대로 남는다 (목록-합계 모순 금지)", () => {
    const result = reconcileMonthlyExpenses(
      [serverExpense({ id: "server-1", amountKrw: 30_000 })],
      [permanentlyFailed({ payload: { childId, categoryId: "cat-1", amountKrw: 12_000, spentOn: "2026-07-05", itemName: "기저귀" } })],
      "2026-07"
    );

    // 목록에도 남고 --
    expect(result.offlinePendingRows).toHaveLength(1);
    // -- 합계에도 남는다.
    expect(result.monthlyTotalKrw).toBe(42_000);
    // 목록에 보이는 금액의 총합 = 화면의 총액. 이 등식이 이 자리의 계약이다.
    const listedSum =
      result.visibleServerExpenses.reduce((sum, expense) => sum + expense.amountKrw, 0) +
      result.offlinePendingRows.reduce((sum, row) => sum + row.payload.amountKrw, 0);
    expect(listedSum).toBe(result.monthlyTotalKrw);
    // 대신 화면이 한 줄을 덧붙일 수 있도록 건수를 내놓는다.
    expect(result.permanentlyFailedCount).toBe(1);
  });

  it("일시 실패·대기·충돌 행은 세지 않는다 (그것들은 언젠가 반영된다)", () => {
    const result = reconcileMonthlyExpenses(
      [],
      [
        permanentlyFailed({ localId: "local-1" }),
        permanentlyFailed({ localId: "local-2", lastErrorStatus: 503 }), // 5xx = 일시 실패
        offlineRow({ localId: "local-3", syncState: "pending" }),
        offlineRow({ localId: "local-4", syncState: "syncing" }),
        offlineRow({ localId: "local-5", syncState: "conflict" }),
        // v2 이전 레거시 실패 행(status 없음) -- 확신이 없으므로 "보낼 수 없다"고 세지 않는다.
        offlineRow({ localId: "local-6", syncState: "failed", lastError: "권한이 없어요." })
      ],
      "2026-07"
    );

    expect(result.offlinePendingRows).toHaveLength(6);
    expect(result.permanentlyFailedCount).toBe(1);
  });

  it("목록에 없는 행은 세지 않는다 (고지가 가리키는 것은 '이 중'이다)", () => {
    // 삭제 대기 행은 목록에서 빠지므로(그 행에는 보여 줄 것이 없다) 건수에서도 빠진다.
    const deletePending = permanentlyFailed({ localId: "local-del", pendingDelete: true });
    // 다른 달 행도 마찬가지다.
    const otherMonth = permanentlyFailed({
      localId: "local-old",
      payload: { childId, categoryId: "cat-1", amountKrw: 5_000, spentOn: "2026-06-30", itemName: "기저귀" }
    });

    const result = reconcileMonthlyExpenses([], [deletePending, otherMonth], "2026-07");
    expect(result.offlinePendingRows).toHaveLength(0);
    expect(result.permanentlyFailedCount).toBe(0);
  });

  it("영구 실패 행이 없으면 0이다 (평소 화면은 한 줄도 늘지 않는다)", () => {
    const result = reconcileMonthlyExpenses([serverExpense({})], [offlineRow({})], "2026-07");
    expect(result.permanentlyFailedCount).toBe(0);
  });

  it("판정 규칙을 여기 다시 적지 않는다 (술어는 permission-denied.ts 한 곳)", () => {
    const moduleSource = readFileSync(join(process.cwd(), "src/offline/expense-list-reconciliation.ts"), "utf8");
    expect(moduleSource).toContain('import { countPermanentlyFailedRows } from "./permission-denied";');
    expect(moduleSource).not.toMatch(/lastErrorStatus/);
  });

  /**
   * 후속 배선 — 건수를 내놓기만 하고 **아무도 읽지 않으면** 이 트랙은 화면에서 없던 일이 된다.
   * 기록 탭이 그 값을 실제로 받아 요약 줄 아래 한 줄로 말하는지를 여기서 고정한다(값 계약은 위
   * 네 테스트가 이미 진다).
   */
  it("기록 탭이 그 건수를 받아 요약 줄 아래 한 줄로 말한다 (문구는 messages.ts 한 곳)", () => {
    const recordsSource = readFileSync(join(process.cwd(), "app/(tabs)/records.tsx"), "utf8");
    // 재조정 결과에서 건수를 실제로 꺼낸다.
    expect(recordsSource).toContain("permanentlyFailedCount");
    expect(recordsSource).toContain("unsendableRowsNoticeText(permanentlyFailedCount)");
    expect(recordsSource).toContain('testID="records-unsendable-notice"');
    // 0건이면 한 줄도 늘지 않고, 목록을 그리지 않는 상태에서는 "이 중"이 가리킬 것이 없다.
    expect(recordsSource).toContain("{showList && permanentlyFailedCount > 0 ? (");
    // 문구도 판정도 화면에 다시 적지 않는다(어휘는 messages.ts, 판정은 permission-denied.ts).
    expect(recordsSource).toContain("unsendableRowsNoticeText");
    expect(recordsSource).not.toContain("보낼 수 없는 기록");
    expect(recordsSource).not.toMatch(/lastErrorStatus/);
  });
});
