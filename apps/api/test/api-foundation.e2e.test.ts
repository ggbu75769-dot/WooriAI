import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { randomUUID } from "node:crypto";
import request from "supertest";
import { errorResponseSchema } from "@wooriai/contracts";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AppModule } from "../src/app.module";
import { configureApiApp } from "../src/bootstrap";

describe("API foundation", () => {
  let app: INestApplication;

  beforeEach(async () => {
    process.env.JWT_ACCESS_SECRET = "test-access-secret";
    process.env.JWT_REFRESH_SECRET = "test-refresh-secret";

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule]
    }).compile();

    app = moduleRef.createNestApplication();
    configureApiApp(app);
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it("serves health under the fixed /api/v1 prefix", async () => {
    await request(app.getHttpServer())
      .get("/api/v1/health")
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual({ status: "ok" });
      });

    // CON-121: 라우트 자체가 없을 때의 404(GlobalExceptionFilter 기본값)도 같은
    // 에러 봉투를 쓴다 — 프리픽스 밖 경로가 Nest 기본 형태로 새지 않는지 고정한다.
    await request(app.getHttpServer())
      .get("/health")
      .expect(404)
      .expect(({ body }) => {
        errorResponseSchema.parse(body);
        expect(body.error.code).toBe("NOT_FOUND");
      });
  });

  it("returns OpenAPI-style error responses for validation failures", async () => {
    await request(app.getHttpServer())
      .post("/api/v1/auth/oauth-login")
      .send({ provider: "email", extra: "blocked" })
      .expect(400)
      .expect(({ body }) => {
        // CON-121: 400 대표 케이스 — 공유 계약(errorResponseSchema)이 이 봉투의 단일 소스다.
        errorResponseSchema.parse(body);
        expect(body.error.code).toBe("VALIDATION_ERROR");
        expect(body.error.message).toContain("요청");
        expect(body.error.requestId).toEqual(expect.any(String));
        expect(body.error.details).toEqual(expect.any(Object));
      });
  });

  it("issues dev OAuth token pairs, refreshes them, and protects /me", async () => {
    const loginResponse = await request(app.getHttpServer())
      .post("/api/v1/auth/oauth-login")
      .send({ provider: "kakao", providerToken: `dev-token-${randomUUID()}`, device: { platform: "ios" } })
      .expect(200);

    expect(loginResponse.body).toMatchObject({
      user: {
        displayName: "개발 사용자",
        email: null,
        status: "active"
      },
      tokens: {
        accessToken: expect.any(String),
        refreshToken: expect.any(String),
        expiresIn: 1800
      },
      onboardingRequired: true
    });

    await request(app.getHttpServer())
      .get("/api/v1/me")
      .expect(401)
      .expect(({ body }) => {
        errorResponseSchema.parse(body);
        expect(body.error.code).toBe("UNAUTHORIZED");
      });

    await request(app.getHttpServer())
      .get("/api/v1/me")
      .set("Authorization", `Bearer ${loginResponse.body.tokens.accessToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.user.id).toEqual(expect.any(String));
        expect(body.households).toEqual([
          {
            id: expect.any(String),
            name: "우리 가족",
            role: "owner"
          }
        ]);
      });

    await request(app.getHttpServer())
      .post("/api/v1/auth/refresh")
      .send({ refreshToken: loginResponse.body.tokens.refreshToken })
      .expect(200)
      .expect(({ body }) => {
        expect(body.accessToken).toEqual(expect.any(String));
        expect(body.refreshToken).toEqual(expect.any(String));
        expect(body.expiresIn).toBe(1800);
      });

    await request(app.getHttpServer())
      .post("/api/v1/auth/logout")
      .set("Authorization", `Bearer ${loginResponse.body.tokens.accessToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual({ success: true });
      });
  });

  it("rotates the refresh token on use and rejects reuse of the previous refresh token", async () => {
    const loginResponse = await request(app.getHttpServer())
      .post("/api/v1/auth/oauth-login")
      .send({ provider: "kakao", providerToken: `rotation-user-${randomUUID()}` })
      .expect(200);

    const originalRefreshToken = loginResponse.body.tokens.refreshToken as string;

    const firstRefresh = await request(app.getHttpServer())
      .post("/api/v1/auth/refresh")
      .send({ refreshToken: originalRefreshToken })
      .expect(200);

    const rotatedRefreshToken = firstRefresh.body.refreshToken as string;
    expect(rotatedRefreshToken).not.toBe(originalRefreshToken);

    await request(app.getHttpServer())
      .post("/api/v1/auth/refresh")
      .send({ refreshToken: originalRefreshToken })
      .expect(401)
      .expect(({ body }) => {
        expect(body.error.code).toBe("UNAUTHORIZED");
      });

    // Reuse of an already-rotated token is treated as a stolen/replayed token, so
    // the entire session family is revoked (not just the reused token) — the
    // legitimately-rotated successor token is invalidated too.
    await request(app.getHttpServer())
      .post("/api/v1/auth/refresh")
      .send({ refreshToken: rotatedRefreshToken })
      .expect(401)
      .expect(({ body }) => {
        expect(body.error.code).toBe("UNAUTHORIZED");
      });
  });

  it("invalidates the refresh token passed to logout so it can no longer be refreshed", async () => {
    const loginResponse = await request(app.getHttpServer())
      .post("/api/v1/auth/oauth-login")
      .send({ provider: "kakao", providerToken: `logout-invalidate-user-${randomUUID()}` })
      .expect(200);

    const { accessToken, refreshToken } = loginResponse.body.tokens as {
      accessToken: string;
      refreshToken: string;
    };

    await request(app.getHttpServer())
      .post("/api/v1/auth/logout")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ refreshToken })
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual({ success: true });
      });

    await request(app.getHttpServer())
      .post("/api/v1/auth/refresh")
      .send({ refreshToken })
      .expect(401)
      .expect(({ body }) => {
        expect(body.error.code).toBe("UNAUTHORIZED");
      });
  });
});
