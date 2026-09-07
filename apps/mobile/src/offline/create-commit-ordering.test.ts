import { describe, expect, it } from "vitest";
import { reconcileMonthlyExpenses } from "./expense-list-reconciliation";
import { createMemoryOfflineStore } from "./memory-offline-store";
import { isDiscardablePendingRow } from "./pending-row-actions";
import {
  flushOutbox,
  isFlushFullyConfirmed,
  recordLocalCreate,
  recordLocalDelete,
  recordLocalUpdate,
  recoverInterruptedSyncState,
  type RemoteExpenseApi
} from "./sync-engine";
import type { ExpensePayload, LocalExpenseRow, OfflineStore } from "./types";

/**
 * 라운드 105 C-3 — **create 성공 처리 중 앱이 죽으면 남던 고아 행.**
 *
 * ## 종전에 실제로 일어나던 일
 *
 * create 성공 처리는 두 쓰기였다: `deleteOutboxMutation` **먼저**, `updateLocalExpense` 나중.
 * 그 사이에 앱이 회수되면(OS 메모리 회수·강제 종료) 기기에 남는 것은
 * **로컬 행 syncState='syncing'·canonicalId=null + 텅 빈 아웃박스**다. 그리고 이 상태는 어느
 * 경로로도 낫지 않았다:
 *
 *  - `recoverInterruptedSyncState`는 그 행을 'pending'으로 되돌리기만 한다(값은 안 건드린다).
 *  - `flushOutboxPass`는 **mutation을 훑는다.** 아웃박스가 비었으니 이 행은 영영 보이지 않는다.
 *
 * 사용자에게 찍히던 것: 같은 지출이 기록 탭에 **두 줄**(서버 한 줄 + 영구 대기 한 줄), 월 합계가
 * 정확히 **두 배**(예산 경고·홈 히어로까지 전파), 배지는 영구히 "대기 1"인데 아무 요청도 나가지
 * 않고, 남긴 것이 없으니 `isFlushFullyConfirmed`가 참이라 "방금 확인했어요"까지 붙는다.
 *
 * ## 이제
 *
 * 서버가 준 canonicalId·version을 **먼저** 적고 아웃박스 행은 그 뒤에 지운다. 그래서 창은 반대
 * 방향으로만 열리고(로컬 행은 확정, 큐에는 이미 확정된 create가 남는다), 그 창은
 * "canonicalId가 있는 create는 **보내지 않고** 로컬에서 수렴" 규칙이 다음 pass에서 닫는다.
 * 재전송하지 않는 것이 핵심이다 — 서버 멱등 보관(24시간)이 지난 뒤의 재전송은 중복 지출이다.
 *
 * ## 이 파일이 무는 것
 *
 * 창을 전부 값으로 문다: 종전의 창(아웃박스 삭제 직후 사망), 새로 열린 반대 방향의 창(로컬 행
 * 확정 직후 사망) — 그 창을 **사용자가 손대는** 두 갈래(수정·삭제)까지 —, 그리고 크래시 없이도
 * 열리는 창(두 쓰기 사이의 저장소 쓰기 실패).
 * 판정은 언제나 **사용자에게 남는 것**이다: 기록 탭의 줄 수와 월 합계, 서버에 만들어진 지출
 * 건수, 그리고 서버가 실제로 받은 요청.
 */

const payload: ExpensePayload = {
  childId: "child-1",
  categoryId: "cat-diaper",
  amountKrw: 38_500,
  spentOn: "2026-09-03",
  itemName: "기저귀"
};

class ProcessKilled extends Error {}

/**
 * 서버 흉내 — 멱등키 보관까지 든다. 같은 키의 재전송은 **재생**(같은 id)이고, 새 키는 새 지출이다.
 * 그래서 "재전송이 무해한가"와 "재전송이 중복을 만드는가"를 이 픽스처 하나로 가를 수 있다.
 */
function createIdempotentServer() {
  const created: Array<{ id: string; amountKrw: number }> = [];
  const updates: Array<{ id: string; amountKrw: number; expectedVersion: number }> = [];
  const deletes: Array<{ id: string; expectedVersion: number }> = [];
  const replayById = new Map<string, { id: string; version: number }>();
  let calls = 0;

  const remote: RemoteExpenseApi = {
    async createExpense(body, idempotencyKey) {
      calls += 1;
      const replayed = replayById.get(idempotencyKey);
      if (replayed) return replayed;
      const result = { id: `srv-${created.length + 1}`, version: 1 };
      created.push({ id: result.id, amountKrw: body.amountKrw });
      replayById.set(idempotencyKey, result);
      return result;
    },
    async updateExpense(canonicalId, body, expectedVersion) {
      updates.push({ id: canonicalId, amountKrw: body.amountKrw, expectedVersion });
      const target = created.find((row) => row.id === canonicalId);
      if (target) target.amountKrw = body.amountKrw;
      return { version: expectedVersion + 1 };
    },
    async deleteExpense(canonicalId, expectedVersion) {
      deletes.push({ id: canonicalId, expectedVersion });
      const index = created.findIndex((row) => row.id === canonicalId);
      if (index !== -1) created.splice(index, 1);
    }
  };
  return { remote, created, updates, deletes, createCalls: () => calls };
}

/** 지정한 저장소 쓰기가 **끝난 직후** 프로세스가 회수된 것처럼, 이후의 모든 쓰기를 없앤다. */
function killAfter(inner: OfflineStore, when: "outbox-delete" | "local-commit"): OfflineStore {
  let dead = false;
  const guard = <T>(run: () => Promise<T>): Promise<T> =>
    dead ? Promise.reject(new ProcessKilled("app killed")) : run();
  return {
    ...inner,
    async deleteOutboxMutation(mutationId) {
      if (dead) throw new ProcessKilled("app killed");
      await inner.deleteOutboxMutation(mutationId);
      if (when === "outbox-delete") dead = true;
    },
    async updateLocalExpense(localId, patch) {
      if (dead) throw new ProcessKilled("app killed");
      await inner.updateLocalExpense(localId, patch);
      // 'local-commit' 창은 create 응답을 로컬 행에 적은 그 순간이다 — canonicalId가 그 표식이다.
      if (when === "local-commit" && patch.canonicalId) dead = true;
    },
    updateOutboxMutation: (mutationId, patch) => guard(() => inner.updateOutboxMutation(mutationId, patch)),
    listOutboxMutationsForLocalId: (localId) => guard(() => inner.listOutboxMutationsForLocalId(localId)),
    deleteLocalExpense: (localId) => guard(() => inner.deleteLocalExpense(localId))
  } as OfflineStore;
}

/** 기록 탭이 실제로 그리는 값(서버 목록 + 로컬 대기 행)으로 환산한다. */
function recordsTabView(serverIds: string[], rows: LocalExpenseRow[]) {
  const serverList = serverIds.map((id) => ({ id, amountKrw: payload.amountKrw, expenseType: "expense" }));
  const view = reconcileMonthlyExpenses(serverList, rows, "2026-09");
  return {
    lines: view.visibleServerExpenses.length + view.offlinePendingRows.length,
    monthlyTotalKrw: view.monthlyTotalKrw
  };
}

describe("라운드 105 C-3 — create 확정의 두 쓰기 순서", () => {
  it("아웃박스 삭제 직후 앱이 죽어도 **고아 행이 남지 않는다**(월 합계가 두 배가 되지 않는다)", async () => {
    const store = createMemoryOfflineStore();
    const server = createIdempotentServer();
    const created = await recordLocalCreate(store, payload);

    await flushOutbox(killAfter(store, "outbox-delete"), server.remote).catch(() => undefined);

    // 다음 부팅.
    await recoverInterruptedSyncState(store);
    await flushOutbox(store, server.remote);

    const row = (await store.getLocalExpense(created.localId))!;
    // 종전: syncState='pending' · canonicalId=null · 아웃박스 0 → 아무도 못 보는 고아 행.
    expect(row.syncState).toBe("synced");
    expect(row.canonicalId).toBe("srv-1");
    expect(await store.listOutboxMutations()).toEqual([]);
    // 사용자가 실수로 지울 수 있는 '버리기' 대상도 아니다(확정된 기록이다).
    expect(isDiscardablePendingRow(row)).toBe(false);

    // 기록 탭: 한 줄, 합계 한 번. 종전에는 두 줄 · 77,000원이었다.
    expect(recordsTabView(["srv-1"], [row])).toEqual({ lines: 1, monthlyTotalKrw: 38_500 });
    expect(server.created).toEqual([{ id: "srv-1", amountKrw: 38_500 }]);
  });

  it("**새로 열린 반대 방향의 창**(로컬 행 확정 직후 사망)은 다음 pass가 재전송 없이 닫는다", async () => {
    const store = createMemoryOfflineStore();
    const server = createIdempotentServer();
    const created = await recordLocalCreate(store, payload);

    await flushOutbox(killAfter(store, "local-commit"), server.remote).catch(() => undefined);

    // 죽은 자리의 기기 상태: 로컬 행은 확정, 큐에는 **이미 확정된** create가 남아 있다.
    const beforeReboot = (await store.getLocalExpense(created.localId))!;
    expect(beforeReboot.canonicalId).toBe("srv-1");
    expect(await store.listOutboxMutations()).toHaveLength(1);
    expect(server.createCalls()).toBe(1);

    await recoverInterruptedSyncState(store);
    const summary = await flushOutbox(store, server.remote);

    // 다시 보내지 않는다 — 멱등 보관 24시간이 지난 기기에서도 중복이 생기지 않아야 하기 때문이다.
    expect(server.createCalls()).toBe(1);
    expect(server.created).toHaveLength(1);
    // 큐에서 한 행이 성공으로 사라졌으니 `synced`는 센다. 그러나 이 pass가 **새 기록을 만든 것은
    // 아니므로** createdSynced는 세지 않는다 — 그 칸이 "기록했어요 · 이번 달 비용에 더해둘게요"
    // 플래시를 세운다(sync-controller.ts).
    expect(summary.synced).toBe(1);
    expect(summary.createdSynced).toBe(0);

    const row = (await store.getLocalExpense(created.localId))!;
    expect(row.syncState).toBe("synced");
    expect(await store.listOutboxMutations()).toEqual([]);
    expect(recordsTabView(["srv-1"], [row])).toEqual({ lines: 1, monthlyTotalKrw: 38_500 });
  });

  it("크래시 없이 열리는 창(두 쓰기 사이의 저장소 쓰기 실패)도 **지출 한 건**으로 수렴한다", async () => {
    const inner = createMemoryOfflineStore();
    const server = createIdempotentServer();
    const created = await recordLocalCreate(inner, payload);

    // create 응답을 로컬 행에 적는 그 한 번의 쓰기만 실패시킨다(디스크 압박·잠금 등).
    let failedOnce = false;
    const flaky: OfflineStore = {
      ...inner,
      async updateLocalExpense(localId, patch) {
        if (!failedOnce && patch.canonicalId) {
          failedOnce = true;
          throw new Error("database is locked");
        }
        await inner.updateLocalExpense(localId, patch);
      }
    };

    await flushOutbox(flaky, server.remote);
    // 로컬 행 갱신이 실패했으니 mutation은 큐에 남아 있어야 한다(종전 순서라면 이미 지워져
    // 고아 행이 됐다).
    expect(await inner.listOutboxMutations()).toHaveLength(1);

    // 백오프 창을 열고 다시 보낸다 → **같은 멱등키**라 서버가 재생한다.
    const [parked] = await inner.listOutboxMutations();
    await inner.updateOutboxMutation(parked.mutationId, { nextRetryAt: null });
    await flushOutbox(flaky, server.remote);

    expect(server.created).toEqual([{ id: "srv-1", amountKrw: 38_500 }]);
    const row = (await inner.getLocalExpense(created.localId))!;
    expect(row.syncState).toBe("synced");
    expect(row.canonicalId).toBe("srv-1");
    expect(await inner.listOutboxMutations()).toEqual([]);
    expect(recordsTabView(["srv-1"], [row])).toEqual({ lines: 1, monthlyTotalKrw: 38_500 });
  });

  /**
   * 반대 방향의 창을 **사용자가 손대는** 두 갈래. 여기가 이 수정의 진짜 위험 지점이었다:
   * 그 창의 기기 상태는 "로컬 행에 canonicalId가 있는데 create mutation이 아직 큐에 있다"인데,
   * 그 create의 `inFlight` 표시를 부팅 복구가 되돌려 버리면 병합이 **이미 서버에 나간 create에**
   * 사용자의 편집을 접고, 곧이어 도는 수렴 규칙이 그것을 통째로 버린다. 값으로 재 본 종전 결과:
   * 수정은 로컬만 77,000원 · 서버는 10,000원 · 큐는 빈 채 'synced'였고(= 고치려던 그 결함 ①과
   * 같은 모양이 새 자리에 생긴다), 삭제는 로컬 행만 사라지고 서버 지출이 남아 다음 재조회에
   * 되살아났다. 그래서 복구는 그 표시를 **남긴다**(recoverInterruptedSyncState).
   */
  it("그 창에서 사용자가 지출을 **고치면**, 그 편집이 서버까지 간다", async () => {
    const store = createMemoryOfflineStore();
    const server = createIdempotentServer();
    const created = await recordLocalCreate(store, payload);
    await flushOutbox(killAfter(store, "local-commit"), server.remote).catch(() => undefined);

    await recoverInterruptedSyncState(store);
    await recordLocalUpdate(store, created.localId, { amountKrw: 77_000 });
    // 접히지 않고 **별도 mutation**으로 붙어야 한다(create는 이미 나간 요청이다).
    expect((await store.listOutboxMutationsForLocalId(created.localId)).map((row) => row.operation)).toEqual([
      "create",
      "update"
    ]);

    await flushOutbox(store, server.remote);

    expect(server.updates).toEqual([{ id: "srv-1", amountKrw: 77_000, expectedVersion: 1 }]);
    expect(server.createCalls()).toBe(1);
    const row = (await store.getLocalExpense(created.localId))!;
    expect(row.payload.amountKrw).toBe(77_000);
    expect(row.syncState).toBe("synced");
    expect(await store.listOutboxMutations()).toEqual([]);
  });

  it("그 창에서 사용자가 지출을 **지우면**, 서버 지출도 사라진다", async () => {
    const store = createMemoryOfflineStore();
    const server = createIdempotentServer();
    const created = await recordLocalCreate(store, payload);
    await flushOutbox(killAfter(store, "local-commit"), server.remote).catch(() => undefined);

    await recoverInterruptedSyncState(store);
    await recordLocalDelete(store, created.localId);
    // create+delete를 "서버가 들은 적 없다"로 보고 둘 다 버리면 안 된다 — 서버는 이미 들었다.
    expect((await store.listOutboxMutationsForLocalId(created.localId)).map((row) => row.operation)).toEqual([
      "create",
      "delete"
    ]);

    await flushOutbox(store, server.remote);

    expect(server.deletes).toEqual([{ id: "srv-1", expectedVersion: 1 }]);
    expect(await store.getLocalExpense(created.localId)).toBeNull();
    expect(await store.listOutboxMutations()).toEqual([]);
  });

  it("수렴 pass가 끝난 뒤에야 \"방금 확인했어요\"가 참이 된다", async () => {
    const store = createMemoryOfflineStore();
    const server = createIdempotentServer();
    await recordLocalCreate(store, payload);
    await flushOutbox(killAfter(store, "local-commit"), server.remote).catch(() => undefined);

    await recoverInterruptedSyncState(store);
    const summary = await flushOutbox(store, server.remote);

    // 종전에도 이 판정은 참이었지만, 그때는 **큐에 아무도 못 보는 행을 남긴 채** 참이었다
    // (고아 행은 mutation이 아니라 로컬 행이라 실패 칸에도 잡히지 않는다). 이제는 남긴 것이
    // 실제로 없다.
    expect(isFlushFullyConfirmed(summary)).toBe(true);
    expect(await store.listOutboxMutations()).toEqual([]);
    expect((await store.listLocalExpenses()).every((row) => row.syncState === "synced")).toBe(true);
  });
});
