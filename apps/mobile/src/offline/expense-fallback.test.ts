import { describe, expect, it } from "vitest";
import { ApiClientError } from "../api/client";
import { offlineExpenseFallbackAllowed, syncedExpenseMirrors } from "./expense-fallback";
import type { LocalExpenseRow, RemoteSyncMetadata } from "./types";

const complete: RemoteSyncMetadata = {
  protocolVersion: 2,
  cursor: "cursor",
  baselineComplete: true,
  lastSuccessfulPullAt: "2026-07-24T01:00:00.000Z",
  authorizationState: "authorized",
  authorizationCheckedAt: "2026-07-24T01:00:00.000Z"
};

function row(overrides: Partial<LocalExpenseRow> = {}): LocalExpenseRow {
  return {
    scopeKey: "scope",
    localId: "local-1",
    canonicalId: "expense-1",
    childId: "child-1",
    payload: {
      childId: "child-1",
      categoryId: "category-1",
      amountKrw: 10_000,
      spentOn: "2026-07-24",
      itemName: "기저귀",
      expenseType: "expense"
    },
    version: 1,
    syncState: "synced",
    pendingDelete: false,
    conflictCurrent: null,
    lastError: null,
    failureKind: null,
    createdAt: "2026-07-24T00:00:00.000Z",
    updatedAt: "2026-07-24T00:00:00.000Z",
    ...overrides
  };
}

describe("permission-safe offline expense fallback", () => {
  it("allows only complete authorized baselines for offline, network, and 5xx failures", () => {
    expect(offlineExpenseFallbackAllowed(new TypeError("network"), true, complete)).toBe(true);
    expect(offlineExpenseFallbackAllowed(new Error("offline"), false, complete)).toBe(true);
    expect(offlineExpenseFallbackAllowed(new ApiClientError(503, "HTTP_503"), true, complete)).toBe(true);
    expect(
      offlineExpenseFallbackAllowed(
        new TypeError("network"),
        true,
        { ...complete, baselineComplete: false }
      )
    ).toBe(false);
  });

  it.each([401, 403, 404])("never exposes cached financial data after HTTP %s", (status) => {
    expect(
      offlineExpenseFallbackAllowed(
        new ApiClientError(status, `HTTP_${status}`),
        true,
        complete
      )
    ).toBe(false);
    expect(
      offlineExpenseFallbackAllowed(
        new ApiClientError(status, `HTTP_${status}`),
        false,
        complete
      )
    ).toBe(false);
  });

  it("requires a fresh authorized response after a persisted denial", () => {
    const denied = {
      ...complete,
      authorizationState: "denied" as const,
      authorizationCheckedAt: "2026-07-24T02:00:00.000Z"
    };
    expect(offlineExpenseFallbackAllowed(new TypeError("offline"), false, denied)).toBe(false);
    expect(offlineExpenseFallbackAllowed(new ApiClientError(503, "HTTP_503"), true, denied)).toBe(false);
  });

  it("deduplicates canonical mirrors and keeps exact child/month filters", () => {
    const mirrors = syncedExpenseMirrors(
      [
        row(),
        row({ localId: "local-duplicate" }),
        row({ localId: "pending", canonicalId: "expense-2", syncState: "pending" }),
        row({
          localId: "other-child",
          canonicalId: "expense-3",
          childId: "child-2"
        }),
        row({
          localId: "other-month",
          canonicalId: "expense-4",
          payload: { ...row().payload, spentOn: "2026-06-30" }
        })
      ],
      "child-1",
      "2026-07"
    );
    expect(mirrors.map((expense) => expense.id)).toEqual(["expense-1"]);
  });

  it("preserves receipt/import provenance in cached mirrors", () => {
    const [mirror] = syncedExpenseMirrors(
      [
        row({
          payload: {
            ...row().payload,
            source: "receipt",
            createdByUserId: "user-1",
            payerUserId: "user-2"
          }
        })
      ],
      "child-1",
      "2026-07"
    );
    expect(mirror).toMatchObject({
      source: "receipt",
      createdByUserId: "user-1",
      payerUserId: "user-2"
    });
  });
});
