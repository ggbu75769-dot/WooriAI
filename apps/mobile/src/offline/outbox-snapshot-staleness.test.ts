import { describe, expect, it } from "vitest";
import { RemoteVersionConflictError } from "./errors";
import { createMemoryOfflineStore } from "./memory-offline-store";
import {
  flushOutbox,
  recordLocalCreate,
  recordLocalDelete,
  recordLocalItemStatus,
  recordLocalUpdate,
  type RemoteExpenseApi,
  type RemoteSyncApi
} from "./sync-engine";
import type { ExpensePayload, OfflineStore } from "./types";

/**
 * 라운드 105 A-1·A-2 — **큐 앞 요청이 나가 있는 동안 적은 값이 조용히 사라지던 자리.**
 *
 * ## 종전에 실제로 일어나던 일
 *
 * flush pass는 첫머리에서 큐 스냅숏을 한 번 읽고(`listOutboxMutations`), 그 스냅숏의 본문을
 * 그대로 전송했다. 그런데 큐 `[M1, M2]`에서 M1의 요청이 나가 있는 동안 M2는 아직 `inFlight`가
 * 아니다 — 아직 아무것도 안 보냈으니 **접히는 것이 맞다**(outbox-merge.ts). 그래서 그 사이에
 * 사용자가 M2의 지출을 고치면 같은 mutationId 위에 새 본문이 덮이는데, pass는 **옛 본문·옛 키**를
 * 보내고 성공하면 그 mutationId를 지웠다. 남는 것:
 *
 *  - 로컬 행은 사용자가 적은 새 값 + 'synced',
 *  - 서버는 옛 값,
 *  - 큐는 비었고 화면은 "모든 기록이 동기화됐어요"를 **참으로** 말한다(허위 표시).
 *
 * 삭제 병합에서는 더 나빴다. 대기 중 수정에 삭제가 오면 병합은 그 수정을 **버린다**("delete
 * 승리"). 그런데 pass는 버려진 그 수정을 서버에 실어 version을 밀어 놓고, 뒤이은 DELETE가
 * **기기가 한 대뿐인데** 409 VERSION_CONFLICT로 떨어졌다 — 사용자에게는 자기 혼자 지운 기록에
 * 대해 충돌 3지선다가 뜬다.
 *
 * 준비템 상태 큐도 같은 자리·같은 모양이었고, 거기서는 `itemStatusSynced > 0`이 ["items"]
 * 무효화를 부르므로(sync-controller.ts) **재조회가 사용자가 방금 누른 값을 눈앞에서 되돌렸다.**
 *
 * ## 이 파일이 무는 것
 *
 * "다시 읽는가"라는 구현 사실이 아니라 **서버에 무엇이 남고 사용자에게 무엇이 보이는가**를 값으로
 * 묻는다. 픽스처가 유령이 아니라는 것도 함께 문다 — 병합이 실제로 일어났다는 것(큐 길이·본문)을
 * 전송 전에 확인한다.
 */

const base = (itemName: string, amountKrw: number): ExpensePayload => ({
  childId: "child-1",
  categoryId: "cat-diaper",
  amountKrw,
  spentOn: "2026-09-01",
  itemName
});

/** 요청 하나를 "나가 있는" 상태로 붙잡아 두는 문 — 실제 왕복 사이의 그 몇 ms를 고정한다. */
function createGate() {
  let open!: () => void;
  const opened = new Promise<void>((resolve) => (open = resolve));
  let observe!: () => void;
  const observed = new Promise<void>((resolve) => (observe = resolve));
  return { open, opened, observe, observed };
}

async function outboxShape(store: OfflineStore) {
  return (await store.listOutboxMutations()).map((row) => ({
    operation: row.operation,
    itemName: (row.payload as ExpensePayload | null)?.itemName ?? null,
    amountKrw: (row.payload as ExpensePayload | null)?.amountKrw ?? null,
    inFlight: Boolean(row.inFlight)
  }));
}

describe("라운드 105 A-1 — 지출 큐: 전송 직전에 접힌 편집이 서버까지 간다", () => {
  it("앞 요청이 나가 있는 동안 고친 지출은 **고친 값으로** 서버에 도착하고, 로컬·서버가 같아진다", async () => {
    const store = createMemoryOfflineStore();
    await recordLocalCreate(store, base("기저귀", 10_000));
    const b = await recordLocalCreate(store, base("분유", 20_000));

    const sent: Array<{ itemName: string; amountKrw: number }> = [];
    const gate = createGate();
    const remote: RemoteExpenseApi = {
      async createExpense(payload) {
        sent.push({ itemName: payload.itemName, amountKrw: payload.amountKrw });
        if (payload.itemName === "기저귀") {
          gate.observe();
          await gate.opened;
        }
        return { id: `srv-${sent.length}`, version: 1 };
      },
      async updateExpense() {
        throw new Error("이 시나리오에 update는 없다");
      },
      async deleteExpense() {
        throw new Error("이 시나리오에 delete는 없다");
      }
    };

    const flush = flushOutbox(store, remote);
    await gate.observed;

    // 사용자가 **B를** 고친다. B는 아직 inFlight가 아니므로 병합의 정당한 대상이다.
    await recordLocalUpdate(store, b.localId, { amountKrw: 99_000, itemName: "분유(수정)" });

    // 픽스처가 유령이 아니라는 확인: 큐는 여전히 두 줄이고, B 줄의 본문이 실제로 덮였다.
    expect(await outboxShape(store)).toEqual([
      { operation: "create", itemName: "기저귀", amountKrw: 10_000, inFlight: true },
      { operation: "create", itemName: "분유(수정)", amountKrw: 99_000, inFlight: false }
    ]);

    gate.open();
    const summary = await flush;

    expect(summary.synced).toBe(2);
    // 종전에는 여기가 { itemName: "분유", amountKrw: 20_000 }이었다 — 사용자가 적은 값이 서버에
    // 도착한 적이 없다.
    expect(sent).toEqual([
      { itemName: "기저귀", amountKrw: 10_000 },
      { itemName: "분유(수정)", amountKrw: 99_000 }
    ]);

    const rowB = await store.getLocalExpense(b.localId);
    expect(rowB?.payload.amountKrw).toBe(99_000);
    expect(rowB?.payload.itemName).toBe("분유(수정)");
    // 큐가 비었고 행이 'synced'라는 말이 이제 **참이다**: 서버가 든 값과 로컬 값이 같다.
    expect(rowB?.syncState).toBe("synced");
    expect(await store.listOutboxMutations()).toEqual([]);
  });

  it("접힌 편집은 **자기 멱등키**로 나간다(옛 키의 재전송으로 위장하지 않는다)", async () => {
    const store = createMemoryOfflineStore();
    await recordLocalCreate(store, base("기저귀", 10_000));
    const b = await recordLocalCreate(store, base("분유", 20_000));
    const [, queuedB] = await store.listOutboxMutations();

    const keys: string[] = [];
    const gate = createGate();
    const remote: RemoteExpenseApi = {
      async createExpense(payload, idempotencyKey) {
        keys.push(idempotencyKey);
        if (payload.itemName === "기저귀") {
          gate.observe();
          await gate.opened;
        }
        return { id: `srv-${keys.length}`, version: 1 };
      },
      async updateExpense() {
        throw new Error("unused");
      },
      async deleteExpense() {
        throw new Error("unused");
      }
    };

    const flush = flushOutbox(store, remote);
    await gate.observed;
    await recordLocalUpdate(store, b.localId, { amountKrw: 99_000 });
    // create 접기는 키를 유지하는 것이 계약이다(outbox-merge.ts의 `pendingCreate` 갈래 —
    // 생성에 새 키를 주면 그것이 곧 중복 지출이다). 여기서 무는 것은 "저장소가 든 그 키가
    // 그대로 나가는가"이지 "키가 바뀌는가"가 아니다.
    const [, mergedB] = await store.listOutboxMutations();
    expect(mergedB.idempotencyKey).toBe(queuedB.idempotencyKey);

    gate.open();
    await flush;

    expect(keys[1]).toBe(mergedB.idempotencyKey);
  });

  it("삭제가 이긴 대기 수정은 **서버에 나가지 않고**, DELETE가 409 없이 통과한다", async () => {
    const store = createMemoryOfflineStore();
    const serverVersions = new Map<string, number>();

    const settle: RemoteExpenseApi = {
      async createExpense(payload) {
        const id = `srv-${payload.itemName}`;
        serverVersions.set(id, 1);
        return { id, version: 1 };
      },
      async updateExpense() {
        return { version: 2 };
      },
      async deleteExpense() {}
    };
    const a = await recordLocalCreate(store, base("기저귀", 10_000));
    const b = await recordLocalCreate(store, base("분유", 20_000));
    await flushOutbox(store, settle);

    // 두 지출 모두에 수정 하나씩을 큐에 올린다.
    await recordLocalUpdate(store, a.localId, { amountKrw: 11_000 });
    await recordLocalUpdate(store, b.localId, { amountKrw: 21_000 });

    const calls: string[] = [];
    const gate = createGate();
    const remote: RemoteExpenseApi = {
      async createExpense() {
        throw new Error("이 시나리오에 create는 없다");
      },
      async updateExpense(canonicalId, payload, expectedVersion) {
        calls.push(`UPDATE ${canonicalId} v=${expectedVersion}`);
        if (canonicalId === "srv-기저귀") {
          gate.observe();
          await gate.opened;
        }
        const current = serverVersions.get(canonicalId)!;
        if (current !== expectedVersion) {
          throw new RemoteVersionConflictError({
            deleted: false,
            expense: { ...payload, id: canonicalId, version: current }
          });
        }
        serverVersions.set(canonicalId, current + 1);
        return { version: current + 1 };
      },
      async deleteExpense(canonicalId, expectedVersion) {
        calls.push(`DELETE ${canonicalId} v=${expectedVersion}`);
        const current = serverVersions.get(canonicalId)!;
        if (current !== expectedVersion) {
          throw new RemoteVersionConflictError({
            deleted: false,
            expense: { ...base("분유", 21_000), id: canonicalId, version: current }
          });
        }
        serverVersions.delete(canonicalId);
      }
    };

    const flush = flushOutbox(store, remote);
    await gate.observed;

    // A의 수정이 나가 있는 동안 사용자가 **B를 지운다** → 병합 규칙: 대기 수정은 버리고 delete만.
    await recordLocalDelete(store, b.localId);
    expect(await outboxShape(store)).toEqual([
      { operation: "update", itemName: "기저귀", amountKrw: 11_000, inFlight: true },
      { operation: "delete", itemName: null, amountKrw: null, inFlight: false }
    ]);

    gate.open();
    await flush;
    await flushOutbox(store, remote);

    // 종전에는 여기에 'UPDATE srv-분유 v=1'이 끼어 서버 version을 2로 밀었고, 그 뒤 DELETE가
    // v=1로 나가 409로 떨어졌다.
    expect(calls).toEqual(["UPDATE srv-기저귀 v=1", "DELETE srv-분유 v=1"]);
    // 기기가 한 대인데 뜨던 충돌이 없다: 로컬 행은 지워졌고 서버에도 그 지출이 없다.
    expect(await store.getLocalExpense(b.localId)).toBeNull();
    expect([...serverVersions.keys()]).toEqual(["srv-기저귀"]);
    expect(await store.listOutboxMutations()).toEqual([]);
  });

  it("전송 직전에 접힌 편집은 앞선 실패의 **백오프 예산**을 물려받지 않는다", async () => {
    // 병합은 새로 접혀 들어온 편집을 **새 의사 표시**로 보고 예산을 0으로 되돌린다
    // (MERGED_RETRY_BUDGET_RESET). 그 되돌림이 pass에도 보여야 한다 — 스냅숏의 옛 attemptCount로
    // 다시 세면 방금 고친 값이 앞선 실패의 백오프·상한을 그대로 물려받는다.
    const store = createMemoryOfflineStore();
    await recordLocalCreate(store, base("기저귀", 10_000));
    const b = await recordLocalCreate(store, base("분유", 20_000));

    // ① B만 한 번 네트워크로 실패시켜 예산을 쌓아 둔다(A는 아직 안 보낸다).
    let stage: "seed" | "gated" = "seed";
    const gate = createGate();
    const remote: RemoteExpenseApi = {
      async createExpense(payload) {
        if (stage === "seed") throw new TypeError("Network request failed");
        if (payload.itemName === "기저귀") {
          gate.observe();
          await gate.opened;
          return { id: "srv-1", version: 1 };
        }
        throw new TypeError("Network request failed");
      },
      async updateExpense() {
        throw new Error("unused");
      },
      async deleteExpense() {
        throw new Error("unused");
      }
    };
    await flushOutbox(store, remote);
    // 큐 맨 앞(A)이 실패해 pass가 끊겼으니, 예산을 B에 직접 심어 큐 앞뒤 순서만 남긴다.
    const [mutationA] = await store.listOutboxMutations();
    await store.updateOutboxMutation(mutationA.mutationId, { attemptCount: 0, nextRetryAt: null });
    const [seededB] = await store.listOutboxMutationsForLocalId(b.localId);
    await store.updateOutboxMutation(seededB.mutationId, { attemptCount: 1, nextRetryAt: null });

    // ② A가 나가 있는 동안 사용자가 B를 고친다 → 병합이 B의 예산을 0으로 되돌린다.
    stage = "gated";
    const flush = flushOutbox(store, remote);
    await gate.observed;
    await recordLocalUpdate(store, b.localId, { amountKrw: 99_000 });
    const [merged] = await store.listOutboxMutationsForLocalId(b.localId);
    expect(merged.attemptCount).toBe(0);

    gate.open();
    await flush;

    // ③ 그 상태에서 B가 다시 실패했다. attemptCount는 **1**이어야 한다 — 스냅숏의 옛 1 + 1 = 2가
    // 아니라. (2가 되면 사용자가 방금 고친 값이 앞선 실패의 백오프 단수에서 시작한다.)
    const [after] = await store.listOutboxMutationsForLocalId(b.localId);
    expect(after.attemptCount).toBe(1);
  });
});

describe("라운드 105 A-2 — 준비템 큐: ①과 같은 뿌리·같은 모양", () => {
  it("앞 PATCH가 나가 있는 동안 다시 누른 준비템은 **마지막으로 누른 상태로** 서버에 도착한다", async () => {
    const store = createMemoryOfflineStore();
    await recordLocalItemStatus(store, {
      childId: "child-1",
      itemTemplateId: "tmpl-A",
      status: "prepared",
      itemName: "젖병"
    });
    await recordLocalItemStatus(store, {
      childId: "child-1",
      itemTemplateId: "tmpl-B",
      status: "interested",
      itemName: "유모차"
    });

    const sent: Array<{ itemTemplateId: string; status: string }> = [];
    const gate = createGate();
    const remote: RemoteSyncApi = {
      async createExpense() {
        throw new Error("unused");
      },
      async updateExpense() {
        throw new Error("unused");
      },
      async deleteExpense() {
        throw new Error("unused");
      },
      async setItemStatus(payload) {
        sent.push({ itemTemplateId: payload.itemTemplateId, status: payload.status });
        if (payload.itemTemplateId === "tmpl-A") {
          gate.observe();
          await gate.opened;
        }
      }
    };

    const flush = flushOutbox(store, remote);
    await gate.observed;

    // 사용자가 B를 다시 누른다(찜하기 → 준비했어요). 마지막 쓰기가 이기는 것이 계약이다.
    await recordLocalItemStatus(store, {
      childId: "child-1",
      itemTemplateId: "tmpl-B",
      status: "prepared",
      itemName: "유모차"
    });
    const queuedB = (await store.listItemStatusMutations()).find((row) => row.itemTemplateId === "tmpl-B");
    expect(queuedB?.status).toBe("prepared");
    expect(Boolean(queuedB?.inFlight)).toBe(false);

    gate.open();
    const summary = await flush;

    expect(summary.itemStatusSynced).toBe(2);
    // 종전에는 { itemTemplateId: "tmpl-B", status: "interested" }가 나갔다. 그 pass가
    // itemStatusSynced > 0으로 ["items"]를 무효화하므로, 재조회가 사용자가 누른 '준비했어요'를
    // 눈앞에서 '찜'으로 되돌렸다.
    expect(sent).toEqual([
      { itemTemplateId: "tmpl-A", status: "prepared" },
      { itemTemplateId: "tmpl-B", status: "prepared" }
    ]);
    expect(await store.listItemStatusMutations()).toEqual([]);
  });

  it("다시 누른 준비템도 앞선 실패의 **백오프 예산**을 물려받지 않는다(지출 큐와 같은 자리)", async () => {
    const store = createMemoryOfflineStore();
    await recordLocalItemStatus(store, {
      childId: "child-1",
      itemTemplateId: "tmpl-A",
      status: "prepared",
      itemName: "젖병"
    });
    const b = await recordLocalItemStatus(store, {
      childId: "child-1",
      itemTemplateId: "tmpl-B",
      status: "interested",
      itemName: "유모차"
    });
    // B에 앞선 실패의 예산을 심는다(큐에서의 자리는 그대로 A 뒤).
    await store.updateItemStatusMutation(b.mutationId, { attemptCount: 1, nextRetryAt: null });

    const gate = createGate();
    const remote: RemoteSyncApi = {
      async createExpense() {
        throw new Error("unused");
      },
      async updateExpense() {
        throw new Error("unused");
      },
      async deleteExpense() {
        throw new Error("unused");
      },
      async setItemStatus(payload) {
        if (payload.itemTemplateId === "tmpl-A") {
          gate.observe();
          await gate.opened;
          return;
        }
        throw new TypeError("Network request failed");
      }
    };

    const flush = flushOutbox(store, remote);
    await gate.observed;
    // A의 PATCH가 나가 있는 동안 B를 다시 누른다 → 병합이 예산을 0으로 되돌린다.
    await recordLocalItemStatus(store, {
      childId: "child-1",
      itemTemplateId: "tmpl-B",
      status: "prepared",
      itemName: "유모차"
    });
    expect((await store.getItemStatusMutation(b.mutationId))!.attemptCount).toBe(0);

    gate.open();
    await flush;

    const after = (await store.getItemStatusMutation(b.mutationId))!;
    expect(after.attemptCount).toBe(1);
  });
});
