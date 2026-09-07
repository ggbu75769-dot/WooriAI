import { Logger, type INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppModule } from "../src/app.module";
import { configureApiApp } from "../src/bootstrap";
import { PrismaService } from "../src/prisma/prisma.service";

const importStubCategoryId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

/**
 * SEC-133 블록의 로그인이 쓰는 provider 토큰 접두. `ensureDevUser`가 그 토큰을 그대로
 * `users.provider_user_id`에 넣으므로(households/household-runtime.service.ts), 이 접두 하나로
 * **이 스위트가 만든 계정만** 되찾아 지울 수 있다 — 다른 스위트의 사용자는 절대 걸리지 않는다.
 * 정리를 두는 이유: dev 로그인 한 번은 users·households·household_members·refresh_tokens·
 * audit_logs 다섯 표에 행을 남기고, 공유 test DB는 실행 사이에 초기화되지 않는다.
 */
const PRODUCT_LINK_CLICK_LOGIN_PREFIX = "sec133-click";

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
    delete process.env.RATE_LIMIT_REDIRECT_MAX;
    delete process.env.RATE_LIMIT_ANALYTICS_MAX;
    delete process.env.RATE_LIMIT_ANALYTICS_USER_MAX;
    delete process.env.RATE_LIMIT_PRODUCT_LINK_CLICK_MAX;
    delete process.env.RATE_LIMIT_PRODUCT_LINK_CLICK_USER_MAX;
    delete process.env.RATE_LIMIT_WINDOW_MS;
    delete process.env.TRUST_PROXY;
    await app.close();
    await purgeOwnLoginRows();
  });

  /**
   * 이 스위트가 만든 로그인 계정과 그 딸린 행만 지운다(자기 접두 스윕).
   * FK 순서: audit_logs·refresh_tokens는 컬럼만 있고 FK가 없어 먼저 지워도 되고,
   * household_members → households → users는 안쪽부터 끊는다.
   * 실패해도 테스트를 떨어뜨리지 않는다 — 정리는 단언이 아니다.
   */
  async function purgeOwnLoginRows() {
    const prisma = new PrismaService();
    try {
      await prisma.$connect();
      const users = await prisma.user.findMany({
        where: { providerUserId: { startsWith: PRODUCT_LINK_CLICK_LOGIN_PREFIX } },
        select: { id: true }
      });
      if (users.length === 0) return;
      const userIds = users.map((user) => user.id);
      const members = await prisma.householdMember.findMany({ where: { userId: { in: userIds } }, select: { householdId: true } });
      await prisma.auditLog.deleteMany({ where: { actorUserId: { in: userIds } } });
      await prisma.refreshToken.deleteMany({ where: { userId: { in: userIds } } });
      await prisma.householdMember.deleteMany({ where: { userId: { in: userIds } } });
      const householdIds = [...new Set(members.map((member) => member.householdId))];
      if (householdIds.length > 0) {
        // 다른 사람이 아직 속해 있는 가구는 남긴다(이 스위트는 1인 가구만 만든다).
        const shared = await prisma.householdMember.findMany({ where: { householdId: { in: householdIds } }, select: { householdId: true } });
        const sharedIds = new Set(shared.map((member) => member.householdId));
        await prisma.household.deleteMany({ where: { id: { in: householdIds.filter((id) => !sharedIds.has(id)) } } });
      }
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    } finally {
      await prisma.$disconnect();
    }
  }

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

  // SEC-115 F3: the public affiliate redirect performs an affiliate_clicks
  // INSERT per request, so it gets its own tighter per-IP bucket on top of the
  // global ceiling. The middleware matches on path prefix before routing, so
  // an unknown code (404) exercises the bucket without needing a seeded link.
  it("applies a dedicated tighter ceiling to the affiliate redirect /r/* than the global limit", async () => {
    process.env.RATE_LIMIT_GLOBAL_MAX = "100";
    process.env.RATE_LIMIT_REDIRECT_MAX = "2";
    process.env.RATE_LIMIT_WINDOW_MS = "60000";

    const statuses: number[] = [];
    let lastBody: unknown;
    for (let i = 0; i < 4; i++) {
      const response = await request(app.getHttpServer()).get("/api/v1/r/sec115-rate-limit-code").redirects(0);
      statuses.push(response.status);
      lastBody = response.body;
    }

    expect(statuses).toEqual([404, 404, 429, 429]);
    expect(lastBody).toMatchObject({ error: { code: "RATE_LIMITED" } });

    // The redirect bucket must not throttle the rest of the API.
    await request(app.getHttpServer()).get("/api/v1/health").expect(200);
  });

  // SEC-130: POST /api/v1/analytics/events inserts up to 50 analytics_events
  // rows per request — by far the highest write amplification in the API — so
  // it gets its own tighter per-IP bucket on top of the global ceiling. The
  // middleware runs before Nest's router/guards, so unauthenticated requests
  // (401) exercise the bucket without needing a login.
  it("applies a dedicated tighter ceiling to POST analytics/events than the global limit", async () => {
    process.env.RATE_LIMIT_GLOBAL_MAX = "100";
    process.env.RATE_LIMIT_ANALYTICS_MAX = "2";
    process.env.RATE_LIMIT_WINDOW_MS = "60000";

    const statuses: number[] = [];
    let lastBody: unknown;
    for (let i = 0; i < 4; i++) {
      const response = await request(app.getHttpServer()).post("/api/v1/analytics/events").send({ events: [] });
      statuses.push(response.status);
      lastBody = response.body;
    }

    expect(statuses).toEqual([401, 401, 429, 429]);
    expect(lastBody).toMatchObject({ error: { code: "RATE_LIMITED" } });

    // The analytics bucket must not throttle the rest of the API...
    await request(app.getHttpServer()).get("/api/v1/health").expect(200);
    // ...and it is method-scoped: a non-POST request to the same path is not
    // a batch insert, so it must not be charged to the write budget.
    const nonPost = await request(app.getHttpServer()).get("/api/v1/analytics/events");
    expect(nonPost.status).not.toBe(429);
  });

  // SEC-132: the per-IP analytics bucket is both too coarse (carrier NAT puts
  // many honest users in one bucket) and too narrow (an IP is attacker-chosen,
  // so one token replayed across rotating IPs never fills any single bucket --
  // the acknowledged residual of the Round 30 P3 review). A companion bucket
  // keyed on the *verified* JWT subject closes both gaps; the two are ANDed.
  //
  // These tests log in before setting the RATE_LIMIT_* overrides so the login
  // round-trips themselves aren't charged against the tiny ceilings.
  describe("SEC-132 per-account analytics bucket", () => {
    it("429s a single account that exceeds its own ceiling, without touching another account sharing the same IP", async () => {
      const abuserToken = await login(app, "sec132-abuser");
      const bystanderToken = await login(app, "sec132-bystander");

      process.env.RATE_LIMIT_GLOBAL_MAX = "200";
      // Deliberately roomy: this test must be failed by the ACCOUNT bucket, so
      // the IP bucket (shared by both users here) can't be what rejects.
      process.env.RATE_LIMIT_ANALYTICS_MAX = "200";
      process.env.RATE_LIMIT_ANALYTICS_USER_MAX = "2";
      process.env.RATE_LIMIT_WINDOW_MS = "60000";

      const statuses: number[] = [];
      let lastBody: unknown;
      for (let i = 0; i < 4; i++) {
        const response = await request(app.getHttpServer())
          .post("/api/v1/analytics/events")
          .set("Authorization", `Bearer ${abuserToken}`)
          .send({ events: [] });
        statuses.push(response.status);
        lastBody = response.body;
      }
      expect(statuses).toEqual([200, 200, 429, 429]);
      expect(lastBody).toMatchObject({ error: { code: "RATE_LIMITED" } });

      // Same IP, different account: its own budget is untouched.
      await request(app.getHttpServer())
        .post("/api/v1/analytics/events")
        .set("Authorization", `Bearer ${bystanderToken}`)
        .send({ events: [] })
        .expect(200);

      // ...and the account bucket is scoped to this one endpoint.
      await request(app.getHttpServer())
        .get("/api/v1/me")
        .set("Authorization", `Bearer ${abuserToken}`)
        .expect(200);
    });

    it("still enforces the per-IP ceiling when the requests come from different accounts (the two buckets are independent, ANDed)", async () => {
      const firstToken = await login(app, "sec132-ip-first");
      const secondToken = await login(app, "sec132-ip-second");

      process.env.RATE_LIMIT_GLOBAL_MAX = "200";
      process.env.RATE_LIMIT_ANALYTICS_MAX = "2";
      // Roomy the other way round: only the IP bucket can reject here.
      process.env.RATE_LIMIT_ANALYTICS_USER_MAX = "200";
      process.env.RATE_LIMIT_WINDOW_MS = "60000";

      const statuses: number[] = [];
      for (const token of [firstToken, secondToken, firstToken, secondToken]) {
        const response = await request(app.getHttpServer())
          .post("/api/v1/analytics/events")
          .set("Authorization", `Bearer ${token}`)
          .send({ events: [] });
        statuses.push(response.status);
      }
      // Rotating accounts does not mint a fresh IP bucket: the third request
      // from this IP is rejected no matter whose token it carries.
      expect(statuses).toEqual([200, 200, 429, 429]);
    });

    it("ignores an unsigned/forged Authorization header, so nobody can burn another account's budget (and unauthenticated calls are charged to no account)", async () => {
      const victimToken = await login(app, "sec132-victim");
      const [header, payload] = victimToken.split(".");
      // Same (real) payload -- i.e. the victim's `sub` -- with a signature the
      // attacker cannot produce. If the middleware parsed `sub` without
      // verifying the HMAC, these would drain the victim's bucket; worse, an
      // attacker could also forge a fresh `sub` per request for unlimited
      // buckets. Neither may happen: an unverifiable token gets no bucket.
      const forgedToken = `${header}.${payload}.dGhpcy1pcy1ub3QtYS12YWxpZC1zaWduYXR1cmU`;

      process.env.RATE_LIMIT_GLOBAL_MAX = "200";
      process.env.RATE_LIMIT_ANALYTICS_MAX = "200";
      process.env.RATE_LIMIT_ANALYTICS_USER_MAX = "1";
      process.env.RATE_LIMIT_WINDOW_MS = "60000";

      for (const authorization of [`Bearer ${forgedToken}`, "Bearer not-even-a-jwt", null]) {
        const pending = request(app.getHttpServer()).post("/api/v1/analytics/events").send({ events: [] });
        const response = await (authorization ? pending.set("Authorization", authorization) : pending);
        expect(response.status).toBe(401);
      }

      // The victim's single-request budget survived all three attempts...
      await request(app.getHttpServer())
        .post("/api/v1/analytics/events")
        .set("Authorization", `Bearer ${victimToken}`)
        .send({ events: [] })
        .expect(200);
      // ...and is then genuinely spent by the victim's own second request.
      await request(app.getHttpServer())
        .post("/api/v1/analytics/events")
        .set("Authorization", `Bearer ${victimToken}`)
        .send({ events: [] })
        .expect(429);
    });
  });

  // SEC-133: 인증된 POST product-links/:id/click도 요청 1건이 affiliate_clicks 행 1건이다
  // (onboarding/items-catalog.service.ts의 clickProductLink — 유니크 제약도 멱등 인터셉터도
  // 없다). 공개 리다이렉트 /r/*가 바로 그 이유로 이미 전용 버킷을 갖고 있는데 인증된 쪽만
  // 전역 상한 아래 있었고, 그 표가 어드민 KPI(affiliateClicks7d · 플랫폼별 분해)를 그대로
  // 먹인다. 값의 산출 근거는 rate-limit.middleware.ts의 PRODUCT_LINK_CLICK_PATH_PATTERN 머리말.
  //
  // 미들웨어는 Nest 라우터/가드보다 **앞**에서 돌기 때문에, IP 버킷은 비인증 요청(401)만으로도
  // 그대로 재진다 — 픽스처도 로그인도 DB 행도 필요 없다.
  describe("SEC-133 인증 클릭(POST product-links/:id/click) 전용 버킷", () => {
    const CLICK_PATH = `/api/v1/product-links/${randomUUID()}/click`;

    it("전역 상한보다 먼저 자기 IP 상한에서 429가 되고, 나머지 API는 건드리지 않는다", async () => {
      process.env.RATE_LIMIT_GLOBAL_MAX = "100";
      process.env.RATE_LIMIT_PRODUCT_LINK_CLICK_MAX = "2";
      process.env.RATE_LIMIT_WINDOW_MS = "60000";

      const statuses: number[] = [];
      let lastBody: unknown;
      for (let i = 0; i < 4; i++) {
        const response = await request(app.getHttpServer()).post(CLICK_PATH).send({ childId: randomUUID() });
        statuses.push(response.status);
        lastBody = response.body;
      }
      expect(statuses).toEqual([401, 401, 429, 429]);
      expect(lastBody).toMatchObject({ error: { code: "RATE_LIMITED" } });

      // 클릭 버킷이 나머지 API를 조르지 않는다...
      await request(app.getHttpServer()).get("/api/v1/health").expect(200);
      // ...메서드까지 좁혀져 있다: 행을 만드는 것은 POST뿐이다.
      const nonPost = await request(app.getHttpServer()).get(CLICK_PATH);
      expect(nonPost.status).not.toBe(429);
      // ...그리고 경로가 `^` 고정이라 어드민 카탈로그 경로는 이 예산에 청구되지 않는다
      // (그쪽은 클릭 행을 만들지 않는다).
      const adminPath = await request(app.getHttpServer()).post("/api/v1/admin/product-links").send({});
      expect(adminPath.status).not.toBe(429);
    });

    /**
     * 계정 버킷. IP만으로는 IP를 돌리는 순간 상한이 사라진다(SEC-132가 "Round 30 P3의 잔여"로
     * 적어 둔 그 구멍) — 이 경로는 그 결과가 더 직접적이라 같은 짝을 세운다.
     *
     * 로그인을 **먼저** 하고 그 뒤에 RATE_LIMIT_* 를 세팅한다: 로그인 왕복 자체가 좁은 상한에
     * 청구되지 않게 하기 위해서다(SEC-132 블록과 같은 순서).
     */
    it("한 계정이 자기 상한을 넘겨도 같은 IP의 다른 계정 예산은 그대로다", async () => {
      const abuserToken = await login(app, PRODUCT_LINK_CLICK_LOGIN_PREFIX);
      const bystanderToken = await login(app, PRODUCT_LINK_CLICK_LOGIN_PREFIX);

      process.env.RATE_LIMIT_GLOBAL_MAX = "200";
      // 일부러 넉넉히: 이 테스트를 떨어뜨리는 것은 **계정** 버킷이어야 한다.
      process.env.RATE_LIMIT_PRODUCT_LINK_CLICK_MAX = "200";
      process.env.RATE_LIMIT_PRODUCT_LINK_CLICK_USER_MAX = "2";
      process.env.RATE_LIMIT_WINDOW_MS = "60000";

      const statuses: number[] = [];
      for (let i = 0; i < 4; i++) {
        const response = await request(app.getHttpServer())
          .post(CLICK_PATH)
          .set("Authorization", `Bearer ${abuserToken}`)
          .send({ childId: randomUUID() });
        statuses.push(response.status);
      }
      // 앞의 둘은 자기 아이가 아니라 404로 끝나지만 **행은 이미 청구됐다**(미들웨어가 먼저다).
      expect(statuses.slice(0, 2).every((status) => status !== 429)).toBe(true);
      expect(statuses.slice(2)).toEqual([429, 429]);

      // 같은 IP, 다른 계정: 자기 예산은 그대로다.
      const bystander = await request(app.getHttpServer())
        .post(CLICK_PATH)
        .set("Authorization", `Bearer ${bystanderToken}`)
        .send({ childId: randomUUID() });
      expect(bystander.status).not.toBe(429);

      // ...그리고 계정 버킷은 이 끝점 하나에만 걸린다.
      await request(app.getHttpServer()).get("/api/v1/me").set("Authorization", `Bearer ${abuserToken}`).expect(200);
    });

    it("계정을 갈아 끼워도 IP 상한은 그대로 선다 (두 버킷은 독립이고 AND로 묶인다)", async () => {
      const firstToken = await login(app, PRODUCT_LINK_CLICK_LOGIN_PREFIX);
      const secondToken = await login(app, PRODUCT_LINK_CLICK_LOGIN_PREFIX);

      process.env.RATE_LIMIT_GLOBAL_MAX = "200";
      process.env.RATE_LIMIT_PRODUCT_LINK_CLICK_MAX = "2";
      // 반대로 넉넉히: 여기서 떨어뜨리는 것은 **IP** 버킷이어야 한다.
      process.env.RATE_LIMIT_PRODUCT_LINK_CLICK_USER_MAX = "200";
      process.env.RATE_LIMIT_WINDOW_MS = "60000";

      const statuses: number[] = [];
      for (const token of [firstToken, secondToken, firstToken, secondToken]) {
        const response = await request(app.getHttpServer())
          .post(CLICK_PATH)
          .set("Authorization", `Bearer ${token}`)
          .send({ childId: randomUUID() });
        statuses.push(response.status);
      }
      expect(statuses.slice(0, 2).every((status) => status !== 429)).toBe(true);
      expect(statuses.slice(2)).toEqual([429, 429]);
    });
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

  it("with TRUST_PROXY=1 a multi-entry X-Forwarded-For buckets on the RIGHTMOST entry — the forged prefix is ignored (pins `trust proxy = 1`, would fail under `trust proxy = true`)", async () => {
    process.env.TRUST_PROXY = "1";
    process.env.RATE_LIMIT_GLOBAL_MAX = "3";
    process.env.RATE_LIMIT_WINDOW_MS = "60000";
    const proxiedApp = await createAppWithCurrentEnv();

    try {
      // `trust proxy = 1` trusts exactly one hop (the connecting socket, i.e.
      // our reverse proxy): only the RIGHTMOST X-Forwarded-For entry — the
      // one that trusted hop appended — is honored as the client IP; every
      // entry left of it is attacker-supplied text and must be ignored.
      const statuses: number[] = [];
      for (let i = 0; i < 3; i++) {
        const response = await request(proxiedApp.getHttpServer())
          .get("/api/v1/health")
          .set("X-Forwarded-For", "6.6.6.6, 203.0.113.10");
        statuses.push(response.status);
      }
      expect(statuses).toEqual([200, 200, 200]);

      // Rotating the forged prefix must NOT mint a fresh bucket. Under
      // `trust proxy = true` Express would take the LEFTMOST entry (7.7.7.7,
      // fully attacker-controlled) as req.ip and this request would be 200 —
      // this assertion is the regression tripwire against that switch.
      const rotatedPrefix = await request(proxiedApp.getHttpServer())
        .get("/api/v1/health")
        .set("X-Forwarded-For", "7.7.7.7, 203.0.113.10");
      expect(rotatedPrefix.status).toBe(429);

      // A different RIGHTMOST entry is a genuinely different client behind
      // the trusted hop: separate bucket, still admitted.
      await request(proxiedApp.getHttpServer())
        .get("/api/v1/health")
        .set("X-Forwarded-For", "6.6.6.6, 203.0.113.99")
        .expect(200);
    } finally {
      await proxiedApp.close();
    }
  });

  it("warns about an unrecognized TRUST_PROXY value and keeps trust proxy OFF (\"0\"/empty stay silently off)", async () => {
    process.env.RATE_LIMIT_GLOBAL_MAX = "3";
    process.env.RATE_LIMIT_WINDOW_MS = "60000";
    const warnSpy = vi.spyOn(Logger.prototype, "warn");
    const isTrustProxyWarn = (call: unknown[]) => String(call[0]).includes("TRUST_PROXY=");

    process.env.TRUST_PROXY = "yes";
    const unrecognizedApp = await createAppWithCurrentEnv();
    try {
      expect(warnSpy.mock.calls.some(isTrustProxyWarn)).toBe(true);
      expect(warnSpy.mock.calls.find(isTrustProxyWarn)?.[0]).toContain('TRUST_PROXY="yes"');

      // Behaviorally OFF: rotating X-Forwarded-For neither splits nor resets
      // buckets — same as the unset default.
      const statuses: number[] = [];
      for (let i = 0; i < 4; i++) {
        const response = await request(unrecognizedApp.getHttpServer())
          .get("/api/v1/health")
          .set("X-Forwarded-For", `203.0.113.${30 + i}`);
        statuses.push(response.status);
      }
      expect(statuses).toEqual([200, 200, 200, 429]);
    } finally {
      await unrecognizedApp.close();
    }

    // Explicit off ("0") is intentional configuration — no warning.
    warnSpy.mockClear();
    process.env.TRUST_PROXY = "0";
    const explicitOffApp = await createAppWithCurrentEnv();
    try {
      expect(warnSpy.mock.calls.some(isTrustProxyWarn)).toBe(false);
    } finally {
      warnSpy.mockRestore();
      await explicitOffApp.close();
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
