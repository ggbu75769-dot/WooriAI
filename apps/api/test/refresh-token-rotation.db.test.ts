import { randomUUID } from "node:crypto";
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { PrismaClient } from "@prisma/client";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AppModule } from "../src/app.module";
import { configureApiApp } from "../src/bootstrap";
import { deployMigrations, isDatabaseAvailable } from "./helpers/test-db";

const dbAvailable = await isDatabaseAvailable();

describe.skipIf(!dbAvailable)("Refresh token rotation (real Postgres)", () => {
  let app: INestApplication;
  let prisma: PrismaClient;

  beforeAll(async () => {
    deployMigrations();
    prisma = new PrismaClient();

    process.env.JWT_ACCESS_SECRET = "test-access-secret";
    process.env.JWT_REFRESH_SECRET = "test-refresh-secret";

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApiApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  // Other e2e suites also log in via oauth-login and now persist real refresh_tokens
  // rows once DATABASE_URL is set, and vitest runs test files in parallel — so
  // assertions here must always be scoped to *this test's own* userId, never a bare
  // table-wide count/findMany. A random suffix per call keeps each test's
  // deterministic dev-user id unique across runs (no stale-row collisions) without
  // needing a destructive table truncate, which would break other suites running
  // concurrently against the same database.
  async function login(providerTokenPrefix: string) {
    const providerToken = `${providerTokenPrefix}-${randomUUID()}`;
    const response = await request(app.getHttpServer())
      .post("/api/v1/auth/oauth-login")
      .send({ provider: "kakao", providerToken })
      .expect(200);
    return {
      userId: response.body.user.id as string,
      accessToken: response.body.tokens.accessToken as string,
      refreshToken: response.body.tokens.refreshToken as string
    };
  }

  it("persists a refresh_tokens row on login and rotates it on refresh", async () => {
    const { userId, refreshToken } = await login("db-rotation-normal");

    // userId is derived from a random-suffixed providerToken (see login() above),
    // so it is effectively unique to this test run — no other suite or prior run
    // could have written a refresh_tokens row for it.
    const rowsBeforeRefresh = await prisma.refreshToken.findMany({ where: { userId } });
    expect(rowsBeforeRefresh).toHaveLength(1);
    expect(rowsBeforeRefresh[0]!.usedAt).toBeNull();

    const refreshed = await request(app.getHttpServer())
      .post("/api/v1/auth/refresh")
      .send({ refreshToken })
      .expect(200);

    const rowsAfterRefresh = await prisma.refreshToken.findMany({ where: { userId } });
    expect(rowsAfterRefresh).toHaveLength(2);
    const oldRow = rowsAfterRefresh.find((row) => row.id === rowsBeforeRefresh[0]!.id)!;
    expect(oldRow.usedAt).not.toBeNull();
    expect(refreshed.body.refreshToken).not.toBe(refreshToken);
  });

  it("rejects reuse of an already-rotated refresh token and revokes the whole family", async () => {
    const { userId, refreshToken: originalRefreshToken } = await login("db-rotation-reuse");

    const firstRefresh = await request(app.getHttpServer())
      .post("/api/v1/auth/refresh")
      .send({ refreshToken: originalRefreshToken })
      .expect(200);
    const rotatedRefreshToken = firstRefresh.body.refreshToken as string;

    // Reusing the original (already-consumed) token must be rejected...
    await request(app.getHttpServer())
      .post("/api/v1/auth/refresh")
      .send({ refreshToken: originalRefreshToken })
      .expect(401);

    // ...and must revoke the entire family, so even the legitimately-rotated
    // successor token can no longer be redeemed.
    await request(app.getHttpServer())
      .post("/api/v1/auth/refresh")
      .send({ refreshToken: rotatedRefreshToken })
      .expect(401);

    const rows = await prisma.refreshToken.findMany({ where: { userId } });
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((row) => row.revokedAt !== null)).toBe(true);
  });

  it("blocks refresh after refresh-authenticated logout without a bearer", async () => {
    const { userId, refreshToken } = await login("db-rotation-logout");

    await request(app.getHttpServer())
      .post("/api/v1/auth/logout/refresh")
      .send({ refreshToken })
      .expect(200);

    await request(app.getHttpServer())
      .post("/api/v1/auth/refresh")
      .send({ refreshToken })
      .expect(401);

    const rows = await prisma.refreshToken.findMany({ where: { userId } });
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((row) => row.revokedAt !== null)).toBe(true);
  });

  it("does not let one user's bearer revoke another user's refresh family", async () => {
    const userA = await login("db-rotation-cross-user-a");
    const userB = await login("db-rotation-cross-user-b");

    await request(app.getHttpServer())
      .post("/api/v1/auth/logout")
      .set("Authorization", `Bearer ${userA.accessToken}`)
      .send({ refreshToken: userB.refreshToken })
      .expect(200);

    const refreshedB = await request(app.getHttpServer())
      .post("/api/v1/auth/refresh")
      .send({ refreshToken: userB.refreshToken })
      .expect(200);

    expect(refreshedB.body.accessToken).toEqual(expect.any(String));
    const rows = await prisma.refreshToken.findMany({ where: { userId: userB.userId } });
    expect(rows.some((row) => row.revokedAt === null)).toBe(true);
  });

  it("revokes the whole family when logout carries the pre-rotation refresh token", async () => {
    const session = await login("db-rotation-logout-after-refresh");
    const rotated = await request(app.getHttpServer())
      .post("/api/v1/auth/refresh")
      .send({ refreshToken: session.refreshToken })
      .expect(200);

    await request(app.getHttpServer())
      .post("/api/v1/auth/logout")
      .set("Authorization", `Bearer ${rotated.body.accessToken}`)
      .send({ refreshToken: session.refreshToken })
      .expect(200);

    await request(app.getHttpServer())
      .post("/api/v1/auth/refresh")
      .send({ refreshToken: rotated.body.refreshToken })
      .expect(401);
  });
});
