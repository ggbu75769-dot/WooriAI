/**
 * 라운드 74 트랙 A(GAP-074 #1) — **로그에 남겨도 되는 경로 모양.**
 *
 * ── 왜 이 파일이 생겼나 ──
 *
 * 가족 초대 토큰은 이 저장소가 **저장하지 않기로 결정한 비밀값**이다:
 * `households/household-runtime.service.ts`가 `randomBytes(24).toString("hex")`로 48자
 * 토큰을 만들어 링크로 내보내고, DB에는 sha256 해시만 넣는다(`inviteTokenHash`). 유효기간은
 * 7일이고, 그 토큰 하나면 누구든 그 가구에 지정된 역할로 들어간다 — 즉 **평문 토큰은 저장소
 * 어디에도 남지 않는 것이 설계**다.
 *
 * 그런데 그 토큰이 URL **경로**에 실린다(오늘 세 자리 — 아래 `MASKED_SECRET_PATHS`). 요청
 * 로거는 `req.path`를 통째로 적었고, `req.path`는 라우트 패턴이 아니라 **실제 경로**다. 그래서
 * 프로덕션 stdout에 `{"…","path":"/invite/9f3c…(48자)","status":200}`가 status 200 =
 * level `info`로 빠짐없이 쌓였다. 같은 모듈의 주석이 정반대를 약속하고
 * (*"never includes … any auth material"*), `docs/operations/incident-response.md`가 새벽
 * 3시의 운영자에게 그 약속을 되풀이한다. 로그는 오래 산다 —
 * `infra/docker/docker-compose.prod.yml`의 `x-logging`이 서비스마다 10MB × 3파일을 유지하고,
 * 그 창은 초대 토큰의 7일보다 짧지 않다. 로그 파일을 읽을 수 있는 사람은 **그 초대를 대신
 * 수락할 수 있었다.**
 *
 * ── 이 모듈이 하는 것과 하지 않는 것 ──
 *
 * 하는 것은 하나다: `(rawPath) → 로그용 경로`. 비밀값을 담는 경로를 **라우트 모양**으로 바꾼다
 * (`/invite/9f3c…` → `/invite/:token`). 규칙은 화이트리스트가 아니라 **목록**이다 — 오늘의
 * 세 자리를 값으로 적고, 마스킹하지 않는 예외도 **이유와 함께** 값으로 적는다
 * (`UNMASKED_SECRET_CANDIDATE_PATHS`).
 *
 * 하지 않는 것:
 *  - **부분 마스킹을 하지 않는다.** 앞 4자 같은 조각도 남기지 않는다 — 48자 hex의 앞 4자는
 *    로그 사이 상관관계 추적(같은 초대의 조회→수락→랜딩을 잇는 것)을 그대로 열어 주고,
 *    운영자가 그 조각으로 할 수 있는 일은 없다. 남는 것은 `:token` 리터럴 하나다.
 *  - **응답을 바꾸지 않는다.** 상태 코드·헤더·본문은 이 파일의 사정거리 밖이다(초대 랜딩의
 *    200·오라클 없음·헤더 셋은 라운드 70 A와 73 C가 세운 자리다).
 *  - **로그 형식을 통일하지 않는다.** 한 스트림에 요청 로거의 JSON 한 줄과 Nest `Logger`의
 *    텍스트가 섞여 흐르고 `LOG_LEVEL`은 전자만 조인다는 사실은 그대로다(별도 결정).
 *
 * ── 운영자가 잃지 않는 것 ──
 *
 * 마스킹 뒤에도 **경로 모양으로 라우트가 식별된다**: `/invite/:token`은 여전히
 * `/invite/:token`이고, `/api/v1/invites/:token`과 `/api/v1/invites/:token/accept`는 여전히
 * 서로 다른 줄이다. `requestId`·`userId`·`status`·`durationMs`는 한 글자도 바뀌지 않는다 —
 * `incident-response.md` §초동 2가 시키는 requestId 추적은 그대로 된다.
 *
 * 이 목록이 사실과 어긋나는 순간은 `apps/api/test/request-log-fields.test.ts`가 잡는다
 * (`apps/api/src/**`의 라우트 데코레이터 **전수** 스윕 — 새 라우트가 비밀값을 경로에 실으면
 * 그 테스트가 먼저 빨개진다).
 */

/**
 * 전역 프리픽스. `bootstrap.ts`의 `app.setGlobalPrefix("api/v1", …)`와 같은 값이고,
 * `/api/v1` 고정은 저장소 계약이다(CLAUDE.md). 두 값이 갈라지는 순간은 스윕 테스트가
 * `bootstrap.ts`를 읽어 잡는다.
 */
const API_PREFIX = "/api/v1";

export type MaskedSecretPathRule = {
  /** 로그에 **실제로 남는 값**. 라우트 모양 그대로라 운영자가 라우트를 식별한다. */
  readonly routeShape: string;
  /** 비밀값을 담는 경로 매개변수의 이름(스윕이 이 이름으로 라우트와 규칙을 잇는다). */
  readonly paramName: string;
  /**
   * 실제 경로 판별. 값의 **모양을 보지 않는다** — 48자 hex인지 묻지 않고 자리로만 판단한다.
   * 토큰이 아닌 아무 문자열이 그 자리에 와도(오타·스캐너·만료된 옛 토큰) 똑같이 가려진다.
   *
   * `i` 플래그: Nest/Express의 라우팅은 기본이 대소문자 무시라 `/INVITE/<토큰>`도 같은
   * 핸들러에 닿는다. 규칙이 대소문자를 가리면 그 요청만 평문으로 남는다.
   * 끝의 `/?`도 같은 이유다(`/invite/<토큰>/`도 같은 핸들러에 닿는다).
   */
  readonly pattern: RegExp;
  /** 이 자리가 왜 비밀값인가. */
  readonly reason: string;
};

/**
 * **비밀값을 담는 경로와 그것이 로그에 남는 모양**(오늘 셋 — 전부 초대 토큰이다).
 *
 * 세 패턴은 서로 겹치지 않는다(`…/invites/<t>`와 `…/invites/<t>/accept`는 세그먼트 수가
 * 다르다). 겹치지 않는다는 것 자체를 스윕 테스트가 확인한다.
 */
export const MASKED_SECRET_PATHS: readonly MaskedSecretPathRule[] = [
  {
    routeShape: "/invite/:token",
    paramName: "token",
    // 전역 프리픽스 **밖**이다: bootstrap.ts가 `exclude: ["invite/:token"]`로 빼 둔
    // 공개 랜딩이고, 프로덕션 초대 링크(`${INVITE_LINK_BASE_URL}/invite/<토큰>`)가
    // 정확히 이 경로를 가리킨다.
    pattern: /^\/invite\/[^/]+\/?$/i,
    reason:
      "앱을 깔기 전에 브라우저로 여는 공개 초대 랜딩. 링크를 받은 사람이 그냥 누르는 경로라 " +
      "가족 초대 토큰이 그대로 실려 오고, 성공 응답이 200이라 기본 LOG_LEVEL=info에서 빠짐없이 남는다."
  },
  {
    routeShape: `${API_PREFIX}/invites/:token`,
    paramName: "token",
    pattern: /^\/api\/v1\/invites\/[^/]+\/?$/i,
    reason:
      "초대 조회 JSON API(무인증 — 토큰 자체가 인증이다). 앱이 딥링크를 받은 뒤 초대 내용을 " +
      "미리 보여 주려고 부른다."
  },
  {
    routeShape: `${API_PREFIX}/invites/:token/accept`,
    paramName: "token",
    pattern: /^\/api\/v1\/invites\/[^/]+\/accept\/?$/i,
    reason:
      "초대 수락. 이 토큰 하나로 가구 구성원이 되므로 로그에 남는 순간 그 줄을 읽는 사람이 " +
      "대신 수락할 수 있다."
  }
];

/**
 * **비밀값처럼 보이지만 가리지 않는 자리와 그 이유.**
 *
 * 스윕(`request-log-fields.test.ts`)은 라우트 매개변수 이름이
 * `SECRET_CANDIDATE_PARAM_NAME`에 걸리면 **무조건** 판정을 요구한다 — 마스킹 목록에 있든지,
 * 여기에 이유와 함께 있든지 둘 중 하나다. 이 표의 값은 "어딘가에 이유가 적혀 있다"가 아니라
 * **다음 라운드가 이 자리를 다시 판정하지 않는다**는 것이다(라운드 73의
 * `LOAD_ERROR_COPY_EXEMPT_SITES`와 같은 관례).
 *
 * ⚠️ 판정 규칙이 이름 모양이라 **일부러 과하게 잡는다** — 빠뜨린 비밀값은 조용한 구멍이지만,
 * 더 잡힌 자리는 여기 한 줄이 늘 뿐이다. 정찰 노트가 마스킹 예외로 이름 붙인 것은
 * `/r/:code` 하나이고, `:key`는 그 과잉 포착이 데려온 두 번째 줄이다.
 */
export const UNMASKED_SECRET_CANDIDATE_PATHS: Readonly<Record<string, string>> = {
  [`${API_PREFIX}/r/:code`]:
    "제휴 리다이렉트의 코드는 **앱이 사용자에게 공유하라고 내주는 공개 값**이다" +
    "(items-catalog.service.ts의 publicRedirectShareUrl이 이 URL을 그대로 만들어 준다 — " +
    "라운드 64 D · 67 #4). 카카오톡으로 오가는 값이라 감출 비밀이 없고, 클릭 추적에서 " +
    "어느 링크가 눌렸는지 아는 **유일한 키**다: 가리면 그 로그로 할 수 있는 일이 사라진다.",
  [`${API_PREFIX}/admin/disclosures/:key`]:
    "제휴 고지 문구의 key는 난수가 아니라 **운영이 정한 카탈로그 이름**이다(`coupang` 같은 값 — " +
    "disclosures 테이블의 key당 한 칸 upsert). 어드민 인증이 걸린 쓰기 경로이고, 그 key는 " +
    "이미 감사 로그의 봉투에 원문으로 남는다(admin.controller.ts의 admin.disclosure.update). " +
    "여기서 가리면 어느 고지가 바뀌었는지 요청 로그만 모르게 된다."
};

/**
 * **비밀값 후보로 볼 경로 매개변수 이름**(스윕의 판정 규칙).
 *
 * 이름 모양 하나로 판정한다. 오늘 `apps/api/src/**`의 라우트 매개변수 열여섯 종류 중 이 규칙에
 * 걸리는 것은 `:token`·`:code`·`:key` 셋이고, 나머지는 전부 `…Id` 꼴의 식별자다.
 * 규칙을 **좁히지 말 것** — 좁히는 순간 새 라우트가 판정 없이 지나갈 수 있고, 넓혀서 더 걸린
 * 자리는 위 예외 표에 이유 한 줄이 늘 뿐이다.
 */
export const SECRET_CANDIDATE_PARAM_NAME =
  /(token|secret|password|passphrase|credential|otp|passcode|apikey|key|code|hash|signature|nonce)/i;

/** 매개변수 이름이 비밀값 후보인가(`:token`의 `token`처럼 콜론을 뗀 이름을 넘긴다). */
export function isSecretCandidateParamName(paramName: string): boolean {
  return SECRET_CANDIDATE_PARAM_NAME.test(paramName);
}

/**
 * `requestId`가 넘을 수 없는 길이와 모양.
 *
 * ── 라운드 74 적대적 리뷰 A-3 ──
 *
 * 이 모듈의 이웃(`request-logger.middleware.ts`)은 *"헤더·본문·질의 문자열은 로그에 없다"*
 * 를 약속하고 그 약속을 계약이 센다. 그런데 `requestId`는 **클라이언트가 보낸 헤더**
 * (`x-request-id`)를 그대로 옮겨 적는 필드다 — 즉 그 약속 **안에 서 있는 예외**이고,
 * 예외가 조용하면 그것은 예외가 아니라 구멍이다. 아무나 보낼 수 있는 값이므로:
 *  - **길이**: 로그 한 줄을 임의로 부풀리지 못하게 상한을 둔다(로그 파일은 10MB × 3개로
 *    회전하므로, 긴 헤더 한 벌이면 조사에 필요한 옛 줄을 밀어낼 수 있다).
 *  - **문자셋**: 줄바꿈·따옴표·제어문자가 들어오면 JSON 한 줄 로그를 **여러 줄처럼 보이게**
 *    만들거나 grep 결과를 흐린다(줄 단위로 읽는 도구가 곧 운영 절차다 —
 *    `incident-response.md` §초동 2).
 * 상한과 문자셋을 넘으면 **버린다**(자르지 않는다 — 잘린 id는 있지도 않은 요청을 가리키는
 * 새 거짓말이고, 없는 것은 없다고 말하는 편이 정직하다).
 *
 * 128자·`[A-Za-z0-9_.:-]`는 실제로 오가는 모양을 전부 담는다(UUID 36 · nginx `$request_id` 32 ·
 * W3C traceparent 55).
 */
export const MAX_LOGGABLE_REQUEST_ID_LENGTH = 128;
export const LOGGABLE_REQUEST_ID_PATTERN = /^[A-Za-z0-9_.:-]+$/;

/** 로그에 남길 `requestId`(모양이 어긋나면 `undefined` — 지어내거나 자르지 않는다). */
export function loggableRequestId(rawRequestId: unknown): string | undefined {
  const value = Array.isArray(rawRequestId) ? rawRequestId[0] : rawRequestId;
  if (typeof value !== "string") return undefined;
  if (value.length === 0 || value.length > MAX_LOGGABLE_REQUEST_ID_LENGTH) return undefined;
  return LOGGABLE_REQUEST_ID_PATTERN.test(value) ? value : undefined;
}

/**
 * 로그에 남길 경로.
 *
 * @param rawPath Express의 `req.path`(질의 문자열이 없는 경로). 요청 로거는 `req.path`가
 * 없을 때 `req.url`로 물러나는데 그 값에는 `?…`가 붙어 있을 수 있어, 규칙을 태우기 전에
 * 잘라 낸다 — 자르지 않으면 `/invite/<토큰>?x=1`이 어느 패턴에도 걸리지 않아 **평문으로**
 * 남는다(그리고 요청 로거는 애초에 질의 문자열을 남기지 않겠다고 약속한 자리다).
 */
export function loggablePath(rawPath: string): string {
  const path = normalizeSlashes(pathOnly(typeof rawPath === "string" ? rawPath : ""));
  for (const rule of MASKED_SECRET_PATHS) {
    if (rule.pattern.test(path)) {
      return rule.routeShape;
    }
  }
  return path;
}

function pathOnly(value: string): string {
  const cut = value.search(/[?#]/);
  return cut === -1 ? value : value.slice(0, cut);
}

/**
 * 이어진 슬래시를 하나로 줄인다 — **규칙을 태우기 전에** 지나야 하는 자리다.
 *
 * 라운드 74 적대적 리뷰 A-1: 규칙 셋은 `^\/invite\/…` 같은 **정확한 모양**을 보는데,
 * Express는 `//invite/<토큰>`이나 `/api/v1//invites/<토큰>` 같은 경로도 같은 핸들러에
 * 닿게 한다(404가 되는 조합도 있지만, 404는 `warn`이라 기본 `LOG_LEVEL=info`에서 **더 잘**
 * 남는다). 그래서 슬래시를 하나 더 붙이는 것만으로 마스킹을 통째로 우회해 48자 토큰이
 * 평문으로 쌓일 수 있었다 — 라우팅이 관대한 자리에서 규칙만 엄격하면 그 차이가 곧 구멍이다.
 *
 * 정규화한 값이 **로그에 남는 값**이기도 하다(가려지지 않는 경로도 이 모양으로 남는다):
 * 같은 라우트가 슬래시 수만 다른 여러 줄로 흩어지지 않는 편이 운영자에게도 낫다.
 */
function normalizeSlashes(value: string): string {
  return value.replace(/\/{2,}/g, "/");
}
