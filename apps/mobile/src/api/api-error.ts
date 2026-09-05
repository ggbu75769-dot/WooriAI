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

// GAP-054 라운드 54 P2-6: 금액 상한 문구는 입력 가드와 같은 단일 소스에서 온다
// (숫자를 여기 다시 적으면 서버 @Max와 갈라지는 순간을 아무도 모른다).
import { amountOverLimitMessage } from "../expenses/amount-limit";
// 라운드 69 B: 날짜 하한 두 코드의 문구도 같은 규율을 따른다 — 폼이 이미 세운 문장을 **읽는다**.
// 여기서 문장을 새로 지으면 같은 경계를 폼·서버·이 표가 각자 말하게 되고, 20이라는 숫자가
// 이 파일에 리터럴로 들어온다(도메인 `ENTRY_DATE_MAX_PAST_YEARS`가 단일 소스다).
import { EXPENSE_DATE_TOO_OLD_ERROR } from "../expenses/entry-form-guards";
// ⚠️ 라운드 69 리뷰 P-5: 이 값 import는 `../children/child-form`을 거쳐 순환 **직전**까지 간다 —
// child-form.ts는 `import type { UpdateChildBody } from "../api/client"`을 들고 있고, client.ts는
// 이 파일(ApiHttpError)을 값으로 부른다. 지금은 그 한 줄이 `import type`이라 컴파일 뒤 사라져서
// 런타임 사이클이 없다. 그 줄이 값 import로 바뀌면 client → api-error → child-form → client이
// 실제 사이클이 되고, 모듈 초기화 순서에 따라 이 표의 **세 줄**이 `undefined`가 될 수 있다
// (라운드 78 A가 아이 프로필 여정의 두 문장을 같은 자리에서 읽으면서 둘 → 셋이 됐다).
import {
  CHILD_BIRTH_DATE_FUTURE_ERROR,
  CHILD_BIRTH_DATE_TOO_OLD_ERROR,
  CHILD_DUE_DATE_BEYOND_TERM_ERROR
} from "../children/child-form";

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
 *
 * ## 라운드 69 B — 이 표에는 **늘어나는 규율**이 필요하다
 *
 * 표가 라운드 45에 세워진 뒤, 서버에 4xx 코드가 늘 때 이 표가 함께 늘어나게 하는 장치가 없었다.
 * 그래서 라운드 68이 코드를 둘 만들면서 표를 열지 않았고(`EXPENSE_DATE_TOO_OLD` ·
 * `CHILD_BIRTH_DATE_TOO_OLD`), 그 이전에도 넷이 밀려 있었다. 표에 없는 코드의 실패 행이 화면에서
 * 받는 것은 `PERMANENT_FAILURE_MESSAGE`("요청을 처리하지 못했어요." — src/offline/remote-api.ts)
 * 한 줄 + **재시도 버튼 없음**이라, 사용자가 고치면 바로 풀리는 실패도 막다른 문장이 된다.
 *
 * 이제 그 규율은 **소스 계약**으로 선다: api-error.test.ts가 앱의 아웃박스·준비템 상태 큐가
 * 지나는 서버 파일 **넷**(onboarding/의 store-shared.ts · expenses-store.service.ts ·
 * child-access.service.ts · items-catalog.service.ts)을 읽어 `code: "…"`를 전부 긁고, 그 코드가
 * 이 표에 있는지 아니면 **이유가 적힌 제외 목록**에 있는지를 묻는다. 서버에 코드를 새로 만들면
 * 그 테스트가 빨개지고, 만든 사람이 "이 코드는 앱에서 어떻게 보이는가"에 답해야 한다.
 *
 * 스윕은 **파일 단위**라 큐가 지나지 않는 코드도 함께 걸린다 — items-catalog.service.ts에는
 * 어드민 콘솔 전용 갈래(`ADMIN_*`)와 구매 링크 클릭(큐가 아닌 즉시 요청)이 같은 클래스에 산다.
 * 어드민 갈래는 표가 아니라 그 테스트의 제외 목록에서 이유와 함께 처리된다.
 *
 * ## 라운드 77 A — **제외의 이유가 둘이면, 하나가 거짓이 되어도 조용하다**
 *
 * 구매 링크 클릭의 두 코드(`PRODUCT_LINK_NOT_FOUND` · `PRODUCT_LINK_URL_SCHEME_INVALID`)는
 * 그 제외 목록에 있었고, 사유가 **둘**이었다 — *"클릭은 아웃박스를 타지 않는 즉시 요청이다"*
 * (참, 그리고 그 스윕의 단위다) + *"그 화면이 자기 문구를 쓴다"*(오늘 거짓을 날랐다).
 * 그 "자기 문구"는 영원히 통하지 않을 실패 앞에서 *"잠시 후 다시 시도해 주세요"* 였다.
 * 이제 두 코드는 이 표에 있고, 제외 목록에 남는 사유는 **그 스윕의 단위(아웃박스·상태 큐)로만**
 * 적는다. 그 밖의 사실은 사유가 아니라 관측이다(api-error.test.ts의 제외 목록 주석).
 *
 * ⚠️ 표에 들어왔다고 **아웃박스가 지나는 것은 아니다** — 클릭은 지금도 큐를 타지 않는 즉시
 * 요청이고, 이 표는 "코드가 오면 무엇을 말하는가"만 정한다.
 *
 * ⚠️ **범위 정정**(라운드 77 리뷰 S-3): 이 문단이 *"표를 읽는 자리는 `clickLink.onError`
 * 하나다"* 라고 적고 있었는데 그것은 거짓이다 — 이 **표 전체**를 읽는 소비자는 여럿이다
 * (`apiErrorMessage` 한 줄을 지나는 화면들 · `useSaveErrorCopy`/`resolveSaveErrorCopy`가 쓰는
 * 저장 실패 경로 · 동기화 상태 화면의 실패 행 · `accountStatusErrorMessage`의 로그인 화면).
 * 참인 것은 **이 두 줄**에 대한 문장이다: `PRODUCT_LINK_NOT_FOUND` ·
 * `PRODUCT_LINK_URL_SCHEME_INVALID`를 실제로 받는 자리는 오늘 `clickLink.onError`
 * 하나다(app/items/[itemTemplateId].tsx — 클릭은 큐를 타지 않으므로 아웃박스 경로에는
 * 이 두 코드가 오지 않는다).
 *
 * ⚠️ **그 화면에 닿는 코드는 이 둘만이 아니다**(같은 리뷰의 기록): `clickProductLink`는
 * `requireChildAccess`(→ `CHILD_NOT_FOUND` · `FORBIDDEN`)와
 * `requireItemTemplate`(→ `ITEM_NOT_FOUND`)를 먼저 지나므로, 그 셋도 이 표를 지나 같은
 * 토스트에 선다. 셋의 문장을 **이 맥락에서 다시 읽어 본 판정**을 값으로 남긴다:
 *  - `CHILD_NOT_FOUND`·`FORBIDDEN`은 그대로 옳다(아이가 사라졌다 · 권한이 없다 — 링크와
 *    무관한 사실이고, 다음에 할 일도 그 문장이 가리키는 곳에 있다).
 *  - `ITEM_NOT_FOUND`의 *"준비템 탭에서 확인해 주세요"* 는 **준비템 상세 안에서 들으면 한
 *    박자 어색하지만 거짓이 아니고, 다음 행동으로도 옳다** — 그 상세가 가리키던 준비템이
 *    방금 목록에서 내려갔다는 뜻이라 사용자가 갈 곳은 실제로 목록이다. ⚠️ 문장을 이 화면
 *    전용으로 가르지 **않는다**: 같은 코드가 아웃박스·준비템 상태 큐에서도 이 문장을 쓰고
 *    (그쪽에서는 정확히 옳다), 화면마다 문장을 가르는 순간 이 표가 코드 단위라는 성질을 잃는다.
 *
 * ## 라운드 78 A — ⚠️ **이 표는 "코드 하나 = 문장 하나"를 가정하는데 서버는 그렇지 않다**
 *
 * 관측을 값으로 남긴다(2026-08-30, api-error.test.ts의 스윕 자신이 센 값): 서버가 `code:`로
 * 던지는 코드 **97** 중 문장이 붙은 것이 **94**이고, 그중 **열여덟**이 서로 다른 문장을 둘
 * 이상 나른다(최대 `FORBIDDEN` **다섯**). 오늘 이 표 안에서 그런 코드는 **셋**이다 —
 * `FORBIDDEN`(5) · `ITEM_NOT_FOUND`(2, 한쪽은 어드민 영문) · `PRODUCT_LINK_NOT_FOUND`(2).
 * **셋 다 앱이 부르는 갈래는 하나뿐**이라 오늘 거짓은 없고, 그 사실을 적어 두는 것이 전부다:
 * 표를 늘리는 다음 라운드는 **그 코드가 서버에서 문장을 몇 개 나르는지** 먼저 물어야 한다
 * (이번에 더한 셋은 전부 문장이 하나다 — 그래서 표의 단위와 어긋나지 않는다).
 */
export const API_ERROR_MESSAGES: Readonly<Record<string, string>> = {
  // --- 지출 저장/수정 (apps/api/src/onboarding/store-shared.ts, expenses-store.service.ts,
  //     child-access.service.ts · items-catalog.service.ts · onboarding-core.service.ts) ---
  // 서버 원문 그대로: 이미 해요체이고, 다시 눌러도 바뀌지 않는 사실을 정확히 말한다.
  EXPENSE_FUTURE_DATE: "미래 날짜의 지출은 저장할 수 없어요.",
  EXPENSE_DATE_INVALID: "날짜를 다시 확인해 주세요.",
  // 서버 원문("금액은 0보다 큰 원화 정수만 입력할 수 있어요.")의 "원화 정수"만 쉬운 말로 바꿨다.
  EXPENSE_AMOUNT_INVALID: "금액은 0보다 큰 숫자로 입력해 주세요.",
  /**
   * GAP-054 라운드 54 P2-6 — 금액이 저장 가능한 한도를 넘었다(서버 DTO `@Max(MONEY_KRW_MAX)`).
   *
   * 이 코드가 없던 동안 그 실패는 일반 400과 함께 "요청을 처리하지 못했어요."로 접혔다.
   * 4xx라 오프라인 아웃박스는 그 행을 실패 행으로 **파킹**하는데(remote-api.ts), 동기화 상태
   * 화면에 뜨는 것이 그 막다른 한 문장뿐이라 사용자는 무엇을 고쳐야 큐가 풀리는지 알 수 없었다.
   *
   * 문구는 입력 칸 아래 안내와 **같은 모듈**에서 가져온다(src/expenses/amount-limit.ts) —
   * 같은 한도를 두 자리가 다른 문장으로 말하면 그 자체가 두 개의 계약이 된다.
   */
  EXPENSE_AMOUNT_TOO_LARGE: amountOverLimitMessage(),
  EXPENSE_ITEM_NAME_REQUIRED: "품목명을 입력해 주세요.",
  /**
   * 라운드 69 B — 라운드 68 A가 만든 **날짜 하한**(20년) 두 코드. 서버가 이미 해요체로 말해
   * 주는데 표에 없어서 화면까지 오지 못하던 자리다.
   *
   * 문구를 새로 짓지 않고 **폼 상수를 읽는다**(`amountOverLimitMessage`가 세운 선례 그대로):
   * 같은 경계를 폼과 이 표가 다른 문장으로 말하면 그 자체가 두 개의 계약이고, 20이라는 숫자가
   * 여기 리터럴로 적히는 순간 도메인 `ENTRY_DATE_MAX_PAST_YEARS`와 갈라진다.
   *
   * 도달성이 낮다는 사실을 함께 적어 둔다: 라운드 68 이후 폼·프리필·달력이 전부 막으므로
   * `EXPENSE_DATE_TOO_OLD`를 받는 행은 **업데이트 전에 큐에 들어간 행**과 **구버전 앱을 쓰는
   * 공동양육자**뿐이다. 그래도 표에 넣는 이유는 "그때 사용자가 보는 것이 막다른 문장"이라는
   * 것이고, 낮은 도달성이 곧 낮은 비용이다.
   *
   * `CHILD_BIRTH_DATE_TOO_OLD`는 아웃박스를 타지 않는다(아이 저장에는 큐가 없다). 라운드 69는
   * 그 화면(app/settings/children.tsx)이 다른 트랙의 파일이라 표에만 세워 두고 "배선은 그 화면을
   * 여는 라운드의 몫"이라고 적어 뒀다 — **라운드 70 B가 그 빚을 갚았다**: `useSaveErrorCopy`가
   * 실패 값을 함께 받게 되면서(src/offline/use-load-error-copy.ts) 두 화면(예산·아이 관리)의
   * 저장 실패가 이 표를 지난다. 표에 없는 실패의 문구·동작은 종전 그대로다.
   */
  EXPENSE_DATE_TOO_OLD: EXPENSE_DATE_TOO_OLD_ERROR,
  CHILD_BIRTH_DATE_TOO_OLD: CHILD_BIRTH_DATE_TOO_OLD_ERROR,

  /**
   * --- 아이 프로필 여정의 실패 셋 (라운드 78 A · 루프에 들어오기 전의 관문) ---
   *
   * 서버는 이 셋도 오래전부터 코드로 말해 왔다(onboarding/onboarding-core.service.ts):
   * 출생일이 미래면 400 `CHILD_BIRTH_DATE_FUTURE`, 예정일이 만삭보다 멀면 400
   * `CHILD_DUE_DATE_BEYOND_TERM`, 허용되지 않은 상태 전환이면 400
   * `CHILD_STAGE_MODE_TRANSITION_NOT_ALLOWED`. **셋 다 다시 눌러도 결과가 같은데** 표에 없어서,
   * 온보딩(ONB-002)의 저장 실패 카드는 *"저장하지 못했어요. 네트워크 연결을 확인한 뒤 다시
   * 시도해 주세요."* 한 문장만 말했다 — 연결과 무관한 실패에 연결을 확인하라 하고, 영원히
   * 풀리지 않는 벽에 재시도를 권한 셈이다.
   *
   * ⚠️ 그 여정에는 **스윕이 없었다.** 라운드 69가 손으로 넣은 `CHILD_BIRTH_DATE_TOO_OLD`(바로
   * 윗줄) 하나만 표에 있었고, 그 뒤 서버가 더한 세 코드는 아무 단언도 깨지 않은 채 표 밖에
   * 있었다. 이번 라운드가 세우는 **두 번째 여정 스윕**(api-error.test.ts의
   * `CHILD_PROFILE_JOURNEY_SERVER_FILES`)이 그 자리를 막는다.
   *
   * **문장은 셋 다 이미 있던 것이다**(새 한국어 문장 0건):
   *  - 앞 둘은 **폼 상수를 읽는다**(`amountOverLimitMessage`·`EXPENSE_DATE_TOO_OLD_ERROR`가 세운
   *    선례 그대로). 두 상수는 서버 원문과 **바이트 동일**하고, 만삭 주차·20년 같은 숫자는
   *    도메인 한 곳에서만 온다 — 표가 문장도 숫자도 짓지 않는다.
   *  - 셋째는 **서버 원문 그대로**다(`EXPENSE_FUTURE_DATE`·`EXPENSE_CATEGORY_INVALID`의 선례):
   *    이미 해요체이고, 다시 눌러도 바뀌지 않는 사실을 정확히 말한다. ⚠️ 꼬리에
   *    `"잠시 후 다시"`를 붙이지 않는다 — 공동양육자가 먼저 전환을 마친 뒤라면 기다림이
   *    답이 아니다(그 화면은 목록을 새로 고치면 이미 태어난 것으로 보인다).
   */
  CHILD_BIRTH_DATE_FUTURE: CHILD_BIRTH_DATE_FUTURE_ERROR,
  CHILD_DUE_DATE_BEYOND_TERM: CHILD_DUE_DATE_BEYOND_TERM_ERROR,
  CHILD_STAGE_MODE_TRANSITION_NOT_ALLOWED: "아이 상태는 '임신 중'에서 '태어났어요'로만 바꿀 수 있어요.",

  /**
   * 라운드 69 B — **가장 도달하기 쉬운 자리**(400). 준비템에서 "샀어요"를 눌러 오프라인으로
   * 저장 → 그 사이 운영이 그 템플릿을 내림/교체 → flush가 400을 받는다. 사용자가 볼 수 있는
   * 값(금액·품목·날짜)에는 아무 문제가 없어서, 종전의 "요청을 처리하지 못했어요."로는 무엇을
   * 고쳐야 큐가 풀리는지 알 방법이 없었다.
   *
   * 서버 원문("연결된 준비템을 찾을 수 없어요.")에 **다음에 할 일**을 한 문장 붙인다 —
   * 형태는 바로 아래 `LINKED_PRODUCT_LINK_NOT_FOUND`와 같다(그쪽은 링크, 이쪽은 준비템 연결).
   */
  EXPENSE_LINKED_ITEM_TEMPLATE_INVALID: "연결된 준비템을 찾을 수 없어요. 준비템 연결 없이 다시 저장해 주세요.",
  /**
   * 라운드 69 B — 카테고리 갈래의 **자기 코드**. 서버는 이 문장을 오래전부터 들고 있었는데
   * `VALIDATION_ERROR`라는 바구니 코드로 던져서(라운드 69 B가 `EXPENSE_CATEGORY_INVALID`로
   * 갈랐다 — apps/api/.../expenses-store.service.ts의 `requireExistingCategory`) 코드 단위인
   * 이 표가 구조적으로 꺼낼 수 없었다. `VALIDATION_ERROR` 자체는 **표에 넣지 않는다**: 바구니
   * 코드라 DTO 검증 실패 전량이 이 문구를 뒤집어쓴다.
   *
   * 문구는 서버 원문 **그대로**다 — 이미 해요체이고 다음에 할 일까지 말한다.
   */
  EXPENSE_CATEGORY_INVALID: "존재하지 않는 카테고리예요. 카테고리를 다시 선택해 주세요.",
  // 라운드 49 QA(P2-4): "샀어요"가 실어 보낸 구매 링크가 서버에 없을 때(링크가 내려갔거나
  // 오래된 대기 행). 서버 원문 그대로다 — 다시 눌러도 바뀌지 않는 사실이라 재시도를 권하는
  // 대신 사용자가 지금 할 수 있는 일(링크 없이 저장)을 말한다. 이 코드가 4xx이므로 오프라인
  // 아웃박스는 이 행을 영원히 재시도하지 않고 실패 행으로 파킹한다(remote-api.ts).
  LINKED_PRODUCT_LINK_NOT_FOUND: "연결하려던 구매 링크를 찾지 못했어요. 링크 없이 다시 저장해 주세요.",

  /**
   * --- 구매 링크 **클릭**의 두 실패 (라운드 77 A · 핵심 루프 4단계) ---
   *
   * 바로 윗줄(`LINKED_PRODUCT_LINK_NOT_FOUND`)이 **지출 저장** 경로에서 같은 사실을 말하는
   * 동안, 정작 사용자가 [쿠팡에서 보기]를 누르는 자리는 서버가 준 코드를 보지 않고
   * *"링크를 열지 못했어요. 잠시 후 다시 시도해 주세요."* 한 문장만 말했다. 어드민이 내린
   * 링크도, 허용 도메인 밖 주소도, 스킴이 깨진 주소도 **다시 눌러서 풀리지 않는다** —
   * 그 상세에 다른 판매처 링크가 두 개 더 서 있어도 사용자는 그것을 눌러 볼 이유를 얻지 못했다.
   *
   * ⓐ `PRODUCT_LINK_NOT_FOUND`(404)는 서버에서 **갈래가 둘**인데 코드가 하나다 — 링크가
   *    `active:false`가 되었거나 지워졌을 때(items-catalog.service.ts의 clickProductLink), 그리고
   *    **허용 도메인 목록 밖**일 때(같은 파일이 던지는 affiliate-link-guard.util.ts의
   *    `PRODUCT_LINK_NOT_FOUND_ERROR` — 리다이렉트 `/r/:code`와 코드를 통일해 둔 자리이고,
   *    그렇게 두는 이유가 그 파일 주석에 있다: 두 경우를 구분해 주면 코드 탐색이 가능해진다).
   *    ⚠️ **앱이 그 둘을 갈라 말하면 안 되는 이유가 그것**이라, 문구도 하나다.
   * ⓑ `PRODUCT_LINK_URL_SCHEME_INVALID`(400)는 저장된 주소가 http/https가 아닐 때다
   *    (`requireHttpUrl`). 사용자가 고칠 수 있는 값이 아니다.
   *
   * 문형은 이 표에 이미 있는 그것이다(`ITEM_NOT_FOUND` 계열 — **무엇이 없는지** 한 문장 +
   * **지금 할 수 있는 일** 한 문장). ⚠️ 꼬리에 `"잠시 후 다시"`를 쓰지 않는다
   * (`LINKED_PRODUCT_LINK_NOT_FOUND`가 지는 그 부정 단언과 같은 규율), 그리고 표기는 띄어 쓴
   * `"확인해 주세요"`다(붙여 쓴 방언 셋에 넷째를 더하지 않는다).
   *
   * 서버 원문("상품 링크를 찾을 수 없어요." · "상품 링크 주소는 http 또는 https로 시작해야
   * 해요.")을 그대로 쓰지 않는 이유도 이 표의 존재 이유 그대로다: 앞은 다음에 할 일이 없고,
   * 뒤는 어드민이 읽을 문장이다(주소를 고칠 수 있는 사람은 사용자가 아니다).
   *
   * ⚠️ **꼬리가 "다른 구매 링크"를 단정하지 않는 이유**(라운드 77 리뷰 S-4): 이 표는 코드만
   * 보고 답하므로 **그 상세에 다른 판매처 링크가 있는지 모른다.** 링크가 하나뿐인 준비템도
   * 있고(오늘 시드에도 있다), 그때 *"다른 구매 링크를 확인해 주세요"* 는 없는 것을 가리키는
   * 안내가 된다 — 고치려던 그 결함(막다른 문장)을 문형만 바꿔 되풀이하는 꼴이다. 그래서
   * 꼬리는 **있는지 없는지를 사용자가 지금 화면에서 볼 수 있는 것**을 가리킨다:
   * *"이 준비템의 구매 링크를 다시 확인해 주세요."* — 링크 목록은 그 상세에 이미 떠 있다.
   */
  PRODUCT_LINK_NOT_FOUND:
    "이 구매 링크는 더 이상 열 수 없어요. 내려간 링크일 수 있으니 이 준비템의 구매 링크를 다시 확인해 주세요.",
  PRODUCT_LINK_URL_SCHEME_INVALID:
    "이 구매 링크의 주소가 올바르지 않아 열 수 없어요. 이 준비템의 구매 링크를 다시 확인해 주세요.",

  /**
   * --- 대상이 사라진 404 셋 (라운드 69 B) ---
   *
   * 다른 기기에서 지출·아이가 지워졌거나 운영이 준비템을 내린 뒤, 이 기기에 남아 있던 큐가
   * 받는 답이다. 셋 다 4xx라 아웃박스·준비템 상태 큐는 그 행을 실패 행으로 파킹하고 재시도
   * 버튼을 내린다(src/offline/permission-denied.ts).
   *
   * **재시도를 권하지 않는다** — `USER_WITHDRAWN`이 세운 형식이다. 대신 붙이는 한 문장은
   * "이 큐 행을 어떻게 하라"가 **아니라** "사라진 그것이 지금 어디 있는지"를 말한다. 행을
   * 어떻게 할지는 바로 아랫줄의 안내가 이미 말하고 있고(`SYNC_STATUS_PERMANENT_FAILURE_HINT` ·
   * `SYNC_STATUS_ITEM_STATUS_PERMANENT_FAILURE_HINT`), 같은 사실을 두 문장이 각자 말하기
   * 시작하면 표와 그 파일이 갈라지는 순간을 아무도 모른다(permission-denied.ts의 그 규율).
   *
   * ⚠️ `EXPENSE_NOT_FOUND`의 **삭제 경로는 이 문구를 지나지 않는다**: 삭제가 받은 404 +
   * 이 코드는 "서버에 이미 없다"는 뜻이라 sync-engine이 **성공으로 수렴**시킨다(코드로 판정하며
   * 문구를 보지 않는다 — src/offline/sync-engine.ts). 이 문구가 서는 자리는 수정 경로다.
   *
   * `ITEM_NOT_FOUND`는 서버에 갈래가 둘이고 한쪽 원문이 **영어**다(items-catalog.service.ts의
   * `requireItemTemplateAnyStatus` — "Item template was not found."). 표를 지나므로 어느
   * 갈래든 사용자가 보는 것은 이 한국어 한 문장이다 — 이 표의 존재 이유 그대로다.
   */
  EXPENSE_NOT_FOUND: "지출 기록을 찾을 수 없어요. 다른 기기에서 지워졌을 수 있으니 기록 탭에서 확인해 주세요.",
  CHILD_NOT_FOUND: "아이 프로필을 찾을 수 없어요. 다른 기기에서 지워졌을 수 있으니 아이 목록에서 확인해 주세요.",
  ITEM_NOT_FOUND: "준비템을 찾을 수 없어요. 목록에서 내려갔을 수 있으니 준비템 탭에서 확인해 주세요.",

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
  HOUSEHOLD_ALREADY_MEMBER: "이미 이 가족의 구성원이에요.",

  /**
   * --- 멱등키 충돌 409 (apps/api/src/common/idempotency/idempotency.interceptor.ts) ---
   *
   * 라운드 99 트랙 F1(M): 같은 Idempotency-Key가 **다른 본문**과 함께 다시 오면 서버가 24시간
   * 동안 돌려주는 코드다. 앱 쪽 1차 수리는 키를 본문 지문에 묶어 이 409에 애초에 닿지 않게
   * 하는 것이고(src/children/child-create-idempotency.ts · onboarding-progress.store.ts),
   * 이 줄은 그 수리가 못 덮는 잔여(구버전이 남긴 지문 없는 키 · 동시 이중 발사)를 위한 2차다 —
   * 종전에는 표에 없어 "네트워크 연결을 확인한 뒤 다시 시도해 주세요"라는 **틀린 안내**가
   * 나갔다(네트워크는 멀쩡했고, 같은 재제출은 몇 번을 눌러도 같은 409다).
   *
   * ⚠️ 이 코드는 서버에서 문장을 여럿 나른다(본문 충돌 · 이전 요청 처리 중 · 이전 요청 실패 —
   * 전부 `conflictError()`의 변수 message라 위 ⓔ 스윕의 리터럴 그물에는 걸리지 않는다). 문장
   * 하나로 셋을 다 덮어야 하므로, 셋에 공통인 사실만 말한다: **이전 제출이 이미 처리됐을 수
   * 있다** — 그래서 재시도 대신 확인을 권한다(재시도 무익 처리는 온보딩 저장 실패 카드가
   * 진다 — src/onboarding/step-ui.tsx). 목적지를 박지 않는 이유는 CHILD_NOT_FOUND가 배운
   * 그것이다: 이 표는 코드 단위라, 온보딩(목록 없음)과 설정(목록 있음)이 같은 문장을 듣는다.
   */
  IDEMPOTENCY_KEY_CONFLICT: "이전 제출이 이미 처리됐을 수 있어요. 저장된 내용이 있는지 먼저 확인해 주세요."
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
