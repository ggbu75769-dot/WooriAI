import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  accountStatusErrorMessage,
  ACCOUNT_STATUS_ERROR_CODES,
  apiErrorCodeOf,
  apiErrorMessage,
  apiErrorMessageForCode,
  ApiHttpError,
  API_ERROR_MESSAGES,
  hasApiErrorCode,
  parseApiErrorEnvelope
} from "./api-error";
import { amountOverLimitMessage, EXPENSE_AMOUNT_MAX_KRW } from "../expenses/amount-limit";
import { EXPENSE_DATE_TOO_OLD_ERROR } from "../expenses/entry-form-guards";
import { CHILD_BIRTH_DATE_TOO_OLD_ERROR } from "../children/child-form";
import { ENTRY_DATE_MAX_PAST_YEARS } from "@wooriai/domain";
import {
  SYNC_STATUS_ITEM_STATUS_PERMANENT_FAILURE_HINT,
  SYNC_STATUS_PERMANENT_FAILURE_HINT
} from "../offline/permission-denied";

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

/**
 * 라운드 69 B — 표의 반대편. 계약이 "두 자리가 같은 사실을 말하는가"라서 **실제 서버 파일**을
 * 읽는다(계약 미러가 아니다 — src/family/household-scope.test.ts가 세운 형식 그대로).
 */
const apiSource = (relativePath: string) => readFileSync(join(mobileRoot, "../../apps/api/src", relativePath), "utf8");

/**
 * 서버 파일이 던지는 오류 코드 전량. `throw new XxxException({ code: ..., ... })`의 그 값.
 *
 * 라운드 71 리뷰 M-2 — 문자열 리터럴만 보던 그물을 **상수 식별자**까지 넓힌다. 서버는 코드를
 * `code: IMPORT_FILE_TOO_LARGE_CODE`처럼 넘기기도 하고(common/filters/global-exception.filter.ts),
 * 그런 자리는 종전 정규식에 한 번도 걸리지 않았다 — 없는 코드로 세어졌다는 뜻이다.
 * 오늘 이 네 파일에는 그 형태가 0건이지만(구멍은 형제 스윕인 import-failure-messages.test.ts에서
 * 실제로 드러났다), 두 그물이 다른 것을 보면 다음번 구멍은 이쪽에 생긴다.
 *
 * 해석은 같은 파일의 `const X_CODE = "…"`가 먼저이고, 없으면 서버 소스 전역의 정의를 본다.
 * 해석하지 못한 식별자는 조용히 버리지 않고 `UNRESOLVED:` 표식으로 남긴다.
 */
const apiSourceRoot = join(mobileRoot, "../../apps/api/src");

let codeConstantCache: Map<string, string> | null = null;
function codeConstants(): Map<string, string> {
  if (codeConstantCache) return codeConstantCache;
  const table = new Map<string, string>();
  const walk = (directory: string) => {
    for (const name of readdirSync(directory)) {
      if (name === "node_modules" || name.startsWith(".")) continue;
      const fullPath = join(directory, name);
      if (statSync(fullPath).isDirectory()) {
        walk(fullPath);
        continue;
      }
      if (!/\.ts$/.test(name)) continue;
      for (const match of readFileSync(fullPath, "utf8").matchAll(
        /\bconst ([A-Z][A-Z0-9_]*_CODE)\s*=\s*"([A-Z0-9_]+)"/g
      )) {
        table.set(match[1], match[2]);
      }
    }
  };
  walk(apiSourceRoot);
  codeConstantCache = table;
  return table;
}

function thrownCodesIn(relativePath: string): string[] {
  const text = apiSource(relativePath);
  const localConstants = new Map(
    [...text.matchAll(/\bconst ([A-Z][A-Z0-9_]*_CODE)\s*=\s*"([A-Z0-9_]+)"/g)].map((match) => [match[1], match[2]])
  );
  return [...text.matchAll(/\bcode: (?:"([A-Z0-9_]+)"|([A-Z][A-Z0-9_]*_CODE)\b)/g)].map((match) => {
    if (match[1]) return match[1];
    const identifier = match[2];
    return localConstants.get(identifier) ?? codeConstants().get(identifier) ?? `UNRESOLVED:${identifier}`;
  });
}

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
    "EXPENSE_AMOUNT_TOO_LARGE",
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

  /**
   * GAP-054 라운드 54 P2-6 — 상한 초과로 파킹된 행이 이유를 말한다.
   *
   * 서버는 이 실패에만 전용 코드를 준다(apps/api/src/bootstrap.ts의 exceptionFactory).
   * 4xx라 오프라인 아웃박스는 그 행을 실패 행으로 파킹하고, 동기화 상태 화면에 뜨는 문구가
   * 이 표의 값이다 — 한도를 말해야 사용자가 큐를 풀 수 있다.
   */
  it("금액 상한 초과는 한도를 말하고, 문구는 입력 가드와 같은 모듈에서 온다", () => {
    const error = new ApiHttpError(400, envelope("EXPENSE_AMOUNT_TOO_LARGE", "요청 값을 다시 확인해주세요."));
    const shown = apiErrorMessage(error, "저장하지 못했어요. 잠시 후 다시 시도해 주세요.");
    expect(shown).toBe(amountOverLimitMessage());
    expect(shown).toContain(EXPENSE_AMOUNT_MAX_KRW.toLocaleString("ko-KR"));
    // 다시 눌러도 결과가 같은 실패라 재시도를 권하지 않는다.
    expect(shown).not.toContain("잠시 후 다시");
    // 서버 봉투의 일반 문구가 그대로 새지 않는다.
    expect(shown).not.toContain("요청 값을");
    // 숫자를 표에 손으로 적지 않는다 — amount-limit 모듈 하나가 단일 소스다.
    const apiErrorSource = source("src/api/api-error.ts");
    expect(apiErrorSource).toContain('import { amountOverLimitMessage } from "../expenses/amount-limit";');
    expect(apiErrorSource).toContain("EXPENSE_AMOUNT_TOO_LARGE: amountOverLimitMessage(),");
    expect(apiErrorSource).not.toContain(String(EXPENSE_AMOUNT_MAX_KRW));
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

/**
 * 라운드 69 B — **서버가 이미 한국어로 말한 실패 사유가 화면까지 오는가.**
 *
 * 라운드 45가 세운 표에는 "서버에 코드가 늘 때 함께 늘어나는 규율"이 없었다. 그래서 라운드 68이
 * 코드를 둘 만들면서 표를 열지 않았고(날짜 하한 두 코드), 그 이전에도 넷이 밀려 있었다. 표에 없는
 * 코드의 실패 행이 받는 것은 "요청을 처리하지 못했어요." 한 줄 + 재시도 버튼 없음이다.
 *
 * 이 블록은 두 가지를 고정한다.
 *  1. 이번에 더한 일곱 줄이 **말해야 하는 것을 말하는가**(문구의 출처 · 재시도 금지 · 다음 할 일).
 *  2. **앞으로도 늘어나는가** — 아웃박스·상태 큐가 지나는 서버 파일을 긁어, 거기서 던지는 코드가
 *     표에 있거나 **이유가 적힌 제외 목록**에 있는지 묻는다(교집합 소스 계약).
 */
describe("라운드 69 B — 실패의 이름이 화면까지 온다", () => {
  const round69Codes = [
    "EXPENSE_DATE_TOO_OLD",
    "CHILD_BIRTH_DATE_TOO_OLD",
    "EXPENSE_LINKED_ITEM_TEMPLATE_INVALID",
    "EXPENSE_CATEGORY_INVALID",
    "EXPENSE_NOT_FOUND",
    "CHILD_NOT_FOUND",
    "ITEM_NOT_FOUND"
  ];

  /** 이번에 더한 404 셋 — 대상이 사라진 실패다. */
  const notFoundCodes = ["EXPENSE_NOT_FOUND", "CHILD_NOT_FOUND", "ITEM_NOT_FOUND"];

  it("이번 라운드가 약속한 일곱 줄이 모두 표에 있다", () => {
    for (const code of round69Codes) {
      expect(API_ERROR_MESSAGES[code], code).toBeTruthy();
    }
  });

  it("날짜 하한 두 코드의 문구는 폼 상수를 읽는다 — 표가 문장도 숫자도 짓지 않는다", () => {
    // 같은 경계를 폼·서버·표가 각자 말하면 그 자체가 세 개의 계약이다(라운드 68 A의 판단).
    expect(API_ERROR_MESSAGES.EXPENSE_DATE_TOO_OLD).toBe(EXPENSE_DATE_TOO_OLD_ERROR);
    expect(API_ERROR_MESSAGES.CHILD_BIRTH_DATE_TOO_OLD).toBe(CHILD_BIRTH_DATE_TOO_OLD_ERROR);
    // 두 폼이 이미 글자까지 같은 한 문장을 쓴다(entry-form-guards.test.ts · child-form.test.ts).
    expect(API_ERROR_MESSAGES.EXPENSE_DATE_TOO_OLD).toBe(API_ERROR_MESSAGES.CHILD_BIRTH_DATE_TOO_OLD);

    const apiErrorSource = source("src/api/api-error.ts");
    expect(apiErrorSource).toContain('import { EXPENSE_DATE_TOO_OLD_ERROR } from "../expenses/entry-form-guards";');
    expect(apiErrorSource).toContain('import { CHILD_BIRTH_DATE_TOO_OLD_ERROR } from "../children/child-form";');
    expect(apiErrorSource).toContain("EXPENSE_DATE_TOO_OLD: EXPENSE_DATE_TOO_OLD_ERROR,");
    expect(apiErrorSource).toContain("CHILD_BIRTH_DATE_TOO_OLD: CHILD_BIRTH_DATE_TOO_OLD_ERROR,");
    // 연 수(20)가 이 파일에 리터럴로 적히면 도메인 상수와 갈라지는 순간을 아무도 모른다.
    expect(apiErrorSource).not.toContain(`${ENTRY_DATE_MAX_PAST_YEARS}년보다`);
  });

  it("서버가 던진 그 코드를 받으면 표의 문구가 서고, 막다른 폴백은 사라진다", () => {
    // 서버 원문 그대로의 봉투(store-shared.ts / onboarding-core.service.ts).
    const tooOld = new ApiHttpError(400, envelope("EXPENSE_DATE_TOO_OLD", EXPENSE_DATE_TOO_OLD_ERROR));
    expect(apiErrorMessage(tooOld, "요청을 처리하지 못했어요.")).toBe(EXPENSE_DATE_TOO_OLD_ERROR);

    // 가장 도달하기 쉬운 자리: "샀어요" → 오프라인 저장 → 그 사이 템플릿이 내려감 → flush 400.
    const linkedItem = new ApiHttpError(
      400,
      envelope("EXPENSE_LINKED_ITEM_TEMPLATE_INVALID", "연결된 준비템을 찾을 수 없어요.")
    );
    const linkedShown = apiErrorMessage(linkedItem, "요청을 처리하지 못했어요.");
    expect(linkedShown).toBe(API_ERROR_MESSAGES.EXPENSE_LINKED_ITEM_TEMPLATE_INVALID);
    expect(linkedShown).not.toBe("요청을 처리하지 못했어요.");
    // 사용자가 지금 할 수 있는 일을 말한다(형태는 LINKED_PRODUCT_LINK_NOT_FOUND와 같다).
    expect(linkedShown).toContain("다시 저장해 주세요.");

    // 준비템 상태 큐가 지나는 유일한 4xx — 서버 한쪽 갈래의 원문은 영어다.
    const itemMissing = new ApiHttpError(404, envelope("ITEM_NOT_FOUND", "Item template was not found."));
    const itemShown = apiErrorMessage(itemMissing, "요청을 처리하지 못했어요.");
    expect(itemShown).toBe(API_ERROR_MESSAGES.ITEM_NOT_FOUND);
    expect(itemShown).not.toContain("Item template");
  });

  it("404 셋은 다음 할 일을 말하되 재시도를 권하지 않는다 (USER_WITHDRAWN의 형식)", () => {
    for (const code of notFoundCodes) {
      const message = API_ERROR_MESSAGES[code];
      expect(message, code).toBeTruthy();
      // 다시 보내도 같은 답이 온다 — 재시도를 권하는 순간 그것이 허위 안내다.
      for (const retryPhrase of ["잠시 후 다시", "다시 시도"]) {
        expect(message, `${code}는 "${retryPhrase}"를 쓰지 않는다`).not.toContain(retryPhrase);
      }
      // 사실 한 문장 + 다음에 할 일 한 문장.
      expect(message.split("요.").filter(Boolean).length, code).toBeGreaterThanOrEqual(2);
      expect(message, code).toContain("확인해 주세요.");
    }
  });

  it("404 문구는 '큐 행을 어떻게 하라'를 말하지 않는다 — 그 문장은 동기화 상태 화면의 몫이다", () => {
    // 같은 사실을 두 문장이 각자 말하기 시작하면 표와 permission-denied.ts가 갈라지는 순간을
    // 아무도 모른다(그 파일의 규율). 표는 "사라진 그것이 지금 어디 있는지"만 말한다.
    for (const code of notFoundCodes) {
      const message = API_ERROR_MESSAGES[code];
      for (const rowAction of ["버려 주세요", "새로 기록", "다시 보내도"]) {
        expect(message, `${code}는 "${rowAction}"를 쓰지 않는다`).not.toContain(rowAction);
      }
    }
    // 그 두 문장은 그대로 남아 있다(이 트랙은 permission-denied.ts를 건드리지 않는다).
    expect(SYNC_STATUS_PERMANENT_FAILURE_HINT).toBe("다시 보내도 같은 결과예요. 내용을 고쳐 새로 기록하거나 버려 주세요.");
    expect(SYNC_STATUS_ITEM_STATUS_PERMANENT_FAILURE_HINT).toContain("이 변경은 버리고");
  });

  it("카테고리 갈래는 자기 코드를 갖고, 바구니 코드는 표에 들어오지 않는다", () => {
    // 서버 원문 그대로다 — 이미 해요체이고 다음에 할 일까지 말한다.
    expect(API_ERROR_MESSAGES.EXPENSE_CATEGORY_INVALID).toBe("존재하지 않는 카테고리예요. 카테고리를 다시 선택해 주세요.");
    // 서버가 실제로 그 코드로 던진다(문장은 한 글자도 바뀌지 않았다).
    const expensesStore = apiSource("onboarding/expenses-store.service.ts");
    expect(expensesStore).toContain('code: "EXPENSE_CATEGORY_INVALID"');
    expect(expensesStore).toContain('message: "존재하지 않는 카테고리예요. 카테고리를 다시 선택해 주세요."');
    // VALIDATION_ERROR를 표에 넣으면 DTO 검증 실패 **전량**이 카테고리 문구를 뒤집어쓴다.
    expect(API_ERROR_MESSAGES.VALIDATION_ERROR).toBeUndefined();
    expect(apiErrorMessageForCode("VALIDATION_ERROR")).toBeNull();
    // 나머지 소비자는 무변경 — 400 기본 코드는 여전히 VALIDATION_ERROR다.
    expect(apiSource("common/filters/global-exception.filter.ts")).toContain(
      'if (statusCode === HttpStatus.BAD_REQUEST) return "VALIDATION_ERROR";'
    );
  });

  /**
   * **교집합 소스 계약** — 이 라운드의 진짜 산출물이다.
   *
   * 앱의 지출 아웃박스와 준비템 상태 큐가 지나는 서버 파일 셋을 읽어 거기서 던지는 4xx 코드를
   * 전부 긁는다. 각 코드는 둘 중 하나여야 한다: 표에 있거나, **이유가 적힌 제외 목록**에 있거나.
   * 서버에 코드를 새로 만들면 이 단언이 빨개지고, 만든 사람이 "이 코드는 앱에서 어떻게 보이는가"에
   * 답해야 한다 — 라운드 45 이후 없던 그 규율이다.
   */
  it("아웃박스가 지나는 서버 파일의 4xx 코드는 표에 있거나, 이유가 적힌 제외 목록에 있다", () => {
    const outboxPathFiles = [
      "onboarding/store-shared.ts",
      "onboarding/expenses-store.service.ts",
      "onboarding/child-access.service.ts",
      // 라운드 69 리뷰 M-1: 준비템 상태 큐가 실제로 지나는 파일인데 스윕에 없었다. 상태 PATCH의
      // 종점이 여기다(updateItemStatus → requireItemTemplate → ITEM_NOT_FOUND). 이 파일은 앱
      // 경로와 어드민 경로가 한 클래스에 같이 살아서, 아래 제외 목록이 그 둘을 갈라 적는다.
      "onboarding/items-catalog.service.ts"
    ];

    /** 표에 넣지 않는 코드와 그 이유. 비우면 안 된다 — 이유 없는 제외가 바로 이 표의 병이었다. */
    const excludedWithReason: Readonly<Record<string, string>> = {
      EXPENSE_CURSOR_INVALID:
        "목록 조회 전용이다. 커서는 앱이 만든 값이고 그 화면이 자기 폴백으로 처리한다 — 아웃박스·상태 큐가 지나지 않는다.",
      EXPENSE_CHILD_MISMATCH:
        "준비템 상태 PATCH가 expenseId를 함께 보낼 때만 나오는 403인데, 상태 큐가 보내는 것은 상태값 하나다(src/offline/remote-api.ts의 updateItemStatus).",
      VALIDATION_ERROR:
        "바구니 코드다. 표에 넣으면 DTO 검증 실패 전량이 한 문구를 뒤집어쓴다 — 사유가 있는 갈래는 EXPENSE_CATEGORY_INVALID처럼 자기 코드를 받는다.",
      // --- items-catalog.service.ts의 어드민 전용 갈래 (apps/admin만 부른다) ---
      // 다섯 다 어드민 콘솔의 입력 검증이라 모바일 앱은 그 엔드포인트를 호출하지 않는다.
      // 원문이 영어인 것도 그래서다 — 사용자 화면에 설 문장이 아니다.
      ADMIN_ITEM_TEMPLATE_REQUIRED:
        "어드민 준비템 저장의 필수 입력 검증(normalizeAdminItemTemplateInput)과 어드민 링크 생성 시 itemTemplateId 누락 검증이다. 앱은 두 엔드포인트를 모두 호출하지 않는다.",
      ADMIN_PRODUCT_LINK_REQUIRED:
        "어드민 구매 링크 생성/수정의 필수 입력 검증이다(adminCreateProductLink·adminUpdateProductLink). 앱은 이 엔드포인트를 호출하지 않는다.",
      ADMIN_DISCLOSURE_REQUIRED:
        "어드민 고지 문구 저장의 빈 값 검증이다(adminUpdateDisclosure). 앱은 고지 문구를 읽기만 하고 쓰지 않는다.",
      ADMIN_SKIP_REASON_REQUIRED:
        "어드민 준비템 저장에서 필수가 아닌 템플릿에 건너뛰기 안내를 요구하는 검증이다. 앱은 이 엔드포인트를 호출하지 않는다.",
      ITEM_TIMING_LABEL_MISMATCH:
        "어드민 준비템 저장·검토 초안의 시기 라벨↔스테이지 정합 검증이다(라운드 76 E, requireTimingLabelMatchesStages). 앱은 카탈로그를 읽기만 하고 저장 엔드포인트를 호출하지 않는다.",
      // --- 앱이 지나지만 **큐가 아닌** 갈래 (구매 링크 클릭은 즉시 요청이다) ---
      PRODUCT_LINK_NOT_FOUND:
        "구매 링크 클릭(clickProductLink)의 404와 어드민 링크 조회의 404다. 클릭은 아웃박스를 타지 않는 즉시 요청이라 실패해도 큐 행이 남지 않고, 그 화면이 자기 문구를 쓴다(app/items/[itemTemplateId].tsx의 showLinkFailure). 아웃박스가 지나는 '연결하려던 링크가 없다'는 별도 코드 LINKED_PRODUCT_LINK_NOT_FOUND이고 그쪽은 표에 있다.",
      PRODUCT_LINK_URL_SCHEME_INVALID:
        "어드민이 넣은 링크 주소의 스킴 검증(requireHttpUrl)이다. 클릭 경로에서도 같은 함수가 저장된 주소를 방어적으로 다시 보지만, 그때 잘못된 값은 사용자가 고칠 수 있는 것이 아니고 클릭은 큐를 타지 않는다."
    };

    const swept = new Set(outboxPathFiles.flatMap(thrownCodesIn));
    // 스윕이 실제로 무언가를 읽었는지부터 확인한다(정규식이 조용히 0건이 되면 계약이 사라진다).
    expect(swept.size).toBeGreaterThanOrEqual(10);
    // 라운드 71 리뷰 M-2: 못 읽은 상수 식별자를 "코드 없음"으로 세지 않는다.
    expect([...swept].filter((code) => code.startsWith("UNRESOLVED:"))).toEqual([]);

    for (const code of swept) {
      const known = Object.prototype.hasOwnProperty.call(API_ERROR_MESSAGES, code);
      const excluded = Object.prototype.hasOwnProperty.call(excludedWithReason, code);
      expect(
        known || excluded,
        `${code}: 표에 없고 제외 이유도 없다. 이 코드를 받은 실패 행은 "요청을 처리하지 못했어요." 한 줄 + 재시도 버튼 없음이 된다.`
      ).toBe(true);
    }

    // 제외 목록이 유령을 들고 있지 않은지도 본다 — 서버에서 사라진 코드의 이유는 남을 수 없다.
    for (const code of Object.keys(excludedWithReason)) {
      expect(excludedWithReason[code].length, code).toBeGreaterThan(20);
    }
  });

  it("표의 코드는 실제 서버 파일이 던지는 코드다 (반대 방향 — 유령 줄 금지)", () => {
    // 이번에 더한 일곱 줄이 각각 어느 서버 파일에서 오는지를 값으로 못 박는다.
    const origins: Readonly<Record<string, string>> = {
      EXPENSE_DATE_TOO_OLD: "onboarding/store-shared.ts",
      CHILD_BIRTH_DATE_TOO_OLD: "onboarding/onboarding-core.service.ts",
      EXPENSE_LINKED_ITEM_TEMPLATE_INVALID: "onboarding/expenses-store.service.ts",
      EXPENSE_CATEGORY_INVALID: "onboarding/expenses-store.service.ts",
      EXPENSE_NOT_FOUND: "onboarding/expenses-store.service.ts",
      CHILD_NOT_FOUND: "onboarding/child-access.service.ts",
      ITEM_NOT_FOUND: "onboarding/items-catalog.service.ts"
    };

    for (const [code, file] of Object.entries(origins)) {
      expect(thrownCodesIn(file), `${code} ← ${file}`).toContain(code);
    }
  });

  it("개명은 이름만이다 — 판정·기준 시각·던지는 코드는 그대로다", () => {
    const storeShared = apiSource("onboarding/store-shared.ts");
    // 새 이름은 범위 전체를 말한다(위 = 미래 금지, 아래 = 20년 하한).
    expect(storeShared).toContain("export function assertExpenseDateWithinRange(spentOn: string) {");
    expect(storeShared).not.toContain("export function assertNotFutureDate");
    // 하한만 보는 형제 함수는 자기 이름 그대로이고, 여기가 그 유일한 호출부다.
    expect(storeShared).toContain("export function assertExpenseDateWithinPastFloor(spentOn: string) {");
    expect(storeShared).toContain("assertExpenseDateWithinPastFloor(spentOn);");
    // 세 코드와 기준 시각은 한 글자도 바뀌지 않았다.
    for (const code of ["EXPENSE_DATE_INVALID", "EXPENSE_FUTURE_DATE", "EXPENSE_DATE_TOO_OLD"]) {
      expect(storeShared, code).toContain(`code: "${code}"`);
    }
    expect(storeShared).toContain("isFutureSeoulDate(spentOn, referenceNow())");
    expect(storeShared).toContain("isBeforeEntryDateFloor(spentOn, referenceNow())");

    // 호출부 셋이 모두 새 이름을 부른다(생성 · 수정 · 엑셀 가져오기 행 판정).
    const expensesStore = apiSource("onboarding/expenses-store.service.ts");
    expect(expensesStore.match(/assertExpenseDateWithinRange\(input\.spentOn\);/g) ?? []).toHaveLength(2);
    expect(apiSource("onboarding/import-pipeline.service.ts")).toContain(
      "assertExpenseDateWithinRange(fromDateOnly(row.parsedDate));"
    );
    for (const file of [
      "onboarding/expenses-store.service.ts",
      "onboarding/import-pipeline.service.ts"
    ]) {
      expect(apiSource(file), file).not.toContain("assertNotFutureDate");
    }
  });

  it("분류·상태코드 계약은 무접촉이다 (문구만 갈린다)", () => {
    const remoteApiSource = source("src/offline/remote-api.ts");
    // 4xx만 permanent라는 R19-H 분류, 그리고 모르는 코드의 폴백 문구 — 둘 다 그대로다.
    expect(remoteApiSource).toContain("error instanceof ExpenseHttpError && error.status < 500");
    expect(remoteApiSource).toContain('const PERMANENT_FAILURE_MESSAGE = "요청을 처리하지 못했어요.";');
    // 재시도 가능 4xx 예외 셋도 무접촉이다.
    expect(source("src/offline/permission-denied.ts")).toContain(
      "const RETRYABLE_CLIENT_ERROR_STATUSES = new Set([401, 408, 429]);"
    );
    // 로그인 화면 전용 목록은 넓히지 않는다.
    expect(ACCOUNT_STATUS_ERROR_CODES).toEqual(["USER_WITHDRAWN", "USER_BLOCKED"]);
    // 삭제-404 수렴은 코드로 판정한다 — 표에 문구가 생겼다고 그 경로가 바뀌지 않는다.
    expect(source("src/offline/sync-engine.ts")).toContain('body?.error?.code === "EXPENSE_NOT_FOUND"');
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

  /**
   * 라운드 71 트랙 A — 이 자리의 배선이 **한 겹 깊어졌다.** 업로드 화면은 이제
   * `src/import/import-failure-messages.ts`(가져오기 여정 전용 문구 모듈)를 부르고, 그 모듈이
   * 자기 표를 먼저 본 뒤 **이 표를 한 번 지난다**. 여기서 지키는 계약은 그대로다: 행 초과·형식
   * 거절 두 코드의 문구가 이 표에서 오고, 무조건 재시도 안내가 하드코딩으로 남아 있지 않다.
   * (여정 전체의 코드 스윕은 import-failure-messages.test.ts가 진다 — 그 파일 넷은 아웃박스가
   * 지나는 파일이고 가져오기는 큐를 타지 않는 즉시 요청이라 이 스윕의 시야 밖이다.)
   */
  it("ⓐ 가져오기 업로드 실패가 코드별 문구를 쓴다 (행 초과·형식 거절에 '잠시 후 다시' 오안내 제거)", () => {
    const importSource = source("app/import/index.tsx");
    expect(importSource).toContain('import { importFailureMessage } from "../../src/import/import-failure-messages";');
    expect(importSource).toContain(
      '{importFailureMessage("upload", upload.error, { isOnline: uploadFailureOnline })}'
    );
    // 그 모듈이 이 표를 실제로 지난다(같은 실패를 두 문장이 각자 말하지 않는다).
    const failureMessages = source("src/import/import-failure-messages.ts");
    expect(failureMessages).toContain('import { apiErrorCodeOf, apiErrorMessageForCode } from "../api/api-error";');
    expect(failureMessages).toContain("const knownGlobally = apiErrorMessageForCode(code);");
    // 표의 두 줄은 여전히 이 표의 것이다(여정 모듈이 다시 적지 않는다).
    expect(failureMessages).not.toContain("IMPORT_TOO_MANY_ROWS:");
    expect(failureMessages).not.toContain("IMPORT_FILE_TYPE_INVALID:");
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
    // 라운드 73 트랙 A: 그 마지막 갈래의 두 문구는 이제 src/auth/login-copy.ts 한 자리에 있고
    // 화면은 loginFailureMessage(...)를 부른다 — 순서 계약은 그 호출 자리로 그대로 이어진다.
    expect(loginSource.indexOf("const accountStatusMessage =")).toBeLessThan(
      loginSource.indexOf("loginFailureMessage({")
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
