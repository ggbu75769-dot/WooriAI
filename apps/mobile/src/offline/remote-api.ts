import {
  createExpenseWithIdempotency,
  deleteExpenseWithVersion,
  ExpenseHttpError,
  ExpenseVersionConflictError,
  updateExpenseWithVersion,
  type Expense,
  type ExpenseConflictSnapshot
} from "../api/client";
import { RemotePermanentError, RemoteVersionConflictError } from "./errors";
import type { ConflictSnapshot, ExpensePayload } from "./types";
import type { RemoteExpenseApi } from "./sync-engine";

function toExpensePatch(payload: ExpensePayload) {
  return {
    categoryId: payload.categoryId,
    amountKrw: payload.amountKrw,
    spentOn: payload.spentOn,
    itemName: payload.itemName,
    memo: payload.memo ?? undefined,
    expenseType: payload.expenseType
  };
}

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
      id: expense.id,
      version: expense.version,
      childId: expense.childId,
      categoryId: expense.categoryId,
      amountKrw: expense.amountKrw,
      spentOn: expense.spentOn,
      itemName: expense.itemName,
      merchant: expense.merchant,
      memo: expense.memo,
      expenseType: expense.expenseType === "refund" ? undefined : expense.expenseType
    }
  };
}

/**
 * R19-H: 5xx는 permanent가 아니다. client.ts는 409를 제외한 모든 비-2xx를 하나의
 * `ExpenseHttpError`로 접어서 던지므로, status를 보지 않고 전부 `RemotePermanentError`로
 * 번역하면 서버가 잠깐 502/503을 뱉는 사이의 지출까지 flushOutbox가 `sync_state='failed'`로
 * 파킹해 버린다(= 사용자가 직접 '재시도'를 누르기 전까지 큐에 묶임). errors.ts의 분류 계약
 * (RemotePermanentError는 non-retryable 4xx, 5xx/네트워크/타임아웃은 transient)대로
 * 4xx만 permanent로 번역하고 5xx는 원본 그대로 재던진다 -- transient는 전용 클래스 없이
 * "위 두 타입 중 어느 것도 아님"으로 표현되므로(errors.ts 말미 주석) 새 래퍼가 필요 없다.
 */
function rethrowAsSyncEngineError(error: unknown): never {
  if (error instanceof ExpenseVersionConflictError) {
    throw new RemoteVersionConflictError(toEngineConflictSnapshot(error.current));
  }
  if (error instanceof ExpenseHttpError && error.status < 500) {
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
          {
            categoryId: payload.categoryId,
            amountKrw: payload.amountKrw,
            spentOn: payload.spentOn,
            itemName: payload.itemName,
            merchant: payload.merchant ?? undefined,
            paymentMethod: payload.paymentMethod,
            memo: payload.memo ?? undefined,
            linkedItemTemplateId: payload.linkedItemTemplateId ?? undefined,
            expenseType: payload.expenseType
          },
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
          toExpensePatch(payload),
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
