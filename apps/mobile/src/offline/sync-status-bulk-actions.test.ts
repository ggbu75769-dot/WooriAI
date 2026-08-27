import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createMemoryOfflineStore } from "./memory-offline-store";
import {
  syncStatusDiscardAllConfirmMessage,
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

  it("offers 전체 재시도 / 전체 버리기, and puts a destructive-action confirmation in front of the discard", () => {
    const src = syncStatusSource();
    expect(src).toContain("SYNC_STATUS_RETRY_ALL_LABEL");
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
      "동기화 중이에요."
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
    expect(src).not.toContain("retryAllFailedMutations");
    expect(src).not.toContain("discardAllFailedMutations");

    const controllerSource = source("src/offline/sync-controller.ts");
    // 100건이 한 번의 flush로 끝나는 것이 이 티켓의 요점이다.
    const retryAllBody = controllerSource.slice(controllerSource.indexOf("export async function retryAllOfflineMutations"));
    expect(retryAllBody).toContain("await retryAllFailedMutations(store);");
    expect(retryAllBody).toContain("await refreshSnapshot();");
    expect(retryAllBody.slice(0, retryAllBody.indexOf("}")).match(/flushInBackground/g) ?? []).toHaveLength(1);
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
