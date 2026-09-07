import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { AdminApiError, AdminApiTimeoutError } from "./admin-api";
import { loadErrorCopy, loadErrorMessage } from "./load-error-copy";
import { adminLoginScreenNotice } from "./session-end-copy";
import { writeErrorMessage } from "./write-error-copy";

/**
 * 라운드 107 트랙 J — **어드민이 세션에 대해 말하기 시작한 자리의 계약.**
 *
 * 라운드 107 트랙 I의 특성화(`src/lib/admin-auth-rejection.test.ts`)가 잰 피해 셋이 이 파일의
 * 축이다. 그 파일은 **오늘 거동을 고정하는** 자였고, 이 파일은 **바뀐 거동을 고정하는** 자다.
 *
 *  ⓐ 401이 아무 말도 하지 않았다 — 서른 자리가 `clearSession(); return;` 뿐이라 사용자에게
 *    나가는 문장이 0건이었다. 이제 이유가 `lastEndReason`으로 로그인 화면까지 온다.
 *  ⓑ 권한 부족 403이 한국어 화면에 영문을 세웠다 — 쓰기 한 벌에만 있던 한글 가드를
 *    조회 한 벌도 갖는다. ⚠️ 두 한 벌은 서로를 **부르지 않는다**(저장소가 그 무접촉을 계약으로
 *    들고 있다 — `src/admin-write-error-copy.test.ts`), 그래서 재료는 사본 둘이고 아래 ⓑ의
 *    마지막 단언이 그 둘이 갈리지 않는지 문다.
 *  ⓒ `AdminTokenProvider.refresh()`의 `catch {}`가 모든 실패를 로그아웃으로 접었다 —
 *    이제 401과 그 밖이 갈린다.
 *
 * ⚠️ **래칭(트랙 I ⑨)이 이 파일의 넷째 축이다.** 로그인 실패·MFA 코드 오류·현재 비밀번호
 * 오류의 401 넷은 `isAuthError`에서 세션 만료와 **한 값**이고, 오늘 무해한 이유는 그 폼들이
 * 그 판정을 부르지 않아서일 뿐이다. ⓐ의 배선이 그 넷 중 하나라도 새 채널에 태우면
 * "비밀번호 오타 → 강제 로그아웃 + 만료 안내"가 된다. 아래 ⓓ가 그 넷을 값으로 문다.
 *
 * ⚠️ **이 파일이 잡지 못하는 것**(사각을 먼저 적는다). 어드민에는 DOM 테스트 환경이 없다
 * (jsdom · @testing-library가 저장소에 0건이고 vitest는 node 환경으로 돈다). 그래서
 * *"만료 뒤 실제로 그 문장이 화면에 그려지는가"* 는 여기서 잴 수 없다 — 순수 함수의 값과
 * **소스 구조 계약**으로만 잡는다(어드민의 다른 계약들이 이미 쓰는 그 형식).
 */

const adminRoot = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(join(adminRoot, relativePath), "utf8");
}

/**
 * 주석을 걷은 코드만.
 *
 * ⚠️ 이 파일에는 이 형식이 **필요하다**: 아래 ⓓ가 무는 것은 *"이 컴포넌트가 401 판정을
 * 부르지 않는다"* 인데, 같은 컴포넌트의 머리말이 그 사실을 **설명하느라** 같은 이름을
 * 인용한다. 원문을 그대로 보면 인용 때문에 빨개지고, 그것을 피하려고 인용을 지우면
 * 근거가 사라진다 — 옆 계약들이 이미 고른 답이 이것이다(주석을 걷고 코드를 문다).
 */
function codeOnly(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/[^\n]*/g, " ");
}

const SHELL_PATH = "src/components/AdminShell.tsx";
const CONTEXT_PATH = "src/lib/admin-token-context.tsx";

/**
 * 화면 소스가 사는 두 뿌리(조회 한 벌의 스윕 범위와 같다 — `load-error-copy.ts` 머리말).
 *
 * ⚠️ **손 목록이 아니라 전수 파생이다.** 이 파일의 첫 초안은 열세 경로를 손으로 적었는데,
 * `src/admin-load-error-copy.test.ts`의 `self-file-only` 문단이 새 계약 파일마다 요구하는
 * 질문(*"그 파일도 손 목록을 지녔는가"*)의 답이 그때 **예**였다. 손 목록은 새 화면이 붙는
 * 날 조용하다 — 그 화면이 `clearSession()`을 어떻게 부르든 목록 밖이라 아래 ⓔ가 보지
 * 못한다. 그래서 뿌리 둘을 걷는 파생으로 바꿨고, 지금 이 파일의 손 목록은 **0건**이다.
 */
function screenFiles(): string[] {
  const found: string[] = [];
  const walk = (relativeDir: string): void => {
    for (const entry of readdirSync(join(adminRoot, relativeDir), { withFileTypes: true })) {
      if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
      const relativePath = `${relativeDir}/${entry.name}`;
      if (entry.isDirectory()) {
        walk(relativePath);
        continue;
      }
      if (entry.name.endsWith(".tsx")) found.push(relativePath);
    }
  };
  walk("app");
  walk("src/components");
  return found.sort();
}

/**
 * `header`로 시작하는 함수의 몸통을 중괄호 짝으로 떠낸다.
 *
 * ⚠️ 이름이 겹치는 자리를 위해 **머리 문자열 전체**를 받는다 — 셸에는 `handleSubmit`이 둘이라
 * (비밀번호 변경 폼 · MFA 해제 폼) 이름만으로는 어느 쪽인지 갈리지 않는다. 그래서 아래
 * ⓓ는 함수가 아니라 **컴포넌트 하나씩**을 떠낸다.
 */
function bodyOf(source: string, header: string): string {
  const start = source.indexOf(header);
  expect(start, `${header}를 찾지 못했어요`).toBeGreaterThanOrEqual(0);
  let index = source.indexOf("{", start);
  expect(index, `${header}의 몸통 여는 괄호를 찾지 못했어요`).toBeGreaterThan(start);
  let depth = 0;
  for (let cursor = index; cursor < source.length; cursor += 1) {
    if (source[cursor] === "{") depth += 1;
    if (source[cursor] === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(index, cursor + 1);
    }
  }
  throw new Error(`${header}의 몸통이 닫히지 않았어요`);
}

describe("ⓐ 세션이 끝난 이유가 문장 하나가 된다 (라운드 107 트랙 J)", () => {
  it("서버가 토큰을 거절했으면 무엇이 일어났고 무엇을 잃었고 다음에 무엇을 하는지 말한다", () => {
    const notice = adminLoginScreenNotice({ endReason: "rejected", sessionCheckFailed: false });
    expect(notice).toEqual({
      message:
        "세션이 만료됐거나 다른 곳에서 해제돼 로그인 화면으로 돌아왔어요. " +
        "저장하지 않은 입력은 남아 있지 않으니, 다시 로그인한 뒤 이어서 작업해 주세요.",
      canRetry: false
    });
  });

  /**
   * ⚠️ 이 부정 단언이 값이다. 모바일의 같은 자리 문장은 *"다시 로그인하면 저장하지 않은
   * 기록도 이어서 반영할게요"* 인데(아웃박스가 있어 참이다), 어드민에는 아웃박스가 없고 폼
   * 값은 컴포넌트가 언마운트되는 순간 사라진다 — 그 문장을 베끼면 지키지 못할 약속이 된다.
   * 이 라운드는 값 보존을 하지 않았으므로, 문장도 보존을 약속하지 않는다.
   */
  it("잃은 것을 숨기지도, 되찾아 준다고 약속하지도 않는다", () => {
    const message = (adminLoginScreenNotice({ endReason: "rejected", sessionCheckFailed: false } ) as {
      message: string;
    }).message;
    expect(message, "잃은 것을 말하지 않는다").toContain("저장하지 않은 입력은 남아 있지 않으니");
    expect(message, "지키지 못할 약속을 했다").not.toContain("이어서 반영");
    expect(message, "복구를 약속했다").not.toContain("복구");
  });

  it("스스로 누른 로그아웃에는 아무 말도 하지 않는다", () => {
    expect(adminLoginScreenNotice({ endReason: "logout", sessionCheckFailed: false })).toBeNull();
    // 처음 여는 사람에게도 마찬가지다(이유가 아직 없다).
    expect(adminLoginScreenNotice({ endReason: null, sessionCheckFailed: false })).toBeNull();
  });

  it("로그인 화면이 그 값을 읽어 세우고, 판정 재료는 세션 컨텍스트의 두 값뿐이다", () => {
    const shell = readSource(SHELL_PATH);
    expect(shell).toContain("const sessionNotice = adminLoginScreenNotice({ endReason: lastEndReason, sessionCheckFailed });");
    expect(shell).toContain("{sessionNotice.message}");
    // 문구를 화면이 짓지 않는다 — 문장은 session-end-copy.ts 한 자리에서 온다.
    expect(codeOnly(shell), "셸이 만료 문장을 손으로 적었어요").not.toContain("로그인 화면으로 돌아왔어요");
  });
});

describe("ⓑ 읽을 수 없는 서버 문장은 조회 한 벌에서도 화면에 서지 않는다", () => {
  const FORBIDDEN = "Admin access is required.";

  it("권한 부족 403의 영문 문장은 그 화면의 종전 폴백으로 물러선다", () => {
    const copy = loadErrorCopy(new AdminApiError(403, FORBIDDEN, "ADMIN_FORBIDDEN"), "감사 로그를 불러오지 못했어요.");
    expect(copy.message).toBe("감사 로그를 불러오지 못했어요.");
    // 갈래와 재시도 판정은 손대지 않았다 — 바뀐 것은 **문장**뿐이다.
    expect(copy.reason).toBe("server");
    expect(copy.canRetry).toBe(false);
  });

  it("한글이 한 자라도 있으면 서버 문장이 그대로 선다", () => {
    const copy = loadErrorCopy(
      new AdminApiError(400, "행위자 ID는 UUID여야 해요.", "VALIDATION_FAILED"),
      "감사 로그를 불러오지 못했어요."
    );
    expect(copy.message).toBe("행위자 ID는 UUID여야 해요.");
    // 라틴 문자·숫자가 섞인 한국어도 그대로다(코드도 상태도 보지 않는 소비 규칙이다).
    expect(
      loadErrorCopy(new AdminApiError(409, "이미 게시된 초안이에요(revision 12).", "X"), "폴백").message
    ).toBe("이미 게시된 초안이에요(revision 12).");
  });

  it("프록시·게이트웨이가 낸 영문도 같은 갈래로 간다", () => {
    expect(loadErrorCopy(new AdminApiError(502, "Bad Gateway"), "요약을 불러오지 못했어요.").message).toBe(
      "요약을 불러오지 못했어요."
    );
  });

  /**
   * ⚠️ **사본 둘의 드리프트를 여기가 문다.**
   *
   * 두 한 벌은 같은 재료(한글 음절 범위)를 각자 적는다 — 합치지 않은 것이 아니라 **합칠 수
   * 없다**: 조회 한 벌이 쓰기 한 벌의 이름을 지니는 순간 저장소의 무접촉 계약이 빨개지고
   * (`src/admin-write-error-copy.test.ts`), 그 단언의 바이트는 `packages/test-utils`의 주석
   * 관용 앵커 대장이 면제의 증명으로 들고 있다. 사본을 없애는 것 다음으로 옳은 손은 **사본이
   * 조용히 갈리지 못하게 하는 것**이고, 이 단언이 그 자리다 — 어느 한쪽만 고치면 빨개진다.
   */
  it("조회와 쓰기의 사본 둘이 같은 문장에 같은 답을 낸다 (드리프트 감지)", () => {
    for (const message of [FORBIDDEN, "Bad Gateway", "Service Unavailable", "저장하지 못했어요."]) {
      const error = new AdminApiError(403, message);
      const readKept = loadErrorCopy(error, "조회 폴백").message === message;
      const writeKept = writeErrorMessage(error, "쓰기 폴백") === message;
      expect(readKept, `"${message}": 조회와 쓰기의 판정이 갈렸어요`).toBe(writeKept);
    }
  });
});

describe("ⓒ 세션 확인 실패는 로그아웃이 아니다", () => {
  it("401이 아닌 실패에는 모른다고 말하고 [다시 시도]를 연다", () => {
    expect(adminLoginScreenNotice({ endReason: null, sessionCheckFailed: true })).toEqual({
      message:
        "로그인 상태를 확인하지 못했어요. 로그아웃된 것인지 서버에 닿지 못한 것인지 아직 알 수 없어요. " +
        "다시 시도하거나, 아래에서 로그인해 주세요.",
      canRetry: true
    });
  });

  it("더 나중의 사실이 먼저 선다 — 확인 실패가 지난 거절을 덮는다", () => {
    const notice = adminLoginScreenNotice({ endReason: "rejected", sessionCheckFailed: true });
    expect(notice?.canRetry, "확인 실패 갈래가 아니에요").toBe(true);
  });

  it("refresh()가 401과 그 밖을 가르고, 그 밖에서는 세션을 버리지 않는다", () => {
    const refresh = bodyOf(readSource(CONTEXT_PATH), "const refresh = useCallback(async () =>");
    const auth = refresh.indexOf("isAuthError(error)");
    expect(auth, "refresh에 401 갈래가 없어요").toBeGreaterThanOrEqual(0);
    // 401: 종전 그대로 세션 캐시를 비운다.
    expect(refresh.slice(auth)).toContain("setSessionState(null);");
    // 그 밖: 확인 실패만 세우고 세션은 손대지 않는다.
    expect(refresh).toContain("setSessionCheckFailed(true);");
    expect(
      (refresh.match(/setSessionState\(null\)/g) ?? []).length,
      "세션을 버리는 자리가 401 갈래 말고 또 있어요"
    ).toBe(1);
    // ⚠️ 401에는 이유를 적지 않는다 — 처음 오는 사람과 구별되지 않기 때문이다.
    expect(codeOnly(refresh), "refresh가 401에 이유를 적었어요").not.toContain("setLastEndReason(\"");
  });

  it("로그인 화면의 [다시 시도]가 그 확인을 다시 돌린다", () => {
    const shell = readSource(SHELL_PATH);
    expect(shell).toContain("{sessionNotice.canRetry ? (");
    expect(bodyOf(shell, "function LoginScreen()")).toContain("onClick={() => void refresh()}");
  });
});

describe("ⓓ 래칭 — 로그인·MFA·비밀번호의 401 넷은 새 채널을 타지 않는다", () => {
  /**
   * 트랙 I ⑨가 고정한 사실: 서버는 자격 증명 실패(`ADMIN_LOGIN_FAILED`) · MFA 토큰 만료
   * (`ADMIN_MFA_TOKEN_INVALID`) · 인증 코드 오류(`ADMIN_MFA_INVALID`) · 현재 비밀번호 오류
   * (`ADMIN_PASSWORD_INVALID`)에도 **401**을 쓰고, `isAuthError`는 상태 코드 하나로 갈리므로
   * 그 넷도 참이다. 그 넷이 오늘 무해한 이유는 **호출부가 그 판정을 쓰지 않아서**다.
   *
   * ⚠️ 그 사실이 이 라운드 뒤에도 참인지 값으로 확인한다. 이유 채널에 값을 쓰는 길은 둘뿐이고
   * (`clearSession(...)` · `refresh()`의 catch), 아래 세 컴포넌트가 그 둘 중 어느 것도 부르지
   * 않으면 네 폼의 401은 새 채널에 닿지 못한다.
   */
  const FORM_COMPONENTS = [
    { header: "function LoginScreen()", forms: "로그인 폼 · 2단계 인증 폼" },
    { header: "function ChangePasswordForm(", forms: "비밀번호 변경 폼" },
    { header: "function MfaDisableForm(", forms: "인증 앱 재등록(MFA 해제) 폼" }
  ] as const;

  it("네 폼이 사는 컴포넌트 셋 어디에도 세션을 지우는 자리가 없다", () => {
    const shell = readSource(SHELL_PATH);
    for (const { header, forms } of FORM_COMPONENTS) {
      const body = codeOnly(bodyOf(shell, header));
      expect(body, `${forms}: 401 판정을 부르기 시작했어요`).not.toContain("isAuthError");
      expect(body, `${forms}: 세션을 지우기 시작했어요`).not.toContain("clearSession");
    }
  });

  /**
   * ⚠️ `LoginScreen`은 이 라운드에서 이유 채널을 **읽기** 시작했다(그것이 ⓐ의 배선이다).
   * 읽는 것과 쓰는 것을 가르는 자리가 여기다: 로그인 시도의 실패는 종전 그대로 자기
   * 상태(`submitError`·`mfaError`)에 서버 문장을 세우고 끝난다.
   */
  it("로그인 시도의 실패는 종전 그대로 자기 자리에 선다", () => {
    const login = bodyOf(readSource(SHELL_PATH), "function LoginScreen()");
    expect(login).toContain(
      'setSubmitError(error instanceof AdminApiError ? error.message : "로그인하지 못했어요. 다시 시도해 주세요.");'
    );
    expect(login).toContain(
      'setMfaError(error instanceof AdminApiError ? error.message : "인증하지 못했어요. 다시 시도해 주세요.");'
    );
    // 그리고 그 두 자리는 이유 채널을 건드리지 않는다.
    expect(codeOnly(login), "로그인 실패가 이유 채널에 값을 썼어요").not.toContain("setLastEndReason");
  });

  it("네 폼이 부르는 API 넷은 세션 컨텍스트를 거치지 않는다", () => {
    const context = readSource(CONTEXT_PATH);
    // 컨텍스트가 부르는 API는 세션 확인 하나뿐이다 — 로그인·MFA·비밀번호는 폼이 직접 부른다.
    for (const call of ["adminLogin", "adminVerifyMfaLogin", "adminMfaDisable", "adminChangePassword"]) {
      expect(codeOnly(context), `${call}이 세션 컨텍스트로 들어왔어요`).not.toContain(call);
    }
    expect(context).toContain("adminMe()");
  });
});

describe("ⓔ 이유의 기본값과 그 예외 둘", () => {
  /** 모든 화면 소스에서 `clearSession(` 호출을 그 인자와 함께 걷는다(손 목록이 아니다). */
  function clearSessionCalls(): { file: string; argument: string }[] {
    const found: { file: string; argument: string }[] = [];
    for (const file of screenFiles()) {
      const source = readSource(file);
      for (const match of source.matchAll(/clearSession\(([^)]*)\)/g)) {
        found.push({ file, argument: match[1] });
      }
    }
    return found;
  }

  it("모집단이 유령이 아니다 — 화면 소스 뿌리 둘이 실재한다", () => {
    const files = screenFiles();
    // 라우트 진입 열하나 + 오류·404·global-error·layout + 셸과 대량 교체 패널.
    expect(files.length, "화면 소스 수").toBeGreaterThanOrEqual(17);
    expect(files, "셸이 모집단 밖으로 나갔어요").toContain(SHELL_PATH);
    expect(files).toContain("app/disclosures/page.tsx");
  });

  it("이유를 명시하는 자리는 스스로 누른 로그아웃 둘뿐이고, 둘 다 셸에 산다", () => {
    const explicit = clearSessionCalls().filter((call) => call.argument !== "");
    expect(explicit).toEqual([
      { file: SHELL_PATH, argument: '"logout"' },
      { file: SHELL_PATH, argument: '"logout"' }
    ]);
  });

  /**
   * ⚠️ **그 둘이 인자를 잃으면 자기가 누른 로그아웃에 만료 안내가 선다.** 그래서 두 자리가
   * 실제로 서버 로그아웃 뒤의 `finally`인지까지 본다 — 인자만 세면 다른 자리로 옮겨 붙어도
   * 조용하다.
   */
  it("그 둘은 서버 로그아웃을 부른 뒤의 finally다", () => {
    const shell = readSource(SHELL_PATH);
    for (const header of ["const switchAccount = async () =>", "const handleLogout = async () =>"]) {
      const body = bodyOf(shell, header);
      expect(body, `${header}: 서버 로그아웃을 부르지 않아요`).toContain("await adminLogout();");
      expect(body, `${header}: 이유를 명시하지 않았어요`).toContain('clearSession("logout");');
    }
  });

  it("나머지 자리는 인자 없이 부르고, 기본값이 서버 거절이다", () => {
    const bare = clearSessionCalls().filter((call) => call.argument === "");
    // 서른 자리 — 전부 `isAuthError` 갈래 안이다(그 사실은 조회·쓰기 두 대장이 이미 문다).
    expect(bare.length, "인자 없는 자리 수").toBe(30);
    const context = readSource(CONTEXT_PATH);
    expect(context).toContain('const clearSession = useCallback((reason: AdminSessionEndReason = "rejected") =>');
  });

  /**
   * 고지 문구 화면은 함수 **참조**를 자식에게 넘기고(`onAuthError={clearSession}`) 자식이
   * 인자 없이 부른다 — 그래서 기본값이 그대로 적용된다. 그 자리는 401 갈래 안이라 옳다.
   */
  it("참조로 넘기는 한 자리도 인자 없이 불린다", () => {
    const disclosures = readSource("app/disclosures/page.tsx");
    expect(disclosures).toContain("onAuthError={clearSession}");
    expect(disclosures).toContain("onAuthError();");
    expect(codeOnly(disclosures), "참조를 넘기는 자리가 인자를 실었어요").not.toContain("onAuthError(\"");
  });
});

/**
 * 라운드 111 — **조회 실패의 칸별 사유가 화면 문장 뒤에 붙는다.**
 *
 * ⚠️ 두 시점. 종전(그때는 참): 위 ⓑ가 세운 것은 *"어느 문장을 세우는가"* 하나였고, 그때
 * 조회 한 벌이 나르는 문장은 `error.message` **하나**였다 — 그 자리에 오던 봉투는 전용 코드를
 * 지녔거나(그 `message`가 곧 사유다) 클라이언트가 지은 타임아웃·연결 실패 문장이었다.
 * → 이제 `VALIDATION_ERROR` 갈래가 남는다: 그 봉투의 `message`는 어느 거절이든 **같은 일반
 * 문장**이고 사유는 `details.fields`에만 있다. 쓰기 한 벌은 라운드 110에 그 사유를 일반 문장
 * 뒤에 잇기 시작했고, 조회 한 벌만 오늘까지 버렸다.
 *
 * ⚠️⚠️ **이 겹이 오늘 바꾸는 화면 문장은 0건이다 — 그 사실을 숨기지 않고 값으로 적는다.**
 * 어드민이 부르는 GET 가운데 `details.fields`를 싣는 것은 쿼리 DTO 검증뿐이고 그 사유는 전부
 * class-validator의 **기본 영문 문장**이다(아래 두 리터럴이 그 실측이다 — 검증 파이프에 직접
 * 태워 찍었다). 조회 경로에서 **한국어** 사유를 싣는 자리는 `admin-users-lookup.service.ts`의
 * 최소 길이 거절 하나뿐인데, 그 입력은 화면이 **같은 술어로 먼저 막아**
 * (`user-lookup-view.ts`의 `effectiveQueryLength`) 요청이 나가지 않는다. 그래서 이 절이 무는
 * 것은 대부분 **부정 단언**이다: 영문은 붙지 않는다 · 사유가 없으면 한 바이트도 다르지 않다.
 * 값을 하는 날은 조회 DTO가 한국어 사유를 갖는 날이다(쓰기 DTO는 라운드 110에 이미 그렇게 됐다).
 *
 * ⚠️ **자리 대장은 이 절이 만들지 않는다.** 조회 소비 자리 열여섯의 대장과 그 스윕은
 * `src/admin-load-error-copy.test.ts`가 이미 지고 있고, 이 절이 무는 것은 그 한 벌이 **한
 * 봉투에서 어떤 문장을 만드는가**뿐이다(자리 수도 폴백 바이트도 건드리지 않는다).
 */
describe("ⓕ 400 봉투의 칸별 사유가 조회 문장 뒤에 붙는다 (라운드 111)", () => {
  /** 이 API의 `VALIDATION_ERROR` 봉투 `message` — 어느 거절이든 같은 일반 문장이다. */
  const GENERIC = "요청 값을 다시 확인해주세요.";
  /** 조회 화면의 종전 폴백 하나(app/audit-logs/page.tsx가 한 벌에 넘기는 그 바이트). */
  const AUDIT_FALLBACK = "감사 로그를 불러오지 못했어요.";
  /** 서버가 **조회** 경로에서 짓는 유일한 한국어 사유(admin-users-lookup.service.ts). */
  const LOOKUP_MIN_LENGTH = "검색어는 2자 이상이어야 해요.";
  /**
   * class-validator의 **기본 영문 문장** 둘 — 앞머리가 서버 필드명 그대로다.
   * ⚠️ 지어낸 값이 아니라 실측이다: `createDtoValidationPipe`에 한 자 검색어와 잘못된 감사
   * 로그 필터를 태워 나온 `details.fields[].constraints`의 값이다.
   */
  const ENGLISH_MIN_LENGTH = "query must be longer than or equal to 2 characters";
  const ENGLISH_UUID = "actorUserId must be a UUID";

  const validationError = (reasons: readonly string[], message: string = GENERIC) =>
    new AdminApiError(400, message, "VALIDATION_ERROR", reasons);

  it("한국어 사유는 봉투의 일반 문장 뒤에 순서대로 붙는다", () => {
    const copy = loadErrorCopy(validationError([LOOKUP_MIN_LENGTH]), AUDIT_FALLBACK);
    expect(copy.message).toBe(`${GENERIC} ${LOOKUP_MIN_LENGTH}`);
    // 갈래도 재시도 판정도 종전 그대로다 — 바뀐 것은 **문장**뿐이다(ⓑ와 같은 규율).
    expect(copy.reason).toBe("server");
    expect(copy.canRetry).toBe(false);
  });

  it("영문 사유는 붙지 않는다 — 영문 필드명이 조회 화면에 설 길이 없다", () => {
    const message = loadErrorMessage(validationError([ENGLISH_MIN_LENGTH, ENGLISH_UUID]), AUDIT_FALLBACK);
    expect(message).toBe(GENERIC);
    expect(message).not.toContain("query");
    expect(message).not.toContain("actorUserId");
  });

  it("섞여 오면 한국어만 남는다", () => {
    expect(loadErrorMessage(validationError([ENGLISH_MIN_LENGTH, LOOKUP_MIN_LENGTH]), AUDIT_FALLBACK)).toBe(
      `${GENERIC} ${LOOKUP_MIN_LENGTH}`
    );
  });

  it("영문 봉투 + 한국어 사유면 화면 폴백 뒤에 사유가 붙는다 (한 문장도 잃지 않는다)", () => {
    expect(loadErrorMessage(validationError([LOOKUP_MIN_LENGTH], "Bad Request"), AUDIT_FALLBACK)).toBe(
      `${AUDIT_FALLBACK} ${LOOKUP_MIN_LENGTH}`
    );
  });

  it("봉투 문장과 같은 사유는 두 번 서지 않는다", () => {
    expect(loadErrorMessage(validationError([LOOKUP_MIN_LENGTH], LOOKUP_MIN_LENGTH), AUDIT_FALLBACK)).toBe(
      LOOKUP_MIN_LENGTH
    );
  });

  /**
   * ⚠️ **이 자리가 이 절의 무게 중심이다.** 오늘 조회 경로가 실제로 받는 봉투는 아래 넷이고,
   * 그 넷에서 화면 문장은 **한 바이트도 달라지지 않아야 한다** — 이 겹이 오늘 0건인 이유가
   * 곧 이 단언이다.
   */
  it("사유가 없거나 읽을 수 없으면 네 갈래 전부 종전과 한 바이트도 다르지 않다", () => {
    const readTimeout = new AdminApiTimeoutError(new Error("aborted"), "GET");
    expect(loadErrorMessage(readTimeout, AUDIT_FALLBACK)).toBe(readTimeout.message);
    // 네트워크(status 0) · 서버 한국어 문장 · 그 밖 — 전부 ⓑ가 고정한 값 그대로다.
    expect(loadErrorMessage(new AdminApiError(0, "서버에 연결하지 못했어요.", "CONNECTION_FAILURE"), AUDIT_FALLBACK)).toBe(
      "서버에 연결하지 못했어요."
    );
    expect(loadErrorMessage(new AdminApiError(400, GENERIC, "VALIDATION_ERROR"), AUDIT_FALLBACK)).toBe(GENERIC);
    expect(loadErrorMessage(new TypeError("boom"), AUDIT_FALLBACK)).toBe(AUDIT_FALLBACK);
    // 영문 사유만 실린 봉투도 마찬가지다(오늘 조회 쿼리 DTO가 내는 바로 그 모양).
    expect(loadErrorMessage(validationError([ENGLISH_UUID]), AUDIT_FALLBACK)).toBe(GENERIC);
  });

  it("비검증 실패에는 사유가 붙지 않고 갈래·재시도도 그대로다", () => {
    // 401·403은 화면의 첫 갈래가 가로채지만, 닿았을 때의 값도 종전 그대로여야 한다.
    for (const failure of [
      new AdminApiError(401, "Admin access is required.", "ADMIN_UNAUTHORIZED"),
      new AdminApiError(403, "Admin access is required.", "ADMIN_FORBIDDEN"),
      new AdminApiError(502, "Bad Gateway")
    ]) {
      const copy = loadErrorCopy(failure, AUDIT_FALLBACK);
      expect(copy.message, `${failure.status}: 폴백이 아니에요`).toBe(AUDIT_FALLBACK);
      expect(copy.reason, `${failure.status}: 갈래가 갈렸어요`).toBe("server");
    }
    const timeout = new AdminApiTimeoutError(new Error("aborted"), "GET");
    expect(loadErrorCopy(timeout, AUDIT_FALLBACK).canRetry).toBe(true);
  });

  /**
   * ⚠️ **사본 둘의 드리프트를 여기가 한 겹 더 문다.**
   *
   * ⓑ의 마지막 단언은 **어느 문장을 고르는가**(봉투 `message` ↔ 폴백)에서 두 한 벌이 갈리지
   * 않는지만 잰다 — 그래서 라운드 110이 쓰기 쪽에만 잇기를 세웠을 때 그 자는 **조용했다**.
   * 이 단언이 그 사각을 덮는다: 같은 봉투에 두 한 벌이 **같은 모양**(고른 문장 + 한국어 사유)을
   * 내는가. 어느 한쪽만 고치면 여기가 먼저 빨개진다.
   */
  it("조회와 쓰기의 사본 둘이 같은 봉투에 같은 모양을 낸다 (잇기 드리프트 감지)", () => {
    const reasonSets: readonly (readonly string[])[] = [
      [],
      [LOOKUP_MIN_LENGTH],
      [ENGLISH_MIN_LENGTH],
      [ENGLISH_UUID, LOOKUP_MIN_LENGTH],
      [LOOKUP_MIN_LENGTH, LOOKUP_MIN_LENGTH]
    ];
    for (const reasons of reasonSets) {
      for (const envelope of [GENERIC, "Bad Request"]) {
        const error = validationError(reasons, envelope);
        const label = `${envelope} + [${reasons.join(" | ")}]`;
        // 같은 폴백을 주면 두 한 벌의 답이 **바이트로 같아야** 한다.
        expect(loadErrorMessage(error, AUDIT_FALLBACK), `${label}: 두 한 벌의 문장이 갈렸어요`).toBe(
          writeErrorMessage(error, AUDIT_FALLBACK)
        );
      }
    }
  });
});
