import {
  createExpenseWithIdempotency,
  deleteExpenseWithVersion,
  ExpenseHttpError,
  ExpenseVersionConflictError,
  updateExpenseWithVersion,
  updateItemStatus,
  type Expense,
  type ExpenseConflictSnapshot
} from "../api/client";
import { apiErrorMessage } from "../api/api-error";
// 라운드 51 C-10: 준비템 상태 PATCH는 requestJson을 타므로 ExpenseHttpError가 아니라
// ApiHttpError를 던진다(아래 rethrowItemStatusError 주석). 위 줄과 합치지 않는 이유는
// api-error.test.ts가 그 import 줄을 문자 그대로 고정해 두었기 때문이다.
import { ApiHttpError } from "../api/api-error";
import { RemotePermanentError, RemoteVersionConflictError } from "./errors";
import type { ConflictSnapshot, ExpensePayload } from "./types";
import type { RemoteSyncApi } from "./sync-engine";

/**
 * 라운드 48 QA(P2-6): `paymentMethod`를 함께 보낸다.
 *
 * 없어서 무슨 일이 있었나: 충돌 해소 ③ "두 값 나란히 보기"는 결제 수단도 비교 항목으로 내놓고
 * (`diffExpenseFields`), 사용자가 고른 값이 그대로 병합 payload가 되어 이 update로 나간다.
 * 그런데 여기서 그 필드를 빼고 보내면 서버는 자기 값을 그대로 들고 있는다 — 화면은 고르라고
 * 하고, 무엇을 고르든 결제 수단만은 바뀌지 않는 **조용한 무시**였다.
 *
 * 서버가 이 키를 받게 된 것도 같은 라운드다(apps/api UpdateExpenseDto). 그 전에는 실어 보낼
 * 수도 없었다 — 전역 ValidationPipe가 `forbidNonWhitelisted`라 모르는 키가 하나라도 있으면
 * 요청 전체가 400으로 떨어졌기 때문이다.
 *
 * 라운드 49 C-03: `merchant`가 정확히 같은 이유로 합류한다 — `diffExpenseFields`의 표시 집합에
 * 처음부터 있던 필드인데 여기서 빠져 있어, 충돌 화면에서 판매처를 골라도 서버 값이 그대로
 * 남았다. 같은 라운드에 지출 상세의 판매처 편집도 이 경로로 나간다. `memo`와 같은 정규화를
 * 쓴다: 빈 문자열은 그대로 보내 서버가 null로 정리하게 하고(= "지웠다"), null/미지정만
 * undefined로 접어 키 자체를 빼 서버 값을 건드리지 않는다.
 *
 * 여기 **없는** 것들과 그 이유: `childId`·`linkedItemTemplateId`·`linkedProductLinkId`는 서버
 * UpdateExpenseDto에 자리가 없다(수정 대상이 아니다). 실으면 forbidNonWhitelisted로 400이므로
 * 이 누락은 계약이지 버그가 아니다.
 */
function toExpensePatch(payload: ExpensePayload) {
  return {
    categoryId: payload.categoryId,
    amountKrw: payload.amountKrw,
    spentOn: payload.spentOn,
    itemName: payload.itemName,
    merchant: payload.merchant ?? undefined,
    memo: payload.memo ?? undefined,
    paymentMethod: payload.paymentMethod,
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
      /**
       * 라운드 48 QA(P2-6): 서버 스냅숏이 결제 수단을 싣게 됐으므로(apps/api
       * finance/expense-snapshot.ts) 여기서도 옮긴다. 옮기지 않으면 로컬 대기 행에는 값이 있고
       * 서버 쪽은 키 자체가 없어, "두 값 나란히 보기"가 **바꾼 적 없는 결제 수단을 매번 충돌
       * 항목으로** 띄우고 서버 값은 "없음"으로 그렸다 — 서버가 실제로 들고 있는 값을 두고 없다고
       * 말하는 허위 표시이고, 그걸 보고 "다른 기기 값 유지"를 고르면 멀쩡한 값을 지우게 된다.
       *
       * 값이 없을 때(구 서버 응답·로컬 목업) **키 자체를 만들지 않는** 이유: adopt-server는
       * 스냅숏에 있는 키만 골라 로컬 payload에 덮는다(sync-engine.ts
       * `pickPayloadFieldsFromSnapshot`은 `key in snapshot`으로 판정한다). `?? undefined`로
       * 키를 만들어 두면 서버가 말한 적 없는 값이 로컬의 실제 값을 지운다 — 모르면 로컬 값이
       * 남는 것이 그 함수의 계약이다.
       */
      ...(expense.paymentMethod != null ? { paymentMethod: expense.paymentMethod } : {}),
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
/**
 * 코드를 모르는 4xx의 문구. 예전부터 모든 4xx가 쓰던 그 문장 그대로다 -- 화이트리스트에 없는
 * 코드는 여기로 폴백하므로 이 트랙 이전과 동일하게 동작한다.
 */
const PERMANENT_FAILURE_MESSAGE = "요청을 처리하지 못했어요.";

function rethrowAsSyncEngineError(error: unknown): never {
  if (error instanceof ExpenseVersionConflictError) {
    throw new RemoteVersionConflictError(toEngineConflictSnapshot(error.current));
  }
  if (error instanceof ExpenseHttpError && error.status < 500) {
    // 라운드 45 UX-Z: 이 문구는 동기화 상태 화면의 `lastError`로 **그대로 사용자에게 보인다**
    // (sync-engine.ts가 RemotePermanentError.message를 그 자리에 넣는다). 지금까지는 모든 4xx가
    // 한 문장으로 접혀서, 미래 날짜·품목명 누락처럼 사용자가 고치면 바로 풀리는 실패도 "요청을
    // 처리하지 못했어요."라는 막다른 문장으로만 보였다 -- 무엇을 고쳐야 할지 알 수 없으니 실패
    // 행은 큐에 그대로 쌓인다. 아는 코드만 문구로 바꾸고(화이트리스트), 모르는 코드는 예전 문구
    // 그대로다. 분류(permanent/transient)와 status/body는 한 글자도 바뀌지 않는다.
    throw new RemotePermanentError(error.status, apiErrorMessage(error, PERMANENT_FAILURE_MESSAGE), error.body);
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
/**
 * 라운드 51 C-10 — 준비템 상태 PATCH의 오류 번역.
 *
 * 지출 경로(`rethrowAsSyncEngineError`)와 분리한 이유: 이 요청은 `requestJson`을 타므로 던지는
 * 타입이 `ExpenseHttpError`가 아니라 `ApiHttpError`이고(src/api/client.ts), 409 버전 충돌은
 * 애초에 존재하지 않는다(상태는 단일 값이라 서버에 버전 게이트가 없다).
 *
 * 분류 계약은 지출과 **같다**: 4xx만 permanent(재시도 무익 → 'failed' 행), 5xx·네트워크·타임아웃은
 * transient(백오프 자동 재시도). 403은 `apiErrorMessage`가 API_ERROR_MESSAGES.FORBIDDEN 문구를
 * 그대로 실어 주므로, 동기화 상태 화면의 권한 거절 판정(src/offline/permission-denied.ts)이
 * 지출 행과 똑같이 동작한다.
 */
function rethrowItemStatusError(error: unknown): never {
  if (error instanceof ApiHttpError && error.status < 500) {
    throw new RemotePermanentError(error.status, apiErrorMessage(error, PERMANENT_FAILURE_MESSAGE), error.body);
  }
  throw error;
}

export function createClientRemoteExpenseApi(token: string): RemoteSyncApi {
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
            // 라운드 49 C-06: 생성에서만 실린다(수정 계약에는 자리가 없다 — toExpensePatch 주석).
            // ⚠️ DNC-009: 기록·정산용 식별자다. 추천 점수·정렬로 흘러가면 안 된다.
            linkedProductLinkId: payload.linkedProductLinkId ?? undefined,
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
    },

    /**
     * 라운드 51 C-10: 준비템 상태 변경. `itemName`은 큐가 화면 표시용으로 들고 다니는 값이라
     * **요청에 싣지 않는다**(src/offline/types.ts의 ItemStatusPayload 주석). 서버로 나가는 것은
     * status 하나뿐이고, 계약(PATCH /children/:childId/items/:itemTemplateId/status)은 그대로다.
     */
    async setItemStatus(payload) {
      try {
        await updateItemStatus(token, payload.childId, payload.itemTemplateId, payload.status);
      } catch (error) {
        rethrowItemStatusError(error);
      }
    }
  };
}
