import { NotImplementedException } from "@nestjs/common";
import { afterEach, describe, expect, it } from "vitest";
import { AuditLoggerService } from "../src/common/audit/audit-logger.service";
import { AuthService } from "../src/auth/auth.service";
import { TokenService } from "../src/auth/token.service";
import { HouseholdRuntimeService } from "../src/households/household-runtime.service";

function createAuthService() {
  return new AuthService(new AuditLoggerService(), new TokenService(new HouseholdRuntimeService()));
}

describe("AuthService oauthLogin production guard", () => {
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    delete process.env.JWT_ACCESS_SECRET;
    delete process.env.JWT_REFRESH_SECRET;
  });

  it("rejects oauth-login in production since provider tokens are not verified yet", async () => {
    process.env.NODE_ENV = "production";
    process.env.JWT_ACCESS_SECRET = "configured-access-secret";
    process.env.JWT_REFRESH_SECRET = "configured-refresh-secret";

    const authService = createAuthService();

    await expect(
      authService.oauthLogin({ provider: "kakao", providerToken: "anything" })
    ).rejects.toBeInstanceOf(NotImplementedException);
  });

  it("rejects oauth-login when NODE_ENV is unset", async () => {
    delete process.env.NODE_ENV;
    process.env.JWT_ACCESS_SECRET = "configured-access-secret";
    process.env.JWT_REFRESH_SECRET = "configured-refresh-secret";

    const authService = createAuthService();

    await expect(
      authService.oauthLogin({ provider: "kakao", providerToken: "anything" })
    ).rejects.toBeInstanceOf(NotImplementedException);
  });

  it("keeps the dev stub working in test", async () => {
    process.env.NODE_ENV = "test";

    const authService = createAuthService();
    const result = await authService.oauthLogin({ provider: "kakao", providerToken: "dev-user" });

    expect(result.user.id).toEqual(expect.any(String));
    expect(result.tokens.accessToken).toEqual(expect.any(String));
  });
});
