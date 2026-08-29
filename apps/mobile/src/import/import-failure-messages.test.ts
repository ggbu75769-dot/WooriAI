import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  importFailureMessage,
  isNamedImportFailure,
  IMPORT_CONFIRM_FAILED_MESSAGE,
  IMPORT_FAILURE_KINDS,
  IMPORT_FAILURE_MESSAGE_BY_CODE,
  IMPORT_FORBIDDEN_MESSAGE,
  IMPORT_ROW_EDIT_FAILED_MESSAGE,
  IMPORT_UNDO_FAILED_MESSAGE,
  IMPORT_UPLOAD_FAILED_MESSAGE,
  type ImportFailureKind
} from "./import-failure-messages";
import { ApiHttpError, API_ERROR_MESSAGES } from "../api/api-error";
import { OFFLINE_RETRY_NOTICE } from "../offline/messages";

/**
 * 라운드 71 트랙 A — **가져오기 여정의 실패가 이름을 얻는다**는 계약.
 *
 * 세 층으로 나눠 고정한다.
 *  1. 순수 단위 — 회귀 여섯 좌표(업로드 400 파일 오류 · 행 편집 NOT_EDITABLE · 확정
 *     NOT_CONFIRMABLE · 되돌리기 NOT_UNDOABLE · 403 보기 전용 · 오프라인)와 부정 단언.
 *  2. **여정 스윕 소스 계약** — import 서버 파일 둘을 실제로 읽어 `code: "…"`를 전부 긁고,
 *     각 코드가 이 트랙의 표에 있거나 **이유가 적힌 제외 목록**에 있는지 묻는다
 *     (api-error.test.ts가 아웃박스 파일 넷에 대해 하는 그 스윕의 형제).
 *  3. 배선 계약 — 화면은 vitest에서 렌더할 수 없으므로 이 저장소의 관례대로 소스 grep이다.
 */

const mobileRoot = process.cwd();
const source = (relativePath: string) => readFileSync(join(mobileRoot, relativePath), "utf8");
const apiSource = (relativePath: string) => readFileSync(join(mobileRoot, "../../apps/api/src", relativePath), "utf8");

/** 서버(GlobalExceptionFilter)가 실제로 내려보내는 모양. */
const envelope = (code: string, message: string) => ({ error: { code, message, requestId: "req-1" } });
const serverError = (status: number, code: string, message: string) => new ApiHttpError(status, envelope(code, message));

const uploadScreen = () => source("app/import/index.tsx");
const reviewScreen = () => source("app/import/[importJobId].tsx");

/** 이 여정을 만드는 서버 파일 **둘**. 스윕의 단위는 파일이 아니라 여정이다. */
const IMPORT_JOURNEY_SERVER_FILES = ["imports/import-parser.ts", "onboarding/import-pipeline.service.ts"] as const;

/**
 * 라운드 71 리뷰 M-2 — **`code:` 뒤에 오는 것이 문자열 리터럴만은 아니다.**
 *
 * 종전 정규식은 `code: "…"` 한 형태만 봤는데, 서버는 코드를 **상수 식별자**로 넘기기도 한다
 * (`throw new BadRequestException({ code: IMPORT_FILE_TOO_LARGE_CODE, … })` — 10MB 상한).
 * 그래서 이 여정에서 가장 흔한 업로드 실패 중 하나가 스윕에 **한 번도 잡히지 않았고**, 계약은
 * "코드 아홉이 전부 답을 갖는다"고 말하면서 열째를 못 본 채였다.
 *
 * 이제 두 형태를 다 받는다. 식별자는 정의를 찾아 값으로 바꾼다 — 같은 파일의 `const X_CODE = "…"`가
 * 먼저이고, 없으면 서버 소스 전역의 `export const X_CODE = "…"`를 본다(이 저장소의 그 상수는
 * common/filters/global-exception.filter.ts에 살고 import돼 쓰인다).
 *
 * ⚠ 해석하지 못한 식별자는 **조용히 버리지 않는다**(`UNRESOLVED:` 표식으로 남긴다). 못 읽은 코드를
 * 없는 코드로 세는 것이 바로 이 스윕이 막으려는 병이다.
 *
 * 대문자만 받는 것은 종전과 같다 — import-parser.ts의 분류 코드(`code: "diaper_hygiene"` 등)는
 * 여전히 걸리지 않는다.
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

describe("importFailureMessage — 회귀 여섯 좌표", () => {
  it("① 업로드 400 파일 오류: 서버가 한 코드로 말하는 네 갈래를 단정하지 않고 함께 덮는다", () => {
    // 서버 원문 넷이 전부 이 코드다(아래 스윕 계약이 그 사실을 서버 파일에서 다시 확인한다).
    for (const serverMessage of [
      "가져올 데이터를 찾을 수 없어요.",
      "엑셀 파일을 읽을 수 없어요.",
      "엑셀 파일에 시트가 없어요.",
      "가져오기 파일을 읽을 수 없어요."
    ]) {
      const message = importFailureMessage("upload", serverError(400, "IMPORT_FILE_INVALID", serverMessage), {
        isOnline: true
      });
      expect(message).toBe(IMPORT_FAILURE_MESSAGE_BY_CODE.IMPORT_FILE_INVALID);
      // 서버 원문은 어떤 경로로도 화면에 나가지 않는다.
      expect(message).not.toContain(serverMessage);
      // 사용자가 실제로 고칠 수 있는 유일한 실패라, 재시도가 아니라 확인할 것을 말한다.
      expect(message).not.toContain("잠시 후 다시");
      expect(message).toContain("확인해 주세요.");
    }
  });

  it("② 행 편집 IMPORT_NOT_EDITABLE: 끝난 미리보기라는 사실 + 왜 끝났는지 + 다음 할 일", () => {
    const message = importFailureMessage(
      "row_edit",
      serverError(400, "IMPORT_NOT_EDITABLE", "Import preview can no longer be edited."),
      { isOnline: true }
    );
    expect(message).toBe(IMPORT_FAILURE_MESSAGE_BY_CODE.IMPORT_NOT_EDITABLE);
    // 가장 도달하기 쉬운 갈래 — 30분치 검수가 어디로 갔는지를 말한다.
    expect(message).toContain("새로 올리면");
    expect(message).toContain("파일을 다시 올려 주세요.");
    // 다시 눌러도 같은 답이다.
    expect(message).not.toContain("잠시 후 다시");
    expect(message).not.toContain("다시 시도");
  });

  it("③ 확정 IMPORT_NOT_CONFIRMABLE: 검수 내용이 남지 않는다는 사실을 감추지 않는다", () => {
    const message = importFailureMessage(
      "confirm",
      serverError(400, "IMPORT_NOT_CONFIRMABLE", "Import job is not ready to confirm."),
      { isOnline: true }
    );
    expect(message).toBe(IMPORT_FAILURE_MESSAGE_BY_CODE.IMPORT_NOT_CONFIRMABLE);
    expect(message).toContain("남지 않으니");
    expect(message).toContain("파일을 다시 올려 주세요.");
    expect(message).not.toContain("다시 시도");
  });

  it("④ 되돌리기 IMPORT_NOT_UNDOABLE: 서버의 해요체 원문을 그대로 쓰고 이유를 단정하지 않는다", () => {
    const message = importFailureMessage(
      "undo",
      serverError(400, "IMPORT_NOT_UNDOABLE", "되돌릴 수 있는 가져오기가 아니에요."),
      { isOnline: true }
    );
    expect(message).toBe(IMPORT_FAILURE_MESSAGE_BY_CODE.IMPORT_NOT_UNDOABLE);
    // 같은 실패가 표면마다 다르게 들리지 않게, 서버가 이미 해요체로 말한 문장을 그대로 연다.
    expect(message.startsWith("되돌릴 수 있는 가져오기가 아니에요.")).toBe(true);
    expect(message).toContain("일 수 있어요.");
    expect(message).not.toContain("다시 시도");
  });

  it("⑤ 403은 네 걸음 어디서 와도 보기 전용 사실을 말한다 (앱 전역 표의 중립 문구를 쓰지 않는다)", () => {
    for (const kind of IMPORT_FAILURE_KINDS) {
      const message = importFailureMessage(kind, serverError(403, "FORBIDDEN", "아이 프로필 접근 권한이 없어요."), {
        isOnline: true
      });
      expect(message, kind).toBe(IMPORT_FORBIDDEN_MESSAGE);
      // 앱 전역 표의 문구("권한이 없어 처리하지 못했어요…")는 이 여정에서 쓰지 않는다.
      expect(message, kind).not.toBe(API_ERROR_MESSAGES.FORBIDDEN);
      expect(message, kind).not.toContain("다시 시도");
    }
  });

  it("⑥ 오프라인: 코드 없는 실패에만 서고, 서버가 답을 준 실패는 여전히 그 사유를 말한다", () => {
    const networkError = new Error("Network request failed");
    for (const kind of IMPORT_FAILURE_KINDS) {
      expect(importFailureMessage(kind, networkError, { isOnline: false }), kind).toBe(OFFLINE_RETRY_NOTICE);
    }
    // 서버가 코드를 줬다는 사실 자체가 연결이 있었다는 뜻이다 — 그 경우까지 오프라인으로
    // 말하면 그것이 또 하나의 틀린 안내다(판정 순서 계약).
    const named = serverError(400, "IMPORT_NOT_EDITABLE", "Import preview can no longer be edited.");
    expect(importFailureMessage("row_edit", named, { isOnline: false })).toBe(
      IMPORT_FAILURE_MESSAGE_BY_CODE.IMPORT_NOT_EDITABLE
    );
    expect(importFailureMessage("upload", serverError(403, "FORBIDDEN", "x"), { isOnline: false })).toBe(
      IMPORT_FORBIDDEN_MESSAGE
    );
  });
});

describe("모르는 실패 · 네트워크 실패는 종전과 바이트 단위로 같다", () => {
  const unknownFailures: readonly unknown[] = [
    new Error("Network request failed"),
    new Error("boom"),
    serverError(500, "INTERNAL_ERROR", "Something went wrong."),
    // 봉투가 아닌 응답(프록시 HTML 등) — 코드가 없다.
    new ApiHttpError(502, { message: "bad gateway" }),
    null,
    undefined
  ];

  it("업로드·되돌리기의 폴백은 라운드 45·67이 쓴 그 문자열 그대로다", () => {
    expect(IMPORT_UPLOAD_FAILED_MESSAGE).toBe("업로드하지 못했어요. 잠시 후 다시 시도해 주세요.");
    expect(IMPORT_UNDO_FAILED_MESSAGE).toBe("되돌리지 못했어요. 잠시 후 다시 시도해 주세요.");
    for (const error of unknownFailures) {
      expect(importFailureMessage("upload", error, { isOnline: true })).toBe(IMPORT_UPLOAD_FAILED_MESSAGE);
      expect(importFailureMessage("undo", error, { isOnline: true })).toBe(IMPORT_UNDO_FAILED_MESSAGE);
    }
  });

  /**
   * 행 편집·확정만 예외다 — 그 두 자리의 종전 문장이 **조회 실패의 것**이었기 때문이다.
   * 동사를 고치는 것이 이 트랙의 ⓑ이고, 그 자리를 바이트 단위로 유지하는 것은 곧 틀린 동사를
   * 유지하는 것이다. 바뀌는 것은 문장뿐이고 카드 구조·버튼은 그대로다.
   */
  it("행 편집·확정의 폴백은 동사가 고쳐진 값이고, 그 값이 조회 실패 문구가 아니다", () => {
    const loadFailedText = "불러오지 못했어요. 잠시 후 다시 시도해 주세요.";
    expect(IMPORT_ROW_EDIT_FAILED_MESSAGE).not.toBe(loadFailedText);
    expect(IMPORT_CONFIRM_FAILED_MESSAGE).not.toBe(loadFailedText);
    for (const error of unknownFailures) {
      expect(importFailureMessage("row_edit", error, { isOnline: true })).toBe(IMPORT_ROW_EDIT_FAILED_MESSAGE);
      expect(importFailureMessage("confirm", error, { isOnline: true })).toBe(IMPORT_CONFIRM_FAILED_MESSAGE);
    }
  });

  it("앱 전역 표가 이미 아는 코드는 그 표의 문구를 그대로 쓴다 (같은 실패를 두 문장이 말하지 않는다)", () => {
    // 라운드 45 UX-Z가 업로드 화면을 위해 세운 세 줄이 그대로 살아 있다.
    for (const code of ["IMPORT_TOO_MANY_ROWS", "IMPORT_FILE_TYPE_INVALID", "IMPORT_FILE_TOO_LARGE"]) {
      const message = importFailureMessage("upload", serverError(400, code, "Import files can include up to 2,000 rows."), {
        isOnline: true
      });
      expect(message, code).toBe(API_ERROR_MESSAGES[code]);
    }
    // 이 여정의 표는 그 셋을 다시 적지 않는다(두 벌이 되면 갈리는 순간을 아무도 모른다).
    for (const code of ["IMPORT_TOO_MANY_ROWS", "IMPORT_FILE_TYPE_INVALID", "IMPORT_FILE_TOO_LARGE"]) {
      expect(IMPORT_FAILURE_MESSAGE_BY_CODE[code], code).toBeUndefined();
    }
  });
});

describe("문구 규율 (DNC-018)", () => {
  const allMessages: readonly string[] = [
    ...Object.values(IMPORT_FAILURE_MESSAGE_BY_CODE),
    IMPORT_FORBIDDEN_MESSAGE,
    IMPORT_UPLOAD_FAILED_MESSAGE,
    IMPORT_ROW_EDIT_FAILED_MESSAGE,
    IMPORT_CONFIRM_FAILED_MESSAGE,
    IMPORT_UNDO_FAILED_MESSAGE
  ];

  it("전부 해요체로 끝난다", () => {
    for (const message of allMessages) {
      expect(message.endsWith("요."), message).toBe(true);
    }
  });

  it('저장·확정 실패에 "불러오지"가 등장하지 않는다 (동사 교정의 부정 단언)', () => {
    for (const message of allMessages) {
      expect(message, message).not.toContain("불러오지");
    }
    // 실제 판정을 지난 값에서도 마찬가지다 — 네 걸음 × (코드별 · 오프라인 · 모르는 실패).
    const errors: readonly unknown[] = [
      new Error("boom"),
      serverError(403, "FORBIDDEN", "x"),
      ...Object.keys(IMPORT_FAILURE_MESSAGE_BY_CODE).map((code) => serverError(400, code, "x"))
    ];
    for (const kind of ["row_edit", "confirm"] as ImportFailureKind[]) {
      for (const error of errors) {
        for (const isOnline of [true, false]) {
          expect(importFailureMessage(kind, error, { isOnline })).not.toContain("불러오지");
        }
      }
    }
  });

  it("끝난 잡·되돌릴 수 없는 잡의 문장은 재시도를 권하지 않고 다음 할 일을 말한다", () => {
    const permanent = ["IMPORT_NOT_EDITABLE", "IMPORT_NOT_CONFIRMABLE", "IMPORT_NOT_UNDOABLE", "IMPORT_JOB_NOT_FOUND"];
    for (const code of permanent) {
      const message = IMPORT_FAILURE_MESSAGE_BY_CODE[code];
      expect(message, code).toBeTruthy();
      for (const retryPhrase of ["잠시 후 다시", "다시 시도"]) {
        expect(message, `${code}는 "${retryPhrase}"를 쓰지 않는다`).not.toContain(retryPhrase);
      }
      // 사실 한 문장 + 다음에 할 일 한 문장(api-error.test.ts의 404 셋과 같은 형식).
      expect(message.split("요.").filter(Boolean).length, code).toBeGreaterThanOrEqual(2);
    }
  });

  it("isNamedImportFailure는 코드를 아는 실패에만 참이다", () => {
    expect(isNamedImportFailure(serverError(400, "IMPORT_NOT_EDITABLE", "x"))).toBe(true);
    expect(isNamedImportFailure(serverError(403, "FORBIDDEN", "x"))).toBe(true);
    expect(isNamedImportFailure(new Error("Network request failed"))).toBe(false);
    // 앱 전역 표만 아는 코드는 이 여정이 "이름을 준" 실패가 아니다(문구는 그 표에서 온다).
    expect(isNamedImportFailure(serverError(400, "IMPORT_TOO_MANY_ROWS", "x"))).toBe(false);
  });
});

/**
 * **여정 스윕 소스 계약** — 이 트랙의 진짜 산출물이다.
 *
 * `api-error.test.ts`의 교집합 계약이 훑는 서버 파일 넷은 전부 **아웃박스·상태 큐가 지나는**
 * 파일이라, 큐를 타지 않는 여정은 그 계약의 시야 밖이다(라운드 71 정찰의 구조적 발견).
 * 가져오기는 전부 즉시 요청이다. 그래서 이 여정이 자기 스윕을 갖는다: 서버 파일 둘을 읽어
 * `code: "…"`를 전부 긁고, 각 코드는 둘 중 하나여야 한다 — 문구를 갖거나, **이유가 적힌 제외
 * 목록**에 있거나. 서버에 코드를 새로 만들면 이 단언이 빨개지고, 만든 사람이 "이 코드는
 * 가져오기 화면에서 어떻게 보이는가"에 답해야 한다.
 */
describe("여정 스윕 소스 계약 (import 서버 파일 둘)", () => {
  /** 이 트랙의 표에 넣지 않는 코드와 그 이유. 비우면 안 된다 — 이유 없는 제외가 바로 그 병이었다. */
  const excludedWithReason: Readonly<Record<string, string>> = {
    IMPORT_TOO_MANY_ROWS:
      "라운드 45 UX-Z가 업로드 화면을 위해 src/api/api-error.ts의 표에 이미 세워 둔 줄이다(2,000행 상한). 이 모듈은 그 표를 한 번 지나므로 문구가 도달하고, 여기 다시 적으면 같은 실패를 두 문장이 각자 말하게 된다.",
    IMPORT_FILE_TYPE_INVALID:
      "같은 이유로 앱 전역 표에 이미 있다(csv·xlsx만 허용). 업로드 전에 src/import-file-validation.ts가 대개 먼저 거르고, 서버까지 간 경우의 문구는 그 표에서 온다.",
    // 라운드 71 리뷰 M-2: 상수 식별자(`code: IMPORT_FILE_TOO_LARGE_CODE`)로 던져지던 열째 코드.
    // 종전 스윕은 문자열 리터럴만 봐서 이 자리를 아예 세지 않았다.
    IMPORT_FILE_TOO_LARGE:
      "10MB 상한이고, 앱 전역 표(src/api/api-error.ts)에 이미 문구가 있다. 서버가 이 코드를 상수 식별자로 던지는 유일한 자리라(global-exception.filter.ts의 IMPORT_FILE_TOO_LARGE_CODE) 스윕이 식별자를 해석하게 된 뒤에야 보였다."
  };

  it("두 서버 파일의 코드는 이 트랙의 표에 있거나, 이유가 적힌 제외 목록에 있다", () => {
    const swept = new Set(IMPORT_JOURNEY_SERVER_FILES.flatMap((file) => thrownCodesIn(file)));
    // 스윕이 실제로 무언가를 읽었는지부터 확인한다(정규식이 조용히 0건이 되면 계약이 사라진다).
    // 라운드 71 리뷰 M-2: 식별자 형태를 해석하면서 아홉에서 **열**이 됐다.
    expect(swept.size).toBeGreaterThanOrEqual(10);
    // 그리고 못 읽은 식별자가 하나도 없어야 한다 — 해석 실패를 "코드 없음"으로 세지 않는다.
    expect([...swept].filter((code) => code.startsWith("UNRESOLVED:"))).toEqual([]);

    for (const code of swept) {
      const known = Object.prototype.hasOwnProperty.call(IMPORT_FAILURE_MESSAGE_BY_CODE, code);
      const excluded = Object.prototype.hasOwnProperty.call(excludedWithReason, code);
      expect(
        known || excluded,
        `${code}: 이 여정의 표에 없고 제외 이유도 없다. 이 코드를 받은 사용자는 "${IMPORT_ROW_EDIT_FAILED_MESSAGE}" 계열의 일반 문구만 보게 된다.`
      ).toBe(true);
    }
  });

  it("제외 목록은 유령을 들고 있지 않다 — 서버가 실제로 던지고, 앱 전역 표가 실제로 답한다", () => {
    const swept = new Set(IMPORT_JOURNEY_SERVER_FILES.flatMap((file) => thrownCodesIn(file)));
    for (const [code, reason] of Object.entries(excludedWithReason)) {
      expect(swept.has(code), `${code}는 서버가 더는 던지지 않는다 — 제외 이유가 남을 수 없다`).toBe(true);
      expect(reason.length, code).toBeGreaterThan(20);
      expect(API_ERROR_MESSAGES[code], `${code}는 앱 전역 표가 답한다는 전제로 제외됐다`).toBeTruthy();
    }
  });

  it("표의 코드는 실제 서버 파일이 던지는 코드다 (반대 방향 — 유령 줄 금지)", () => {
    const origins: Readonly<Record<string, string>> = {
      IMPORT_FILE_INVALID: "onboarding/import-pipeline.service.ts",
      IMPORT_FILE_REQUIRED: "onboarding/import-pipeline.service.ts",
      IMPORT_NOT_EDITABLE: "onboarding/import-pipeline.service.ts",
      IMPORT_ROW_NOT_FOUND: "onboarding/import-pipeline.service.ts",
      IMPORT_NOT_CONFIRMABLE: "onboarding/import-pipeline.service.ts",
      IMPORT_NOT_UNDOABLE: "onboarding/import-pipeline.service.ts",
      IMPORT_JOB_NOT_FOUND: "onboarding/import-pipeline.service.ts"
    };
    expect(Object.keys(origins).sort()).toEqual(Object.keys(IMPORT_FAILURE_MESSAGE_BY_CODE).sort());
    for (const [code, file] of Object.entries(origins)) {
      expect(thrownCodesIn(file), `${code} ← ${file}`).toContain(code);
    }
    // 파일 오류는 파서 쪽에서도 온다(같은 코드, 다른 원문 셋).
    expect(thrownCodesIn("imports/import-parser.ts")).toContain("IMPORT_FILE_INVALID");
    // 403은 이 둘이 아니라 접근 판정이 던진다 — 그래서 표가 아니라 전용 상수로 선다.
    expect(apiSource("onboarding/child-access.service.ts")).toContain('code: "FORBIDDEN"');
  });

  it("⚠️ 서버 0건 — 영문 원문을 서버에서 한국어로 바꾸지 않았다(문구는 앱이 책임진다)", () => {
    const pipeline = apiSource("onboarding/import-pipeline.service.ts");
    expect(pipeline).toContain('message: "Import preview can no longer be edited."');
    expect(pipeline).toContain('message: "Import job is not ready to confirm."');
    expect(pipeline).toContain('message: "Import job was not found."');
    expect(pipeline).toContain('message: "Import preview row was not found."');
    // 서버가 이미 한국어로 말하던 자리도 그대로다.
    expect(pipeline).toContain('message: "되돌릴 수 있는 가져오기가 아니에요."');
    expect(apiSource("imports/import-parser.ts")).toContain('message: "엑셀 파일에 시트가 없어요."');
  });
});

describe("배선 계약 (source verification)", () => {
  it("업로드 화면이 여정 모듈을 지나고, 실패 텍스트 노드는 하나 그대로다", () => {
    const src = uploadScreen();
    expect(src).toContain('import { importFailureMessage } from "../../src/import/import-failure-messages";');
    expect(src).toContain('import { isCurrentlyOnline } from "../../src/offline/connectivity";');
    expect(src).toContain('{importFailureMessage("upload", upload.error, { isOnline: uploadFailureOnline })}');
    expect(src).toContain(
      'Alert.alert(IMPORT_UNDO_CARD_TITLE, importFailureMessage("undo", error, { isOnline }));'
    );
    // 종전의 무조건 재시도 안내(문구 하드코딩)는 남아 있으면 안 된다.
    expect(src).not.toContain(">업로드하지 못했어요. 잠시 후 다시 시도해 주세요.</Text>");
    expect(src).not.toContain('"되돌리지 못했어요. 잠시 후 다시 시도해 주세요."');
    // 연결 판정은 실패 시점 폴 한 번이고, 매 시도에서 다시 무장한다.
    expect(src).toContain("void isCurrentlyOnline().then(setUploadFailureOnline);");
    expect(src).toContain("setUploadFailureOnline(true);");
  });

  it("⚠️ IMP-003 픽셀락 — 업로드 화면의 렌더가 바뀐 곳은 실패 상태의 텍스트 노드뿐이다", () => {
    const src = uploadScreen();
    // 캡처 경로(비로그인)를 가르는 두 값과 목업·CTA·안내 줄은 한 글자도 바뀌지 않았다.
    expect(src).toContain("const showPreviewMockup = !canUpload;");
    expect(src).toContain('<Text style={styles.previewTitle}>AI 분류 미리보기</Text>');
    expect(src).toContain('<Text style={styles.previewSummaryLabel}>총 128건</Text>');
    expect(src).toContain('<Text style={styles.previewSummaryAmount}>₩1,245,700</Text>');
    expect(src).toContain("<Text style={styles.previewNotice}>검수 후 승인하기 전까지는 지출로 저장되지 않아요.</Text>");
    expect(src).toContain('{upload.isPending ? "분석 중..." : canUpload ? "엑셀 파일 선택하기" : "적용하고 리포트 보기"}');
    // 실패 문구는 여전히 `upload.error`가 있을 때만 서는 텍스트 노드 하나다(캡처에는 없다).
    expect(src).toContain("{upload.error ? (");
  });

  it("되돌리기의 성공 경로·건수 문장은 무변경이다 (라운드 67 #3)", () => {
    const src = uploadScreen();
    expect(src).toContain("Alert.alert(IMPORT_UNDO_CARD_TITLE, importUndoResultMessage(result.deletedCount));");
    expect(src).toContain("forgetImportReview(jobId);");
    expect(src).toContain("Alert.alert(IMPORT_UNDO_CONFIRM_TITLE, importUndoConfirmMessage(entry.importedCount), [");
  });

  it("검수 화면의 저장·확정 실패가 여정 모듈을 지난다 (조회 실패 둘은 종전 문구 그대로)", () => {
    const src = reviewScreen();
    expect(src).toContain('import { importFailureMessage } from "../../src/import/import-failure-messages";');
    expect(src).toContain('import { isCurrentlyOnline } from "../../src/offline/connectivity";');
    // 라운드 71 리뷰 S-6: 행 편집의 연결 판정은 뮤테이션별 상태 둘이고(체크·분류), 문장을 고를
    // 때 오류와 그 판정을 **한 짝으로** 집는다 — 한쪽의 판정이 다른 쪽 문장에 얹히지 않는다.
    expect(src).toContain(
      '{importFailureMessage("row_edit", rowEditFailure.error, { isOnline: rowEditFailure.isOnline })}'
    );
    expect(src).toContain("const [toggleFailureOnline, setToggleFailureOnline] = useState(true);");
    expect(src).toContain("const [categoryFailureOnline, setCategoryFailureOnline] = useState(true);");
    expect(src).toContain("void isCurrentlyOnline().then(setToggleFailureOnline);");
    expect(src).toContain("void isCurrentlyOnline().then(setCategoryFailureOnline);");
    // 공용 상태 한 벌이던 종전 배선은 남아 있으면 안 된다.
    expect(src).not.toContain("rowEditFailureOnline");
    expect(src).toContain('{importFailureMessage("confirm", confirm.error, { isOnline: confirmFailureOnline })}');
    // 종전에는 이 한 문자열이 **네 자리**에 섰다. 이제 조회 실패 둘뿐이다.
    const loadFailedUses = src.match(/\{loadFailedText\}/g) ?? [];
    expect(loadFailedUses).toHaveLength(2);
    expect(src).toContain("<SecondaryButton label=\"다시 시도\" onPress={() => job.refetch()} />");
    expect(src).toContain("<SecondaryButton label=\"다시 시도\" onPress={() => rows.refetch()} />");
    // 저장·확정 자리에서 조회 문구를 돌려 쓰던 종전 배선은 남아 있으면 안 된다.
    expect(src).not.toContain("{toggleRow.isError || updateCategory.isError ? (\n        <Text style={{ color: theme.colors.danger }}>{loadFailedText}</Text>");
    expect(src).not.toContain("{confirm.isError ? <Text style={{ color: theme.colors.danger }}>{loadFailedText}</Text> : null}");
  });

  it("행 낙관 토글의 롤백·확정 CAS 잠금 규칙은 한 줄도 바뀌지 않았다", () => {
    const src = reviewScreen();
    // 라운드 41 K-6/42 L-2가 세운 자리들 — 이 트랙이 만지는 것은 실패 뒤에 서는 문장뿐이다.
    expect(src).toContain("rows: rollbackImportRowSelection(current.rows, row.id, snapshot.rows) as ImportRow[]");
    expect(src).toContain("const canConfirm = canConfirmImport({");
    expect(src).toContain("onPress={expenseGate.guard(() => confirm.mutate())}");
    expect(src).toContain("disabled={!canConfirm}");
    // 일괄 부분 실패·중단은 여전히 자기 문구를 쓴다(K-10).
    expect(src).toContain("IMPORT_BULK_PARTIAL_FAILURE_TEXT");
    expect(src).toContain("IMPORT_BULK_CANCELLED_TEXT");
  });

  it("오프라인 인지 화면 목록(P3 소유)은 무접촉이다", () => {
    const screens = source("src/offline/offline-aware-screens.ts");
    // 이 트랙은 목록을 넓히지 않는다 — 검수 화면의 조회 실패 둘은 그 목록을 여는 라운드의 몫이다.
    expect(screens).not.toContain("app/import/[importJobId].tsx");
    expect(reviewScreen()).not.toContain("useLoadErrorCopy");
  });
});
