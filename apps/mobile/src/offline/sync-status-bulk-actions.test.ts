import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createMemoryOfflineStore } from "./memory-offline-store";
import {
  syncStatusDiscardAllConfirmMessage,
  syncStatusDiscardFailedExpensesLabel,
  syncStatusRetryFailedExpensesLabel,
  SYNC_STATUS_DISCARD_ALL_CONFIRM_TITLE,
  SYNC_STATUS_DISCARD_ALL_LABEL,
  SYNC_STATUS_DISCARD_LABEL,
  SYNC_STATUS_RETRY_ALL_LABEL,
  SYNC_STATUS_RETRY_LABEL
} from "./messages";
import {
  discardAllFailedMutations,
  MAX_SERVER_ERROR_ATTEMPTS,
  recordLocalCreate,
  retryAllFailedMutations
} from "./sync-engine";
import type { ExpensePayload, OfflineStore } from "./types";

/**
 * SYNC-127 — the sync-status screen used to render every pending/failed/conflict row eagerly via
 * `.map()`, and offered only per-row 재시도/삭제: 100 failed rows meant 100 mounted cards and 100
 * separate presses (each triggering its own flush pass). This covers the two halves of the fix —
 * the bulk engine operations (runtime, against the memory store) and the screen's virtualization +
 * wiring (source verification, following records-list-virtualization.test.ts's convention, since
 * react-native has no native binding under vitest).
 */

const mobileRoot = process.cwd();
const source = (relativePath: string) => readFileSync(join(mobileRoot, relativePath), "utf8");

const payload: ExpensePayload = {
  childId: "child-1",
  categoryId: "cat-diaper",
  amountKrw: 10_000,
  spentOn: "2026-07-01",
  itemName: "기저귀"
};

/** Seeds one row already parked in 'failed' with a burnt retry budget -- the exact shape
 * flushOutboxPass leaves behind once MAX_SERVER_ERROR_ATTEMPTS is reached. */
async function seedFailedRow(store: OfflineStore, itemName: string): Promise<string> {
  const row = await recordLocalCreate(store, { ...payload, itemName });
  await store.updateLocalExpense(row.localId, { syncState: "failed", lastError: "서버 오류" });
  for (const mutation of await store.listOutboxMutationsForLocalId(row.localId)) {
    await store.updateOutboxMutation(mutation.mutationId, {
      attemptCount: MAX_SERVER_ERROR_ATTEMPTS,
      nextRetryAt: null,
      lastError: "서버 오류"
    });
  }
  return row.localId;
}

describe("SYNC-127 retryAllFailedMutations", () => {
  it("requeues every failed row and restores each row's retry budget, exactly as pressing 재시도 on each would", async () => {
    const store = createMemoryOfflineStore();
    await seedFailedRow(store, "기저귀");
    await seedFailedRow(store, "물티슈");
    await seedFailedRow(store, "분유");

    const count = await retryAllFailedMutations(store);

    expect(count).toBe(3);
    const rows = await store.listLocalExpenses();
    expect(rows.every((row) => row.syncState === "pending")).toBe(true);
    expect(rows.every((row) => row.lastError === null)).toBe(true);
    const mutations = await store.listOutboxMutations();
    expect(mutations).toHaveLength(3);
    expect(mutations.every((mutation) => mutation.attemptCount === 0)).toBe(true);
    expect(mutations.every((mutation) => mutation.nextRetryAt === null)).toBe(true);
    expect(mutations.every((mutation) => mutation.lastError === null)).toBe(true);
  });

  it("leaves pending, syncing, synced and conflict rows alone", async () => {
    const store = createMemoryOfflineStore();
    const failedId = await seedFailedRow(store, "기저귀");
    const pending = await recordLocalCreate(store, { ...payload, itemName: "대기중" });
    const conflict = await recordLocalCreate(store, { ...payload, itemName: "충돌" });
    await store.updateLocalExpense(conflict.localId, {
      syncState: "conflict",
      conflictCurrent: { deleted: false, expense: { ...payload, itemName: "다른 기기", id: "server-1", version: 4 } }
    });

    const count = await retryAllFailedMutations(store);

    expect(count).toBe(1);
    expect((await store.getLocalExpense(failedId))?.syncState).toBe("pending");
    expect((await store.getLocalExpense(pending.localId))?.syncState).toBe("pending");
    // A conflict has three meaningfully different resolutions (D-10) -- there is no honest bulk
    // answer, so 전체 재시도 must not silently pick one.
    expect((await store.getLocalExpense(conflict.localId))?.syncState).toBe("conflict");
  });

  it("is a no-op that reports 0 when nothing has failed", async () => {
    const store = createMemoryOfflineStore();
    await recordLocalCreate(store, payload);

    expect(await retryAllFailedMutations(store)).toBe(0);
    expect((await store.listLocalExpenses())[0].syncState).toBe("pending");
  });
});

describe("SYNC-127 discardAllFailedMutations", () => {
  it("drops every failed row and its queued mutations, and nothing else", async () => {
    const store = createMemoryOfflineStore();
    await seedFailedRow(store, "기저귀");
    await seedFailedRow(store, "물티슈");
    const survivor = await recordLocalCreate(store, { ...payload, itemName: "대기중" });

    const count = await discardAllFailedMutations(store);

    expect(count).toBe(2);
    const rows = await store.listLocalExpenses();
    expect(rows.map((row) => row.localId)).toEqual([survivor.localId]);
    // The surviving pending row keeps its own outbox mutation -- no collateral damage.
    expect(await store.listOutboxMutations()).toHaveLength(1);
    expect((await store.listOutboxMutations())[0].targetLocalId).toBe(survivor.localId);
  });

  it("is a no-op that reports 0 when nothing has failed", async () => {
    const store = createMemoryOfflineStore();
    await recordLocalCreate(store, payload);

    expect(await discardAllFailedMutations(store)).toBe(0);
    expect(await store.listLocalExpenses()).toHaveLength(1);
  });
});

describe("SYNC-127 sync-status screen virtualization (source verification -- the screen isn't\n  runtime-rendered here because react-native has no native binding under vitest)", () => {
  const syncStatusSource = () => source("app/sync-status.tsx");

  it("renders every row through a virtualized FlatList, not an eagerly-mounted map", () => {
    const src = syncStatusSource();
    expect(src).toContain("<FlatList");
    expect(src).toContain("keyExtractor={syncRowKey}");
    expect(src).toContain("renderItem={renderSyncRow}");
    expect(src).toContain("initialNumToRender");
    expect(src).toContain("ListHeaderComponent");
    expect(src).toContain("ListEmptyComponent");
    // The three `.map()`s that mounted every pending/failed/conflict card at once are gone.
    // Mapping to plain data descriptors for `data` is fine; mapping straight into row JSX is not.
    expect(src).not.toMatch(/Rows\.map\(\(row\) => \(\s*</);
  });

  it("must not nest the FlatList inside AppScreen's ScrollView -- that disables virtualization", () => {
    const src = syncStatusSource();
    expect(src).not.toContain("<AppScreen>");
    expect(src).not.toContain("<AppScreen");
    expect(src).not.toContain("<ScrollView");
  });

  it("offers 일괄 재시도 / 버리기, and puts a destructive-action confirmation in front of the discard", () => {
    const src = syncStatusSource();
    // 라운드 51 QA(P2-3): 두 버튼의 라벨은 대상(지출)과 건수를 함께 말하는 함수에서 온다.
    // 라운드 58 #4: 재시도 쪽 건수는 **재시도가 다룰 수 있는 행**만 센다(아래 describe에서
    // 계수 판정까지 고정한다). 버리기는 그대로 실패 행 전량이다.
    expect(src).toContain("syncStatusRetryFailedExpensesLabel(retryableFailedCount)");
    expect(src).toContain("syncStatusDiscardFailedExpensesLabel(failedRows.length)");
    expect(src).toContain("SYNC_STATUS_DISCARD_ALL_LABEL");
    expect(src).toContain("retryAllOfflineMutations(authToken, queryClient)");
    expect(src).toContain("discardAllOfflineMutations()");
    // 되돌릴 수 없는 파괴적 동작 -> 지출 삭제(app/expenses/[expenseId].tsx)와 같은 Alert 관례.
    expect(src).toContain("Alert.alert(SYNC_STATUS_DISCARD_ALL_CONFIRM_TITLE, syncStatusDiscardAllConfirmMessage(count)");
    expect(src).toContain('style: "destructive"');
    expect(src).toContain('text: "취소", style: "cancel"');
    // 전체 재시도에는 확인이 없다 -- 아무것도 파괴하지 않고, 실패하면 다시 실패 상태로 돌아온다.
    expect(src).not.toContain("Alert.alert(SYNC_STATUS_RETRY_ALL_LABEL");
  });

  it("keeps every pre-existing per-row action and copy contract alive", () => {
    const src = syncStatusSource();
    for (const pinned of [
      "CONFLICT_BANNER_MESSAGE",
      "CONFLICT_OPTION_ADOPT_SERVER_LABEL",
      "CONFLICT_OPTION_REAPPLY_MINE_LABEL",
      "CONFLICT_OPTION_VIEW_SIDE_BY_SIDE_LABEL",
      "resolveConflictKeepServer",
      "resolveConflictKeepMine",
      "resolveConflictKeepChosenFields",
      "retryOfflineMutation",
      "discardOfflineMutation",
      "syncStatusBadgeLabel",
      "모든 기록이 동기화됐어요.",
      "연결되면 자동으로 반영할게요.",
      // 라운드 51 QA(P3-9): 문장은 그대로이고 출처만 단일 소스가 됐다(messages.ts).
      "SYNC_STATUS_SYNCING_ROW_MESSAGE"
    ]) {
      expect(src, `sync-status.tsx should still contain ${pinned}`).toContain(pinned);
    }
    // 화면 식별자(픽셀락/E2E 관례)도 그대로.
    expect(src).toContain('testID="screen-EXP-005"');
  });

  it("routes the bulk actions through the controller (which refreshes the snapshot and flushes once), never straight at the engine", () => {
    const src = syncStatusSource();
    expect(src).toContain("retryAllOfflineMutations");
    expect(src).toContain("discardAllOfflineMutations");
    // 호출을 금지하는 것이지 이름을 언급하지 못하게 하는 것이 아니다 -- 라운드 58 #4의 주석이
    // "라벨의 건수와 엔진이 되돌리는 행이 같아야 한다"는 이유로 엔진 함수 이름을 인용한다.
    expect(src).not.toContain("retryAllFailedMutations(");
    expect(src).not.toContain("discardAllFailedMutations(");

    const controllerSource = source("src/offline/sync-controller.ts");
    // 100건이 한 번의 flush로 끝나는 것이 이 티켓의 요점이다.
    const retryAllBody = controllerSource.slice(controllerSource.indexOf("export async function retryAllOfflineMutations"));
    expect(retryAllBody).toContain("await retryAllFailedMutations(store);");
    expect(retryAllBody).toContain("await refreshSnapshot();");
    expect(retryAllBody.slice(0, retryAllBody.indexOf("}")).match(/flushInBackground/g) ?? []).toHaveLength(1);
  });
});

/**
 * 라운드 51 QA(P2-3) — 실패 섹션에 준비템 상태 실패 행만 남았을 때.
 *
 * 그 섹션의 일괄 버튼 둘은 지출 큐만 다루므로(retryAll/discardAll → 지출 컨트롤러), 지출 실패가
 * 0건이면 눌러도 아무 일이 없는 버튼과 "0건을 버릴까요?" 확인창만 남았다. 화면은 runtime으로
 * 렌더할 수 없으므로(react-native 네이티브 바인딩) 조합 규칙은 소스로, 문구는 순수 함수로 고정한다.
 */
describe("라운드 51 QA(P2-3) 실패 섹션 일괄 액션의 범위", () => {
  const syncStatusSource = () => source("app/sync-status.tsx");

  it("지출 실패 행이 없으면 일괄 액션을 아예 만들지 않는다 (섹션은 준비템 행만으로도 선다)", () => {
    const src = syncStatusSource();
    expect(src).toContain("if (failedRows.length + failedItemStatusRows.length > 0) {");
    expect(src).toContain('...(failedRows.length > 0 ? { actions: "failed-bulk" as const } : {})');
    // 예전의 무조건 부착은 남아 있지 않다.
    expect(src).not.toContain('title: SYNC_STATUS_FAILED_LABEL, actions: "failed-bulk"');
  });

  it("두 버튼은 대상(지출)과 건수를 라벨로 말한다 -- 스크린리더 문구를 따로 두지 않는다", () => {
    expect(syncStatusRetryFailedExpensesLabel(3)).toBe("지출 3건 재시도");
    expect(syncStatusDiscardFailedExpensesLabel(3)).toBe("지출 3건 버리기");
    // 개별 행 버튼과 같은 동사를 쓴다(한 화면에서 같은 동작을 다른 말로 부르지 않는다).
    expect(syncStatusRetryFailedExpensesLabel(1)).toContain(SYNC_STATUS_RETRY_LABEL);
    expect(syncStatusDiscardAllConfirmMessage(3)).toContain("3건");
    const src = syncStatusSource();
    expect(src).not.toContain("accessibilityLabel={`${SYNC_STATUS_RETRY_ALL_LABEL}");
  });

  it("확인 Alert의 건수도 지출 실패 행 수다 (버리는 대상과 같은 숫자)", () => {
    const src = syncStatusSource();
    const discardAllBody = src.slice(src.indexOf("const discardAll = useCallback("), src.indexOf("const listData"));
    expect(discardAllBody).toContain("const count = failedRows.length;");
    expect(discardAllBody).toContain("if (count === 0) return;");
    expect(discardAllBody).not.toContain("failedItemStatusRows");
  });
});

/**
 * 라운드 58 #4 — 일괄 재시도 라벨이 **실제로 되돌아갈 행 수**를 말한다.
 *
 * 종전 라벨은 실패 행 전량을 셌는데(`failedRows.length`), 그 버튼이 부르는 엔진은 라운드 47·57
 * 이후 403과 재시도가 무익한 4xx를 빼고 큐에 올린다. 그래서 403 한 건 + 400 두 건만 남은 화면이
 * "지출 3건 재시도"라고 적힌 버튼을 내밀고, 눌러도 0건이 되돌아갔다 — 화면이 개별 행에서는 이미
 * "다시 보내도 같은 결과예요"라고 말해 놓고 섹션 머리에서는 반대로 말한 셈이다.
 *
 * 계수 판정 자체(0건·레거시 403 포함)는 permission-denied.test.ts가 값으로 고정한다. 여기서는
 * 화면이 그 판정을 쓰는지와, 0건일 때 버튼이 아예 없는지를 소스로 고정한다.
 */
describe("라운드 58 #4 일괄 재시도 라벨 정합", () => {
  const syncStatusSource = () => source("app/sync-status.tsx");

  it("라벨의 건수는 재시도가 다룰 수 있는 행만 센다 (판정은 엔진과 같은 모듈)", () => {
    const src = syncStatusSource();
    expect(src).toContain('import {\n  countRetryableFailedRows,');
    expect(src).toContain("const retryableFailedCount = countRetryableFailedRows(failedRows);");
    expect(src).toContain("syncStatusRetryFailedExpensesLabel(retryableFailedCount)");
    // 종전의 거짓 계수는 남아 있지 않다.
    expect(src).not.toContain("syncStatusRetryFailedExpensesLabel(failedRows.length)");
  });

  it("재시도 가능한 행이 0건이면 재시도 버튼을 아예 그리지 않는다 (라운드 51 P2-3의 확장)", () => {
    const src = syncStatusSource();
    expect(src).toContain("{retryableFailedCount > 0 ? (");
    // 계수가 렌더 콜백의 의존성에 들어가 있지 않으면 버튼이 옛 숫자로 굳는다.
    const renderBody = src.slice(src.indexOf("const renderSyncRow = useCallback("), src.indexOf("const listHeader ="));
    expect(renderBody.slice(renderBody.lastIndexOf("\n    ["))).toContain("retryableFailedCount");
  });

  it("버리기는 그대로 실패 행 전량이 대상이다 — 재시도가 무익한 행에도 유효한 선택지다", () => {
    const src = syncStatusSource();
    expect(src).toContain("syncStatusDiscardFailedExpensesLabel(failedRows.length)");
    const discardAllBody = src.slice(src.indexOf("const discardAll = useCallback("), src.indexOf("const listData"));
    expect(discardAllBody).toContain("const count = failedRows.length;");
    expect(discardAllBody).not.toContain("retryableFailedCount");
  });

  it("엔진의 제외 규칙과 화면의 계수가 같은 함수에서 온다", () => {
    const engine = source("src/offline/sync-engine.ts");
    expect(engine).toContain("isBulkRetryableFailedRow(row)");
    // 같은 규칙을 손으로 두 번 적는 자리로 되돌아가지 않는다.
    expect(engine).not.toContain("!isPermissionDeniedSyncError(row)");
  });

  it("준비템 실패 행에는 일괄 버튼이 없다 — 규칙이 갈릴 자리 자체가 없다", () => {
    const src = syncStatusSource();
    // 일괄 액션은 지출 큐만 다루고(라운드 51 P2-3), 준비템 행은 개별 행에서 같은 판정을 받는다.
    expect(src).toContain('...(failedRows.length > 0 ? { actions: "failed-bulk" as const } : {})');
    expect(src).not.toContain("countRetryableFailedRows(failedItemStatusRows)");
    expect(source("src/offline/sync-engine.ts")).not.toContain("retryAllFailedItemStatusMutations");
  });
});

describe("SYNC-127 bulk-action copy", () => {
  it("reuses the per-row verbs with an explicit scope prefix so the two scopes never read alike", () => {
    expect(SYNC_STATUS_RETRY_ALL_LABEL).toBe("전체 재시도");
    expect(SYNC_STATUS_RETRY_ALL_LABEL).toContain(SYNC_STATUS_RETRY_LABEL);
    expect(SYNC_STATUS_DISCARD_ALL_LABEL).toBe("전체 버리기");
    expect(SYNC_STATUS_DISCARD_ALL_LABEL).not.toBe(SYNC_STATUS_DISCARD_LABEL);
  });

  it("names the exact number of records the destructive action will destroy", () => {
    expect(SYNC_STATUS_DISCARD_ALL_CONFIRM_TITLE).toContain("버릴까요");
    expect(syncStatusDiscardAllConfirmMessage(7)).toContain("7건");
    expect(syncStatusDiscardAllConfirmMessage(7)).toContain("되돌릴 수 없어요");
  });
});
