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

function currentSeoulDate() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

function plusOneDate(dateOnly: string) {
  const [year, month, day] = dateOnly.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + 1)).toISOString().slice(0, 10);
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
    vi.restoreAllMocks();
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
    expect(today.body.actions[0]).toMatchObject({
      kind: "safety_acknowledgement",
      preferenceScope: { kind: "child", childId: child.id },
      preferenceVersion: 0,
      navigation: { kind: "notifications" }
    });
    expect(today.body.actions.some((action: { kind: string }) => action.kind === "planned_cost_unassigned")).toBe(false);

    await request(app.getHttpServer())
      .put("/api/v1/home/today-preferences")
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ householdId: owner.householdId, childId: child.id, actionKey: `safety:${today.body.actions[0].actionKey.split(":")[1]}`, mode: "snooze", expectedVersion: 0 })
      .expect(400);

    const giftToday = await request(app.getHttpServer())
      .get(`/api/v1/children/${child.id}/today-center?referenceDate=2026-07-17`)
      .set("Authorization", `Bearer ${gift.token}`)
      .expect(200);
    expect(giftToday.body.actions.some((action: { kind: string }) => action.kind === "planned_cost_unassigned")).toBe(false);
    expect(giftToday.body.actions
      .every((action: { sourceId: string }) => action.sourceId === items[3]!.id)).toBe(true);
    const giftPayload = JSON.stringify(giftToday.body);
    for (const privateItem of items.slice(0, 3)) {
      expect(giftPayload).not.toContain(privateItem.id);
      expect(giftPayload).not.toContain(privateItem.nameKo);
    }
    expect(giftToday.body.actions.every((action: { reasonParams: Record<string, unknown> }) =>
      Object.keys(action.reasonParams).every((key) => !/(?:amount|budget|cost|price)/i.test(key)) &&
      Object.values(action.reasonParams).every((value) => value !== 50000)
    )).toBe(true);

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

  it("uses exact-child atomic preference CAS, resolution, and zero-write scope rejection", async () => {
    const owner = await session(app, "today-cas-owner");
    const foreign = await session(app, "today-cas-foreign");
    const child = await prisma.child.create({
      data: { householdId: owner.householdId, nickname: "오늘 아이", stageMode: "manual", manualStage: "toddler_1_3" }
    });
    const foreignChild = await prisma.child.create({
      data: { householdId: foreign.householdId, nickname: "다른 가족 아이", stageMode: "manual", manualStage: "toddler_1_3" }
    });
    const item = await prisma.itemDefinition.findFirstOrThrow({ orderBy: { id: "asc" } });
    await prisma.userItemPlan.create({
      data: {
        householdId: owner.householdId,
        childId: child.id,
        itemDefinitionId: item.id,
        state: "planned",
        dueDate: new Date("2026-07-27")
      }
    });
    const today = await request(app.getHttpServer())
      .get(`/api/v1/children/${child.id}/today-center?referenceDate=2026-07-26`)
      .set("Authorization", `Bearer ${owner.token}`)
      .expect(200);
    const action = today.body.actions.find((entry: { kind: string }) => entry.kind !== "safety_acknowledgement");
    expect(action).toMatchObject({
      preferenceScope: { kind: "child", childId: child.id },
      preferenceVersion: 0
    });

    const preferenceDelegate = prisma.todayActionPreference as unknown as {
      findUnique: (args: {
        where: {
          userId_householdId_scopeKey_actionKey?: { actionKey?: string }
        }
      }) => Promise<unknown>
    };
    const originalFind = preferenceDelegate.findUnique.bind(preferenceDelegate);
    let activeBarrier: {
      arrivals: number;
      releaseGate: Promise<void>;
      release: () => void;
      bothArrived: () => void;
    } | null = null;
    vi.spyOn(preferenceDelegate, "findUnique").mockImplementation(async (args) => {
      const barrier = activeBarrier;
      const key = args.where.userId_householdId_scopeKey_actionKey;
      if (barrier && key?.actionKey === action.actionKey && barrier.arrivals < 2) {
        barrier.arrivals += 1;
        if (barrier.arrivals === 2) barrier.bothArrived();
        await barrier.releaseGate;
      }
      return originalFind(args);
    });
    const runSameBaselineRace = async (expectedVersion: number) => {
      let release!: () => void;
      let bothArrived!: () => void;
      const releaseGate = new Promise<void>((resolve) => { release = resolve; });
      const arrivalGate = new Promise<void>((resolve) => { bothArrived = resolve; });
      activeBarrier = { arrivals: 0, releaseGate, release, bothArrived };
      try {
        const concurrent = Promise.all([0, 1].map(() => request(app.getHttpServer())
          .put("/api/v1/home/today-preferences")
          .set("Authorization", `Bearer ${owner.token}`)
          .send({
            householdId: owner.householdId,
            childId: child.id,
            actionKey: action.actionKey,
            mode: "snooze",
            expectedVersion
          })));
        await Promise.race([
          arrivalGate,
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error("TODAY_CAS_BARRIER_TIMEOUT")), 5_000))
        ]);
        release();
        const responses = await concurrent;
        expect(responses.map((response) => response.status).sort()).toEqual([200, 409]);
        expect(responses.find((response) => response.status === 409)?.body.error.code).toBe("TODAY_PREFERENCE_CONFLICT");
        return responses.find((response) => response.status === 200)!.body;
      } finally {
        release();
        activeBarrier = null;
      }
    };

    const expectedSnoozeDate = plusOneDate(currentSeoulDate());
    const createdPreference = await runSameBaselineRace(0);
    expect(createdPreference).toMatchObject({
      mode: "snooze",
      snoozedUntil: expectedSnoozeDate,
      version: 1
    });
    let exact = await prisma.todayActionPreference.findUniqueOrThrow({
      where: {
        userId_householdId_scopeKey_actionKey: {
          userId: owner.userId,
          householdId: owner.householdId,
          scopeKey: child.id,
          actionKey: action.actionKey
        }
      }
    });
    expect(exact.version).toBe(1);

    await runSameBaselineRace(1);
    exact = await prisma.todayActionPreference.findUniqueOrThrow({
      where: {
        userId_householdId_scopeKey_actionKey: {
          userId: owner.userId,
          householdId: owner.householdId,
          scopeKey: child.id,
          actionKey: action.actionKey
        }
      }
    });
    expect(exact).toMatchObject({ version: 2, mode: "snooze", childId: child.id, scopeKey: child.id });

    await prisma.todayActionPreference.create({
      data: {
        userId: owner.userId,
        householdId: owner.householdId,
        childId: null,
        scopeKey: "household",
        actionKey: action.actionKey,
        mode: "snooze",
        snoozedUntil: new Date("2099-01-01")
      }
    });
    const resolution = await request(app.getHttpServer())
      .get("/api/v1/home/today-preferences")
      .query({ householdId: owner.householdId, childId: child.id, actionKey: action.actionKey })
      .set("Authorization", `Bearer ${owner.token}`)
      .expect(200);
    expect(resolution.body).toMatchObject({
      actionKey: action.actionKey,
      preferenceScope: { kind: "child", childId: child.id },
      preference: { version: 2, mode: "snooze" }
    });

    const legacyActionKey = "legacy:hidden-action";
    await prisma.todayActionPreference.create({
      data: {
        userId: owner.userId,
        householdId: owner.householdId,
        childId: child.id,
        scopeKey: child.id,
        actionKey: legacyActionKey,
        mode: "hide_lifecycle",
        snoozedUntil: null,
        lifecycleCode: "infant_4_6"
      }
    });
    const legacyResolution = await request(app.getHttpServer())
      .get("/api/v1/home/today-preferences")
      .query({ householdId: owner.householdId, childId: child.id, actionKey: legacyActionKey })
      .set("Authorization", `Bearer ${owner.token}`)
      .expect(200);
    expect(legacyResolution.body).toMatchObject({
      actionKey: legacyActionKey,
      preferenceScope: { kind: "child", childId: child.id },
      preference: {
        mode: "hide_lifecycle",
        snoozedUntil: null,
        lifecycleCode: "infant_4_6",
        version: 1
      }
    });

    const countBeforeInvalid = await prisma.todayActionPreference.count();
    await request(app.getHttpServer())
      .put("/api/v1/home/today-preferences")
      .set("Authorization", `Bearer ${owner.token}`)
      .send({
        householdId: owner.householdId,
        childId: randomUUID(),
        actionKey: "invalid:missing-child",
        mode: "snooze",
        expectedVersion: 0
      })
      .expect(404);
    await request(app.getHttpServer())
      .put("/api/v1/home/today-preferences")
      .set("Authorization", `Bearer ${owner.token}`)
      .send({
        householdId: owner.householdId,
        childId: foreignChild.id,
        actionKey: "invalid:foreign-child",
        mode: "snooze",
        expectedVersion: 0
      })
      .expect(403);
    await prisma.householdMember.create({
      data: {
        householdId: foreign.householdId,
        userId: owner.userId,
        role: "viewer",
        status: "active",
        joinedAt: new Date()
      }
    });
    await request(app.getHttpServer())
      .put("/api/v1/home/today-preferences")
      .set("Authorization", `Bearer ${owner.token}`)
      .send({
        householdId: owner.householdId,
        childId: foreignChild.id,
        actionKey: "invalid:cross-household-child",
        mode: "snooze",
        expectedVersion: 0
      })
      .expect(403);
    expect(await prisma.todayActionPreference.count()).toBe(countBeforeInvalid);
  });

  it("applies custom bundles idempotently, preserves existing plans, and scopes weekly finance", async () => {
    const owner = await session(app, "bundle-owner");
    const gift = await session(app, "bundle-gift");
    const child = await prisma.child.create({ data: { householdId: owner.householdId, nickname: "묶음 아이", stageMode: "manual", manualStage: "newborn_0_3" } });
    await prisma.householdMember.create({ data: { householdId: owner.householdId, userId: gift.userId, role: "gift_participant", status: "active", joinedAt: new Date() } });
    const items = await prisma.itemDefinition.findMany({ take: 2, orderBy: { id: "asc" } });
    const existing = await prisma.userItemPlan.create({ data: { householdId: owner.householdId, childId: child.id, itemDefinitionId: items[0]!.id, state: "owned", ownedQuantity: 1, budgetKrw: 77777 } });
    const privateSafetyReason = "선물 역할에 노출되면 안 되는 가족 안전 메모";
    await prisma.catalogSafetyAlert.create({
      data: {
        itemDefinitionId: items[0]!.id,
        userItemPlanId: existing.id,
        eventType: "recalled",
        reason: privateSafetyReason,
        itemContentVersion: items[0]!.contentVersion
      }
    });

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
    expect(ownerBriefing.body.sections.safety).toEqual(expect.arrayContaining([
      expect.objectContaining({ itemId: items[0]!.id, reason: privateSafetyReason })
    ]));
    const giftBriefing = await request(app.getHttpServer())
      .get(`/api/v1/households/${owner.householdId}/weekly-briefings/current?referenceDate=2026-07-17`)
      .set("Authorization", `Bearer ${gift.token}`)
      .expect(200);
    expect(giftBriefing.body.sections.financial).toBeNull();
    expect(giftBriefing.body.sections.safety).toEqual([]);
    expect(JSON.stringify(giftBriefing.body)).not.toContain(items[0]!.id);
    expect(JSON.stringify(giftBriefing.body)).not.toContain(privateSafetyReason);

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
