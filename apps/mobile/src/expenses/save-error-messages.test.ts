import { describe, expect, it } from "vitest";
import { ApiHttpError } from "../api/api-error";
import {
  EXPENSE_CREATE_FAILED_MESSAGE,
  EXPENSE_DELETE_FAILED_ALERT_TITLE,
  EXPENSE_DELETE_FAILED_MESSAGE,
  EXPENSE_INPUT_INVALID_MESSAGE,
  EXPENSE_NOT_READY_ERROR,
  EXPENSE_NOT_READY_MESSAGE,
  EXPENSE_UPDATE_FAILED_MESSAGE,
  expenseMutationErrorMessage,
  INVALID_EXPENSE_INPUT_ERROR,
  isExpenseNotReadyError,
  isInvalidExpenseInputError,
  type ExpenseMutationKind
} from "./save-error-messages";

/**
 * EXP-124: 지출 저장/수정/삭제 실패 문구와 매핑.
 *
 * 여기서 지키려는 것은 세 가지다.
 * 1) 실패가 항상 "무언가 말한다" — 어떤 값이 던져져도(문자열, undefined, 이상한 객체) 빈
 *    문자열이 아닌 안내 문구가 나온다. 무음 실패가 이 티켓의 원인이었다.
 * 2) 내부 오류 원문이 새지 않는다 — SQLite/네트워크 메시지가 그대로 사용자에게 보이면 안 된다.
 * 3) DNC-018 톤 — 해요체 존댓말이고 사용자를 탓하는 표현이 없다.
 */
const ALL_KINDS: ExpenseMutationKind[] = ["create", "update", "delete"];

describe("EXP-124 expense save/update/delete failure copy", () => {
  it("uses the app-wide 해요체 failure phrasing for each mutation", () => {
    expect(EXPENSE_CREATE_FAILED_MESSAGE).toBe("저장하지 못했어요. 잠시 후 다시 시도해 주세요.");
    expect(EXPENSE_UPDATE_FAILED_MESSAGE).toBe("수정한 내용을 저장하지 못했어요. 잠시 후 다시 시도해 주세요.");
    expect(EXPENSE_DELETE_FAILED_MESSAGE).toBe("삭제하지 못했어요. 잠시 후 다시 시도해 주세요.");
    expect(EXPENSE_DELETE_FAILED_ALERT_TITLE).toBe("삭제하지 못했어요");
  });

  it("keeps the existing input-guard copy so the sheet's wording does not shift under users", () => {
    expect(EXPENSE_INPUT_INVALID_MESSAGE).toBe("금액과 항목을 확인해 주세요.");
    expect(EXPENSE_NOT_READY_MESSAGE).toBe("기록을 불러온 뒤 다시 시도해 주세요.");
  });

  // DNC-018: 존댓말 + 비난 없는 톤. 문구가 늘어날 때 톤이 조용히 갈라지는 것을 막는다.
  it("keeps every user-facing message in polite 해요체 without blaming the user", () => {
    const messages = [
      EXPENSE_CREATE_FAILED_MESSAGE,
      EXPENSE_UPDATE_FAILED_MESSAGE,
      EXPENSE_DELETE_FAILED_MESSAGE,
      EXPENSE_INPUT_INVALID_MESSAGE,
      EXPENSE_NOT_READY_MESSAGE
    ];
    for (const message of messages) {
      expect(message, message).toMatch(/(어요|세요)\.$/);
      // 반말/명령형·비난 어휘 금지.
      for (const forbidden of ["오류", "에러", "실패했습니다", "잘못", "다시 해", "확인해라", "!"]) {
        expect(message, `${message} should not contain ${forbidden}`).not.toContain(forbidden);
      }
    }
    expect(EXPENSE_DELETE_FAILED_ALERT_TITLE).not.toContain("!");
  });
});

describe("EXP-124 error classification", () => {
  it("recognizes the input-guard error thrown by the expense screens", () => {
    expect(isInvalidExpenseInputError(new Error(INVALID_EXPENSE_INPUT_ERROR))).toBe(true);
    expect(isInvalidExpenseInputError(INVALID_EXPENSE_INPUT_ERROR)).toBe(true);
    expect(isInvalidExpenseInputError(new Error("database disk image is malformed"))).toBe(false);
    expect(isInvalidExpenseInputError(undefined)).toBe(false);
  });

  it("recognizes the not-yet-adopted local row error", () => {
    expect(isExpenseNotReadyError(new Error(EXPENSE_NOT_READY_ERROR))).toBe(true);
    expect(isExpenseNotReadyError(EXPENSE_NOT_READY_ERROR)).toBe(true);
    expect(isExpenseNotReadyError(new Error(INVALID_EXPENSE_INPUT_ERROR))).toBe(false);
    expect(isExpenseNotReadyError(null)).toBe(false);
  });
});

describe("EXP-124 expenseMutationErrorMessage", () => {
  it("tells the user what to fix when the input guard rejected the save", () => {
    for (const kind of ALL_KINDS) {
      expect(expenseMutationErrorMessage(kind, new Error(INVALID_EXPENSE_INPUT_ERROR))).toBe(EXPENSE_INPUT_INVALID_MESSAGE);
    }
  });

  it("asks the user to wait when the local row has not been adopted yet", () => {
    for (const kind of ALL_KINDS) {
      expect(expenseMutationErrorMessage(kind, new Error(EXPENSE_NOT_READY_ERROR))).toBe(EXPENSE_NOT_READY_MESSAGE);
    }
  });

  it("falls back to a per-mutation message for storage/unknown failures", () => {
    const sqliteFailure = new Error("SQLITE_FULL: database or disk is full");
    expect(expenseMutationErrorMessage("create", sqliteFailure)).toBe(EXPENSE_CREATE_FAILED_MESSAGE);
    expect(expenseMutationErrorMessage("update", sqliteFailure)).toBe(EXPENSE_UPDATE_FAILED_MESSAGE);
    expect(expenseMutationErrorMessage("delete", sqliteFailure)).toBe(EXPENSE_DELETE_FAILED_MESSAGE);
  });

  it("never leaks the raw error text and never returns an empty message", () => {
    const leaky = new Error("SQLITE_CORRUPT at /data/user/0/com.wooriai/databases/offline.db");
    for (const kind of ALL_KINDS) {
      const message = expenseMutationErrorMessage(kind, leaky);
      expect(message).not.toContain("SQLITE");
      expect(message).not.toContain("offline.db");
    }
    // react-query의 onError는 Error가 아닌 값도 넘길 수 있다 -- 그래도 화면은 말을 해야 한다.
    for (const thrown of [undefined, null, "", 0, { code: 500 }, new Error("")]) {
      for (const kind of ALL_KINDS) {
        expect(expenseMutationErrorMessage(kind, thrown).length, `${kind} / ${String(thrown)}`).toBeGreaterThan(0);
      }
    }
  });
});

/**
 * 라운드 45 UX-Z — 서버가 코드로 말해 준 사유는 종류별 폴백보다 항상 더 구체적이다.
 * 이 앱의 저장은 SQLite 우선이라 이 경로가 자주 열리지는 않지만, 열렸을 때 같은 실패가
 * 동기화 상태 화면(remote-api.ts)과 다른 문장으로 들리면 안 된다.
 */
describe("서버 오류 코드 분기", () => {
  const apiError = (code: string, message: string) =>
    new ApiHttpError(400, { error: { code, message, requestId: "req-1" } });

  it("아는 코드는 코드별 문구를 쓴다 (세 뮤테이션 모두 같은 문장)", () => {
    const futureDate = apiError("EXPENSE_FUTURE_DATE", "미래 날짜의 지출은 저장할 수 없어요.");
    for (const kind of ALL_KINDS) {
      expect(expenseMutationErrorMessage(kind, futureDate)).toBe("미래 날짜의 지출은 저장할 수 없어요.");
    }
    expect(expenseMutationErrorMessage("create", apiError("EXPENSE_ITEM_NAME_REQUIRED", "품목명을 입력해 주세요."))).toBe(
      "품목명을 입력해 주세요."
    );
  });

  it("모르는 코드는 종류별 폴백 그대로 — 서버 원문이 화면에 새지 않는다", () => {
    const unknown = apiError("SOMETHING_NEW", "Unexpected server wording");
    expect(expenseMutationErrorMessage("create", unknown)).toBe(EXPENSE_CREATE_FAILED_MESSAGE);
    expect(expenseMutationErrorMessage("update", unknown)).toBe(EXPENSE_UPDATE_FAILED_MESSAGE);
    expect(expenseMutationErrorMessage("delete", unknown)).toBe(EXPENSE_DELETE_FAILED_MESSAGE);
    expect(expenseMutationErrorMessage("create", unknown)).not.toContain("Unexpected");
  });

  it("화면이 던지는 가드 값이 서버 코드보다 우선한다 (사용자가 지금 고칠 수 있는 문제 먼저)", () => {
    expect(expenseMutationErrorMessage("create", new Error(INVALID_EXPENSE_INPUT_ERROR))).toBe(
      EXPENSE_INPUT_INVALID_MESSAGE
    );
    expect(expenseMutationErrorMessage("update", new Error(EXPENSE_NOT_READY_ERROR))).toBe(EXPENSE_NOT_READY_MESSAGE);
  });
});
