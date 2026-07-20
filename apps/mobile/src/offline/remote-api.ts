import {
  createExpenseWithIdempotency,
  deleteExpenseWithVersion,
  ExpenseHttpError,
  ExpenseVersionConflictError,
  updateExpenseWithVersion,
  type Expense,
  type ExpenseConflictSnapshot
} from "../api/client";
import {
  RemoteAuthRequiredError,
  RemotePermanentError,
  RemotePermissionDeniedError,
  RemoteVersionConflictError
} from "./errors";
import { expenseToOfflinePayload } from "./expense-payload";
import { createExpenseSyncBody, updateExpenseSyncBody } from "./expense-sync-request";
import type { ConflictSnapshot } from "./types";
import type { RemoteExpenseApi } from "./sync-engine";

/**
 * The wire/client.ts shape of `current` (design doc §2.2) is `<latest expense> | {id,
 * deleted:true, version}` -- the live-expense case has no `deleted` discriminant of its own.
 * sync-engine.ts's `ConflictSnapshot` instead always discriminates on `deleted` (true/false) for
 * a cleaner switch in the conflict-resolution code, so this adapts one shape to the other.
 */
function toEngineConflictSnapshot(current: ExpenseConflictSnapshot): ConflictSnapshot {
  if (!current) return null;
  if ("deleted" in current && current.deleted) {
    return { deleted: true, id: current.id, version: current.version };
  }
  const expense = current as Expense;
  return {
    deleted: false,
    expense: {
      ...expenseToOfflinePayload(expense),
      id: expense.id,
      version: expense.version,
    }
  };
}

function rethrowAsSyncEngineError(error: unknown): never {
  if (error instanceof ExpenseVersionConflictError) {
    throw new RemoteVersionConflictError(toEngineConflictSnapshot(error.current));
  }
  if (error instanceof ExpenseHttpError) {
    if (error.status === 401) throw new RemoteAuthRequiredError(error.body);
    if (error.status === 403) throw new RemotePermissionDeniedError(error.body);
    throw new RemotePermanentError(error.status, "요청을 처리하지 못했어요.", error.body);
  }
  throw error;
}

function toRemoteCreateResult(expense: Expense) {
  return { id: expense.id, version: expense.version };
}

/**
 * Wires `sync-engine.ts`'s transport-agnostic `RemoteExpenseApi` to `src/api/client.ts`'s
 * version-aware expense functions (which themselves already dispatch real-vs-local-session, see
 * client.ts's `isLocalToken` branching). Kept as a thin adapter so sync-engine.ts and its tests
 * never need to know about client.ts, tokens, or HTTP at all.
 */
export function createClientRemoteExpenseApi(token: string): RemoteExpenseApi {
  return {
    async createExpense(payload, idempotencyKey) {
      try {
        const expense = await createExpenseWithIdempotency(
          token,
          payload.childId,
          createExpenseSyncBody(payload),
          idempotencyKey
        );
        return toRemoteCreateResult(expense);
      } catch (error) {
        rethrowAsSyncEngineError(error);
      }
    },

    async updateExpense(canonicalId, payload, expectedVersion, idempotencyKey) {
      try {
        const expense = await updateExpenseWithVersion(
          token,
          canonicalId,
          updateExpenseSyncBody(payload, expectedVersion),
          expectedVersion,
          idempotencyKey
        );
        return { version: expense.version };
      } catch (error) {
        rethrowAsSyncEngineError(error);
      }
    },

    async deleteExpense(canonicalId, expectedVersion, idempotencyKey) {
      try {
        await deleteExpenseWithVersion(token, canonicalId, expectedVersion, idempotencyKey);
      } catch (error) {
        rethrowAsSyncEngineError(error);
      }
    }
  };
}
