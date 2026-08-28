/**
 * 라운드 45 UX-Z — 서버가 이미 말해 준 실패 사유를 경계에서 뭉개지 않기 위한 단일 소스.
 *
 * 지금까지 이 앱의 HTTP 경계는 실패를 **한 덩어리**로 접었다. `src/api/client.ts`의 requestJson은
 * 모든 비-2xx를 `new Error(JSON.stringify(data))`로 던졌고, 그 값을 받는 화면들은 상태코드도 코드도
 * 볼 수 없으니 "잠시 후 다시 시도해 주세요."라는 한 문장만 붙였다. 그런데 서버는 이미 코드별로
 * **완성된 한국어**를 내려보내고 있다(apps/api의 GlobalExceptionFilter가 모든 실패를
 * `{ error: { code, message, requestId } }` 봉투로 고정한다).
 *
 * 그래서 사용자는 다시 눌러도 절대 성공하지 않는 실패 앞에서 "잠시 후 다시"라는 **틀린 안내**를
 * 받았다. 2,000행이 넘는 파일을 올린 사람, 미래 날짜를 적은 사람, 탈퇴한 계정으로 로그인한
 * 사람에게 재시도를 권하는 것은 안내가 아니라 시간 낭비다(DNC-018: 사용자를 탓하지 않되,
 * **다음에 무엇을 하면 되는지**를 말한다).
 *
 * ## 이 모듈이 고정하는 두 가지
 *
 * 1. **파서** — 봉투에서 `code`/`message`를 꺼낸다. 봉투 모양이 아니면 `null`을 돌려주고
 *    호출부는 기존 폴백 문구를 그대로 쓴다(모양이 바뀌어도 조용히 예전처럼 동작한다).
 *
 * 2. **화이트리스트 표** — 서버 원문을 **무조건 그대로 노출하지 않는다.** 아는 코드만 이 표의
 *    문구를 쓰고, 모르는 코드는 호출부의 일반 문구로 폴백한다. 이유는 셋이다.
 *    - 서버 문구 중 일부는 아직 영어다(IMPORT_TOO_MANY_ROWS: "Import files can include up to
 *      2,000 rows."). 그대로 띄우면 한국어 앱 한가운데 영어 문장이 뜬다.
 *    - 서버 문구는 언제든 바뀔 수 있고, 그 변경이 앱의 톤 계약(해요체)을 통과했는지 앱은 알 수
 *      없다. 코드는 계약이고 문구는 계약이 아니다.
 *    - 내부 사정을 드러내는 문장이 사용자 화면으로 새는 경로를 원천적으로 막는다.
 *
 * ## Error.message를 왜 예전 그대로(JSON 원문) 두는가
 *
 * `ApiHttpError.message`는 예전 `new Error(JSON.stringify(data))`와 **바이트 단위로 같다.**
 * 사용자에게 보여줄 문구는 아래 표(코드 기준)가 책임지고, `message`는 하위 호환을 위한 자리로만
 * 남긴다 — 이미 그 문자열을 파싱하거나 부분 문자열로 검사하는 소비자가 여럿 있기 때문이다:
 * `client.ts`의 getBudget(`BUDGET_NOT_FOUND`), `src/offline/delta-sync.ts`
 * (`SYNC_CURSOR_INVALID`), `src/family/invite-permissions.ts`(봉투 JSON을 직접 파싱).
 * 서버 원문은 `serverMessage`에 따로 담아 두되 화면에 그대로 쓰지 않는다(위 2번).
 *
 * react-native/react-query에 의존하지 않는 순수 모듈이라 vitest에서 그대로 테스트한다
 * (api-error.test.ts).
 */

/** 서버 오류 응답 봉투(apps/api/src/common/filters/global-exception.filter.ts)에서 꺼낸 값. */
export type ApiErrorEnvelope = {
  code: string;
  /** 서버가 보낸 원문. 화면에 그대로 쓰지 않는다 — 표를 거친다. */
  message: string | null;
};

/**
 * 응답 본문에서 `{ error: { code, message } }` 봉투를 꺼낸다. 봉투가 아니거나 code가 없으면
 * `null` — 호출부는 "모르는 실패"로 취급하고 기존 폴백 문구를 쓴다.
 */
export function parseApiErrorEnvelope(body: unknown): ApiErrorEnvelope | null {
  if (!body || typeof body !== "object") return null;
  const envelope = (body as { error?: unknown }).error;
  if (!envelope || typeof envelope !== "object") return null;
  const { code, message } = envelope as { code?: unknown; message?: unknown };
  if (typeof code !== "string" || code.length === 0) return null;
  return { code, message: typeof message === "string" && message.length > 0 ? message : null };
}

/**
 * 비-2xx 응답. `status`/`code`로 분기할 수 있는 타입 있는 실패다.
 *
 * `Error`를 상속하므로 기존 `instanceof Error` 소비자(react-query onError, 화면의 catch)는
 * 그대로 동작하고, `message`도 예전과 같은 JSON 원문이다(위 모듈 주석 참고).
 */
export class ApiHttpError extends Error {
  readonly status: number;
  /** 서버 봉투의 오류 코드. 봉투가 아니면 null. */
  readonly code: string | null;
  /** 서버 봉투의 원문 메시지. 진단용이며 화면 문구로 직접 쓰지 않는다. */
  readonly serverMessage: string | null;
  /** 파싱된 응답 본문 원본(추가 필드를 보는 소비자를 위해 보존). */
  readonly body: unknown;

  constructor(status: number, body: unknown) {
    // 예전 `throw new Error(JSON.stringify(data))`와 동일한 message를 유지한다.
    super(JSON.stringify(body));
    this.name = "ApiHttpError";
    this.status = status;
    this.body = body;
    const envelope = parseApiErrorEnvelope(body);
    this.code = envelope?.code ?? null;
    this.serverMessage = envelope?.message ?? null;
  }
}

/**
 * 코드 → 사용자 문구 화이트리스트.
 *
 * 원칙: 서버 한국어 원문이 이미 해요체로 완성돼 있으면 그대로 쓰고(같은 실패가 웹/앱에서 다르게
 * 들리지 않게), 영어이거나 내부 용어가 섞였으면 같은 뜻의 해요체로 다듬는다. 여기 없는 코드는
 * 절대 원문을 노출하지 않고 호출부의 일반 문구로 폴백한다.
 */
export const API_ERROR_MESSAGES: Readonly<Record<string, string>> = {
  // --- 지출 저장/수정 (apps/api/src/onboarding/store-shared.ts, expenses-store.service.ts) ---
  // 서버 원문 그대로: 이미 해요체이고, 다시 눌러도 바뀌지 않는 사실을 정확히 말한다.
  EXPENSE_FUTURE_DATE: "미래 날짜의 지출은 저장할 수 없어요.",
  EXPENSE_DATE_INVALID: "날짜를 다시 확인해 주세요.",
  // 서버 원문("금액은 0보다 큰 원화 정수만 입력할 수 있어요.")의 "원화 정수"만 쉬운 말로 바꿨다.
  EXPENSE_AMOUNT_INVALID: "금액은 0보다 큰 숫자로 입력해 주세요.",
  EXPENSE_ITEM_NAME_REQUIRED: "품목명을 입력해 주세요.",
  // 라운드 49 QA(P2-4): "샀어요"가 실어 보낸 구매 링크가 서버에 없을 때(링크가 내려갔거나
  // 오래된 대기 행). 서버 원문 그대로다 — 다시 눌러도 바뀌지 않는 사실이라 재시도를 권하는
  // 대신 사용자가 지금 할 수 있는 일(링크 없이 저장)을 말한다. 이 코드가 4xx이므로 오프라인
  // 아웃박스는 이 행을 영원히 재시도하지 않고 실패 행으로 파킹한다(remote-api.ts).
  LINKED_PRODUCT_LINK_NOT_FOUND: "연결하려던 구매 링크를 찾지 못했어요. 링크 없이 다시 저장해 주세요.",

  // --- 엑셀 가져오기 (apps/api/src/imports/import-parser.ts, onboarding/import-pipeline.service.ts) ---
  // 서버 원문이 영어라 한국어로 옮긴다. 행 수·확장자·용량 상한은 서버가 거절하는 조건과 같은 값이다
  // (2,000행 / csv·xlsx / 10MB — src/import-file-validation.ts의 사전 검증 문구와도 같은 톤).
  IMPORT_TOO_MANY_ROWS: "한 번에 2,000행까지 가져올 수 있어요. 파일을 나눠서 올려 주세요.",
  IMPORT_FILE_TYPE_INVALID: "csv 또는 xlsx 파일만 올릴 수 있어요.",
  IMPORT_FILE_TOO_LARGE: "10MB 이하 파일만 올릴 수 있어요.",

  // --- 계정 상태 (apps/api/src/auth/kakao/kakao-auth.service.ts) ---
  // 서버 원문("탈퇴한 계정이에요.")에 **재가입 제한 기간**을 덧붙인다. 탈퇴 계정은 재시도로
  // 절대 풀리지 않으므로, 사용자가 다음에 할 수 있는 일을 아는 것이 유일한 도움이다.
  // 30일은 개인정보 처리방침 §3과 같은 값이다(docs/store/data-safety-answers.md: 삭제 처리 후
  // 30일 = PURGE_RETENTION_DAYS 기본값이 지나면 물리 파기).
  // 주의(서버 구현 메모): 탈퇴 계정으로 **로그인을 다시 시도하면** lastLoginAt이 갱신되며 파기
  // 기준 시각(updatedAt)이 함께 밀린다(apps/api .../data-retention-purge.job.ts 클래스 주석 3번).
  // 그래서 "30일이 지나면 다시 가입할 수 있어요"는 확언이 될 수 없다 — 재로그인 시도가 기한을
  // 밀어 스스로 깨진다. 개인정보 처리방침 화면(settings/privacy)과 **같은 하한 표현**으로
  // 통일해, 지킬 수 있는 사실("30일 동안은 안 된다")만 말한다. 재시도를 권하지 않는 이유이기도
  // 하다 — 사실만 말하고 "다시 시도해 주세요"를 붙이지 않는다.
  USER_WITHDRAWN: "탈퇴한 계정이에요. 삭제 후 30일 동안은 같은 계정으로 다시 가입할 수 없어요.",
  USER_BLOCKED: "이용이 제한된 계정이에요.",

  // --- 권한 (GlobalExceptionFilter의 403 기본 코드) ---
  // 화면마다 다른 맥락에서 쓰이므로 중립적으로 쓴다. 초대 수락 화면은 이 표를 쓰지 않고 자기
  // 문구를 유지한다(아래 hasApiErrorCode 참고) — 같은 403이라도 그 화면에서는 "권한"이 아니라
  // "이미 구성원"이 사용자가 알아야 할 사실이기 때문이다.
  // 403은 **역할 부족**만이 아니라 **애초에 그 가족의 구성원이 아닌 경우**로도 온다(가족이 바뀐 뒤
  // 남아 있던 화면, 다른 가족의 리소스 접근 등). "내 역할을 확인해 주세요"만 말하면 비구성원은
  // 있지도 않은 역할을 찾게 되므로, 두 경우를 함께 가리키도록 넓게 쓴다.
  FORBIDDEN: "권한이 없어 처리하지 못했어요. 가족 구성원 여부와 내 역할을 확인해 주세요.",

  // --- 가족 참여 (apps/api/src/households/household-runtime.service.ts) ---
  HOUSEHOLD_ALREADY_MEMBER: "이미 이 가족의 구성원이에요."
};

/**
 * 던져진 값에서 서버 오류 코드를 뽑는다. 세 가지 모양을 모두 받는다.
 *  1. `ApiHttpError` — requestJson/requestMultipartJson이 던지는 값.
 *  2. `body`를 들고 있는 오류 — `ExpenseHttpError`(client.ts), `RemotePermanentError`
 *     (src/offline/errors.ts). 둘 다 응답 본문을 그대로 실어 나른다.
 *  3. `code` 문자열을 들고 있는 오류 — 위 두 클래스가 파싱해 둔 코드를 바로 읽는 경로.
 * 모르면 `null`이고, `null`은 아무것도 바꾸지 않는다(호출부 폴백 유지).
 */
export function apiErrorCodeOf(error: unknown): string | null {
  if (!error || typeof error !== "object") return null;
  const candidate = error as { body?: unknown; code?: unknown };
  const fromBody = parseApiErrorEnvelope(candidate.body);
  if (fromBody) return fromBody.code;
  return typeof candidate.code === "string" && candidate.code.length > 0 ? candidate.code : null;
}

/** 이 실패가 해당 서버 코드인가 — 문자열 부분 검색 대신 쓰는 판정. */
export function hasApiErrorCode(error: unknown, ...codes: string[]): boolean {
  const code = apiErrorCodeOf(error);
  return code !== null && codes.includes(code);
}

/**
 * 아는 코드면 표의 문구, 모르면 `null`.
 *
 * `Object.prototype.hasOwnProperty`로 확인하는 이유: 서버 코드는 결국 응답 본문에서 온 문자열이라
 * `"toString"`·`"constructor"` 같은 값이 올 수도 있다. 단순 인덱싱이면 프로토타입 체인의 함수가
 * "문구"로 둔갑해 화면에 나갈 수 있다.
 */
export function apiErrorMessageForCode(code: string | null | undefined): string | null {
  if (!code) return null;
  return Object.prototype.hasOwnProperty.call(API_ERROR_MESSAGES, code) ? API_ERROR_MESSAGES[code] : null;
}

/**
 * 실패 → 화면 문구. 아는 코드만 표의 문구로 바꾸고, 나머지는 호출부가 준 기존 문구 그대로다.
 * 이 한 줄이 "서버가 이미 말해 준 사유"와 "앱이 책임지는 톤" 사이의 유일한 접점이다.
 */
export function apiErrorMessage(error: unknown, fallback: string): string {
  return apiErrorMessageForCode(apiErrorCodeOf(error)) ?? fallback;
}

/**
 * **계정 상태** 때문에 거절된 실패인가 — 로그인 화면 전용 판정.
 *
 * 로그인 화면에서 표 전체를 쓰면 안 된다: 예컨대 일반 403(code=FORBIDDEN)의 문구는
 * "가족 구성원 여부와 내 역할을 확인해 주세요."인데, 아직 로그인도 못 한 사람에게 가족 이야기를 하는 것은
 * 또 다른 오안내다. 로그인 화면이 사용자에게 정확히 말할 수 있는 것은 이 두 코드뿐이다.
 */
export const ACCOUNT_STATUS_ERROR_CODES = ["USER_WITHDRAWN", "USER_BLOCKED"] as const;

/** 계정 상태 거절이면 그 문구, 아니면 null(호출부의 기존 분기로 넘어간다). */
export function accountStatusErrorMessage(error: unknown): string | null {
  const code = apiErrorCodeOf(error);
  if (!code || !(ACCOUNT_STATUS_ERROR_CODES as readonly string[]).includes(code)) return null;
  return apiErrorMessageForCode(code);
}
