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
import {
  CHILD_BIRTH_DATE_FUTURE_ERROR,
  CHILD_BIRTH_DATE_TOO_OLD_ERROR,
  CHILD_DUE_DATE_BEYOND_TERM_ERROR,
  CHILD_DUE_DATE_MAX_FUTURE_WEEKS
} from "../children/child-form";
import { ENTRY_DATE_MAX_PAST_YEARS } from "@wooriai/domain";
import {
  SYNC_STATUS_ITEM_STATUS_PERMANENT_FAILURE_HINT,
  SYNC_STATUS_PERMANENT_FAILURE_HINT
} from "../offline/permission-denied";
/**
 * 라운드 79 트랙 C — **가족 여정의 네 출구**를 이 파일에서 실제로 물어보기 위한 import 넷.
 * 코드 목록을 여기 사본으로 적지 않는다(사본을 만드는 순간 다섯째 표가 생긴다).
 */
import {
  OFFLINE_RETRY_NOTICE,
  OFFLINE_SAVE_NOTICE,
  resolveSaveErrorCopy,
  SAVE_ERROR_NOTICE
} from "../offline/messages";
import {
  familyErrorCodeOf,
  memberMutationErrorMessage,
  INVITE_CANCEL_FAILED_MESSAGE,
  MEMBER_MANAGE_FORBIDDEN_MESSAGE,
  MEMBER_REMOVE_FAILED_MESSAGE
} from "../family/member-mutation-messages";
import { inviteCreateErrorMessage, INVITE_CREATE_FAILED_MESSAGE, INVITE_FORBIDDEN_MESSAGE } from "../family/invite-permissions";
import { isInviteUnavailableError, INVITE_UNAVAILABLE_CODES } from "../family/invite-accept-messages";

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

/**
 * 라운드 78 A ⓔ — **코드 → 그 코드로 나가는 서로 다른 문장들.**
 *
 * 이 표는 "코드 하나 = 문장 하나"를 가정하는데 서버는 그렇지 않다. 그 사실을 산문이 아니라
 * **스윕이 센 값**으로 들고 있기 위한 한 벌이다: 서버 소스 전역에서 `code: "X"` 바로 뒤의
 * `message:`를 짝지어 모은다(원문 그대로 — 템플릿 리터럴은 한 문장으로 센다).
 *
 * 위 `codeConstants()`와 같은 이유로 캐시한다(트리 전체를 두 번 걷지 않는다).
 */
let serverMessageCache: Map<string, Set<string>> | null = null;
function serverMessagesByCode(): Map<string, Set<string>> {
  if (serverMessageCache) return serverMessageCache;
  const table = new Map<string, Set<string>>();
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
        /\bcode: "([A-Z0-9_]+)",\s*message: (`[^`]*`|"[^"]*")/g
      )) {
        if (!table.has(match[1])) table.set(match[1], new Set());
        table.get(match[1])!.add(match[2]);
      }
    }
  };
  walk(apiSourceRoot);
  serverMessageCache = table;
  return table;
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
    // 라운드 78 A: 같은 폼 모듈에서 문장 셋을 읽게 되면서 이 import가 한 줄에서 여러 줄로 넓어졌다
    // (읽는 이름이 늘었을 뿐 방향도 모듈도 그대로다 — 아래 블록이 나머지 둘을 문다).
    expect(apiErrorSource).toContain("  CHILD_BIRTH_DATE_TOO_OLD_ERROR,\n");
    expect(apiErrorSource).toContain('} from "../children/child-form";');
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

    /**
     * 표에 넣지 않는 코드와 그 이유. 비우면 안 된다 — 이유 없는 제외가 바로 이 표의 병이었다.
     *
     * ⚠️ 라운드 77 A — **사유는 이 스윕의 단위(아웃박스·준비템 상태 큐)로만 적는다.** 그 밖의
     * 사실은 사유가 아니라 **관측**이다. 이 목록은 구매 링크 클릭의 두 코드를 제외하며 이유를
     * **둘** 적었었다: *"클릭은 아웃박스를 타지 않는 즉시 요청이다"*(참이고, 이 스윕의 단위다)와
     * *"그 화면이 자기 문구를 쓴다"*. 뒤 절은 **오늘 거짓을 날랐다** — 그 "자기 문구"는 영원히
     * 통하지 않을 실패 앞에서 *"링크를 열지 못했어요. 잠시 후 다시 시도해 주세요."* 였다.
     * **제외의 이유가 둘이면 하나가 거짓이 되어도 이 계약은 조용하다.** 그래서 두 코드
     * (`PRODUCT_LINK_NOT_FOUND` · `PRODUCT_LINK_URL_SCHEME_INVALID`)는 이제 표에 있고
     * (아래 "라운드 77 A" 블록이 그 문구를 문다), 여기 남은 사유는 전부 **"이 스윕이 요구하는
     * 배선이 없어도 되는 이유"** 하나만 말한다. 라운드 76 Q-1이 얻은 그 문장의 쌍둥이다.
     */
    const excludedWithReason: Readonly<Record<string, string>> = {
      EXPENSE_CURSOR_INVALID:
        "목록 조회 전용 코드다 — 아웃박스도 준비템 상태 큐도 이 엔드포인트를 지나지 않는다(커서는 앱이 만든 값이고, 그 화면이 자기 폴백을 쓴다는 사실은 사유가 아니라 관측이다).",
      EXPENSE_CHILD_MISMATCH:
        "준비템 상태 PATCH가 expenseId를 함께 보낼 때만 나오는 403인데, 상태 큐가 보내는 것은 상태값 하나다(src/offline/remote-api.ts의 updateItemStatus).",
      VALIDATION_ERROR:
        "바구니 코드다. 표에 넣으면 DTO 검증 실패 전량이 한 문구를 뒤집어쓴다 — 사유가 있는 갈래는 EXPENSE_CATEGORY_INVALID처럼 자기 코드를 받는다.",
      // --- items-catalog.service.ts의 어드민 전용 갈래 (apps/admin만 부른다) ---
      // 다섯 다 어드민 콘솔의 입력 검증이라 모바일 앱은 그 엔드포인트를 호출하지 않는다.
      // 앞의 넷은 원문이 영어다 — 사용자 화면에 설 문장이 아니다. 다섯째(ITEM_TIMING_LABEL_MISMATCH)는
      // 한국어지만 어드민 콘솔 문장이다(운영자가 고칠 구간을 그대로 말해야 해서다) — 언어가 아니라
      // **누가 읽는가**가 이 제외의 근거다.
      ADMIN_ITEM_TEMPLATE_REQUIRED:
        "어드민 준비템 저장의 필수 입력 검증(normalizeAdminItemTemplateInput)과 어드민 링크 생성 시 itemTemplateId 누락 검증이다. 앱은 두 엔드포인트를 모두 호출하지 않는다.",
      ADMIN_PRODUCT_LINK_REQUIRED:
        "어드민 구매 링크 생성/수정의 필수 입력 검증이다(adminCreateProductLink·adminUpdateProductLink). 앱은 이 엔드포인트를 호출하지 않는다.",
      ADMIN_DISCLOSURE_REQUIRED:
        "어드민 고지 문구 저장의 빈 값 검증이다(adminUpdateDisclosure). 앱은 고지 문구를 읽기만 하고 쓰지 않는다.",
      ADMIN_SKIP_REASON_REQUIRED:
        "어드민 준비템 저장에서 필수가 아닌 템플릿에 건너뛰기 안내를 요구하는 검증이다. 앱은 이 엔드포인트를 호출하지 않는다.",
      ITEM_TIMING_LABEL_MISMATCH:
        "어드민 준비템 저장·검토 초안의 시기 라벨↔스테이지 정합 검증이다(라운드 76 E, requireTimingLabelMatchesStages). 앱은 카탈로그를 읽기만 하고 저장 엔드포인트를 호출하지 않는다."
      // --- 라운드 77 A: 구매 링크 클릭의 두 코드(PRODUCT_LINK_NOT_FOUND ·
      //     PRODUCT_LINK_URL_SCHEME_INVALID)는 이 목록을 떠나 표로 갔다. 클릭이 아웃박스를 타지
      //     않는다는 사실은 그대로이고(이 스윕의 단위로는 여전히 제외해도 될 코드다), 표에
      //     들어간 이유는 **화면이 그 코드를 읽어 문구를 고르기 때문**이다 — 위 doc 참고.
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

    // 라운드 77 A ⓓ — 남은 사유는 **이 스윕의 단위**로만 적힌다. "그 화면이 자기 문구를 쓴다"는
    // 제외의 근거가 될 수 없다(그 문구가 오안내가 되는 날 이 계약은 아무 말도 하지 않는다).
    for (const [code, reason] of Object.entries(excludedWithReason)) {
      expect(reason, `${code}의 제외 사유가 "자기 문구"에 기대고 있다`).not.toContain("자기 문구");
    }

    // 그리고 구매 링크 클릭의 두 코드는 이제 제외가 아니라 **표**가 답한다.
    for (const code of ["PRODUCT_LINK_NOT_FOUND", "PRODUCT_LINK_URL_SCHEME_INVALID"]) {
      expect(Object.prototype.hasOwnProperty.call(excludedWithReason, code), `${code}는 제외 목록을 떠났다`).toBe(
        false
      );
      expect(API_ERROR_MESSAGES[code], code).toBeTruthy();
      // 스윕이 실제로 그 코드를 봤다는 것도 함께 못 박는다(제외를 지우기만 하고 표에 없으면
      // 위 루프가 빨개지지만, 스윕이 코드를 놓치면 아무도 모른다).
      expect([...swept], code).toContain(code);
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

/**
 * 라운드 77 A — **핵심 루프 4단계(구매 링크 클릭)가 막다른 문장으로 끝나지 않는다.**
 *
 * 서버는 이 실패의 이유를 오래전부터 코드로 말해 왔다: 링크가 내려갔거나 허용 도메인 밖이면
 * 404 `PRODUCT_LINK_NOT_FOUND`, 저장된 주소의 스킴이 http/https가 아니면 400
 * `PRODUCT_LINK_URL_SCHEME_INVALID`. **셋 다 다시 눌러도 결과가 같은데**, 화면은 그 코드를
 * 보지 않고 *"링크를 열지 못했어요. 잠시 후 다시 시도해 주세요."* 한 문장만 말했다 — 그 상세에
 * 다른 판매처 링크가 두 개 더 서 있어도 사용자는 그것을 눌러 볼 이유를 얻지 못했다.
 *
 * 이 블록이 고정하는 것은 셋이다: 표의 두 문구가 **말해야 하는 것을 말하는가**, 그 코드가
 * **실제 서버 파일에서 오는가**, 그리고 화면이 그 표를 **어떻게 지나는가**(아는 코드면 폴 없이
 * 표의 문구, 모르는 실패면 종전 문장 그대로).
 */
describe("라운드 77 A — 구매 링크 클릭 실패가 이유를 말한다", () => {
  const clickCodes = ["PRODUCT_LINK_NOT_FOUND", "PRODUCT_LINK_URL_SCHEME_INVALID"];
  /** 화면이 모르는 실패에 쓰는 문장. 이 라운드가 **바이트 하나도 바꾸지 않은** 폴백이다. */
  const screenFallback = "링크를 열지 못했어요. 잠시 후 다시 시도해 주세요.";

  it("서버가 코드로 말한 두 실패가 표를 지나 화면 문구가 된다", () => {
    // 어드민이 링크를 내렸다 / 허용 도메인 밖이다 — 서버는 두 갈래에 같은 404를 준다.
    const notFound = new ApiHttpError(404, envelope("PRODUCT_LINK_NOT_FOUND", "상품 링크를 찾을 수 없어요."));
    const notFoundShown = apiErrorMessage(notFound, screenFallback);
    expect(notFoundShown).toBe(API_ERROR_MESSAGES.PRODUCT_LINK_NOT_FOUND);
    expect(notFoundShown).not.toBe(screenFallback);

    // 저장된 주소의 스킴이 깨졌다(requireHttpUrl). 사용자가 고칠 수 있는 값이 아니다.
    const badScheme = new ApiHttpError(
      400,
      envelope("PRODUCT_LINK_URL_SCHEME_INVALID", "상품 링크 주소는 http 또는 https로 시작해야 해요.")
    );
    const badSchemeShown = apiErrorMessage(badScheme, screenFallback);
    expect(badSchemeShown).toBe(API_ERROR_MESSAGES.PRODUCT_LINK_URL_SCHEME_INVALID);
    // 서버 원문은 **어드민이 읽을 문장**이다 — 주소를 고칠 수 있는 사람은 사용자가 아니다.
    expect(badSchemeShown).not.toContain("http 또는 https");

    // 모르는 실패는 종전 그대로 화면의 문장이다(표가 새 폴백을 만들지 않는다).
    expect(apiErrorMessage(new ApiHttpError(500, envelope("INTERNAL_ERROR", "…")), screenFallback)).toBe(
      screenFallback
    );
    expect(apiErrorMessage(new Error("Network request failed"), screenFallback)).toBe(screenFallback);
  });

  it("두 문구는 재시도를 권하지 않고, 지금 눌러 볼 것을 말한다", () => {
    for (const code of clickCodes) {
      const message = API_ERROR_MESSAGES[code];
      expect(message, code).toBeTruthy();
      // LINKED_PRODUCT_LINK_NOT_FOUND가 지는 그 부정 단언과 같은 모양이다.
      for (const retryPhrase of ["잠시 후 다시", "다시 시도"]) {
        expect(message, `${code}는 "${retryPhrase}"를 쓰지 않는다`).not.toContain(retryPhrase);
      }
      // 사실 한 문장 + 다음에 할 일 한 문장(ITEM_NOT_FOUND 계열의 문형).
      expect(message.split("요.").filter(Boolean).length, code).toBeGreaterThanOrEqual(2);
      // ⚠️ 라운드 77 리뷰 S-4: 꼬리가 **"다른 구매 링크"를 단정하지 않는다.** 이 표는 코드만
      // 보고 답하므로 그 상세에 다른 판매처 링크가 있는지 모르고, 링크가 하나뿐인 준비템에서는
      // 없는 것을 가리키는 안내가 된다(막다른 문장을 문형만 바꿔 되풀이하는 꼴).
      expect(message, code).toContain("이 준비템의 구매 링크를 다시 확인해 주세요.");
      expect(message, `${code}는 다른 링크의 존재를 단정하지 않는다`).not.toContain("다른 구매 링크");
      // 표기 방언(P3): 새 문장은 **띄어 쓴 쪽**을 쓴다 — 붙여 쓴 파일 셋에 넷째를 더하지 않는다.
      expect(message, code).not.toContain("확인해주세요");
      expect(message, code).not.toContain("시도해주세요");
    }
    // 두 문구는 서로 다른 사실을 말한다(같은 문장을 두 코드에 붙이면 코드가 둘일 이유가 없다).
    expect(API_ERROR_MESSAGES.PRODUCT_LINK_NOT_FOUND).not.toBe(API_ERROR_MESSAGES.PRODUCT_LINK_URL_SCHEME_INVALID);
  });

  it("두 코드는 실제 서버가 던지는 코드다 — 404는 갈래가 둘이고 코드는 하나다", () => {
    const catalog = thrownCodesIn("onboarding/items-catalog.service.ts");
    for (const code of clickCodes) {
      expect(catalog, `${code} ← onboarding/items-catalog.service.ts`).toContain(code);
    }
    const catalogSource = apiSource("onboarding/items-catalog.service.ts");
    // 갈래 ⓐ: 링크가 없거나 active:false. 갈래 ⓑ: 허용 도메인 밖(같은 404를 재사용한다).
    expect(catalogSource).toContain('code: "PRODUCT_LINK_NOT_FOUND", message: "상품 링크를 찾을 수 없어요."');
    expect(catalogSource).toContain("throw new NotFoundException(PRODUCT_LINK_NOT_FOUND_ERROR);");
    expect(apiSource("items-commerce/affiliate-link-guard.util.ts")).toContain('code: "PRODUCT_LINK_NOT_FOUND"');
    // 스킴 검증은 클릭 경로와 어드민 저장이 같은 함수를 쓴다(requireHttpUrl).
    expect(catalogSource).toContain('code: "PRODUCT_LINK_URL_SCHEME_INVALID"');
    expect(catalogSource).toContain("this.requireHttpUrl(redirectUrl);");
  });

  /**
   * 배선 계약 — 화면은 vitest에서 렌더할 수 없으므로 이 파일의 관례대로 소스로 확인한다.
   * 계약 ⓐ: **아는 코드면 표의 문구가, 모르면 종전 문장이** 선다. 그리고 오프라인 폴은
   * **모르는 실패에서만** 돈다 — 서버가 코드로 답했다는 사실이 곧 연결이 있었다는 뜻이라,
   * 그때 연결 안내로 갈아 끼우면 오안내 하나를 다른 오안내로 바꾸는 것이 된다.
   */
  it("화면이 표를 지난다 — 아는 코드는 폴 없이, 모르는 실패는 종전 그대로", () => {
    const detailSource = source("app/items/[itemTemplateId].tsx");
    expect(detailSource).toContain('import { apiErrorCodeOf, apiErrorMessageForCode } from "../../src/api/api-error";');
    // 종전에는 인자를 **받지도 않았다**(onError: () => {) — 그것이 이 후보의 본체였다.
    expect(detailSource).toContain("onError: (error) => {");
    expect(detailSource).toContain("const knownFailureReason = apiErrorMessageForCode(apiErrorCodeOf(error));");
    // 라운드 99 F2 M-3(핀 동반 이관): 아는 코드의 문구가 서는 칸이 성공 카드(clickedTitle)에서
    // 실패 전용 칸(linkFailureNotice)으로 갈라졌다 — PRODUCT_LINK_NOT_FOUND는 링크가 열리지
    // 않았다는 뜻이라, 그 문구 위에 "준비 완료로 남길까요?"(구매 후속 CTA)가 서면 안 된다.
    // "아는 코드는 폴 없이"라는 이 계약의 본체는 그대로다(showLinkFailureNotice에는 폴이 없다).
    expect(detailSource).toContain("if (knownFailureReason) showLinkFailureNotice(knownFailureReason);");
    // 모르는 실패의 문장은 **바이트 불변**이고, 그 갈래만 오프라인 폴을 지난다.
    expect(detailSource).toContain(`else showLinkFailure("${screenFallback}");`);
    expect(detailSource).toContain("const showLinkFailure = (onlineNotice: string) => {");
    expect(detailSource).toContain("if (!online) setLinkFailureNotice(OFFLINE_RETRY_NOTICE);");
    expect(detailSource).toContain("if (linkNoticeSeqRef.current !== seq) return;");
    // 화면은 문구를 새로 짓지 않는다 — 표의 두 문장이 이 파일에 사본으로 적히면 안 된다.
    for (const code of clickCodes) {
      expect(detailSource, code).not.toContain(API_ERROR_MESSAGES[code]);
    }
  });
});

/**
 * 라운드 78 A — **루프에 들어오기 전의 관문(아이 프로필·임신→출생 전환)이 막다른 문장으로
 * 끝나지 않는다.**
 *
 * 서버는 이 여정의 실패도 오래전부터 코드로 말해 왔다(onboarding/onboarding-core.service.ts):
 * `CHILD_BIRTH_DATE_FUTURE` · `CHILD_DUE_DATE_BEYOND_TERM` ·
 * `CHILD_STAGE_MODE_TRANSITION_NOT_ALLOWED`. **셋 다 다시 눌러도 결과가 같은데** 표 밖에 있었고,
 * ⚠️ 그 여정에는 **스윕조차 없어서** 서버가 코드를 더해도 아무 단언도 깨지지 않았다 —
 * 표에 이미 있던 `CHILD_BIRTH_DATE_TOO_OLD`마저 온보딩 화면에는 구조적으로 설 수 없었다
 * (step-ui.tsx가 표를 부르지 않았다 — 그 갈래의 계약은 local-progress.test.ts가 진다).
 *
 * 이 블록이 고정하는 것은 넷이다: 세 문구가 **말해야 하는 것을 말하는가**(그리고 문장을 새로
 * 짓지 않았는가), 그 코드가 **실제 서버 파일에서 오는가**, **두 번째 여정 스윕**이 앞으로도
 * 표를 늘어나게 하는가, 그리고 ⚠️ **표의 "코드 하나 = 문장 하나" 가정이 서버에서는 참이
 * 아니라는 관측**.
 */
describe("라운드 78 A — 아이 프로필 여정의 실패가 이유를 말한다", () => {
  /** 이번 라운드가 표에 세운 세 줄. 문장은 셋 다 이미 있던 것이다(새 한국어 문장 0건). */
  const round78Codes = [
    "CHILD_BIRTH_DATE_FUTURE",
    "CHILD_DUE_DATE_BEYOND_TERM",
    "CHILD_STAGE_MODE_TRANSITION_NOT_ALLOWED"
  ];

  /**
   * 온보딩 저장 실패 카드가 **모르는 실패**에 쓰는 문장(src/onboarding/step-ui.tsx).
   * 이 라운드가 바이트 하나도 바꾸지 않은 폴백이고, 세 코드가 종전에 받던 것이 이 한 줄이었다.
   */
  const onboardingFallback = "저장하지 못했어요. 네트워크 연결을 확인한 뒤 다시 시도해 주세요.";

  it("세 줄이 표에 있고, 표는 문장을 짓지 않는다 (폼 상수 둘 + 서버 원문 하나)", () => {
    for (const code of round78Codes) {
      expect(API_ERROR_MESSAGES[code], code).toBeTruthy();
    }
    // 앞 둘은 폼이 이미 세운 문장이다 — 같은 경계를 폼과 표가 다른 말로 부르지 않는다.
    expect(API_ERROR_MESSAGES.CHILD_BIRTH_DATE_FUTURE).toBe(CHILD_BIRTH_DATE_FUTURE_ERROR);
    expect(API_ERROR_MESSAGES.CHILD_DUE_DATE_BEYOND_TERM).toBe(CHILD_DUE_DATE_BEYOND_TERM_ERROR);
    // 만삭 주차는 도메인에서 온다 — 이 표에도 폼에도 숫자가 리터럴로 적히지 않는다.
    expect(CHILD_DUE_DATE_BEYOND_TERM_ERROR).toBe(`만삭(${CHILD_DUE_DATE_MAX_FUTURE_WEEKS}주)보다 먼 날은 고를 수 없어요.`);
    const apiErrorSource = source("src/api/api-error.ts");
    expect(apiErrorSource).toContain("CHILD_BIRTH_DATE_FUTURE: CHILD_BIRTH_DATE_FUTURE_ERROR,");
    expect(apiErrorSource).toContain("CHILD_DUE_DATE_BEYOND_TERM: CHILD_DUE_DATE_BEYOND_TERM_ERROR,");
    expect(apiErrorSource).not.toContain(`만삭(${CHILD_DUE_DATE_MAX_FUTURE_WEEKS}주)`);
    // 셋째는 서버 원문 그대로다(EXPENSE_FUTURE_DATE·EXPENSE_CATEGORY_INVALID의 선례).
    expect(API_ERROR_MESSAGES.CHILD_STAGE_MODE_TRANSITION_NOT_ALLOWED).toBe(
      "아이 상태는 '임신 중'에서 '태어났어요'로만 바꿀 수 있어요."
    );
  });

  it("앞 두 문장은 서버 원문과 바이트 동일하다 (앱과 서버가 다른 말로 설명하지 않는다)", () => {
    const core = apiSource("onboarding/onboarding-core.service.ts");
    // 출생일 미래 금지: 폼 상수 = 서버 원문.
    expect(core).toContain(`message: "${CHILD_BIRTH_DATE_FUTURE_ERROR}"`);
    // 만삭 상한: 서버는 주차를 자기 층에서 읽어 같은 문형을 만든다(템플릿이라 꼬리로 맞춘다).
    expect(core).toContain("주)보다 먼 날은 고를 수 없어요.");
    expect(CHILD_DUE_DATE_BEYOND_TERM_ERROR.endsWith("주)보다 먼 날은 고를 수 없어요.")).toBe(true);
    // 전환 거절: 서버 원문을 글자 그대로 쓴다.
    expect(core).toContain(`message: "${API_ERROR_MESSAGES.CHILD_STAGE_MODE_TRANSITION_NOT_ALLOWED}"`);
  });

  it("세 문장은 재시도를 권하지 않고, 붙여 쓴 방언을 늘리지 않는다", () => {
    for (const code of round78Codes) {
      const message = API_ERROR_MESSAGES[code];
      // 다시 눌러도 결과가 같은 실패다 — 재시도를 권하는 순간 그것이 허위 안내다.
      for (const retryPhrase of ["잠시 후 다시", "다시 시도"]) {
        expect(message, `${code}는 "${retryPhrase}"를 쓰지 않는다`).not.toContain(retryPhrase);
      }
      // 표기 방언(P3): 새 줄은 붙여 쓴 파일 셋에 넷째를 더하지 않는다.
      expect(message, code).not.toContain("확인해주세요");
      expect(message, code).not.toContain("시도해주세요");
      // 그리고 종전에 이 셋이 받던 막다른 폴백과 다르다(그것이 이 트랙의 본체다).
      expect(message, code).not.toBe(onboardingFallback);
    }
  });

  it("서버가 던진 그 코드를 받으면 표의 문구가 서고, 온보딩의 막다른 폴백은 사라진다", () => {
    // 실패 시나리오: 공동양육자가 먼저 [아이가 태어났어요]를 눌러 전환을 마친 뒤, 어제 열어 둔
    // 화면에서 같은 버튼을 누른다(이미 born이라 pregnant→born이 아니다).
    const transition = new ApiHttpError(
      400,
      envelope(
        "CHILD_STAGE_MODE_TRANSITION_NOT_ALLOWED",
        "아이 상태는 '임신 중'에서 '태어났어요'로만 바꿀 수 있어요."
      )
    );
    const transitionShown = apiErrorMessage(transition, onboardingFallback);
    expect(transitionShown).toBe(API_ERROR_MESSAGES.CHILD_STAGE_MODE_TRANSITION_NOT_ALLOWED);
    expect(transitionShown).not.toBe(onboardingFallback);

    const future = new ApiHttpError(400, envelope("CHILD_BIRTH_DATE_FUTURE", CHILD_BIRTH_DATE_FUTURE_ERROR));
    expect(apiErrorMessage(future, onboardingFallback)).toBe(CHILD_BIRTH_DATE_FUTURE_ERROR);

    const beyondTerm = new ApiHttpError(
      400,
      envelope("CHILD_DUE_DATE_BEYOND_TERM", CHILD_DUE_DATE_BEYOND_TERM_ERROR)
    );
    expect(apiErrorMessage(beyondTerm, onboardingFallback)).toBe(CHILD_DUE_DATE_BEYOND_TERM_ERROR);

    // 모르는 실패는 종전 그대로 화면의 문장이다(표가 새 폴백을 만들지 않는다).
    expect(apiErrorMessage(new ApiHttpError(500, envelope("INTERNAL_ERROR", "…")), onboardingFallback)).toBe(
      onboardingFallback
    );
    expect(apiErrorMessage(new Error("Network request failed"), onboardingFallback)).toBe(onboardingFallback);
  });

  it("표의 세 줄은 실제 서버 파일이 던지는 코드다 (반대 방향 — 유령 줄 금지)", () => {
    const origins: Readonly<Record<string, string>> = {
      CHILD_BIRTH_DATE_FUTURE: "onboarding/onboarding-core.service.ts",
      CHILD_DUE_DATE_BEYOND_TERM: "onboarding/onboarding-core.service.ts",
      CHILD_STAGE_MODE_TRANSITION_NOT_ALLOWED: "onboarding/onboarding-core.service.ts"
    };

    for (const [code, file] of Object.entries(origins)) {
      expect(thrownCodesIn(file), `${code} ← ${file}`).toContain(code);
    }
  });

  /**
   * **두 번째 여정 스윕** — 이 라운드의 진짜 산출물이다.
   *
   * 저장소에서 여정 단위의 서버 파일 목록을 가진 것은 오늘까지 하나였다
   * (`IMPORT_JOURNEY_SERVER_FILES` — 가져오기 여정 셋). 아웃박스 스윕(`outboxPathFiles` — 넷)은
   * 여정이 아니라 **큐의 단위**이고, 그래서 큐를 타지 않는 아이 저장은 어느 그물에도 걸리지
   * 않았다. 여기 두 번째 목록이 선다: 아이 프로필 여정의 서버 파일이 던지는 코드는 표에 있거나,
   * **이유가 적힌 제외 목록**에 있어야 한다.
   *
   * ⚠️ **기존 아웃박스 스윕과 합치지 않는다** — 단위가 다르다(아이 저장에는 큐가 없다).
   * 라운드 77 A가 얻은 규율 그대로, 제외의 사유는 **그 스윕의 단위로만** 적는다: 여기서는
   * *"아이 프로필 여정의 화면이 이 코드를 문구로 받을 필요가 없는 이유"* 하나만이 사유다.
   */
  it("아이 프로필 여정 서버 파일의 4xx 코드는 표에 있거나, 이유가 적힌 제외 목록에 있다", () => {
    const CHILD_PROFILE_JOURNEY_SERVER_FILES = [
      // 생성·수정·전환·진행도·예산·파기 확인이 한 서비스에 있다(아홉 코드를 던진다).
      "onboarding/onboarding-core.service.ts",
      // 그 앞을 지나는 접근 판정(아이가 사라졌다 · 이 가족의 아이가 아니다).
      "onboarding/child-access.service.ts"
    ];

    /**
     * 표에 넣지 않는 코드와 그 이유. 비우면 안 되고, 사유는 **이 스윕의 단위**로만 적는다.
     */
    const excludedWithReason: Readonly<Record<string, string>> = {
      CHILD_STAGE_INPUT_REQUIRED:
        "⚠️ 한 코드가 서버에서 세 문장을 나른다(출산 예정일 · 아이 생년월일 · 아이 단계). 표의 단위는 코드라 하나를 고르면 나머지 둘에 거짓이 된다 — 이 여정에서 그 셋을 가르는 것은 폼의 requireDate 검증이고, 사용자는 서버에 닿기 전에 그 문장을 받는다.",
      CONSENT_REQUIRED:
        "이 여정에서 답은 문구가 아니라 복구 동선이다 — 온보딩 저장 실패 카드는 전용 버튼(onReconsent)을 세워 동의를 다시 올린 뒤 같은 저장을 재시도한다(src/onboarding/consent-recovery.ts). 표에 넣으면 그 동선을 잃고 문장 하나로 접힌다.",
      BUDGET_NOT_FOUND:
        "실패가 아니라 정상 흐름이다 — '예산 미설정'이 그 화면의 정상 상태이고, 앱은 이 404를 문구로 만들지 않고 null로 접는다(src/api/client.ts의 getBudget).",
      SETTINGS_CONFIRMATION_REQUIRED:
        "확인 문자열은 앱이 만드는 상수이지 사용자가 치는 값이 아니다(src/api/local-backend.ts의 confirmationText ↔ 서버의 DELETE CHILD/LEAVE HOUSEHOLD/DELETE ACCOUNT). 이 코드가 오면 사용자가 고칠 것이 없는 배선 어긋남이라, 문구를 주는 것이 오히려 거짓 안내가 된다."
    };

    /**
     * ⚠️ **라운드 78 리뷰 M-2 — 표에는 있지만 이 여정의 한 화면이 앞에서 가로채는 코드.**
     *
     * 제외(위)와 단위가 다르다: 이 코드는 표에 **있고** 다른 화면에서는 그 문장이 옳다. 다만
     * 온보딩에는 그 문장이 가리키는 목적지가 없어서, step-ui가 표보다 앞에서 갈라 자기
     * 문장을 세운다. 그 사실을 스윕 옆에 값으로 적어 두지 않으면 다음 라운드는 "표에 있으니
     * 화면에도 선다"고 읽는다 — **이 스윕은 화면 적합성을 판정하지 못한다**(그 한계는
     * docs/qa/runtime-verification-required.md #124가 실기기 표면으로 진다).
     */
    const tableBypassedByScreen: Readonly<Record<string, string>> = {
      CHILD_NOT_FOUND:
        "표의 문장이 \"아이 목록에서 확인해 주세요\"로 끝나는데 온보딩에는 그 목적지가 없다(탭도 목록도 아직 서지 않는다). 공동양육자가 그사이 아이를 지우면 ONB-003·004 저장이 이 404를 받으므로 도달 경로는 실재한다 — step-ui가 표보다 앞에서 갈라, 아이 삭제 흐름이 이미 쓰는 문장을 그대로 세운다(src/settings/destructive-flow-messages.ts)."
    };

    const swept = new Set(CHILD_PROFILE_JOURNEY_SERVER_FILES.flatMap(thrownCodesIn));
    // 스윕이 실제로 무언가를 읽었는지부터 확인한다(정규식이 조용히 0건이 되면 계약이 사라진다).
    expect(swept.size).toBeGreaterThanOrEqual(10);
    expect([...swept].filter((code) => code.startsWith("UNRESOLVED:"))).toEqual([]);

    // 가로채는 코드는 ⓐ 이 여정의 서버 파일이 실제로 던지고, ⓑ 표에도 있고(다른 화면의 답이다),
    // ⓒ 그 화면에 갈래가 실재한다. 셋 중 하나라도 어긋나면 이 기록이 유령이 된다.
    const stepUiSource = source("src/onboarding/step-ui.tsx");
    for (const [code, reason] of Object.entries(tableBypassedByScreen)) {
      expect(swept.has(code), `${code}는 이 여정의 서버 파일이 던지지 않는다`).toBe(true);
      expect(API_ERROR_MESSAGES[code], code).toBeTruthy();
      expect(reason.length, code).toBeGreaterThan(20);
      expect(stepUiSource, code).toContain(`if (hasApiErrorCode(error, "${code}")) return ONBOARDING_CHILD_GONE_MESSAGE;`);
      // 그 화면은 표의 문장을 사본으로 들고 있지 않다(가로채는 이유가 바로 그 문장이다).
      expect(stepUiSource, code).not.toContain(API_ERROR_MESSAGES[code]);
    }

    for (const code of swept) {
      const known = Object.prototype.hasOwnProperty.call(API_ERROR_MESSAGES, code);
      const excluded = Object.prototype.hasOwnProperty.call(excludedWithReason, code);
      expect(
        known || excluded,
        `${code}: 표에 없고 제외 이유도 없다. 이 코드를 받은 아이 저장 실패는 온보딩에서 "${onboardingFallback}"가 된다.`
      ).toBe(true);
    }

    // 제외 목록이 유령을 들고 있지 않은지도 본다 — 서버가 더는 던지지 않는 코드의 이유는 남을 수 없다.
    for (const [code, reason] of Object.entries(excludedWithReason)) {
      expect(swept.has(code), `${code}는 서버가 더는 던지지 않는다 — 제외 이유가 남을 수 없다`).toBe(true);
      expect(reason.length, code).toBeGreaterThan(20);
      // 라운드 77 A의 규율: "그 화면이 자기 문구를 쓴다"는 제외의 근거가 될 수 없다
      // (그 문구가 오안내가 되는 날 이 계약은 아무 말도 하지 않는다).
      expect(reason, `${code}의 제외 사유가 "자기 문구"에 기대고 있다`).not.toContain("자기 문구");
    }

    // 제외 사유가 실제 자리를 가리키는지 — 셋은 소스에서 그 사실을 확인할 수 있다.
    expect(apiSource("onboarding/onboarding-core.service.ts").match(/code: "CHILD_STAGE_INPUT_REQUIRED"/g) ?? []).toHaveLength(4);
    expect(source("src/api/client.ts")).toContain(
      'if (error instanceof Error && error.message.includes("BUDGET_NOT_FOUND")) return null;'
    );
    expect(source("src/api/local-backend.ts")).toContain('confirmationText: "DELETE CHILD"');

    // 그리고 이 여정의 네 코드는 이제 제외가 아니라 **표**가 답한다(둘은 이 라운드가 세웠다).
    for (const code of [...round78Codes, "CHILD_BIRTH_DATE_TOO_OLD"]) {
      expect(Object.prototype.hasOwnProperty.call(excludedWithReason, code), `${code}는 제외 목록에 없다`).toBe(
        false
      );
      expect(API_ERROR_MESSAGES[code], code).toBeTruthy();
      expect([...swept], code).toContain(code);
    }
  });

  /**
   * ⓔ **관측** — 표는 "코드 하나 = 문장 하나"를 가정하는데 서버는 그렇지 않다.
   *
   * 오늘 거짓은 없다(표 안의 셋은 앱이 부르는 갈래가 하나뿐이다). 그 사실을 값으로 적는 것이
   * 이 케이스의 전부이고, **표를 늘리는 다음 라운드가 먼저 물어야 할 질문**이 그것이다.
   * 수치는 이 스윕 자신이 센 값이다 — 정찰의 어림값(코드 95)과 다르면 스윕 쪽이 옳다.
   */
  it("ⓔ 서버는 한 코드로 여러 문장을 던진다 — 표 안에서 그런 코드는 오늘 셋뿐이다", () => {
    const messagesByCode = serverMessagesByCode();
    const multiMessageCodes = [...messagesByCode].filter(([, messages]) => messages.size > 1);

    // 2026-08-30 실측: `code:` 리터럴 97 · 문장이 붙은 코드 94 · 둘 이상을 나르는 코드 18
    // (최대 FORBIDDEN 다섯). 서버가 코드를 더하는 것은 자유이므로 하한으로 적는다.
    expect(messagesByCode.size).toBeGreaterThanOrEqual(94);
    expect(multiMessageCodes.length).toBeGreaterThanOrEqual(18);
    expect(messagesByCode.get("FORBIDDEN")?.size ?? 0).toBeGreaterThanOrEqual(5);

    // **전수 부정 단언**: 표 안에서 문장을 둘 이상 나르는 코드는 오늘 정확히 이 셋이다.
    // 넷째가 생기는 날(표의 어떤 코드가 서버에서 다른 문장을 하나 더 갖는 날) 여기가 빨개진다.
    const multiInTable = Object.keys(API_ERROR_MESSAGES)
      .filter((code) => (messagesByCode.get(code)?.size ?? 0) > 1)
      .sort();
    expect(multiInTable).toEqual(["FORBIDDEN", "ITEM_NOT_FOUND", "PRODUCT_LINK_NOT_FOUND"]);

    // 이번에 더한 셋은 그 열여덟에 속하지 않는다 — 코드 하나가 문장 하나다.
    for (const code of round78Codes) {
      expect(messagesByCode.get(code)?.size, code).toBe(1);
    }
    // 그리고 제외된 CHILD_STAGE_INPUT_REQUIRED는 정확히 그 반대 이유로 제외됐다(문장 셋).
    expect(messagesByCode.get("CHILD_STAGE_INPUT_REQUIRED")?.size).toBe(3);
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

/**
 * 라운드 79 트랙 C — **가족 여정의 세 번째 그물**(known-limitations L-1의 답).
 *
 * ## L-1의 질문과, 실측이 낸 답
 *
 * 세 라운드 동안 *"세 모듈이 같은 표를 같은 순서로 읽는가"* 로 이월돼 온 질문의 답은
 * **모듈은 넷이고, 읽지 않으며, 그 분리에는 각각 이유가 있다**이다.
 *
 * | 모듈 | 코드 추출 | 판정 순서 | 표 |
 * | --- | --- | --- | --- |
 * | `resolveSaveErrorCopy`(src/offline/messages.ts) | `apiErrorCodeOf` | 표 → 오프라인 → 폴백 | `API_ERROR_MESSAGES` |
 * | `memberMutationErrorMessage`(src/family/member-mutation-messages.ts) | `familyErrorCodeOf`(= 위 + 옛 봉투 JSON) | 403 → **자기 표(넷)** → 오프라인 → 종류별 폴백 | 자기 표 |
 * | `inviteCreateErrorMessage`(src/family/invite-permissions.ts) | `isInviteForbiddenError`(봉투 JSON 직접) | 403 → 오프라인 → **훅의 답** → 초대 폴백 | 훅을 지난 표 |
 * | `isInviteUnavailableError`(src/family/invite-accept-messages.ts) | `hasApiErrorCode` | **코드 둘 → 한 문장**(오프라인 갈래 없음) | 코드 목록 둘 |
 *
 * ⚠️ **표를 통합하면 안 되는 이유가 이미 소스에 있다.** 서버 원문이 영어이거나
 * (`HOUSEHOLD_MEMBER_NOT_FOUND: "Household member was not found."`) 이 화면 맥락에서만 뜻이
 * 통하고(*"이미 가족에서 빠진 구성원이에요"*), 초대 수락은 `INVITE_NOT_FOUND`와
 * `INVITE_NOT_PENDING`을 **일부러 한 문장으로** 받는다(무인증 공개 조회라 둘을 가르면 앱이
 * **존재 오라클**이 된다). **표에 넣는 순간 그 판단이 사라진다.**
 *
 * ## 그래서 없던 것은 표의 통합이 아니라 **스윕**이다
 *
 * 저장소의 여정 스윕은 오늘까지 둘이었다(`IMPORT_JOURNEY_SERVER_FILES` 셋 ·
 * `CHILD_PROFILE_JOURNEY_SERVER_FILES` 둘). 아웃박스 스윕(`outboxPathFiles` 넷)은 **큐의 단위**라
 * 가족 여정이 그 안에 없다 — 가족 관리·초대에는 큐가 없다. 즉 **서버에 초대 관련 코드가 하나
 * 늘어도 오늘은 아무 단언도 깨지지 않은 채 네 모듈 전부의 밖에 선다.** 여기 세 번째 목록이
 * 선다: 가족 여정 서버 파일이 던지는 4xx 코드는 **네 출구 중 하나**에 있어야 한다.
 *
 * ⚠️ **네 출구를 명시하는 것이 이 스윕의 본체다.** 라운드 78 A의 스윕은 출구가 **둘**(표 ·
 * 이유가 적힌 제외)이었는데 이 여정은 **넷**이고, 그 사실을 적지 않으면 다음 라운드가
 * *"표에 없다"*를 결함으로 읽어 표를 늘리려 든다 — 그것이 이 트랙이 **하지 않기로 판정한**
 * 바로 그 일이다(`API_ERROR_MESSAGES`에 줄 0건 · 제품 소스 0건).
 *
 * ⚠️ **기존 세 스윕과 합치지 않는다** — 단위가 다르다(가져오기 여정 · 아이 프로필 여정 · 큐).
 * 라운드 77 A가 얻은 규율 그대로, 제외의 사유는 **이 스윕의 단위로만** 적는다.
 */
describe("라운드 79 C — 가족 여정의 세 번째 그물 (네 출구의 합집합)", () => {
  /**
   * 이 여정을 만드는 서버 파일 **둘**. 스윕의 단위는 파일이 아니라 여정이다.
   *
   * 둘째가 **관문**이다(가져오기 여정이 라운드 76 C에서 배운 그 교훈): 컨트롤러가 오늘 4xx를
   * 직접 던지지 않아도 목록에 들고 있어야, 그 자리에 코드가 하나 생기는 날 이 스윕이 본다.
   */
  const FAMILY_JOURNEY_SERVER_FILES = [
    // 구성원 조회·삭제 · 초대 생성/목록/취소 · 초대 미리보기 · 수락이 한 서비스에 있다.
    "households/household-runtime.service.ts",
    // 앱이 실제로 부르는 일곱 엔드포인트의 관문(무인증 공개 조회 하나가 여기서 갈린다).
    "households/households.controller.ts"
  ] as const;

  /** 서버가 코드로 답한 실패의 모양. 원문은 어느 출구로도 화면에 나가지 않는다. */
  const journeyError = (code: string) => new ApiHttpError(400, envelope(code, "서버 원문(앱은 그대로 쓰지 않는다)"));

  const MEMBER_MUTATION_KINDS = ["remove_member", "cancel_invite"] as const;
  /** `memberMutationErrorMessage`가 **자기 표 밖**에서 돌려줄 수 있는 문장 전부. */
  const MEMBER_MUTATION_NON_TABLE_ANSWERS: ReadonlyArray<string> = [
    MEMBER_REMOVE_FAILED_MESSAGE,
    INVITE_CANCEL_FAILED_MESSAGE,
    MEMBER_MANAGE_FORBIDDEN_MESSAGE,
    OFFLINE_RETRY_NOTICE
  ];

  /**
   * **네 출구.** 손으로 적은 코드 목록이 아니라 **각 모듈에 실제로 물어본 답**이다 — 모듈의
   * 표가 바뀌면 이 판정도 함께 바뀐다(사본을 만들면 그 순간 다섯째 표가 생긴다).
   */
  const JOURNEY_EXITS: ReadonlyArray<{ readonly name: string; readonly answers: (code: string) => boolean }> = [
    {
      name: "① 공용 표(src/api/api-error.ts의 API_ERROR_MESSAGES)",
      answers: (code) => apiErrorMessageForCode(code) !== null
    },
    {
      name: "② member-mutation-messages의 자기 표(이 화면 맥락에서만 뜻이 통하는 넷)",
      answers: (code) =>
        MEMBER_MUTATION_KINDS.every(
          (kind) =>
            !MEMBER_MUTATION_NON_TABLE_ANSWERS.includes(
              memberMutationErrorMessage(kind, journeyError(code), { isOnline: true })
            )
        )
    },
    {
      name: "③ invite-accept-messages의 코드 목록 둘(둘을 일부러 한 문장으로 받는다)",
      answers: (code) => isInviteUnavailableError(journeyError(code))
    }
  ];

  /**
   * 네 출구 중 **넷째** — 이유가 적힌 제외. 비우면 안 되고, 사유는 **이 스윕의 단위**로만 적는다
   * (라운드 78 A의 `SETTINGS_CONFIRMATION_REQUIRED` 사유와 같은 모양).
   */
  const excludedWithReason: Readonly<Record<string, string>> = {
    HOUSEHOLD_NOT_FOUND:
      "가구 행 자체가 사라진 경우다(requireHousehold — 삭제됐거나 active가 아니다). 세션이 그 가구를 들고 있는 한 사용자가 고칠 것이 없는 배선 어긋남이라, 이 여정의 어느 화면도 이 코드를 문구로 받을 필요가 없다 — 저장소 전체에서 소비자가 0건인 것도 그 사실의 결과다."
  };

  const sweptCodes = () => new Set(FAMILY_JOURNEY_SERVER_FILES.flatMap(thrownCodesIn));

  /** 이 여정 파일 안에서만 센 `코드 → 서로 다른 문장들`(전역 스윕과 단위가 다르다). */
  function journeyMessagesByCode(): Map<string, Set<string>> {
    const table = new Map<string, Set<string>>();
    for (const file of FAMILY_JOURNEY_SERVER_FILES) {
      for (const match of apiSource(file).matchAll(/\bcode: "([A-Z0-9_]+)",\s*message: (`[^`]*`|"[^"]*")/g)) {
        if (!table.has(match[1])) table.set(match[1], new Set());
        table.get(match[1])!.add(match[2]);
      }
    }
    return table;
  }

  it("ⓐ 전수 — 가족 여정 서버 파일의 4xx 코드는 네 출구 중 하나를 지난다", () => {
    const swept = sweptCodes();
    // 스윕이 실제로 무언가를 읽었는지부터 확인한다(정규식이 조용히 0건이 되면 계약이 사라진다).
    // 2026-08-30 실측: 일곱.
    expect(swept.size).toBeGreaterThanOrEqual(7);
    expect([...swept].filter((code) => code.startsWith("UNRESOLVED:"))).toEqual([]);

    for (const code of swept) {
      const exit = JOURNEY_EXITS.find((candidate) => candidate.answers(code));
      const excluded = Object.prototype.hasOwnProperty.call(excludedWithReason, code);
      expect(
        Boolean(exit) || excluded,
        `${code}: 네 출구 어디에도 없다. 이 코드를 받은 사용자는 가족 화면에서 "${MEMBER_REMOVE_FAILED_MESSAGE}", 초대 화면에서 "${INVITE_CREATE_FAILED_MESSAGE}"를 보고 다시 눌러도 같은 결과를 얻는다.`
      ).toBe(true);
    }
  });

  it("ⓑ 유령 금지 — 네 출구가 전부 실재하고, 오늘 각각이 답하는 코드가 이것이다", () => {
    const swept = [...sweptCodes()].sort();
    const answeredBy = (index: number) => swept.filter((code) => JOURNEY_EXITS[index].answers(code));

    // ⚠️ 합집합을 명시하는 것이 이 스윕의 본체다 — 출구가 넷이라는 사실을 값으로 적는다.
    expect(answeredBy(0), JOURNEY_EXITS[0].name).toEqual(["FORBIDDEN", "HOUSEHOLD_ALREADY_MEMBER"]);
    expect(answeredBy(1), JOURNEY_EXITS[1].name).toEqual([
      "HOUSEHOLD_MEMBER_NOT_FOUND",
      "HOUSEHOLD_MEMBER_REMOVE_OWNER_FORBIDDEN",
      "INVITE_NOT_FOUND",
      "INVITE_NOT_PENDING"
    ]);
    expect(answeredBy(2), JOURNEY_EXITS[2].name).toEqual(["INVITE_NOT_FOUND", "INVITE_NOT_PENDING"]);
    expect(Object.keys(excludedWithReason)).toEqual(["HOUSEHOLD_NOT_FOUND"]);

    // 출구가 겹치는 자리가 있다는 것도 사실이다 — 두 화면이 같은 코드에 각자 답한다
    // (취소하려던 초대가 이미 끝났다 / 받은 초대 링크가 이미 끝났다).
    for (const code of ["INVITE_NOT_FOUND", "INVITE_NOT_PENDING"]) {
      expect(JOURNEY_EXITS[1].answers(code), code).toBe(true);
      expect(JOURNEY_EXITS[2].answers(code), code).toBe(true);
    }
    // 그리고 넷의 합집합이 일곱을 정확히 덮는다(빈틈도, 남는 출구도 없다).
    const covered = new Set([...answeredBy(0), ...answeredBy(1), ...answeredBy(2), ...Object.keys(excludedWithReason)]);
    expect([...covered].sort()).toEqual(swept);
  });

  it("ⓑ 유령 금지 — 제외의 코드를 서버가 실제로 던지고, 어느 출구도 답하지 않는다", () => {
    const swept = sweptCodes();
    for (const [code, reason] of Object.entries(excludedWithReason)) {
      expect(swept.has(code), `${code}는 서버가 더는 던지지 않는다 — 제외 이유가 남을 수 없다`).toBe(true);
      expect(reason.length, code).toBeGreaterThan(20);
      // 라운드 77 A의 규율: "그 화면이 자기 문구를 쓴다"는 제외의 근거가 될 수 없다.
      expect(reason, `${code}의 제외 사유가 "자기 문구"에 기대고 있다`).not.toContain("자기 문구");
      // 제외인데 출구가 답하고 있으면 그 제외는 이미 낡았다.
      for (const exit of JOURNEY_EXITS) {
        expect(exit.answers(code), `${code}는 제외됐는데 ${exit.name}이 답한다`).toBe(false);
      }
    }
  });

  it("ⓑ 유령 금지 — 목록의 두 파일이 실재하고, 던지는 예외가 전부 4xx다", () => {
    for (const file of FAMILY_JOURNEY_SERVER_FILES) {
      expect(statSync(join(apiSourceRoot, file)).isFile(), file).toBe(true);
    }
    const runtime = apiSource("households/household-runtime.service.ts");
    const thrownClasses = [...new Set([...runtime.matchAll(/throw new ([A-Za-z]+Exception)\(/g)].map((m) => m[1]))].sort();
    // 5xx가 섞이면 "4xx 전수"라는 이 스윕의 단위가 조용히 달라진다.
    expect(thrownClasses).toEqual([
      "BadRequestException",
      "ConflictException",
      "ForbiddenException",
      "NotFoundException"
    ]);

    // 관문은 오늘 자기 코드를 던지지 않고 서비스에 위임한다 — 그 사실을 값으로 적는다.
    // (이 줄이 빨개지는 날은 관문이 스스로 거절하기 시작한 날이고, 위 ⓐ가 그 코드의 출구를 묻는다.)
    const controller = apiSource("households/households.controller.ts");
    expect(thrownCodesIn("households/households.controller.ts")).toHaveLength(0);
    expect(controller).toContain('import { HouseholdRuntimeService } from "./household-runtime.service";');
    // 앱이 부르는 일곱 엔드포인트가 이 관문에 있다(스캔이 엉뚱한 파일을 걷고 있지 않다).
    for (const route of [
      '@Get("households/:householdId/members")',
      '@Delete("households/:householdId/members/:memberId")',
      '@Post("households/:householdId/invites")',
      '@Get("households/:householdId/invites")',
      '@Delete("households/:householdId/invites/:inviteId")',
      '@Get("invites/:token")',
      '@Post("invites/:token/accept")'
    ]) {
      expect(controller, route).toContain(route);
    }
  });

  /**
   * ⓒ **판정 순서의 파생 단언 — 넷 중 첫째**(`resolveSaveErrorCopy`).
   *
   * 나머지 셋은 각 모듈의 테스트 파일이 진다(member-mutation-messages.test.ts ·
   * invite-permissions.test.ts · invite-accept-messages.test.ts). 넷이 **다른 순서**라는 사실
   * 자체가 이 트랙의 판정이므로, 순서를 한 파일에 모으지 않고 각자의 자리에 세운다.
   */
  it("ⓒ 모듈 ① resolveSaveErrorCopy의 순서는 표 → 오프라인 → 폴백이다", () => {
    const tableCode = "HOUSEHOLD_ALREADY_MEMBER";
    // ① 표가 오프라인보다 앞이다 — 서버가 답했다는 사실이 곧 연결이 있었다는 뜻이다.
    expect(resolveSaveErrorCopy({ isOnline: false, error: journeyError(tableCode) })).toBe(
      API_ERROR_MESSAGES[tableCode]
    );
    // ② 표가 모르면 오프라인이 폴백보다 앞이다.
    expect(resolveSaveErrorCopy({ isOnline: false, error: new Error("Network request failed") })).toBe(
      OFFLINE_SAVE_NOTICE
    );
    // ③ 둘 다 아니면 폴백.
    expect(resolveSaveErrorCopy({ isOnline: true, error: new Error("boom") })).toBe(SAVE_ERROR_NOTICE);
    // ⚠️ **403 전용 갈래가 없는 것**이 이 모듈과 형제 셋의 차이다 — 같은 코드를 받는 다른 화면들이
    //    이 문장을 함께 쓰므로 여기서 초대·구성원 관리 쪽으로 좁힐 수 없다.
    expect(resolveSaveErrorCopy({ isOnline: true, error: journeyError("FORBIDDEN") })).toBe(
      API_ERROR_MESSAGES.FORBIDDEN
    );
    expect(API_ERROR_MESSAGES.FORBIDDEN).not.toBe(MEMBER_MANAGE_FORBIDDEN_MESSAGE);
    expect(API_ERROR_MESSAGES.FORBIDDEN).not.toBe(INVITE_FORBIDDEN_MESSAGE);
  });

  /**
   * ⓒ **네 모듈이 같은 표를 읽지 않는다는 사실은 코드 추출 층에서 이미 참이다.**
   *
   * 같은 실패 값을 넷에 먹여 답이 갈리는 것을 값으로 고정한다 — 넷을 한 벌로 합치려는 다음
   * 라운드는 여기서 먼저 이 사실을 만난다.
   */
  it("ⓒ 코드 추출이 넷 다 다르다 — 옛 봉투 JSON에서 답이 갈린다", () => {
    const legacyEnvelope = new Error(JSON.stringify(envelope("FORBIDDEN", "가족 초대는 관리자만 할 수 있어요.")));
    // 공용 파서는 옛 모양을 읽지 않는다(ApiHttpError·body·code 셋만 본다).
    expect(apiErrorCodeOf(legacyEnvelope)).toBeNull();
    expect(hasApiErrorCode(legacyEnvelope, "FORBIDDEN")).toBe(false);
    // 구성원 관리는 그 폴백을 갖고 있다(옛 관례로 던져진 값도 같은 판정을 받는다).
    expect(familyErrorCodeOf(legacyEnvelope)).toBe("FORBIDDEN");
    // 초대 생성은 봉투 JSON을 직접 판다(그래서 두 모양 다 알아본다).
    expect(inviteCreateErrorMessage(legacyEnvelope, { isOnline: true })).toBe(INVITE_FORBIDDEN_MESSAGE);
    expect(inviteCreateErrorMessage(new ApiHttpError(403, envelope("FORBIDDEN", "…")), { isOnline: true })).toBe(
      INVITE_FORBIDDEN_MESSAGE
    );
  });

  /**
   * ⓓ **관측을 값으로** — 라운드 78 S-1이 열어 둔 질문(*"코드 하나가 문장 여럿을 나르면 코드
   * 단위 표는 어떻게 하나"*)에 **이 여정이 이미 답을 갖고 있었다**: 답은 *"코드를 나누는 것"*이
   * 아니라 **"부르는 자리가 가르는 것"**이다.
   */
  it("ⓓ 관측 — 이 여정에서 문장을 둘 나르는 코드가 셋이고, 앱은 호출부로 가른다", () => {
    const messagesByCode = journeyMessagesByCode();
    const multiMessageCodes = [...messagesByCode]
      .filter(([, messages]) => messages.size > 1)
      .map(([code]) => code)
      .sort();
    // 2026-08-30 실측: 정찰은 `INVITE_NOT_PENDING` 하나를 적었는데 스윕은 셋을 센다
    // (`INVITE_NOT_FOUND`도 조회·취소 두 자리에서 다른 원문을 쓴다 — 스윕 쪽이 옳다).
    expect(multiMessageCodes).toEqual(["FORBIDDEN", "INVITE_NOT_FOUND", "INVITE_NOT_PENDING"]);
    expect(messagesByCode.get("FORBIDDEN")?.size).toBe(2);
    expect(messagesByCode.get("INVITE_NOT_PENDING")?.size).toBe(2);

    // ⚠️ **FORBIDDEN 하나가 앱에서 세 갈래로 갈린다 — 가르는 축은 코드가 아니라 호출부다.**
    const forbidden = journeyError("FORBIDDEN");
    expect(inviteCreateErrorMessage(forbidden, { isOnline: true })).toBe(INVITE_FORBIDDEN_MESSAGE);
    expect(memberMutationErrorMessage("remove_member", forbidden, { isOnline: true })).toBe(
      MEMBER_MANAGE_FORBIDDEN_MESSAGE
    );
    expect(resolveSaveErrorCopy({ isOnline: true, error: forbidden })).toBe(API_ERROR_MESSAGES.FORBIDDEN);
    expect(new Set([INVITE_FORBIDDEN_MESSAGE, MEMBER_MANAGE_FORBIDDEN_MESSAGE, API_ERROR_MESSAGES.FORBIDDEN]).size).toBe(3);

    // 반대 방향의 답도 이 여정에 있다: 초대 수락은 문장 둘을 나르는 두 코드를 **일부러 하나로**
    // 받는다(무인증 공개 조회라 가르는 순간 존재 오라클이 된다 — invite-accept-messages.ts).
    for (const code of INVITE_UNAVAILABLE_CODES) {
      expect(messagesByCode.get(code)?.size, code).toBe(2);
      expect(isInviteUnavailableError(journeyError(code)), code).toBe(true);
    }
  });

  /**
   * ⓓ **관측을 값으로** — `HOUSEHOLD_NOT_FOUND`의 소비자는 저장소 전체에서 **0건**이다.
   *
   * 제외 사유가 기대는 사실이 그것이라, 사유 옆에 산문으로 적는 대신 **세어서** 고정한다.
   * 소비자가 하나라도 생기는 날 이 줄이 빨개지고, 그때 그 제외 사유를 다시 봐야 한다.
   */
  it("ⓓ 관측 — HOUSEHOLD_NOT_FOUND를 읽는 앱 코드가 0건이다 (제외 사유의 근거)", () => {
    const scanRoots = [
      join(mobileRoot, "src"),
      join(mobileRoot, "app"),
      join(mobileRoot, "../../apps/admin/src"),
      join(mobileRoot, "../../apps/admin/app"),
      join(mobileRoot, "../../packages")
    ];
    /**
     * ⚠️ **테스트 파일은 소비자가 아니다.** 이 트랙의 계약 넷이 그 코드를 이름으로 들고 있고
     * (스윕의 제외 목록 · 세 모듈의 판정 단언), 계약이 코드를 부르는 것과 **제품 소스가 그
     * 코드를 읽어 문구를 고르는 것**은 다른 사건이다. 세는 것은 뒤엣것이다.
     */
    const consumers: string[] = [];
    let scannedFiles = 0;
    const walk = (directory: string) => {
      for (const name of readdirSync(directory)) {
        if (name === "node_modules" || name === "dist" || name.startsWith(".")) continue;
        const fullPath = join(directory, name);
        if (statSync(fullPath).isDirectory()) {
          walk(fullPath);
          continue;
        }
        if (!/\.tsx?$/.test(name) || /\.test\.tsx?$/.test(name)) continue;
        scannedFiles += 1;
        if (readFileSync(fullPath, "utf8").includes("HOUSEHOLD_NOT_FOUND")) consumers.push(fullPath);
      }
    };
    for (const root of scanRoots) walk(root);

    // 스캔이 조용히 0건이 되면 이 관측도 함께 죽는다(2026-08-30 실측: 제품 소스 326).
    expect(scannedFiles).toBeGreaterThan(300);
    expect(consumers, "HOUSEHOLD_NOT_FOUND에 소비자가 생겼다 — 제외 사유를 다시 봐야 한다").toEqual([]);
    // 그리고 서버는 그 코드를 여전히 던진다(제외가 유령이 아니라는 반대 방향의 확인).
    expect([...sweptCodes()]).toContain("HOUSEHOLD_NOT_FOUND");
  });
});
