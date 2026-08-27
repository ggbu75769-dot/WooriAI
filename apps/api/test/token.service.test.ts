import { createHmac, randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import type { RefreshTokenStore } from "../src/auth/refresh-token.store";
import { DEFAULT_REFRESH_FAMILY_MAX_AGE_DAYS, TokenService } from "../src/auth/token.service";
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

/** JWT 페이로드(2번째 세그먼트)를 그대로 디코드한다 — 서명 검증 없이 "겉으로 무엇이 보이는가"만 본다. */
function decodeClaims(token: string): Record<string, unknown> {
  return JSON.parse(Buffer.from(token.split(".")[1]!, "base64url").toString("utf8")) as Record<string, unknown>;
}

/**
 * SEC-131 **이전** 형식(전체 AuthenticatedUser 클레임 + `sub`가 아닌 `id`)의 토큰을
 * 손으로 만든다. 이미 발급되어 최대 30일 살아 있는 refresh 토큰을 재현하는 용도라
 * 서명 방식은 TokenService와 동일해야 한다.
 */
function signLegacyToken(payload: Record<string, unknown>, secret: string): string {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signingInput = `${header}.${body}`;
  return `${signingInput}.${createHmac("sha256", secret).update(signingInput).digest("base64url")}`;
}

describe("TokenService 클레임 최소화 (SEC-131)", () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const accessSecret = "sec131-access-secret";
  const refreshSecret = "sec131-refresh-secret";

  function createTokenService() {
    return new TokenService(new HouseholdRuntimeService(prisma), createFakeRefreshTokenStore());
  }

  function legacyClaims(overrides: Record<string, unknown>): Record<string, unknown> {
    const now = Math.floor(Date.now() / 1000);
    return {
      displayName: "예전 표시이름",
      email: "stale-claim@example.com",
      status: "active",
      households: [{ id: randomUUID(), name: "예전 가족", role: "owner" }],
      type: "access",
      iat: now,
      exp: now + 1800,
      ...overrides
    };
  }

  beforeEach(() => {
    process.env.NODE_ENV = "test";
    process.env.JWT_ACCESS_SECRET = accessSecret;
    process.env.JWT_REFRESH_SECRET = refreshSecret;
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    delete process.env.JWT_ACCESS_SECRET;
    delete process.env.JWT_REFRESH_SECRET;
  });

  it("발급 토큰 페이로드에 email/displayName/households가 없다", async () => {
    const tokenService = createTokenService();
    const user = await tokenService.createDevUser("kakao", `sec131-claims-${randomUUID()}`);
    // 전제 확인: 이 사용자는 실제로 표시이름과 소속 household를 갖고 있다 —
    // 아래 부재 단언이 "원래부터 빈 값이라 없었다"로 통과하지 않도록 못 박는다.
    expect(user.displayName).toBe("개발 사용자");
    expect(user.households.length).toBeGreaterThan(0);

    const tokens = await tokenService.issueTokenPair(user);

    const accessClaims = decodeClaims(tokens.accessToken);
    expect(Object.keys(accessClaims).sort()).toEqual(["exp", "iat", "status", "sub", "type"]);
    expect(accessClaims.sub).toBe(user.id);
    expect(accessClaims.type).toBe("access");
    expect(accessClaims.status).toBe("active");

    const refreshClaims = decodeClaims(tokens.refreshToken);
    // refresh는 회전 추적에 필요한 jti/familyId가 더 붙는다(둘 다 무작위 UUID, PII 아님).
    expect(Object.keys(refreshClaims).sort()).toEqual(["exp", "familyId", "iat", "jti", "status", "sub", "type"]);
    expect(refreshClaims.sub).toBe(user.id);
    expect(refreshClaims.type).toBe("refresh");

    for (const claims of [accessClaims, refreshClaims]) {
      expect(claims.email).toBeUndefined();
      expect(claims.displayName).toBeUndefined();
      expect(claims.households).toBeUndefined();
      expect(claims.id).toBeUndefined();
      // 표시이름이 다른 키 이름으로 새어 나가지도 않는지(직렬화 전체를 훑는다).
      expect(JSON.stringify(claims)).not.toContain("개발 사용자");
    }
  });

  it("구형(전체 클레임) 토큰도 계속 검증되고, 사용자 정보는 DB에서 다시 만든다", async () => {
    const tokenService = createTokenService();
    const user = await tokenService.createDevUser("kakao", `sec131-legacy-${randomUUID()}`);

    const legacyToken = signLegacyToken(legacyClaims({ id: user.id }), accessSecret);
    const verified = await tokenService.verifyAccessToken(legacyToken);

    expect(verified.id).toBe(user.id);
    expect(verified.status).toBe("active");
    // 클레임에 실려 온 값이 아니라 DB 값이어야 한다 — `?? user.email` 폴백이 살아
    // 있었다면 row.email이 null인 dev 사용자에게 stale-claim@example.com이 붙는다.
    expect(verified.email).toBeNull();
    expect(verified.displayName).toBe("개발 사용자");
    expect(verified.households.map((household) => household.id)).toEqual(user.households.map((h) => h.id));
  });

  it("구형 refresh 토큰의 jti/familyId도 그대로 읽는다", async () => {
    const tokenService = createTokenService();
    const user = await tokenService.createDevUser("kakao", `sec131-legacy-refresh-${randomUUID()}`);
    const jti = randomUUID();
    const familyId = randomUUID();
    const now = Math.floor(Date.now() / 1000);

    const legacyToken = signLegacyToken(
      legacyClaims({ id: user.id, type: "refresh", exp: now + 60 * 60 * 24 * 30, jti, familyId }),
      refreshSecret
    );

    const verification = await tokenService.verifyRefreshToken(legacyToken);
    expect(verification.jti).toBe(jti);
    expect(verification.familyId).toBe(familyId);
    expect(verification.user.id).toBe(user.id);
    expect(verification.user.email).toBeNull();
  });

  it("탈퇴한 사용자의 구형 토큰은 클레임이 아니라 DB 상태를 따른다", async () => {
    const tokenService = createTokenService();
    const user = await tokenService.createDevUser("kakao", `sec131-withdrawn-${randomUUID()}`);
    await prisma.user.update({ where: { id: user.id }, data: { status: "withdrawn" } });

    // 클레임에는 여전히 active + 이메일 + 소속 household가 들어 있다.
    const legacyToken = signLegacyToken(legacyClaims({ id: user.id }), accessSecret);
    const verified = await tokenService.verifyAccessToken(legacyToken);

    expect(verified.status).toBe("withdrawn");
    expect(verified.email).toBeNull();
    expect(verified.households).toEqual([]);
  });

  it("존재하지 않는 사용자의 구형 토큰은 탈퇴로 취급되고 클레임 신원을 되살리지 않는다", async () => {
    const tokenService = createTokenService();
    const ghostId = randomUUID();

    const legacyToken = signLegacyToken(legacyClaims({ id: ghostId }), accessSecret);
    const verified = await tokenService.verifyAccessToken(legacyToken);

    expect(verified.id).toBe(ghostId);
    expect(verified.status).toBe("withdrawn");
    expect(verified.displayName).toBe("");
    expect(verified.email).toBeNull();
    expect(verified.households).toEqual([]);
  });

  it("사용자 식별자가 없거나 문자열이 아니면 거절한다", async () => {
    const tokenService = createTokenService();
    const now = Math.floor(Date.now() / 1000);

    const noSubject = signLegacyToken({ type: "access", iat: now, exp: now + 1800 }, accessSecret);
    await expect(tokenService.verifyAccessToken(noSubject)).rejects.toThrow(/토큰을 다시 확인해주세요/);

    const numericSubject = signLegacyToken({ sub: 42, type: "access", iat: now, exp: now + 1800 }, accessSecret);
    await expect(tokenService.verifyAccessToken(numericSubject)).rejects.toThrow(/토큰을 다시 확인해주세요/);
  });
});

describe("refresh family 절대 수명 상한 설정 (SEC-131)", () => {
  const DAY_MS = 24 * 60 * 60 * 1000;
  const originalValue = process.env.REFRESH_FAMILY_MAX_AGE_DAYS;

  afterEach(() => {
    if (originalValue === undefined) {
      delete process.env.REFRESH_FAMILY_MAX_AGE_DAYS;
    } else {
      process.env.REFRESH_FAMILY_MAX_AGE_DAYS = originalValue;
    }
  });

  it("미설정/비수치/0 이하는 기본값 90일로 떨어진다", () => {
    expect(TokenService.refreshFamilyMaxAgeDays({})).toBe(DEFAULT_REFRESH_FAMILY_MAX_AGE_DAYS);
    expect(TokenService.refreshFamilyMaxAgeDays({ REFRESH_FAMILY_MAX_AGE_DAYS: "" })).toBe(90);
    expect(TokenService.refreshFamilyMaxAgeDays({ REFRESH_FAMILY_MAX_AGE_DAYS: "구십" })).toBe(90);
    // 0은 "상한 없음"이 아니라 "모든 회전 즉시 거부"가 되어버리므로 기본값으로 되돌린다.
    expect(TokenService.refreshFamilyMaxAgeDays({ REFRESH_FAMILY_MAX_AGE_DAYS: "0" })).toBe(90);
    expect(TokenService.refreshFamilyMaxAgeDays({ REFRESH_FAMILY_MAX_AGE_DAYS: "-7" })).toBe(90);
  });

  it("설정된 일수를 그대로 쓴다", () => {
    expect(TokenService.refreshFamilyMaxAgeDays({ REFRESH_FAMILY_MAX_AGE_DAYS: "30" })).toBe(30);
  });

  it("상한 경계는 초과했을 때만 만료로 본다", () => {
    process.env.REFRESH_FAMILY_MAX_AGE_DAYS = "90";
    const now = new Date("2026-08-27T00:00:00.000Z");

    const exactlyAtLimit = new Date(now.getTime() - 90 * DAY_MS);
    expect(TokenService.isRefreshFamilyExpired(exactlyAtLimit, now)).toBe(false);

    const justOver = new Date(now.getTime() - 90 * DAY_MS - 1);
    expect(TokenService.isRefreshFamilyExpired(justOver, now)).toBe(true);

    const freshLogin = new Date(now.getTime() - 60 * 1000);
    expect(TokenService.isRefreshFamilyExpired(freshLogin, now)).toBe(false);
  });
});
