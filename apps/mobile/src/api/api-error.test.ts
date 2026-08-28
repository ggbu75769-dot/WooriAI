import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  accountStatusErrorMessage,
  apiErrorCodeOf,
  apiErrorMessage,
  apiErrorMessageForCode,
  ApiHttpError,
  API_ERROR_MESSAGES,
  hasApiErrorCode,
  parseApiErrorEnvelope
} from "./api-error";

/**
 * 라운드 45 UX-Z — 서버 실패 사유가 경계에서 뭉개지지 않는다는 계약.
 *
 * 두 층으로 나눠 고정한다.
 *  1. 순수 단위 — 봉투 파서 / ApiHttpError / 화이트리스트 표. react-native가 필요 없다.
 *  2. 배선 계약 — 화면은 vitest에서 렌더할 수 없으므로 이 저장소의 관례대로 소스 grep으로
 *     확인한다(src/auth/login-screen-contract.test.ts, src/expenses/save-error-wiring.test.ts).
 */

const mobileRoot = process.cwd();
const source = (relativePath: string) => readFileSync(join(mobileRoot, relativePath), "utf8");

/** 서버(GlobalExceptionFilter)가 실제로 내려보내는 모양. */
function envelope(code: string, message: string, extra: Record<string, unknown> = {}) {
  return { error: { code, message, requestId: "req-1" }, ...extra };
}

describe("parseApiErrorEnvelope — 서버 오류 봉투 파서", () => {
  it("{ error: { code, message } } 봉투에서 코드와 원문을 꺼낸다", () => {
    expect(parseApiErrorEnvelope(envelope("EXPENSE_FUTURE_DATE", "미래 날짜의 지출은 저장할 수 없어요."))).toEqual({
      code: "EXPENSE_FUTURE_DATE",
      message: "미래 날짜의 지출은 저장할 수 없어요."
    });
  });

  it("message가 없거나 빈 문자열이면 code만 살린다 (코드가 계약이고 문구는 아니다)", () => {
    expect(parseApiErrorEnvelope({ error: { code: "USER_BLOCKED" } })).toEqual({
      code: "USER_BLOCKED",
      message: null
    });
    expect(parseApiErrorEnvelope({ error: { code: "USER_BLOCKED", message: "" } })?.message).toBeNull();
  });

  it("봉투가 아니면 null — 호출부는 기존 폴백 문구를 그대로 쓴다", () => {
    for (const body of [
      null,
      undefined,
      "문자열 본문",
      42,
      {},
      { message: "unauthorized" }, // Nest 기본 짧은 형태(코드 없음)
      { error: "Unauthorized" }, // error가 객체가 아닌 경우
      { error: {} },
      { error: { code: "" } },
      { error: { code: 42 } }
    ]) {
      expect(parseApiErrorEnvelope(body), JSON.stringify(body)).toBeNull();
    }
  });
});

describe("ApiHttpError — 타입 있는 비-2xx 실패", () => {
  it("status/code/serverMessage/body를 모두 들고 있다", () => {
    const body = envelope("IMPORT_TOO_MANY_ROWS", "Import files can include up to 2,000 rows.");
    const error = new ApiHttpError(400, body);

    expect(error.status).toBe(400);
    expect(error.code).toBe("IMPORT_TOO_MANY_ROWS");
    expect(error.serverMessage).toBe("Import files can include up to 2,000 rows.");
    expect(error.body).toBe(body);
  });

  it("Error를 상속한다 — 기존 instanceof Error 소비자(react-query onError 등)가 그대로 동작한다", () => {
    const error = new ApiHttpError(403, envelope("FORBIDDEN", "접근 권한이 없어요."));
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe("ApiHttpError");
  });

  it("message는 예전 `new Error(JSON.stringify(data))`와 바이트 단위로 같다 (하위 호환)", () => {
    // 이 동일성이 깨지면 응답 JSON 문자열을 읽는 기존 소비자가 조용히 멈춘다:
    // client.ts의 getBudget(BUDGET_NOT_FOUND), src/offline/delta-sync.ts(SYNC_CURSOR_INVALID),
    // src/family/invite-permissions.ts(봉투 JSON 직접 파싱).
    const body = envelope("BUDGET_NOT_FOUND", "월 예산을 찾을 수 없어요.");
    expect(new ApiHttpError(404, body).message).toBe(JSON.stringify(body));
    expect(new ApiHttpError(404, body).message).toContain("BUDGET_NOT_FOUND");

    const cursorBody = envelope("SYNC_CURSOR_INVALID", "동기화 커서가 올바르지 않아요.");
    expect(new ApiHttpError(400, cursorBody).message.includes("SYNC_CURSOR_INVALID")).toBe(true);

    // 봉투가 아닌 본문도 예전과 같은 문자열이 된다.
    expect(new ApiHttpError(401, { message: "unauthorized" }).message).toBe(
      JSON.stringify({ message: "unauthorized" })
    );
  });

  it("봉투가 아니면 code/serverMessage는 null이다 (모르는 실패는 모른다고 말한다)", () => {
    const error = new ApiHttpError(500, { message: "boom" });
    expect(error.code).toBeNull();
    expect(error.serverMessage).toBeNull();
  });
});

describe("apiErrorCodeOf — 코드 추출", () => {
  it("ApiHttpError에서 코드를 읽는다", () => {
    expect(apiErrorCodeOf(new ApiHttpError(400, envelope("EXPENSE_DATE_INVALID", "날짜를 다시 확인해 주세요.")))).toBe(
      "EXPENSE_DATE_INVALID"
    );
  });

  it("body만 들고 있는 오류(ExpenseHttpError·RemotePermanentError 모양)에서도 읽는다", () => {
    const bodyCarrier = { body: envelope("EXPENSE_ITEM_NAME_REQUIRED", "품목명을 입력해 주세요.") };
    expect(apiErrorCodeOf(bodyCarrier)).toBe("EXPENSE_ITEM_NAME_REQUIRED");
  });

  it("파싱해 둔 code 필드만 있어도 읽는다", () => {
    expect(apiErrorCodeOf({ code: "USER_WITHDRAWN" })).toBe("USER_WITHDRAWN");
  });

  it("코드를 알 수 없으면 null (문자열·undefined·평범한 Error 모두)", () => {
    expect(apiErrorCodeOf(new Error("network request failed"))).toBeNull();
    expect(apiErrorCodeOf("실패")).toBeNull();
    expect(apiErrorCodeOf(undefined)).toBeNull();
    expect(apiErrorCodeOf(null)).toBeNull();
    expect(apiErrorCodeOf({ body: { message: "no envelope" } })).toBeNull();
  });
});

describe("화이트리스트 표 — 아는 코드만 문구로 바꾼다", () => {
  const startingCodes = [
    "EXPENSE_FUTURE_DATE",
    "EXPENSE_DATE_INVALID",
    "EXPENSE_AMOUNT_INVALID",
    "EXPENSE_ITEM_NAME_REQUIRED",
    "IMPORT_TOO_MANY_ROWS",
    "IMPORT_FILE_TYPE_INVALID",
    "IMPORT_FILE_TOO_LARGE",
    "USER_WITHDRAWN",
    "USER_BLOCKED",
    "FORBIDDEN",
    "HOUSEHOLD_ALREADY_MEMBER"
  ];

  it("이 트랙이 약속한 코드가 모두 표에 있다", () => {
    for (const code of startingCodes) {
      expect(API_ERROR_MESSAGES[code], code).toBeTruthy();
    }
  });

  /**
   * 라운드 49 QA(P2-4): 존재하지 않는 구매 링크로 저장하려 한 지출(서버 400
   * LINKED_PRODUCT_LINK_NOT_FOUND). 4xx이므로 오프라인 아웃박스는 이 행을 실패 행으로
   * 파킹하고, 그 화면에 뜨는 문구가 바로 이 표의 값이다 — "잠시 후 다시"가 아니라 사용자가
   * 지금 할 수 있는 일(링크 없이 저장)을 말해야 한다.
   */
  it("존재하지 않는 구매 링크 실패는 다음 할 일을 말한다", () => {
    const error = new ApiHttpError(
      400,
      envelope("LINKED_PRODUCT_LINK_NOT_FOUND", "연결하려던 구매 링크를 찾지 못했어요. 링크 없이 다시 저장해 주세요.")
    );
    expect(apiErrorMessage(error, "저장하지 못했어요. 잠시 후 다시 시도해 주세요.")).toBe(
      API_ERROR_MESSAGES.LINKED_PRODUCT_LINK_NOT_FOUND
    );
    expect(API_ERROR_MESSAGES.LINKED_PRODUCT_LINK_NOT_FOUND).not.toContain("잠시 후 다시");
  });

  it("모르는 코드는 폴백 — 서버 원문을 절대 그대로 노출하지 않는다", () => {
    // 표에 없는 코드의 서버 원문(영어·내부 용어일 수 있다)이 화면에 새면 안 된다.
    const unknown = new ApiHttpError(422, envelope("VALIDATION_ERROR", "Validation failed: amountKrw"));
    expect(apiErrorMessage(unknown, "저장하지 못했어요. 잠시 후 다시 시도해 주세요.")).toBe(
      "저장하지 못했어요. 잠시 후 다시 시도해 주세요."
    );
    expect(apiErrorMessage(unknown, "폴백")).not.toContain("Validation failed");
  });

  it("아는 코드는 서버 원문이 아니라 표의 문구를 쓴다 (영문 원문 차단)", () => {
    const englishFromServer = new ApiHttpError(
      400,
      envelope("IMPORT_TOO_MANY_ROWS", "Import files can include up to 2,000 rows.")
    );
    const shown = apiErrorMessage(englishFromServer, "업로드하지 못했어요. 잠시 후 다시 시도해 주세요.");
    expect(shown).toBe(API_ERROR_MESSAGES.IMPORT_TOO_MANY_ROWS);
    expect(shown).not.toContain("Import files");
    expect(shown).toContain("2,000행");
  });

  it("재시도로 풀리지 않는 실패에는 '다시 시도' 문구를 붙이지 않는다", () => {
    // 다시 눌러도 결과가 같은 실패에 재시도를 권하는 것이 이 트랙이 없애려는 오안내다.
    for (const code of ["EXPENSE_FUTURE_DATE", "USER_WITHDRAWN", "USER_BLOCKED", "HOUSEHOLD_ALREADY_MEMBER"]) {
      expect(API_ERROR_MESSAGES[code], code).not.toContain("잠시 후 다시");
    }
  });

  it("DNC-018: 모든 문구가 해요체 존댓말로 끝나고 사용자를 탓하지 않는다", () => {
    for (const [code, message] of Object.entries(API_ERROR_MESSAGES)) {
      expect(message, code).toMatch(/[요]\.$/);
      for (const blamed of ["잘못", "오류입니다", "실패했습니다", "하십시오", "하세요."]) {
        expect(message, `${code}는 "${blamed}"를 쓰지 않는다`).not.toContain(blamed);
      }
    }
  });

  it("apiErrorMessageForCode는 표 그대로, 모르는 코드/null에는 null", () => {
    expect(apiErrorMessageForCode("EXPENSE_FUTURE_DATE")).toBe("미래 날짜의 지출은 저장할 수 없어요.");
    expect(apiErrorMessageForCode("NOPE_UNKNOWN")).toBeNull();
    expect(apiErrorMessageForCode(null)).toBeNull();
    expect(apiErrorMessageForCode(undefined)).toBeNull();
    // 프로토타입 오염 방지: Object.prototype의 키가 문구로 둔갑하지 않는다.
    expect(apiErrorMessageForCode("toString")).toBeNull();
    expect(apiErrorMessageForCode("constructor")).toBeNull();
  });
});

describe("hasApiErrorCode — 부분 문자열 검색을 대체하는 판정", () => {
  const alreadyMember = new ApiHttpError(
    409,
    envelope("HOUSEHOLD_ALREADY_MEMBER", "이미 가족 구성원이에요. 초대를 다시 수락할 필요가 없어요.")
  );

  it("코드가 일치할 때만 참", () => {
    expect(hasApiErrorCode(alreadyMember, "HOUSEHOLD_ALREADY_MEMBER")).toBe(true);
    expect(hasApiErrorCode(alreadyMember, "FORBIDDEN")).toBe(false);
    expect(hasApiErrorCode(alreadyMember, "FORBIDDEN", "HOUSEHOLD_ALREADY_MEMBER")).toBe(true);
  });

  it("사람이 읽는 message에 코드 문자열이 섞여 있어도 오판하지 않는다", () => {
    // 예전 `message.includes("ALREADY_MEMBER")`가 참이 되던 모양 — 코드는 다른 실패다.
    const misleading = new ApiHttpError(400, envelope("INVITE_NOT_PENDING", "HOUSEHOLD_ALREADY_MEMBER 아님"));
    expect(misleading.message).toContain("ALREADY_MEMBER");
    expect(hasApiErrorCode(misleading, "HOUSEHOLD_ALREADY_MEMBER")).toBe(false);
  });

  it("코드를 모르는 실패(네트워크 오류 등)에는 항상 거짓", () => {
    expect(hasApiErrorCode(new Error("Network request failed"), "HOUSEHOLD_ALREADY_MEMBER")).toBe(false);
  });
});

describe("accountStatusErrorMessage — 로그인 화면 전용 판정", () => {
  it("탈퇴·이용 제한만 문구를 돌려준다", () => {
    expect(accountStatusErrorMessage(new ApiHttpError(403, envelope("USER_WITHDRAWN", "탈퇴한 계정이에요.")))).toBe(
      "탈퇴한 계정이에요. 삭제 후 30일 동안은 같은 계정으로 다시 가입할 수 없어요."
    );
    expect(accountStatusErrorMessage(new ApiHttpError(403, envelope("USER_BLOCKED", "이용이 제한된 계정이에요.")))).toBe(
      "이용이 제한된 계정이에요."
    );
  });

  it("그 밖의 코드는 null — 로그인 화면에 가족·권한 이야기를 흘리지 않는다", () => {
    const forbidden = new ApiHttpError(403, envelope("FORBIDDEN", "접근 권한이 없어요."));
    expect(apiErrorMessageForCode("FORBIDDEN")).toBeTruthy(); // 표에는 있지만...
    expect(accountStatusErrorMessage(forbidden)).toBeNull(); // ...로그인 화면은 쓰지 않는다.
    expect(accountStatusErrorMessage(new Error("boom"))).toBeNull();
  });
});

describe("배선 계약 (source verification)", () => {
  it("client.ts의 두 전송 함수가 타입 있는 ApiHttpError를 던진다 (JSON 문자열 Error 폐기)", () => {
    const clientSource = source("src/api/client.ts");
    expect(clientSource).toContain('import { ApiHttpError, parseApiErrorEnvelope } from "./api-error";');
    // requestJson / requestMultipartJson 두 자리 모두.
    const throws = clientSource.match(/throw new ApiHttpError\(response\.status, data\);/g) ?? [];
    expect(throws).toHaveLength(2);
    expect(clientSource).not.toContain("throw new Error(JSON.stringify(data));");
    // 지출 전용 전송(requestExpenseJson)의 예외도 코드를 들고 다닌다.
    expect(clientSource).toContain("this.code = parseApiErrorEnvelope(body)?.code ?? null;");
  });

  it("ⓐ 가져오기 업로드 실패가 코드별 문구를 쓴다 (행 초과·형식 거절에 '잠시 후 다시' 오안내 제거)", () => {
    const importSource = source("app/import/index.tsx");
    expect(importSource).toContain('import { apiErrorMessage } from "../../src/api/api-error";');
    expect(importSource).toContain(
      'apiErrorMessage(upload.error, "업로드하지 못했어요. 잠시 후 다시 시도해 주세요.")'
    );
    // 예전의 무조건 재시도 안내(문구 하드코딩)는 남아 있으면 안 된다.
    expect(importSource).not.toContain(
      ">업로드하지 못했어요. 잠시 후 다시 시도해 주세요.</Text>"
    );
  });

  it("ⓑ 동기화 실패 행의 lastError가 코드별 문구를 쓴다 (모르는 코드는 기존 문구)", () => {
    const remoteApiSource = source("src/offline/remote-api.ts");
    expect(remoteApiSource).toContain('import { apiErrorMessage } from "../api/api-error";');
    expect(remoteApiSource).toContain(
      "throw new RemotePermanentError(error.status, apiErrorMessage(error, PERMANENT_FAILURE_MESSAGE), error.body);"
    );
    expect(remoteApiSource).toContain('const PERMANENT_FAILURE_MESSAGE = "요청을 처리하지 못했어요.";');
    // 4xx만 permanent라는 R19-H 분류는 그대로다.
    expect(remoteApiSource).toContain("error instanceof ExpenseHttpError && error.status < 500");
  });

  it("ⓒ 지출 저장 배너가 같은 표를 본다 (입력 가드·행 준비 중 판정 다음)", () => {
    const saveErrorSource = source("src/expenses/save-error-messages.ts");
    expect(saveErrorSource).toContain('import { apiErrorMessage } from "../api/api-error";');
    expect(saveErrorSource).toContain("return apiErrorMessage(error, FALLBACK_MESSAGE_BY_KIND[kind]);");
    const body = saveErrorSource.slice(saveErrorSource.indexOf("export function expenseMutationErrorMessage"));
    expect(body.indexOf("isInvalidExpenseInputError")).toBeLessThan(body.indexOf("apiErrorMessage"));
    expect(body.indexOf("isExpenseNotReadyError")).toBeLessThan(body.indexOf("apiErrorMessage"));
  });

  it("ⓓ 로그인 화면이 계정 상태 거절을 네트워크 오안내보다 먼저 분기한다", () => {
    const loginSource = source("app/(auth)/login.tsx");
    expect(loginSource).toContain('import { accountStatusErrorMessage } from "../../src/api/api-error";');
    expect(loginSource).toContain("const accountStatusMessage = accountStatusErrorMessage(error);");
    expect(loginSource).toContain("setLoginError(accountStatusMessage);");
    // 순서가 계약이다: 타입 있는 카카오 오류 → 계정 상태 → 그 밖의 네트워크/서버 실패.
    expect(loginSource.indexOf("error instanceof KakaoLoginError) {")).toBeLessThan(
      loginSource.indexOf("const accountStatusMessage =")
    );
    expect(loginSource.indexOf("const accountStatusMessage =")).toBeLessThan(
      loginSource.indexOf("로그인 중 문제가 발생했어요. 네트워크 연결을 확인한 뒤 다시 시도해 주세요.")
    );
  });

  it("초대 수락 화면이 문자열 검색 대신 코드로 판정한다", () => {
    const acceptSource = source("app/family/accept/[token].tsx");
    expect(acceptSource).toContain('import { hasApiErrorCode } from "../../../src/api/api-error";');
    expect(acceptSource).toContain(
      'return hasApiErrorCode(error, "HOUSEHOLD_ALREADY_MEMBER") ? alreadyMemberText : acceptFailedText;'
    );
    expect(acceptSource).not.toContain('message.includes("ALREADY_MEMBER")');
    // 이 화면의 두 문구 자체는 그대로 유지된다.
    expect(acceptSource).toContain('const alreadyMemberText = "이미 이 가족의 구성원이에요.";');
    expect(acceptSource).toContain(
      'const acceptFailedText = "가족에 참여하지 못했어요. 잠시 후 다시 시도해 주세요.";'
    );
  });
});
