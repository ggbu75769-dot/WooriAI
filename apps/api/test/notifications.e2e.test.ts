import { Test } from "@nestjs/testing";
import type { INestApplication } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AppModule } from "../src/app.module";
import { configureApiApp } from "../src/bootstrap";
import { PrismaService } from "../src/prisma/prisma.service";
import { JobHandlersService } from "../src/jobs/job-handlers.service";

async function session(app: INestApplication, label: string) {
  const login = await request(app.getHttpServer())
    .post("/api/v1/auth/oauth-login")
    .send({ provider: "kakao", providerToken: `notification-${label}-${randomUUID()}` })
    .expect(200);
  return {
    token: login.body.tokens.accessToken as string,
    userId: login.body.user.id as string
  };
}

describe("notification inbox", () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeEach(async () => {
    process.env.JWT_ACCESS_SECRET = "test-access-secret";
    process.env.JWT_REFRESH_SECRET = "test-refresh-secret";
    process.env.NODE_ENV = "test";
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApiApp(app);
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterEach(async () => app.close());

  it("isolates users, paginates by cursor, and marks reads idempotently", async () => {
    const owner = await session(app, "owner");
    const outsider = await session(app, "outsider");
    const ownerHousehold = await prisma.householdMember.findFirstOrThrow({
      where: { userId: owner.userId, status: "active" },
      select: { householdId: true }
    });
    const outsiderHousehold = await prisma.householdMember.findFirstOrThrow({
      where: { userId: outsider.userId, status: "active" },
      select: { householdId: true }
    });
    const childId = randomUUID();
    const itemId = randomUUID();
    const now = Date.now();
    const first = await prisma.notificationDelivery.create({
      data: {
        userId: owner.userId,
        householdId: ownerHousehold.householdId,
        childId,
        targetType: "item",
        targetId: itemId,
        eventType: "catalog_item_recalled",
        dedupeKey: `notification-test-${randomUUID()}`,
        scheduledAt: new Date(now),
        createdAt: new Date(now)
      }
    });
    await prisma.notificationDelivery.create({
      data: {
        userId: owner.userId,
        eventType: "unknown_future_event",
        dedupeKey: `notification-test-${randomUUID()}`,
        scheduledAt: new Date(now - 1000),
        createdAt: new Date(now - 1000)
      }
    });
    const inaccessibleSameUser = await prisma.notificationDelivery.create({
      data: {
        userId: owner.userId,
        householdId: outsiderHousehold.householdId,
        eventType: "catalog_item_blocked",
        dedupeKey: `notification-test-${randomUUID()}`,
        scheduledAt: new Date(now + 2_000),
        createdAt: new Date(now + 2_000)
      }
    });
    await prisma.notificationDelivery.create({
      data: {
        userId: outsider.userId,
        eventType: "catalog_item_blocked",
        dedupeKey: `notification-test-${randomUUID()}`,
        scheduledAt: new Date(now + 1000),
        createdAt: new Date(now + 1000)
      }
    });

    const auth = { Authorization: `Bearer ${owner.token}` };
    const page1 = (await request(app.getHttpServer()).get("/api/v1/notifications?limit=1").set(auth).expect(200)).body;
    expect(page1.items).toHaveLength(1);
    expect(page1.items[0]).toMatchObject({
      id: first.id,
      category: "safety",
      route: "preparation",
      navigation: {
        kind: "item",
        householdId: ownerHousehold.householdId,
        childId,
        itemId
      },
      requiresAcknowledgement: true,
      read: false
    });
    expect(page1.nextCursor).toBe(first.id);

    const page2 = (await request(app.getHttpServer()).get(`/api/v1/notifications?limit=1&cursor=${page1.nextCursor}`).set(auth).expect(200)).body;
    expect(page2.items).toHaveLength(1);
    expect(page2.items[0]).toMatchObject({ title: "우리아이 알림", route: null });
    expect(page2.items[0].navigation).toBeNull();
    expect(page2.nextCursor).toBeNull();

    const firstRead = (await request(app.getHttpServer()).put("/api/v1/notifications/read").set(auth).send({ ids: [first.id] }).expect(200)).body;
    const repeatedRead = (await request(app.getHttpServer()).put("/api/v1/notifications/read").set(auth).send({ ids: [first.id] }).expect(200)).body;
    expect(firstRead.changedCount).toBe(1);
    expect(repeatedRead.changedCount).toBe(0);

    await request(app.getHttpServer())
      .put("/api/v1/notifications/read")
      .set("Authorization", `Bearer ${outsider.token}`)
      .send({ ids: [first.id] })
      .expect(200)
      .expect(({ body }) => expect(body.changedCount).toBe(0));
    await request(app.getHttpServer())
      .put("/api/v1/notifications/read")
      .set(auth)
      .send({ ids: [inaccessibleSameUser.id] })
      .expect(200)
      .expect(({ body }) => expect(body.changedCount).toBe(0));
  });

  it("paginates 1,000 equal-timestamp deliveries without gaps or duplicates", async () => {
    const owner = await session(app, "volume-owner");
    const createdAt = new Date("2026-07-17T00:00:00.000Z");
    const ids = Array.from({ length: 1_000 }, () => randomUUID());
    await prisma.notificationDelivery.createMany({
      data: ids.map((id, index) => ({
        id,
        userId: owner.userId,
        eventType: index % 2 === 0 ? "catalog_item_recalled" : "unknown_future_event",
        dedupeKey: `notification-volume-${id}`,
        scheduledAt: createdAt,
        createdAt
      }))
    });

    const auth = { Authorization: `Bearer ${owner.token}` };
    const received: string[] = [];
    let cursor: string | null = null;
    do {
      const path = cursor
        ? `/api/v1/notifications?limit=50&cursor=${encodeURIComponent(cursor)}`
        : "/api/v1/notifications?limit=50";
      const page = (await request(app.getHttpServer()).get(path).set(auth).expect(200)).body;
      received.push(...page.items.map((item: { id: string }) => item.id));
      cursor = page.nextCursor as string | null;
    } while (cursor);

    expect(received).toHaveLength(1_000);
    expect(new Set(received).size).toBe(1_000);
    expect([...received].sort()).toEqual([...ids].sort());

    const targetId = received[0]!;
    const firstRead = await request(app.getHttpServer())
      .put("/api/v1/notifications/read")
      .set(auth)
      .send({ ids: [targetId] })
      .expect(200);
    expect(firstRead.body.changedCount).toBe(1);
    for (let repeat = 0; repeat < 30; repeat += 1) {
      const duplicateRead = await request(app.getHttpServer())
        .put("/api/v1/notifications/read")
        .set(auth)
        .send({ ids: [targetId] })
        .expect(200);
      expect(duplicateRead.body.changedCount).toBe(0);
    }
  });

  it("rechecks active membership before delivery and hides revoked household notifications", async () => {
    const owner = await session(app, "membership-owner");
    const member = await session(app, "membership-member");
    const ownerHousehold = await prisma.householdMember.findFirstOrThrow({
      where: { userId: owner.userId, status: "active" },
      select: { householdId: true }
    });
    await prisma.householdMember.create({
      data: { householdId: ownerHousehold.householdId, userId: member.userId, role: "co_parent", status: "active", joinedAt: new Date() }
    });
    const delivery = await prisma.notificationDelivery.create({
      data: {
        userId: member.userId,
        householdId: ownerHousehold.householdId,
        eventType: "item_plan_comment",
        dedupeKey: `notification-membership-${randomUUID()}`,
        scheduledAt: new Date()
      }
    });
    await prisma.householdMember.update({
      where: { householdId_userId: { householdId: ownerHousehold.householdId, userId: member.userId } },
      data: { status: "removed" }
    });

    await expect(app.get(JobHandlersService).handle("notification.send", { notificationDeliveryId: delivery.id }))
      .resolves.toMatchObject({ code: "NOTIFICATION_CANCELLED_MEMBERSHIP_REVOKED" });
    await expect(prisma.notificationDelivery.findUniqueOrThrow({ where: { id: delivery.id } }))
      .resolves.toMatchObject({ state: "cancelled", failureCode: "MEMBERSHIP_REVOKED" });
    const inbox = await request(app.getHttpServer())
      .get("/api/v1/notifications?limit=20")
      .set("Authorization", `Bearer ${member.token}`)
      .expect(200);
    expect(inbox.body.items).not.toContainEqual(expect.objectContaining({ id: delivery.id }));
  });
});
