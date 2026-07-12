import { afterEach, describe, expect, it } from "vitest";
import { TokenService } from "../src/auth/token.service";
import { HouseholdRuntimeService } from "../src/households/household-runtime.service";

describe("TokenService production fail-fast secrets", () => {
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    delete process.env.JWT_ACCESS_SECRET;
    delete process.env.JWT_REFRESH_SECRET;
  });

  it("throws instead of using the dev fallback secret when NODE_ENV=production and env is unset", () => {
    process.env.NODE_ENV = "production";
    delete process.env.JWT_ACCESS_SECRET;
    delete process.env.JWT_REFRESH_SECRET;

    const tokenService = new TokenService(new HouseholdRuntimeService());
    const user = tokenService.createDevUser("kakao", "prod-fail-fast-user");

    expect(() => tokenService.issueTokenPair(user)).toThrow(
      /JWT_ACCESS_SECRET must be set unless NODE_ENV is "development" or "test"/
    );
  });

  it("throws instead of using the dev fallback secret when NODE_ENV is unset", () => {
    delete process.env.NODE_ENV;
    delete process.env.JWT_ACCESS_SECRET;
    delete process.env.JWT_REFRESH_SECRET;

    const tokenService = new TokenService(new HouseholdRuntimeService());
    const user = tokenService.createDevUser("kakao", "unset-env-user");

    expect(() => tokenService.issueTokenPair(user)).toThrow(
      /JWT_ACCESS_SECRET must be set unless NODE_ENV is "development" or "test"/
    );
  });

  it("issues and verifies tokens using the dev fallback secret outside production", () => {
    process.env.NODE_ENV = "test";
    delete process.env.JWT_ACCESS_SECRET;
    delete process.env.JWT_REFRESH_SECRET;

    const tokenService = new TokenService(new HouseholdRuntimeService());
    const user = tokenService.createDevUser("kakao", "dev-fallback-user");
    const tokens = tokenService.issueTokenPair(user);

    expect(() => tokenService.verifyAccessToken(tokens.accessToken)).not.toThrow();
  });
});
