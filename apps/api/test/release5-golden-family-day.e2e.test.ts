import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AppModule } from "../src/app.module";
import { configureApiApp } from "../src/bootstrap";
import { JobHandlersService } from "../src/jobs/job-handlers.service";
import { PrismaService } from "../src/prisma/prisma.service";

async function session(app: INestApplication, label: string) {
  const login = await request(app.getHttpServer())
    .post("/api/v1/auth/oauth-login")
    .send({ provider: "kakao", providerToken: `release5-golden-${label}-${randomUUID()}` })
    .expect(200);
  const token = login.body.tokens.accessToken as string;
  const me = await request(app.getHttpServer()).get("/api/v1/me").set("Authorization", `Bearer ${token}`).expect(200);
  return { token, userId: me.body.user.id as string, householdId: me.body.households[0].id as string };
}

describe("Release 5 Golden Family Day", () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeEach(async () => {
    process.env.JWT_ACCESS_SECRET = "test-access-secret";
    process.env.JWT_REFRESH_SECRET = "test-refresh-secret";
    process.env.PRIVACY_STATUS_TOKEN_SECRET = "test-status-token-secret";
    process.env.NODE_ENV = "test";
    process.env.RELEASE5_INTERNAL_FEATURES = "1";
    process.env.RELEASE5_RECEIPT_FIXTURE = "1";
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApiApp(app);
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterEach(async () => {
    delete process.env.RELEASE5_INTERNAL_FEATURES;
    delete process.env.RELEASE5_RECEIPT_FIXTURE;
    await app.close();
  });

  it("connects daily preparation, assisted expense, Report, privacy, and account deletion in one scope", async () => {
    const owner = await session(app, "owner");
    const coParent = await session(app, "co-parent");
    const gift = await session(app, "gift");
    await prisma.householdMember.createMany({ data: [
      { householdId: owner.householdId, userId: coParent.userId, role: "co_parent", status: "active", joinedAt: new Date() },
      { householdId: owner.householdId, userId: gift.userId, role: "gift_participant", status: "active", joinedAt: new Date() }
    ] });
    const [childA, childB] = await Promise.all([
      prisma.child.create({ data: { householdId: owner.householdId, nickname: "골든 아이 A", stageMode: "manual", manualStage: "infant_7_12" } }),
      prisma.child.create({ data: { householdId: owner.householdId, nickname: "골든 아이 B", stageMode: "manual", manualStage: "infant_7_12" } })
    ]);
    const items = await prisma.itemDefinition.findMany({ take: 3, orderBy: { id: "asc" } });
    const existingPlan = await prisma.userItemPlan.create({ data: {
      householdId: owner.householdId,
      childId: childA.id,
      itemDefinitionId: items[0]!.id,
      state: "planned",
      assignedUserId: coParent.userId,
      dueDate: new Date("2026-07-16"),
      budgetKrw: 120_000
    } });
    const otherChildPlan = await prisma.userItemPlan.create({ data: {
      householdId: owner.householdId,
      childId: childB.id,
      itemDefinitionId: items[2]!.id,
      state: "planned",
      dueDate: new Date("2026-07-20")
    } });

    const today = await request(app.getHttpServer())
      .get(`/api/v1/children/${childA.id}/today-center?referenceDate=2026-07-17`)
      .set("Authorization", `Bearer ${owner.token}`)
      .expect(200);
    expect(today.body.actions).toEqual(expect.arrayContaining([expect.objectContaining({ kind: "overdue_assigned" })]));
    expect(today.body.actions.length).toBeLessThanOrEqual(3);

    const bundle = await request(app.getHttpServer())
      .post(`/api/v1/households/${owner.householdId}/custom-bundles`)
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ title: "골든 외출 묶음", scopeType: "child", items: [
        { itemDefinitionId: items[0]!.id, defaultQuantity: 2 },
        { itemDefinitionId: items[1]!.id, defaultQuantity: 1 }
      ] })
      .expect(200);
    const bundleKey = randomUUID();
    const apply = () => request(app.getHttpServer())
      .post(`/api/v1/households/${owner.householdId}/custom-bundles/${bundle.body.id}/apply`)
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ childId: childA.id, expectedVersion: bundle.body.version, idempotencyKey: bundleKey });
    expect((await apply().expect(200)).body).toMatchObject({ createdCount: 1, existingCount: 1 });
    expect((await apply().expect(200)).body).toMatchObject({ createdCount: 1, existingCount: 1 });
    expect(await prisma.userItemPlan.findUniqueOrThrow({ where: { id: existingPlan.id } })).toMatchObject({ budgetKrw: 120_000, assignedUserId: coParent.userId });
    const receiptPlan = await prisma.userItemPlan.findFirstOrThrow({ where: { householdId: owner.householdId, childId: childA.id, itemDefinitionId: items[1]!.id } });

    const calendar = await request(app.getHttpServer())
      .get(`/api/v1/households/${owner.householdId}/preparation-calendar?month=2026-07&childId=${childA.id}`)
      .set("Authorization", `Bearer ${owner.token}`)
      .expect(200);
    expect(calendar.body.events).toContainEqual(expect.objectContaining({ planId: existingPlan.id, status: "overdue" }));
    expect(calendar.body.events.map((event: { planId: string }) => event.planId)).not.toContain(otherChildPlan.id);

    const category = await prisma.category.findFirstOrThrow();
    const receipt = await request(app.getHttpServer())
      .post("/api/v1/receipt-drafts")
      .set("Authorization", `Bearer ${owner.token}`)
      .send({
        childId: childA.id,
        contentHash: "9".repeat(64),
        fileName: "golden-receipt.png",
        mimeType: "image/png",
        fileSizeBytes: 4096,
        fixtureExtraction: { amountKrw: 42_000, spentOn: "2026-07-17", itemName: items[1]!.nameKo, confidence: 0.9 }
      })
      .expect(200);
    expect(await prisma.expense.count({ where: { childId: childA.id } })).toBe(0);
    const confirmationKey = randomUUID();
    const confirmationBody = {
      confirmed: true,
      idempotencyKey: confirmationKey,
      expectedVersion: receipt.body.draft.version,
      categoryId: category.id,
      amountKrw: 42_000,
      spentOn: "2026-07-17",
      itemName: items[1]!.nameKo,
      linkedItemDefinitionId: items[1]!.id
    };
    const firstConfirmation = await request(app.getHttpServer())
      .post(`/api/v1/receipt-drafts/${receipt.body.draft.id}/confirm`)
      .set("Authorization", `Bearer ${owner.token}`)
      .send(confirmationBody)
      .expect(200);
    const repeatedConfirmation = await request(app.getHttpServer())
      .post(`/api/v1/receipt-drafts/${receipt.body.draft.id}/confirm`)
      .set("Authorization", `Bearer ${owner.token}`)
      .send(confirmationBody)
      .expect(200);
    expect(repeatedConfirmation.body.expenseId).toBe(firstConfirmation.body.expenseId);
    expect(await prisma.expense.count({ where: { childId: childA.id } })).toBe(1);

    const linkBody = { planId: receiptPlan.id, expectedVersion: 1, reasonCode: "canonical_match" };
    const linked = await request(app.getHttpServer())
      .put(`/api/v1/expenses/${firstConfirmation.body.expenseId}/plan-link`)
      .set("Authorization", `Bearer ${owner.token}`)
      .send(linkBody)
      .expect(200);
    expect(linked.body).toMatchObject({ linked: true, planId: receiptPlan.id });

    const report = await request(app.getHttpServer())
      .get(`/api/v1/reports/v3?childId=${childA.id}&period=month&anchor=2026-07-17`)
      .set("Authorization", `Bearer ${owner.token}`)
      .expect(200);
    const sources = await request(app.getHttpServer())
      .get(`/api/v1/reports/v3/sources?childId=${childA.id}&period=month&anchor=2026-07-17&kind=actual_preparation`)
      .set("Authorization", `Bearer ${owner.token}`)
      .expect(200);
    expect(report.body.summary).toMatchObject({ plannedPreparationCostKrw: 120_000, actualPreparationCostKrw: 42_000 });
    expect(sources.body.totals.signedAmountKrw).toBe(report.body.summary.actualPreparationCostKrw);

    await prisma.userItemPlan.update({ where: { id: receiptPlan.id }, data: { recurringIntervalDays: 30 } });
    await prisma.expense.createMany({ data: [
      { householdId: owner.householdId, childId: childA.id, createdByUserId: owner.userId, payerUserId: owner.userId, categoryId: category.id, amountKrw: 40_000, spentOn: new Date("2026-05-17"), itemName: items[1]!.nameKo, linkedItemDefinitionId: items[1]!.id },
      { householdId: owner.householdId, childId: childA.id, createdByUserId: owner.userId, payerUserId: owner.userId, categoryId: category.id, amountKrw: 41_000, spentOn: new Date("2026-06-17"), itemName: items[1]!.nameKo, linkedItemDefinitionId: items[1]!.id }
    ] });
    const prediction = await request(app.getHttpServer())
      .get(`/api/v1/item-plans/${receiptPlan.id}/recurring-prediction`)
      .set("Authorization", `Bearer ${owner.token}`)
      .expect(200);
    expect(prediction.body).toMatchObject({ historyCount: 3, prediction: { confidence: "low" } });

    const briefing = await request(app.getHttpServer())
      .get(`/api/v1/households/${owner.householdId}/weekly-briefings/current?referenceDate=2026-07-17`)
      .set("Authorization", `Bearer ${owner.token}`)
      .expect(200);
    expect(briefing.body.sections.financial).toEqual(expect.any(Object));
    await request(app.getHttpServer()).get(`/api/v1/receipt-drafts/${receipt.body.draft.id}`).set("Authorization", `Bearer ${gift.token}`).expect(404);
    await request(app.getHttpServer()).get(`/api/v1/reports/v3?childId=${childA.id}&period=month&anchor=2026-07-17`).set("Authorization", `Bearer ${gift.token}`).expect(403);

    const exportRequest = await request(app.getHttpServer())
      .post("/api/v1/privacy/data-export")
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ confirmationText: "EXPORT DATA" })
      .expect(202);
    await app.get(JobHandlersService).handle("privacy.export", { privacyRequestId: exportRequest.body.id });
    const exportRow = await prisma.privacyRequest.findUniqueOrThrow({ where: { id: exportRequest.body.id } });
    expect(exportRow.retentionSummaryJson).toMatchObject({ exportSchemaVersion: 5 });

    await request(app.getHttpServer())
      .post(`/api/v1/households/${owner.householdId}/transfer-ownership`)
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ targetUserId: coParent.userId })
      .expect(200);
    const deletion = await request(app.getHttpServer())
      .post("/api/v1/privacy/account-deletion")
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ confirmationText: "DELETE ACCOUNT" })
      .expect(202);
    await request(app.getHttpServer()).get("/api/v1/me").set("Authorization", `Bearer ${owner.token}`).expect(200);
    await prisma.privacyRequest.update({
      where: { id: deletion.body.id },
      data: { dueAt: new Date(Date.now() - 1_000) }
    });
    await app.get(JobHandlersService).handle("privacy.delete", { privacyRequestId: deletion.body.id });
    await request(app.getHttpServer()).get("/api/v1/me").set("Authorization", `Bearer ${owner.token}`).expect(401);
    expect(await prisma.receiptDraft.count({ where: { createdByUserId: owner.userId } })).toBe(0);
    const deletionRow = await prisma.privacyRequest.findUniqueOrThrow({ where: { id: deletion.body.id } });
    expect(deletionRow.retentionSummaryJson).toMatchObject({
      release5: { purgedUserPrivate: expect.arrayContaining(["receipt_drafts_and_extraction", "weekly_briefings"]) }
    });
  });
});
