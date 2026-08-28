import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { API_ERROR_MESSAGES } from "../api/api-error";
import { createMemoryOfflineStore } from "./memory-offline-store";
import { SYNC_STATUS_RETRY_ALL_LABEL, SYNC_STATUS_RETRY_LABEL } from "./messages";
import {
  isPermissionDeniedSyncError,
  isRetryableSyncError,
  isRetryableSyncFailureRow,
  syncFailureReasonOf,
  SYNC_STATUS_ITEM_STATUS_PERMANENT_FAILURE_HINT,
  SYNC_STATUS_PERMANENT_FAILURE_HINT,
  SYNC_STATUS_PERMISSION_DENIED_HINT
} from "./permission-denied";
import { RemotePermanentError } from "./errors";
import {
  flushOutbox,
  MAX_SERVER_ERROR_ATTEMPTS,
  recordLocalCreate,
  recordLocalItemStatus,
  retryAllFailedMutations,
  type RemoteSyncApi
} from "./sync-engine";
import type { ExpensePayload, LocalExpenseRow, OfflineStore } from "./types";

/**
 * 라운드 47 UX-AB — 403 권한 거절로 실패한 행에 재시도 버튼을 고정으로 남기지 않는다.
 * 라운드 57 #8 — 그 판정을 문구 비교에서 **status 비교**로 옮기고, 재시도가 무익한 4xx 전부로
 * 넓힌다. 레거시 행(status가 없는, v2 마이그레이션 이전의 실패 행)은 예전 문자열 판정을 그대로
 * 받는다.
 *
 * 판정은 순수 모듈에서 단위 테스트하고, 화면 배선은 소스 grep 계약으로 고정한다
 * (react-native 네이티브 바인딩이 없어 화면을 vitest에서 렌더할 수 없다 —
 * sync-status-bulk-actions.test.ts와 같은 관례).
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

async function seedFailedRow(
  store: OfflineStore,
  itemName: string,
  lastError: string,
  reason: Pick<LocalExpenseRow, "lastErrorStatus" | "lastErrorCode"> = {}
): Promise<string> {
  const row = await recordLocalCreate(store, { ...payload, itemName });
  await store.updateLocalExpense(row.localId, { syncState: "failed", lastError, ...reason });
  for (const mutation of await store.listOutboxMutationsForLocalId(row.localId)) {
    await store.updateOutboxMutation(mutation.mutationId, {
      attemptCount: MAX_SERVER_ERROR_ATTEMPTS,
      nextRetryAt: null,
      lastError,
      ...reason
    });
  }
  return row.localId;
}

describe("라운드 57 #8: syncFailureReasonOf — 행에 남길 (status, code)를 뽑는다", () => {
  it("remote-api가 번역한 4xx에서 status와 서버 봉투의 code를 함께 읽는다", () => {
    const error = new RemotePermanentError(400, "미래 날짜의 지출은 저장할 수 없어요.", {
      error: { code: "EXPENSE_FUTURE_DATE", message: "…" }
    });

    expect(syncFailureReasonOf(error)).toEqual({ status: 400, code: "EXPENSE_FUTURE_DATE" });
  });

  it("봉투가 아닌 body는 code 모름이고, status만 남는다", () => {
    expect(syncFailureReasonOf(new RemotePermanentError(422, "…", "<html>502</html>"))).toEqual({
      status: 422,
      code: null
    });
  });

  it("status가 아예 없는 실패(네트워크·타임아웃)는 둘 다 모름이다", () => {
    expect(syncFailureReasonOf(new Error("Network request failed"))).toEqual({ status: null, code: null });
    expect(syncFailureReasonOf(null)).toEqual({ status: null, code: null });
  });

  it("5xx는 원본 오류 그대로 오므로 status가 살아 있다 (remote-api가 다시 던진다)", () => {
    expect(syncFailureReasonOf({ status: 503, body: { error: { code: "UPSTREAM" } } })).toEqual({
      status: 503,
      code: "UPSTREAM"
    });
  });
});

describe("라운드 57 #8: isRetryableSyncError — 다시 보내면 성공할 여지가 있나", () => {
  it("5xx와 status 모름(네트워크·타임아웃)은 재시도 가능하다", () => {
    expect(isRetryableSyncError(500)).toBe(true);
    expect(isRetryableSyncError(502)).toBe(true);
    expect(isRetryableSyncError(null)).toBe(true);
    expect(isRetryableSyncError(undefined)).toBe(true);
  });

  it("요청 내용이 원인인 4xx는 재시도가 무익하다", () => {
    for (const status of [400, 403, 404, 409, 413, 422]) {
      expect(isRetryableSyncError(status), `status ${status}`).toBe(false);
    }
  });

  it("원인이 요청 내용이 아닌 4xx 셋은 예외다 — 무익하다고 말하면 그게 오안내다", () => {
    // 401: 다시 로그인하면 그대로 나간다(만료는 로컬 큐를 지우지 않는다 — session-expiry.ts).
    expect(isRetryableSyncError(401)).toBe(true);
    // 408·429: 시간이 지나면 같은 요청이 통과한다.
    expect(isRetryableSyncError(408)).toBe(true);
    expect(isRetryableSyncError(429)).toBe(true);
  });

  it("행 판정은 status를 모르는 레거시 행을 예전 그대로 재시도 대상으로 둔다", () => {
    expect(isRetryableSyncFailureRow({ lastError: "서버 오류" })).toBe(true);
    expect(isRetryableSyncFailureRow({ lastError: "…", lastErrorStatus: null })).toBe(true);
    expect(isRetryableSyncFailureRow({ lastError: "…", lastErrorStatus: 400 })).toBe(false);
    expect(isRetryableSyncFailureRow(null)).toBe(true);
  });
});

describe("isPermissionDeniedSyncError", () => {
  it("status가 있으면 403 하나로 판정한다 (문구가 바뀌어도 흔들리지 않는다)", () => {
    expect(isPermissionDeniedSyncError({ lastError: "무슨 문구든", lastErrorStatus: 403 })).toBe(true);
    expect(isPermissionDeniedSyncError({ lastError: API_ERROR_MESSAGES.FORBIDDEN, lastErrorStatus: 400 })).toBe(false);
    expect(isPermissionDeniedSyncError({ lastError: null, lastErrorStatus: 500 })).toBe(false);
  });

  it("레거시 행(status 없음)은 예전 그대로 표의 FORBIDDEN 문구와 정확히 같을 때만 true다", () => {
    expect(isPermissionDeniedSyncError(API_ERROR_MESSAGES.FORBIDDEN)).toBe(true);
    expect(isPermissionDeniedSyncError({ lastError: API_ERROR_MESSAGES.FORBIDDEN })).toBe(true);
    expect(isPermissionDeniedSyncError({ lastError: API_ERROR_MESSAGES.FORBIDDEN, lastErrorStatus: null })).toBe(true);
  });

  it("다른 문구는 전부 기존 동작(재시도 가능)으로 남는다", () => {
    // 서버 오류·검증 실패·충돌 안내 등 재시도가 의미 있는 사유들.
    expect(isPermissionDeniedSyncError("서버 오류")).toBe(false);
    expect(isPermissionDeniedSyncError(API_ERROR_MESSAGES.EXPENSE_FUTURE_DATE)).toBe(false);
    expect(isPermissionDeniedSyncError(API_ERROR_MESSAGES.HOUSEHOLD_ALREADY_MEMBER)).toBe(false);
    expect(isPermissionDeniedSyncError(null)).toBe(false);
    expect(isPermissionDeniedSyncError(undefined)).toBe(false);
    expect(isPermissionDeniedSyncError("")).toBe(false);
  });

  it("부분 일치로 넓어지지 않는다 — 잘못 true면 재시도 수단이 사라지는 방향이라 위험하다", () => {
    expect(isPermissionDeniedSyncError(`${API_ERROR_MESSAGES.FORBIDDEN} 다시 시도해 주세요.`)).toBe(false);
    expect(isPermissionDeniedSyncError(API_ERROR_MESSAGES.FORBIDDEN.slice(0, 10))).toBe(false);
    expect(isPermissionDeniedSyncError("권한이 없어 처리하지 못했어요.")).toBe(false);
    // 앞뒤 공백이 붙은 값도 표의 문구 그대로가 아니므로 기존 동작을 유지한다.
    expect(isPermissionDeniedSyncError(` ${API_ERROR_MESSAGES.FORBIDDEN}`)).toBe(false);
  });
});

describe("라운드 47 UX-AB: 전체 재시도는 권한 거절 행을 건너뛴다", () => {
  it("403 행은 failed로 남고, 재시도 가능한 행만 큐에 다시 오른다", async () => {
    const store = createMemoryOfflineStore();
    const forbidden = await seedFailedRow(store, "권한없음", API_ERROR_MESSAGES.FORBIDDEN, {
      lastErrorStatus: 403,
      lastErrorCode: "FORBIDDEN"
    });
    const retryable = await seedFailedRow(store, "서버오류", "서버 오류");

    const count = await retryAllFailedMutations(store);

    expect(count).toBe(1);
    expect((await store.getLocalExpense(retryable))?.syncState).toBe("pending");
    // 재시도해 봐야 같은 403이라, 큐에 올리면 attemptCount만 소모하고 화면 안내와도 어긋난다.
    const denied = await store.getLocalExpense(forbidden);
    expect(denied?.syncState).toBe("failed");
    expect(denied?.lastError).toBe(API_ERROR_MESSAGES.FORBIDDEN);
  });

  it("status가 없는 레거시 403 행도 예전 그대로 건너뛴다", async () => {
    const store = createMemoryOfflineStore();
    await seedFailedRow(store, "권한없음", API_ERROR_MESSAGES.FORBIDDEN);

    expect(await retryAllFailedMutations(store)).toBe(0);
    expect((await store.listLocalExpenses())[0].syncState).toBe("failed");
  });

  it("다른 사유의 실패 행은 예전 그대로 전량 재시도된다 (SYNC-127 동작 불변)", async () => {
    const store = createMemoryOfflineStore();
    await seedFailedRow(store, "기저귀", "서버 오류");
    await seedFailedRow(store, "물티슈", "서버 오류");

    expect(await retryAllFailedMutations(store)).toBe(2);
    expect((await store.listLocalExpenses()).every((row) => row.syncState === "pending")).toBe(true);
  });
});

describe("라운드 57 #8: 전체 재시도의 제외 집합이 재시도 무익 4xx 전부로 넓어진다", () => {
  it("400 검증 거부 행은 큐에 다시 오르지 않는다 (화면이 재시도 버튼을 걷어낸 행이다)", async () => {
    const store = createMemoryOfflineStore();
    const rejected = await seedFailedRow(store, "미래날짜", "미래 날짜의 지출은 저장할 수 없어요.", {
      lastErrorStatus: 400,
      lastErrorCode: "EXPENSE_FUTURE_DATE"
    });
    const serverError = await seedFailedRow(store, "서버오류", "서버 오류가 계속돼 자동 재시도를 멈췄어요.", {
      lastErrorStatus: 503
    });

    expect(await retryAllFailedMutations(store)).toBe(1);
    expect((await store.getLocalExpense(rejected))?.syncState).toBe("failed");
    // 5xx는 서버가 회복되면 그대로 통과하므로 재시도 대상으로 남는다.
    expect((await store.getLocalExpense(serverError))?.syncState).toBe("pending");
  });

  it("401은 4xx지만 다시 로그인하면 풀리므로 재시도 대상으로 남는다", async () => {
    const store = createMemoryOfflineStore();
    const expired = await seedFailedRow(store, "만료", "다시 로그인해 주세요.", { lastErrorStatus: 401 });

    expect(await retryAllFailedMutations(store)).toBe(1);
    expect((await store.getLocalExpense(expired))?.syncState).toBe("pending");
  });

  it("재시도는 사유(status/code)도 함께 지운다 — 낡은 판정이 다음 실패에 따라붙지 않는다", async () => {
    const store = createMemoryOfflineStore();
    const localId = await seedFailedRow(store, "서버오류", "서버 오류", { lastErrorStatus: 503, lastErrorCode: "X" });

    await retryAllFailedMutations(store);

    const row = await store.getLocalExpense(localId);
    expect(row?.lastError).toBeNull();
    expect(row?.lastErrorStatus).toBeNull();
    expect(row?.lastErrorCode).toBeNull();
    const [mutation] = await store.listOutboxMutationsForLocalId(localId);
    expect(mutation.lastErrorStatus).toBeNull();
    expect(mutation.lastErrorCode).toBeNull();
  });
});

describe("라운드 57 #8: flush가 사유를 행에 실제로 저장한다 (end-to-end)", () => {
  /** remote-api.ts가 4xx에서 던지는 것과 같은 모양 — status + 서버 봉투 body. */
  function permanent(status: number, code: string) {
    return new RemotePermanentError(status, "요청을 처리하지 못했어요.", { error: { code, message: "…" } });
  }

  function remoteFailingWith(error: Error): RemoteSyncApi {
    return {
      async createExpense() {
        throw error;
      },
      async updateExpense() {
        throw error;
      },
      async deleteExpense() {
        throw error;
      },
      async setItemStatus() {
        throw error;
      }
    };
  }

  it("400 검증 거부: 지출 행과 아웃박스 행 모두에 status·code가 남고, 화면 판정이 뒤집힌다", async () => {
    const store = createMemoryOfflineStore();
    const created = await recordLocalCreate(store, payload);

    await flushOutbox(store, remoteFailingWith(permanent(400, "EXPENSE_FUTURE_DATE")));

    const row = await store.getLocalExpense(created.localId);
    expect(row?.syncState).toBe("failed");
    expect(row?.lastErrorStatus).toBe(400);
    expect(row?.lastErrorCode).toBe("EXPENSE_FUTURE_DATE");
    // 이것이 이 티켓의 결론이다: 화면은 이제 이 행에 "재시도"를 내밀지 않는다.
    expect(isRetryableSyncFailureRow(row!)).toBe(false);
    expect(isPermissionDeniedSyncError(row!)).toBe(false);

    const [mutation] = await store.listOutboxMutationsForLocalId(created.localId);
    expect(mutation.lastErrorStatus).toBe(400);
    expect(mutation.lastErrorCode).toBe("EXPENSE_FUTURE_DATE");
  });

  it("403 권한 거절: status로 판정되므로 문구가 바뀌어도 안내가 유지된다", async () => {
    const store = createMemoryOfflineStore();
    const created = await recordLocalCreate(store, payload);

    await flushOutbox(store, remoteFailingWith(permanent(403, "FORBIDDEN")));

    const row = await store.getLocalExpense(created.localId);
    expect(row?.lastErrorStatus).toBe(403);
    expect(isPermissionDeniedSyncError(row!)).toBe(true);
  });

  it("준비템 상태 큐도 같은 사유 채널을 쓴다", async () => {
    const store = createMemoryOfflineStore();
    await recordLocalItemStatus(store, {
      childId: "child-1",
      itemTemplateId: "tpl-1",
      status: "prepared",
      itemName: "젖병"
    });

    await flushOutbox(store, remoteFailingWith(permanent(400, "ITEM_STATUS_INVALID")));

    const [row] = await store.listItemStatusMutations();
    expect(row.syncState).toBe("failed");
    expect(row.lastErrorStatus).toBe(400);
    expect(row.lastErrorCode).toBe("ITEM_STATUS_INVALID");
    expect(isRetryableSyncFailureRow(row)).toBe(false);
  });

  it("5xx transient 실패도 status를 남기지만 재시도 가능으로 읽힌다", async () => {
    const store = createMemoryOfflineStore();
    const created = await recordLocalCreate(store, payload);
    const serverError = Object.assign(new Error("Expense request failed with status 503"), { status: 503 });

    await flushOutbox(store, remoteFailingWith(serverError));

    const row = await store.getLocalExpense(created.localId);
    // 5xx는 permanent가 아니므로 행은 'pending'으로 남는다(R19-H 계약 불변).
    expect(row?.syncState).toBe("pending");
    expect(row?.lastErrorStatus).toBe(503);
    expect(isRetryableSyncFailureRow(row!)).toBe(true);
  });

  it("전송에 성공하면 사유도 함께 지워진다", async () => {
    const store = createMemoryOfflineStore();
    const created = await recordLocalCreate(store, payload);
    await flushOutbox(store, remoteFailingWith(permanent(400, "EXPENSE_FUTURE_DATE")));
    expect((await store.getLocalExpense(created.localId))?.lastErrorStatus).toBe(400);

    // 사용자가 재시도를 눌러 큐에 다시 올린 뒤(사유가 지워진다) 이번에는 성공한다.
    await store.updateLocalExpense(created.localId, { syncState: "pending" });
    await flushOutbox(store, {
      async createExpense() {
        return { id: "server-1", version: 1 };
      },
      async updateExpense() {
        return { version: 1 };
      },
      async deleteExpense() {}
    });

    const row = await store.getLocalExpense(created.localId);
    expect(row?.syncState).toBe("synced");
    expect(row?.lastErrorStatus).toBeNull();
    expect(row?.lastErrorCode).toBeNull();
  });
});

describe("라운드 47 UX-AB / 라운드 57 #8: sync-status 화면 배선", () => {
  it("403 실패 행은 재시도 대신 안내 한 줄 + 삭제만 그린다", () => {
    const screen = source("app/sync-status.tsx");

    // 판정은 행 전체를 본다(문구가 아니라 status를 보기 위해서다).
    expect(screen).toContain("isPermissionDeniedSyncError(row)");
    expect(screen).not.toContain("isPermissionDeniedSyncError(row.lastError)");
    expect(screen).toContain("{SYNC_STATUS_PERMISSION_DENIED_HINT}");
    // 삭제는 남는다 -- 403 행에서 사용자가 취할 수 있는 유일한 유효한 행동이다.
    const branchStart = screen.indexOf("if (isPermissionDeniedSyncError(row)) {");
    expect(branchStart).toBeGreaterThan(-1);
    const deniedBranch = screen.slice(branchStart, screen.indexOf("\n  return (", branchStart));
    expect(deniedBranch).toContain("SYNC_STATUS_DISCARD_LABEL");
    expect(deniedBranch).not.toContain(SYNC_STATUS_RETRY_LABEL);
    expect(deniedBranch).not.toContain("retryOfflineMutation");
  });

  it("재시도가 무익한 4xx 실패 행도 재시도 대신 정직한 안내 + 버리기를 그린다", () => {
    const screen = source("app/sync-status.tsx");

    // 지출 행과 준비템 행 두 갈래 모두에 같은 판정이 있고, 문구만 행 종류에 맞다.
    expect(screen.match(/!isRetryableSyncFailureRow\(row\)/g) ?? []).toHaveLength(2);
    expect(screen).toContain("{SYNC_STATUS_PERMANENT_FAILURE_HINT}");
    expect(screen).toContain("{SYNC_STATUS_ITEM_STATUS_PERMANENT_FAILURE_HINT}");

    const branchStart = screen.indexOf("if (!isRetryableSyncFailureRow(row)) {");
    expect(branchStart).toBeGreaterThan(-1);
    const branch = screen.slice(branchStart, screen.indexOf("\n  return (", branchStart));
    expect(branch).toContain("SYNC_STATUS_DISCARD_LABEL");
    expect(branch).not.toContain(SYNC_STATUS_RETRY_LABEL);
    expect(branch).not.toContain("retryOfflineMutation");
  });

  it("안내 문구는 둘 다 해요체 한 줄이다 (DNC-018)", () => {
    expect(SYNC_STATUS_PERMISSION_DENIED_HINT).toBe("권한이 생기면 다시 시도할 수 있어요.");
    expect(SYNC_STATUS_PERMISSION_DENIED_HINT.split("\n")).toHaveLength(1);
    expect(SYNC_STATUS_PERMANENT_FAILURE_HINT).toBe("다시 보내도 같은 결과예요. 내용을 고쳐 새로 기록하거나 버려 주세요.");
    expect(SYNC_STATUS_ITEM_STATUS_PERMANENT_FAILURE_HINT).toBe(
      "다시 보내도 같은 결과예요. 이 변경은 버리고 준비템 화면에서 다시 확인해 주세요."
    );
    for (const hint of [SYNC_STATUS_PERMANENT_FAILURE_HINT, SYNC_STATUS_ITEM_STATUS_PERMANENT_FAILURE_HINT]) {
      expect(hint.split("\n")).toHaveLength(1);
      expect(hint.endsWith("요.")).toBe(true);
      // 두 문장 모두 "재시도가 무익하다"는 사실로 시작한다 -- 그것이 이 자리의 존재 이유다.
      expect(hint.startsWith("다시 보내도 같은 결과예요.")).toBe(true);
    }
  });

  it("실패 사유 문장은 여전히 행 위에 그대로 뜬다 — 안내가 사유를 대체하지 않는다", () => {
    const screen = source("app/sync-status.tsx");
    // 무엇이 잘못됐는지는 api-error.ts의 코드별 문구(lastError)가 말하고, 안내 한 줄은
    // "재시도가 무익하다"만 말한다. 둘 중 하나라도 사라지면 사용자는 사유나 다음 행동을 잃는다.
    expect(screen.match(/\{row\.lastError\}/g) ?? []).toHaveLength(2);
  });

  it("일괄 액션 문구는 그대로다 — 바뀐 것은 대상 집합뿐이다", () => {
    expect(SYNC_STATUS_RETRY_ALL_LABEL).toBe("전체 재시도");
    expect(SYNC_STATUS_RETRY_LABEL).toBe("재시도");
  });
});
