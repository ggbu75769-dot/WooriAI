import { createHash, randomUUID } from "node:crypto";
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { PrismaClient } from "@prisma/client";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { AppModule } from "../src/app.module";
import { configureApiApp } from "../src/bootstrap";
import { deployMigrations, isDatabaseAvailable } from "./helpers/test-db";

const dbAvailable = await isDatabaseAvailable();
const categoryId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

// Mirrors of the interceptor's private constants (src/common/idempotency/
// idempotency.interceptor.ts). If these drift, the timing assertions below
// will say so explicitly instead of failing mysteriously.
const PENDING_TTL_MS = 60 * 1000;
const WAIT_BUDGET_MS = 60 * 50; // RETRY_ATTEMPTS * RETRY_INTERVAL_MS ≈ 3s

/**
 * COV-T2: IdempotencyInterceptor 동시성·만료·실패 복구 분기 커버리지.
 *
 * Exercises src/common/idempotency/idempotency.interceptor.ts end-to-end
 * through POST /api/v1/children/:childId/expenses (and PATCH
 * /api/v1/expenses/:id for the endpoint-scoping case), the same way mobile
 * retries hit it in production. Measured/verified behaviors:
 *
 *  - Sequential replay: same key + same body → the first response body is
 *    replayed verbatim, handler runs once (one expense row).
 *  - Body mismatch: same key + different body → 409 IDEMPOTENCY_KEY_CONFLICT
 *    immediately (reserve() conflict branch).
 *  - Concurrency: N racing requests with the same key → exactly one wins the
 *    unique-constraint INSERT and runs the handler; the losers short-poll
 *    (50ms × 60) until the winner's response is persisted and then all replay
 *    the identical body with the route's normal status (200). Exactly one
 *    expense row exists afterward.
 *  - Crash recovery: a pending reservation row (statusCode NULL) left behind
 *    by a died process blocks the key only until PENDING_TTL (60s). A stale
 *    (expired) pending row is reclaimed and the retry proceeds; a fresh
 *    pending row with the same body makes the retry wait the full ~3s poll
 *    budget and then fail 409 ("아직 처리 중"); a fresh pending row with a
 *    different body 409s immediately.
 *  - Completed-key expiry: after the 24h expiresAt passes, the same key+body
 *    is treated as a brand-new request (handler runs again).
 *  - Endpoint scoping: the unique key is (userId, endpoint, idemKey), so the
 *    same Idempotency-Key on two different endpoints is independent.
 *  - Failure recovery: a request that errors inside the handler pipeline
 *    deletes its reservation, so a corrected retry with the same key executes
 *    instead of replaying the failure.
 */
describe.skipIf(!dbAvailable)("IdempotencyInterceptor 동시성/만료/복구 (real Postgres)", () => {
  let app: INestApplication;
  let prisma: PrismaClient;

  beforeAll(async () => {
    deployMigrations();
    process.env.JWT_ACCESS_SECRET = "test-access-secret";
    process.env.JWT_REFRESH_SECRET = "test-refresh-secret";
    process.env.WOORIAI_STAGE_TODAY = "2026-07-06";

    prisma = new PrismaClient();
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApiApp(app);
    await app.init();
  });

  afterAll(async () => {
    delete process.env.WOORIAI_STAGE_TODAY;
    await app.close();
    await prisma.$disconnect();
  });

  async function login(prefix: string) {
    const providerToken = `${prefix}-${randomUUID()}`;
    const response = await request(app.getHttpServer())
      .post("/api/v1/auth/oauth-login")
      .send({ provider: "kakao", providerToken })
      .expect(200);
    return {
      userId: response.body.user.id as string,
      accessToken: response.body.tokens.accessToken as string
    };
  }

  async function completeOnboarding(accessToken: string, nickname: string) {
    const householdId = (
      await request(app.getHttpServer())
        .get("/api/v1/me")
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(200)
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

    return { householdId, childId };
  }

  function expenseBody(itemName: string, amountKrw = 12000) {
    return { categoryId, amountKrw, spentOn: "2026-07-06", itemName };
  }

  function postExpense(accessToken: string, childId: string, idemKey: string, body: Record<string, unknown>) {
    return request(app.getHttpServer())
      .post(`/api/v1/children/${childId}/expenses`)
      .set("Authorization", `Bearer ${accessToken}`)
      .set("Idempotency-Key", idemKey)
      .send(body);
  }

  function expenseCount(childId: string, itemName: string) {
    return prisma.expense.count({ where: { childId, itemName } });
  }

  function idemRows(userId: string, idemKey: string) {
    return prisma.idempotencyKey.findMany({ where: { userId, idemKey } });
  }

  /** The exact requestHash recipe the interceptor uses (actual URL + raw body JSON). */
  function requestHashFor(actualPath: string, body: Record<string, unknown>) {
    return createHash("sha256").update(`${actualPath}\n${JSON.stringify(body)}`).digest("hex");
  }

  it("(a) 같은 키 + 같은 본문 순차 2회 → 동일 응답 재생, expense 1건", async () => {
    const { userId, accessToken } = await login("idem-sequential");
    const { childId } = await completeOnboarding(accessToken, "멱등-순차");
    const idemKey = `idem-a-${randomUUID()}`;
    const itemName = `순차 기저귀 ${randomUUID()}`;
    const body = expenseBody(itemName);

    const first = await postExpense(accessToken, childId, idemKey, body).expect(200);
    const second = await postExpense(accessToken, childId, idemKey, body).expect(200);

    expect(first.body.id).toEqual(expect.any(String));
    // Replay is byte-for-byte the stored first response, including the id.
    expect(second.body).toEqual(first.body);

    await expect(expenseCount(childId, itemName)).resolves.toBe(1);

    const rows = await idemRows(userId, idemKey);
    expect(rows).toHaveLength(1);
    expect(rows[0].statusCode).toBe(200);
    expect(rows[0].endpoint).toBe("POST:/api/v1/children/:childId/expenses");
    // Hash covers the *actual* URL (childId substituted) + the raw JSON body.
    expect(rows[0].requestHash).toBe(requestHashFor(`/api/v1/children/${childId}/expenses`, body));
    // Completed rows live for the 24h replay window.
    expect(rows[0].expiresAt.getTime()).toBeGreaterThan(Date.now() + 23 * 60 * 60 * 1000);
  });

  it("(b) 같은 키 + 다른 본문 → 409 IDEMPOTENCY_KEY_CONFLICT, 재실행 없음", async () => {
    const { accessToken } = await login("idem-conflict");
    const { childId } = await completeOnboarding(accessToken, "멱등-충돌");
    const idemKey = `idem-b-${randomUUID()}`;
    const itemName = `충돌 젖병 ${randomUUID()}`;
    const otherItemName = `충돌 다른본문 ${randomUUID()}`;

    await postExpense(accessToken, childId, idemKey, expenseBody(itemName)).expect(200);

    const conflict = await postExpense(accessToken, childId, idemKey, expenseBody(otherItemName, 99000)).expect(409);
    expect(conflict.body.error.code).toBe("IDEMPOTENCY_KEY_CONFLICT");
    expect(conflict.body.error.message).toContain("다른 요청 본문");

    await expect(expenseCount(childId, itemName)).resolves.toBe(1);
    await expect(expenseCount(childId, otherItemName)).resolves.toBe(0);
  });

  it("(c) 진짜 동시 같은 키 5연발 → 정확히 1건 생성, 나머지는 승자 응답을 재생", async () => {
    const { userId, accessToken } = await login("idem-race");
    const { childId } = await completeOnboarding(accessToken, "멱등-동시");
    const idemKey = `idem-c-${randomUUID()}`;
    const itemName = `동시 유모차 ${randomUUID()}`;
    const body = expenseBody(itemName, 350000);

    const responses = await Promise.all(
      Array.from({ length: 5 }, () => postExpense(accessToken, childId, idemKey, body))
    );

    // Measured behavior: no request is rejected. One wins the reservation
    // INSERT and executes the handler; the 4 losers poll waitForCompletion()
    // and replay the winner's stored body — all 5 end up 200 with an
    // identical response (interceptor doc's "double-fire creates one expense"
    // guarantee).
    expect(responses.map((r) => r.status)).toEqual([200, 200, 200, 200, 200]);
    const bodies = responses.map((r) => r.body);
    for (const b of bodies) {
      expect(b).toEqual(bodies[0]);
    }
    expect(bodies[0].id).toEqual(expect.any(String));

    // Exactly one expense row and exactly one idempotency row.
    await expect(expenseCount(childId, itemName)).resolves.toBe(1);
    const rows = await idemRows(userId, idemKey);
    expect(rows).toHaveLength(1);
    expect(rows[0].statusCode).toBe(200);
  });

  it("(d-1) PENDING_TTL 지난 stale pending 행(크래시 잔재) → 회수하고 정상 진행", async () => {
    const { userId, accessToken } = await login("idem-stale-pending");
    const { childId } = await completeOnboarding(accessToken, "멱등-스테일");
    const itemName = `스테일 복구 ${randomUUID()}`;
    const body = expenseBody(itemName);

    // Prime with a sibling key to learn the exact endpoint string the
    // interceptor records (and to sanity-check our hash recipe).
    const primerKey = `idem-d1-primer-${randomUUID()}`;
    await postExpense(accessToken, childId, primerKey, body).expect(200);
    const primer = (await idemRows(userId, primerKey))[0];
    expect(primer.requestHash).toBe(requestHashFor(`/api/v1/children/${childId}/expenses`, body));

    // Simulate a process that died mid-handler: reservation row exists,
    // statusCode/responseJson NULL, and its short pending expiry has passed.
    const idemKey = `idem-d1-${randomUUID()}`;
    await prisma.idempotencyKey.create({
      data: {
        userId,
        endpoint: primer.endpoint,
        idemKey,
        requestHash: primer.requestHash,
        statusCode: null,
        expiresAt: new Date(Date.now() - 1000) // pending TTL(60s) elapsed
      }
    });

    // The genuine retry reclaims the expired reservation and executes.
    const retry = await postExpense(accessToken, childId, idemKey, body).expect(200);
    expect(retry.body.id).toEqual(expect.any(String));
    // primer created one expense, the recovered retry a second one.
    await expect(expenseCount(childId, itemName)).resolves.toBe(2);

    const rows = await idemRows(userId, idemKey);
    expect(rows).toHaveLength(1);
    expect(rows[0].statusCode).toBe(200);
    expect(rows[0].expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it("(d-2) 신선한 pending 행 + 같은 본문 → 폴링 예산(~3s) 소진 후 409 '아직 처리 중'", async () => {
    const { userId, accessToken } = await login("idem-fresh-pending");
    const { childId } = await completeOnboarding(accessToken, "멱등-신선");
    const itemName = `신선 대기 ${randomUUID()}`;
    const body = expenseBody(itemName);

    const primerKey = `idem-d2-primer-${randomUUID()}`;
    await postExpense(accessToken, childId, primerKey, body).expect(200);
    const primer = (await idemRows(userId, primerKey))[0];

    const idemKey = `idem-d2-${randomUUID()}`;
    await prisma.idempotencyKey.create({
      data: {
        userId,
        endpoint: primer.endpoint,
        idemKey,
        requestHash: primer.requestHash,
        statusCode: null,
        expiresAt: new Date(Date.now() + PENDING_TTL_MS) // still within pending TTL
      }
    });

    const startedAt = Date.now();
    const blocked = await postExpense(accessToken, childId, idemKey, body).expect(409);
    const elapsedMs = Date.now() - startedAt;

    // Measured behavior: NOT 425. The retry treats the fresh pending row as
    // an in-flight owner, polls 60×50ms for its completion, then gives up
    // with 409 IDEMPOTENCY_KEY_CONFLICT ("아직 처리 중").
    expect(blocked.body.error.code).toBe("IDEMPOTENCY_KEY_CONFLICT");
    expect(blocked.body.error.message).toContain("아직 처리 중");
    expect(elapsedMs).toBeGreaterThanOrEqual(WAIT_BUDGET_MS - 200);

    // Handler never ran for the blocked request: only the primer's expense.
    await expect(expenseCount(childId, itemName)).resolves.toBe(1);
    // The pending row is left untouched for its real (hypothetical) owner.
    const rows = await idemRows(userId, idemKey);
    expect(rows).toHaveLength(1);
    expect(rows[0].statusCode).toBeNull();
  });

  it("(d-3) 신선한 pending 행 + 다른 본문 → 즉시 409 (대기 없음)", async () => {
    const { userId, accessToken } = await login("idem-fresh-pending-mismatch");
    const { childId } = await completeOnboarding(accessToken, "멱등-신선충돌");
    const itemName = `신선 즉시충돌 ${randomUUID()}`;

    const primerKey = `idem-d3-primer-${randomUUID()}`;
    await postExpense(accessToken, childId, primerKey, expenseBody(itemName)).expect(200);
    const primer = (await idemRows(userId, primerKey))[0];

    const idemKey = `idem-d3-${randomUUID()}`;
    await prisma.idempotencyKey.create({
      data: {
        userId,
        endpoint: primer.endpoint,
        idemKey,
        requestHash: "0".repeat(64), // some other in-flight body
        statusCode: null,
        expiresAt: new Date(Date.now() + PENDING_TTL_MS)
      }
    });

    const startedAt = Date.now();
    const conflict = await postExpense(accessToken, childId, idemKey, expenseBody(itemName)).expect(409);
    expect(Date.now() - startedAt).toBeLessThan(WAIT_BUDGET_MS);
    expect(conflict.body.error.code).toBe("IDEMPOTENCY_KEY_CONFLICT");
    expect(conflict.body.error.message).toContain("다른 요청 본문");
    await expect(expenseCount(childId, itemName)).resolves.toBe(1);
  });

  it("(d-4) 대기 중(pending) 행이 폴링 도중 사라짐(소유자 실패로 키 해제) → 409 '처리 실패, 다시 시도'", async () => {
    const { userId, accessToken } = await login("idem-owner-died-midwait");
    const { childId } = await completeOnboarding(accessToken, "멱등-대기실패");
    const itemName = `대기중 실패 ${randomUUID()}`;
    const body = expenseBody(itemName);

    const primerKey = `idem-d4-primer-${randomUUID()}`;
    await postExpense(accessToken, childId, primerKey, body).expect(200);
    const primer = (await idemRows(userId, primerKey))[0];

    const idemKey = `idem-d4-${randomUUID()}`;
    await prisma.idempotencyKey.create({
      data: {
        userId,
        endpoint: primer.endpoint,
        idemKey,
        requestHash: primer.requestHash,
        statusCode: null,
        expiresAt: new Date(Date.now() + PENDING_TTL_MS)
      }
    });

    // Start the request; it sees the fresh pending row and begins polling.
    const pendingRequest = postExpense(accessToken, childId, idemKey, body);
    const inFlight = pendingRequest.then((response) => response); // start now
    await new Promise((resolve) => setTimeout(resolve, 500));
    // Simulate the in-flight owner failing: its catch-branch deletes the key.
    await prisma.idempotencyKey.deleteMany({ where: { userId, idemKey } });

    // Measured behavior: the waiter does NOT take over the freed key — it
    // gives up with 409 IDEMPOTENCY_KEY_CONFLICT ("처리에 실패했어요,
    // 다시 시도") and the client must retry itself.
    const failed = await inFlight;
    expect(failed.status).toBe(409);
    expect(failed.body.error.code).toBe("IDEMPOTENCY_KEY_CONFLICT");
    expect(failed.body.error.message).toContain("실패했어요");
    await expect(expenseCount(childId, itemName)).resolves.toBe(1); // primer only
  });

  it("(e) 완료 키의 24h 만료(expiresAt 소급) → 새 요청으로 재실행", async () => {
    const { userId, accessToken } = await login("idem-expired-complete");
    const { childId } = await completeOnboarding(accessToken, "멱등-만료");
    const idemKey = `idem-e-${randomUUID()}`;
    const itemName = `만료 재실행 ${randomUUID()}`;
    const body = expenseBody(itemName);

    const first = await postExpense(accessToken, childId, idemKey, body).expect(200);
    await prisma.idempotencyKey.updateMany({
      where: { userId, idemKey },
      data: { expiresAt: new Date(Date.now() - 1000) } // 24h replay window has passed
    });

    const second = await postExpense(accessToken, childId, idemKey, body).expect(200);
    // Not a replay: the handler genuinely ran again and made a new expense.
    expect(second.body.id).not.toBe(first.body.id);
    await expect(expenseCount(childId, itemName)).resolves.toBe(2);

    // Old expired row was reclaimed; only the fresh completed row remains.
    const rows = await idemRows(userId, idemKey);
    expect(rows).toHaveLength(1);
    expect(rows[0].expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it("(f) 같은 키를 다른 엔드포인트에 재사용 → 독립 (unique는 endpoint 포함)", async () => {
    const { userId, accessToken } = await login("idem-endpoint-scope");
    const { childId } = await completeOnboarding(accessToken, "멱등-스코프");
    const idemKey = `idem-f-shared-${randomUUID()}`;
    const itemName = `스코프 아기띠 ${randomUUID()}`;

    const created = await postExpense(accessToken, childId, idemKey, expenseBody(itemName, 89000)).expect(200);
    const expenseId = created.body.id as string;

    // Same Idempotency-Key on PATCH /expenses/:id — a different endpoint —
    // executes for real instead of replaying/conflicting with the POST.
    const patched = await request(app.getHttpServer())
      .patch(`/api/v1/expenses/${expenseId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .set("Idempotency-Key", idemKey)
      .send({ amountKrw: 91000 })
      .expect(200);
    expect(patched.body.amountKrw).toBe(91000);
    expect(patched.body.version).toBe(2);

    const rows = await idemRows(userId, idemKey);
    expect(rows).toHaveLength(2);
    expect(new Set(rows.map((row) => row.endpoint)).size).toBe(2);
    expect(rows.map((row) => row.endpoint).sort()).toEqual([
      "PATCH:/api/v1/expenses/:expenseId",
      "POST:/api/v1/children/:childId/expenses"
    ]);
  });

  it("(g) 핸들러 실패(400) 시 예약 행을 지워 같은 키의 교정 재시도가 성공", async () => {
    const { userId, accessToken } = await login("idem-failure-recovery");
    const { childId } = await completeOnboarding(accessToken, "멱등-실패복구");
    const idemKey = `idem-g-${randomUUID()}`;
    const itemName = `실패복구 장난감 ${randomUUID()}`;

    // amountKrw:0 fails DTO validation inside next.handle(), after the
    // reservation row was inserted — exercising the catch/deleteMany branch.
    await postExpense(accessToken, childId, idemKey, expenseBody(itemName, 0)).expect(400);

    // The failed attempt freed its key instead of caching the failure.
    await expect(idemRows(userId, idemKey)).resolves.toHaveLength(0);

    // A corrected retry with the same key executes normally (no 409 replay of
    // the failure, no conflict).
    await postExpense(accessToken, childId, idemKey, expenseBody(itemName, 15000)).expect(200);
    await expect(expenseCount(childId, itemName)).resolves.toBe(1);
    const rows = await idemRows(userId, idemKey);
    expect(rows).toHaveLength(1);
    expect(rows[0].statusCode).toBe(200);
  });

  it("(h) Idempotency-Key 헤더 없음/공백 → 완전 passthrough (행 미기록, 중복 실행 허용)", async () => {
    const { userId, accessToken } = await login("idem-no-header");
    const { childId } = await completeOnboarding(accessToken, "멱등-무헤더");
    const itemName = `무헤더 중복 ${randomUUID()}`;
    const body = expenseBody(itemName);

    const send = () =>
      request(app.getHttpServer())
        .post(`/api/v1/children/${childId}/expenses`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send(body);

    await send().expect(200);
    await send().expect(200);
    // Whitespace-only key is trimmed to empty and also passes through.
    await request(app.getHttpServer())
      .post(`/api/v1/children/${childId}/expenses`)
      .set("Authorization", `Bearer ${accessToken}`)
      .set("Idempotency-Key", "   ")
      .send(body)
      .expect(200);

    await expect(expenseCount(childId, itemName)).resolves.toBe(3);
    await expect(prisma.idempotencyKey.count({ where: { userId } })).resolves.toBe(0);
  });

  it("(i) 예약 시 확률적(2%) 전역 청소 분기 → 만료 행이 비동기로 회수됨", async () => {
    const { userId, accessToken } = await login("idem-sweeper");
    const { childId } = await completeOnboarding(accessToken, "멱등-청소");
    const itemName = `청소 트리거 ${randomUUID()}`;

    // A long-expired leftover row (any key/endpoint) that the sweeper should collect.
    const victimKey = `idem-i-victim-${randomUUID()}`;
    await prisma.idempotencyKey.create({
      data: {
        userId,
        endpoint: "POST:/api/v1/somewhere-old",
        idemKey: victimKey,
        requestHash: "f".repeat(64),
        statusCode: 200,
        expiresAt: new Date(Date.now() - PENDING_TTL_MS)
      }
    });

    // Force Math.random() < 0.02 so the fire-and-forget sweep runs on this
    // reservation (supertest runs the app in-process, so this spy reaches it).
    const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0);
    try {
      await postExpense(accessToken, childId, `idem-i-${randomUUID()}`, expenseBody(itemName)).expect(200);
    } finally {
      randomSpy.mockRestore();
    }

    // The sweep is `void`-ed (not awaited by the request); poll briefly.
    let victimCount = -1;
    for (let attempt = 0; attempt < 40; attempt++) {
      victimCount = await prisma.idempotencyKey.count({ where: { userId, idemKey: victimKey } });
      if (victimCount === 0) break;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    expect(victimCount).toBe(0);
  });
});
