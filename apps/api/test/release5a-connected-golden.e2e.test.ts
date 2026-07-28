import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AppModule } from "../src/app.module";
import { configureApiApp } from "../src/bootstrap";
import { PrismaService } from "../src/prisma/prisma.service";

async function session(app: INestApplication, label: string) {
  const login = await request(app.getHttpServer())
    .post("/api/v1/auth/oauth-login")
    .send({ provider: "kakao", providerToken: `release5a-${label}-${randomUUID()}` })
    .expect(200);
  const token = login.body.tokens.accessToken as string;
  const me = await request(app.getHttpServer())
    .get("/api/v1/me")
    .set("Authorization", `Bearer ${token}`)
    .expect(200);
  return {
    token,
    userId: me.body.user.id as string,
    householdId: me.body.households[0].id as string
  };
}

describe("Release 5A connected owner-to-report Golden Mission", () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeEach(async () => {
    process.env.JWT_ACCESS_SECRET = "test-access-secret";
    process.env.JWT_REFRESH_SECRET = "test-refresh-secret";
    process.env.NODE_ENV = "test";
    process.env.WOORIAI_STAGE_TODAY = "2026-07-17";
    process.env.CATALOG_INTERNAL_PREVIEW_ENABLED = "1";
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApiApp(app);
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterEach(async () => {
    delete process.env.WOORIAI_STAGE_TODAY;
    delete process.env.CATALOG_INTERNAL_PREVIEW_ENABLED;
    await app.close();
  });

  it("keeps assignment, comment, expense, notification, and Report in one household scope", async () => {
    const owner = await session(app, "owner");
    const coParent = await session(app, "co-parent");
    await request(app.getHttpServer())
      .put("/api/v1/consents")
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ consents: [
        { type: "terms", version: "2026-07-06", accepted: true },
        { type: "privacy", version: "2026-07-06", accepted: true }
      ] })
      .expect(200);
    const child = await request(app.getHttpServer())
      .post("/api/v1/children")
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ householdId: owner.householdId, nickname: "연결 검증 아이", stageMode: "manual", manualStage: "infant_4_6" })
      .expect(200);
    const childId = child.body.id as string;
    await prisma.householdMember.create({
      data: {
        householdId: owner.householdId,
        userId: coParent.userId,
        role: "co_parent",
        status: "active",
        joinedAt: new Date()
      }
    });

    const item = await prisma.itemDefinition.findFirstOrThrow({ where: { code: { startsWith: "R4-" } } });
    await request(app.getHttpServer())
      .put(`/api/v1/children/${childId}/item-plans/${item.id}`)
      .set("Authorization", `Bearer ${owner.token}`)
      .send({
        state: "planned",
        assignedUserId: coParent.userId,
        budgetKrw: 120000,
        dueDate: "2026-07-20"
      })
      .expect(200);

    const mutationId = randomUUID();
    const comment = () => request(app.getHttpServer())
      .post(`/api/v1/children/${childId}/item-plans/${item.id}/comments`)
      .set("Authorization", `Bearer ${owner.token}`)
      .set("Idempotency-Key", mutationId)
      .send({ clientMutationId: mutationId, body: "공동 준비 위치를 확인해 주세요." });
    const [firstComment, repeatedComment] = await Promise.all([comment(), comment()]);
    expect([firstComment.status, repeatedComment.status]).toEqual([201, 201]);
    expect(firstComment.body.id).toBe(repeatedComment.body.id);
    expect(await prisma.userItemPlanComment.count({ where: { id: mutationId } })).toBe(1);

    const category = await prisma.category.findFirstOrThrow();
    const expenseMutationId = randomUUID();
    const expense = await request(app.getHttpServer())
      .post(`/api/v1/children/${childId}/expenses`)
      .set("Authorization", `Bearer ${coParent.token}`)
      .set("Idempotency-Key", expenseMutationId)
      .send({
        categoryId: category.id,
        amountKrw: 42000,
        spentOn: "2026-07-17",
        itemName: "공동 준비 지출",
        paymentMethod: "card",
        linkedItemDefinitionId: item.id
      })
      .expect(200);

    expect(await prisma.expense.count({ where: { id: expense.body.id, householdId: owner.householdId, childId } })).toBe(1);
    const report = await request(app.getHttpServer())
      .get(`/api/v1/reports/v3?childId=${childId}&period=month&anchor=2026-07-17`)
      .set("Authorization", `Bearer ${owner.token}`)
      .expect(200);
    expect(report.body.summary).toMatchObject({
      plannedPreparationCostKrw: 120000,
      actualPreparationCostKrw: 42000,
      budgetVarianceKrw: -78000
    });

    const inbox = await request(app.getHttpServer())
      .get("/api/v1/notifications?limit=20")
      .set("Authorization", `Bearer ${coParent.token}`)
      .expect(200);
    expect(inbox.body.items).toContainEqual(expect.objectContaining({
      eventType: "item_plan_comment",
      navigation: { kind: "item", householdId: owner.householdId, childId, itemId: item.id }
    }));
  });
});
