import type { ExpensePayload, ItemStatusOutboxRow, MutationOutboxRow } from "./types";

/**
 * Applies MOB-102 §3.2 point 6's outbox merge rule for a single local_id's queued (unsynced)
 * mutations, given the mutation(s) already queued for that local_id and a new mutation about to
 * be appended. Only mutations for the SAME local_id are ever merged -- mutations for different
 * local_ids are independent and never interact.
 *
 * Explicitly specified by the design doc:
 *   - create + update (create not yet synced) -> single 'create' mutation, payload updated.
 *   - create + delete (create not yet synced) -> both mutations dropped (server never saw it).
 *
 * Extended here for internal consistency (not contradicting the above, just generalizing "merge
 * to minimize server round trips" to the case where two edits land before the first has synced):
 *   - update + update (first update not yet synced) -> collapsed into one 'update' mutation,
 *     keeping the earliest queued expectedVersion (the version the server still has) and the
 *     newest field values.
 *   - delete always wins and clears anything else queued for the local_id, since once a delete
 *     is queued nothing else should still be sent for it.
 *
 * Returns the full replacement mutation list for this local_id (may be empty).
 *
 * H-3 fix (diff review): a mutation currently `inFlight` (flushOutbox has already sent its
 * payload to the server and is awaiting the response -- see sync-engine.ts) is never a valid
 * merge target. Folding a new edit into an in-flight row's payload would silently diverge that
 * row's payload from what was actually sent, and then delete the merged-in edit along with the
 * row once the in-flight request's (unrelated, older) response comes back successful -- a silent
 * data loss. In-flight rows are therefore always passed straight through untouched, and merging
 * only ever considers the remaining (`!inFlight`) rows -- which keeps every already-tested
 * non-in-flight merge rule below byte-for-byte unchanged.
 */
export function mergeOutboxMutation(
  existing: MutationOutboxRow[],
  incoming: MutationOutboxRow
): MutationOutboxRow[] {
  const inFlightRows = existing.filter((mutation) => mutation.inFlight);
  const mergeableRows = existing.filter((mutation) => !mutation.inFlight);
  return [...inFlightRows, ...mergeIntoMergeableRows(mergeableRows, incoming)];
}

function mergeIntoMergeableRows(existing: MutationOutboxRow[], incoming: MutationOutboxRow): MutationOutboxRow[] {
  if (existing.length === 0) {
    return [incoming];
  }

  const pendingCreate = existing.find((mutation) => mutation.operation === "create");
  const pendingDelete = existing.find((mutation) => mutation.operation === "delete");

  if (pendingDelete) {
    // A delete already queued for this local_id is terminal: the item is going away, so
    // nothing queued after it (or the delete itself, replayed) changes the outcome.
    return [pendingDelete];
  }

  if (incoming.operation === "delete") {
    if (pendingCreate) {
      // create+delete before the create ever reached the server -- the server has never
      // heard of this local_id, so both mutations are simply dropped.
      return [];
    }
    // Any queued update(s) are moot once a delete is queued -- drop them, keep only the delete.
    return [incoming];
  }

  if (incoming.operation === "update") {
    if (pendingCreate) {
      // Fold the update's fields into the still-pending create payload instead of sending two
      // requests -- the server receives one create call with the final, up-to-date fields.
      const merged: MutationOutboxRow = {
        ...pendingCreate,
        payload: { ...(pendingCreate.payload as ExpensePayload), ...(incoming.payload as ExpensePayload) }
      };
      return [merged];
    }

    const pendingUpdate = existing.find((mutation) => mutation.operation === "update");
    if (pendingUpdate) {
      const merged: MutationOutboxRow = {
        ...pendingUpdate,
        payload: { ...(pendingUpdate.payload as ExpensePayload), ...(incoming.payload as ExpensePayload) }
      };
      return existing.map((mutation) => (mutation.mutationId === pendingUpdate.mutationId ? merged : mutation));
    }

    return [...existing, incoming];
  }

  // incoming.operation === "create" while something else is already queued for this local_id
  // shouldn't happen in practice (a local_id is only ever created once), but stay additive and
  // defensive rather than throwing.
  return [...existing, incoming];
}

/**
 * 라운드 51 C-10 — 준비템 **상태** 큐의 병합 규칙(src/offline/types.ts의 ItemStatusOutboxRow).
 *
 * 지출과 규칙이 정반대인 이유: 상태는 필드 여럿을 접어 합치는 값이 아니라 **단일 값**이다.
 * 같은 준비템을 "찜하기 → 준비했어요"로 잇달아 누르면 서버에 보낼 것은 마지막 하나뿐이고,
 * 두 번 보내면 중간 상태가 잠깐 서버에 남았다 사라지는 무의미한 왕복이 된다. 그래서 같은
 * (childId, itemTemplateId)의 대기 행은 **최신 값으로 대체**한다 — 마지막 쓰기 승리.
 *
 * 대체하면서도 지키는 것 두 가지.
 *  - **큐에서의 자리**(mutationId·createdAt)는 기존 행 것을 그대로 쓴다. 새 행으로 갈아 끼우면
 *    같은 준비템을 다시 누를 때마다 그 항목이 큐 맨 뒤로 밀려, 앞서 대기하던 다른 항목보다
 *    늦게 나가는 순서 역전이 생긴다.
 *  - **재시도 예산은 초기화**한다(attemptCount=0, nextRetryAt=null, lastError=null,
 *    syncState='pending'). 새로 누른 것은 새 의사 표시라, 앞선 값이 쌓아 둔 백오프나 'failed'
 *    파킹에 갇히면 안 된다 — 사용자가 손으로 재시도를 누른 것(retryFailedMutation)과 같은 취급이다.
 *
 * `inFlight` 행은 병합 대상이 아니다(지출 H-3와 같은 이유): 이미 보낸 값과 저장된 값이 갈라진
 * 채로, 그 응답이 성공하면 뒤늦게 누른 값까지 함께 지워진다. 전송 중이면 새 행을 덧붙이고,
 * flush가 다음 pass에서 그 행을 보낸다.
 *
 * 반환값은 이 (childId, itemTemplateId)에 대한 **교체용 전체 목록**이다(지출 쪽 mergeOutboxMutation과
 * 같은 계약).
 */
export function mergeItemStatusMutation(
  existing: ItemStatusOutboxRow[],
  incoming: ItemStatusOutboxRow
): ItemStatusOutboxRow[] {
  const inFlightRows = existing.filter((row) => row.inFlight);
  const mergeable = existing.filter((row) => !row.inFlight);
  if (mergeable.length === 0) {
    return [...inFlightRows, incoming];
  }
  // 대기 행이 여럿일 수는 없지만(항상 하나로 접힌다), 방어적으로 가장 오래된 것 하나만 남긴다.
  const [target] = mergeable;
  const merged: ItemStatusOutboxRow = {
    ...target,
    status: incoming.status,
    itemName: incoming.itemName,
    syncState: "pending",
    attemptCount: 0,
    nextRetryAt: null,
    lastError: null,
    updatedAt: incoming.updatedAt
  };
  return [...inFlightRows, merged];
}
