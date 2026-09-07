import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AdminApiError,
  adminChangePassword,
  adminLogin,
  adminLogout,
  adminMe,
  adminMfaDisable,
  adminMfaSetupStart,
  adminVerifyMfaLogin,
  getAdminDashboardSummary,
  isAuthError,
  isSelfUpdateForbiddenError,
  isTimeoutError,
  listAdminUsers,
  listAuditLogs,
  lookupAdminEndUsers,
  updateAdminUser,
  updateDisclosure,
  updateItemTemplate
} from "./admin-api";
import { loadErrorCopy } from "./load-error-copy";
import { writeErrorMessage } from "./write-error-copy";

/**
 * 라운드 이월 — **어드민의 "서버가 토큰을 거절했다" 분기 특성화(characterization).**
 *
 * 어제까지 이 저장소에서 `isAuthError(...)`가 **참**이 되는 단언은 0건이었다
 * (`admin-api.test.ts`의 일곱 자리는 전부 `.toBe(false)` — "이 실패는 세션 만료가 아니다"만
 * 고정했다). 즉 세션이 만료·폐기·무효가 됐을 때 어드민이 **무엇으로 그것을 알아보는지**가
 * 한 줄도 고정돼 있지 않았다. 이 파일이 그 자리를 **오늘 거동 그대로** 고정한다 —
 * 고치는 파일이 아니다(고칠 것과 그 근거는 이 트랙의 보고서에 있다).
 *
 * ⚠️ **무엇을 고정하고 무엇을 고정하지 못하는가**(사각을 먼저 적는다).
 *  · **고정한다** — 거절 응답 하나가 `admin-api.ts`의 `request()`를 지나 어떤 판정
 *    (`isAuthError` · `isSelfUpdateForbiddenError` · `isTimeoutError`)이 되고, 화면 한 벌
 *    (`loadErrorCopy` · `writeErrorMessage`)을 지나 **어떤 문장과 어떤 [다시 시도] 여부**가
 *    되는가. 전부 실제 모듈을 실행해서 잰다.
 *  · **고정하지 못한다** — 그 뒤 화면이 실제로 무엇을 그리는가(로그인 화면으로 돌아가는가,
 *    문장을 세우는가). 어드민에는 DOM 테스트 환경이 없다(jsdom · @testing-library ·
 *    react-test-renderer가 저장소에 0건이고, vitest는 node 환경으로 돈다). 그 층은 오늘
 *    `src/admin-load-error-copy.test.ts`의 catch 블록 스윕이 **소스 구조로** 잡고 있다.
 *
 * 기대값은 전부 **리터럴**이다. 어느 단언도 검사 대상 함수를 불러 기대값을 만들지 않는다
 * (순환 등가 오라클 금지). 서버 쪽 문장·코드는 `apps/api/src/admin/admin-auth.guard.ts`와
 * `admin-auth.service.ts`가 **오늘 실제로 내보내는 값**을 옮겨 적은 것이다.
 */

/** API 오류 봉투(`{ error: { code, message } }`) 그대로의 응답 하나. */
function errorResponse(status: number, code: string, message: string): Response {
  return new Response(JSON.stringify({ error: { code, message } }), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

/** 서버가 거절 응답 하나를 주고, 그 실패가 호출부까지 온 것. */
async function rejectedWith(
  fetchMock: ReturnType<typeof vi.fn>,
  response: Response,
  call: () => Promise<unknown>
): Promise<AdminApiError> {
  fetchMock.mockResolvedValueOnce(response);
  const failure = await call().catch((error: unknown) => error);
  expect(failure, "거절은 AdminApiError로 온다").toBeInstanceOf(AdminApiError);
  return failure as AdminApiError;
}

describe("어드민 토큰 거절 분기 — 오늘 거동 고정", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    // 쓰기 경로가 읽는 비-HttpOnly CSRF 쿠키(세션 쿠키는 HttpOnly라 JS에 보이지 않는다).
    vi.stubGlobal("document", { cookie: "admin_csrf=csrf-token-123" });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  /**
   * ① 401 `ADMIN_UNAUTHORIZED` — 세션 쿠키가 만료됐거나, 무효이거나, 다른 기기에서
   * 폐기됐을 때 가드가 내는 단 하나의 401이다(`admin-auth.guard.ts`).
   *
   * ⚠️ 오늘 이 판정은 **엔드포인트를 가리지 않는다** — 조회·쓰기·세션 확인이 같은 값을 낸다.
   * 화면 열다섯 자리는 그 참을 받아 `clearSession()`으로 간다.
   */
  it("401 ADMIN_UNAUTHORIZED는 조회·쓰기·세션 확인 어디서 와도 세션 만료로 분류된다", async () => {
    for (const [name, call] of [
      ["adminMe", () => adminMe()],
      ["getAdminDashboardSummary", () => getAdminDashboardSummary()],
      ["listAdminUsers", () => listAdminUsers()],
      ["listAuditLogs", () => listAuditLogs()],
      ["lookupAdminEndUsers", () => lookupAdminEndUsers("hello@example.com")],
      ["updateItemTemplate", () => updateItemTemplate("template-1", { active: false })],
      ["updateDisclosure", () => updateDisclosure("affiliate_notice", "고지 문구")]
    ] as const) {
      const failure = await rejectedWith(
        fetchMock,
        errorResponse(401, "ADMIN_UNAUTHORIZED", "Admin access is required."),
        call
      );

      expect(failure.status, name).toBe(401);
      expect(failure.code, name).toBe("ADMIN_UNAUTHORIZED");
      expect(failure.message, name).toBe("Admin access is required.");
      // 오늘의 본체: 세션 만료 판정은 401 하나로 갈린다.
      expect(isAuthError(failure), `${name}: 401은 세션 만료다`).toBe(true);
      expect(isTimeoutError(failure), name).toBe(false);
      expect(isSelfUpdateForbiddenError(failure), name).toBe(false);
    }
  });

  /**
   * ② 봉투 없는 401. 리버스 프록시·게이트웨이가 본문 없이(또는 HTML로) 401을 돌려주는
   * 경우다. `request()`는 그때 자기 폴백 문장을 싣고, **세션 만료 판정은 그대로 참**이다.
   */
  it("본문 없는 401도 세션 만료다 — 문장만 admin-api의 폴백으로 바뀐다", async () => {
    fetchMock.mockResolvedValueOnce(new Response("", { status: 401 }));
    const failure = (await adminMe().catch((error: unknown) => error)) as AdminApiError;

    expect(failure).toBeInstanceOf(AdminApiError);
    expect(failure.status).toBe(401);
    expect(failure.code).toBeUndefined();
    expect(failure.message).toBe("요청을 처리하지 못했어요. 잠시 후 다시 시도해 주세요.");
    expect(isAuthError(failure)).toBe(true);
  });

  /**
   * ③ 401이 **화면 한 벌에 닿았을 때**의 값. 오늘 열여섯 자리는 401을 첫 갈래에서
   * 가로채므로 이 값은 화면에 서지 않는다 — 그러나 그 첫 갈래가 사라지는 날 운영자가
   * 무엇을 보게 되는지는 **오늘 이미 정해져 있다**. 그 값을 여기 고정한다.
   *
   * ⚠️ **두 시점**(라운드 107 트랙 J). 이 특성화가 처음 잰 값은 *"조회는 영문 서버 문장,
   * 쓰기는 화면 폴백"* 이었고 **그때 그것이 실측이었다**: 쓰기 한 벌에만 한글 가드가 있어
   * 두 한 벌의 판정이 갈렸다. 그 갈림 자체가 이 라운드가 고친 결함이라
   * (`load-error-copy.ts`가 이제 같은 술어를 부른다) 이제 **둘 다 화면별 폴백**이다.
   * 종전 값은 이 문단이 지킨다 — 지우지 않는다.
   */
  it("401이 조회·쓰기 한 벌에 닿으면 — 이제 둘 다 화면 폴백이다(종전에는 조회만 영문이었다)", async () => {
    const failure = await rejectedWith(
      fetchMock,
      errorResponse(401, "ADMIN_UNAUTHORIZED", "Admin access is required."),
      () => getAdminDashboardSummary()
    );

    const copy = loadErrorCopy(failure, "요약을 불러오지 못했어요.");
    // 갈래는 그대로 "server"다 — 서버가 답을 주긴 했다(바뀐 것은 **문장**뿐이다).
    expect(copy.reason).toBe("server");
    expect(copy.message).toBe("요약을 불러오지 못했어요.");
    expect(copy.canRetry).toBe(false);

    expect(writeErrorMessage(failure, "저장하지 못했어요. 다시 시도해 주세요.")).toBe(
      "저장하지 못했어요. 다시 시도해 주세요."
    );
  });

  /**
   * ④ 403 `ADMIN_MFA_SETUP_REQUIRED` — MFA 미등록 관리자가 MFA 면제가 아닌 라우트를 쳤을 때.
   * 세션은 살아 있으므로 로그아웃 갈래가 아니고, 서버 문장이 한국어라 조회·쓰기 양쪽에서
   * 그대로 선다. [다시 시도]는 서지 않는다(다시 눌러도 같은 403이다).
   */
  it("403 ADMIN_MFA_SETUP_REQUIRED는 로그아웃이 아니고, 서버 문장이 그대로 선다", async () => {
    const failure = await rejectedWith(
      fetchMock,
      errorResponse(403, "ADMIN_MFA_SETUP_REQUIRED", "먼저 2단계 인증(MFA)을 등록해주세요."),
      () => getAdminDashboardSummary()
    );

    expect(failure.status).toBe(403);
    expect(isAuthError(failure)).toBe(false);
    expect(isSelfUpdateForbiddenError(failure)).toBe(false);

    const copy = loadErrorCopy(failure, "요약을 불러오지 못했어요.");
    expect(copy.reason).toBe("server");
    expect(copy.message).toBe("먼저 2단계 인증(MFA)을 등록해주세요.");
    expect(copy.canRetry).toBe(false);
    expect(writeErrorMessage(failure, "저장하지 못했어요. 다시 시도해 주세요.")).toBe(
      "먼저 2단계 인증(MFA)을 등록해주세요."
    );
  });

  /**
   * ⑤ 403 `ADMIN_FORBIDDEN` — 역할이 모자란 계정(또는 세션 캐시가 옛 역할을 들고 있는 계정)이
   * admin 전용 라우트를 쳤을 때. **서버 문장이 영문이다**(응답 계약이라 그 문장은 그대로다).
   *
   * ⚠️ **두 시점**(라운드 107 트랙 J). 이 자리가 처음 잰 값은 *"조회 한 벌에서 영문 문장이
   * 그대로 선다"* 였고 **그때 그것이 실측이었다** — 쓰기 한 벌에만 한글 가드가 있었다.
   * 그 비대칭이 이 라운드의 과제였고(도달 경로: 다른 관리자가 역할을 강등한 뒤 클라이언트
   * 세션 캐시가 옛 역할을 들고 있는 동안의 GET), 이제 조회 한 벌도 같은 술어를 부른다.
   * 그래서 **한국어 화면에 서는 것은 그 화면의 종전 폴백**이다.
   *
   * ⚠️ 사유가 사라진 것이 아니라 **읽을 수 없는 사유를 세우지 않는 것**이다: 상태 코드와
   * 코드는 아래처럼 그대로 손에 있고, `canRetry === false`도 그대로라 [다시 시도]는 서지
   * 않는다(다시 눌러도 같은 403이다).
   */
  it("403 ADMIN_FORBIDDEN(권한 부족)의 영문 문장은 이제 조회 한 벌에서도 서지 않는다", async () => {
    const failure = await rejectedWith(
      fetchMock,
      errorResponse(403, "ADMIN_FORBIDDEN", "Admin access is required."),
      () => listAuditLogs()
    );

    expect(failure.status).toBe(403);
    expect(failure.code).toBe("ADMIN_FORBIDDEN");
    // 권한 부족은 세션 만료가 아니다 — 로그아웃 갈래로 새지 않는다.
    expect(isAuthError(failure)).toBe(false);

    const copy = loadErrorCopy(failure, "감사 로그를 불러오지 못했어요.");
    expect(copy.reason).toBe("server");
    expect(copy.message).toBe("감사 로그를 불러오지 못했어요.");
    expect(copy.canRetry).toBe(false);

    // 쓰기 쪽은 종전부터 같은 문장을 화면에 세우지 않았다(라운드 76 리뷰 M-1의 그 겹).
    expect(writeErrorMessage(failure, "저장하지 못했어요. 다시 시도해 주세요.")).toBe(
      "저장하지 못했어요. 다시 시도해 주세요."
    );
  });

  /**
   * ⑥ 403 `ADMIN_CSRF_INVALID` — 이중 제출 CSRF 검사가 어긋났을 때(헤더가 없거나 값이 다르다).
   *
   * ⚠️ 오늘 거동의 어긋남을 값으로 남긴다: **서버 문장은 "다시 시도해주세요"라고 말하는데
   * 판정은 `canRetry === false`라 [다시 시도] 버튼이 서지 않는다.**
   */
  it("403 ADMIN_CSRF_INVALID — 문장은 재시도를 권하지만 판정은 재시도 불가다", async () => {
    const failure = await rejectedWith(
      fetchMock,
      errorResponse(403, "ADMIN_CSRF_INVALID", "요청을 다시 시도해주세요."),
      () => updateDisclosure("affiliate_notice", "고지 문구")
    );

    expect(failure.status).toBe(403);
    expect(isAuthError(failure)).toBe(false);
    expect(writeErrorMessage(failure, "저장하지 못했어요. 다시 시도해 주세요.")).toBe("요청을 다시 시도해주세요.");
    expect(loadErrorCopy(failure, "불러오지 못했어요.").canRetry).toBe(false);
  });

  /**
   * ⑦ CSRF 쿠키가 없으면 클라이언트는 **헤더 자체를 보내지 않는다**(조용히 생략한다).
   * 그 요청은 서버에서 ⑥의 403이 되고, 쿠키가 돌아오기 전까지 몇 번을 눌러도 같은 답이다.
   * 이 자리가 오늘 어드민에서 CSRF 403이 나는 유일한 클라이언트 쪽 원인이다.
   */
  it("admin_csrf 쿠키가 없으면 쓰기 요청에 X-CSRF-Token 헤더가 아예 붙지 않는다", async () => {
    vi.stubGlobal("document", { cookie: "other=1" });
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ key: "k", text: "t" }), { status: 200 }));

    await updateDisclosure("affiliate_notice", "고지 문구");

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit & { headers: Record<string, string> }];
    expect(init.method).toBe("PUT");
    expect(Object.keys(init.headers)).not.toContain("X-CSRF-Token");
    expect(init.headers["X-CSRF-Token"]).toBeUndefined();
  });

  /**
   * ⑧ 403 `ADMIN_SELF_UPDATE_FORBIDDEN` — 본인 계정 강등/비활성화. 403 넷 가운데 유일하게
   * 화면이 **자기 문장**으로 갈아 끼우는 자리이고(관리자 계정 화면), 세션 만료가 아니다.
   */
  it("403 ADMIN_SELF_UPDATE_FORBIDDEN은 자기 판정으로 갈리고 로그아웃이 아니다", async () => {
    const failure = await rejectedWith(
      fetchMock,
      errorResponse(403, "ADMIN_SELF_UPDATE_FORBIDDEN", "자기 자신의 권한 강등이나 비활성화는 할 수 없어요."),
      () => updateAdminUser("9b2e8a76-1234-4cde-8f00-aabbccddeeff", { role: "analyst" })
    );

    expect(isSelfUpdateForbiddenError(failure)).toBe(true);
    expect(isAuthError(failure)).toBe(false);
  });

  /**
   * ⑨ **로그인·인증 실패의 401도 오늘은 "세션 만료"와 같은 값을 낸다.**
   *
   * 서버는 자격 증명 실패(`ADMIN_LOGIN_FAILED`), MFA 토큰 만료(`ADMIN_MFA_TOKEN_INVALID`),
   * 인증 코드 오류(`ADMIN_MFA_INVALID`), 현재 비밀번호 오류(`ADMIN_PASSWORD_INVALID`)에도
   * 401을 쓴다. `isAuthError`는 상태 코드 하나로 갈리므로 이 넷도 **참**이다.
   *
   * 오늘 이것이 해를 끼치지 않는 이유는 그 네 자리(로그인 폼·MFA 폼·비밀번호 변경 폼·MFA
   * 해제 폼)가 `isAuthError`를 **부르지 않고** 서버 문장을 그대로 세우기 때문이다 —
   * 판정이 안전해서가 아니라 **호출부가 그 판정을 쓰지 않아서**다. 그 사실을 고정한다.
   */
  it("로그인·MFA·비밀번호 401 넷도 isAuthError가 참이다 — 오늘은 그 판정을 부르는 자리가 없다", async () => {
    for (const [name, response, call, sentence] of [
      [
        "adminLogin",
        errorResponse(401, "ADMIN_LOGIN_FAILED", "이메일 또는 비밀번호를 다시 확인해주세요."),
        () => adminLogin("ops@example.com", "wrong-password"),
        "이메일 또는 비밀번호를 다시 확인해주세요."
      ],
      [
        "adminVerifyMfaLogin",
        errorResponse(401, "ADMIN_MFA_TOKEN_INVALID", "다시 로그인해주세요."),
        () => adminVerifyMfaLogin("expired-mfa-token", "123456"),
        "다시 로그인해주세요."
      ],
      [
        "adminMfaDisable",
        errorResponse(401, "ADMIN_MFA_INVALID", "인증 코드를 다시 확인해주세요."),
        () => adminMfaDisable("000000"),
        "인증 코드를 다시 확인해주세요."
      ],
      [
        "adminChangePassword",
        errorResponse(401, "ADMIN_PASSWORD_INVALID", "현재 비밀번호를 다시 확인해주세요."),
        () => adminChangePassword("wrong-current", "new-password-1234"),
        "현재 비밀번호를 다시 확인해주세요."
      ]
    ] as const) {
      const failure = await rejectedWith(fetchMock, response, call);
      expect(failure.status, name).toBe(401);
      expect(failure.message, name).toBe(sentence);
      // ⚠️ 세션이 멀쩡한데도 "세션 만료"와 같은 값이 나온다.
      expect(isAuthError(failure), `${name}: 상태 코드 하나로 갈린다`).toBe(true);
    }
  });

  /**
   * ⑩ 이미 죽은 세션에서 로그아웃을 눌렀을 때. `adminLogout()`은 **예외로 끝난다** —
   * 셸의 두 자리(로그아웃 버튼 · "다른 계정으로 로그인")가 그 예외를 삼키고 `finally`에서
   * 클라이언트 세션 캐시를 지우는 것이 운영자가 갇히지 않는 이유다.
   */
  it("죽은 세션의 로그아웃 호출은 401로 거절된다 — 셸이 삼키는 그 예외다", async () => {
    const failure = await rejectedWith(
      fetchMock,
      errorResponse(401, "ADMIN_UNAUTHORIZED", "Admin access is required."),
      () => adminLogout()
    );

    expect(failure.status).toBe(401);
    expect(isAuthError(failure)).toBe(true);
  });

  /**
   * ⑪ MFA 등록 관문의 조회(`adminMfaSetupStart`)에서 온 401. 이 자리는 어드민에서 401을
   * **조회 실패 한 벌보다 먼저** 가로채는 열여섯 번째 자리이고, 그래서 이 값이 중요하다:
   * 401이면 `loadErrorCopy`가 만들 [다시 시도] 배너가 아니라 로그인 화면으로 가야 한다.
   */
  it("MFA 등록 관문의 401도 세션 만료다 — 재시도 배너가 아니라 로그아웃 갈래다", async () => {
    const failure = await rejectedWith(
      fetchMock,
      errorResponse(401, "ADMIN_UNAUTHORIZED", "Admin access is required."),
      () => adminMfaSetupStart()
    );

    expect(isAuthError(failure)).toBe(true);
    // 만약 이 자리에 로그아웃 갈래가 없다면 운영자가 보게 될 값(오늘은 닿지 않는다).
    expect(loadErrorCopy(failure, "MFA 등록 정보를 불러오지 못했어요.").canRetry).toBe(false);
  });

  /**
   * ⑫ **거절이 아닌 실패는 로그아웃 갈래로 새지 않는다** — 오늘 이 경계가 지켜지는지
   * 반대편에서 한 번 더 잰다(연결 실패 · 5xx). 세션이 멀쩡한 운영자를 네트워크 한 번으로
   * 로그인 화면에 떨구지 않는 것이 이 경계의 값이다.
   */
  it("연결 실패와 5xx는 세션 만료가 아니다 — 조회 한 벌이 [다시 시도]를 세운다", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    const offline = (await getAdminDashboardSummary().catch((error: unknown) => error)) as AdminApiError;
    expect(isAuthError(offline)).toBe(false);
    expect(offline.status).toBe(0);
    expect(loadErrorCopy(offline, "요약을 불러오지 못했어요.").canRetry).toBe(true);

    const serverDown = await rejectedWith(
      fetchMock,
      errorResponse(503, "SERVICE_UNAVAILABLE", "잠시 후 다시 시도해 주세요."),
      () => getAdminDashboardSummary()
    );
    expect(isAuthError(serverDown)).toBe(false);
    expect(loadErrorCopy(serverDown, "요약을 불러오지 못했어요.").canRetry).toBe(true);
  });
});
