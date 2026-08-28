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

/**
 * 라운드 57 QA(P2-4) — 병합으로 **되살아나는** 행의 재시도 예산·실패 사유.
 *
 * 준비템 상태 큐(mergeItemStatusMutation)는 이미 "새로 누른 것은 새 의사 표시"라는 이유로
 * attemptCount·nextRetryAt·lastError·구조화 사유를 함께 초기화한다. 지출 큐의 두 병합 분기만
 * 스프레드로 옛 값을 그대로 물려받고 있었다 — 사용자가 값을 고쳐 400을 벗어난 행에 지난번
 * status/code가 남아 "다시 보내도 같은 결과예요"가 붙고, 남은 nextRetryAt이 방금 누른 편집을
 * 옛 백오프가 끝날 때까지 붙잡는다.
 */
describe("라운드 57 QA(P2-4) 병합 행의 실패 흔적 초기화", () => {
  const failedFields = {
    attemptCount: 4,
    nextRetryAt: "2026-07-12T00:05:00.000Z",
    lastError: "권한이 없어요. 가족 구성원 여부와 내 역할을 확인해 주세요.",
    lastErrorStatus: 403,
    lastErrorCode: "FORBIDDEN"
  };

  it("create+update: 대기 create가 실패로 파킹돼 있었어도 병합 결과는 새 시도다", () => {
    const create = mutation({ mutationId: "mut-create", operation: "create", ...failedFields });
    const update = mutation({
      mutationId: "mut-update",
      operation: "update",
      payload: { ...basePayload, amountKrw: 15_000 }
    });

    const [merged] = mergeOutboxMutation([create], update);

    // 큐에서의 자리는 그대로다(순서 역전 금지 — 병합의 원래 목적).
    expect(merged.mutationId).toBe("mut-create");
    expect(merged.idempotencyKey).toBe(create.idempotencyKey);
    expect(merged.createdAt).toBe(create.createdAt);
    expect(merged.operation).toBe("create");
    expect(merged.payload).toEqual({ ...basePayload, amountKrw: 15_000 });
    // 실패의 흔적은 하나도 남지 않는다.
    expect(merged.attemptCount).toBe(0);
    expect(merged.nextRetryAt).toBeNull();
    expect(merged.lastError).toBeNull();
    expect(merged.lastErrorStatus).toBeUndefined();
    expect(merged.lastErrorCode).toBeUndefined();
  });

  it("update+update: 앞선 update의 백오프·사유가 뒤 편집에 눌러앉지 않는다", () => {
    const firstUpdate = mutation({
      mutationId: "mut-update-1",
      operation: "update",
      expectedVersion: 2,
      ...failedFields
    });
    const secondUpdate = mutation({
      mutationId: "mut-update-2",
      operation: "update",
      expectedVersion: 5,
      payload: { ...basePayload, memo: "두 번째" }
    });

    const merged = mergeOutboxMutation([firstUpdate], secondUpdate);

    expect(merged).toHaveLength(1);
    expect(merged[0].mutationId).toBe("mut-update-1");
    // 서버가 아직 들고 있는 버전은 앞선 값 그대로다(기존 계약 불변).
    expect(merged[0].expectedVersion).toBe(2);
    expect(merged[0].payload).toEqual({ ...basePayload, memo: "두 번째" });
    expect(merged[0].attemptCount).toBe(0);
    expect(merged[0].nextRetryAt).toBeNull();
    expect(merged[0].lastError).toBeNull();
    expect(merged[0].lastErrorStatus).toBeUndefined();
    expect(merged[0].lastErrorCode).toBeUndefined();
  });

  it("전송 중(inFlight) 행은 여전히 손대지 않는다 -- 그 행의 사유·시도 횟수는 그대로다", () => {
    const inFlight = mutation({ mutationId: "mut-flying", operation: "update", inFlight: true, ...failedFields });
    const update = mutation({ mutationId: "mut-new", operation: "update" });

    const merged = mergeOutboxMutation([inFlight], update);

    expect(merged).toHaveLength(2);
    expect(merged[0]).toEqual(inFlight);
  });
});
