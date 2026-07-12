import { createHmac, randomUUID } from "node:crypto";
import type { INestApplication } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import { PrismaClient } from "@prisma/client";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AppModule } from "../src/app.module";
import { configureApiApp } from "../src/bootstrap";

const ANALYTICS_ANON_SALT = "test-analytics-anon-salt";

function expectedAnonId(id: string): string {
  return createHmac("sha256", ANALYTICS_ANON_SALT).update(id).digest("hex");
}

/**
 * ANA-101 (design doc docs/5차/round5a-sprint2-plan.md §5): POST
 * /v1/analytics/events, backed by src/analytics/{analytics.controller,
 * analytics.service}.ts and the event envelope/registry in
 * packages/contracts/src/analytics.ts. Covers the acceptance criteria called
 * out for this backlog item: normal batch collection, server-derived (never
 * client-supplied) HMAC anon ids, event_id idempotency, unregistered-event
 * rejection, forbidden/unknown-payload-key rejection, and the 50-event batch
 * cap.
 */
describe("Analytics events API (/v1/analytics/events)", () => {
  let app: INestApplication;
  let moduleRef: TestingModule;
  let prisma: PrismaClient;

  beforeEach(async () => {
    process.env.JWT_ACCESS_SECRET = "test-access-secret";
    process.env.JWT_REFRESH_SECRET = "test-refresh-secret";
    process.env.ANALYTICS_ANON_SALT = ANALYTICS_ANON_SALT;

    moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApiApp(app);
    await app.init();
    prisma = new PrismaClient();
  });

  afterEach(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  async function login(prefix: string) {
    const providerToken = `${prefix}-${randomUUID()}`;
    const response = await request(app.getHttpServer())
      .post("/api/v1/auth/oauth-login")
      .send({ provider: "kakao", providerToken })
      .expect(200);
    const accessToken = response.body.tokens.accessToken as string;

    const me = await request(app.getHttpServer())
      .get("/api/v1/me")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);

    return {
      accessToken,
      userId: me.body.user.id as string,
      householdId: me.body.households[0].id as string
    };
  }

  function appOpenedEnvelope() {
    return {
      eventName: "app_opened",
      eventVersion: 1,
      eventId: randomUUID(),
      occurredAt: new Date().toISOString(),
      platform: "ios",
      payload: {}
    };
  }

  function onboardingCompletedEnvelope(stepCount = 5) {
    return {
      eventName: "onboarding_completed",
      eventVersion: 1,
      eventId: randomUUID(),
      occurredAt: new Date().toISOString(),
      payload: { stepCount }
    };
  }

  function postEvents(accessToken: string, events: unknown[]) {
    return request(app.getHttpServer())
      .post("/api/v1/analytics/events")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ events });
  }

  it("accepts a batch of valid events and derives anon ids server-side via HMAC (never the raw id)", async () => {
    const { accessToken, userId, householdId } = await login("analytics-ok");
    const opened = appOpenedEnvelope();
    const onboarded = onboardingCompletedEnvelope(4);

    const response = await postEvents(accessToken, [opened, onboarded]).expect(200);
    expect(response.body).toEqual({ accepted: 2, rejected: [] });

    const rows = await prisma.analyticsEvent.findMany({
      where: { eventId: { in: [opened.eventId, onboarded.eventId] } }
    });
    expect(rows).toHaveLength(2);

    for (const row of rows) {
      expect(row.userAnonId).toBe(expectedAnonId(userId));
      expect(row.userAnonId).not.toBe(userId);
      expect(row.householdAnonId).toBe(expectedAnonId(householdId));
      expect(row.householdAnonId).not.toBe(householdId);
    }

    const onboardedRow = rows.find((row) => row.eventId === onboarded.eventId)!;
    expect(onboardedRow.payload).toEqual({ stepCount: 4 });
    // No raw money amount, memo, or item name ever reaches the payload column.
    expect(JSON.stringify(onboardedRow.payload)).not.toMatch(/amountKrw|memo|itemName/i);
  });

  it("treats a duplicate event_id as idempotent: still accepted, but no second row is inserted", async () => {
    const { accessToken } = await login("analytics-idem");
    const envelope = appOpenedEnvelope();

    const first = await postEvents(accessToken, [envelope]).expect(200);
    expect(first.body).toEqual({ accepted: 1, rejected: [] });

    const second = await postEvents(accessToken, [envelope]).expect(200);
    expect(second.body).toEqual({ accepted: 1, rejected: [] });

    const rows = await prisma.analyticsEvent.findMany({ where: { eventId: envelope.eventId } });
    expect(rows).toHaveLength(1);
  });

  it("rejects an event whose name/version is not in the registry, without failing the rest of the batch", async () => {
    const { accessToken } = await login("analytics-unregistered");
    const unknown = { ...appOpenedEnvelope(), eventName: "does_not_exist_event" };
    const valid = appOpenedEnvelope();

    const response = await postEvents(accessToken, [unknown, valid]).expect(200);
    expect(response.body.accepted).toBe(1);
    expect(response.body.rejected).toEqual([{ index: 0, reason: expect.any(String) }]);

    const persisted = await prisma.analyticsEvent.findUnique({ where: { eventId: valid.eventId } });
    expect(persisted).not.toBeNull();
    const rejectedRow = await prisma.analyticsEvent.findUnique({ where: { eventId: unknown.eventId } });
    expect(rejectedRow).toBeNull();
  });

  it("rejects a payload carrying a key outside the registered schema (PII/forbidden-key guard), without a global 400", async () => {
    const { accessToken } = await login("analytics-forbidden-key");
    const tampered = onboardingCompletedEnvelope(2);
    (tampered.payload as Record<string, unknown>).amountKrw = 49800;
    const valid = appOpenedEnvelope();

    const response = await postEvents(accessToken, [tampered, valid]).expect(200);
    expect(response.body.accepted).toBe(1);
    expect(response.body.rejected).toEqual([{ index: 0, reason: expect.any(String) }]);

    const rejectedRow = await prisma.analyticsEvent.findUnique({ where: { eventId: tampered.eventId } });
    expect(rejectedRow).toBeNull();
  });

  it("rejects a batch of more than 50 events with 400 instead of partially processing it", async () => {
    const { accessToken } = await login("analytics-batch-limit");
    const oversized = Array.from({ length: 51 }, () => appOpenedEnvelope());

    await postEvents(accessToken, oversized)
      .expect(400)
      .expect(({ body }) => {
        expect(body.error.code).toBe("ANALYTICS_BATCH_TOO_LARGE");
      });

    // A batch of exactly the max is fine.
    const atLimit = Array.from({ length: 50 }, () => appOpenedEnvelope());
    const response = await postEvents(accessToken, atLimit).expect(200);
    expect(response.body.accepted).toBe(50);
  });

  it("requires authentication", async () => {
    await request(app.getHttpServer())
      .post("/api/v1/analytics/events")
      .send({ events: [appOpenedEnvelope()] })
      .expect(401);
  });
});
