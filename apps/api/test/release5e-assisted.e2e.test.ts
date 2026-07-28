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
  const login = await request(app.getHttpServer()).post("/api/v1/auth/oauth-login").send({ provider: "kakao", providerToken: `release5e-${label}-${randomUUID()}` }).expect(200);
  const token = login.body.tokens.accessToken as string;
  const me = await request(app.getHttpServer()).get("/api/v1/me").set("Authorization", `Bearer ${token}`).expect(200);
  return { token, userId: me.body.user.id as string, householdId: me.body.households[0].id as string };
}

describe("Release 5E assisted expense APIs", () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeEach(async () => {
    process.env.JWT_ACCESS_SECRET = "test-access-secret";
    process.env.JWT_REFRESH_SECRET = "test-refresh-secret";
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

  it("requires receipt confirmation, deduplicates 30 retries, scopes links, and suppresses sparse predictions", async () => {
    const owner = await session(app, "owner");
    const gift = await session(app, "gift");
    const child = await prisma.child.create({ data: { householdId: owner.householdId, nickname: "영수증 아이", stageMode: "manual", manualStage: "infant_7_12" } });
    const otherChild = await prisma.child.create({ data: { householdId: owner.householdId, nickname: "다른 아이", stageMode: "manual", manualStage: "infant_7_12" } });
    await prisma.householdMember.create({ data: { householdId: owner.householdId, userId: gift.userId, role: "gift_participant", status: "active", joinedAt: new Date() } });
    const category = await prisma.category.findFirstOrThrow();
    const items = await prisma.itemDefinition.findMany({ take: 2, orderBy: { id: "asc" } });
    const plan = await prisma.userItemPlan.create({ data: { householdId: owner.householdId, childId: child.id, itemDefinitionId: items[0]!.id, state: "planned", dueDate: new Date("2026-07-15"), budgetKrw: 60_000, recurringIntervalDays: 30 } });
    const otherPlan = await prisma.userItemPlan.create({ data: { householdId: owner.householdId, childId: otherChild.id, itemDefinitionId: items[1]!.id, state: "planned", recurringIntervalDays: 30 } });
    const hash = "a".repeat(64);

    await request(app.getHttpServer()).post("/api/v1/receipt-drafts").set("Authorization", `Bearer ${owner.token}`).send({
      childId: child.id, contentHash: hash, fileName: "../receipt.jpg", mimeType: "image/jpeg", fileSizeBytes: 100
    }).expect(400);
    const created = await request(app.getHttpServer()).post("/api/v1/receipt-drafts").set("Authorization", `Bearer ${owner.token}`).send({
      childId: child.id,
      contentHash: hash,
      fileName: "receipt.jpg",
      mimeType: "image/jpeg",
      fileSizeBytes: 12_000,
      fixtureExtraction: { amountKrw: 55_000, spentOn: "2026-05-01", merchant: "가족 상점", itemName: items[0]!.nameKo, confidence: 0.82 }
    }).expect(200);
    expect(created.body).toMatchObject({ duplicate: false, providerMode: "LOCAL_FIXTURE", draft: { status: "review_ready", confirmedExpenseId: null, version: 1 } });
    const draftId = created.body.draft.id as string;
    expect(await prisma.expense.count({ where: { childId: child.id } })).toBe(0);

    await request(app.getHttpServer()).get(`/api/v1/receipt-drafts/${draftId}`).set("Authorization", `Bearer ${gift.token}`).expect(404);
    const duplicateDraft = await request(app.getHttpServer()).post("/api/v1/receipt-drafts").set("Authorization", `Bearer ${owner.token}`).send({
      childId: child.id, contentHash: hash, fileName: "receipt.jpg", mimeType: "image/jpeg", fileSizeBytes: 12_000
    }).expect(200);
    expect(duplicateDraft.body).toMatchObject({ duplicate: true, draft: { id: draftId } });

    const idempotencyKey = randomUUID();
    let confirmation: { body: Record<string, unknown> } | undefined;
    for (let repeat = 0; repeat < 30; repeat += 1) {
      confirmation = await request(app.getHttpServer()).post(`/api/v1/receipt-drafts/${draftId}/confirm`).set("Authorization", `Bearer ${owner.token}`).send({
        confirmed: true,
        idempotencyKey,
        expectedVersion: 1,
        categoryId: category.id,
        amountKrw: 55_000,
        spentOn: "2026-05-01",
        itemName: items[0]!.nameKo,
        merchant: "가족 상점"
      }).expect(200);
    }
    const expenseId = confirmation!.body.expenseId as string;
    expect(await prisma.expense.count({ where: { childId: child.id } })).toBe(1);
    expect(await prisma.receiptConfirmation.count({ where: { receiptDraftId: draftId } })).toBe(1);

    const suggestions = await request(app.getHttpServer()).get(`/api/v1/expenses/${expenseId}/plan-link-suggestions`).set("Authorization", `Bearer ${owner.token}`).expect(200);
    expect(suggestions.body.suggestions.map((suggestion: { planId: string }) => suggestion.planId)).toContain(plan.id);
    expect(suggestions.body.suggestions.map((suggestion: { planId: string }) => suggestion.planId)).not.toContain(otherPlan.id);
    await request(app.getHttpServer()).put(`/api/v1/expenses/${expenseId}/plan-link`).set("Authorization", `Bearer ${owner.token}`).send({ planId: otherPlan.id, expectedVersion: 1, reasonCode: "explicit_item" }).expect(400);

    let linked: { body: Record<string, unknown> } | undefined;
    for (let repeat = 0; repeat < 30; repeat += 1) {
      linked = await request(app.getHttpServer()).put(`/api/v1/expenses/${expenseId}/plan-link`).set("Authorization", `Bearer ${owner.token}`).send({ planId: plan.id, expectedVersion: 1, reasonCode: "explicit_item" }).expect(200);
    }
    expect(linked!.body).toMatchObject({ linked: true, planId: plan.id });
    expect(await prisma.expensePlanLinkEvent.count({ where: { expenseId, action: "linked" } })).toBe(1);

    const sparse = await request(app.getHttpServer()).get(`/api/v1/item-plans/${plan.id}/recurring-prediction`).set("Authorization", `Bearer ${owner.token}`).expect(200);
    expect(sparse.body).toMatchObject({ prediction: null, historyCount: 1, minimumPurchaseCount: 3 });
    await prisma.expense.createMany({ data: [
      { householdId: owner.householdId, childId: child.id, createdByUserId: owner.userId, payerUserId: owner.userId, categoryId: category.id, amountKrw: 60_000, spentOn: new Date("2026-06-01"), itemName: items[0]!.nameKo, linkedItemDefinitionId: items[0]!.id },
      { householdId: owner.householdId, childId: child.id, createdByUserId: owner.userId, payerUserId: owner.userId, categoryId: category.id, amountKrw: 70_000, spentOn: new Date("2026-07-01"), itemName: items[0]!.nameKo, linkedItemDefinitionId: items[0]!.id }
    ] });
    const prediction = await request(app.getHttpServer()).get(`/api/v1/item-plans/${plan.id}/recurring-prediction`).set("Authorization", `Bearer ${owner.token}`).expect(200);
    expect(prediction.body.prediction).toEqual({ predictedDate: "2026-08-01", intervalDays: 31, confidence: "low" });

    const explanation = await request(app.getHttpServer()).get(`/api/v1/reports/variance-explanation?childId=${child.id}&from=2026-05-01&to=2026-07-17`).set("Authorization", `Bearer ${owner.token}`).expect(200);
    expect(explanation.body).toMatchObject({ source: "report_v3", explanation: { basis: "report_v3_ledger_and_plan" } });
    await request(app.getHttpServer()).get(`/api/v1/reports/variance-explanation?childId=${child.id}&from=2026-05-01&to=2026-07-17`).set("Authorization", `Bearer ${gift.token}`).expect(403);
  });

  it("binds Release 5 user datasets to the privacy export manifest", async () => {
    const owner = await session(app, "privacy-export");
    const child = await prisma.child.create({
      data: { householdId: owner.householdId, nickname: "내보내기 아이", stageMode: "manual", manualStage: "infant_7_12" }
    });
    await prisma.notificationPreference.create({ data: { userId: owner.userId } });
    await prisma.receiptDraft.create({
      data: {
        householdId: owner.householdId,
        childId: child.id,
        createdByUserId: owner.userId,
        contentHash: "e".repeat(64),
        fileName: "export-receipt.png",
        mimeType: "image/png",
        fileSizeBytes: 1024
      }
    });

    const requested = await request(app.getHttpServer())
      .post("/api/v1/privacy/data-export")
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ confirmationText: "EXPORT DATA" })
      .expect(202);
    await expect(app.get(JobHandlersService).handle("privacy.export", { privacyRequestId: requested.body.id }))
      .resolves.toMatchObject({ code: "EXPORT_COMPLETED_MOCK_STORAGE" });

    const completed = await prisma.privacyRequest.findUniqueOrThrow({ where: { id: requested.body.id } });
    expect(completed.retentionSummaryJson).toMatchObject({
      exportSchemaVersion: 5,
      includedRelease5Datasets: expect.arrayContaining([
        { dataset: "notification_preferences", recordCount: 1 },
        { dataset: "receipt_drafts_and_extraction", recordCount: 1 },
        { dataset: "today_action_preferences", recordCount: 0 }
      ]),
      localDeviceReceiptDrafts: "purged_on_logout_or_account_deletion_not_server_exported"
    });
  });
});
