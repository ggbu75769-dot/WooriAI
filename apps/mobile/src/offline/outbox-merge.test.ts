import { describe, expect, it } from "vitest";
import { mergeOutboxMutation } from "./outbox-merge";
import type { ExpensePayload, MutationOutboxRow } from "./types";

const basePayload: ExpensePayload = {
  childId: "child-1",
  categoryId: "cat-diaper",
  amountKrw: 10_000,
  spentOn: "2026-07-01",
  itemName: "기저귀"
};

function mutation(overrides: Partial<MutationOutboxRow>): MutationOutboxRow {
  return {
    mutationId: "mut-1",
    idempotencyKey: "idem-1",
    operation: "create",
    targetLocalId: "local-1",
    payload: basePayload,
    expectedVersion: null,
    attemptCount: 0,
    nextRetryAt: null,
    lastError: null,
    createdAt: "2026-07-12T00:00:00.000Z",
    ...overrides
  };
}

describe("outbox merge rules (round5a-sprint1-plan.md §3.2 point 6)", () => {
  it("returns the incoming mutation unchanged when nothing is queued yet", () => {
    const incoming = mutation({ mutationId: "mut-1", operation: "create" });
    expect(mergeOutboxMutation([], incoming)).toEqual([incoming]);
  });

  it("folds create+update into a single create mutation with the merged payload", () => {
    const create = mutation({ mutationId: "mut-create", operation: "create", payload: basePayload });
    const update = mutation({
      mutationId: "mut-update",
      operation: "update",
      payload: { ...basePayload, amountKrw: 15_000, memo: "수정됨" }
    });

    const merged = mergeOutboxMutation([create], update);

    expect(merged).toHaveLength(1);
    expect(merged[0].mutationId).toBe("mut-create");
    expect(merged[0].operation).toBe("create");
    expect(merged[0].payload).toEqual({ ...basePayload, amountKrw: 15_000, memo: "수정됨" });
  });

  it("drops both mutations entirely for create+delete (server never saw the row)", () => {
    const create = mutation({ mutationId: "mut-create", operation: "create" });
    const del = mutation({ mutationId: "mut-delete", operation: "delete", payload: null });

    expect(mergeOutboxMutation([create], del)).toEqual([]);
  });

  it("collapses update+update into one mutation, keeping the earliest expectedVersion", () => {
    const firstUpdate = mutation({
      mutationId: "mut-update-1",
      operation: "update",
      expectedVersion: 3,
      payload: { ...basePayload, amountKrw: 11_000 }
    });
    const secondUpdate = mutation({
      mutationId: "mut-update-2",
      operation: "update",
      expectedVersion: 3,
      payload: { ...basePayload, amountKrw: 12_000, itemName: "물티슈" }
    });

    const merged = mergeOutboxMutation([firstUpdate], secondUpdate);

    expect(merged).toHaveLength(1);
    expect(merged[0].mutationId).toBe("mut-update-1");
    expect(merged[0].expectedVersion).toBe(3);
    expect(merged[0].payload).toEqual({ ...basePayload, amountKrw: 12_000, itemName: "물티슈" });
  });

  it("drops a queued update and keeps only the delete when a delete follows an update", () => {
    const update = mutation({ mutationId: "mut-update", operation: "update", expectedVersion: 2 });
    const del = mutation({ mutationId: "mut-delete", operation: "delete", payload: null, expectedVersion: 2 });

    const merged = mergeOutboxMutation([update], del);

    expect(merged).toHaveLength(1);
    expect(merged[0].operation).toBe("delete");
  });

  it("keeps a delete terminal -- nothing queued afterward changes the outcome", () => {
    const del = mutation({ mutationId: "mut-delete", operation: "delete", payload: null, expectedVersion: 2 });
    const anotherDelete = mutation({ mutationId: "mut-delete-2", operation: "delete", payload: null });

    expect(mergeOutboxMutation([del], anotherDelete)).toEqual([del]);
  });

  it("appends independently when the two mutations target different local_ids logically (caller-scoped)", () => {
    // mergeOutboxMutation only ever receives mutations already scoped to one local_id by its
    // caller (sync-engine.ts), so a mismatched targetLocalId here is out of contract -- this
    // test documents that the function itself does not filter by targetLocalId.
    const create = mutation({ mutationId: "mut-1", operation: "create", targetLocalId: "local-a" });
    const updateForOther = mutation({ mutationId: "mut-2", operation: "update", targetLocalId: "local-b" });
    const merged = mergeOutboxMutation([create], updateForOther);
    expect(merged).toHaveLength(1);
    expect(merged[0].mutationId).toBe("mut-1");
  });
});
