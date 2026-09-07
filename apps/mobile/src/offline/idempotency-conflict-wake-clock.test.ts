import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { BASE_DELAY_MS, MAX_DELAY_MS, computeNextRetryAtIso, nextBackoffWakeDelayMs } from "./backoff";
import { RemotePermanentError, RemoteVersionConflictError } from "./errors";
import { createMemoryOfflineStore } from "./memory-offline-store";
import { isBulkRetryableFailedRow, isRetryableSyncError, isRetryableSyncFailureRow } from "./permission-denied";
import {
  MAX_SERVER_ERROR_ATTEMPTS,
  flushOutbox,
  recordLocalCreate,
  requeueRetryableClientErrorMutations,
  retryableClientErrorSyncMessage,
  type RemoteExpenseApi
} from "./sync-engine";
import type { ExpensePayload, OfflineStore } from "./types";

/**
 * F1·F5 — **서버가 "잠시 후 다시 시도해 주세요"라고 답한 실패가 실제로 다시 나간다.**
 *
 * ## F1: 409 `IDEMPOTENCY_KEY_CONFLICT`를 영구 실패로 굳히고 있었다
 *
 * 서버의 멱등 인터셉터(apps/api/src/common/idempotency/idempotency.interceptor.ts)는 이 409에
 * 세 문장 중 하나를 싣는데, 그중 둘이 **재시도를 시킨다**: *"이전 요청이 아직 처리 중이에요.
 * 잠시 후 다시 시도해 주세요."* 와 *"이전 요청 처리에 실패했어요. 다시 시도해 주세요."*
 *
 * 그런데 판정은 status만 봤고(`RETRYABLE_CLIENT_ERROR_STATUSES = {401, 408, 429}`), 409는 그
 * 집합 밖이라 **영구 실패**로 파킹됐다. 실측: `isRetryableSyncFailureRow: false` → 화면이 재시도
 * 버튼을 걷고 *"다시 보내도 같은 결과예요. 내용을 고쳐 새로 기록하거나 버려 주세요."* 를 세운다.
 * **그 안내를 따르면 원본이 실제로 커밋된 경우 같은 지출이 두 건이 된다.**
 *
 * 도달 경로의 값: 모바일 쓰기 타임아웃 **10초** < 서버 예약 수명 **10분**. 10초에 끊긴 요청의
 * 핸들러가 서버에서 최대 10분 더 살아 있고, 그 창에서 나간 재전송이 정확히 이 409를 받는다.
 *
 * ⚠️ **409를 통째로 열지 않는다** — VERSION_CONFLICT도 409다. 그래서 판정은 **status + code**
 * 조합이고, `code`를 모르는 409는 종전 그대로 영구 실패다. §2가 그 좁힘을 부정 단언으로 문다.
 *
 * ## F5: 백오프는 예약만 하고 깨우는 시계가 없었다
 *
 * 엔진은 `nextRetryAt`을 적었지만 그것을 읽어 타이머를 거는 코드가 저장소 전체에 **0건**이었다.
 * 아웃박스를 깨우는 트리거는 토큰 진입 1회 + 오프라인→온라인 전이 + 포그라운드 복귀 + 로컬
 * 쓰기뿐 — 전부 **시간과 무관**하다. 그동안 화면은 *"서버가 잠시 응답하지 못했어요. 자동으로
 * 다시 시도해요."* 라고 말한다. 온라인인 채 앱을 켜 두고 기다리는 사용자에게 그 문장은 거짓이었다.
 *
 * §3이 그 시계의 계산을 값으로 물고, **폭주가 없다는 성질**(이미 지난 창으로는 깨어나지 않는다 ·
 * 상한 `MAX_DELAY_MS` · 타이머 하나)을 함께 문다.
 */

const mobileRoot = process.cwd();
const source = (relativePath: string) => readFileSync(join(mobileRoot, relativePath), "utf8");

const payload: ExpensePayload = {
  childId: "child-1",
  categoryId: "cat-diaper",
  amountKrw: 18_000,
  spentOn: "2026-09-02",
  itemName: "기저귀"
};

/**
 * 서버가 실제로 보내는 봉투 그대로. `conflictError`가
 * `new HttpException({ code: "IDEMPOTENCY_KEY_CONFLICT", message }, 409)`를 던지고,
 * GlobalExceptionFilter가 `{error: {code, message}}`로 직렬화하며, remote-api.ts가 그 body를
 * `RemotePermanentError`에 그대로 싣는다.
 */
function idempotencyConflictError() {
  return new RemotePermanentError(409, "이전 제출이 이미 처리됐을 수 있어요. 저장된 내용이 있는지 먼저 확인해 주세요.", {
    error: { code: "IDEMPOTENCY_KEY_CONFLICT", message: "이전 요청이 아직 처리 중이에요. 잠시 후 다시 시도해 주세요." }
  });
}

function createFailingRemote(makeError: () => Error) {
  let calls = 0;
  const remote: RemoteExpenseApi = {
    async createExpense() {
      calls += 1;
      throw makeError();
    },
    async updateExpense() {
      throw makeError();
    },
    async deleteExpense() {
      throw makeError();
    }
  };
  return { remote, callCount: () => calls };
}

describe("F1 §1: 409 IDEMPOTENCY_KEY_CONFLICT는 재시도 가능하다", () => {
  it("판정은 status가 아니라 (status, code) 한 쌍으로 갈린다", () => {
    expect(isRetryableSyncError(409, "IDEMPOTENCY_KEY_CONFLICT")).toBe(true);
    // 종전과 같은 답이 유지되는 자리들.
    expect(isRetryableSyncError(409, "VERSION_CONFLICT")).toBe(false);
    expect(isRetryableSyncError(409, null)).toBe(false);
    expect(isRetryableSyncError(409, undefined)).toBe(false);
    expect(isRetryableSyncError(409)).toBe(false);
    // 나머지 status는 code와 무관하게 종전 그대로다.
    expect(isRetryableSyncError(400, "IDEMPOTENCY_KEY_CONFLICT")).toBe(false);
    expect(isRetryableSyncError(403, "IDEMPOTENCY_KEY_CONFLICT")).toBe(false);
    expect(isRetryableSyncError(429, "ANYTHING")).toBe(true);
    expect(isRetryableSyncError(503, null)).toBe(true);
    expect(isRetryableSyncError(null)).toBe(true);
  });

  it("행 단위 판정도 저장된 code를 본다 — 화면의 재시도 버튼이 그 답 하나로 결정된다", () => {
    const idempotencyRow = { lastError: "…", lastErrorStatus: 409, lastErrorCode: "IDEMPOTENCY_KEY_CONFLICT" };
    expect(isRetryableSyncFailureRow(idempotencyRow)).toBe(true);
    expect(isBulkRetryableFailedRow(idempotencyRow)).toBe(true);

    // code가 없는 409 행(v2 이전 · 프록시가 만든 봉투 없는 409)은 종전 그대로 영구 실패다.
    expect(isRetryableSyncFailureRow({ lastError: "…", lastErrorStatus: 409 })).toBe(false);
    expect(isRetryableSyncFailureRow({ lastError: "…", lastErrorStatus: 409, lastErrorCode: null })).toBe(false);
  });

  it("엔진: 그 409를 받은 행은 'failed'로 굳지 않고 대기 상태로 남아 백오프가 걸린다", async () => {
    const store = createMemoryOfflineStore();
    const created = await recordLocalCreate(store, payload);
    const { remote } = createFailingRemote(idempotencyConflictError);

    const summary = await flushOutbox(store, remote);

    expect(summary.failed).toBe(0);
    expect(summary.stoppedForNetwork).toBe(true);
    const row = (await store.getLocalExpense(created.localId))!;
    expect(row.syncState).toBe("pending");
    expect(row.lastErrorStatus).toBe(409);
    expect(row.lastErrorCode).toBe("IDEMPOTENCY_KEY_CONFLICT");
    expect(row.lastError).toBe(retryableClientErrorSyncMessage(409, "retrying"));
    expect(row.lastError).toBe("지금은 보낼 수 없어 잠시 뒤 자동으로 다시 시도해요.");
    const [mutation] = await store.listOutboxMutationsForLocalId(created.localId);
    expect(mutation.attemptCount).toBe(1);
    expect(mutation.nextRetryAt).not.toBeNull();
  });

  it("멱등키를 그대로 다시 보내는 것이 안전한 이유 그대로: 재전송의 키는 첫 시도의 키와 같다", async () => {
    const store = createMemoryOfflineStore();
    const created = await recordLocalCreate(store, payload);
    const [queued] = await store.listOutboxMutationsForLocalId(created.localId);
    const originalKey = queued.idempotencyKey;

    const sentKeys: string[] = [];
    const remote: RemoteExpenseApi = {
      async createExpense(_payload, idempotencyKey) {
        sentKeys.push(idempotencyKey);
        throw idempotencyConflictError();
      },
      async updateExpense() {
        throw new Error("unreachable");
      },
      async deleteExpense() {
        throw new Error("unreachable");
      }
    };

    await flushOutbox(store, remote);
    // 백오프 창을 열어 다음 pass가 같은 행을 다시 보내게 한다(시계를 흔들지 않고 창만 비운다).
    const [afterFirst] = await store.listOutboxMutationsForLocalId(created.localId);
    await store.updateOutboxMutation(afterFirst.mutationId, { nextRetryAt: null });
    await flushOutbox(store, remote);

    expect(sentKeys).toEqual([originalKey, originalKey]);
  });

  it("상한(8회)에 닿으면 'failed'로 승격되지만 재시도 버튼은 남는다 — 서버 예약이 풀리면 그대로 통과한다", async () => {
    const store = createMemoryOfflineStore();
    const created = await recordLocalCreate(store, payload);
    const { remote } = createFailingRemote(idempotencyConflictError);

    for (let attempt = 0; attempt < MAX_SERVER_ERROR_ATTEMPTS; attempt += 1) {
      const [mutation] = await store.listOutboxMutationsForLocalId(created.localId);
      await store.updateOutboxMutation(mutation.mutationId, { nextRetryAt: null });
      await flushOutbox(store, remote);
    }

    const row = (await store.getLocalExpense(created.localId))!;
    expect(row.syncState).toBe("failed");
    expect(row.lastError).toBe(retryableClientErrorSyncMessage(409, "gave-up"));
    expect(row.lastError).toBe("여러 번 시도했지만 아직 못 보냈어요. 다시 시도하거나 삭제해 주세요.");
    // 화면은 이 행에서 재시도를 걷지 않는다 — 그것이 F1이 되돌린 거짓 안내다.
    expect(isRetryableSyncFailureRow(row)).toBe(true);
  });

  it("세션이 서는 자리의 되돌리기 대상에도 든다 (requeueRetryableClientErrorMutations)", async () => {
    const store = createMemoryOfflineStore();
    const created = await recordLocalCreate(store, payload);
    const { remote } = createFailingRemote(idempotencyConflictError);
    await flushOutbox(store, remote);

    const requeued = await requeueRetryableClientErrorMutations(store);

    expect(requeued).toBe(1);
    const [mutation] = await store.listOutboxMutationsForLocalId(created.localId);
    expect(mutation.attemptCount).toBe(0);
    expect(mutation.nextRetryAt).toBeNull();
  });
});

describe("F1 §2: 좁힘 — 409의 나머지는 종전 그대로다", () => {
  let store: OfflineStore;

  beforeEach(() => {
    store = createMemoryOfflineStore();
  });

  it("VERSION_CONFLICT 409는 여전히 충돌 섹션으로 간다(자동 재시도 대상이 아니다)", async () => {
    const created = await recordLocalCreate(store, payload);
    const conflictRemote: RemoteExpenseApi = {
      async createExpense() {
        throw new RemoteVersionConflictError({
          deleted: false,
          expense: { ...payload, id: "server-9", version: 7 }
        });
      },
      async updateExpense() {
        throw new Error("unreachable");
      },
      async deleteExpense() {
        throw new Error("unreachable");
      }
    };

    const summary = await flushOutbox(store, conflictRemote);

    expect(summary.conflicted).toBe(1);
    expect(summary.failed).toBe(0);
    const row = (await store.getLocalExpense(created.localId))!;
    expect(row.syncState).toBe("conflict");
    // 충돌 행의 사유는 비워진다 — 그래서 위 판정이 이 행을 보는 일 자체가 없다.
    expect(row.lastErrorStatus ?? null).toBeNull();
    expect(row.lastErrorCode ?? null).toBeNull();
  });

  it("봉투 없는 409(프록시·게이트웨이)는 종전 그대로 'failed'로 굳는다", async () => {
    const created = await recordLocalCreate(store, payload);
    const { remote } = createFailingRemote(() => new RemotePermanentError(409, "요청을 처리하지 못했어요."));

    const summary = await flushOutbox(store, remote);

    expect(summary.failed).toBe(1);
    const row = (await store.getLocalExpense(created.localId))!;
    expect(row.syncState).toBe("failed");
    expect(row.lastErrorStatus).toBe(409);
    expect(row.lastErrorCode).toBeNull();
    expect(isRetryableSyncFailureRow(row)).toBe(false);
  });

  it("다른 4xx는 한 글자도 바뀌지 않았다 — 400 검증 거부는 그대로 영구 실패다", async () => {
    const created = await recordLocalCreate(store, payload);
    const { remote } = createFailingRemote(
      () =>
        new RemotePermanentError(400, "미래 날짜의 지출은 저장할 수 없어요.", {
          error: { code: "EXPENSE_FUTURE_DATE" }
        })
    );

    const summary = await flushOutbox(store, remote);

    expect(summary.failed).toBe(1);
    const row = (await store.getLocalExpense(created.localId))!;
    expect(row.syncState).toBe("failed");
    expect(isRetryableSyncFailureRow(row)).toBe(false);
  });

  it("판정은 여전히 **한 벌**이다 — 엔진과 화면이 같은 함수를 부른다", () => {
    const engine = source("src/offline/sync-engine.ts");
    // 엔진은 판정을 다시 적지 않는다(라운드 104가 세운 규율).
    expect(engine).toContain("isRetryableSyncError(status, code)");
    expect(engine).not.toContain("RETRYABLE_CLIENT_ERROR_STATUSES");
    const gate = source("src/offline/permission-denied.ts");
    expect(gate).toContain('const RETRYABLE_CONFLICT_CODES = new Set(["IDEMPOTENCY_KEY_CONFLICT"]);');
    expect(gate).toContain("if (status === CONFLICT_STATUS) return typeof code === \"string\" && RETRYABLE_CONFLICT_CODES.has(code);");
  });
});

describe("F5 §3: 백오프를 깨우는 시계", () => {
  const T0 = Date.parse("2026-09-07T00:00:00.000Z");

  it("가장 이른 **미래** 창까지의 거리를 돌려준다", () => {
    const rows = [
      { nextRetryAt: new Date(T0 + 30_000).toISOString() },
      { nextRetryAt: new Date(T0 + 8_000).toISOString() },
      { nextRetryAt: new Date(T0 + 120_000).toISOString() }
    ];
    expect(nextBackoffWakeDelayMs(rows, T0)).toBe(8_000);
  });

  it("걸 타이머가 없으면 null이다 — 창이 없는 큐, 빈 큐, 창을 잃은 행", () => {
    expect(nextBackoffWakeDelayMs([], T0)).toBeNull();
    expect(nextBackoffWakeDelayMs([{ nextRetryAt: null }, {}], T0)).toBeNull();
    expect(nextBackoffWakeDelayMs([{ nextRetryAt: "이건 시각이 아니다" }], T0)).toBeNull();
  });

  it("⚠️ 폭주 방지 ①: 이미 지난 창으로는 깨어나지 않는다 (0ms 타이머 루프가 성립하지 않는다)", () => {
    const past = new Date(T0 - 1).toISOString();
    const now = new Date(T0).toISOString();
    expect(nextBackoffWakeDelayMs([{ nextRetryAt: past }], T0)).toBeNull();
    expect(nextBackoffWakeDelayMs([{ nextRetryAt: now }], T0)).toBeNull();
    // 지난 창과 미래 창이 섞여 있으면 미래 것만 센다.
    expect(nextBackoffWakeDelayMs([{ nextRetryAt: past }, { nextRetryAt: new Date(T0 + 5_000).toISOString() }], T0)).toBe(
      5_000
    );
  });

  it("⚠️ 폭주 방지 ②: 상한은 MAX_DELAY_MS다 (뒤로 뛴 시계가 만든 먼 창이 setTimeout을 즉시 발화로 접지 못한다)", () => {
    const farFuture = new Date(T0 + 30 * 24 * 60 * 60 * 1_000).toISOString();
    expect(nextBackoffWakeDelayMs([{ nextRetryAt: farFuture }], T0)).toBe(MAX_DELAY_MS);
    expect(MAX_DELAY_MS).toBe(5 * 60 * 1_000);
    // 32비트 setTimeout 한계 아래임을 값으로 못 박는다.
    expect(MAX_DELAY_MS).toBeLessThan(2 ** 31 - 1);
  });

  it("실제 백오프 시퀀스와 맞물린다 — 첫 실패의 창은 2초, 이후 스스로 성겨진다", () => {
    const first = computeNextRetryAtIso(new Date(T0).toISOString(), 1);
    expect(nextBackoffWakeDelayMs([{ nextRetryAt: first }], T0)).toBe(BASE_DELAY_MS);
    expect(BASE_DELAY_MS).toBe(2_000);

    const sequence = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((attempt) =>
      nextBackoffWakeDelayMs([{ nextRetryAt: computeNextRetryAtIso(new Date(T0).toISOString(), attempt) }], T0)
    );
    expect(sequence).toEqual([2_000, 4_000, 8_000, 16_000, 32_000, 64_000, 128_000, 256_000, 300_000, 300_000]);
  });

  it("컨트롤러가 그 시계를 건다 — 타이머는 하나, 오프라인이면 걸지 않고, 세션이 끝나면 지운다", () => {
    const controller = source("src/offline/sync-controller.ts");
    expect(controller).toContain("nextBackoffWakeDelayMs(");
    // 타이머는 모듈 하나짜리 슬롯이고, 새로 걸기 전에 반드시 지운다(누적 없음).
    expect(controller).toContain("let backoffWakeTimer: ReturnType<typeof setTimeout> | null = null;");
    expect(controller).toContain("async function scheduleBackoffWake(");
    const scheduleAt = controller.indexOf("async function scheduleBackoffWake(");
    expect(controller.slice(scheduleAt, controller.indexOf("\n}\n", scheduleAt))).toContain("clearBackoffWake();");
    // 다시 거는 자리는 온라인 게이트 **아래**다 — 오프라인 복귀는 연결 감시자의 몫으로 남는다.
    const flushAt = controller.indexOf("async function flushInBackground(");
    const flushBody = controller.slice(flushAt, controller.indexOf("\n}\n", flushAt));
    expect(flushBody.indexOf("if (!online) return;")).toBeLessThan(flushBody.indexOf("scheduleBackoffWake("));
    // 세션이 끝나면 타이머도 함께 사라진다.
    expect(controller).toContain("clearBackoffWake();\n    };");
  });

  it("⚠️ 폭주 방지 ③: 깨어난 pass가 큐 전체를 태우지 않는다 — transient 갈래는 여전히 `break`다", () => {
    const engine = source("src/offline/sync-engine.ts");
    const transientAt = engine.indexOf("      summary.stoppedForNetwork = true;");
    expect(transientAt).toBeGreaterThan(-1);
    expect(engine.slice(transientAt, transientAt + 80)).toContain("break;");
  });
});
