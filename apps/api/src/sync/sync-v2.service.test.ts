import { describe, expect, it, vi } from "vitest";
import { decodeCursorV2 } from "./cursor";
import { SyncService } from "./sync.service";

const householdId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function expenseRow(id: string, updatedAt: Date) {
  return {
    id,
    householdId,
    childId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    categoryId: "category-1",
    amountKrw: 10_000,
    spentOn: new Date("2026-07-24T00:00:00.000Z"),
    itemName: "기저귀",
    merchant: null,
    paymentMethod: "unknown",
    paymentMethodId: null,
    memo: null,
    linkedItemDefinitionId: null,
    expenseCategoryV2Id: null,
    expenseType: "expense",
    source: "manual",
    createdByUserId: "user-a",
    payerUserId: null,
    version: 1,
    deletedAt: null,
    updatedAt
  };
}

describe("SyncService v2 terminal baseline", () => {
  it("advances a terminal page to the immutable baseline even if that row moved after lookup", async () => {
    const baseline = {
      id: "expense-baseline",
      updatedAt: new Date("2026-07-24T02:00:00.000Z")
    };
    const older = expenseRow(
      "expense-older",
      new Date("2026-07-24T01:00:00.000Z")
    );
    const findFirst = vi.fn(async () => baseline);
    // Simulates the baseline row receiving a later updatedAt after findFirst:
    // the frozen query still returns an older row but no longer returns baseline.
    const findMany = vi.fn(async () => [older]);
    const service = new SyncService({
      expense: { findFirst, findMany }
    } as never);

    const result = await service.getChangesV2(
      { id: "user-a", households: [{ id: householdId }] } as never,
      householdId,
      undefined,
      200
    );
    const terminal = decodeCursorV2(result.nextCursor!, householdId);

    expect(result.hasMore).toBe(false);
    expect(terminal.id).toBe(baseline.id);
    expect(terminal.updatedAt).toEqual(baseline.updatedAt);
  });
});
