import { UnauthorizedException, type INestApplication } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import { randomUUID } from "node:crypto";
import { exportJWK, generateKeyPair, importJWK, jwtVerify, SignJWT, type JWK, type KeyLike } from "jose";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AppModule } from "../src/app.module";
import { KAKAO_OIDC_CLIENT } from "../src/auth/kakao/kakao-oidc-client";
import type {
  KakaoCodeExchangeInput,
  KakaoCodeExchangeResult,
  KakaoIdTokenClaims,
  KakaoOidcClient
} from "../src/auth/kakao/kakao-oidc-client";
import { configureApiApp } from "../src/bootstrap";
import { PrismaService } from "../src/prisma/prisma.service";

const KAKAO_ISSUER = "https://kauth.kakao.com";
const CLIENT_ID = "test-kakao-client-id";
const ALLOWED_REDIRECT_URI = "https://app.wooriai.test/oauth/kakao";
/**
 * GAP-075 A: a fixed past `updated_at`/`last_login_at` for the rejected-login
 * fixtures below. Both columns are written explicitly at create time so the
 * "nothing moved" assertions compare against a value the request itself could
 * never produce.
 */
const STALE_ROW_TIMESTAMP = new Date("2026-01-02T03:04:05.000Z");

/**
 * Test double for KakaoOidcClient (AUTH-101 requires the real implementation be
 * injectable via an interface precisely so tests can do this): `exchangeCode`
 * just returns whatever id_token the test queued up, and `verifyIdToken`
 * performs the exact same jose-based RS256/JWKS-shaped verification the real
 * HttpKakaoOidcClient does, but against a locally generated key pair instead of
 * fetching kauth.kakao.com's real JWKS. This exercises the real
 * signature/iss/aud/exp verification code path (via `jwtVerify`) for the
 * forged-signature/expired/aud-mismatch/iss-mismatch test cases below, without
 * any network access.
 */
class TestKakaoOidcClient implements KakaoOidcClient {
  nextIdToken: string | null = null;
  exchangeError: Error | null = null;

  constructor(private readonly verificationKey: KeyLike) {}

  async exchangeCode(_input: KakaoCodeExchangeInput): Promise<KakaoCodeExchangeResult> {
    if (this.exchangeError) {
      throw this.exchangeError;
    }
    if (!this.nextIdToken) {
      throw new Error("test setup error: nextIdToken was not queued before exchangeCode() was called");
    }
    return { idToken: this.nextIdToken };
  }

  async verifyIdToken(idToken: string): Promise<KakaoIdTokenClaims> {
    // Mirrors HttpKakaoOidcClient.verifyIdToken's error handling exactly: any
    // jose verification failure (bad signature, expired, wrong iss/aud) becomes
    // a 401 OAUTH_ID_TOKEN_INVALID rather than an uncaught 500.
    try {
      const { payload } = await jwtVerify(idToken, this.verificationKey, {
        issuer: KAKAO_ISSUER,
        audience: CLIENT_ID
      });
      return payload as KakaoIdTokenClaims;
    } catch {
      throw new UnauthorizedException({
        code: "OAUTH_ID_TOKEN_INVALID",
        message: "카카오 인증 정보를 확인할 수 없어요."
      });
    }
  }
}

async function signIdToken(
  signingKey: KeyLike,
  overrides: Partial<{
    iss: string;
    aud: string;
    sub: string;
    nonce: string;
    email: string;
    nickname: string;
    expiresInSeconds: number;
    issuedAtSecondsAgo: number;
  }> = {}
) {
  const sub = overrides.sub ?? `kakao-sub-${randomUUID()}`;
  const nowSeconds = Math.floor(Date.now() / 1000) - (overrides.issuedAtSecondsAgo ?? 0);
  const jwt = new SignJWT({
    nonce: overrides.nonce,
    email: overrides.email,
    nickname: overrides.nickname
  })
    .setProtectedHeader({ alg: "RS256" })
    .setIssuer(overrides.iss ?? KAKAO_ISSUER)
    .setAudience(overrides.aud ?? CLIENT_ID)
    .setSubject(sub)
    .setIssuedAt(nowSeconds)
    .setExpirationTime(nowSeconds + (overrides.expiresInSeconds ?? 600));

  return { token: await jwt.sign(signingKey), sub };
}

describe("Kakao OIDC prepare/exchange (AUTH-101)", () => {
  let app: INestApplication;
  let moduleRef: TestingModule;
  let prisma: PrismaService;
  let kakaoClient: TestKakaoOidcClient;
  let signingKey: KeyLike;
  let rogueSigningKey: KeyLike;

  beforeEach(async () => {
    process.env.JWT_ACCESS_SECRET = "test-access-secret";
    process.env.JWT_REFRESH_SECRET = "test-refresh-secret";
    process.env.OAUTH_KAKAO_CLIENT_ID = CLIENT_ID;
    process.env.OAUTH_KAKAO_REDIRECT_URIS = ALLOWED_REDIRECT_URI;

    const legitPair = await generateKeyPair("RS256");
    const roguePair = await generateKeyPair("RS256");
    signingKey = legitPair.privateKey;
    rogueSigningKey = roguePair.privateKey;

    // Round-trip through JWK export/import so verifyIdToken exercises the same
    // "import a public key, then jwtVerify against it" shape jose's
    // createRemoteJWKSet would give the real client.
    const publicJwk: JWK = await exportJWK(legitPair.publicKey);
    const verificationKey = await importJWK({ ...publicJwk, alg: "RS256" }, "RS256");
    kakaoClient = new TestKakaoOidcClient(verificationKey as KeyLike);

    moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(KAKAO_OIDC_CLIENT)
      .useValue(kakaoClient)
      .compile();

    app = moduleRef.createNestApplication();
    configureApiApp(app);
    await app.init();
    prisma = moduleRef.get(PrismaService);
  });

  afterEach(async () => {
    await app.close();
  });

  async function prepare(redirectUri = ALLOWED_REDIRECT_URI) {
    const response = await request(app.getHttpServer())
      .post("/api/v1/auth/kakao/prepare")
      .send({ redirectUri })
      .expect(200);
    expect(response.body).toMatchObject({
      transactionId: expect.any(String),
      state: expect.any(String),
      nonce: expect.any(String)
    });
    return response.body as { transactionId: string; state: string; nonce: string };
  }

  /**
   * GAP-076 D ⓐ·ⓒ: a turned-away login leaves **exactly one** `auth.login_rejected`
   * row, and that row carries only the provider and the reason — no Kakao `sub`,
   * no email, no nickname, no token anywhere in the envelope (round5a-sprint2-plan
   * §2's PII-log ban / DNC-019, the same rule `auth.login` keeps).
   */
  async function expectLoginRejectedRow(
    userId: string,
    reason: "blocked" | "withdrawn",
    forbidden: { sub: string; idToken: string; displayName: string }
  ) {
    const rows = await prisma.auditLog.findMany({ where: { actorUserId: userId } });
    expect(rows).toHaveLength(1);
    const row = rows[0];
    expect(row.action).toBe("auth.login_rejected");
    expect(row.targetType).toBe("users");
    expect(row.targetId).toBe(userId);
    expect(row.householdId).toBeNull();
    expect(row.beforeJson).toBeNull();
    expect(row.afterJson).toEqual({ provider: "kakao", reason });

    const rowJson = JSON.stringify(row);
    expect(rowJson).not.toContain(forbidden.sub);
    expect(rowJson).not.toContain(forbidden.idToken);
    expect(rowJson).not.toContain(forbidden.displayName);
    expect(rowJson).not.toContain("@example.com");
  }

  it("logs a brand-new user in, then logs the same sub in again as a returning user", async () => {
    const { transactionId, state, nonce } = await prepare();
    const { token, sub } = await signIdToken(signingKey, {
      nonce,
      email: "parent@example.com",
      nickname: "테스트부모"
    });
    kakaoClient.nextIdToken = token;

    const first = await request(app.getHttpServer())
      .post("/api/v1/auth/kakao/exchange")
      .send({ transactionId, state, code: "auth-code-1", redirectUri: ALLOWED_REDIRECT_URI })
      .expect(200);

    expect(first.body).toMatchObject({
      user: { id: expect.any(String), status: "active" },
      tokens: {
        accessToken: expect.any(String),
        refreshToken: expect.any(String),
        expiresIn: 1800
      },
      onboardingRequired: true
    });
    const firstUserId = first.body.user.id as string;

    // GAP-076 D ⓐ (negative half): a successful login records `auth.login` and
    // never the rejection row — the new action must not appear on the happy path.
    const successRows = await prisma.auditLog.findMany({ where: { actorUserId: firstUserId } });
    expect(successRows.map((row) => row.action)).toEqual(["auth.login"]);

    // GAP-075 A ⓒ: an ACTIVE account's login must still stamp lastLoginAt (and,
    // through Prisma's @updatedAt, users.updated_at). Rewind the row to a fixed
    // past value first so the assertion below doesn't depend on clock resolution
    // between two requests.
    const rewound = new Date("2026-01-01T00:00:00.000Z");
    await prisma.user.update({
      where: { id: firstUserId },
      data: { lastLoginAt: rewound, updatedAt: rewound }
    });

    // Second login, same sub -> same user, and now a returning user (not new).
    const { transactionId: transactionId2, state: state2, nonce: nonce2 } = await prepare();
    const { token: token2 } = await signIdToken(signingKey, { sub, nonce: nonce2 });
    kakaoClient.nextIdToken = token2;

    const second = await request(app.getHttpServer())
      .post("/api/v1/auth/kakao/exchange")
      .send({ transactionId: transactionId2, state: state2, code: "auth-code-2", redirectUri: ALLOWED_REDIRECT_URI })
      .expect(200);

    expect(second.body.user.id).toBe(firstUserId);
    expect(second.body.onboardingRequired).toBe(false);

    const rowAfterSecondLogin = await prisma.user.findUniqueOrThrow({ where: { id: firstUserId } });
    expect(rowAfterSecondLogin.lastLoginAt?.getTime() ?? 0).toBeGreaterThan(rewound.getTime());
    expect(rowAfterSecondLogin.updatedAt.getTime()).toBeGreaterThan(rewound.getTime());

    // The issued refresh token rotates through the existing /auth/refresh route.
    const refreshed = await request(app.getHttpServer())
      .post("/api/v1/auth/refresh")
      .send({ refreshToken: second.body.tokens.refreshToken })
      .expect(200);
    expect(refreshed.body.accessToken).toEqual(expect.any(String));
    expect(refreshed.body.refreshToken).not.toBe(second.body.tokens.refreshToken);
  });

  it("rejects a forged ID token signature", async () => {
    const { transactionId, state, nonce } = await prepare();
    const { token } = await signIdToken(rogueSigningKey, { nonce });
    kakaoClient.nextIdToken = token;

    await request(app.getHttpServer())
      .post("/api/v1/auth/kakao/exchange")
      .send({ transactionId, state, code: "auth-code", redirectUri: ALLOWED_REDIRECT_URI })
      .expect(401)
      .expect(({ body }) => {
        expect(body.error.code).toBe("OAUTH_ID_TOKEN_INVALID");
      });
  });

  it("rejects an expired ID token", async () => {
    const { transactionId, state, nonce } = await prepare();
    const { token } = await signIdToken(signingKey, { nonce, expiresInSeconds: 1, issuedAtSecondsAgo: 120 });
    kakaoClient.nextIdToken = token;

    await request(app.getHttpServer())
      .post("/api/v1/auth/kakao/exchange")
      .send({ transactionId, state, code: "auth-code", redirectUri: ALLOWED_REDIRECT_URI })
      .expect(401)
      .expect(({ body }) => {
        expect(body.error.code).toBe("OAUTH_ID_TOKEN_INVALID");
      });
  });

  it("rejects an ID token with the wrong audience", async () => {
    const { transactionId, state, nonce } = await prepare();
    const { token } = await signIdToken(signingKey, { nonce, aud: "someone-elses-client-id" });
    kakaoClient.nextIdToken = token;

    await request(app.getHttpServer())
      .post("/api/v1/auth/kakao/exchange")
      .send({ transactionId, state, code: "auth-code", redirectUri: ALLOWED_REDIRECT_URI })
      .expect(401)
      .expect(({ body }) => {
        expect(body.error.code).toBe("OAUTH_ID_TOKEN_INVALID");
      });
  });

  it("rejects an ID token with the wrong issuer", async () => {
    const { transactionId, state, nonce } = await prepare();
    const { token } = await signIdToken(signingKey, { nonce, iss: "https://not-kakao.example" });
    kakaoClient.nextIdToken = token;

    await request(app.getHttpServer())
      .post("/api/v1/auth/kakao/exchange")
      .send({ transactionId, state, code: "auth-code", redirectUri: ALLOWED_REDIRECT_URI })
      .expect(401)
      .expect(({ body }) => {
        expect(body.error.code).toBe("OAUTH_ID_TOKEN_INVALID");
      });
  });

  it("rejects a nonce that doesn't match the prepared transaction", async () => {
    const { transactionId, state } = await prepare();
    const { token } = await signIdToken(signingKey, { nonce: "some-other-nonce" });
    kakaoClient.nextIdToken = token;

    await request(app.getHttpServer())
      .post("/api/v1/auth/kakao/exchange")
      .send({ transactionId, state, code: "auth-code", redirectUri: ALLOWED_REDIRECT_URI })
      .expect(401)
      .expect(({ body }) => {
        expect(body.error.code).toBe("OAUTH_NONCE_MISMATCH");
      });
  });

  it("rejects a state that doesn't match the prepared transaction", async () => {
    const { transactionId, nonce } = await prepare();
    const { token } = await signIdToken(signingKey, { nonce });
    kakaoClient.nextIdToken = token;

    await request(app.getHttpServer())
      .post("/api/v1/auth/kakao/exchange")
      .send({ transactionId, state: "some-other-state", code: "auth-code", redirectUri: ALLOWED_REDIRECT_URI })
      .expect(401)
      .expect(({ body }) => {
        expect(body.error.code).toBe("OAUTH_TRANSACTION_INVALID");
      });
  });

  it("rejects reuse (replay) of an already-consumed transaction", async () => {
    const { transactionId, state, nonce } = await prepare();
    const { token } = await signIdToken(signingKey, { nonce });
    kakaoClient.nextIdToken = token;

    await request(app.getHttpServer())
      .post("/api/v1/auth/kakao/exchange")
      .send({ transactionId, state, code: "auth-code", redirectUri: ALLOWED_REDIRECT_URI })
      .expect(200);

    await request(app.getHttpServer())
      .post("/api/v1/auth/kakao/exchange")
      .send({ transactionId, state, code: "auth-code", redirectUri: ALLOWED_REDIRECT_URI })
      .expect(401)
      .expect(({ body }) => {
        expect(body.error.code).toBe("OAUTH_TRANSACTION_INVALID");
      });
  });

  it("rejects an expired transaction", async () => {
    const { transactionId, state, nonce } = await prepare();
    await prisma.oauthTransaction.update({
      where: { id: transactionId },
      data: { expiresAt: new Date(Date.now() - 1000) }
    });
    const { token } = await signIdToken(signingKey, { nonce });
    kakaoClient.nextIdToken = token;

    await request(app.getHttpServer())
      .post("/api/v1/auth/kakao/exchange")
      .send({ transactionId, state, code: "auth-code", redirectUri: ALLOWED_REDIRECT_URI })
      .expect(401)
      .expect(({ body }) => {
        expect(body.error.code).toBe("OAUTH_TRANSACTION_INVALID");
      });
  });

  it("rejects a redirectUri outside the allowlist at prepare time", async () => {
    await request(app.getHttpServer())
      .post("/api/v1/auth/kakao/prepare")
      .send({ redirectUri: "https://evil.example/callback" })
      .expect(400)
      .expect(({ body }) => {
        expect(body.error.code).toBe("OAUTH_REDIRECT_URI_NOT_ALLOWED");
      });
  });

  it("rejects a redirectUri outside the allowlist at exchange time", async () => {
    const { transactionId, state, nonce } = await prepare();
    const { token } = await signIdToken(signingKey, { nonce });
    kakaoClient.nextIdToken = token;

    await request(app.getHttpServer())
      .post("/api/v1/auth/kakao/exchange")
      .send({ transactionId, state, code: "auth-code", redirectUri: "https://evil.example/callback" })
      .expect(400)
      .expect(({ body }) => {
        expect(body.error.code).toBe("OAUTH_REDIRECT_URI_NOT_ALLOWED");
      });

    // The transaction must still be usable afterwards (a client-side redirectUri
    // mistake shouldn't burn the one-shot transaction).
    const retry = await request(app.getHttpServer())
      .post("/api/v1/auth/kakao/exchange")
      .send({ transactionId, state, code: "auth-code", redirectUri: ALLOWED_REDIRECT_URI })
      .expect(200);
    expect(retry.body.tokens.accessToken).toEqual(expect.any(String));
  });

  it("rejects login for a blocked user without touching updated_at / last_login_at", async () => {
    const sub = `kakao-sub-blocked-${randomUUID()}`;
    const created = await prisma.user.create({
      data: {
        authProvider: "kakao",
        providerUserId: sub,
        displayName: "차단된 사용자",
        status: "blocked",
        lastLoginAt: STALE_ROW_TIMESTAMP,
        updatedAt: STALE_ROW_TIMESTAMP
      }
    });

    const { transactionId, state, nonce } = await prepare();
    const { token } = await signIdToken(signingKey, {
      sub,
      nonce,
      email: "blocked-parent@example.com",
      nickname: "차단된닉네임"
    });
    kakaoClient.nextIdToken = token;

    await request(app.getHttpServer())
      .post("/api/v1/auth/kakao/exchange")
      .send({ transactionId, state, code: "auth-code", redirectUri: ALLOWED_REDIRECT_URI })
      .expect(403)
      .expect(({ body }) => {
        expect(body.error.code).toBe("USER_BLOCKED");
      });

    // GAP-075 A ⓐ (negative assertion): the rejected attempt wrote nothing.
    // GAP-076 D ⓑ re-confirms it — the new audit row must not have reopened the
    // `users` write path that round 75 closed (the purge clock is `updated_at`).
    const after = await prisma.user.findUniqueOrThrow({ where: { id: created.id } });
    expect(after.updatedAt).toEqual(STALE_ROW_TIMESTAMP);
    expect(after.lastLoginAt).toEqual(STALE_ROW_TIMESTAMP);
    expect(after.status).toBe("blocked");
    expect(after.displayName).toBe("차단된 사용자");
    expect(after.email).toBeNull();

    // GAP-076 D ⓐ: …and it now leaves a row CS can actually find.
    await expectLoginRejectedRow(created.id, "blocked", {
      sub,
      idToken: token,
      displayName: "차단된닉네임"
    });
  });

  it("rejects login for a withdrawn user without rewinding the retention clock", async () => {
    const sub = `kakao-sub-withdrawn-${randomUUID()}`;
    const created = await prisma.user.create({
      data: {
        authProvider: "kakao",
        providerUserId: sub,
        displayName: "탈퇴한 사용자",
        status: "withdrawn",
        lastLoginAt: STALE_ROW_TIMESTAMP,
        updatedAt: STALE_ROW_TIMESTAMP
      }
    });

    const { transactionId, state, nonce } = await prepare();
    const { token } = await signIdToken(signingKey, {
      sub,
      nonce,
      email: "withdrawn-parent@example.com",
      nickname: "탈퇴한닉네임"
    });
    kakaoClient.nextIdToken = token;

    await request(app.getHttpServer())
      .post("/api/v1/auth/kakao/exchange")
      .send({ transactionId, state, code: "auth-code", redirectUri: ALLOWED_REDIRECT_URI })
      .expect(403)
      .expect(({ body }) => {
        expect(body.error.code).toBe("USER_WITHDRAWN");
      });

    // GAP-075 A ⓐ (negative assertion): `users.updated_at` is the 30-day purge
    // clock for withdrawn accounts (worker/jobs/data-retention-purge.job.ts,
    // phase 3), and the privacy policy / Play account-deletion page promise those
    // 30 days with no "unless you try to log in" caveat. A turned-away attempt
    // must therefore leave both timestamps exactly where they were — otherwise a
    // monthly login attempt keeps the account alive forever. (The purge-side half
    // of this contract lives in data-retention-purge.db.test.ts.)
    const after = await prisma.user.findUniqueOrThrow({ where: { id: created.id } });
    expect(after.updatedAt).toEqual(STALE_ROW_TIMESTAMP);
    expect(after.lastLoginAt).toEqual(STALE_ROW_TIMESTAMP);
    expect(after.status).toBe("withdrawn");
    expect(after.displayName).toBe("탈퇴한 사용자");
    expect(after.email).toBeNull();

    /**
     * GAP-076 D ⓐ: until this round the attempt above left **no queryable trace at
     * all** — CS could not tell a withdrawn account's monthly login attempt from
     * someone who never signed up (the 4xx in the request log has no userId; it is
     * pre-auth). The fix is one `audit_logs` row, not a `users` write: `audit_logs`
     * has no FK to `users` and the purge job's phase 3 anonymizes a withdrawn
     * account's audit rows, so this row does not reopen P-1 (the two timestamp
     * assertions right above are that contract, re-checked from this track).
     */
    await expectLoginRejectedRow(created.id, "withdrawn", {
      sub,
      idToken: token,
      displayName: "탈퇴한닉네임"
    });
  });

  it("does not persist the raw Kakao id_token or leak provider tokens in the response", async () => {
    const { transactionId, state, nonce } = await prepare();
    const { token } = await signIdToken(signingKey, { nonce });
    kakaoClient.nextIdToken = token;

    const response = await request(app.getHttpServer())
      .post("/api/v1/auth/kakao/exchange")
      .send({ transactionId, state, code: "auth-code", redirectUri: ALLOWED_REDIRECT_URI })
      .expect(200);

    const bodyJson = JSON.stringify(response.body);
    expect(bodyJson).not.toContain(token);

    const consumedTx = await prisma.oauthTransaction.findUnique({ where: { id: transactionId } });
    expect(consumedTx?.consumedAt).not.toBeNull();
  });
});
