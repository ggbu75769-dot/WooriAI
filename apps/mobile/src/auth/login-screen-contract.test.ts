import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { isAnalyticsEnabled, useAnalyticsConsentStore } from "../analytics/flag";

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
    // FAM-121A: 초대 복귀 파라미터가 없을 때의 기본 목적지는 그대로 온보딩이다.
    expect(loginSource).toContain('router.replace(inviteResumeHref ?? "/onboarding/child-status");');
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
    // ⚠️ 경로 선택(:184의 삼항)은 이 트랙이 손대지 않는다 — 바뀐 것은 문구의 갈래 기준뿐이다.
    expect(loginSource).toContain(
      'const result = isKakaoLoginAvailable() ? await loginWithKakao() : await oauthLogin("kakao");'
    );
  });

  it("typed Kakao errors really do carry user-facing Korean messages for every non-cancel code (premise of the error-copy contract above)", () => {
    const kakaoSource = source("src/auth/kakao-login.ts");
    for (const message of [
      "카카오 로그인이 설정되지 않았어요.",
      "카카오 로그인 응답이 없어요. 다시 시도해주세요.",
      "브라우저를 열 수 없어요.",
      "인증 절차를 다시 시작해주세요.",
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
    const continueStart = loginSource.indexOf("function continueWithLogin()");
    const continueBody = loginSource.slice(
      continueStart,
      loginSource.indexOf("return (", continueStart)
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
