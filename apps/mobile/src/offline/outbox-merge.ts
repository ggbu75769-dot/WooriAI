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

/**
 * 라운드 57 QA(P2-4) — 병합으로 **되살아나는** 행이 앞선 실패의 흔적을 물려받지 않게 한다.
 *
 * 준비템 상태 큐가 이미 쓰는 규칙과 같다(아래 `mergeItemStatusMutation`): 새로 접혀 들어온 편집은
 * **새 의사 표시**라, 앞선 값이 쌓아 둔 백오프(`attemptCount`/`nextRetryAt`)나 실패 문구·사유
 * (`lastError`/`lastErrorStatus`/`lastErrorCode`)에 갇히면 안 된다. 스프레드(`...pendingUpdate`)로
 * 그 값들이 그대로 넘어오면 두 가지가 깨진다:
 *
 *  - 사용자가 값을 고쳐 400을 벗어난 행이 여전히 옛 status/code를 들고 있어, 화면이 "다시 보내도
 *    같은 결과예요"(permission-denied.ts의 판정)를 붙인다 — 방금 고친 그 행에 대해 거짓이다.
 *  - `nextRetryAt`이 남아 있으면 방금 누른 편집이 앞선 실패의 백오프가 끝날 때까지 전송되지 않는다.
 *
 * 사용자가 손으로 재시도를 누른 것(`retryFailedMutation`)과 같은 취급이며, 큐에서의 자리
 * (`mutationId`·`createdAt`)는 기존 행 것을 그대로 유지한다 — 순서 역전을 만들지 않으려는 것이
 * 병합의 원래 목적이기 때문이다.
 *
 * ⚠️ **종전에는 `idempotencyKey`도 이 "자리"에 함께 묶여 있었다 → 이제 update 접기에서는 본문이
 * 달라지면 새 키가 나간다.** 근거는 아래 `foldedUpdateIdempotencyKey`에 있다.
 */
const MERGED_RETRY_BUDGET_RESET = {
  attemptCount: 0,
  nextRetryAt: null,
  lastError: null,
  lastErrorStatus: undefined,
  lastErrorCode: undefined
} as const;

/**
 * 라운드 104 B-1 — **접힌 수정이 물려받은 멱등키가 중복 지출을 만들던 자리.**
 *
 * ## 종전 동작과 그 끝
 *
 * update+update 접기는 `{ ...pendingUpdate, payload: … }`였다. 즉 **본문만 갈아 끼우고 키는
 * 기존 행 것을 그대로 들고 나갔다.** 그 조합이 실제로 만드는 사슬:
 *
 *  1. 첫 수정 U1(키 K, 본문 B1)이 서버에 **커밋된다**(version v → v+1). 서버는 그 키에
 *     `requestHash(B1)`과 응답을 24시간 보관한다(apps/api …/idempotency/idempotency.interceptor.ts).
 *  2. **응답이 유실된다**(터널·강제 종료·10초 타임아웃). 클라이언트는 transient로 보고 행을
 *     'pending'으로 남긴다 — 큐에는 여전히 키 K가 있다.
 *  3. 사용자가 같은 지출을 한 번 더 고친다 → 접기 → **같은 키 K + 다른 본문 B2**.
 *  4. 서버는 requestHash 불일치를 409 `IDEMPOTENCY_KEY_CONFLICT`로 답한다. 그 409는
 *     `VERSION_CONFLICT`가 아니라 permanent 4xx로 번역돼 행이 'failed'로 굳고,
 *     화면은 재시도 자리를 걷고 "내용을 고쳐 새로 기록하거나 버려 주세요"를 세운다.
 *  5. 그 안내를 따르면 서버에는 이미 B1이 반영된 지출이 있으므로 **같은 지출이 두 건**이 된다.
 *     `retryFailedMutation`은 멱등키를 일부러 보존하므로 재시도 버튼이 있었어도 통하지 않는다.
 *
 * ## 이제
 *
 * **접은 결과 본문이 실제로 달라졌으면 새 키(`incoming.idempotencyKey`)로 나간다.** 그것이
 * 멱등키의 뜻이다 — 같은 키는 "같은 요청의 재전송"을 뜻하고, 본문이 바뀌면 그것은 다른 요청이다.
 * 새 키를 만들지 않고 **incoming 행이 이미 들고 온 키**를 쓴다: `recordLocalUpdate`가 방금 발급한
 * 값이라 이 모듈은 시계도 난수도 건드리지 않는 순수 함수로 남는다.
 *
 * 그러면 위 사슬의 5번이 사라진다. 서버는 이미 v+1이고 이 요청의 `expectedVersion`은 v이므로
 * 409 **VERSION_CONFLICT**로 떨어지고, 그것은 **이미 설계된 회복 경로**다(충돌 3지선다 —
 * app/sync-status.tsx). 같은 사고에서 delete 병합이 새 행(`return [incoming]`)을 만들어 새 키를
 * 받고 바로 그 경로로 가는 것과 대칭이 맞는다 — 종전의 비대칭이 update 접기 하나였다.
 *
 * ## 본문이 같으면 키를 그대로 둔다
 *
 * 접었는데 값이 한 글자도 안 바뀐 경우(같은 값 다시 저장)는 정의상 **같은 요청의 재전송**이다.
 * 새 키를 발급하면 그 요청이 서버에 이미 커밋된 B1과 부딪혀 불필요한 VERSION_CONFLICT를 만든다.
 * 키를 유지하면 서버가 보관해 둔 응답을 그대로 돌려주고(멱등 재생) 행이 조용히 확정된다.
 *
 * ⚠️ **create 접기에는 이 처방을 쓰지 않는다.** 생성이 서버에 닿은 뒤 키를 바꾸면 그것이 곧
 * **중복 지출 생성**이다(생성에는 충돌을 막아 줄 `expectedVersion` 게이트가 없다). 그래서 위
 * `pendingCreate` 갈래는 한 글자도 바뀌지 않았다.
 */
function foldedUpdateIdempotencyKey(
  pendingUpdate: MutationOutboxRow,
  incoming: MutationOutboxRow,
  mergedPayload: ExpensePayload
): string {
  return isSameExpensePayload(pendingUpdate.payload, mergedPayload)
    ? pendingUpdate.idempotencyKey
    : incoming.idempotencyKey;
}

/**
 * 접기 전후의 payload가 실제로 같은가 — 얕은 비교로 충분하다. `ExpensePayload`의 값은 전부
 * 원시값(문자열·숫자·boolean·null)이고 중첩 객체가 없다(src/offline/types.ts).
 */
function isSameExpensePayload(before: ExpensePayload | null, after: ExpensePayload | null): boolean {
  if (before === after) return true;
  if (!before || !after) return false;
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  for (const key of keys) {
    if ((before as Record<string, unknown>)[key] !== (after as Record<string, unknown>)[key]) return false;
  }
  return true;
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
        payload: { ...(pendingCreate.payload as ExpensePayload), ...(incoming.payload as ExpensePayload) },
        ...MERGED_RETRY_BUDGET_RESET
      };
      return [merged];
    }

    const pendingUpdate = existing.find((mutation) => mutation.operation === "update");
    if (pendingUpdate) {
      const mergedPayload: ExpensePayload = {
        ...(pendingUpdate.payload as ExpensePayload),
        ...(incoming.payload as ExpensePayload)
      };
      const merged: MutationOutboxRow = {
        ...pendingUpdate,
        payload: mergedPayload,
        // 라운드 104 B-1: 본문이 달라졌으면 키도 새로 나간다(근거 전문은 위
        // foldedUpdateIdempotencyKey 머리말 — 종전에는 기존 키를 물려받아 409
        // IDEMPOTENCY_KEY_CONFLICT로 굳었고, 화면의 안내가 중복 지출을 만들었다).
        idempotencyKey: foldedUpdateIdempotencyKey(pendingUpdate, incoming, mergedPayload),
        ...MERGED_RETRY_BUDGET_RESET
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
    // 라운드 57: 구조화된 실패 사유도 재시도 예산과 같은 운명이다 -- 스프레드로 낡은
    // status/code가 pending 행에 눌러앉으면 다음 판정이 지난 실패를 이번 시도의 사실로 읽는다.
    lastErrorStatus: undefined,
    lastErrorCode: undefined,
    updatedAt: incoming.updatedAt
  };
  return [...inFlightRows, merged];
}
