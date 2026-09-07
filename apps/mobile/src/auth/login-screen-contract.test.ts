import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { isAnalyticsEnabled, useAnalyticsConsentStore } from "../analytics/flag";
// 라운드 106 F2: 문구의 단일 소스는 코드 표다 — 이 계약은 문장을 사본으로 적지 않고 읽는다.
import { API_ERROR_MESSAGES } from "../api/api-error";
import { LOGIN_FAILED_MESSAGE } from "./login-copy";

const mobileRoot = process.cwd();
const source = (relativePath: string) => readFileSync(join(mobileRoot, relativePath), "utf8");

describe("AUTH-102 login screen wiring (source verification -- follows the existing\n  ui-wiring.test.ts source-grep convention; the screen isn't runtime-rendered here because\n  react-native has no native binding under vitest)", () => {
  it("branches on isKakaoLoginAvailable(): real flow when configured, the dev stub otherwise", () => {
    const loginSource = source("app/(auth)/login.tsx");
    expect(loginSource).toMatch(
      /import \{\s*isKakaoLoginAvailable,\s*KakaoLoginCancelledError,\s*KakaoLoginError,\s*loginWithKakao\s*\} from "\.\.\/\.\.\/src\/auth\/kakao-login";/
    );
    expect(loginSource).toContain(
      "const result = isKakaoLoginAvailable() ? await loginWithKakao() : await oauthLogin(\"kakao\")"
    );
  });

  it("keeps the dev-stub and demo/test-login paths intact (stub behavior unchanged when the flag is off)", () => {
    const loginSource = source("app/(auth)/login.tsx");
    // The dev stub stays reachable as the fallback branch.
    expect(loginSource).toContain('await oauthLogin("kakao")');
    // The EXPO_PUBLIC_TEST_LOGIN=1 demo path is untouched and still short-circuits before login().
    expect(loginSource).toContain('const isTestLoginEnabled = process.env.EXPO_PUBLIC_TEST_LOGIN === "1";');
    expect(loginSource).toContain("startTestSession();");
    expect(loginSource).toContain("void upsertConsents(LOCAL_SESSION_TOKEN).catch(() => {});");
    expect(loginSource).toContain('testID="test-login-button"');
  });

  it("reuses the shared session-store success path for both branches (setSession + consents + route)", () => {
    const loginSource = source("app/(auth)/login.tsx");
    expect(loginSource).toContain("accessToken: result.tokens.accessToken");
    expect(loginSource).toContain("refreshToken: result.tokens.refreshToken");
    // 라운드 65 B(#4ⓒ): 동의 저장은 여전히 **기다리되**(다음 화면인 온보딩의 아이 생성이 서버에서
    // 필수 동의를 검사한다), 실패가 로그인 실패로 승격되지는 않는다 -- 종전에는 이 PUT이 실패하면
    // 세션은 저장된 채 router.replace가 실행되지 않아 "로그인 중 문제가 발생했어요"만 떴다.
    expect(loginSource).toContain("await upsertConsents(result.tokens.accessToken).catch(() => undefined);");
    // 라운드 99 트랙 F1(H) — ⚠️ 두 시점: 종전 핀은 `inviteResumeHref ?? "/onboarding/child-status"`
    // 였다(로그인 성공이 무조건 ONB-001로). 그 길은 기존 사용자의 새 기기/재로그인에서 서버
    // 진행도를 묻지 않았고, 새 기기에는 로컬 방어가 없어 끝이 중복 아이 생성(POST /children)
    // 이었다. 이제 실세션도 데모 경로처럼 "/"로 가 app/index.tsx의 MOB-101 진행도 판정 한 곳에
    // 위임한다(완료→탭·중단→ONB-006·신규→ONB-001 — 신규 왕복은 콜드 스타트 홀딩 뷰가 덮는다).
    expect(loginSource).toContain('router.replace(inviteResumeHref ?? "/");');
    // 종전 목적지는 코드에서 사라졌다(주석의 이력 인용만 남는다 — 되살아나면 여기가 빨개진다).
    const renderedLoginSuccess = loginSource
      .replace(/\/\*[\s\S]*?\*\//g, " ")
      .replace(/^\s*\/\/.*$/gm, " ");
    expect(renderedLoginSuccess).not.toContain('inviteResumeHref ?? "/onboarding/child-status"');
  });

  it("treats the user cancelling Kakao consent as a non-error (no server-unreachable message)", () => {
    const loginSource = source("app/(auth)/login.tsx");
    expect(loginSource).toContain("if (error instanceof KakaoLoginCancelledError) return;");
  });

  it("surfaces each typed Kakao error's own Korean message instead of the dev-stub connection copy", () => {
    const loginSource = source("app/(auth)/login.tsx");
    // A timeout / browser failure / state mismatch / provider error must show the message the
    // error itself carries (every KakaoLoginError is constructed with user-facing Korean copy
    // in src/auth/kakao-login.ts)...
    expect(loginSource).toContain("if (error instanceof KakaoLoginError) {");
    expect(loginSource).toContain("setLoginError(error.message);");
    // ...checked AFTER the cancel special-case (KakaoLoginCancelledError extends
    // KakaoLoginError, so the order is load-bearing).
    expect(loginSource.indexOf("error instanceof KakaoLoginCancelledError")).toBeLessThan(
      loginSource.indexOf("error instanceof KakaoLoginError) {")
    );
    // 라운드 73 트랙 A: 타입 없는 실패의 문구는 **빌드 성격**으로 갈린다(종전 기준은
    // "env가 주입됐는가"였다). 두 질문이 각각 자기 자리에서 오고, 화면에는 리터럴이 없다.
    expect(loginSource).toMatch(
      /loginFailureMessage\(\{\s*developerBuild: isDeveloperBuild\(\),\s*kakaoConfigured: isKakaoLoginAvailable\(\)\s*\}\)/
    );
  });

  it("라운드 73 트랙 A: 실패 문구 두 갈래가 화면이 아니라 한 모듈에 있고, 화면은 리터럴을 갖지 않는다", () => {
    const loginSource = source("app/(auth)/login.tsx");
    // 화면은 판정 둘을 각각의 단일 소스에서 읽는다.
    expect(loginSource).toContain('import { isDeveloperBuild } from "../../src/auth/release-build";');
    expect(loginSource).toMatch(/import \{[\s\S]*?loginFailureMessage,[\s\S]*?\} from "\.\.\/\.\.\/src\/auth\/login-copy";/);
    // 주석(이력 인용)을 걷어낸 실제 코드에는 두 문장이 리터럴로 남지 않는다.
    const renderedLogin = loginSource.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");
    expect(renderedLogin).not.toContain("서버에 연결할 수 없어요. PC와 같은 Wi-Fi에서 API 서버가 켜져 있는지 확인해 주세요.");
    expect(renderedLogin).not.toContain("로그인 중 문제가 발생했어요. 네트워크 연결을 확인한 뒤 다시 시도해 주세요.");
    // ⚠️ 경로 선택(`login()`의 `isKakaoLoginAvailable() ? loginWithKakao() : oauthLogin("kakao")`
    // 삼항)은 이 트랙이 손대지 않는다 — 바뀐 것은 문구의 갈래 기준뿐이다. 줄 번호 앵커(:184)로
    // 가리키던 것을 식별자 인용으로 바꿨다(라운드 73 후속 리뷰 ⑤ — 그 번호는 이미 낡아 있었다).
    expect(loginSource).toContain(
      'const result = isKakaoLoginAvailable() ? await loginWithKakao() : await oauthLogin("kakao");'
    );
  });

  it("typed Kakao errors really do carry user-facing Korean messages for every non-cancel code (premise of the error-copy contract above)", () => {
    const kakaoSource = source("src/auth/kakao-login.ts");
    for (const message of [
      "카카오 로그인이 설정되지 않았어요.",
      "카카오 로그인 응답이 없어요. 다시 시도해 주세요.",
      "브라우저를 열 수 없어요.",
      "인증 절차를 다시 시작해 주세요.",
      "카카오 인증 응답을 읽을 수 없어요.",
      "카카오 인증에 실패했어요."
    ]) {
      expect(kakaoSource).toContain(message);
    }
  });

  it("kakao-login.ts documents the exact env vars the flag reads, as literal (babel-inlinable) member expressions", () => {
    const kakaoSource = source("src/auth/kakao-login.ts");
    expect(kakaoSource).toContain('process.env.EXPO_PUBLIC_KAKAO_ENABLED === "1"');
    expect(kakaoSource).toContain("process.env.EXPO_PUBLIC_KAKAO_CLIENT_ID");
    expect(kakaoSource).toContain("process.env.EXPO_PUBLIC_KAKAO_REDIRECT_URI");
  });
});

describe("ANA-104 optional analytics consent on the login consent card (same source-grep\n  convention as above -- the screen isn't runtime-renderable under vitest)", () => {
  afterEach(() => {
    useAnalyticsConsentStore.setState({ enabled: false });
  });

  it("shows the optional analytics checkbox with copy consistent with the settings toggle", () => {
    const loginSource = source("app/(auth)/login.tsx");
    // Rendered as badge "선택" + label, mirroring the required rows' badge+label layout.
    expect(loginSource).toContain("익명 사용 통계 수집 동의");
    expect(loginSource).toContain('optional ? "선택" : "필수"');
    // Honest short-form copy consistent with settings' 통계 수집 동의(선택) toggle,
    // pointing back to settings as the place to revoke.
    expect(loginSource).toContain("익명화된 사용 통계만 수집해요. 언제든지 설정에서 끌 수 있어요.");
    // Optional rows keep the exact same checkbox visuals as the required rows.
    expect(loginSource).toContain('accessibilityRole="checkbox"');
    expect(loginSource).toContain("checked ? styles.checkboxChecked : null");
  });

  it("does NOT gate the login button on the optional checkbox (only 약관+개인정보 are required)", () => {
    const loginSource = source("app/(auth)/login.tsx");
    expect(loginSource).toContain("const requiredAccepted = termsAccepted && privacyAccepted;");
    expect(loginSource).not.toContain("requiredAccepted = termsAccepted && privacyAccepted && analytics");
    // Both the button's disabled state and the login guards key off requiredAccepted alone.
    expect(loginSource).toContain("disabled={!requiredAccepted || isLoginPending}");
    expect(loginSource).toContain("if (!requiredAccepted || isLoginPending) return;");
    // No guard/disabled expression ever conjoins the analytics checkbox with the gate.
    // (`setAnalyticsLocal(!analyticsAccepted)` in the toggle handler is local state only.)
    expect(loginSource).not.toContain("|| !analyticsAccepted");
    expect(loginSource).not.toContain("&& analyticsAccepted");
  });

  it("commits the checkbox value to the shared consent store only when login proceeds, not while toggling", () => {
    const loginSource = source("app/(auth)/login.tsx");
    // Read-only import of the same store settings' toggle uses (single source of truth).
    expect(loginSource).toContain('import { useAnalyticsConsentStore } from "../../src/analytics/flag";');
    expect(loginSource).toContain("const setAnalyticsConsent = useAnalyticsConsentStore((state) => state.setEnabled);");
    // Toggling the checkbox only flips local state (and marks it user-touched)...
    expect(loginSource).toContain("onPress={toggleAnalyticsAccepted}");
    expect(loginSource).toContain("setAnalyticsLocal(!analyticsAccepted);");
    expect(loginSource).toContain("setAnalyticsTouched(true);");
    expect(loginSource).not.toContain("setAnalyticsConsent(!");
    // ...and the store is written exactly once, in continueWithLogin right before
    // either login path (test-login or Kakao) proceeds.
    expect(loginSource).toContain("setAnalyticsConsent(analyticsAccepted);");
    const storeWrites = loginSource.match(/setAnalyticsConsent\(analyticsAccepted\);/g) ?? [];
    expect(storeWrites).toHaveLength(1);
    // 라운드 78 규칙: 슬라이스는 **양쪽 끝**의 실재를 먼저 묻는다. 한쪽만 보면 못 찾은
    // 인덱스가 -1이 되어 구간이 조용히 파일 전체가 되고, 그 위의 순서 단언이 무엇도 지키지
    // 못한 채 초록이 된다.
    const continueStart = loginSource.indexOf("function continueWithLogin()");
    expect(continueStart, "continueWithLogin 선언").toBeGreaterThan(-1);
    const continueEnd = loginSource.indexOf("return (", continueStart);
    expect(continueEnd, "그 함수 뒤 렌더 시작").toBeGreaterThan(continueStart);
    const continueBody = loginSource.slice(
      continueStart,
      continueEnd
    );
    expect(continueBody).toContain("setAnalyticsConsent(analyticsAccepted);");
    // The commit sits after the required-consent guard and before both login branches.
    expect(continueBody.indexOf("if (!requiredAccepted || isLoginPending) return;")).toBeLessThan(
      continueBody.indexOf("setAnalyticsConsent(analyticsAccepted);")
    );
    expect(continueBody.indexOf("setAnalyticsConsent(analyticsAccepted);")).toBeLessThan(
      continueBody.indexOf("if (isTestLoginEnabled)")
    );
  });

  it("follows the store's consent until the user touches the checkbox (hydration-safe: re-login and cold-start rehydration both preserve a previously granted 통계 수집 동의)", () => {
    const loginSource = source("app/(auth)/login.tsx");
    // The checkbox SUBSCRIBES to the shared store via the hook selector -- NOT a one-shot
    // useState(() => useAnalyticsConsentStore.getState().enabled) initializer, which on a
    // cold start could snapshot the pre-rehydration default (false) and silently revoke a
    // previously granted consent at the unconditional single commit in continueWithLogin.
    expect(loginSource).toContain(
      "const storedAnalyticsEnabled = useAnalyticsConsentStore((state) => state.enabled);"
    );
    expect(loginSource).not.toContain("useAnalyticsConsentStore.getState().enabled");
    // Until the user explicitly touches the checkbox, it renders/commits the live store value;
    // after a touch, the local choice wins.
    expect(loginSource).toContain("const [analyticsTouched, setAnalyticsTouched] = useState(false);");
    expect(loginSource).toContain(
      "const analyticsAccepted = analyticsTouched ? analyticsLocal : storedAnalyticsEnabled;"
    );
    expect(loginSource).not.toContain("setAnalyticsAccepted] = useState(false)");
  });

  it("flag store behaves as the screen relies on it: store-initialized default (OFF until ever consented), setEnabled(checkbox) turns analytics on/off", () => {
    // Never-consented default is OFF, so the untouched checkbox (which mirrors the store)
    // starts unchecked on a fresh device -- an unchecked box committing `false` is a no-op.
    expect(useAnalyticsConsentStore.getState().enabled).toBe(false);
    expect(isAnalyticsEnabled()).toBe(false);
    const setEnabled = useAnalyticsConsentStore.getState().setEnabled;
    // Checked box committed at login -> analytics enabled.
    setEnabled(true);
    expect(isAnalyticsEnabled()).toBe(true);
    // ...and that stored consent is exactly what the untouched checkbox mirrors (via the
    // subscribing hook selector) on the next visit to the login screen, so re-login starts
    // checked and re-commits `true` -- the prior choice survives unless the user actively
    // unchecks, even if store rehydration finishes after the screen mounts.
    expect(useAnalyticsConsentStore.getState().enabled).toBe(true);
    // Settings toggle (same store) can revoke afterwards.
    setEnabled(false);
    expect(isAnalyticsEnabled()).toBe(false);
  });
});

/**
 * 라운드 106 F2 — **로그인 실패 문구가 사용자를 막다른 길에 세우지 않는다**(배선 계약).
 *
 * 문구 자체와 전수 대조는 표 옆(src/api/api-error.test.ts)이 진다. 여기서 무는 것은 화면이
 * 그 표를 **어디서 어떤 순서로** 읽는가다 — 이 파일의 다른 케이스들과 같은 소스 grep 관례다
 * (화면은 vitest에서 렌더할 수 없다).
 */
describe("라운드 106 F2 — 로그인 실패가 코드 표를 지난다", () => {
  it("계정 상태 다음, 네트워크 폴백 **앞**에서 카카오 로그인 여정의 코드를 분기한다", () => {
    const loginSource = source("app/(auth)/login.tsx");
    expect(loginSource).toContain(
      'import { accountStatusErrorMessage, oauthLoginErrorMessage } from "../../src/api/api-error";'
    );
    expect(loginSource).toContain("const oauthLoginMessage = oauthLoginErrorMessage(error);");
    expect(loginSource).toContain("setLoginError(oauthLoginMessage);");
    // 순서가 계약이다: 취소 → 타입 있는 카카오 오류 → 계정 상태 → 로그인 여정 코드 → 폴백.
    // 폴백이 앞서면 이 라운드가 고친 그 결함(501이 "네트워크 연결을 확인"으로 접힘)이 돌아온다.
    expect(loginSource.indexOf("const accountStatusMessage =")).toBeLessThan(
      loginSource.indexOf("const oauthLoginMessage =")
    );
    expect(loginSource.indexOf("const oauthLoginMessage =")).toBeLessThan(
      loginSource.indexOf("loginFailureMessage({")
    );
  });

  it("문구는 화면이 짓지 않는다 — 여섯 문장 어느 것도 화면에 리터럴로 없다", () => {
    const loginSource = source("app/(auth)/login.tsx");
    // 주석(이력 인용)을 걷어낸 실제 코드에서 본다 — 라운드 73 트랙 A가 세운 그 형식.
    const renderedLogin = loginSource.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");
    for (const code of [
      "OAUTH_LOGIN_NOT_IMPLEMENTED",
      "OAUTH_REDIRECT_URI_NOT_ALLOWED",
      "OAUTH_TRANSACTION_INVALID",
      "OAUTH_NONCE_MISMATCH",
      "OAUTH_CODE_EXCHANGE_FAILED",
      "OAUTH_ID_TOKEN_INVALID"
    ]) {
      const message = API_ERROR_MESSAGES[code];
      expect(message, code).toBeTruthy();
      expect(renderedLogin, code).not.toContain(message);
    }
    // 그리고 폴백 두 갈래는 종전 그대로 login-copy.ts의 몫이다(한 글자도 옮겨오지 않는다).
    expect(renderedLogin).not.toContain(LOGIN_FAILED_MESSAGE);
  });

  it("경로 선택과 취소·타입 있는 오류 분기는 무접촉이다 (바뀐 것은 문구의 출처뿐)", () => {
    const loginSource = source("app/(auth)/login.tsx");
    expect(loginSource).toContain(
      'const result = isKakaoLoginAvailable() ? await loginWithKakao() : await oauthLogin("kakao");'
    );
    expect(loginSource).toContain("if (error instanceof KakaoLoginCancelledError) return;");
    expect(loginSource).toContain("if (error instanceof KakaoLoginError) {");
    expect(loginSource).toMatch(
      /loginFailureMessage\(\{\s*developerBuild: isDeveloperBuild\(\),\s*kakaoConfigured: isKakaoLoginAvailable\(\)\s*\}\)/
    );
  });

  /**
   * ⚠️ **픽셀락 무접촉 근거**(값으로 남긴다): AUTH-001은 픽셀락 대상이 아니다. 캡처가 지나는
   * 라우트 목록은 app/pixel-lock.tsx의 `pixelLockRoutes`와 scripts/pixel-lock/의 화면 표
   * 둘뿐이고, 어느 쪽에도 `(auth)/login`이 없다(src/auth/login-copy.ts 머리말이 라운드 65 B에
   * 적어 둔 그 사실과 같다). 이 트랙은 그 두 목록을 한 글자도 건드리지 않았다.
   */
  it("픽셀락은 이 화면을 지나지 않는다 — 캡처 갈래 무접촉", () => {
    const pixelLockLauncher = source("app/pixel-lock.tsx");
    const routeStart = pixelLockLauncher.indexOf("const pixelLockRoutes = {");
    expect(routeStart, "픽셀락 라우트 표의 시작").toBeGreaterThan(-1);
    const routeEnd = pixelLockLauncher.indexOf("} as const;", routeStart);
    expect(routeEnd, "그 표의 끝").toBeGreaterThan(routeStart);
    const routeBlock = pixelLockLauncher.slice(
      routeStart,
      routeEnd
    );
    expect(routeBlock).not.toContain("(auth)");
    expect(routeBlock).not.toContain("login");
    const screens = JSON.parse(
      readFileSync(join(mobileRoot, "../../scripts/pixel-lock/pixel-lock-screens.json"), "utf8")
    ) as Record<string, { route: string }>;
    expect(Object.keys(screens)).not.toContain("AUTH-001");
    for (const [id, screen] of Object.entries(screens)) {
      expect(screen.route, id).not.toContain("AUTH-001");
    }
  });
});
