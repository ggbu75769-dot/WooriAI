/**
 * MOB-102 (round5a-sprint1-plan.md §3.1) — local offline-first storage schema for expenses.
 *
 * Two tables, mirrored 1:1 against the SQLite schema the design doc specifies:
 *   local_expenses(local_id, canonical_id, child_id, payload, version, sync_state, created_at, updated_at)
 *   mutation_outbox(mutation_id, idempotency_key, operation, target_local_id, payload,
 *                    expected_version, attempt_count, next_retry_at, last_error, created_at)
 *
 * `LocalExpenseRow.pendingDelete` and `.conflictCurrent` are additive bookkeeping fields not
 * called out by name in the design doc's column list, but are needed to represent "this local
 * row has a queued delete" and "this row is in the 409 conflict state with the server's current
 * value attached" without inventing new sync_state values outside the doc's fixed CHECK-IN set
 * ('pending' | 'syncing' | 'synced' | 'failed' | 'conflict'). They live only in this local table,
 * never sent to the server.
 */

export type SyncState = "pending" | "syncing" | "synced" | "failed" | "conflict";

export type MutationOperation = "create" | "update" | "delete";

export type ExpensePaymentMethod = "unknown" | "cash" | "card" | "transfer" | "mobile_pay";
/** 서버 쓰기 계약(Create/UpdateExpenseDto)이 받는 두 값. 사용자가 이 앱에서 고를 수 있는 전부다. */
export type ExpenseKind = "expense" | "gift";
/**
 * GAP-054 라운드 54 P1-2 — **로컬 행이 표현할 수 있는** 구분. 위 두 값에 `refund`가 더해진다.
 *
 * 왜 넓히나: `refund`는 이 앱에서 만들 수 없지만(엑셀 가져오기·서버 경로로만 생긴다) 화면에는
 * 분명히 존재하고, 월 합계에서 빠지는 구분이다(DNC-015 `countsTowardMonthlyTotal`). 그런데
 * `adoptServerExpense`가 로컬 payload에 담을 때 `refund`를 `undefined`로 접었다 — 그 순간
 * 레거시 관례상 **일반 지출**이 되어, 환불 기록을 오프라인에서 한 글자만 고쳐도 기록 탭 합계가
 * 그 금액만큼 부풀고 행의 "환불" 표시가 사라졌다. 서버 값은 멀쩡한데 화면만 거짓을 말하는,
 * DNC-015가 막으려는 바로 그 상태다.
 *
 * 고치는 방향은 "로컬은 사실대로, **전송 직전에만** 접는다"이다. 서버 쓰기 계약은 여전히
 * expense|gift만 받으므로 `refund`를 실으면 400이 된다(forbidNonWhitelisted). 그래서
 * `remote-api.ts`의 `toExpensePatch`·`createExpense`가 나가는 순간에만 키를 없애고(부분 갱신이라
 * 서버 값이 그대로 남는다 — GAP-054 #1이 봉합한 규칙), 화면·합계·충돌 비교는 진짜 값을 본다.
 */
export type LocalExpenseKind = ExpenseKind | "refund";

/** The mutable expense fields an offline create/update carries -- mirrors CreateExpenseDto /
 * UpdateExpenseDto's field set (apps/api/src/finance/dto/expense.dto.ts) minus server-assigned
 * fields (id, source, version). */
export type ExpensePayload = {
  childId: string;
  categoryId: string;
  amountKrw: number;
  spentOn: string;
  itemName: string;
  merchant?: string | null;
  memo?: string | null;
  paymentMethod?: ExpensePaymentMethod;
  linkedItemTemplateId?: string | null;
  /**
   * 라운드 49 C-06: 눌러서 산 제휴 링크 id. **생성에서만 의미가 있다** — 서버
   * UpdateExpenseDto에는 이 키가 없으므로(수정 대상이 아니다) remote-api의 `toExpensePatch`는
   * 이 값을 싣지 않는다. 화면에 그리는 값도 아니고 충돌 비교 항목도 아니다.
   * ⚠️ DNC-009: 기록·정산용이며 추천 점수·정렬에 유입 금지.
   */
  linkedProductLinkId?: string | null;
  /**
   * GAP-054 라운드 54 P1-2: **로컬이 아는 사실 그대로**다(`refund` 포함 — LocalExpenseKind 주석).
   * 서버로 나갈 때만 `remote-api.ts`가 refund를 걷어낸다. 값이 없는 레거시 행은 종전대로
   * 일반 지출로 본다(`countsTowardMonthlyTotal`).
   */
  expenseType?: LocalExpenseKind;
};

/** Snapshot of the server's `current` field from a 409 VERSION_CONFLICT response (design doc
 * §2.2): either the latest live expense, or a soft-deleted tombstone. */
export type ConflictSnapshot =
  | { deleted: false; expense: ExpensePayload & { id: string; version: number } }
  | { deleted: true; id: string; version: number }
  | null;

export type LocalExpenseRow = {
  localId: string;
  /** Server-assigned expense id once a create mutation has synced; null until then. */
  canonicalId: string | null;
  childId: string;
  payload: ExpensePayload;
  /** Server-confirmed version; null until the row has synced at least once. */
  version: number | null;
  syncState: SyncState;
  /** True once a delete has been queued for this row (still present locally until the delete
   * mutation completes, so the sync-status UI can show it as "삭제 대기 중"). */
  pendingDelete: boolean;
  conflictCurrent: ConflictSnapshot;
  lastError: string | null;
  /**
   * 라운드 57 #8 — 실패 **사유의 구조화된 절반**. `lastError`는 사람이 읽는 한 문장이고,
   * 이 두 필드는 코드가 판정에 쓰는 값이다(`src/offline/permission-denied.ts`).
   *
   * 왜 필요했나: 판정이 문자열 비교뿐이던 동안 화면은 "이 실패를 다시 보내면 성공할 수 있나"를
   * `API_ERROR_MESSAGES.FORBIDDEN`과의 **글자 단위 일치** 하나로만 답할 수 있었다. 표의 문구가
   * 한 글자만 바뀌어도 판정이 조용히 무너지고, 403이 아닌 4xx(검증 거부·상한 초과)는 아예
   * 구분할 수 없어 재시도해도 같은 답이 오는 행에 "재시도" 버튼이 남았다.
   *
   * **선택 필드인 이유**: 이 컬럼(v2 마이그레이션)이 생기기 전에 실패한 행이 기기에 남아 있고,
   * 그 행에는 status도 code도 없다. `undefined`/`null`은 "모름"이며, 판정은 그때만 예전 문자열
   * 비교로 폴백한다 — 모르는 행의 동작이 바뀌지 않는 쪽이 안전하다(permission-denied.ts 참고).
   */
  lastErrorStatus?: number | null;
  /** 서버 오류 봉투의 `code`(`{ error: { code } }`). 봉투가 아니면 null = 모름. */
  lastErrorCode?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type MutationOutboxRow = {
  mutationId: string;
  idempotencyKey: string;
  operation: MutationOperation;
  targetLocalId: string;
  /** Full payload for create/update; null for delete (nothing to send but the id/version). */
  payload: ExpensePayload | null;
  expectedVersion: number | null;
  attemptCount: number;
  nextRetryAt: string | null;
  lastError: string | null;
  /** 라운드 57 #8 — `LocalExpenseRow.lastErrorStatus`와 같은 계약(선택 = 모름). */
  lastErrorStatus?: number | null;
  /** 라운드 57 #8 — `LocalExpenseRow.lastErrorCode`와 같은 계약(선택 = 모름). */
  lastErrorCode?: string | null;
  createdAt: string;
  /**
   * True while flushOutbox has this exact mutation row's payload in an active network request
   * (H-3 fix, diff review). A mutation snapshot is read and sent to the server *before* awaiting
   * the response; if an edit for the same local_id arrives in that window and outbox-merge.ts
   * folds it into this same row (same mutationId), the payload actually sent would silently
   * diverge from -- and then, on success, be discarded along with -- the row flushOutbox deletes.
   * Marking a mutation in-flight makes outbox-merge.ts treat it as unmergeable (append a new row
   * instead of folding into it) for exactly the duration of that request, so no edit is ever
   * silently lost. Defaults to false/undefined for any row not currently being sent.
   */
  inFlight?: boolean;
};

/**
 * 라운드 51 C-10 — 준비템 상태 변경(prepared/interested/gifted/not_needed/not_prepared)의
 * 오프라인 큐.
 *
 * ## 왜 `mutation_outbox`에 연산 하나를 더하지 않았나
 *
 * 처음 후보는 `MutationOperation`에 `item_status_set`을 더하는 것이었다. 세 가지가 막았다.
 *
 * 1. `mutation_outbox` 행은 `target_local_id`로 **`local_expenses` 행 하나**를 가리키고,
 *    flushOutboxPass는 그 행이 없는 mutation을 고아로 보고 **지운다**. 준비 상태 변경에는
 *    대응하는 지출 행이 없으므로 첫 pass에서 통째로 사라진다 — 가짜 지출 행을 만들어 우회하면
 *    기록 탭·총액·동기화 배지가 있지도 않은 지출을 세게 된다.
 * 2. 이 큐에는 **버전도 충돌도 없다.** 상태는 단일 값이라 서버가 409를 줄 일이 없고(마지막
 *    쓰기 승리), `expected_version`/`conflict_current`/'conflict' sync_state가 전부 무의미하다.
 *    지출 계약(SyncState CHECK-IN 집합, ConflictSnapshot)을 넓히지 않는 편이 안전하다.
 * 3. 병합 규칙이 정반대다. 지출은 "필드를 접어 합친다"이고, 상태는 **최신 값이 앞 값을 통째로
 *    대체한다**(같은 준비템을 찜했다 준비 완료로 바꾸면 보낼 것은 하나뿐이다).
 *
 * 그래서 같은 데이터베이스 안의 **별도 테이블**로 둔다: 지출 계약은 한 글자도 바뀌지 않고,
 * PRIV-104 세션 정리(clearAll)와 flush 트리거는 그대로 공유한다.
 */
export type ItemStatusValue = "not_prepared" | "prepared" | "gifted" | "not_needed" | "interested";

/**
 * 큐 한 줄이 나르는 값. `itemName`은 **화면 표시 전용**이다 — 동기화 상태 화면이 대기/실패 행에
 * "무엇의 상태인지" 쓰려면 이름이 필요한데, 오프라인에서는 itemTemplateId로 이름을 조회할 방법이
 * 없다(목록 캐시가 비어 있을 수 있다). 서버로는 절대 보내지 않는다(status 하나만 나간다).
 */
export type ItemStatusPayload = {
  childId: string;
  itemTemplateId: string;
  status: ItemStatusValue;
  /** 표시 전용. 서버 요청 본문에 실리지 않는다. */
  itemName: string;
};

/**
 * 이 큐가 쓰는 상태값. 'conflict'가 없는 것이 지출과의 차이다(위 2번). 'synced'도 없다 —
 * 성공한 행은 남기지 않고 지운다(로컬에 보존할 원본이 없다: 진실은 서버 목록 응답이다).
 */
export type ItemStatusSyncState = "pending" | "syncing" | "failed";

export type ItemStatusOutboxRow = {
  mutationId: string;
  childId: string;
  itemTemplateId: string;
  status: ItemStatusValue;
  /** 표시 전용 이름(ItemStatusPayload 참고). */
  itemName: string;
  syncState: ItemStatusSyncState;
  attemptCount: number;
  nextRetryAt: string | null;
  lastError: string | null;
  /** 라운드 57 #8 — `LocalExpenseRow.lastErrorStatus`와 같은 계약(선택 = 모름). 준비템 실패 행도
   * 동기화 상태 화면에서 지출 행과 **같은 판정**을 받는다(403 안내 / 4xx 정직 안내 / 재시도). */
  lastErrorStatus?: number | null;
  /** 라운드 57 #8 — `LocalExpenseRow.lastErrorCode`와 같은 계약(선택 = 모름). */
  lastErrorCode?: string | null;
  createdAt: string;
  updatedAt: string;
  /**
   * 지출 아웃박스의 `inFlight`와 같은 이유(H-3): 요청이 나가 있는 동안 도착한 새 탭을 이 행에
   * 접어 넣으면, 보낸 값과 저장된 값이 갈라진 채 응답 성공과 함께 지워진다. 전송 중인 행은
   * 병합 대상에서 빼고 새 행으로 덧붙인다(outbox-merge.ts).
   */
  inFlight?: boolean;
};

/**
 * `idempotencyKey`가 없는 이유: 이 요청은 **그 자체로 멱등**이다(PATCH …/status는 "이 값으로
 * 맞춰라"이고, 서버 계약에도 Idempotency-Key 자리가 없다 — src/api/client.ts updateItemStatus).
 * 같은 값을 두 번 보내도 결과가 같으므로 재전송 중복 제거 키가 필요 없다.
 */

/**
 * Storage abstraction (design doc §3.1 note: "vitest는 네이티브 SQLite를 못 돌리므로, 저장
 * 계층을 인터페이스로 추상화"). `sqlite-offline-store.ts` implements this against expo-sqlite
 * for the real app; `memory-offline-store.ts` implements it in plain memory for tests and any
 * non-native (web/node) fallback.
 */
export interface OfflineStore {
  insertLocalExpense(row: LocalExpenseRow): Promise<void>;
  getLocalExpense(localId: string): Promise<LocalExpenseRow | null>;
  updateLocalExpense(localId: string, patch: Partial<LocalExpenseRow>): Promise<void>;
  deleteLocalExpense(localId: string): Promise<void>;
  listLocalExpenses(childId?: string): Promise<LocalExpenseRow[]>;

  /**
   * MOB-103b: tiny key-value area for sync bookkeeping that isn't a row of either table --
   * currently only the persisted delta-sync cursor (see delta-sync.ts). Lives in the same
   * store/database as the outbox so all offline state shares one persistence + teardown story.
   */
  getMeta(key: string): Promise<string | null>;
  setMeta(key: string, value: string): Promise<void>;
  deleteMeta(key: string): Promise<void>;

  /**
   * PRIV-104: wipe EVERYTHING this store persists — local_expenses, mutation_outbox, and the
   * whole sync_meta area (which also removes the delta-sync cursor). Called on session identity
   * change (logout / account switch / demo-session toggle, see session-teardown.ts) so the next
   * account never sees the previous account's offline rows or has its pending mutations flushed
   * under the new account's token. Do NOT call this directly from flush/UI code paths — go
   * through sync-engine.ts's `wipeOfflineStore`, which sequences the wipe against any in-flight
   * outbox flush.
   */
  clearAll(): Promise<void>;

  insertOutboxMutation(row: MutationOutboxRow): Promise<void>;
  getOutboxMutation(mutationId: string): Promise<MutationOutboxRow | null>;
  updateOutboxMutation(mutationId: string, patch: Partial<MutationOutboxRow>): Promise<void>;
  deleteOutboxMutation(mutationId: string): Promise<void>;
  /** All outbox rows in creation order (the order flush must send them in, per §3.2). */
  listOutboxMutations(): Promise<MutationOutboxRow[]>;
  listOutboxMutationsForLocalId(localId: string): Promise<MutationOutboxRow[]>;

  /**
   * 라운드 51 C-10 준비템 상태 큐(`item_status_outbox`). 지출 두 테이블과 같은 데이터베이스에
   * 살고, `clearAll`이 함께 비운다(PRIV-104).
   */
  insertItemStatusMutation(row: ItemStatusOutboxRow): Promise<void>;
  updateItemStatusMutation(mutationId: string, patch: Partial<ItemStatusOutboxRow>): Promise<void>;
  deleteItemStatusMutation(mutationId: string): Promise<void>;
  /** 생성 순서 그대로(= flush가 보내는 순서). */
  listItemStatusMutations(): Promise<ItemStatusOutboxRow[]>;
  /** 같은 (childId, itemTemplateId)에 걸린 행들 — 병합 규칙이 보는 집합. */
  listItemStatusMutationsForItem(childId: string, itemTemplateId: string): Promise<ItemStatusOutboxRow[]>;
}

export function generateOfflineId(prefix: string): string {
  const random = Math.random().toString(36).slice(2, 10);
  const counter = (generateOfflineId as { counter?: number }).counter ?? 0;
  (generateOfflineId as { counter?: number }).counter = counter + 1;
  return `${prefix}-${Date.now().toString(36)}-${counter}-${random}`;
}
