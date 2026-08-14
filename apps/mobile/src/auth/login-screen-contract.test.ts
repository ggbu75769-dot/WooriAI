import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { isAnalyticsEnabled, useAnalyticsConsentStore } from "../analytics/flag";

const mobileRoot = process.cwd();
const source = (relativePath: string) => readFileSync(join(mobileRoot, relativePath), "utf8");

describe("AUTH-102 login screen wiring (source verification -- follows the existing\n  ui-wiring.test.ts source-grep convention; the screen isn't runtime-rendered here because\n  react-native has no native binding under vitest)", () => {
  it("branches on isKakaoLoginAvailable(): real flow when configured, the dev stub otherwise", () => {
    const loginSource = source("app/(auth)/login.tsx");
    expect(loginSource).toContain(
      'import { isKakaoLoginAvailable, KakaoLoginCancelledError, loginWithKakao } from "../../src/auth/kakao-login";'
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
    expect(loginSource).toContain("await upsertConsents(result.tokens.accessToken);");
    expect(loginSource).toContain('router.replace("/onboarding/child-status");');
  });

  it("treats the user cancelling Kakao consent as a non-error (no server-unreachable message)", () => {
    const loginSource = source("app/(auth)/login.tsx");
    expect(loginSource).toContain("if (error instanceof KakaoLoginCancelledError) return;");
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
    expect(loginSource).not.toContain("!analyticsAccepted");
  });

  it("commits the checkbox value to the shared consent store only when login proceeds, not while toggling", () => {
    const loginSource = source("app/(auth)/login.tsx");
    // Read-only import of the same store settings' toggle uses (single source of truth).
    expect(loginSource).toContain('import { useAnalyticsConsentStore } from "../../src/analytics/flag";');
    expect(loginSource).toContain("const setAnalyticsConsent = useAnalyticsConsentStore((state) => state.setEnabled);");
    // Toggling the checkbox only flips local state...
    expect(loginSource).toContain("onPress={() => setAnalyticsAccepted((value) => !value)}");
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

  it("flag store behaves as the screen relies on it: default OFF, setEnabled(checkbox) turns analytics on/off", () => {
    // Default (never-touched) state is OFF -- an unchecked box committing `false` is a no-op.
    expect(isAnalyticsEnabled()).toBe(false);
    const setEnabled = useAnalyticsConsentStore.getState().setEnabled;
    // Checked box committed at login -> analytics enabled.
    setEnabled(true);
    expect(isAnalyticsEnabled()).toBe(true);
    // Settings toggle (same store) can revoke afterwards.
    setEnabled(false);
    expect(isAnalyticsEnabled()).toBe(false);
  });
});
