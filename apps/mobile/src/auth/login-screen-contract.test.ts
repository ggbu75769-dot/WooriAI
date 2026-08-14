import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

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
