import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppModule } from "../src/app.module";
import { configureApiApp } from "../src/bootstrap";
import { PrismaService } from "../src/prisma/prisma.service";

async function session(app: INestApplication, label: string) {
  const login = await request(app.getHttpServer()).post("/api/v1/auth/oauth-login").send({ provider: "kakao", providerToken: `release5d-${label}-${randomUUID()}` }).expect(200);
  const token = login.body.tokens.accessToken as string;
  const me = await request(app.getHttpServer()).get("/api/v1/me").set("Authorization", `Bearer ${token}`).expect(200);
  return { token, userId: me.body.user.id as string, householdId: me.body.households[0].id as string };
}

describe("Release 5D daily-use APIs", () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeEach(async () => {
    process.env.JWT_ACCESS_SECRET = "test-access-secret";
    process.env.JWT_REFRESH_SECRET = "test-refresh-secret";
    process.env.NODE_ENV = "test";
    process.env.RELEASE5_INTERNAL_FEATURES = "1";
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApiApp(app);
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterEach(async () => {
    delete process.env.RELEASE5_INTERNAL_FEATURES;
    await app.close();
  });

  it("serves deterministic Today and calendar data while redacting gift participants", async () => {
    const owner = await session(app, "owner");
    const gift = await session(app, "gift");
    const child = await prisma.child.create({ data: { householdId: owner.householdId, nickname: "Release 5 아이", stageMode: "manual", manualStage: "infant_4_6" } });
    await prisma.householdMember.create({ data: { householdId: owner.householdId, userId: gift.userId, role: "gift_participant", status: "active", joinedAt: new Date() } });
    const items = await prisma.itemDefinition.findMany({ take: 4, orderBy: { id: "asc" } });
    const plans = await Promise.all(items.map((item, index) => prisma.userItemPlan.create({ data: {
      householdId: owner.householdId,
      childId: child.id,
      itemDefinitionId: item.id,
      state: index === 3 ? "gift_expected" : "planned",
      dueDate: new Date(index === 0 ? "2026-07-15" : `2026-07-${18 + index}`),
      budgetKrw: index === 1 ? 50000 : null,
      replacementDueAt: index === 2 ? new Date("2026-07-19") : null
    } })));
    await prisma.catalogSafetyAlert.create({ data: { itemDefinitionId: items[0]!.id, userItemPlanId: plans[0]!.id, eventType: "recalled", reason: "공식 안전 안내를 확인해 주세요.", itemContentVersion: items[0]!.contentVersion } });

    const today = await request(app.getHttpServer())
      .get(`/api/v1/children/${child.id}/today-center?referenceDate=2026-07-17`)
      .set("Authorization", `Bearer ${owner.token}`)
      .expect(200);
    expect(today.body.actions).toHaveLength(3);
    expect(today.body.actions[0]).toMatchObject({ kind: "safety_acknowledgement" });
    expect(today.body.actions.some((action: { kind: string }) => action.kind === "planned_cost_unassigned")).toBe(false);

    await request(app.getHttpServer())
      .put("/api/v1/home/today-preferences")
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ householdId: owner.householdId, childId: child.id, actionKey: `safety:${today.body.actions[0].actionKey.split(":")[1]}`, mode: "hide_lifecycle" })
      .expect(400);

    const giftToday = await request(app.getHttpServer())
      .get(`/api/v1/children/${child.id}/today-center?referenceDate=2026-07-17`)
      .set("Authorization", `Bearer ${gift.token}`)
      .expect(200);
    expect(JSON.stringify(giftToday.body)).not.toContain("50000");

    const calendar = await request(app.getHttpServer())
      .get(`/api/v1/households/${owner.householdId}/preparation-calendar?month=2026-07&childId=${child.id}`)
      .set("Authorization", `Bearer ${owner.token}`)
      .expect(200);
    expect(calendar.body.events).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: "preparation", status: "overdue" }),
      expect.objectContaining({ type: "replacement", date: "2026-07-19" })
    ]));
    await request(app.getHttpServer())
      .get(`/api/v1/households/${owner.householdId}/preparation-calendar?month=2026-07`)
      .set("Authorization", `Bearer ${gift.token}`)
      .expect(403);
  });

  it("applies custom bundles idempotently, preserves existing plans, and scopes weekly finance", async () => {
    const owner = await session(app, "bundle-owner");
    const gift = await session(app, "bundle-gift");
    const child = await prisma.child.create({ data: { householdId: owner.householdId, nickname: "묶음 아이", stageMode: "manual", manualStage: "newborn_0_3" } });
    await prisma.householdMember.create({ data: { householdId: owner.householdId, userId: gift.userId, role: "gift_participant", status: "active", joinedAt: new Date() } });
    const items = await prisma.itemDefinition.findMany({ take: 2, orderBy: { id: "asc" } });
    const existing = await prisma.userItemPlan.create({ data: { householdId: owner.householdId, childId: child.id, itemDefinitionId: items[0]!.id, state: "owned", ownedQuantity: 1, budgetKrw: 77777 } });

    const bundle = await request(app.getHttpServer())
      .post(`/api/v1/households/${owner.householdId}/custom-bundles`)
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ title: "외출 준비", scopeType: "child", items: [{ itemDefinitionId: items[0]!.id, defaultQuantity: 2 }, { itemDefinitionId: items[1]!.id, defaultQuantity: 3 }] })
      .expect(200);
    const idempotencyKey = randomUUID();
    let result: unknown;
    for (let repeat = 0; repeat < 30; repeat += 1) {
      result = (await request(app.getHttpServer())
        .post(`/api/v1/households/${owner.householdId}/custom-bundles/${bundle.body.id}/apply`)
        .set("Authorization", `Bearer ${owner.token}`)
        .send({ childId: child.id, expectedVersion: bundle.body.version, idempotencyKey })
        .expect(200)).body;
    }
    expect(result).toMatchObject({ createdCount: 1, existingCount: 1 });
    expect(await prisma.userItemPlan.count({ where: { householdId: owner.householdId, childId: child.id, itemDefinitionId: { in: items.map((item) => item.id) } } })).toBe(2);
    expect(await prisma.userItemPlan.findUniqueOrThrow({ where: { id: existing.id } })).toMatchObject({ state: "owned", ownedQuantity: 1, budgetKrw: 77777 });

    const ownerBriefing = await request(app.getHttpServer())
      .get(`/api/v1/households/${owner.householdId}/weekly-briefings/current?referenceDate=2026-07-17`)
      .set("Authorization", `Bearer ${owner.token}`)
      .expect(200);
    expect(ownerBriefing.body).toMatchObject({ weekStart: "2026-07-13", sections: { financial: expect.any(Object) } });
    const giftBriefing = await request(app.getHttpServer())
      .get(`/api/v1/households/${owner.householdId}/weekly-briefings/current?referenceDate=2026-07-17`)
      .set("Authorization", `Bearer ${gift.token}`)
      .expect(200);
    expect(giftBriefing.body.sections.financial).toBeNull();

    const preferences = await request(app.getHttpServer()).get("/api/v1/notification-preferences").set("Authorization", `Bearer ${owner.token}`).expect(200);
    await request(app.getHttpServer())
      .put("/api/v1/notification-preferences")
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ externalChannelEnabled: true, expectedVersion: preferences.body.version })
      .expect(400);
    const updated = await request(app.getHttpServer())
      .put("/api/v1/notification-preferences")
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ weeklyBriefingEnabled: false, quietHoursStart: "22:00", quietHoursEnd: "07:00", expectedVersion: preferences.body.version })
      .expect(200);
    expect(updated.body).toMatchObject({ weeklyBriefingEnabled: false, timezone: "Asia/Seoul", safetyEnabled: true, externalChannelAvailable: false });
    await request(app.getHttpServer())
      .put("/api/v1/notification-preferences")
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ weeklyBriefingEnabled: true, expectedVersion: preferences.body.version })
      .expect(409);
  });

  it("keeps custom bundle list ORM reads constant for 10 and 500 rows", async () => {
    const owner = await session(app, "bundle-query-budget");
    const makeRows = (from: number, count: number) => Array.from({ length: count }, (_, offset) => ({
      householdId: owner.householdId,
      createdByUserId: owner.userId,
      title: `쿼리 예산 묶음 ${from + offset}`,
      scopeType: "child"
    }));
    await prisma.customPreparationBundle.createMany({ data: makeRows(0, 10) });

    const originalBundleRead = prisma.customPreparationBundle.findMany.bind(prisma.customPreparationBundle);
    const originalItemRead = prisma.customPreparationBundleItem.findMany.bind(prisma.customPreparationBundleItem);
    const originalDefinitionRead = prisma.itemDefinition.findMany.bind(prisma.itemDefinition);
    const bundleReads = vi.spyOn(prisma.customPreparationBundle, "findMany").mockImplementation((args) => originalBundleRead(args));
    const itemReads = vi.spyOn(prisma.customPreparationBundleItem, "findMany").mockImplementation((args) => originalItemRead(args));
    const definitionReads = vi.spyOn(prisma.itemDefinition, "findMany").mockImplementation((args) => originalDefinitionRead(args));
    const assertBudget = async (expectedRows: number) => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/households/${owner.householdId}/custom-bundles`)
        .set("Authorization", `Bearer ${owner.token}`)
        .expect(200);
      expect(response.body.bundles).toHaveLength(expectedRows);
      expect({ bundle: bundleReads.mock.calls.length, items: itemReads.mock.calls.length, definitions: definitionReads.mock.calls.length })
        .toEqual({ bundle: 1, items: 1, definitions: 1 });
      bundleReads.mockClear();
      itemReads.mockClear();
      definitionReads.mockClear();
    };

    await assertBudget(10);
    await prisma.customPreparationBundle.createMany({ data: makeRows(10, 490) });
    await assertBudget(500);
  });
});
