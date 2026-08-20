import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AppModule } from "../src/app.module";
import { configureApiApp } from "../src/bootstrap";

const importStubCategoryId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

async function login(app: INestApplication, providerTokenPrefix: string) {
  const response = await request(app.getHttpServer())
    .post("/api/v1/auth/oauth-login")
    .send({ provider: "kakao", providerToken: `${providerTokenPrefix}-${randomUUID()}` })
    .expect(200);
  return response.body.tokens.accessToken as string;
}

async function completeOnboarding(app: INestApplication, accessToken: string, nickname: string) {
  const householdId = (
    await request(app.getHttpServer()).get("/api/v1/me").set("Authorization", `Bearer ${accessToken}`).expect(200)
  ).body.households[0].id as string;

  await request(app.getHttpServer())
    .put("/api/v1/consents")
    .set("Authorization", `Bearer ${accessToken}`)
    .send({
      consents: [
        { type: "terms", version: "2026-07-06", accepted: true },
        { type: "privacy", version: "2026-07-06", accepted: true }
      ]
    })
    .expect(200);

  const childId = (
    await request(app.getHttpServer())
      .post("/api/v1/children")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ householdId, nickname, stageMode: "manual", manualStage: "infant_4_6" })
      .expect(200)
  ).body.id as string;

  return { childId };
}

/**
 * Covers Round 4 Wave 3's cross-cutting API hardening: security response
 * headers, request-id propagation, the in-memory per-IP rate limiter (global
 * + tighter auth/* ceiling), the 1MB JSON body-size limit, and the
 * Idempotency-Key replay/conflict/concurrency behavior.
 *
 * Isolation: every test gets its own fresh Nest app (beforeEach) so the rate
 * limiter's in-memory bucket Map never carries state between tests, and the
 * RATE_LIMIT_* env overrides used by the rate-limit tests are deleted in
 * afterEach so they can't leak into unrelated tests or files.
 */
describe("Security middleware (rate limit, headers, body size, idempotency)", () => {
  let app: INestApplication;

  beforeEach(async () => {
    process.env.JWT_ACCESS_SECRET = "test-access-secret";
    process.env.JWT_REFRESH_SECRET = "test-refresh-secret";
    process.env.WOORIAI_STAGE_TODAY = "2026-07-06";

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApiApp(app);
    await app.init();
  });

  afterEach(async () => {
    delete process.env.WOORIAI_STAGE_TODAY;
    delete process.env.RATE_LIMIT_GLOBAL_MAX;
    delete process.env.RATE_LIMIT_AUTH_MAX;
    delete process.env.RATE_LIMIT_WINDOW_MS;
    delete process.env.TRUST_PROXY;
    await app.close();
  });

  /**
   * TRUST_PROXY is read once by configureApiApp, so these tests build their
   * own app instance after setting the env var (the shared beforeEach app is
   * always built with TRUST_PROXY unset, i.e. the default-off behavior).
   */
  async function createAppWithCurrentEnv(): Promise<INestApplication> {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    const scopedApp = moduleRef.createNestApplication();
    configureApiApp(scopedApp);
    await scopedApp.init();
    return scopedApp;
  }

  it("returns baseline security headers and a request id on every response", async () => {
    const response = await request(app.getHttpServer()).get("/api/v1/health").expect(200);
    expect(response.headers["x-content-type-options"]).toBe("nosniff");
    expect(response.headers["x-frame-options"]).toBe("DENY");
    expect(response.headers["referrer-policy"]).toBe("no-referrer");
    expect(response.headers["cache-control"]).toBe("no-store");
    expect(response.headers["x-request-id"]).toEqual(expect.any(String));
  });

  it("echoes a caller-supplied x-request-id instead of minting a new one", async () => {
    const requestId = `test-req-${randomUUID()}`;
    const response = await request(app.getHttpServer())
      .get("/api/v1/health")
      .set("x-request-id", requestId)
      .expect(200);
    expect(response.headers["x-request-id"]).toBe(requestId);
  });

  it("429s with a consistent error shape once the global per-IP rate limit is exceeded", async () => {
    process.env.RATE_LIMIT_GLOBAL_MAX = "3";
    process.env.RATE_LIMIT_WINDOW_MS = "60000";

    const statuses: number[] = [];
    let lastBody: unknown;
    for (let i = 0; i < 5; i++) {
      const response = await request(app.getHttpServer()).get("/api/v1/health");
      statuses.push(response.status);
      lastBody = response.body;
    }

    expect(statuses).toEqual([200, 200, 200, 429, 429]);
    expect(lastBody).toMatchObject({ error: { code: "RATE_LIMITED" } });
  });

  it("applies a tighter ceiling to auth/* endpoints than the global limit", async () => {
    process.env.RATE_LIMIT_GLOBAL_MAX = "100";
    process.env.RATE_LIMIT_AUTH_MAX = "2";
    process.env.RATE_LIMIT_WINDOW_MS = "60000";

    const statuses: number[] = [];
    for (let i = 0; i < 4; i++) {
      const response = await request(app.getHttpServer())
        .post("/api/v1/auth/oauth-login")
        .send({ provider: "kakao", providerToken: `rate-limit-auth-${i}-${randomUUID()}` });
      statuses.push(response.status);
    }

    expect(statuses).toEqual([200, 200, 429, 429]);
  });

  it("with TRUST_PROXY=1 keys rate-limit buckets on the X-Forwarded-For client IP, so each attacker hits their own ceiling", async () => {
    process.env.TRUST_PROXY = "1";
    process.env.RATE_LIMIT_GLOBAL_MAX = "3";
    process.env.RATE_LIMIT_WINDOW_MS = "60000";
    const proxiedApp = await createAppWithCurrentEnv();

    try {
      // One forwarded client exhausts only its own bucket...
      const statuses: number[] = [];
      for (let i = 0; i < 4; i++) {
        const response = await request(proxiedApp.getHttpServer())
          .get("/api/v1/health")
          .set("X-Forwarded-For", "203.0.113.10");
        statuses.push(response.status);
      }
      expect(statuses).toEqual([200, 200, 200, 429]);

      // ...while a different forwarded client IP still gets through (separate
      // per-IP bucket — no shared proxy-IP global bucket).
      await request(proxiedApp.getHttpServer())
        .get("/api/v1/health")
        .set("X-Forwarded-For", "203.0.113.11")
        .expect(200);
    } finally {
      await proxiedApp.close();
    }
  });

  it("without TRUST_PROXY ignores X-Forwarded-For entirely — a spoofed header can neither split nor reset buckets", async () => {
    process.env.RATE_LIMIT_GLOBAL_MAX = "3";
    process.env.RATE_LIMIT_WINDOW_MS = "60000";

    // The shared beforeEach app was built with TRUST_PROXY unset (default
    // off): every request keys on the real socket IP, so rotating the header
    // still lands in one bucket.
    const statuses: number[] = [];
    for (let i = 0; i < 4; i++) {
      const response = await request(app.getHttpServer())
        .get("/api/v1/health")
        .set("X-Forwarded-For", `203.0.113.${20 + i}`);
      statuses.push(response.status);
    }
    expect(statuses).toEqual([200, 200, 200, 429]);
  });

  it("rejects a JSON body larger than the 1MB limit with 413", async () => {
    const oversized = "x".repeat(2 * 1024 * 1024);
    const response = await request(app.getHttpServer())
      .post("/api/v1/auth/oauth-login")
      .send({ provider: "kakao", providerToken: oversized });
    expect(response.status).toBe(413);
  });

  it("replays the stored response for a repeated Idempotency-Key + identical body, and 409s when the same key is reused with a different body", async () => {
    const accessToken = await login(app, "idem-basic");
    const { childId } = await completeOnboarding(app, accessToken, "idem-아이");
    const idemKey = `idem-${randomUUID()}`;
    const body = {
      categoryId: importStubCategoryId,
      amountKrw: 5000,
      spentOn: "2026-07-06",
      itemName: "첫 지출"
    };

    const first = await request(app.getHttpServer())
      .post(`/api/v1/children/${childId}/expenses`)
      .set("Authorization", `Bearer ${accessToken}`)
      .set("Idempotency-Key", idemKey)
      .send(body)
      .expect(200);

    const replay = await request(app.getHttpServer())
      .post(`/api/v1/children/${childId}/expenses`)
      .set("Authorization", `Bearer ${accessToken}`)
      .set("Idempotency-Key", idemKey)
      .send(body)
      .expect(200);
    expect(replay.body).toEqual(first.body);

    const conflict = await request(app.getHttpServer())
      .post(`/api/v1/children/${childId}/expenses`)
      .set("Authorization", `Bearer ${accessToken}`)
      .set("Idempotency-Key", idemKey)
      .send({ ...body, amountKrw: 9999 })
      .expect(409);
    expect(conflict.body.error.code).toBe("IDEMPOTENCY_KEY_CONFLICT");

    const expensesResponse = await request(app.getHttpServer())
      .get(`/api/v1/children/${childId}/expenses?yearMonth=2026-07`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);
    expect(expensesResponse.body.expenses).toHaveLength(1);
  });

  it("creates exactly one expense when two concurrent requests share the same Idempotency-Key and body", async () => {
    const accessToken = await login(app, "idem-concurrent");
    const { childId } = await completeOnboarding(app, accessToken, "idem-동시성-아이");
    const idemKey = `idem-concurrent-${randomUUID()}`;
    const body = {
      categoryId: importStubCategoryId,
      amountKrw: 7000,
      spentOn: "2026-07-05",
      itemName: "동시 지출"
    };

    const [first, second] = await Promise.all([
      request(app.getHttpServer())
        .post(`/api/v1/children/${childId}/expenses`)
        .set("Authorization", `Bearer ${accessToken}`)
        .set("Idempotency-Key", idemKey)
        .send(body),
      request(app.getHttpServer())
        .post(`/api/v1/children/${childId}/expenses`)
        .set("Authorization", `Bearer ${accessToken}`)
        .set("Idempotency-Key", idemKey)
        .send(body)
    ]);

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(first.body.id).toBe(second.body.id);

    const expensesResponse = await request(app.getHttpServer())
      .get(`/api/v1/children/${childId}/expenses?yearMonth=2026-07`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);
    expect(expensesResponse.body.expenses).toHaveLength(1);
  });
});
