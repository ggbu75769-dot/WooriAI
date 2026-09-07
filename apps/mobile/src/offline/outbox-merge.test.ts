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

/**
 * 라운드 104 B-1 — **접힌 수정의 멱등키.**
 *
 * 여기서 무는 것은 병합 규칙 한 줄이고, 그 규칙이 실제 사슬에서 무엇을 막는지는 값으로
 * 도는 통합 테스트가 따로 문다(folded-update-idempotency.test.ts — "첫 수정 커밋 후 응답
 * 유실 → 재수정 → 중복이 생기지 않는다").
 *
 * 종전에는 update+update 접기가 `{ ...pendingUpdate, payload: … }`라 **기존 행의 키가
 * 살아남았다** → 이제 접은 결과 본문이 달라지면 새 키(incoming의 것)로 나간다. 근거 전문은
 * outbox-merge.ts의 `foldedUpdateIdempotencyKey` 머리말에 있다.
 */
describe("라운드 104 B-1 접힌 update의 멱등키", () => {
  it("본문이 달라지면 새 키로 나간다 — 같은 키는 '같은 요청의 재전송'이라는 뜻이기 때문이다", () => {
    const pending = mutation({
      mutationId: "mut-update-1",
      idempotencyKey: "idem-첫번째",
      operation: "update",
      expectedVersion: 3,
      payload: { ...basePayload, amountKrw: 11_000 }
    });
    const second = mutation({
      mutationId: "mut-update-2",
      idempotencyKey: "idem-두번째",
      operation: "update",
      expectedVersion: 3,
      payload: { ...basePayload, amountKrw: 12_000 }
    });

    const [merged] = mergeOutboxMutation([pending], second);

    // 새 키는 **만들지 않는다** — incoming 행이 이미 들고 온 값을 쓴다(이 모듈은 순수 함수다).
    expect(merged.idempotencyKey).toBe("idem-두번째");
    // 큐에서의 자리(순서)는 종전 그대로다 — 바뀐 것은 키 하나다.
    expect(merged.mutationId).toBe("mut-update-1");
    expect(merged.createdAt).toBe(pending.createdAt);
    expect(merged.expectedVersion).toBe(3);
    expect(merged.payload).toEqual({ ...basePayload, amountKrw: 12_000 });
  });

  it("본문이 한 글자도 안 바뀌면 키를 유지한다 — 그것은 정말로 같은 요청의 재전송이다", () => {
    const pending = mutation({
      mutationId: "mut-update-1",
      idempotencyKey: "idem-첫번째",
      operation: "update",
      expectedVersion: 3,
      payload: { ...basePayload, amountKrw: 11_000 }
    });
    // 같은 값을 다시 저장(사용자가 고쳤다가 되돌렸거나, 같은 화면에서 저장을 두 번 눌렀다).
    const again = mutation({
      mutationId: "mut-update-2",
      idempotencyKey: "idem-두번째",
      operation: "update",
      expectedVersion: 3,
      payload: { ...basePayload, amountKrw: 11_000 }
    });

    const [merged] = mergeOutboxMutation([pending], again);

    expect(merged.idempotencyKey).toBe("idem-첫번째");
    expect(merged.payload).toEqual({ ...basePayload, amountKrw: 11_000 });
  });

  it("부분 patch가 접혀 값이 실제로 달라져도 새 키다 (판정은 접은 **결과**로 한다)", () => {
    const pending = mutation({
      mutationId: "mut-update-1",
      idempotencyKey: "idem-첫번째",
      operation: "update",
      expectedVersion: 3,
      payload: { ...basePayload, memo: null }
    });
    const withMemo = mutation({
      mutationId: "mut-update-2",
      idempotencyKey: "idem-두번째",
      operation: "update",
      expectedVersion: 3,
      payload: { ...basePayload, memo: "영수증 있음" }
    });

    const [merged] = mergeOutboxMutation([pending], withMemo);

    expect(merged.idempotencyKey).toBe("idem-두번째");
    expect(merged.payload).toEqual({ ...basePayload, memo: "영수증 있음" });
  });

  it("⚠️ create 접기는 키를 절대 바꾸지 않는다 — 생성이 서버에 닿은 뒤 키를 바꾸면 그것이 곧 중복 지출이다", () => {
    const pendingCreate = mutation({
      mutationId: "mut-create",
      idempotencyKey: "idem-생성",
      operation: "create",
      payload: basePayload
    });
    const update = mutation({
      mutationId: "mut-update",
      idempotencyKey: "idem-수정",
      operation: "update",
      payload: { ...basePayload, amountKrw: 15_000 }
    });

    const [merged] = mergeOutboxMutation([pendingCreate], update);

    expect(merged.operation).toBe("create");
    // 본문은 접혔지만 키는 생성 행의 것 그대로다(수정 접기와 **의도적으로 다르다**).
    expect(merged.payload).toEqual({ ...basePayload, amountKrw: 15_000 });
    expect(merged.idempotencyKey).toBe("idem-생성");
  });

  it("delete는 종전대로 새 행이라 새 키를 받는다 — update 접기가 이 대칭을 되찾은 것이다", () => {
    const pendingUpdate = mutation({
      mutationId: "mut-update",
      idempotencyKey: "idem-수정",
      operation: "update",
      expectedVersion: 3
    });
    const del = mutation({
      mutationId: "mut-delete",
      idempotencyKey: "idem-삭제",
      operation: "delete",
      payload: null,
      expectedVersion: 3
    });

    const [merged] = mergeOutboxMutation([pendingUpdate], del);

    expect(merged.operation).toBe("delete");
    expect(merged.idempotencyKey).toBe("idem-삭제");
  });
});
