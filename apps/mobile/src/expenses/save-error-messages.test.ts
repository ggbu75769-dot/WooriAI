import { describe, expect, it } from "vitest";
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
