import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { API_ERROR_MESSAGES } from "../api/api-error";
import { createMemoryOfflineStore } from "./memory-offline-store";
import { SYNC_STATUS_RETRY_ALL_LABEL, SYNC_STATUS_RETRY_LABEL } from "./messages";
import { isPermissionDeniedSyncError, SYNC_STATUS_PERMISSION_DENIED_HINT } from "./permission-denied";
import { MAX_SERVER_ERROR_ATTEMPTS, recordLocalCreate, retryAllFailedMutations } from "./sync-engine";
import type { ExpensePayload, OfflineStore } from "./types";

/**
 * 라운드 47 UX-AB — 403 권한 거절로 실패한 행에 재시도 버튼을 고정으로 남기지 않는다.
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

async function seedFailedRow(store: OfflineStore, itemName: string, lastError: string): Promise<string> {
  const row = await recordLocalCreate(store, { ...payload, itemName });
  await store.updateLocalExpense(row.localId, { syncState: "failed", lastError });
  for (const mutation of await store.listOutboxMutationsForLocalId(row.localId)) {
    await store.updateOutboxMutation(mutation.mutationId, {
      attemptCount: MAX_SERVER_ERROR_ATTEMPTS,
      nextRetryAt: null,
      lastError
    });
  }
  return row.localId;
}

describe("isPermissionDeniedSyncError", () => {
  it("표의 FORBIDDEN 문구와 정확히 같을 때만 true다", () => {
    expect(isPermissionDeniedSyncError(API_ERROR_MESSAGES.FORBIDDEN)).toBe(true);
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
    const forbidden = await seedFailedRow(store, "권한없음", API_ERROR_MESSAGES.FORBIDDEN);
    const retryable = await seedFailedRow(store, "서버오류", "서버 오류");

    const count = await retryAllFailedMutations(store);

    expect(count).toBe(1);
    expect((await store.getLocalExpense(retryable))?.syncState).toBe("pending");
    // 재시도해 봐야 같은 403이라, 큐에 올리면 attemptCount만 소모하고 화면 안내와도 어긋난다.
    const denied = await store.getLocalExpense(forbidden);
    expect(denied?.syncState).toBe("failed");
    expect(denied?.lastError).toBe(API_ERROR_MESSAGES.FORBIDDEN);
  });

  it("실패 행이 전부 403이면 아무것도 큐에 올리지 않는다", async () => {
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

describe("라운드 47 UX-AB: sync-status 화면 배선", () => {
  it("403 실패 행은 재시도 대신 안내 한 줄 + 삭제만 그린다", () => {
    const screen = source("app/sync-status.tsx");

    expect(screen).toContain("isPermissionDeniedSyncError(row.lastError)");
    expect(screen).toContain("{SYNC_STATUS_PERMISSION_DENIED_HINT}");
    // 삭제는 남는다 -- 403 행에서 사용자가 취할 수 있는 유일한 유효한 행동이다.
    const branchStart = screen.indexOf("if (isPermissionDeniedSyncError(row.lastError)) {");
    expect(branchStart).toBeGreaterThan(-1);
    const deniedBranch = screen.slice(branchStart, screen.indexOf("\n  return (", branchStart));
    expect(deniedBranch).toContain("SYNC_STATUS_DISCARD_LABEL");
    expect(deniedBranch).not.toContain(SYNC_STATUS_RETRY_LABEL);
    expect(deniedBranch).not.toContain("retryOfflineMutation");
  });

  it("안내 문구는 해요체 한 줄이다 (DNC-018)", () => {
    expect(SYNC_STATUS_PERMISSION_DENIED_HINT).toBe("권한이 생기면 다시 시도할 수 있어요.");
    expect(SYNC_STATUS_PERMISSION_DENIED_HINT.split("\n")).toHaveLength(1);
  });

  it("일괄 액션 문구는 그대로다 — 바뀐 것은 대상 집합뿐이다", () => {
    expect(SYNC_STATUS_RETRY_ALL_LABEL).toBe("전체 재시도");
    expect(SYNC_STATUS_RETRY_LABEL).toBe("재시도");
  });
});
