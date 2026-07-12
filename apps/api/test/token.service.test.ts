import { randomUUID } from "node:crypto";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import type { RefreshTokenStore } from "../src/auth/refresh-token.store";
import { TokenService } from "../src/auth/token.service";
import { HouseholdRuntimeService } from "../src/households/household-runtime.service";
import { PrismaService } from "../src/prisma/prisma.service";

// TokenService now persists refresh token rotation state via RefreshTokenStore
// (Postgres-backed). These are pure unit tests with no database, so a minimal fake
// store stands in — every assertion here fails before the store would be touched
// (missing-secret cases) or only needs the store to accept a no-op create call.
function createFakeRefreshTokenStore(): RefreshTokenStore {
  return {
    create: async () => undefined,
    findByJti: async () => null,
    rotate: async () => undefined,
    markUsed: async () => undefined,
    revokeFamily: async () => undefined,
    revokeAllForUser: async () => undefined,
    deleteExpired: async () => undefined
  } as unknown as RefreshTokenStore;
}

// TokenService.createDevUser now persists the dev user/household via
// HouseholdRuntimeService.ensureDevUser (Postgres-backed), so this suite needs a
// real PrismaService the same as the DB-dependent e2e suites. Prisma lazily
// connects on first query, so no explicit $connect call is needed here.
const prisma = new PrismaService();

afterAll(async () => {
  await prisma.$disconnect();
});

describe("TokenService production fail-fast secrets", () => {
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    delete process.env.JWT_ACCESS_SECRET;
    delete process.env.JWT_REFRESH_SECRET;
  });

  it("throws instead of using the dev fallback secret when NODE_ENV=production and env is unset", async () => {
    process.env.NODE_ENV = "production";
    delete process.env.JWT_ACCESS_SECRET;
    delete process.env.JWT_REFRESH_SECRET;

    const tokenService = new TokenService(new HouseholdRuntimeService(prisma), createFakeRefreshTokenStore());
    const user = await tokenService.createDevUser("kakao", `prod-fail-fast-user-${randomUUID()}`);

    await expect(tokenService.issueTokenPair(user)).rejects.toThrow(
      /JWT_ACCESS_SECRET must be set unless NODE_ENV is "development" or "test"/
    );
  });

  it("throws instead of using the dev fallback secret when NODE_ENV is unset", async () => {
    delete process.env.NODE_ENV;
    delete process.env.JWT_ACCESS_SECRET;
    delete process.env.JWT_REFRESH_SECRET;

    const tokenService = new TokenService(new HouseholdRuntimeService(prisma), createFakeRefreshTokenStore());
    const user = await tokenService.createDevUser("kakao", `unset-env-user-${randomUUID()}`);

    await expect(tokenService.issueTokenPair(user)).rejects.toThrow(
      /JWT_ACCESS_SECRET must be set unless NODE_ENV is "development" or "test"/
    );
  });

  it("issues and verifies tokens using the dev fallback secret outside production", async () => {
    process.env.NODE_ENV = "test";
    delete process.env.JWT_ACCESS_SECRET;
    delete process.env.JWT_REFRESH_SECRET;

    const tokenService = new TokenService(new HouseholdRuntimeService(prisma), createFakeRefreshTokenStore());
    const user = await tokenService.createDevUser("kakao", `dev-fallback-user-${randomUUID()}`);
    const tokens = await tokenService.issueTokenPair(user);

    const verified = await tokenService.verifyAccessToken(tokens.accessToken);
    expect(verified.id).toEqual(user.id);
  });
});
