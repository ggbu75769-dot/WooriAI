import { createHash, randomUUID } from "node:crypto";
import { BadRequestException, UnauthorizedException } from "@nestjs/common";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import type { KakaoIdTokenClaims, KakaoOidcClient } from "../src/auth/kakao/kakao-oidc-client";
import { KakaoAuthService } from "../src/auth/kakao/kakao-auth.service";
import type { OAuthProviderAdapter } from "../src/auth/providers/oauth-provider.adapter";
import type { TokenService } from "../src/auth/token.service";
import { AuditLoggerService } from "../src/common/audit/audit-logger.service";
import type { AuthenticatedUser } from "../src/common/types/authenticated-request";
import { HouseholdRuntimeService } from "../src/households/household-runtime.service";
import { PrismaService } from "../src/prisma/prisma.service";

// Same pattern as test/auth.service.test.ts: KakaoAuthService is instantiated
// directly (no Nest DI container, no HTTP layer) with fakes for the pieces
// that don't matter to these tests (OAuthProviderAdapter, HouseholdRuntimeService,
// TokenService), but a real PrismaService — the behavior under test here
// (nonce hashing, redirectUri allowlist, the oauth_transactions CAS claim) is
// implemented against real Postgres rows, so faking Prisma would test nothing.
const prisma = new PrismaService();

afterAll(async () => {
  await prisma.$disconnect();
});

const ALLOWED_REDIRECT_URI = "https://app.wooriai.test/kakao-unit";

function fakeUser(overrides: Partial<AuthenticatedUser> = {}): AuthenticatedUser {
  return {
    id: randomUUID(),
    displayName: "테스트 사용자",
    email: null,
    status: "active",
    households: [],
    ...overrides
  };
}

const fakeTokenService = {
  issueTokenPair: async () => ({ accessToken: "access", refreshToken: "refresh", expiresIn: 1800 })
} as unknown as TokenService;

function createService(options: { kakaoClient?: Partial<KakaoOidcClient>; householdRuntime?: HouseholdRuntimeService } = {}) {
  const kakaoClient: KakaoOidcClient = {
    exchangeCode: options.kakaoClient?.exchangeCode ?? (async () => ({ idToken: "fake-id-token" })),
    verifyIdToken:
      options.kakaoClient?.verifyIdToken ??
      (async () => ({
        sub: `fake-sub-${randomUUID()}`,
        iss: "https://kauth.kakao.com",
        aud: "test-client",
        exp: Math.floor(Date.now() / 1000) + 600,
        iat: Math.floor(Date.now() / 1000)
      }))
  };

  const householdRuntime =
    options.householdRuntime ??
    ({
      findOrCreateProviderUser: async () => ({ user: fakeUser(), isNewUser: true })
    } as unknown as HouseholdRuntimeService);

  const kakaoAdapter: OAuthProviderAdapter = {
    provider: "kakao",
    prepareAuthorization: () => "https://kauth.kakao.com/oauth/authorize",
    exchangeAuthorizationCode: async (input) => (await kakaoClient.exchangeCode(input)).idToken,
    verifyIdentity: async (idToken) => await kakaoClient.verifyIdToken(idToken),
    unlinkIdentity: async () => undefined
  };

  return new KakaoAuthService(prisma, kakaoAdapter, householdRuntime, fakeTokenService, new AuditLoggerService());
}

describe("KakaoAuthService.prepare", () => {
  const originalRedirectUris = process.env.OAUTH_KAKAO_REDIRECT_URIS;

  afterEach(() => {
    process.env.OAUTH_KAKAO_REDIRECT_URIS = originalRedirectUris;
  });

  it("rejects a redirectUri outside the OAUTH_KAKAO_REDIRECT_URIS allowlist", async () => {
    process.env.OAUTH_KAKAO_REDIRECT_URIS = ALLOWED_REDIRECT_URI;
    const service = createService();

    await expect(service.prepare({ redirectUri: "https://not-allowed.example" })).rejects.toBeInstanceOf(
      BadRequestException
    );
  });

  it("persists only the sha256 hash of the nonce, and returns the plaintext nonce exactly once", async () => {
    process.env.OAUTH_KAKAO_REDIRECT_URIS = ALLOWED_REDIRECT_URI;
    const service = createService();

    const result = await service.prepare({ redirectUri: ALLOWED_REDIRECT_URI });
    const row = await prisma.oauthTransaction.findUniqueOrThrow({ where: { id: result.transactionId } });

    expect(row.nonceHash).toBe(createHash("sha256").update(result.nonce).digest("hex"));
    expect(row.nonceHash).not.toBe(result.nonce);
    expect(row.state).toBe(result.state);
    expect(row.consumedAt).toBeNull();
    expect(row.redirectUri).toBe(ALLOWED_REDIRECT_URI);
  });
});

describe("KakaoAuthService.exchange — transaction CAS + redirectUri allowlist", () => {
  const originalRedirectUris = process.env.OAUTH_KAKAO_REDIRECT_URIS;

  afterEach(() => {
    process.env.OAUTH_KAKAO_REDIRECT_URIS = originalRedirectUris;
  });

  it("atomically claims the transaction: two concurrent exchange calls for the same transactionId — exactly one succeeds", async () => {
    process.env.OAUTH_KAKAO_REDIRECT_URIS = ALLOWED_REDIRECT_URI;
    const nonce = `cas-nonce-${randomUUID()}`;
    const nonceHash = createHash("sha256").update(nonce).digest("hex");

    const service = createService({
      kakaoClient: {
        verifyIdToken: async () => ({
          sub: `cas-sub-${randomUUID()}`,
          iss: "https://kauth.kakao.com",
          aud: "test-client",
          exp: Math.floor(Date.now() / 1000) + 600,
          iat: Math.floor(Date.now() / 1000),
          nonce
        })
      }
    });

    const tx = await prisma.oauthTransaction.create({
      data: {
        provider: "kakao",
        state: randomUUID(),
        nonceHash,
        redirectUri: ALLOWED_REDIRECT_URI,
        expiresAt: new Date(Date.now() + 60_000)
      }
    });

    const outcomes = await Promise.allSettled([
      service.exchange({ transactionId: tx.id, state: tx.state, code: "code", redirectUri: ALLOWED_REDIRECT_URI }),
      service.exchange({ transactionId: tx.id, state: tx.state, code: "code", redirectUri: ALLOWED_REDIRECT_URI })
    ]);

    const fulfilled = outcomes.filter((outcome) => outcome.status === "fulfilled");
    const rejected = outcomes.filter((outcome): outcome is PromiseRejectedResult => outcome.status === "rejected");
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0]!.reason).toBeInstanceOf(UnauthorizedException);
    expect((rejected[0]!.reason as UnauthorizedException).getResponse()).toMatchObject({
      code: "OAUTH_TRANSACTION_INVALID"
    });

    const row = await prisma.oauthTransaction.findUniqueOrThrow({ where: { id: tx.id } });
    expect(row.consumedAt).not.toBeNull();
  });

  it("rejects reuse of an already-consumed transaction", async () => {
    process.env.OAUTH_KAKAO_REDIRECT_URIS = ALLOWED_REDIRECT_URI;
    const tx = await prisma.oauthTransaction.create({
      data: {
        provider: "kakao",
        state: randomUUID(),
        nonceHash: "irrelevant-already-consumed",
        redirectUri: ALLOWED_REDIRECT_URI,
        expiresAt: new Date(Date.now() + 60_000),
        consumedAt: new Date()
      }
    });

    const service = createService();
    await expect(
      service.exchange({ transactionId: tx.id, state: tx.state, code: "code", redirectUri: ALLOWED_REDIRECT_URI })
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("rejects a redirectUri outside the allowlist without consuming the transaction", async () => {
    process.env.OAUTH_KAKAO_REDIRECT_URIS = ALLOWED_REDIRECT_URI;
    const tx = await prisma.oauthTransaction.create({
      data: {
        provider: "kakao",
        state: randomUUID(),
        nonceHash: "irrelevant-not-allowed",
        redirectUri: ALLOWED_REDIRECT_URI,
        expiresAt: new Date(Date.now() + 60_000)
      }
    });

    const service = createService();
    await expect(
      service.exchange({ transactionId: tx.id, state: tx.state, code: "code", redirectUri: "https://not-allowed.example" })
    ).rejects.toBeInstanceOf(BadRequestException);

    const row = await prisma.oauthTransaction.findUniqueOrThrow({ where: { id: tx.id } });
    expect(row.consumedAt).toBeNull();
  });

  it("rejects a state that doesn't match the transaction's stored state", async () => {
    process.env.OAUTH_KAKAO_REDIRECT_URIS = ALLOWED_REDIRECT_URI;
    const tx = await prisma.oauthTransaction.create({
      data: {
        provider: "kakao",
        state: randomUUID(),
        nonceHash: "irrelevant-state-mismatch",
        redirectUri: ALLOWED_REDIRECT_URI,
        expiresAt: new Date(Date.now() + 60_000)
      }
    });

    const service = createService();
    await expect(
      service.exchange({
        transactionId: tx.id,
        state: "some-other-state",
        code: "code",
        redirectUri: ALLOWED_REDIRECT_URI
      })
    ).rejects.toBeInstanceOf(UnauthorizedException);

    const row = await prisma.oauthTransaction.findUniqueOrThrow({ where: { id: tx.id } });
    expect(row.consumedAt).toBeNull();
  });

  it("rejects an unknown transactionId", async () => {
    process.env.OAUTH_KAKAO_REDIRECT_URIS = ALLOWED_REDIRECT_URI;
    const service = createService();

    await expect(
      service.exchange({ transactionId: randomUUID(), state: "irrelevant", code: "code", redirectUri: ALLOWED_REDIRECT_URI })
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});

describe("HouseholdRuntimeService.findOrCreateProviderUser — concurrent first login (H-1)", () => {
  it("lets two concurrent Kakao exchanges for a brand-new user (same sub, different transactions) both succeed, creating exactly one user", async () => {
    process.env.OAUTH_KAKAO_REDIRECT_URIS = ALLOWED_REDIRECT_URI;
    const householdRuntime = new HouseholdRuntimeService(prisma);
    const sub = `race-exchange-sub-${randomUUID()}`;
    const nonceA = `race-nonce-a-${randomUUID()}`;
    const nonceB = `race-nonce-b-${randomUUID()}`;

    const claimsFor = (nonce: string): KakaoIdTokenClaims => ({
      sub,
      iss: "https://kauth.kakao.com",
      aud: "test-client",
      exp: Math.floor(Date.now() / 1000) + 600,
      iat: Math.floor(Date.now() / 1000),
      nonce
    });

    const serviceA = createService({
      householdRuntime,
      kakaoClient: { exchangeCode: async () => ({ idToken: "token-a" }), verifyIdToken: async () => claimsFor(nonceA) }
    });
    const serviceB = createService({
      householdRuntime,
      kakaoClient: { exchangeCode: async () => ({ idToken: "token-b" }), verifyIdToken: async () => claimsFor(nonceB) }
    });

    const txA = await prisma.oauthTransaction.create({
      data: {
        provider: "kakao",
        state: randomUUID(),
        nonceHash: createHash("sha256").update(nonceA).digest("hex"),
        redirectUri: ALLOWED_REDIRECT_URI,
        expiresAt: new Date(Date.now() + 60_000)
      }
    });
    const txB = await prisma.oauthTransaction.create({
      data: {
        provider: "kakao",
        state: randomUUID(),
        nonceHash: createHash("sha256").update(nonceB).digest("hex"),
        redirectUri: ALLOWED_REDIRECT_URI,
        expiresAt: new Date(Date.now() + 60_000)
      }
    });

    // Before the H-1 fix, one of these two concurrent first-time logins for the
    // same (provider, providerUserId) would throw an unhandled P2002 out of
    // findOrCreateProviderUser's find-then-create race — Promise.all would then
    // reject instead of both exchanges completing.
    const [resultA, resultB] = await Promise.all([
      serviceA.exchange({ transactionId: txA.id, state: txA.state, code: "code-a", redirectUri: ALLOWED_REDIRECT_URI }),
      serviceB.exchange({ transactionId: txB.id, state: txB.state, code: "code-b", redirectUri: ALLOWED_REDIRECT_URI })
    ]);

    expect(resultA.user.id).toBe(resultB.user.id);

    const rows = await prisma.user.findMany({ where: { authProvider: "kakao", providerUserId: sub } });
    expect(rows).toHaveLength(1);
    const identities = await prisma.oAuthIdentity.findMany({ where: { provider: "kakao", providerSubject: sub } });
    expect(identities).toHaveLength(1);
    expect(identities[0]?.userId).toBe(rows[0]?.id);
  });
});
