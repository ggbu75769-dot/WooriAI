import { NotImplementedException, UnauthorizedException } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { AuditLoggerService } from "../src/common/audit/audit-logger.service";
import { AuthService } from "../src/auth/auth.service";
import type { RefreshTokenStore } from "../src/auth/refresh-token.store";
import { TokenService } from "../src/auth/token.service";
import { HouseholdRuntimeService } from "../src/households/household-runtime.service";
import { PrismaService } from "../src/prisma/prisma.service";

// AuthService now depends on RefreshTokenStore (Postgres-backed) instead of the old
// in-memory RefreshTokenRevocationService. These tests only exercise the
// oauth-login dev-stub guard, which never touches refresh token rotation, so a
// minimal fake store is enough to satisfy the constructor.
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

// HouseholdRuntimeService.ensureDevUser (invoked via TokenService.createDevUser in
// the "keeps the dev stub working" case below) persists the dev user/household to
// Postgres, so this suite needs a real PrismaService the same as the DB-dependent
// e2e suites. Prisma lazily connects on first query, so no explicit $connect call
// is needed here.
const prisma = new PrismaService();

afterAll(async () => {
  await prisma.$disconnect();
});

function createAuthService() {
  return new AuthService(
    new AuditLoggerService(),
    new TokenService(new HouseholdRuntimeService(prisma), createFakeRefreshTokenStore()),
    createFakeRefreshTokenStore()
  );
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
    // Random suffix keeps this test's dev user/household isolated from any other
    // test file's dev-login rows sharing the same Postgres instance.
    const result = await authService.oauthLogin({ provider: "kakao", providerToken: `dev-user-${randomUUID()}` });

    expect(result.user.id).toEqual(expect.any(String));
    expect(result.tokens.accessToken).toEqual(expect.any(String));
  });
});

describe("AuthService logout revocation result", () => {
  it("propagates refresh-family storage failure instead of reporting false success", async () => {
    const auditLogger = { record: vi.fn(async () => undefined) };
    const tokenService = {
      verifyRefreshToken: vi.fn(async () => ({
        user: { id: "user-a" },
        jti: "refresh-jti",
        familyId: "family-a"
      }))
    };
    const refreshTokenStore = {
      revokeFamily: vi.fn(async () => {
        throw new Error("database unavailable");
      })
    };
    const service = new AuthService(
      auditLogger as never,
      tokenService as never,
      refreshTokenStore as never
    );

    await expect(
      service.logout({ id: "user-a", households: [] } as never, "refresh-a")
    ).rejects.toThrow("database unavailable");
    expect(auditLogger.record).not.toHaveBeenCalled();
  });

  it("revokes a family with refresh-token proof when the access token has expired", async () => {
    const auditLogger = { record: vi.fn(async () => undefined) };
    const tokenService = {
      verifyRefreshToken: vi.fn(async () => ({
        user: { id: "user-a" },
        jti: "refresh-jti",
        familyId: "family-a"
      }))
    };
    const refreshTokenStore = { revokeFamily: vi.fn(async () => undefined) };
    const service = new AuthService(
      auditLogger as never,
      tokenService as never,
      refreshTokenStore as never
    );

    await expect(service.logoutByRefreshToken("refresh-a")).resolves.toEqual({
      success: true
    });
    expect(refreshTokenStore.revokeFamily).toHaveBeenCalledWith("family-a");
    expect(auditLogger.record).toHaveBeenCalledWith(
      expect.objectContaining({ actorUserId: "user-a", action: "auth.logout" })
    );
  });

  it("ignores only invalid refresh credentials and propagates storage/runtime failures", async () => {
    const auditLogger = { record: vi.fn(async () => undefined) };
    const refreshTokenStore = { revokeFamily: vi.fn(async () => undefined) };
    const invalidService = new AuthService(
      auditLogger as never,
      {
        verifyRefreshToken: vi.fn(async () => {
          throw new UnauthorizedException();
        })
      } as never,
      refreshTokenStore as never
    );
    await expect(invalidService.logoutByRefreshToken("bad")).resolves.toEqual({
      success: true
    });

    const failedService = new AuthService(
      auditLogger as never,
      {
        verifyRefreshToken: vi.fn(async () => {
          throw new Error("database unavailable");
        })
      } as never,
      refreshTokenStore as never
    );
    await expect(failedService.logoutByRefreshToken("valid")).rejects.toThrow(
      "database unavailable"
    );
  });
});
