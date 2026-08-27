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

  /**
   * SEC-131: 회전은 매번 refresh 토큰의 만료를 30일 뒤로 다시 민다. 절대 수명 상한이
   * 없으면 로그인 한 번으로 영구 세션이 만들어지므로, family 최초 생성 시각 기준
   * REFRESH_FAMILY_MAX_AGE_DAYS(기본 90일)를 넘기면 회전을 거부한다.
   *
   * 시계 주입 관례가 없는 코드베이스라(가짜 타이머는 Nest 앱 + Postgres 전체를 함께
   * 얼려야 해서 이 스위트에 맞지 않는다) family 생성 시각을 과거로 백데이트한다 —
   * 상한 판정이 읽는 값이 정확히 그 컬럼이라 실제 경로를 그대로 통과한다.
   */
  async function backdateFamily(userId: string, ageDays: number) {
    const startedAt = new Date(Date.now() - ageDays * 24 * 60 * 60 * 1000);
    const updated = await prisma.refreshToken.updateMany({
      where: { userId },
      data: { familyStartedAt: startedAt }
    });
    expect(updated.count).toBeGreaterThan(0);
    return startedAt;
  }

  it("SEC-131: family가 절대 수명 상한을 넘기면 회전을 거부하고 family를 폐기한다", async () => {
    const { userId, refreshToken } = await login("db-rotation-family-max-age");

    // 로그인 직후의 행은 family_started_at이 now라 상한 안이다. 91일 전으로 되돌린다.
    await backdateFamily(userId, 91);

    await request(app.getHttpServer()).post("/api/v1/auth/refresh").send({ refreshToken }).expect(401);

    // 재사용 감지와 마찬가지로 남은 형제 토큰까지 즉시 무효화된다.
    const rows = await prisma.refreshToken.findMany({ where: { userId } });
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((row) => row.revokedAt !== null)).toBe(true);
    // 거부는 회전 *이전*이어야 한다 — 새 토큰 행이 생겨선 안 된다.
    expect(rows).toHaveLength(1);
    expect(rows[0]!.usedAt).toBeNull();
  });

  it("SEC-131: 상한 안이면 정상 회전하고, 새 토큰이 family 최초 생성 시각을 그대로 물려받는다", async () => {
    const { userId, refreshToken } = await login("db-rotation-family-within-max-age");
    const startedAt = await backdateFamily(userId, 89);

    const refreshed = await request(app.getHttpServer())
      .post("/api/v1/auth/refresh")
      .send({ refreshToken })
      .expect(200);
    expect(refreshed.body.refreshToken).not.toBe(refreshToken);

    const rows = await prisma.refreshToken.findMany({ where: { userId }, orderBy: { createdAt: "asc" } });
    expect(rows).toHaveLength(2);
    // 승계가 핵심: 회전 행이 now로 다시 시작하면 상한이 매 회전마다 뒤로 밀려 무의미해진다.
    for (const row of rows) {
      expect(row.familyStartedAt.getTime()).toBe(startedAt.getTime());
    }

    // 그리고 그 승계 덕분에, 이제 상한을 넘긴 family는 회전 결과 토큰으로도 갱신되지 않는다.
    await backdateFamily(userId, 91);
    await request(app.getHttpServer())
      .post("/api/v1/auth/refresh")
      .send({ refreshToken: refreshed.body.refreshToken })
      .expect(401);
  });

  it("SEC-131: 로그인은 family 수명 시계를 지금부터 다시 시작한다", async () => {
    const { userId } = await login("db-rotation-family-login-clock");
    const rows = await prisma.refreshToken.findMany({ where: { userId } });
    expect(rows).toHaveLength(1);
    expect(Date.now() - rows[0]!.familyStartedAt.getTime()).toBeLessThan(60_000);
  });

  it("blocks refresh after logout revokes the token's family", async () => {
    const { userId, accessToken, refreshToken } = await login("db-rotation-logout");

    await request(app.getHttpServer())
      .post("/api/v1/auth/logout")
      .set("Authorization", `Bearer ${accessToken}`)
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
});
