import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { randomUUID } from "node:crypto";
import { reportCategoriesSchema, reportMembersSchema, reportPreparationSchema, reportRecurringSchema, reportSourcesSchema, reportSummarySchema, reportTrendSchema, reportV3Schema } from "@wooriai/contracts";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AppModule } from "../src/app.module";
import { configureApiApp } from "../src/bootstrap";
import { PrismaService } from "../src/prisma/prisma.service";
import { JobHandlersService } from "../src/jobs/job-handlers.service";

async function session(app: INestApplication, label: string) {
  const login = await request(app.getHttpServer()).post("/api/v1/auth/oauth-login").send({ provider: "kakao", providerToken: `r4-report-${label}-${randomUUID()}` }).expect(200);
  const token = login.body.tokens.accessToken as string;
  const me = await request(app.getHttpServer()).get("/api/v1/me").set("Authorization", `Bearer ${token}`).expect(200);
  const householdId = me.body.households[0].id as string;
  await request(app.getHttpServer()).put("/api/v1/consents").set("Authorization", `Bearer ${token}`).send({ consents: [{ type: "terms", version: "2026-07-06", accepted: true }, { type: "privacy", version: "2026-07-06", accepted: true }] }).expect(200);
  const child = await request(app.getHttpServer()).post("/api/v1/children").set("Authorization", `Bearer ${token}`).send({ householdId, nickname: label, stageMode: "manual", manualStage: "newborn_0_3" }).expect(200);
  return { token, userId: me.body.user.id as string, householdId, childId: child.body.id as string };
}

describe("Release 4 report V2 APIs", () => {
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

  it("aggregates the selected range and separates gift, refund, support, preparation, trend, and recurring data", async () => {
    const owner = await session(app, "리포트");
    const legacy = await prisma.category.findFirstOrThrow({ where: { code: "diaper_hygiene" } });
    const accounting = await prisma.expenseCategoryV2.findFirstOrThrow({ where: { householdId: null, code: "diaper_hygiene" } });
    const item = await prisma.itemDefinition.findFirstOrThrow({ where: { code: { startsWith: "R4-" }, necessity: "required" } });
    const additionalPlanItems = await prisma.itemDefinition.findMany({ where: { code: { startsWith: "R4-" }, id: { not: item.id } }, take: 2 });
    await prisma.userItemPlan.createMany({ data: [
      { householdId: owner.householdId, childId: owner.childId, itemDefinitionId: item.id, state: "planned", dueDate: new Date("2026-06-15T00:00:00.000Z"), budgetKrw: 30000, recurringIntervalDays: 30 },
      { householdId: owner.householdId, childId: owner.childId, itemDefinitionId: additionalPlanItems[0]!.id, state: "planned", dueDate: new Date("2026-07-15T00:00:00.000Z"), budgetKrw: 20000 },
      { householdId: owner.householdId, childId: owner.childId, itemDefinitionId: additionalPlanItems[1]!.id, state: "planned", dueDate: new Date("2026-07-20T00:00:00.000Z"), budgetKrw: 10000 }
    ] });
    await prisma.expense.createMany({ data: [
      { householdId: owner.householdId, childId: owner.childId, createdByUserId: owner.userId, categoryId: legacy.id, expenseCategoryV2Id: accounting.id, linkedItemDefinitionId: item.id, amountKrw: 10000, spentOn: new Date("2026-05-10T00:00:00.000Z"), itemName: "반복 기저귀", merchant: "우리상점", expenseType: "expense" },
      { householdId: owner.householdId, childId: owner.childId, createdByUserId: owner.userId, categoryId: legacy.id, expenseCategoryV2Id: accounting.id, linkedItemDefinitionId: item.id, amountKrw: 12000, spentOn: new Date("2026-06-10T00:00:00.000Z"), itemName: "반복 기저귀", merchant: "우리상점", expenseType: "expense" },
      { householdId: owner.householdId, childId: owner.childId, createdByUserId: owner.userId, categoryId: legacy.id, expenseCategoryV2Id: accounting.id, linkedItemDefinitionId: item.id, amountKrw: 15000, spentOn: new Date("2026-07-10T00:00:00.000Z"), itemName: "반복 기저귀", merchant: "우리상점", expenseType: "expense" },
      { householdId: owner.householdId, childId: owner.childId, createdByUserId: owner.userId, categoryId: legacy.id, expenseCategoryV2Id: accounting.id, amountKrw: 5000, spentOn: new Date("2026-07-11T00:00:00.000Z"), itemName: "선물", expenseType: "gift" },
      { householdId: owner.householdId, childId: owner.childId, createdByUserId: owner.userId, categoryId: legacy.id, expenseCategoryV2Id: accounting.id, amountKrw: 2000, spentOn: new Date("2026-07-12T00:00:00.000Z"), itemName: "환불", expenseType: "refund" },
      { householdId: owner.householdId, childId: owner.childId, createdByUserId: owner.userId, categoryId: legacy.id, expenseCategoryV2Id: accounting.id, amountKrw: 3000, spentOn: new Date("2026-07-13T00:00:00.000Z"), itemName: "지원금", expenseType: "support" }
    ] });
    const query = `childId=${owner.childId}&from=2026-05-01&to=2026-07-31`;
    const auth = { Authorization: `Bearer ${owner.token}` };

    const summaryResponse = await request(app.getHttpServer()).get(`/api/v1/reports/summary?${query}`).set(auth).expect(200);
    const summary = reportSummarySchema.parse(summaryResponse.body);
    expect(summaryResponse.headers.etag).toMatch(/^".+"$/);
    expect(summary.totals).toMatchObject({ expenseKrw: 37000, giftKrw: 5000, refundKrw: 2000, supportKrw: 3000, netHouseholdOutflowKrw: 32000, linkedPreparationCostKrw: 37000, unlinkedCostKrw: -5000, recordCount: 6 });
    expect(summary).toMatchObject({
      periodStart: "2026-05-01",
      periodEndExclusive: "2026-08-01",
      timezone: "Asia/Seoul",
      currency: "KRW",
      expenseTotal: 37000,
      giftTotal: 5000,
      refundTotal: 2000,
      supportTotal: 3000,
      netOutflow: 32000
    });
    expect(summary.categoryBreakdown.reduce((sum, row) => sum + row.netHouseholdOutflowKrw, 0)).toBe(summary.netOutflow);
    expect(summary.series.reduce((sum, row) => sum + row.netHouseholdOutflowKrw, 0)).toBe(summary.netOutflow);
    expect(summary.dataMaturity).toEqual(summary.maturity);
    expect(summary.previousPeriodComparison).toBeNull();
    expect(summary.maturity).toMatchObject({ showCategories: true, showTrend: true, showRecurring: true, showMembers: false });

    const categories = reportCategoriesSchema.parse((await request(app.getHttpServer()).get(`/api/v1/reports/categories?${query}`).set(auth).expect(200)).body);
    expect(categories.categories).toHaveLength(1);
    expect(categories.percentageTotal).toBe(100);
    expect(categories.categories[0]).toMatchObject({ categoryCode: "diaper_hygiene", percentage: 100 });

    const trend = reportTrendSchema.parse((await request(app.getHttpServer()).get(`/api/v1/reports/trend?${query}&unit=month`).set(auth).expect(200)).body);
    expect(trend.buckets.map((bucket) => bucket.key)).toEqual(["2026-05", "2026-06", "2026-07"]);

    const members = reportMembersSchema.parse((await request(app.getHttpServer()).get(`/api/v1/reports/members?${query}`).set(auth).expect(200)).body);
    expect(members.members).toHaveLength(1);
    expect(members.percentageTotal).toBe(100);

    const preparation = reportPreparationSchema.parse((await request(app.getHttpServer()).get(`/api/v1/reports/preparation?${query}`).set(auth).expect(200)).body);
    expect(preparation.groups).toEqual([expect.objectContaining({ necessity: "required", linkedPreparationCostKrw: 37000 })]);

    const recurring = reportRecurringSchema.parse((await request(app.getHttpServer()).get(`/api/v1/reports/recurring?${query}`).set(auth).expect(200)).body);
    expect(recurring.items).toEqual([expect.objectContaining({ itemName: "반복 기저귀", distinctMonths: 3, recordCount: 3 })]);

    const v3 = reportV3Schema.parse((await request(app.getHttpServer()).get(`/api/v1/reports/v3?${query}`).set(auth).expect(200)).body);
    expect(v3.summary).toMatchObject({ plannedPreparationCostKrw: 60000, actualPreparationCostKrw: 37000, remainingPlannedCostKrw: 23000, budgetVarianceKrw: -23000 });
    expect(v3.period).toMatchObject({ householdId: owner.householdId, childId: owner.childId });
    expect(v3.costNature.recurring).toMatchObject({ plannedCostKrw: 30000, actualCostKrw: 37000, monthlyEstimateKrw: 30438, planCount: 1 });
    expect(v3.payerContributions).toEqual([expect.objectContaining({ payerUserId: owner.userId, netHouseholdOutflowKrw: 32000, percentage: 100 })]);
    expect(v3.ledger).toMatchObject({ giftKrw: 5000, refundKrw: 2000, supportKrw: 3000 });
    expect(v3.forecast).toMatchObject({ rangeLowKrw: 23000, rangeHighKrw: 53438, confidence: "limited" });

    const plannedSources = reportSourcesSchema.parse((await request(app.getHttpServer())
      .get(`/api/v1/reports/v3/sources?${query}&kind=planned&limit=2`)
      .set(auth)
      .expect(200)).body);
    expect(plannedSources.totals).toEqual({ amountKrw: 60000, signedAmountKrw: 60000, recordCount: 3 });
    expect(plannedSources.pageTotals).toEqual({ amountKrw: 50000, signedAmountKrw: 50000, recordCount: 2 });
    expect(plannedSources.period).toMatchObject({ householdId: owner.householdId, childId: owner.childId });
    expect(plannedSources.items).toHaveLength(2);
    expect(plannedSources.nextCursor).not.toBeNull();
    const plannedNextPage = reportSourcesSchema.parse((await request(app.getHttpServer())
      .get(`/api/v1/reports/v3/sources?${query}&kind=planned&limit=2&cursor=${encodeURIComponent(plannedSources.nextCursor!)}`)
      .set(auth)
      .expect(200)).body);
    expect(plannedNextPage.items).toHaveLength(1);
    expect(plannedNextPage.pageTotals).toEqual({ amountKrw: 10000, signedAmountKrw: 10000, recordCount: 1 });
    expect([...plannedSources.items, ...plannedNextPage.items].reduce((sum, source) => sum + source.signedAmountKrw, 0)).toBe(v3.summary.plannedPreparationCostKrw);
    for (let repeat = 0; repeat < 30; repeat += 1) {
      const repeatedV3 = reportV3Schema.parse((await request(app.getHttpServer())
        .get(`/api/v1/reports/v3?${query}`)
        .set(auth)
        .expect(200)).body);
      const repeatedSources = reportSourcesSchema.parse((await request(app.getHttpServer())
        .get(`/api/v1/reports/v3/sources?${query}&kind=planned&limit=50`)
        .set(auth)
        .expect(200)).body);
      expect(repeatedSources.totals.signedAmountKrw).toBe(repeatedV3.summary.plannedPreparationCostKrw);
      expect(repeatedSources.pageTotals.signedAmountKrw).toBe(repeatedSources.totals.signedAmountKrw);
    }

    const actualSources = reportSourcesSchema.parse((await request(app.getHttpServer())
      .get(`/api/v1/reports/v3/sources?${query}&kind=actual_preparation`)
      .set(auth)
      .expect(200)).body);
    expect(actualSources.totals.signedAmountKrw).toBe(v3.summary.actualPreparationCostKrw);

    const refundSources = reportSourcesSchema.parse((await request(app.getHttpServer())
      .get(`/api/v1/reports/v3/sources?${query}&kind=refund`)
      .set(auth)
      .expect(200)).body);
    expect(refundSources.totals).toEqual({ amountKrw: 2000, signedAmountKrw: -2000, recordCount: 1 });

    const augustV3 = reportV3Schema.parse((await request(app.getHttpServer()).get(`/api/v1/reports/v3?childId=${owner.childId}&period=month&anchor=2026-08-15`).set(auth).expect(200)).body);
    expect(augustV3.summary).toMatchObject({ plannedPreparationCostKrw: 0, actualPreparationCostKrw: 0, remainingPlannedCostKrw: 0 });
    expect(augustV3.costNature.recurring).toMatchObject({ plannedCostKrw: 0, monthlyEstimateKrw: 30438, planCount: 1 });
    expect(augustV3.forecast).toBeNull();
    expect(augustV3.forecastUnavailableReason).not.toBeNull();

    const integrity = await app.get(JobHandlersService).handle("report.integrity_check", { childId: owner.childId, yearMonth: "2026-07" });
    expect(integrity).toMatchObject({ code: "REPORT_INTEGRITY_MATCHED", details: { ledgerTotalKrw: 10000, aggregateTotalKrw: 10000 } });
  });

  it("rejects invalid ranges, unknown query fields, and cross-household access", async () => {
    const owner = await session(app, "소유자");
    const outsider = await session(app, "외부인");
    await request(app.getHttpServer()).get(`/api/v1/reports/summary?childId=${owner.childId}&from=2026-02-30&to=2026-03-01`).set("Authorization", `Bearer ${owner.token}`).expect(400);
    await request(app.getHttpServer()).get(`/api/v1/reports/summary?childId=${owner.childId}&from=2026-01-01&to=2026-01-31&extra=1`).set("Authorization", `Bearer ${owner.token}`).expect(400);
    await request(app.getHttpServer()).get(`/api/v1/reports/summary?childId=${owner.childId}&from=2026-01-01&to=2026-01-31`).set("Authorization", `Bearer ${outsider.token}`).expect(403);
  });

  it("returns a planned-only aggregate when an unscheduled budget exists without expenses", async () => {
    const owner = await session(app, "예정비용");
    const item = await prisma.itemDefinition.findFirstOrThrow({ where: { code: { startsWith: "R4-" } } });
    await prisma.userItemPlan.create({
      data: {
        householdId: owner.householdId,
        childId: owner.childId,
        itemDefinitionId: item.id,
        state: "planned",
        dueDate: null,
        budgetKrw: 125000
      }
    });

    const report = reportV3Schema.parse((await request(app.getHttpServer())
      .get(`/api/v1/reports/v3?childId=${owner.childId}&period=month&anchor=2026-07-15`)
      .set("Authorization", `Bearer ${owner.token}`)
      .expect(200)).body);

    expect(report.reportState).toEqual({
      hasActual: false,
      hasPlanned: true,
      hasRecurring: false,
      displayState: "planned_only"
    });
    expect(report.summary).toMatchObject({
      plannedPreparationCostKrw: 125000,
      scheduledPlannedCostKrw: 0,
      unscheduledPlannedCostKrw: 125000,
      actualPreparationCostKrw: 0,
      unscheduledPlanCount: 1
    });
    expect(report.ledger.recordCount).toBe(0);
  });

  it("keeps household financial reports private from gift participants", async () => {
    const owner = await session(app, "report-owner");
    const viewer = await session(app, "report-viewer");
    const gift = await session(app, "report-gift");
    await prisma.householdMember.createMany({ data: [
      { householdId: owner.householdId, userId: viewer.userId, role: "viewer", status: "active", joinedAt: new Date() },
      { householdId: owner.householdId, userId: gift.userId, role: "gift_participant", status: "active", joinedAt: new Date() }
    ] });
    const query = `childId=${owner.childId}&from=2026-07-01&to=2026-07-31`;

    await request(app.getHttpServer())
      .get(`/api/v1/reports/summary?${query}`)
      .set("Authorization", `Bearer ${viewer.token}`)
      .expect(200);
    for (const path of ["summary", "categories", "members", "preparation", "recurring", "v3"]) {
      await request(app.getHttpServer())
        .get(`/api/v1/reports/${path}?${query}`)
        .set("Authorization", `Bearer ${gift.token}`)
        .expect(403)
        .expect(({ body }) => expect(body.error.code).toBe("REPORT_PRIVATE"));
    }
    await request(app.getHttpServer())
      .get(`/api/v1/reports/v3/sources?${query}&kind=household_net`)
      .set("Authorization", `Bearer ${gift.token}`)
      .expect(403)
      .expect(({ body }) => expect(body.error.code).toBe("REPORT_PRIVATE"));
    await request(app.getHttpServer())
      .get(`/api/v1/reports/trend?${query}&unit=month`)
      .set("Authorization", `Bearer ${gift.token}`)
      .expect(403);
  });

  it("owns month, quarter, leap-year, and year boundaries on the server", async () => {
    const owner = await session(app, "기간");
    const auth = { Authorization: `Bearer ${owner.token}` };
    const getPeriod = async (period: "month" | "quarter" | "year", anchor: string) => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/reports/summary?childId=${owner.childId}&period=${period}&anchor=${anchor}`)
        .set(auth)
        .expect(200);
      return reportSummarySchema.parse(response.body).period;
    };
    await expect(getPeriod("month", "2024-02-29")).resolves.toMatchObject({
      kind: "month",
      periodStart: "2024-02-01",
      periodEnd: "2024-02-29",
      periodEndExclusive: "2024-03-01",
      timezone: "Asia/Seoul",
      currency: "KRW"
    });
    await expect(getPeriod("quarter", "2026-12-31")).resolves.toMatchObject({
      kind: "quarter",
      periodStart: "2026-10-01",
      periodEnd: "2026-12-31"
    });
    const quarter = reportSummarySchema.parse((await request(app.getHttpServer())
      .get(`/api/v1/reports/summary?childId=${owner.childId}&period=quarter&anchor=2026-12-31`)
      .set(auth)
      .expect(200)).body);
    expect(quarter.previousPeriodComparison).toMatchObject({ periodStart: "2026-07-01", periodEnd: "2026-09-30" });
    await expect(getPeriod("year", "2026-07-15")).resolves.toMatchObject({
      kind: "year",
      periodStart: "2026-01-01",
      periodEnd: "2026-12-31"
    });
    await request(app.getHttpServer())
      .get(`/api/v1/reports/summary?childId=${owner.childId}&period=month&anchor=2026-07-15&from=2026-07-01&to=2026-07-31`)
      .set(auth)
      .expect(400);
  });

  it("links an expense to a canonical preparation item and its default accounting category", async () => {
    const owner = await session(app, "연결");
    const legacy = await prisma.category.findFirstOrThrow({ where: { code: "diaper_hygiene" } });
    const item = await prisma.itemDefinition.findFirstOrThrow({ where: { code: { startsWith: "R4-" } } });
    const mapping = await prisma.itemExpenseCategoryMapping.findFirstOrThrow({ where: { itemDefinitionId: item.id, isDefault: true } });
    const created = await request(app.getHttpServer())
      .post(`/api/v1/children/${owner.childId}/expenses`)
      .set("Authorization", `Bearer ${owner.token}`)
      .set("Idempotency-Key", randomUUID())
      .send({ categoryId: legacy.id, amountKrw: 15000, spentOn: "2026-07-15", itemName: item.nameKo, linkedItemDefinitionId: item.id, expenseType: "expense" })
      .expect(200);
    expect(created.body).toMatchObject({ linkedItemDefinitionId: item.id, expenseCategoryV2Id: mapping.expenseCategoryId });
  });
});
