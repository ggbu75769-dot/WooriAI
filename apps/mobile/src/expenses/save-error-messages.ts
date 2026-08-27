/**
 * EXP-124: 지출 저장/수정/삭제 실패 문구 단일 소스.
 *
 * 이 세 뮤테이션은 지금까지 실패해도 화면이 아무 말도 하지 않았다(`onSuccess`만 배선되어 있었다).
 * 사용자 입장에서 "저장하기"를 눌렀는데 시트가 그대로 남아 있으면 저장이 된 건지 안 된 건지
 * 알 수 없고, 같은 지출을 두 번 기록하거나(중복) 그냥 포기하게 된다 — 핵심 루프(지출 기록)의
 * 첫 고리가 조용히 끊기는 자리다.
 *
 * 실패 원인은 크게 셋이다.
 * 1) 입력값이 아직 유효하지 않음 — 화면의 mutationFn이 스스로 던지는 가드
 *    (`INVALID_EXPENSE_INPUT_ERROR`). 사용자가 고칠 수 있는 문제라 무엇을 볼지 알려준다.
 * 2) 수정/삭제할 로컬 행이 아직 준비되지 않음(`EXPENSE_NOT_READY_ERROR`) — 서버에서 불러온
 *    지출을 로컬 테이블에 adopt 하는 중이다. 잠깐 기다리면 풀리는 상태다.
 * 3) 그 밖의 모든 실패 — SQLite 쓰기 실패, 저장소 초기화 실패 등. 원인을 사용자가 알 수도,
 *    고칠 수도 없으므로 "다시 시도해 주세요"까지만 안내한다.
 *
 * 문구 톤은 DNC-018을 따른다: 해요체 존댓말, 사용자를 탓하지 않고("잘못 입력하셨어요" 금지),
 * 다음에 무엇을 하면 되는지만 담는다. 실제 문구는 이미 앱 곳곳(app/budget.tsx,
 * app/settings/children.tsx)에서 쓰는 "저장하지 못했어요. 잠시 후 다시 시도해 주세요."와
 * 같은 문형을 유지해 같은 실패가 화면마다 다르게 들리지 않게 한다.
 *
 * 이 모듈은 react-native/react-query에 의존하지 않는 순수 모듈이라 vitest에서 그대로 테스트한다
 * (화면 자체는 렌더할 수 없어 배선은 소스 grep 계약 테스트가 맡는다 — save-error-wiring.test.ts).
 */

/** 어떤 뮤테이션이 실패했는지 — 문구 선택에만 쓰인다. */
export type ExpenseMutationKind = "create" | "update" | "delete";

/**
 * 화면의 mutationFn이 입력 가드에서 던지는 Error 메시지. 화면과 이 모듈이 같은 상수를 쓰므로
 * 매핑이 매직 문자열 비교로 흩어지지 않는다.
 */
export const INVALID_EXPENSE_INPUT_ERROR = "invalid expense";

/** 수정/삭제 대상 로컬 행(adoptServerExpense 결과)이 아직 없을 때 던지는 Error 메시지. */
export const EXPENSE_NOT_READY_ERROR = "missing expense";

/** 입력값이 유효하지 않아 저장을 시작조차 못 한 경우 — 기존 시트 문구를 그대로 유지한다. */
export const EXPENSE_INPUT_INVALID_MESSAGE = "금액과 항목을 확인해 주세요.";

/** 아직 불러오는 중이라 수정/삭제를 시작할 수 없는 경우. */
export const EXPENSE_NOT_READY_MESSAGE = "기록을 불러온 뒤 다시 시도해 주세요.";

/** 새 지출 기록 저장 실패. */
export const EXPENSE_CREATE_FAILED_MESSAGE = "저장하지 못했어요. 잠시 후 다시 시도해 주세요.";

/** 기존 지출 수정 저장 실패. */
export const EXPENSE_UPDATE_FAILED_MESSAGE = "수정한 내용을 저장하지 못했어요. 잠시 후 다시 시도해 주세요.";

/** 지출 삭제 실패. */
export const EXPENSE_DELETE_FAILED_MESSAGE = "삭제하지 못했어요. 잠시 후 다시 시도해 주세요.";

/** 삭제 실패는 화면에 남아 있을 배너 자리가 없어 Alert로 알린다 — 그 제목. */
export const EXPENSE_DELETE_FAILED_ALERT_TITLE = "삭제하지 못했어요";

/**
 * UX-L(A): 삭제 **확인** Alert 문구.
 *
 * 원래 이 네 문구는 지출 상세 화면(app/expenses/[expenseId].tsx)의 confirmDelete 안에 인라인으로
 * 박혀 있었다. 기록 목록의 행 액션시트에서도 같은 삭제를 실행하게 되면서, 그 자리에 문구를 한 벌
 * 더 적으면 두 경로의 확인 문장이 언제든 갈라질 수 있다(같은 파괴적 동작이 화면마다 다르게
 * 물어보는 것은 그 자체로 신뢰를 깎는다). 그래서 실패 문구와 같은 이 모듈로 올려 두 화면이
 * 같은 상수를 읽게 한다 — 문구 자체는 상세 화면이 쓰던 것 그대로다.
 */
export const EXPENSE_DELETE_CONFIRM_TITLE = "지출 삭제";
export const EXPENSE_DELETE_CONFIRM_MESSAGE = "이 지출 기록을 삭제할까요?";
export const EXPENSE_DELETE_CONFIRM_CANCEL_LABEL = "취소";
export const EXPENSE_DELETE_CONFIRM_ACTION_LABEL = "삭제";

const FALLBACK_MESSAGE_BY_KIND: Record<ExpenseMutationKind, string> = {
  create: EXPENSE_CREATE_FAILED_MESSAGE,
  update: EXPENSE_UPDATE_FAILED_MESSAGE,
  delete: EXPENSE_DELETE_FAILED_MESSAGE
};

/**
 * 던져진 값에서 비교 가능한 메시지 문자열을 뽑는다. react-query의 onError는 무엇이든 넘겨줄 수
 * 있어(Error, 문자열, undefined) 방어적으로 읽는다.
 */
function errorMessageOf(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "";
}

/** 입력 가드가 막은 실패인가 — 사용자가 값을 고치면 풀린다. */
export function isInvalidExpenseInputError(error: unknown): boolean {
  return errorMessageOf(error) === INVALID_EXPENSE_INPUT_ERROR;
}

/** 대상 로컬 행이 아직 준비되지 않은 실패인가 — 잠시 뒤 다시 누르면 풀린다. */
export function isExpenseNotReadyError(error: unknown): boolean {
  return errorMessageOf(error) === EXPENSE_NOT_READY_ERROR;
}

/**
 * 실패 원인 → 사용자에게 보여줄 문구. 알 수 없는 실패는 원문(스택/네트워크 메시지)을 절대
 * 그대로 노출하지 않고 뮤테이션 종류별 안내 문구로 대체한다.
 */
export function expenseMutationErrorMessage(kind: ExpenseMutationKind, error: unknown): string {
  if (isInvalidExpenseInputError(error)) return EXPENSE_INPUT_INVALID_MESSAGE;
  if (isExpenseNotReadyError(error)) return EXPENSE_NOT_READY_MESSAGE;
  return FALLBACK_MESSAGE_BY_KIND[kind];
}
