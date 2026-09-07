import { beforeEach, describe, expect, it } from "vitest";
import { RemotePermanentError } from "./errors";
import { createMemoryOfflineStore } from "./memory-offline-store";
import { isRetryableSyncFailureRow } from "./permission-denied";
import {
  flushOutbox,
  MAX_SERVER_ERROR_ATTEMPTS,
  recordLocalCreate,
  recordLocalItemStatus,
  requeueRetryableClientErrorMutations,
  retryableClientErrorSyncMessage,
  SERVER_ERROR_GIVE_UP_MESSAGE,
  type RemoteSyncApi
} from "./sync-engine";
import type { ExpensePayload, ItemStatusPayload, OfflineStore } from "./types";

/**
 * 라운드 104 B-2·B-3 — **재시도 가능 4xx(401·408·429)의 자동 회복.**
 *
 * ## 종전에 어긋나 있던 두 판정
 *
 * 엔진은 4xx를 하나도 빠짐없이 permanent로 봤고(remote-api.ts가 `status < 500`이면
 * `RemotePermanentError`로 번역한다), 그 갈래는 행을 'failed'로 파킹한 뒤 `break`가 아니라
 * `continue`로 다음 행을 이어 보냈다. 반면 화면의 판정(`isRetryableSyncError` —
 * permission-denied.ts)은 401·408·429를 **재시도 가능**이라고 답한다. 같은 실패에 두 벌이
 * 정반대를 말했고, 그 어긋남이 둘을 만들었다.
 *
 *  - **B-2**: 세션 만료 401 한 번이 **한 pass에서 큐 전량**을 'failed'로 태웠다. 'failed' 행은
 *    flush가 건너뛰고 failed→pending 자동 복구 경로는 저장소 전체에 0건이라, 같은 계정으로 다시
 *    로그인해도 그 행들은 영영 올라가지 않았다 — `session-expiry.ts`가 약속한
 *    *"Unsynced records survive the expiry"* 가 "행이 남는다"까지만 참이었다.
 *  - **B-3**: 429·408도 같은 자리에서 자동 재시도를 잃었다. 전역 한도 창은 60초인데
 *    (서버 rate-limit.middleware.ts — IP당 300req/60초) 행은 영구 파킹됐다.
 *
 * ## 이 파일이 무는 것
 *
 * 엔진이 그 셋을 transient로 보낸다는 것, 그 판정이 화면과 **같은 함수 하나**에서 나온다는 것,
 * 그리고 세션이 다시 서면 큐가 **실제로 다시 올라간다**는 것을 값으로 문다.
 *
 * 모킹은 이 디렉터리의 관례 그대로다(메모리 스토어 + 파일 내 가짜 remote —
 * server-error-escape.test.ts / sync-edge-cases.test.ts).
 */

const payload: ExpensePayload = {
  childId: "child-1",
  categoryId: "cat-diaper",
  amountKrw: 10_000,
  spentOn: "2026-09-01",
  itemName: "기저귀"
};

const itemStatus: ItemStatusPayload = {
  childId: "child-1",
  itemTemplateId: "tpl-bottle",
  status: "prepared",
  itemName: "젖병"
};

/** ExpenseHttpError와 같은 관찰 가능한 모양(숫자 status를 든 Error) — 5xx·네트워크 대조용. */
function serverError(status = 500): Error & { status: number } {
  const error = new Error(`Expense request failed with status ${status}`) as Error & { status: number };
  error.name = "ExpenseHttpError";
  error.status = status;
  return error;
}

/**
 * 실패를 지정할 수 있는 가짜 transport. `failWith`가 undefined를 돌려주면 정상 처리한다 —
 * "세션이 다시 섰다"를 그 한 줄로 표현한다.
 */
function createRemote(failWith: () => unknown) {
  const createdItemNames: string[] = [];
  const itemStatusSent: string[] = [];
  let nextId = 0;
  const remote: RemoteSyncApi = {
    async createExpense(createPayload) {
      createdItemNames.push(createPayload.itemName);
      const error = failWith();
      if (error) throw error;
      nextId += 1;
      return { id: `server-${nextId}`, version: 1 };
    },
    async updateExpense(_canonicalId, _updatePayload, expectedVersion) {
      const error = failWith();
      if (error) throw error;
      return { version: expectedVersion + 1 };
    },
    async deleteExpense() {
      const error = failWith();
      if (error) throw error;
    },
    async setItemStatus(statusPayload) {
      itemStatusSent.push(statusPayload.itemTemplateId);
      const error = failWith();
      if (error) throw error;
    }
  };
  return { remote, createdItemNames, itemStatusSent };
}

/** 백오프 창을 비워 다음 pass가 곧바로 다시 보내게 한다(server-error-escape.test.ts와 같은 관례). */
async function rearm(store: OfflineStore): Promise<void> {
  for (const mutation of await store.listOutboxMutations()) {
    await store.updateOutboxMutation(mutation.mutationId, { nextRetryAt: null });
  }
}

describe("라운드 104 B-2: 세션 만료 401이 큐를 태우지 않고, 재로그인하면 실제로 다시 올라간다", () => {
  let store: OfflineStore;

  /** 오프라인 여행 중 기록해 둔 지출 셋(큐 순서대로). */
  async function seedThreeQueuedExpenses() {
    await recordLocalCreate(store, { ...payload, itemName: "첫번째" }, "2026-09-01T00:00:00.000Z");
    await recordLocalCreate(store, { ...payload, itemName: "두번째" }, "2026-09-01T00:00:01.000Z");
    await recordLocalCreate(store, { ...payload, itemName: "세번째" }, "2026-09-01T00:00:02.000Z");
  }

  beforeEach(() => {
    store = createMemoryOfflineStore();
  });

  it("401 한 번에 큐 전량이 타지 않는다 — 첫 행만 시도하고 pass가 멈추며, 셋 다 대기로 남는다", async () => {
    await seedThreeQueuedExpenses();
    const { remote, createdItemNames } = createRemote(() => new RemotePermanentError(401, "로그인이 필요해요."));

    const summary = await flushOutbox(store, remote);

    // 종전에는 이 pass가 셋을 전부 보내고 셋 다 'failed'로 태웠다(그 갈래가 `continue`였다).
    expect(createdItemNames, "첫 행에서 멈춘다").toEqual(["첫번째"]);
    expect(summary.failed).toBe(0);
    expect(summary.stoppedForNetwork).toBe(true);

    const rows = await store.listLocalExpenses();
    expect(rows.map((row) => row.syncState), "'failed'로 굳은 행이 0건이다").toEqual([
      "pending",
      "pending",
      "pending"
    ]);
    // 그리고 문장이 지금 무슨 일이 일어나는지 말한다(막다른 "요청을 처리하지 못했어요."가 아니다).
    const head = rows.find((row) => row.payload.itemName === "첫번째");
    expect(head?.lastError).toBe(retryableClientErrorSyncMessage(401, "retrying"));
    expect(head?.lastErrorStatus).toBe(401);
    // 뒤의 둘은 시도조차 되지 않았다 — 시도 예산도 실패 사유도 손대지 않은 채다.
    const queued = await store.listOutboxMutations();
    expect(queued.map((mutation) => mutation.attemptCount)).toEqual([1, 0, 0]);
    expect(queued.slice(1).every((mutation) => mutation.lastError === null)).toBe(true);
  });

  it("재로그인 후 첫 pass에서 큐가 통째로 올라간다 (session-expiry.ts의 약속이 값으로 참이 된다)", async () => {
    await seedThreeQueuedExpenses();
    let sessionAlive = false;
    const { remote, createdItemNames } = createRemote(() =>
      sessionAlive ? undefined : new RemotePermanentError(401, "로그인이 필요해요.")
    );

    await flushOutbox(store, remote);
    expect((await store.listLocalExpenses()).every((row) => row.syncState === "pending")).toBe(true);

    // ── 재로그인: 토큰이 다시 서면 컨트롤러가 부팅 경로를 다시 탄다
    //    (sync-controller.ts recoverAndFlushOnStart — 되돌리기 → 스냅샷 → flush) ──
    sessionAlive = true;
    const requeued = await requeueRetryableClientErrorMutations(store);
    // 백오프 창에 갇혀 있던 큐 맨 앞 행 하나가 풀린다(뒤 둘은 애초에 시도조차 되지 않았다).
    expect(requeued).toBe(1);

    await flushOutbox(store, remote);

    expect(createdItemNames, "큐 순서 그대로 셋이 전부 나갔다").toEqual([
      "첫번째",
      "첫번째",
      "두번째",
      "세번째"
    ]);
    const rows = await store.listLocalExpenses();
    expect(rows.map((row) => row.syncState)).toEqual(["synced", "synced", "synced"]);
    expect(rows.every((row) => row.lastError === null)).toBe(true);
    expect(await store.listOutboxMutations(), "큐가 비었다").toHaveLength(0);
  });

  it("이 수정 이전에 401로 굳어 기기에 남아 있는 'failed' 행도 세션이 서면 되살아난다", async () => {
    const created = await recordLocalCreate(store, payload, "2026-09-01T00:00:00.000Z");
    // 종전 엔진이 남긴 그대로의 행: 'failed' + 401.
    await store.updateLocalExpense(created.localId, {
      syncState: "failed",
      lastError: "요청을 처리하지 못했어요.",
      lastErrorStatus: 401,
      lastErrorCode: "UNAUTHORIZED"
    });
    const [queued] = await store.listOutboxMutationsForLocalId(created.localId);
    await store.updateOutboxMutation(queued.mutationId, { attemptCount: 1, lastErrorStatus: 401 });

    const { remote, createdItemNames } = createRemote(() => undefined);
    // 되살리기가 없으면 flush는 'failed' 행을 건너뛴다 — 그것이 종전의 끝이었다.
    await flushOutbox(store, remote);
    expect(createdItemNames).toEqual([]);

    expect(await requeueRetryableClientErrorMutations(store)).toBe(1);
    await flushOutbox(store, remote);

    expect(createdItemNames).toEqual(["기저귀"]);
    const row = await store.getLocalExpense(created.localId);
    expect(row?.syncState).toBe("synced");
    expect(row?.lastErrorStatus).toBeNull();
  });

  it("되살리는 대상은 재시도 가능 4xx뿐이다 — 400·403과 상한에 닿은 5xx 행은 손대지 않는다", async () => {
    const cases: ReadonlyArray<{ readonly itemName: string; readonly status: number; readonly revived: boolean }> = [
      { itemName: "만료-401", status: 401, revived: true },
      { itemName: "한도-429", status: 429, revived: true },
      { itemName: "시간초과-408", status: 408, revived: true },
      { itemName: "검증거부-400", status: 400, revived: false },
      { itemName: "권한없음-403", status: 403, revived: false },
      { itemName: "서버오류-500", status: 500, revived: false }
    ];
    for (const entry of cases) {
      const created = await recordLocalCreate(store, { ...payload, itemName: entry.itemName });
      await store.updateLocalExpense(created.localId, {
        syncState: "failed",
        lastError: "실패",
        lastErrorStatus: entry.status
      });
    }

    const requeued = await requeueRetryableClientErrorMutations(store);
    expect(requeued).toBe(cases.filter((entry) => entry.revived).length);

    const byName = new Map((await store.listLocalExpenses()).map((row) => [row.payload.itemName, row]));
    for (const entry of cases) {
      expect(byName.get(entry.itemName)?.syncState, `${entry.itemName}(${entry.status})`).toBe(
        entry.revived ? "pending" : "failed"
      );
    }
    // 5xx가 밖인 이유는 그 상한이 **의도된 탈출구**이기 때문이다(MAX_SERVER_ERROR_ATTEMPTS 머리말) —
    // 앱을 켤 때마다 자동으로 풀어 주면 그 탈출구가 사라진다.
    expect(byName.get("서버오류-500")?.lastError).toBe("실패");
  });

  it("준비템 상태 큐도 같은 규칙을 받는다 — 401에 'failed'로 굳지 않고, 세션이 서면 다시 나간다", async () => {
    await recordLocalItemStatus(store, itemStatus, "2026-09-01T00:00:00.000Z");
    let sessionAlive = false;
    const { remote, itemStatusSent } = createRemote(() =>
      sessionAlive ? undefined : new RemotePermanentError(401, "로그인이 필요해요.")
    );

    await flushOutbox(store, remote);
    const [afterExpiry] = await store.listItemStatusMutations();
    expect(afterExpiry.syncState, "'failed'로 굳지 않는다").toBe("pending");
    expect(afterExpiry.lastErrorStatus).toBe(401);

    sessionAlive = true;
    expect(await requeueRetryableClientErrorMutations(store)).toBe(1);
    await flushOutbox(store, remote);

    expect(itemStatusSent).toEqual(["tpl-bottle", "tpl-bottle"]);
    expect(await store.listItemStatusMutations(), "성공한 행은 남기지 않는다").toHaveLength(0);
  });

  it("살아 있는 flush pass 중에는 아무것도 되돌리지 않는다 (recoverInterruptedSyncState와 같은 가드)", async () => {
    const created = await recordLocalCreate(store, payload);
    await store.updateLocalExpense(created.localId, { syncState: "failed", lastError: "실패", lastErrorStatus: 401 });

    let release: (() => void) | null = null;
    const blocked = new Promise<void>((resolve) => {
      release = resolve;
    });
    const remote: RemoteSyncApi = {
      async createExpense() {
        await blocked;
        return { id: "server-1", version: 1 };
      },
      async updateExpense(_canonicalId, _updatePayload, expectedVersion) {
        return { version: expectedVersion + 1 };
      },
      async deleteExpense() {
        /* noop */
      }
    };

    const other = await recordLocalCreate(store, { ...payload, itemName: "전송중" });
    const flushing = flushOutbox(store, remote);
    expect(await requeueRetryableClientErrorMutations(store)).toBe(0);
    expect((await store.getLocalExpense(created.localId))?.syncState).toBe("failed");

    release!();
    await flushing;
    expect((await store.getLocalExpense(other.localId))?.syncState).toBe("synced");
  });
});

describe("라운드 104 B-3: 429·408은 자동 재시도로 돌아오고, 상한은 5xx와 같은 것을 쓴다", () => {
  let store: OfflineStore;

  beforeEach(() => {
    store = createMemoryOfflineStore();
  });

  it("429는 백오프 대기로 남고 한도 창이 열리면 스스로 올라간다 (사용자가 누르지 않아도 된다)", async () => {
    await recordLocalCreate(store, payload, "2026-09-01T00:00:00.000Z");
    let limited = true;
    const { remote, createdItemNames } = createRemote(() =>
      limited ? new RemotePermanentError(429, "요청이 너무 많아요. 잠시 후 다시 시도해 주세요.") : undefined
    );

    await flushOutbox(store, remote);
    const [parked] = await store.listLocalExpenses();
    expect(parked.syncState, "종전에는 여기서 'failed'로 영구 파킹됐다").toBe("pending");
    expect(parked.lastError).toBe(retryableClientErrorSyncMessage(429, "retrying"));
    const [mutation] = await store.listOutboxMutations();
    expect(mutation.attemptCount).toBe(1);
    expect(mutation.nextRetryAt, "백오프 창을 받는다").not.toBeNull();

    // 한도 창(60초)이 열린 뒤의 다음 pass — 사용자의 손이 닿지 않는다.
    limited = false;
    await rearm(store);
    await flushOutbox(store, remote);

    expect(createdItemNames).toEqual(["기저귀", "기저귀"]);
    expect((await store.listLocalExpenses())[0].syncState).toBe("synced");
  });

  it(`끝나지 않는 429는 5xx와 같은 상한(${MAX_SERVER_ERROR_ATTEMPTS}회)에서 'failed'로 승격돼 사용자 몫이 된다`, async () => {
    await recordLocalCreate(store, payload, "2026-09-01T00:00:00.000Z");
    const { remote } = createRemote(() => new RemotePermanentError(429, "요청이 너무 많아요."));

    for (let attempt = 0; attempt < MAX_SERVER_ERROR_ATTEMPTS; attempt += 1) {
      await rearm(store);
      await flushOutbox(store, remote);
    }

    const [row] = await store.listLocalExpenses();
    expect(row.syncState).toBe("failed");
    expect(row.lastErrorStatus).toBe(429);
    // 상한의 문장은 5xx의 것과 갈린다 — "서버 오류가 계속돼"는 429에 대해 거짓이다.
    expect(row.lastError).toBe(retryableClientErrorSyncMessage(429, "gave-up"));
    expect(row.lastError).not.toBe(SERVER_ERROR_GIVE_UP_MESSAGE);
    // 그리고 그 행에는 재시도 버튼이 남는다(화면 판정이 429를 재시도 가능으로 읽는다).
    expect(isRetryableSyncFailureRow(row)).toBe(true);
  });

  it("엔진의 분류와 화면의 판정이 같은 답을 낸다 — 그 어긋남이 B-1·B-2·B-3의 공통 뿌리였다", async () => {
    const statuses = [401, 408, 429, 400, 403, 404, 422] as const;
    const engineVerdict: Record<number, string> = {};
    const screenVerdict: Record<number, boolean> = {};

    for (const status of statuses) {
      const scopedStore = createMemoryOfflineStore();
      await recordLocalCreate(scopedStore, { ...payload, itemName: `상태-${status}` });
      const { remote } = createRemote(() => new RemotePermanentError(status, "실패"));
      await flushOutbox(scopedStore, remote);
      const [row] = await scopedStore.listLocalExpenses();
      engineVerdict[status] = row.syncState;
      screenVerdict[status] = isRetryableSyncFailureRow(row);
    }

    // 엔진이 자동 재시도를 남긴 행('pending')과 화면이 "다시 보내면 통할 수 있다"고 답하는 행이
    // 정확히 같은 집합이다.
    expect(engineVerdict).toEqual({ 401: "pending", 408: "pending", 429: "pending", 400: "failed", 403: "failed", 404: "failed", 422: "failed" });
    expect(screenVerdict).toEqual({ 401: true, 408: true, 429: true, 400: false, 403: false, 404: false, 422: false });
    for (const status of statuses) {
      expect(engineVerdict[status] === "pending", `status ${status}`).toBe(screenVerdict[status]);
    }
  });

  it("5xx·네트워크의 종전 동작은 한 글자도 바뀌지 않았다 (부정 단언)", async () => {
    const scopedStore = createMemoryOfflineStore();
    await recordLocalCreate(scopedStore, payload);
    const { remote } = createRemote(() => serverError(503));
    await flushOutbox(scopedStore, remote);
    const [afterServerError] = await scopedStore.listLocalExpenses();
    expect(afterServerError.syncState).toBe("pending");
    expect(afterServerError.lastErrorStatus).toBe(503);

    const networkStore = createMemoryOfflineStore();
    await recordLocalCreate(networkStore, payload);
    const { remote: offline } = createRemote(() => new TypeError("Network request failed"));
    await flushOutbox(networkStore, offline);
    const [afterNetwork] = await networkStore.listLocalExpenses();
    expect(afterNetwork.syncState).toBe("pending");
    expect(afterNetwork.lastError).toBe("Network request failed");
    expect(afterNetwork.lastErrorStatus).toBeNull();
  });
});

describe("라운드 104 B-2·B-3 문구 — 지금 무슨 일이 일어나는지 말하고 사용자를 탓하지 않는다 (DNC-018)", () => {
  it("401은 다음에 할 일 하나(다시 로그인)를 말하고, 그 밖은 자동 재시도를 말한다", () => {
    expect(retryableClientErrorSyncMessage(401, "retrying")).toBe(
      "로그인이 풀려서 아직 못 보냈어요. 다시 로그인하면 이어서 보낼게요."
    );
    expect(retryableClientErrorSyncMessage(429, "retrying")).toBe("지금은 보낼 수 없어 잠시 뒤 자동으로 다시 시도해요.");
    expect(retryableClientErrorSyncMessage(408, "retrying")).toBe(retryableClientErrorSyncMessage(429, "retrying"));
  });

  it("상한에 닿으면 문장이 갈린다 — '자동으로 다시 시도해요'가 남아 있으면 그 자체가 거짓이다", () => {
    for (const status of [401, 408, 429]) {
      const retrying = retryableClientErrorSyncMessage(status, "retrying");
      const gaveUp = retryableClientErrorSyncMessage(status, "gave-up");
      expect(gaveUp).not.toBe(retrying);
      expect(gaveUp).not.toContain("자동으로 다시 시도해요");
      // 네 문장 모두 해요체이고, 남은 행동을 말한다(막다른 문장이 아니다).
      for (const sentence of [retrying, gaveUp]) {
        expect(sentence.endsWith("요.")).toBe(true);
        expect(sentence).toMatch(/로그인|시도|삭제/);
      }
    }
  });
});
