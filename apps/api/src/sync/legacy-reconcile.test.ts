import { describe, expect, it, vi } from "vitest";
import { idempotencyRequestHash } from "../common/idempotency/idempotency-request";
import { SyncService } from "./sync.service";

const mutation = {
  sourceLocalId: "local-1",
  sourceMutationId: "mutation-1",
  idempotencyKey: "idem-1",
  method: "POST" as const,
  path: "/children/67ec851a-5920-4f91-9b17-4ec6659e91ca/expenses",
  body: {
    categoryId: "category-1",
    amountKrw: 12_000,
    spentOn: "2026-07-17",
    itemName: "기저귀"
  }
};

function serviceWithRows(rows: unknown[]) {
  const findMany = vi.fn(async () => rows);
  const service = new SyncService({
    idempotencyKey: { findMany }
  } as never);
  return { service, findMany };
}

describe("legacy offline reconciliation", () => {
  it("attributes only a current-user idempotency record with the same request hash", async () => {
    const { service, findMany } = serviceWithRows([
      {
        endpoint: "POST:/api/v1/children/:childId/expenses",
        requestHash: idempotencyRequestHash(`/api/v1${mutation.path}`, mutation.body),
        responseJson: { id: "expense-1", version: 1 },
        statusCode: 200,
        expiresAt: new Date(Date.now() + 60_000)
      }
    ]);

    await expect(
      service.reconcileLegacy({ id: "user-a", households: [] } as never, [mutation])
    ).resolves.toEqual({
      results: [
        {
          sourceLocalId: "local-1",
          sourceMutationId: "mutation-1",
          disposition: "already_synced",
          reasonCode: "CURRENT_USER_COMPLETED_REQUEST_MATCH",
          response: { id: "expense-1", version: 1 }
        }
      ]
    });
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId: "user-a", idemKey: "idem-1" }
    }));
  });

  it("does not attribute a missing, expired, or hash-mismatched record", async () => {
    const { service } = serviceWithRows([
      {
        endpoint: "POST:/api/v1/children/:childId/expenses",
        requestHash: idempotencyRequestHash(mutation.path, { ...mutation.body, amountKrw: 99_000 }),
        responseJson: null,
        statusCode: null,
        expiresAt: new Date(Date.now() + 60_000)
      }
    ]);

    await expect(
      service.reconcileLegacy({ id: "user-b", households: [] } as never, [mutation])
    ).resolves.toMatchObject({
      results: [{ disposition: "ambiguous", reasonCode: "IDEMPOTENCY_REQUEST_HASH_MISMATCH" }]
    });
  });
});
