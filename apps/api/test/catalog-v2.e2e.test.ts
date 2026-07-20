import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { createHash, randomUUID } from "node:crypto";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AppModule } from "../src/app.module";
import { configureApiApp } from "../src/bootstrap";
import { PrismaService } from "../src/prisma/prisma.service";
import { CatalogV2Service } from "../src/catalog-v2/catalog-v2.service";
import { JobHandlersService } from "../src/jobs/job-handlers.service";

async function loginAndCreateChild(app: INestApplication) {
  const login = await request(app.getHttpServer())
    .post("/api/v1/auth/oauth-login")
    .send({ provider: "kakao", providerToken: `release4-catalog-${randomUUID()}` })
    .expect(200);
  const token = login.body.tokens.accessToken as string;
  const me = await request(app.getHttpServer()).get("/api/v1/me").set("Authorization", `Bearer ${token}`).expect(200);
  const householdId = me.body.households[0].id as string;
  await request(app.getHttpServer())
    .put("/api/v1/consents")
    .set("Authorization", `Bearer ${token}`)
    .send({ consents: [{ type: "terms", version: "2026-07-06", accepted: true }, { type: "privacy", version: "2026-07-06", accepted: true }] })
    .expect(200);
  const childResponse = await request(app.getHttpServer())
    .post("/api/v1/children")
    .set("Authorization", `Bearer ${token}`)
    .send({ householdId, nickname: "릴리즈4", stageMode: "manual", manualStage: "newborn_0_3" })
    .expect(200);
  return { token, userId: me.body.user.id as string, householdId, childId: childResponse.body.id as string };
}

describe("Release 4 catalog and preparation APIs", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let catalog: CatalogV2Service;

  beforeEach(async () => {
    process.env.JWT_ACCESS_SECRET = "test-access-secret";
    process.env.JWT_REFRESH_SECRET = "test-refresh-secret";
    process.env.NODE_ENV = "test";
    process.env.CATALOG_INTERNAL_PREVIEW_ENABLED = "1";
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApiApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    catalog = app.get(CatalogV2Service);
  });

  afterEach(async () => {
    await app.close();
    delete process.env.CATALOG_INTERNAL_PREVIEW_ENABLED;
  });

  it("serves the full taxonomy and canonical item before any sellable offer", async () => {
    const { token, childId } = await loginAndCreateChild(app);
    const domains = await request(app.getHttpServer())
      .get("/api/v1/catalog/domains")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    expect(domains.headers.etag).toMatch(/^".+"$/);
    expect(domains.body.domains).toHaveLength(24);
    expect(domains.body.domains.every((domain: { children: unknown[] }) => domain.children.length === 5)).toBe(true);

    const search = await request(app.getHttpServer())
      .get(`/api/v1/catalog/search?query=${encodeURIComponent("신생아용 카시트 준비")}&childId=${childId}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    expect(search.body.items.length).toBeGreaterThanOrEqual(1);
    expect(search.body.items[0]).toMatchObject({ nameKo: "신생아용 카시트", safetyTier: "high", status: "in_review" });

    const detail = await request(app.getHttpServer())
      .get(`/api/v1/catalog/items/${search.body.items[0].id}?childId=${childId}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    expect(detail.body).toMatchObject({ nameKo: "신생아용 카시트", reviewPending: true, offers: [] });
    expect(detail.body.categories).toHaveLength(3);
    expect(detail.body.lifecycles.length).toBeGreaterThan(0);
  });

  it("ranks canonical, alias, initials, typo, category and safety-filter search without retaining the raw query", async () => {
    const { token, childId } = await loginAndCreateChild(app);
    const auth = { Authorization: `Bearer ${token}` };
    for (const query of ["신생아용 카시트", "신생아 카시트", "ㅋㅅㅌ", "카시드"]) {
      const response = await request(app.getHttpServer()).get(`/api/v1/catalog/search?query=${encodeURIComponent(query)}&childId=${childId}`).set(auth).expect(200);
      expect(response.body.items.slice(0, 3).map((item: { nameKo: string }) => item.nameKo), `query=${query}`).toContain("신생아용 카시트");
      expect(response.body.items[0].searchMatch).toEqual(expect.objectContaining({ reason: expect.stringMatching(/canonical|alias|initials|typo/) }));
      expect(response.body.search).toMatchObject({ rawQueryStored: false });
      expect(JSON.stringify(response.body.search)).not.toContain(query);
    }
    const carSeat = await prisma.itemDefinition.findFirstOrThrow({ where: { nameKo: "신생아용 카시트" } });
    const categoryLink = await prisma.itemDefinitionCategory.findFirstOrThrow({ where: { itemDefinitionId: carSeat.id, isPrimary: true } });
    const category = await prisma.catalogNode.findUniqueOrThrow({ where: { id: categoryLink.catalogNodeId } });
    const categoryResult = await request(app.getHttpServer()).get(`/api/v1/catalog/search?query=${encodeURIComponent(category.nameKo)}&safetyTier=high&secondhandPolicy=inspect&childId=${childId}`).set(auth).expect(200);
    expect(categoryResult.body.items.length).toBeGreaterThan(0);
    expect(categoryResult.body.items.every((item: { safetyTier: string }) => item.safetyTier === "high")).toBe(true);
    expect(categoryResult.body.items.some((item: { searchMatch: { reason: string } }) => item.searchMatch.reason === "category")).toBe(true);
  });

  it("accepts an explicit zero-result report idempotently without using the raw query as an analytics key", async () => {
    const { token, userId } = await loginAndCreateChild(app);
    const auth = { Authorization: `Bearer ${token}` };
    const requestedName = `없는 준비 품목 ${randomUUID()}`;
    const search = await request(app.getHttpServer()).get(`/api/v1/catalog/search?query=${encodeURIComponent(requestedName)}`).set(auth).expect(200);
    expect(search.body).toMatchObject({ items: [], search: { matchedCount: 0, rawQueryStored: false } });

    const first = await request(app.getHttpServer()).post("/api/v1/catalog/missing-item-reports").set(auth).send({ requestedName }).expect(201);
    expect(first.body).toMatchObject({ idempotent: false, report: { reasonCode: "missing_item", state: "open" } });
    const second = await request(app.getHttpServer()).post("/api/v1/catalog/missing-item-reports").set(auth).send({ requestedName }).expect(201);
    expect(second.body).toMatchObject({ idempotent: true, report: { id: first.body.report.id } });

    const stored = await prisma.catalogItemReport.findUniqueOrThrow({ where: { id: first.body.report.id } });
    expect(stored).toMatchObject({ userId, itemDefinitionId: null, reportedText: requestedName });
    expect(stored.queryHash).toMatch(/^[a-f0-9]{64}$/);
    expect(stored.queryHash).not.toContain(requestedName);
  });

  it("returns a server-ranked lifecycle timeline with explainable due windows", async () => {
    const { token, childId } = await loginAndCreateChild(app);
    const response = await request(app.getHttpServer())
      .get(`/api/v1/catalog/timeline?childId=${childId}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    expect(response.body.context).toMatchObject({ lifecycleAxis: "child", lifecycleCode: "newborn_0_3m", nextLifecycleCode: "infant_4_6m" });
    expect(response.body.rankingPolicy).toBe("necessity_and_lifecycle_only_no_offer_or_sponsor_signal");
    expect(response.body.buckets.this_week.length).toBeGreaterThan(0);
    expect(response.body.buckets.this_week[0]).toEqual(expect.objectContaining({
      recommendationReasonCode: expect.any(String),
      recommendationReason: expect.not.stringMatching(/newborn_0_3m|pregnancy_late|first_child/),
      dueWindow: expect.objectContaining({ derivedFrom: "lifecycle" })
    }));

    const itemId = response.body.buckets.this_week[0].id as string;
    await request(app.getHttpServer())
      .post(`/api/v1/catalog/items/${itemId}/report`)
      .set("Authorization", `Bearer ${token}`)
      .send({ reasonCode: "wrong_lifecycle", detail: "현재 가족 상황과 맞지 않아요." })
      .expect(201);
  });

  it("persists scoped preparation contexts with CAS and applies them only in server ranking", async () => {
    const { token, childId } = await loginAndCreateChild(app);
    const auth = { Authorization: `Bearer ${token}` };
    const initial = await request(app.getHttpServer()).get(`/api/v1/catalog/preparation-context?childId=${childId}`).set(auth).expect(200);
    expect(initial.body).toMatchObject({ childId, contextCodes: [], version: 0 });

    const created = await request(app.getHttpServer())
      .put(`/api/v1/catalog/preparation-context?childId=${childId}`)
      .set(auth)
      .send({ contextCodes: ["small_home", "budget_saving", "no_car", "small_home"] })
      .expect(200);
    expect(created.body).toMatchObject({ contextCodes: ["budget_saving", "no_car", "small_home"], version: 1 });

    await request(app.getHttpServer())
      .put(`/api/v1/catalog/preparation-context?childId=${childId}`)
      .set(auth)
      .send({ contextCodes: ["car_primary"] })
      .expect(409);
    const updated = await request(app.getHttpServer())
      .put(`/api/v1/catalog/preparation-context?childId=${childId}`)
      .set(auth)
      .send({ contextCodes: ["small_home", "budget_saving", "no_car"], expectedVersion: 1 })
      .expect(200);
    expect(updated.body.version).toBe(2);
    await request(app.getHttpServer())
      .put(`/api/v1/catalog/preparation-context?childId=${childId}`)
      .set(auth)
      .send({ contextCodes: [], expectedVersion: 1 })
      .expect(409);
    await request(app.getHttpServer())
      .put(`/api/v1/catalog/preparation-context?childId=${childId}`)
      .set(auth)
      .send({ contextCodes: ["not_a_catalog_context"], expectedVersion: 2 })
      .expect(400);
    await request(app.getHttpServer())
      .put(`/api/v1/catalog/preparation-context?childId=${childId}`)
      .set(auth)
      .send({ contextCodes: ["car_primary", "no_car"], expectedVersion: 2 })
      .expect(400);

    const timeline = await request(app.getHttpServer()).get(`/api/v1/catalog/timeline?childId=${childId}`).set(auth).expect(200);
    expect(timeline.body.context).toMatchObject({ selectedContextCodes: ["budget_saving", "no_car", "small_home"], contextVersion: 2 });
    const rankedItems = Object.values(timeline.body.buckets).flat() as Array<{ matchedContextCodes: string[]; recommendationReason: string }>;
    expect(rankedItems.some((item) => item.matchedContextCodes.some((code) => ["budget_saving", "no_car", "small_home"].includes(code)))).toBe(true);
    const contextualReason = rankedItems.find((item) => item.matchedContextCodes.length > 0)?.recommendationReason ?? "";
    expect(contextualReason).toContain("상황");
    expect(contextualReason).not.toMatch(/small_home|first_child|pregnancy_late/);
    expect(timeline.body.rankingPolicy).toBe("necessity_and_lifecycle_only_no_offer_or_sponsor_signal");
  });

  it("previews selected bundle members, applies them atomically, and requires duplicate-purchase acknowledgement", async () => {
    const { token, childId } = await loginAndCreateChild(app);
    const auth = { Authorization: `Bearer ${token}` };
    const bundles = await request(app.getHttpServer()).get(`/api/v1/catalog/bundles?childId=${childId}`).set(auth).expect(200);
    expect(bundles.body.bundles.length).toBeGreaterThanOrEqual(15);
    const bundle = bundles.body.bundles.find((entry: { items: unknown[] }) => entry.items.length >= 2);
    expect(bundle.progress).toEqual(expect.objectContaining({ totalCount: bundle.items.length, completedCount: 0, percentage: 0 }));
    const selected = bundle.items.slice(0, 2).map((item: { id: string }, index: number) => ({ itemId: item.id, state: "planned", quantityNeeded: index + 1, budgetKrw: 10_000 * (index + 1), note: "bundle fixture" }));
    const preview = await request(app.getHttpServer())
      .post(`/api/v1/catalog/bundles/${bundle.id}/apply?childId=${childId}`)
      .set(auth).send({ dryRun: true, items: selected }).expect(201);
    expect(preview.body).toMatchObject({ selectedCount: 2, excludedCount: bundle.items.length - 2, warnings: [], appliedCount: 0 });
    const applied = await request(app.getHttpServer())
      .post(`/api/v1/catalog/bundles/${bundle.id}/apply?childId=${childId}`)
      .set(auth).send({ dryRun: false, items: selected }).expect(201);
    expect(applied.body.plans).toHaveLength(2);
    expect(applied.body.plans[0]).toMatchObject({ state: "planned", desiredQuantity: 1, budgetKrw: 10_000, version: 1 });

    const firstItemId = selected[0]!.itemId;
    await request(app.getHttpServer()).put(`/api/v1/children/${childId}/item-plans/${firstItemId}`).set(auth).send({ state: "owned", expectedVersion: 1 }).expect(200);
    const warningInput = [{ ...selected[0], expectedVersion: 2 }];
    const warning = await request(app.getHttpServer())
      .post(`/api/v1/catalog/bundles/${bundle.id}/apply?childId=${childId}`)
      .set(auth).send({ dryRun: true, items: warningInput }).expect(201);
    expect(warning.body.warnings).toContainEqual(expect.objectContaining({ code: "DUPLICATE_PURCHASE_RISK", itemId: firstItemId, currentState: "owned" }));
    await request(app.getHttpServer())
      .post(`/api/v1/catalog/bundles/${bundle.id}/apply?childId=${childId}`)
      .set(auth).send({ dryRun: false, items: warningInput }).expect(409);
    await request(app.getHttpServer())
      .post(`/api/v1/catalog/bundles/${bundle.id}/apply?childId=${childId}`)
      .set(auth).send({ dryRun: false, items: warningInput, acknowledgeWarningItemIds: [firstItemId] }).expect(201);
  });

  it("fans a recall out to affected plans, in-app acknowledgement, and an idempotent notification job", async () => {
    const { token, childId, userId } = await loginAndCreateChild(app);
    const auth = { Authorization: `Bearer ${token}` };
    const admin = await prisma.adminUser.create({ data: { email: `recall-${randomUUID()}@example.com`, passwordHash: "test", displayName: "recall operator", role: "admin" } });
    const item = await prisma.itemDefinition.create({ data: {
      code: `R4-TEST-RECALL-${randomUUID()}`,
      nameKo: "리콜 전파 테스트 품목",
      shortDescription: "리콜 전파 구조만 검증하는 비의학 테스트 품목",
      targetSubject: "child",
      necessity: "optional",
      recommendationState: "recommended",
      reasonText: "테스트 fixture",
      timingSummary: "사용자 선택",
      secondhandPolicy: "inspect",
      rentalPolicy: "conditional",
      safetyTier: "normal",
      sourceSummary: "test fixture only",
      status: "published",
      contentHash: createHash("sha256").update(randomUUID()).digest("hex"),
      reviewedAt: new Date(),
      reviewedByAdminId: admin.id,
      publishedAt: new Date(),
      publishedByAdminId: admin.id
    } });
    try {
      await request(app.getHttpServer()).put(`/api/v1/children/${childId}/item-plans/${item.id}`).set(auth).send({ state: "owned" }).expect(200);
      const recalled = await catalog.transitionItem(admin.id, item.id, { expectedVersion: item.contentVersion, contentHash: item.contentHash!, toStatus: "recalled", reason: "테스트용 공식 리콜 검수 상태" });
      expect(recalled).toMatchObject({ status: "recalled", recommendationState: "recalled_or_blocked", safetyImpact: { affectedPlanCount: 1, alertCount: 1, notificationQueuedCount: 1 } });

      const response = await request(app.getHttpServer()).get(`/api/v1/catalog/safety-alerts?childId=${childId}`).set(auth).expect(200);
      expect(response.body.alerts).toHaveLength(1);
      expect(response.body.alerts[0]).toMatchObject({ eventType: "recalled", reason: "테스트용 공식 리콜 검수 상태", state: "unread", version: 1, item: { id: item.id, nameKo: "리콜 전파 테스트 품목" }, sourceStatus: "official_or_professional_source_required" });
      const alertId = response.body.alerts[0].id as string;
      await request(app.getHttpServer()).post(`/api/v1/catalog/safety-alerts/${alertId}/acknowledge`).set(auth).send({ expectedVersion: 1 }).expect(201)
        .expect(({ body }) => expect(body).toMatchObject({ state: "acknowledged", acknowledgedByUserId: userId, version: 2 }));
      await request(app.getHttpServer()).post(`/api/v1/catalog/safety-alerts/${alertId}/acknowledge`).set(auth).send({ expectedVersion: 1 }).expect(409);

      const delivery = await prisma.notificationDelivery.findFirstOrThrow({ where: { userId, eventType: "catalog_item_recalled", dedupeKey: { contains: item.id } } });
      const outbox = await prisma.jobOutbox.findFirstOrThrow({ where: { topic: "notification.send", aggregateId: delivery.id } });
      await expect(app.get(JobHandlersService).handle("notification.send", outbox.payloadJson as Record<string, unknown>)).resolves.toMatchObject({ code: "NOTIFICATION_SENT_MOCK_PROVIDER" });
      await expect(app.get(JobHandlersService).handle("notification.send", outbox.payloadJson as Record<string, unknown>)).resolves.toMatchObject({ code: "NOTIFICATION_ALREADY_FINAL" });
    } finally {
      const plans = await prisma.userItemPlan.findMany({ where: { childId, itemDefinitionId: item.id }, select: { id: true } });
      await prisma.catalogSafetyAlert.deleteMany({ where: { userItemPlanId: { in: plans.map((plan) => plan.id) } } });
      const deliveries = await prisma.notificationDelivery.findMany({ where: { userId, eventType: "catalog_item_recalled", dedupeKey: { contains: item.id } }, select: { id: true } });
      await prisma.jobOutbox.deleteMany({ where: { aggregateId: { in: deliveries.map((delivery) => delivery.id) } } });
      await prisma.notificationDelivery.deleteMany({ where: { id: { in: deliveries.map((delivery) => delivery.id) } } });
      await prisma.userItemPlanHistory.deleteMany({ where: { planId: { in: plans.map((plan) => plan.id) } } });
      await prisma.userItemPlan.deleteMany({ where: { id: { in: plans.map((plan) => plan.id) } } });
      await prisma.catalogItemWorkflowEvent.deleteMany({ where: { itemDefinitionId: item.id, actorAdminId: admin.id } });
      await prisma.itemDefinition.delete({ where: { id: item.id } });
      await prisma.adminUser.delete({ where: { id: admin.id } });
    }
  });

  it("keeps public catalog data published-only unless an explicit non-production preview profile is active", async () => {
    const { token } = await loginAndCreateChild(app);
    const auth = { Authorization: `Bearer ${token}` };
    process.env.CATALOG_INTERNAL_PREVIEW_ENABLED = "0";
    for (const nodeEnv of ["test", "staging", ""] as const) {
      process.env.NODE_ENV = nodeEnv;
      const response = await request(app.getHttpServer()).get("/api/v1/catalog/items?limit=1").set(auth).expect(200);
      expect(response.body).toMatchObject({ items: [], total: 0 });
    }
    process.env.NODE_ENV = "production";
    process.env.CATALOG_INTERNAL_PREVIEW_ENABLED = "1";
    await request(app.getHttpServer())
      .get("/api/v1/catalog/items?limit=1")
      .set(auth)
      .expect(200)
      .expect(({ body }) => expect(body).toMatchObject({ items: [], total: 0 }));

    process.env.NODE_ENV = "test";
    process.env.CATALOG_INTERNAL_PREVIEW_ENABLED = "1";
    const internal = await request(app.getHttpServer()).get("/api/v1/catalog/items?limit=1").set(auth).expect(200);
    expect(internal.body.total).toBe(408);
    expect(internal.body.items[0]).toMatchObject({ status: "in_review" });
  });

  it("persists the full preparation state machine with optimistic versioning", async () => {
    const { token, childId } = await loginAndCreateChild(app);
    const search = await request(app.getHttpServer())
      .get(`/api/v1/catalog/search?query=${encodeURIComponent("아기 보드북")}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    const itemId = search.body.items[0].id as string;

    const created = await request(app.getHttpServer())
      .put(`/api/v1/children/${childId}/item-plans/${itemId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        state: "planned",
        quantityNeeded: 3,
        acquisitionType: "secondhand",
        budgetKrw: 30000,
        size: "120",
        variant: "중립 색상",
        purchasedAt: "2026-07-01",
        storageLocation: "현관 수납장",
        recurringIntervalDays: 30,
        notes: "가족과 비교 후 결정"
      })
      .expect(200);
    expect(created.body).toMatchObject({ state: "planned", desiredQuantity: 3, quantityNeeded: 3, acquisitionMode: "secondhand", acquisitionType: "secondhand", size: "120", storageLocation: "현관 수납장", recurringIntervalDays: 30, version: 1 });
    expect(created.body.nextPurchaseDueAt).toContain("2026-07-31");

    await request(app.getHttpServer())
      .put(`/api/v1/children/${childId}/item-plans/${itemId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ state: "owned", ownedQuantity: 3, expectedVersion: 99 })
      .expect(409)
      .expect(({ body }) => expect(body.error.code).toBe("ITEM_PLAN_VERSION_CONFLICT"));

    const updated = await request(app.getHttpServer())
      .put(`/api/v1/children/${childId}/item-plans/${itemId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ state: "owned", ownedQuantity: 3, expectedVersion: 1 })
      .expect(200);
    expect(updated.body).toMatchObject({ state: "owned", ownedQuantity: 3, version: 2 });

    const commentMutationId = randomUUID();
    await request(app.getHttpServer())
      .post(`/api/v1/children/${childId}/item-plans/${itemId}/comments`)
      .set("Authorization", `Bearer ${token}`)
      .set("Idempotency-Key", commentMutationId)
      .send({ body: "보호자가 수납 위치를 확인했어요.", clientMutationId: commentMutationId })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/v1/children/${childId}/item-plans/${itemId}/comments`)
      .set("Authorization", `Bearer ${token}`)
      .set("Idempotency-Key", commentMutationId)
      .send({ body: "보호자가 수납 위치를 확인했어요.", clientMutationId: commentMutationId })
      .expect(201);
    await request(app.getHttpServer())
      .get(`/api/v1/children/${childId}/item-plans/${itemId}/activity`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.history).toHaveLength(2);
        expect(body.comments.filter((comment: { id: string }) => comment.id === commentMutationId)).toHaveLength(1);
        expect(body.comments).toContainEqual(expect.objectContaining({ body: "보호자가 수납 위치를 확인했어요." }));
      });

    const concurrent = await Promise.all([
      request(app.getHttpServer())
        .put(`/api/v1/children/${childId}/item-plans/${itemId}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ state: "planned", expectedVersion: 2 }),
      request(app.getHttpServer())
        .put(`/api/v1/children/${childId}/item-plans/${itemId}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ state: "replacement_needed", expectedVersion: 2 })
    ]);
    expect(concurrent.map((response) => response.status).sort()).toEqual([200, 409]);

    const secondItem = await prisma.itemDefinition.findFirstOrThrow({ where: { id: { not: itemId }, code: { startsWith: "R4-" } } });
    const concurrentCreates = await Promise.all([
      request(app.getHttpServer())
        .put(`/api/v1/children/${childId}/item-plans/${secondItem.id}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ state: "planned" }),
      request(app.getHttpServer())
        .put(`/api/v1/children/${childId}/item-plans/${secondItem.id}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ state: "planned" })
    ]);
    expect(concurrentCreates.map((response) => response.status).sort()).toEqual([200, 409]);
    expect(await prisma.userItemPlan.count({ where: { childId, itemDefinitionId: secondItem.id } })).toBe(1);
  });

  it("creates one temporal notification per stored KST due date across racing schedulers", async () => {
    const { token, childId, userId } = await loginAndCreateChild(app);
    const itemId = (await prisma.itemDefinition.findFirstOrThrow({ where: { code: { startsWith: "R4-" } } })).id;
    await request(app.getHttpServer())
      .put(`/api/v1/children/${childId}/item-plans/${itemId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ state: "owned", replacementDueAt: "2026-07-17", nextPurchaseDueAt: "2026-07-17", recurringIntervalDays: 30 })
      .expect(200);

    const referenceTime = new Date("2026-07-16T15:00:00.000Z");
    await Promise.all(Array.from({ length: 30 }, () => catalog.enqueueTemporalDueNotifications(referenceTime)));
    const deliveries = await prisma.notificationDelivery.findMany({
      where: { userId, childId, targetId: itemId, eventType: { in: ["replacement_due", "recurring_purchase_due"] } }
    });
    expect(deliveries.map((delivery) => delivery.eventType).sort()).toEqual(["recurring_purchase_due", "replacement_due"]);
    expect(await prisma.jobOutbox.count({ where: { aggregateId: { in: deliveries.map((delivery) => delivery.id) }, topic: "notification.send" } })).toBe(2);
    const replacement = deliveries.find((delivery) => delivery.eventType === "replacement_due")!;
    await expect(app.get(JobHandlersService).handle("notification.send", { notificationDeliveryId: replacement.id }))
      .resolves.toMatchObject({ code: "NOTIFICATION_SENT_MOCK_PROVIDER" });

    await request(app.getHttpServer())
      .put(`/api/v1/children/${childId}/item-plans/${itemId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ state: "owned", replacementDueAt: "2026-08-17", nextPurchaseDueAt: "2026-08-17", recurringIntervalDays: 30, expectedVersion: 1 })
      .expect(200);
    const recurring = deliveries.find((delivery) => delivery.eventType === "recurring_purchase_due")!;
    await expect(app.get(JobHandlersService).handle("notification.send", { notificationDeliveryId: recurring.id }))
      .resolves.toMatchObject({ code: "NOTIFICATION_CANCELLED_STALE_TEMPORAL_DUE" });
    await expect(prisma.notificationDelivery.findUniqueOrThrow({ where: { id: recurring.id } }))
      .resolves.toMatchObject({ state: "cancelled", failureCode: "STALE_TEMPORAL_DUE" });
  });

  it("enforces the preparation role matrix and same-household relation scope", async () => {
    const owner = await loginAndCreateChild(app);
    const coParent = await loginAndCreateChild(app);
    const viewer = await loginAndCreateChild(app);
    const gift = await loginAndCreateChild(app);
    const outsider = await loginAndCreateChild(app);
    await prisma.householdMember.createMany({ data: [
      { householdId: owner.householdId, userId: coParent.userId, role: "co_parent", status: "active", joinedAt: new Date() },
      { householdId: owner.householdId, userId: viewer.userId, role: "viewer", status: "active", joinedAt: new Date() },
      { householdId: owner.householdId, userId: gift.userId, role: "gift_participant", status: "active", joinedAt: new Date() }
    ] });
    const item = await prisma.itemDefinition.findFirstOrThrow({ where: { code: { startsWith: "R4-" } } });
    await request(app.getHttpServer())
      .put(`/api/v1/children/${owner.childId}/item-plans/${item.id}`)
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ state: "planned", desiredQuantity: 3, ownedQuantity: 1, budgetKrw: 120000, notes: "가족에게만 보이는 메모", assignedUserId: coParent.userId })
      .expect(200);

    const commentMutationId = randomUUID();
    const requestComment = () => request(app.getHttpServer())
      .post(`/api/v1/children/${owner.childId}/item-plans/${item.id}/comments`)
      .set("Authorization", `Bearer ${owner.token}`)
      .set("Idempotency-Key", commentMutationId)
      .send({ clientMutationId: commentMutationId, body: "긴 한국어 댓글\n<script>alert('x')</script> 😊" });
    const commentResponses = await Promise.all([requestComment(), requestComment()]);
    for (let repeat = 0; repeat < 28; repeat += 1) commentResponses.push(await requestComment());
    expect(commentResponses.map((response) => response.status)).toEqual(Array(30).fill(201));
    expect(new Set(commentResponses.map((response) => response.body.id))).toEqual(new Set([commentMutationId]));
    expect(await prisma.userItemPlanComment.count({ where: { id: commentMutationId } })).toBe(1);
    const coParentInbox = await request(app.getHttpServer())
      .get("/api/v1/notifications?limit=20")
      .set("Authorization", `Bearer ${coParent.token}`)
      .expect(200);
    expect(coParentInbox.body.items).toContainEqual(expect.objectContaining({
      eventType: "item_plan_comment",
      navigation: {
        kind: "item",
        householdId: owner.householdId,
        childId: owner.childId,
        itemId: item.id
      }
    }));

    const viewerPlans = await request(app.getHttpServer())
      .get(`/api/v1/children/${owner.childId}/item-plans`)
      .set("Authorization", `Bearer ${viewer.token}`)
      .expect(200);
    expect(viewerPlans.body.plans[0]).toMatchObject({
      state: "planned",
      desiredQuantity: null,
      ownedQuantity: null,
      budgetKrw: null,
      notes: null,
      assignedUserId: null
    });
    const viewerDetail = await request(app.getHttpServer())
      .get(`/api/v1/catalog/items/${item.id}?childId=${owner.childId}`)
      .set("Authorization", `Bearer ${viewer.token}`)
      .expect(200);
    expect(viewerDetail.body.plan).toMatchObject({
      state: "planned",
      quantityNeeded: null,
      quantityOwned: null,
      budgetKrw: null,
      notes: null
    });
    const viewerActivity = await request(app.getHttpServer())
      .get(`/api/v1/children/${owner.childId}/item-plans/${item.id}/activity`)
      .set("Authorization", `Bearer ${viewer.token}`)
      .expect(200);
    expect(viewerActivity.body.plan).toMatchObject({ desiredQuantity: null, ownedQuantity: null, budgetKrw: null, notes: null, assignedUserId: null });
    expect(JSON.stringify(viewerActivity.body.history)).not.toContain("120000");
    expect(JSON.stringify(viewerActivity.body.history)).not.toContain("가족에게만 보이는 메모");
    expect(viewerActivity.body.comments).toContainEqual(expect.objectContaining({ id: commentMutationId, body: "긴 한국어 댓글\n<script>alert('x')</script> 😊" }));
    await request(app.getHttpServer())
      .put(`/api/v1/children/${owner.childId}/item-plans/${item.id}`)
      .set("Authorization", `Bearer ${viewer.token}`)
      .send({ state: "owned", expectedVersion: 1 })
      .expect(403);
    await request(app.getHttpServer())
      .get(`/api/v1/children/${owner.childId}/item-plans`)
      .set("Authorization", `Bearer ${gift.token}`)
      .expect(403);
    await request(app.getHttpServer())
      .get(`/api/v1/children/${owner.childId}/item-plans/${item.id}/activity`)
      .set("Authorization", `Bearer ${gift.token}`)
      .expect(403);
    await request(app.getHttpServer())
      .put(`/api/v1/children/${owner.childId}/item-plans/${item.id}`)
      .set("Authorization", `Bearer ${gift.token}`)
      .send({ state: "gifted", expectedVersion: 1 })
      .expect(403);

    const hiddenGiftCatalog = await request(app.getHttpServer())
      .get(`/api/v1/catalog/items?childId=${owner.childId}&limit=100`)
      .set("Authorization", `Bearer ${gift.token}`)
      .expect(200);
    expect(hiddenGiftCatalog.body).toMatchObject({ items: [], total: 0 });
    await request(app.getHttpServer())
      .get(`/api/v1/catalog/items/${item.id}?childId=${owner.childId}`)
      .set("Authorization", `Bearer ${gift.token}`)
      .expect(403);

    const giftItem = await prisma.itemDefinition.findFirstOrThrow({ where: { id: { not: item.id }, code: { startsWith: "R4-" } } });
    await request(app.getHttpServer())
      .put(`/api/v1/children/${owner.childId}/item-plans/${giftItem.id}`)
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ state: "gift_expected", desiredQuantity: 2, budgetKrw: 999999, notes: "민감한 선물 메모" })
      .expect(200);
    const sharedGiftCatalog = await request(app.getHttpServer())
      .get(`/api/v1/catalog/items?childId=${owner.childId}&limit=100`)
      .set("Authorization", `Bearer ${gift.token}`)
      .expect(200);
    expect(sharedGiftCatalog.body).toMatchObject({ total: 1, items: [{ id: giftItem.id, plan: { state: "gift_expected", desiredQuantity: 2, budgetKrw: null, note: null, notes: null, assignedUserId: null } }] });
    const sharedGiftDetail = await request(app.getHttpServer())
      .get(`/api/v1/catalog/items/${giftItem.id}?childId=${owner.childId}`)
      .set("Authorization", `Bearer ${gift.token}`)
      .expect(200);
    expect(sharedGiftDetail.body.plan).toMatchObject({ state: "gift_expected", desiredQuantity: 2, budgetKrw: null, notes: null });
    await request(app.getHttpServer())
      .get(`/api/v1/catalog/bundles?childId=${owner.childId}`)
      .set("Authorization", `Bearer ${gift.token}`)
      .expect(403);

    const assigned = await request(app.getHttpServer())
      .put(`/api/v1/children/${owner.childId}/item-plans/${item.id}`)
      .set("Authorization", `Bearer ${coParent.token}`)
      .send({ state: "ordered", assignedUserId: viewer.userId, expectedVersion: 1 })
      .expect(200);
    expect(assigned.body).toMatchObject({ assignedUserId: viewer.userId, version: 2 });
    const assignmentInbox = await request(app.getHttpServer())
      .get("/api/v1/notifications?limit=20")
      .set("Authorization", `Bearer ${viewer.token}`)
      .expect(200);
    expect(assignmentInbox.body.items).toContainEqual(expect.objectContaining({
      eventType: "item_plan_assigned",
      category: "family",
      route: "preparation",
      navigation: {
        kind: "item",
        householdId: owner.householdId,
        childId: owner.childId,
        itemId: item.id
      }
    }));
    await request(app.getHttpServer())
      .put(`/api/v1/children/${owner.childId}/item-plans/${item.id}`)
      .set("Authorization", `Bearer ${coParent.token}`)
      .send({ state: "owned", assignedUserId: outsider.userId, expectedVersion: 2 })
      .expect(403);

    const category = await prisma.category.findFirstOrThrow();
    const foreignExpense = await prisma.expense.create({ data: {
      householdId: outsider.householdId,
      childId: outsider.childId,
      createdByUserId: outsider.userId,
      categoryId: category.id,
      amountKrw: 1000,
      spentOn: new Date("2026-07-16T00:00:00.000Z"),
      itemName: "foreign expense"
    } });
    await request(app.getHttpServer())
      .put(`/api/v1/children/${owner.childId}/item-plans/${item.id}`)
      .set("Authorization", `Bearer ${coParent.token}`)
      .send({ state: "owned", linkedExpenseId: foreignExpense.id, expectedVersion: 2 })
      .expect(403);
  });

  it("accepts every canonical Release 4 preparation state", async () => {
    const { token, childId } = await loginAndCreateChild(app);
    const search = await request(app.getHttpServer())
      .get(`/api/v1/catalog/search?query=${encodeURIComponent("아기 보드북")}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    const itemId = search.body.items[0].id as string;
    const states = [
      "not_considered", "researching", "planned", "ordered", "owned", "borrowed",
      "rented", "gift_expected", "gifted", "not_needed", "replacement_needed", "retired"
    ];
    let version: number | undefined;
    for (const state of states) {
      const response = await request(app.getHttpServer())
        .put(`/api/v1/children/${childId}/item-plans/${itemId}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ state, ...(version ? { expectedVersion: version } : {}) })
        .expect(200);
      expect(response.body.state).toBe(state);
      version = response.body.version as number;
    }
    expect(version).toBe(states.length);
  });

  it("keeps 14 accounting categories separate and reports honest publish blockers", async () => {
    const { token, householdId } = await loginAndCreateChild(app);
    const categories = await request(app.getHttpServer())
      .get(`/api/v1/households/${householdId}/expense-categories`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    expect(categories.body.categories).toHaveLength(14);
    expect(categories.body.categories.map((category: { nameKo: string }) => category.nameKo)).not.toContain("약품/교통");

    const coverage = await request(app.getHttpServer())
      .get("/api/v1/catalog/coverage-summary")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    expect(coverage.body).toMatchObject({ domains: 24, canonicalItems: 408, aliases: 3278, highRiskAwaitingProfessionalReview: 84, publishBlocked: true });
    expect(coverage.body.matrix.gap).toBeGreaterThan(0);
  });

  it("filters optional scenarios without using medical context as a direct recommendation", async () => {
    const { token } = await loginAndCreateChild(app);
    const family = await request(app.getHttpServer())
      .get("/api/v1/catalog/items?contextCode=second_or_later&limit=100")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    expect(family.body.items.length).toBeGreaterThan(0);
    const medical = await request(app.getHttpServer())
      .get("/api/v1/catalog/items?contextCode=preterm_or_nicu&limit=100")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    expect(medical.body.items.length).toBeGreaterThan(0);
    expect(medical.body.items.every((item: { recommendationState: string; safetyTier: string }) =>
      item.recommendationState === "professional_review_required" && item.safetyTier === "high"
    )).toBe(true);
  });

  it("keeps maternal and child preparation contexts separate", async () => {
    const { token, householdId, childId } = await loginAndCreateChild(app);
    const pregnantChild = await request(app.getHttpServer())
      .post("/api/v1/children")
      .set("Authorization", `Bearer ${token}`)
      .send({ householdId, nickname: "출산 예정", stageMode: "pregnant", dueDate: "2026-10-01" })
      .expect(200);
    const contexts = await request(app.getHttpServer())
      .get("/api/v1/catalog/contexts")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    const profile = contexts.body.motherProfiles.find((entry: { childId: string }) => entry.childId === pregnantChild.body.id);
    expect(profile).toMatchObject({ dueDate: "2026-10-01", active: true });

    const maternalItems = await request(app.getHttpServer())
      .get(`/api/v1/catalog/items?motherProfileId=${profile.id}&lifecycleAxis=mother&limit=10`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    expect(maternalItems.body.items.length).toBeGreaterThan(0);
    expect(maternalItems.body.items.every((item: { targetSubject: string }) => item.targetSubject !== "child")).toBe(true);
    const itemId = maternalItems.body.items[0].id as string;

    await request(app.getHttpServer())
      .put(`/api/v1/mother-profiles/${profile.id}/item-plans/${itemId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ state: "researching" })
      .expect(200)
      .expect(({ body }) => expect(body).toMatchObject({ childId: null, motherProfileId: profile.id, state: "researching" }));
    const maternalDetail = await request(app.getHttpServer())
      .get(`/api/v1/catalog/items/${itemId}?motherProfileId=${profile.id}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    expect(maternalDetail.body.plan).toMatchObject({ state: "researching" });
    const childDetail = await request(app.getHttpServer())
      .get(`/api/v1/catalog/items/${itemId}?childId=${childId}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    expect(childDetail.body.plan).toBeNull();
    await request(app.getHttpServer())
      .get(`/api/v1/catalog/items/${itemId}?childId=${childId}&motherProfileId=${profile.id}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(400);
  });
});
