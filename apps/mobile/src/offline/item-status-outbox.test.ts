import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { API_ERROR_MESSAGES } from "../api/api-error";
import { RemotePermanentError } from "./errors";
import { createMemoryOfflineStore } from "./memory-offline-store";
import { mergeItemStatusMutation } from "./outbox-merge";
import { isPermissionDeniedSyncError } from "./permission-denied";
import {
  discardFailedItemStatusMutation,
  flushOutbox,
  MAX_FLUSH_RERUNS,
  MAX_SERVER_ERROR_ATTEMPTS,
  recordLocalCreate,
  recordLocalItemStatus,
  retryFailedItemStatusMutation,
  SERVER_ERROR_GIVE_UP_MESSAGE,
  SERVER_TRANSIENT_ERROR_MESSAGE,
  type RemoteSyncApi
} from "./sync-engine";
import type { ExpensePayload, ItemStatusOutboxRow, ItemStatusPayload, OfflineStore } from "./types";

const mobileRoot = process.cwd();
const source = (relativePath: string) => readFileSync(join(mobileRoot, relativePath), "utf8");

const expensePayload: ExpensePayload = {
  childId: "child-1",
  categoryId: "cat-diaper",
  amountKrw: 10_000,
  spentOn: "2026-08-01",
  itemName: "기저귀"
};

function statusPayload(overrides: Partial<ItemStatusPayload> = {}): ItemStatusPayload {
  return {
    childId: "child-1",
    itemTemplateId: "item-carseat",
    status: "prepared",
    itemName: "카시트",
    ...overrides
  };
}

/**
 * 지출 전송은 하지 않고(큐가 비어 있다) 준비템 상태만 받는 페이크 transport. 실패 시나리오는
 * 인자로 주입한다 -- 엔진의 분류(4xx permanent / 5xx·네트워크 transient)만 검증하기 위해서다.
 */
function createFakeRemote(options?: { failWith?: () => unknown; failTimes?: number }) {
  const calls: ItemStatusPayload[] = [];
  let remaining = options?.failTimes ?? (options?.failWith ? Number.POSITIVE_INFINITY : 0);

  const remote: RemoteSyncApi = {
    async createExpense() {
      throw new Error("이 테스트는 지출을 보내지 않아요.");
    },
    async updateExpense() {
      throw new Error("이 테스트는 지출을 보내지 않아요.");
    },
    async deleteExpense() {
      throw new Error("이 테스트는 지출을 보내지 않아요.");
    },
    async setItemStatus(payload) {
      calls.push(payload);
      if (remaining > 0 && options?.failWith) {
        remaining -= 1;
        throw options.failWith();
      }
    }
  };
  return { remote, calls };
}

async function itemRows(store: OfflineStore): Promise<ItemStatusOutboxRow[]> {
  return store.listItemStatusMutations();
}

/**
 * 라운드 51 C-10 — 준비템 상태 변경이 오프라인 아웃박스를 탄다.
 *
 * 이 파일이 고정하는 것: 큐 스키마의 독립성(지출 계약 무접촉), 마지막 쓰기 승리 병합, 4xx/5xx
 * 분류, 그리고 PRIV-104 세션 정리 포함.
 */
describe("C-10 준비템 상태 큐 · 기록과 병합", () => {
  it("누른 값이 큐에 한 줄로 남는다", async () => {
    const store = createMemoryOfflineStore();
    const row = await recordLocalItemStatus(store, statusPayload());

    expect(row.status).toBe("prepared");
    expect(row.syncState).toBe("pending");
    const rows = await itemRows(store);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ childId: "child-1", itemTemplateId: "item-carseat", itemName: "카시트" });
  });

  it("같은 준비템을 다시 누르면 행이 쌓이지 않고 최신 값으로 대체된다 (마지막 쓰기 승리)", async () => {
    const store = createMemoryOfflineStore();
    const first = await recordLocalItemStatus(store, statusPayload({ status: "interested" }));
    await recordLocalItemStatus(store, statusPayload({ status: "not_needed" }));

    const rows = await itemRows(store);
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe("not_needed");
    // 큐에서의 자리(mutationId·createdAt)는 그대로 -- 다시 누를 때마다 뒤로 밀리면 순서가 역전된다.
    expect(rows[0].mutationId).toBe(first.mutationId);
    expect(rows[0].createdAt).toBe(first.createdAt);
  });

  it("다른 준비템·다른 아이는 서로 독립이다", async () => {
    const store = createMemoryOfflineStore();
    await recordLocalItemStatus(store, statusPayload());
    await recordLocalItemStatus(store, statusPayload({ itemTemplateId: "item-bottle", itemName: "젖병" }));
    await recordLocalItemStatus(store, statusPayload({ childId: "child-2" }));

    expect(await itemRows(store)).toHaveLength(3);
    expect(await store.listItemStatusMutationsForItem("child-1", "item-carseat")).toHaveLength(1);
  });

  it("다시 누르면 실패·백오프 예산이 초기화된다 (새 의사 표시)", () => {
    const failed: ItemStatusOutboxRow = {
      mutationId: "istat-1",
      childId: "child-1",
      itemTemplateId: "item-carseat",
      status: "interested",
      itemName: "카시트",
      syncState: "failed",
      attemptCount: 5,
      nextRetryAt: "2999-01-01T00:00:00.000Z",
      lastError: "권한이 없어요.",
      createdAt: "2026-08-01T00:00:00.000Z",
      updatedAt: "2026-08-01T00:00:00.000Z"
    };
    const merged = mergeItemStatusMutation(failed ? [failed] : [], { ...failed, mutationId: "istat-2", status: "prepared" });

    expect(merged).toHaveLength(1);
    expect(merged[0]).toMatchObject({
      mutationId: "istat-1",
      status: "prepared",
      syncState: "pending",
      attemptCount: 0,
      nextRetryAt: null,
      lastError: null
    });
  });

  /** 지출 H-3와 같은 이유: 보낸 값과 저장된 값이 갈라진 채 응답 성공으로 지워지면 안 된다. */
  it("전송 중인 행에는 접히지 않고 새 행으로 붙는다", () => {
    const inFlight: ItemStatusOutboxRow = {
      mutationId: "istat-inflight",
      childId: "child-1",
      itemTemplateId: "item-carseat",
      status: "interested",
      itemName: "카시트",
      syncState: "syncing",
      attemptCount: 0,
      nextRetryAt: null,
      lastError: null,
      createdAt: "2026-08-01T00:00:00.000Z",
      updatedAt: "2026-08-01T00:00:00.000Z",
      inFlight: true
    };
    const merged = mergeItemStatusMutation([inFlight], { ...inFlight, mutationId: "istat-new", status: "prepared", inFlight: false });

    expect(merged).toHaveLength(2);
    expect(merged[0].mutationId).toBe("istat-inflight");
    expect(merged[1].status).toBe("prepared");
  });
});

describe("C-10 준비템 상태 큐 · 전송", () => {
  it("연결이 되면 큐가 비고, 성공한 행은 남기지 않는다", async () => {
    const store = createMemoryOfflineStore();
    await recordLocalItemStatus(store, statusPayload());
    const { remote, calls } = createFakeRemote();

    const summary = await flushOutbox(store, remote);

    expect(calls).toHaveLength(1);
    expect(calls[0].status).toBe("prepared");
    expect(summary.itemStatusSynced).toBe(1);
    // 지출 칸과 섞이지 않는다 -- 지출 확정에만 붙는 플래시 문구·분석 이벤트가 있다.
    expect(summary.synced).toBe(0);
    expect(await itemRows(store)).toEqual([]);
  });

  it("오프라인이면 큐에 그대로 남아 다음 기회에 다시 나간다 (실패 = 유실이 아니다)", async () => {
    const store = createMemoryOfflineStore();
    await recordLocalItemStatus(store, statusPayload());
    const offline = createFakeRemote({ failWith: () => new TypeError("Network request failed"), failTimes: 1 });

    const first = await flushOutbox(store, offline.remote);
    expect(first.stoppedForNetwork).toBe(true);
    const parked = await itemRows(store);
    expect(parked).toHaveLength(1);
    expect(parked[0].syncState).toBe("pending");
    expect(parked[0].attemptCount).toBe(1);

    // 백오프 창을 지운 뒤 다시 보내면 성공한다.
    await store.updateItemStatusMutation(parked[0].mutationId, { nextRetryAt: null });
    const second = await flushOutbox(store, offline.remote);
    expect(second.itemStatusSynced).toBe(1);
    expect(await itemRows(store)).toEqual([]);
  });

  it("4xx는 자동 재시도를 멈추고 사용자 몫으로 넘긴다 -- 403은 R48 권한 거절 관례를 그대로 탄다", async () => {
    const store = createMemoryOfflineStore();
    await recordLocalItemStatus(store, statusPayload());
    const { remote } = createFakeRemote({
      failWith: () => new RemotePermanentError(403, API_ERROR_MESSAGES.FORBIDDEN)
    });

    const summary = await flushOutbox(store, remote);

    expect(summary.itemStatusFailed).toBe(1);
    const [row] = await itemRows(store);
    expect(row.syncState).toBe("failed");
    // 동기화 상태 화면이 이 행의 "재시도" 자리를 안내로 바꾸는 근거가 된다.
    expect(isPermissionDeniedSyncError(row.lastError)).toBe(true);

    // 'failed' 행은 다음 pass에서 건너뛴다 -- 사용자가 재시도/버리기를 고를 때까지.
    const second = createFakeRemote();
    await flushOutbox(store, second.remote);
    expect(second.calls).toHaveLength(0);
  });

  it("5xx는 자동 재시도하다가 상한에서 실패로 올린다 (한국어 안내로)", async () => {
    const store = createMemoryOfflineStore();
    await recordLocalItemStatus(store, statusPayload());
    const serverError = () => Object.assign(new Error("Item status request failed with status 500"), { status: 500 });

    for (let attempt = 1; attempt < MAX_SERVER_ERROR_ATTEMPTS; attempt += 1) {
      const { remote } = createFakeRemote({ failWith: serverError });
      await flushOutbox(store, remote);
      const [row] = await itemRows(store);
      await store.updateItemStatusMutation(row.mutationId, { nextRetryAt: null });
      expect(row.syncState).toBe("pending");
      expect(row.lastError).toBe(SERVER_TRANSIENT_ERROR_MESSAGE);
    }

    const { remote } = createFakeRemote({ failWith: serverError });
    await flushOutbox(store, remote);
    const [row] = await itemRows(store);
    expect(row.syncState).toBe("failed");
    expect(row.lastError).toBe(SERVER_ERROR_GIVE_UP_MESSAGE);
  });

  it("사용자 재시도는 예산을 되돌리고, 버리기는 행을 지운다", async () => {
    const store = createMemoryOfflineStore();
    await recordLocalItemStatus(store, statusPayload());
    const { remote } = createFakeRemote({ failWith: () => new RemotePermanentError(422, "잘못된 요청이에요.") });
    await flushOutbox(store, remote);

    const [failed] = await itemRows(store);
    await retryFailedItemStatusMutation(store, failed.mutationId);
    const [requeued] = await itemRows(store);
    expect(requeued).toMatchObject({ syncState: "pending", attemptCount: 0, nextRetryAt: null, lastError: null });

    await discardFailedItemStatusMutation(store, requeued.mutationId);
    expect(await itemRows(store)).toEqual([]);
  });

  it("준비템 전송을 모르는 transport에는 큐를 건드리지 않는다 (기존 지출 페이크 호환)", async () => {
    const store = createMemoryOfflineStore();
    await recordLocalItemStatus(store, statusPayload());
    const expenseOnly = {
      async createExpense() {
        return { id: "server-1", version: 1 };
      },
      async updateExpense() {
        return { version: 2 };
      },
      async deleteExpense() {}
    };

    const summary = await flushOutbox(store, expenseOnly);

    expect(summary.itemStatusSynced).toBe(0);
    expect(await itemRows(store)).toHaveLength(1);
  });

  it("지출 pass가 네트워크로 멈추면 준비템도 보내지 않는다 (같은 순간 같은 기기다)", async () => {
    const store = createMemoryOfflineStore();
    await recordLocalCreate(store, expensePayload);
    await recordLocalItemStatus(store, statusPayload());
    const calls: string[] = [];
    const remote: RemoteSyncApi = {
      async createExpense() {
        calls.push("expense");
        throw new TypeError("Network request failed");
      },
      async updateExpense() {
        return { version: 2 };
      },
      async deleteExpense() {},
      async setItemStatus() {
        calls.push("item-status");
      }
    };

    const summary = await flushOutbox(store, remote);

    expect(summary.stoppedForNetwork).toBe(true);
    expect(calls).toEqual(["expense"]);
    expect(await itemRows(store)).toHaveLength(1);
  });
});

/**
 * 라운드 51 QA(P1-1) — pass가 도는 동안 도착한 변경.
 *
 * 한 pass는 시작 시점의 스냅숏만 보고, 단일 비행 가드는 그 사이의 flush 요청을 이미 도는 pass의
 * 약속으로 돌려주기만 했다. 그래서 A를 보내는 중에 누른 B는 아무도 보내지 않은 채 큐에 남아,
 * 온라인인데도 대기 배지가 다음 트리거까지 남고 그 전에 로그아웃하면 wipe가 지운다.
 * 리뷰가 재현한 시나리오(A 전송 중 B 탭) 그대로 고정한다.
 */
describe("라운드 51 QA(P1-1) 전송 중 도착한 준비템 상태 변경", () => {
  /** A를 전송 중으로 붙잡아 두고, 그 사이에 B를 누르는 상황을 만든다. */
  function createBlockingRemote() {
    const calls: string[] = [];
    let releaseFirst!: () => void;
    let markFirstCallSeen!: () => void;
    const firstCallReleased = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    const firstCallSeen = new Promise<void>((resolve) => {
      markFirstCallSeen = resolve;
    });
    const remote: RemoteSyncApi = {
      async createExpense() {
        throw new Error("이 테스트는 지출을 보내지 않아요.");
      },
      async updateExpense() {
        throw new Error("이 테스트는 지출을 보내지 않아요.");
      },
      async deleteExpense() {
        throw new Error("이 테스트는 지출을 보내지 않아요.");
      },
      async setItemStatus(payload) {
        calls.push(payload.itemTemplateId);
        if (calls.length === 1) {
          markFirstCallSeen();
          await firstCallReleased;
        }
      }
    };
    return { remote, calls, firstCallSeen, releaseFirst };
  }

  it("A 전송 중에 누른 B는 그 pass가 끝난 뒤 같은 호출 안에서 이어서 나간다", async () => {
    const store = createMemoryOfflineStore();
    await recordLocalItemStatus(store, statusPayload());
    const { remote, calls, firstCallSeen, releaseFirst } = createBlockingRemote();

    const flush = flushOutbox(store, remote);
    await firstCallSeen;

    // 화면 저장 경로가 하는 그대로: 로컬 큐에 남기고 곧바로 flush를 한 번 요청한다.
    await recordLocalItemStatus(
      store,
      statusPayload({ itemTemplateId: "item-bottle", itemName: "젖병", status: "interested" })
    );
    const secondRequest = flushOutbox(store, remote);
    // 단일 비행 가드는 그대로다 -- 두 번째 요청은 새 pass를 열지 않고 같은 약속을 받는다.
    expect(secondRequest).toBe(flush);

    releaseFirst();
    const summary = await flush;

    // 고치기 전에는 ["item-carseat"]에서 멈췄고, 젖병은 큐에 남은 채 대기 배지만 남았다.
    expect(calls).toEqual(["item-carseat", "item-bottle"]);
    expect(summary.itemStatusSynced).toBe(2);
    expect(await itemRows(store)).toEqual([]);
  });

  it("아무도 다시 요청하지 않았으면 다시 돌지 않는다 (pass는 여전히 한 번이다)", async () => {
    const store = createMemoryOfflineStore();
    await recordLocalItemStatus(store, statusPayload());
    const { remote, calls, firstCallSeen, releaseFirst } = createBlockingRemote();

    const flush = flushOutbox(store, remote);
    await firstCallSeen;
    // 큐에는 들어갔지만 flush 요청은 하지 않았다(예: 다른 코드가 저장소에만 쓴 경우).
    await recordLocalItemStatus(store, statusPayload({ itemTemplateId: "item-bottle", itemName: "젖병" }));
    releaseFirst();
    await flush;

    expect(calls).toEqual(["item-carseat"]);
    expect(await itemRows(store)).toHaveLength(1);
  });

  it("계속 누르는 동안에도 한 호출이 영원히 돌지 않는다 (재실행 상한)", async () => {
    const store = createMemoryOfflineStore();
    await recordLocalItemStatus(store, statusPayload({ itemTemplateId: "item-0", itemName: "0번" }));
    const calls: string[] = [];
    let next = 1;
    const remote: RemoteSyncApi = {
      async createExpense() {
        throw new Error("이 테스트는 지출을 보내지 않아요.");
      },
      async updateExpense() {
        throw new Error("이 테스트는 지출을 보내지 않아요.");
      },
      async deleteExpense() {
        throw new Error("이 테스트는 지출을 보내지 않아요.");
      },
      async setItemStatus(payload) {
        calls.push(payload.itemTemplateId);
        // 전송이 나가 있는 매 순간 사용자가 또 누른다 -- 새 행 + 그 저장 경로의 flush 요청.
        await recordLocalItemStatus(store, statusPayload({ itemTemplateId: `item-${next}`, itemName: `${next}번` }));
        next += 1;
        void flushOutbox(store, remote);
      }
    };

    const summary = await flushOutbox(store, remote);

    expect(calls).toHaveLength(1 + MAX_FLUSH_RERUNS);
    expect(summary.itemStatusSynced).toBe(1 + MAX_FLUSH_RERUNS);
    // 마지막에 눌린 한 줄은 큐에 남아 다음 트리거(재연결·포그라운드·다음 저장)가 가져간다.
    expect(await itemRows(store)).toHaveLength(1);
  });

  it("오프라인으로 멈춘 pass 뒤에는 재실행하지 않는다 (같은 순간 같은 기기다)", async () => {
    const store = createMemoryOfflineStore();
    await recordLocalItemStatus(store, statusPayload());
    const calls: string[] = [];
    let markFirstCallSeen!: () => void;
    const firstCallSeen = new Promise<void>((resolve) => {
      markFirstCallSeen = resolve;
    });
    let releaseFirst!: () => void;
    const firstCallReleased = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    const remote: RemoteSyncApi = {
      async createExpense() {
        throw new Error("이 테스트는 지출을 보내지 않아요.");
      },
      async updateExpense() {
        throw new Error("이 테스트는 지출을 보내지 않아요.");
      },
      async deleteExpense() {
        throw new Error("이 테스트는 지출을 보내지 않아요.");
      },
      async setItemStatus(payload) {
        calls.push(payload.itemTemplateId);
        markFirstCallSeen();
        await firstCallReleased;
        throw new TypeError("Network request failed");
      }
    };

    const flush = flushOutbox(store, remote);
    await firstCallSeen;
    await recordLocalItemStatus(store, statusPayload({ itemTemplateId: "item-bottle", itemName: "젖병" }));
    void flushOutbox(store, remote);
    releaseFirst();
    const summary = await flush;

    expect(summary.stoppedForNetwork).toBe(true);
    // 헛된 재시도로 백오프만 올리지 않는다 -- 두 줄 모두 큐에 남아 다음 트리거를 기다린다.
    expect(calls).toEqual(["item-carseat"]);
    expect(await itemRows(store)).toHaveLength(2);
  });
});

describe("C-10 저장 계층 계약", () => {
  it("PRIV-104: clearAll이 준비템 큐도 함께 비운다", async () => {
    const store = createMemoryOfflineStore();
    await recordLocalCreate(store, expensePayload);
    await recordLocalItemStatus(store, statusPayload());

    await store.clearAll();

    expect(await store.listLocalExpenses()).toEqual([]);
    expect(await store.listOutboxMutations()).toEqual([]);
    expect(await itemRows(store)).toEqual([]);
  });

  /**
   * vitest는 expo-sqlite의 네이티브 바인딩을 열 수 없으므로 스키마 문자열은 소스 대조로 고정한다
   * (sqlite-offline-store.ts 헤더의 관례). 라운드 57 #7부터 그 스키마가 **실제로** 구 기기에서
   * 안전하게 올라가는지는 sqlite-migrations.test.ts가 node 내장 SQLite로 따로 검증한다.
   */
  it("SQLite 스키마는 순수 추가 변경이고, 세션 정리 트랜잭션에 합류한다", () => {
    const sqlite = source("src/offline/sqlite-offline-store.ts");
    expect(sqlite).toContain("CREATE TABLE IF NOT EXISTS item_status_outbox");
    // 기존 테이블의 데이터를 손대지 않는다 = 기기에 쌓인 지출 대기분이 업데이트로 사라지지 않는다.
    expect(sqlite).not.toContain("DROP TABLE");
    /*
     * 라운드 57 #7/#8: 이 자리는 원래 `not.toContain("ALTER TABLE mutation_outbox")`였다. 당시 C-10이
     * 지키려던 것은 "기존 테이블을 건드리지 않는다"는 수단이 아니라 **"이 업데이트로 기기에 쌓인
     * 대기분이 사라지지 않는다"는 결과**였고, 컬럼을 더할 방법 자체가 없어서(마이그레이션 장치
     * 부재 — 정찰 노트 #7) 수단 쪽을 못 박아 두었던 것이다. 이제 장치가 생겼으므로 계약을 결과로
     * 되돌린다: ALTER는 허용하되 **ADD COLUMN만** 허용한다. DROP/RENAME COLUMN은 기존 행의 값을
     * 실제로 잃는 변경이라 여전히 금지다.
     */
    for (const clause of sqlite.match(/ALTER TABLE [a-z_]+ [A-Z]+ [A-Z]+/g) ?? []) {
      expect(clause).toContain("ADD COLUMN");
    }
    expect(sqlite).not.toContain("DROP COLUMN");
    expect(sqlite).not.toContain("RENAME");
    const clearAllBody = sqlite.slice(sqlite.indexOf("async clearAll()"));
    const transactionBlock = clearAllBody.slice(0, clearAllBody.indexOf("COMMIT;"));
    expect(transactionBlock).toContain("DELETE FROM local_expenses;");
    expect(transactionBlock).toContain("DELETE FROM mutation_outbox;");
    expect(transactionBlock).toContain("DELETE FROM item_status_outbox;");
  });

  it("지출 계약은 한 글자도 넓히지 않았다 (SyncState CHECK-IN 집합·MutationOperation 그대로)", () => {
    const types = source("src/offline/types.ts");
    expect(types).toContain('export type SyncState = "pending" | "syncing" | "synced" | "failed" | "conflict";');
    expect(types).toContain('export type MutationOperation = "create" | "update" | "delete";');
    // 준비템 큐는 자기 상태 집합을 따로 쓴다(충돌·synced 없음).
    expect(types).toContain('export type ItemStatusSyncState = "pending" | "syncing" | "failed";');
    const sqlite = source("src/offline/sqlite-offline-store.ts");
    expect(sqlite).toContain("sync_state TEXT NOT NULL CHECK (sync_state IN ('pending','syncing','synced','failed','conflict'))");
    expect(sqlite).toContain("sync_state TEXT NOT NULL CHECK (sync_state IN ('pending','syncing','failed'))");
  });
});

describe("C-10 동기화 상태 화면 배선", () => {
  const screen = source("app/sync-status.tsx");

  it("준비템 행을 대기/실패 섹션에 함께 그리되 종류를 배지로 구분한다", () => {
    expect(screen).toContain("ItemStatusSyncRow");
    expect(screen).toContain('<StatusBadge label="준비템" />');
    // 값 렌더는 목록·상세와 같은 상태 이름을 쓴다(conflict-display 관례: 화면마다 다른 말 금지).
    expect(screen).toContain("itemStatusLabel(row.status)");
  });

  it("충돌 갈래는 만들지 않는다 (상태에는 버전 충돌이 없다)", () => {
    expect(screen).not.toContain("item-status-conflict");
  });

  it("행 액션은 컨트롤러를 지난다 (엔진 직접 호출 금지)", () => {
    expect(screen).toContain("retryOfflineItemStatus(");
    expect(screen).toContain("discardOfflineItemStatus(");
    expect(screen).not.toContain("retryFailedItemStatusMutation");
    expect(screen).not.toContain("discardFailedItemStatusMutation");
  });

  it("일괄 액션(전체 재시도/버리기)은 지출 큐만 다룬다 -- 라벨이 말하지 않은 큐를 삼키지 않는다", () => {
    const controller = source("src/offline/sync-controller.ts");
    const retryAllBody = controller.slice(
      controller.indexOf("export async function retryAllOfflineMutations"),
      controller.indexOf("/** SYNC-127 \"전체 버리기\"")
    );
    expect(retryAllBody).not.toContain("ItemStatus");
  });
});
