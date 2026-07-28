import { afterEach, describe, expect, it } from "vitest";
import { createMockKakaoCode, MockKakaoOAuthProviderAdapter } from "./mock-kakao-oauth-provider.adapter";

describe("Mock Kakao OAuth provider", () => {
  const originalNodeEnv = process.env.NODE_ENV;
  afterEach(() => { process.env.NODE_ENV = originalNodeEnv; });

  it("round-trips only explicit mock claims", async () => {
    process.env.NODE_ENV = "test";
    const adapter = new MockKakaoOAuthProviderAdapter();
    const code = createMockKakaoCode({ sub: "local-user-1", nonce: "nonce-value-at-least-16", nickname: "로컬 사용자" });
    expect(await adapter.verifyIdentity(await adapter.exchangeAuthorizationCode({ code, redirectUri: "wooriai://oauth" }))).toMatchObject({ sub: "local-user-1", nonce: "nonce-value-at-least-16" });
    await expect(adapter.exchangeAuthorizationCode({ code: "not-mock", redirectUri: "wooriai://oauth" })).rejects.toThrow("MOCK_OAUTH_CODE_INVALID");
  });

  it("fails closed in production", () => {
    process.env.NODE_ENV = "production";
    expect(() => new MockKakaoOAuthProviderAdapter()).toThrow("MOCK_OAUTH_FORBIDDEN_IN_PRODUCTION");
  });
});
