import { afterEach, describe, expect, it, vi } from "vitest";
import { ExpenseHttpError, ExpenseVersionConflictError, deleteExpenseWithVersion, updateExpenseWithVersion } from "./client";

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? "http://localhost:3000/api/v1";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

/**
 * H-1 regression (diff review): requestExpenseJson (src/api/client.ts) used to treat *every*
 * HTTP 409 on the expense endpoints as an ExpenseVersionConflictError, but the shared
 * IdempotencyInterceptor (apps/api/src/common/idempotency/idempotency.interceptor.ts) also 409s
 * with a *different* error code (IDEMPOTENCY_KEY_CONFLICT) and no `current` field at all. That
 * misclassification produced a local 'conflict' row with `conflictCurrent: null` -- which
 * sync-status.tsx displayed as "다른 기기에서 이 기록을 삭제했어요" (a lie) and which
 * resolveConflict* could not resolve, permanently stranding the row.
 */
describe("client.ts expense endpoints: 409 classification (H-1 fix)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("treats a VERSION_CONFLICT-coded 409 as ExpenseVersionConflictError and carries the `current` snapshot through", async () => {
    const currentSnapshot = {
      id: "expense-1",
      childId: "child-1",
      categoryId: "cat-1",
      amountKrw: 5000,
      spentOn: "2026-07-01",
      itemName: "기저귀",
      expenseType: "expense" as const,
      source: "manual" as const,
      version: 4
    };
    const fetchMock = vi.fn(async () =>
      jsonResponse(409, { error: { code: "VERSION_CONFLICT", message: "다른 곳에서 먼저 변경됐어요." }, current: currentSnapshot })
    );
    vi.stubGlobal("fetch", fetchMock);

    let caught: unknown;
    try {
      await updateExpenseWithVersion("token-1", "expense-1", { amountKrw: 6000 }, 3, "idem-1");
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(ExpenseVersionConflictError);
    expect((caught as ExpenseVersionConflictError).current).toEqual(currentSnapshot);
  });

  it("does NOT treat an IDEMPOTENCY_KEY_CONFLICT-coded 409 (no `current` field) as a version conflict -- it's a plain ExpenseHttpError(409)", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse(409, { error: { code: "IDEMPOTENCY_KEY_CONFLICT", message: "이미 다른 요청 본문으로 사용된 Idempotency-Key예요." } })
    );
    vi.stubGlobal("fetch", fetchMock);

    let caught: unknown;
    try {
      await updateExpenseWithVersion("token-1", "expense-1", { amountKrw: 6000 }, 3, "idem-1");
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(ExpenseHttpError);
    expect(caught).not.toBeInstanceOf(ExpenseVersionConflictError);
    expect((caught as ExpenseHttpError).status).toBe(409);
  });

  it("does not treat a 409 with a missing/malformed error body as a version conflict either", async () => {
    const fetchMock = vi.fn(async () => jsonResponse(409, { message: "some other 409" }));
    vi.stubGlobal("fetch", fetchMock);

    let caught: unknown;
    try {
      await deleteExpenseWithVersion("token-1", "expense-1", 3, "idem-1");
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(ExpenseHttpError);
    expect(caught).not.toBeInstanceOf(ExpenseVersionConflictError);
  });
});
