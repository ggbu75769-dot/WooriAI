import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { computeBackoffDelayMs } from "./backoff";
import { createMemoryOfflineStore } from "./memory-offline-store";
import {
  flushOutbox,
  MAX_SERVER_ERROR_ATTEMPTS,
  recordLocalCreate,
  retryFailedMutation,
  SERVER_ERROR_GIVE_UP_MESSAGE,
  SERVER_TRANSIENT_ERROR_MESSAGE,
  type RemoteExpenseApi
} from "./sync-engine";
import type { ExpensePayload, OfflineStore } from "./types";

/**
 * FIX-119B/F2·F3 (R19 M-1) — 결정적 5xx의 head-of-line 블로킹 탈출구.
 *
 * R19-H로 5xx는 transient가 됐다(행은 'pending' 유지 + 백오프 자동 재시도). 그런데 시도 상한이
 * 없어서, 특정 mutation에만 결정적으로 5xx가 나면 그 행이 큐 맨 앞에서 영원히 재시도되고
 * flushOutboxPass가 transient에서 pass를 break 하므로 뒤의 지출이 전부 영구히 막혔다. 'pending'
 * 행에는 재시도/삭제 UI도 없다(app/sync-status.tsx는 'failed'에만 그린다).
 *
 * 모킹: sync-engine.test.ts / sync-edge-cases.test.ts와 같은 관례 -- 메모리 스토어 + 파일 내
 * 가짜 remote. 5xx는 실제 어댑터가 던지는 것과 같은 모양(숫자 `status` 필드를 가진 Error)으로
 * 만든다(remote-api.ts는 5xx에서 client.ts의 ExpenseHttpError를 원본 그대로 재던진다).
 */

const payload: ExpensePayload = {
  childId: "child-1",
  categoryId: "cat-diaper",
  amountKrw: 10_000,
  spentOn: "2026-08-01",
  itemName: "기저귀"
};

/** ExpenseHttpError와 같은 관찰 가능한 모양: 영문 message + 숫자 status. */
function serverError(status = 500): Error & { status: number } {
  const error = new Error(`Expense request failed with status ${status}`) as Error & { status: number };
  error.name = "ExpenseHttpError";
  error.status = status;
  return error;
}

function networkError() {
  return new TypeError("Network request failed");
}

/** 아이템별로 실패 동작을 지정할 수 있는 가짜 remote. */
function createRemote(failCreateFor: (itemName: string) => Error | undefined) {
  const sent: string[] = [];
  let nextId = 0;
  const remote: RemoteExpenseApi = {
    async createExpense(createPayload) {
      sent.push(createPayload.itemName);
      const error = failCreateFor(createPayload.itemName);
      if (error) throw error;
      nextId += 1;
      return { id: `server-${nextId}`, version: 1 };
    },
    async updateExpense(_canonicalId, _payload, expectedVersion) {
      return { version: expectedVersion + 1 };
    },
    async deleteExpense() {
      /* noop */
    }
  };
  return { remote, sent };
}

/** 백오프 창을 비워 다음 pass가 곧바로 다시 보내게 한다(§6 sync-edge-cases.test.ts와 같은 관례). */
async function rearm(store: OfflineStore): Promise<void> {
  for (const mutation of await store.listOutboxMutations()) {
    await store.updateOutboxMutation(mutation.mutationId, { nextRetryAt: null });
  }
}

describe("FIX-119B/F2: 결정적 5xx는 시도 상한에서 'failed'로 승격돼 큐를 놓아준다", () => {
  it(`연속 5xx ${MAX_SERVER_ERROR_ATTEMPTS}회 -> 'failed' 승격, 그 pass에서 곧바로 뒤의 기록이 진행된다`, async () => {
    const store = createMemoryOfflineStore();
    // 큐 맨 앞이 결정적 5xx를 내는 "독성" 기록, 그 뒤에 멀쩡한 기록 둘.
    await recordLocalCreate(store, { ...payload, itemName: "독성" }, "2026-08-01T00:00:00.000Z");
    await recordLocalCreate(store, { ...payload, itemName: "정상 1" }, "2026-08-01T00:00:01.000Z");
    await recordLocalCreate(store, { ...payload, itemName: "정상 2" }, "2026-08-01T00:00:02.000Z");
    const { remote, sent } = createRemote((itemName) => (itemName === "독성" ? serverError(500) : undefined));

    // 상한 직전까지: 매 pass가 맨 앞에서 막히고 뒤의 둘은 한 번도 전송되지 않는다(= head-of-line).
    for (let attempt = 1; attempt < MAX_SERVER_ERROR_ATTEMPTS; attempt += 1) {
      const summary = await flushOutbox(store, remote);
      expect(summary).toEqual({ synced: 0, failed: 0, conflicted: 0, stoppedForNetwork: true });
      expect(sent).toEqual(Array.from({ length: attempt }, () => "독성"));

      const [blocking] = await store.listOutboxMutations();
      expect(blocking.attemptCount).toBe(attempt);
      // 기존 백오프 계약 불변: 상한 전까지는 같은 지수 백오프 창을 그대로 쓴다.
      const delayMs = new Date(blocking.nextRetryAt!).getTime() - Date.now();
      expect(delayMs).toBeGreaterThan(0);
      expect(delayMs).toBeLessThanOrEqual(computeBackoffDelayMs(attempt));
      const row = (await store.getLocalExpense(blocking.targetLocalId))!;
      expect(row.syncState).toBe("pending");
      expect(row.lastError).toBe(SERVER_TRANSIENT_ERROR_MESSAGE);
      await rearm(store);
    }

    // 상한 도달 pass: 독성 행만 'failed'로 승격되고, 같은 pass가 뒤의 둘을 이어서 보낸다.
    const escapeSummary = await flushOutbox(store, remote);
    expect(escapeSummary).toEqual({ synced: 2, failed: 1, conflicted: 0, stoppedForNetwork: false });
    expect(sent).toEqual([
      ...Array.from({ length: MAX_SERVER_ERROR_ATTEMPTS }, () => "독성"),
      "정상 1",
      "정상 2"
    ]);

    const rows = await store.listLocalExpenses();
    const poisoned = rows.find((row) => row.payload.itemName === "독성")!;
    expect(poisoned.syncState).toBe("failed");
    // F3: 사용자에게 보이는 문구는 영문 HTTP 메시지가 아니라 한국어 안내다.
    expect(poisoned.lastError).toBe(SERVER_ERROR_GIVE_UP_MESSAGE);
    expect(poisoned.lastError).not.toContain("status");
    for (const itemName of ["정상 1", "정상 2"]) {
      expect(rows.find((row) => row.payload.itemName === itemName)!.syncState).toBe("synced");
    }
  });

  it("승격 이후의 자동 flush는 그 행을 건드리지 않고, 사용자의 '재시도'가 정상 탈출구다", async () => {
    const store = createMemoryOfflineStore();
    const created = await recordLocalCreate(store, payload);
    let failing = true;
    const { remote, sent } = createRemote(() => (failing ? serverError(503) : undefined));

    for (let attempt = 1; attempt <= MAX_SERVER_ERROR_ATTEMPTS; attempt += 1) {
      await flushOutbox(store, remote);
      await rearm(store);
    }
    expect((await store.getLocalExpense(created.localId))!.syncState).toBe("failed");
    expect(sent).toHaveLength(MAX_SERVER_ERROR_ATTEMPTS);

    // 'failed' 행은 자동 재시도 대상이 아니다 -- 백그라운드 flush가 아무것도 보내지 않는다.
    const idle = await flushOutbox(store, remote);
    expect(idle).toEqual({ synced: 0, failed: 0, conflicted: 0, stoppedForNetwork: false });
    expect(sent).toHaveLength(MAX_SERVER_ERROR_ATTEMPTS);

    // 서버가 회복된 뒤 사용자가 '재시도'를 누르면 같은 멱등키로 정상 전송된다.
    failing = false;
    await retryFailedMutation(store, created.localId);
    const [requeued] = await store.listOutboxMutationsForLocalId(created.localId);
    expect(requeued.attemptCount).toBe(0);
    expect(requeued.nextRetryAt).toBeNull();
    const recovered = await flushOutbox(store, remote);
    expect(recovered.synced).toBe(1);
    expect((await store.getLocalExpense(created.localId))!.syncState).toBe("synced");
  });

  it("상한은 5xx 전용이다: 순수 네트워크 오류는 몇 번을 실패해도 'pending'으로 남는다 (오프라인 우선 설계 불변)", async () => {
    const store = createMemoryOfflineStore();
    const created = await recordLocalCreate(store, payload);
    const { remote } = createRemote(() => networkError());

    for (let attempt = 1; attempt <= MAX_SERVER_ERROR_ATTEMPTS + 4; attempt += 1) {
      const summary = await flushOutbox(store, remote);
      expect(summary.stoppedForNetwork).toBe(true);
      expect(summary.failed).toBe(0);
      await rearm(store);
    }

    const row = (await store.getLocalExpense(created.localId))!;
    expect(row.syncState).toBe("pending");
    const [mutation] = await store.listOutboxMutations();
    expect(mutation.attemptCount).toBe(MAX_SERVER_ERROR_ATTEMPTS + 4);
  });

  it("5xx가 중간에 성공하면 상한은 아무 흔적도 남기지 않는다 (배포/재기동 같은 일시 장애)", async () => {
    const store = createMemoryOfflineStore();
    const created = await recordLocalCreate(store, payload);
    let remaining = MAX_SERVER_ERROR_ATTEMPTS - 1;
    const { remote } = createRemote(() => {
      if (remaining <= 0) return undefined;
      remaining -= 1;
      return serverError(502);
    });

    for (let attempt = 1; attempt <= MAX_SERVER_ERROR_ATTEMPTS; attempt += 1) {
      await flushOutbox(store, remote);
      await rearm(store);
    }

    expect((await store.getLocalExpense(created.localId))!.syncState).toBe("synced");
    expect(await store.listOutboxMutations()).toHaveLength(0);
  });
});

describe("FIX-119B/F3: 5xx의 lastError는 한국어로 노출된다", () => {
  it("상한 전 재시도 중인 행의 lastError가 영문 HTTP 메시지가 아니라 안내 문구다", async () => {
    const store = createMemoryOfflineStore();
    const created = await recordLocalCreate(store, payload);
    const { remote } = createRemote(() => serverError(500));

    await flushOutbox(store, remote);

    const row = (await store.getLocalExpense(created.localId))!;
    expect(row.syncState).toBe("pending");
    expect(row.lastError).toBe(SERVER_TRANSIENT_ERROR_MESSAGE);
    const [mutation] = await store.listOutboxMutations();
    expect(mutation.lastError).toBe(SERVER_TRANSIENT_ERROR_MESSAGE);
    // 원본 영문 메시지("Expense request failed with status 500")는 화면에 새지 않는다.
    expect(row.lastError).not.toMatch(/status|failed/i);
  });

  it("네트워크 오류의 메시지 처리는 예전 그대로다 (5xx만 매핑 대상)", async () => {
    const store = createMemoryOfflineStore();
    const created = await recordLocalCreate(store, payload);
    const { remote } = createRemote(() => networkError());

    await flushOutbox(store, remote);

    expect((await store.getLocalExpense(created.localId))!.lastError).toBe("Network request failed");
  });
});

describe("FIX-119B/F1: 서버 반영 시점(attemptFlush 성공)에 준비템 캐시도 무효화한다 (source verification)", () => {
  it("sync-controller의 flush 성공 분기가 expenses/home에 더해 items/item-detail을 무효화한다", () => {
    const controllerSource = readFileSync(join(process.cwd(), "src/offline/sync-controller.ts"), "utf8");
    const successBranch = controllerSource.slice(controllerSource.indexOf("if (summary.synced > 0) {"));
    expect(successBranch).toContain('await queryClient.invalidateQueries({ queryKey: ["expenses"] });');
    expect(successBranch).toContain('await queryClient.invalidateQueries({ queryKey: ["home"] });');
    // 준비율(app/(tabs)/items.tsx의 ["items", childId, "prep-progress"])도 같은 프리픽스로 덮인다.
    expect(successBranch).toContain('await queryClient.invalidateQueries({ queryKey: ["items"] });');
    expect(successBranch).toContain('await queryClient.invalidateQueries({ queryKey: ["item-detail"] });');
  });
});
