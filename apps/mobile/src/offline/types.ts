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
export type ExpenseKind = "expense" | "gift";

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
  paymentMethodId?: string | null;
  linkedItemTemplateId?: string | null;
  expenseType?: ExpenseKind;
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

  insertOutboxMutation(row: MutationOutboxRow): Promise<void>;
  getOutboxMutation(mutationId: string): Promise<MutationOutboxRow | null>;
  updateOutboxMutation(mutationId: string, patch: Partial<MutationOutboxRow>): Promise<void>;
  deleteOutboxMutation(mutationId: string): Promise<void>;
  /** All outbox rows in creation order (the order flush must send them in, per §3.2). */
  listOutboxMutations(): Promise<MutationOutboxRow[]>;
  listOutboxMutationsForLocalId(localId: string): Promise<MutationOutboxRow[]>;
}

export function generateOfflineId(prefix: string): string {
  const random = Math.random().toString(36).slice(2, 10);
  const counter = (generateOfflineId as { counter?: number }).counter ?? 0;
  (generateOfflineId as { counter?: number }).counter = counter + 1;
  return `${prefix}-${Date.now().toString(36)}-${counter}-${random}`;
}
