import type { INestApplication } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AppModule } from "../src/app.module";
import { configureApiApp } from "../src/bootstrap";
import { TokenService } from "../src/auth/token.service";
import { AuditLoggerService } from "../src/common/audit/audit-logger.service";
import { OnboardingStoreService } from "../src/onboarding/onboarding-store.service";

const categoryId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

async function login(app: INestApplication, providerToken: string) {
  const response = await request(app.getHttpServer())
    .post("/api/v1/auth/oauth-login")
    .send({ provider: "kakao", providerToken })
    .expect(200);

  return response.body.tokens.accessToken as string;
}

async function completeOnboarding(app: INestApplication, accessToken: string) {
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
      .send({
        householdId,
        nickname: "튼튼이",
        stageMode: "manual",
        manualStage: "infant_4_6"
      })
      .expect(200)
  ).body.id as string;

  await request(app.getHttpServer())
    .post(`/api/v1/children/${childId}/prepared-items`)
    .set("Authorization", `Bearer ${accessToken}`)
    .send({ itemTemplateIds: [] })
    .expect(200);

  await request(app.getHttpServer())
    .put(`/api/v1/children/${childId}/budget`)
    .set("Authorization", `Bearer ${accessToken}`)
    .send({ yearMonth: "2026-07-01", amountKrw: 100000 })
    .expect(200);

  return { childId, householdId };
}

describe("Expense, budget, home, and report API", () => {
  let app: INestApplication;
  let moduleRef: TestingModule;

  beforeEach(async () => {
    process.env.JWT_ACCESS_SECRET = "test-access-secret";
    process.env.JWT_REFRESH_SECRET = "test-refresh-secret";
    process.env.WOORIAI_STAGE_TODAY = "2026-07-06";

    moduleRef = await Test.createTestingModule({
      imports: [AppModule]
    }).compile();

    app = moduleRef.createNestApplication();
    configureApiApp(app);
    await app.init();
  });

  afterEach(async () => {
    delete process.env.WOORIAI_STAGE_TODAY;
    await app.close();
  });

  it("keeps expense list, budget, home, and reports on the same totals through update and soft delete", async () => {
    const accessToken = await login(app, `batch06-expense-${randomUUID()}`);
    const { childId, householdId } = await completeOnboarding(app, accessToken);

    const userId = (
      await request(app.getHttpServer())
        .get("/api/v1/me")
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(200)
    ).body.user.id as string;

    await request(app.getHttpServer())
      .get(`/api/v1/home?childId=${childId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.totalExpenseKrw).toBe(0);
        expect(body.monthly).toMatchObject({
          childId,
          yearMonth: "2026-07-01",
          amountKrw: 100000,
          usedAmountKrw: 0,
          remainingAmountKrw: 100000
        });
        expect(body.recentExpenses).toEqual([]);
      });

    const created = (
      await request(app.getHttpServer())
        .post(`/api/v1/children/${childId}/expenses`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({
          categoryId,
          amountKrw: 49800,
          spentOn: "2026-07-06",
          itemName: "기저귀",
          merchant: "맘마마트",
          paymentMethod: "card",
          memo: "첫 기록"
        })
        .expect(200)
        .expect(({ body }) => {
          expect(body).toMatchObject({
            id: expect.any(String),
            childId,
            categoryId,
            amountKrw: 49800,
            spentOn: "2026-07-06",
            itemName: "기저귀",
            merchant: "맘마마트",
            memo: "첫 기록",
            expenseType: "expense",
            source: "manual",
            createdByUserId: userId
          });
        })
    ).body as { id: string };

    await expectTotals(accessToken, childId, 49800, 50200, created.id);

    await request(app.getHttpServer())
      .patch(`/api/v1/expenses/${created.id}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ amountKrw: 59800, memo: "수정된 기록" })
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          id: created.id,
          amountKrw: 59800,
          memo: "수정된 기록"
        });
      });

    await expectTotals(accessToken, childId, 59800, 40200, created.id);

    await request(app.getHttpServer())
      .delete(`/api/v1/expenses/${created.id}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual({ success: true });
      });

    await request(app.getHttpServer())
      .get(`/api/v1/children/${childId}/expenses?yearMonth=2026-07`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.totalAmountKrw).toBe(0);
        expect(body.expenses).toEqual([]);
      });

    await request(app.getHttpServer())
      .get(`/api/v1/home?childId=${childId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.totalExpenseKrw).toBe(0);
        expect(body.monthly.usedAmountKrw).toBe(0);
        expect(body.recentExpenses).toEqual([]);
      });

    await request(app.getHttpServer())
      .get(`/api/v1/children/${childId}/reports/monthly?yearMonth=2026-07`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.totalExpenseKrw).toBe(0);
        expect(body.budgetAmountKrw).toBe(100000);
        expect(body.categoryTop).toEqual([]);
      });

    const auditLogger = moduleRef.get(AuditLoggerService);
    expect(auditLogger.entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          actorUserId: expect.any(String),
          householdId,
          action: "expense.delete",
          targetType: "expense",
          targetId: created.id
        })
      ])
    );
  });

  it("derives home recentExpenses (newest 3) and totalExpenseKrw (all-time sum) consistently from the same expense set (PERF-103)", async () => {
    const accessToken = await login(app, `perf103-home-${randomUUID()}`);
    const { childId } = await completeOnboarding(app, accessToken);

    // Five expenses: four in the current month (2026-07, pinned by WOORIAI_STAGE_TODAY)
    // and one in June, so totalExpenseKrw (all-time) and monthly.usedAmountKrw
    // (current month) diverge and each would catch its own regression.
    const seeds = [
      { amountKrw: 11000, spentOn: "2026-06-20", itemName: "6월 물티슈" },
      { amountKrw: 1000, spentOn: "2026-07-01", itemName: "7월 지출 1" },
      { amountKrw: 2000, spentOn: "2026-07-02", itemName: "7월 지출 2" },
      { amountKrw: 3000, spentOn: "2026-07-03", itemName: "7월 지출 3" },
      { amountKrw: 4000, spentOn: "2026-07-04", itemName: "7월 지출 4" }
    ];
    for (const seed of seeds) {
      await request(app.getHttpServer())
        .post(`/api/v1/children/${childId}/expenses`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ categoryId, ...seed, paymentMethod: "card" })
        .expect(200);
    }

    await request(app.getHttpServer())
      .get(`/api/v1/home?childId=${childId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200)
      .expect(({ body }) => {
        // totalExpenseKrw is the sum of ALL five expenses (not just the sliced recent 3,
        // not just the current month).
        expect(body.totalExpenseKrw).toBe(11000 + 1000 + 2000 + 3000 + 4000);
        // recentExpenses is exactly the newest 3 by spentOn desc.
        expect(body.recentExpenses).toHaveLength(3);
        expect(
          body.recentExpenses.map((expense: { spentOn: string; amountKrw: number; itemName: string }) => ({
            spentOn: expense.spentOn,
            amountKrw: expense.amountKrw,
            itemName: expense.itemName
          }))
        ).toEqual([
          { spentOn: "2026-07-04", amountKrw: 4000, itemName: "7월 지출 4" },
          { spentOn: "2026-07-03", amountKrw: 3000, itemName: "7월 지출 3" },
          { spentOn: "2026-07-02", amountKrw: 2000, itemName: "7월 지출 2" }
        ]);
        // monthly stays scoped to the current month only.
        expect(body.monthly).toMatchObject({
          childId,
          yearMonth: "2026-07-01",
          amountKrw: 100000,
          usedAmountKrw: 1000 + 2000 + 3000 + 4000,
          remainingAmountKrw: 100000 - (1000 + 2000 + 3000 + 4000)
        });
      });
  });

  it("rejects invalid expense input and excludes gift expenses from default totals", async () => {
    const providerToken = `batch06-validation-${randomUUID()}`;
    const accessToken = await login(app, providerToken);
    const { childId } = await completeOnboarding(app, accessToken);

    await request(app.getHttpServer())
      .post(`/api/v1/children/${childId}/expenses`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        categoryId,
        amountKrw: 0,
        spentOn: "2026-07-06",
        itemName: "금액 오류"
      })
      .expect(400)
      .expect(({ body }) => {
        expect(body.error.code).toBe("VALIDATION_ERROR");
      });

    await request(app.getHttpServer())
      .post(`/api/v1/children/${childId}/expenses`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        categoryId,
        amountKrw: 12000,
        spentOn: "2999-01-01",
        itemName: "미래 날짜"
      })
      .expect(400)
      .expect(({ body }) => {
        expect(body.error.code).toBe("EXPENSE_FUTURE_DATE");
      });

    await request(app.getHttpServer())
      .post(`/api/v1/children/${childId}/expenses`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        categoryId,
        amountKrw: 12000,
        spentOn: "2026-02-31",
        itemName: "달력상 불가능한 날짜"
      })
      .expect(400)
      .expect(({ body }) => {
        expect(body.error.code).toBe("EXPENSE_DATE_INVALID");
      });

    await request(app.getHttpServer())
      .post(`/api/v1/children/${childId}/expenses`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        categoryId,
        amountKrw: 12000,
        spentOn: "2026-07-06",
        itemName: "존재하지 않는 준비템",
        linkedItemTemplateId: "99999999-9999-4999-8999-999999999999"
      })
      .expect(400)
      .expect(({ body }) => {
        expect(body.error.code).toBe("EXPENSE_LINKED_ITEM_TEMPLATE_INVALID");
      });

    const tokenService = moduleRef.get(TokenService);
    const store = moduleRef.get(OnboardingStoreService) as OnboardingStoreService & {
      createExpense: (
        user: Awaited<ReturnType<TokenService["createDevUser"]>>,
        childId: string,
        input: {
          categoryId: string;
          amountKrw: number;
          spentOn: string;
          itemName: string;
          paymentMethod: "unknown";
          expenseType: "gift";
        }
      ) => Promise<unknown>;
    };

    await store.createExpense(await tokenService.createDevUser("kakao", providerToken), childId, {
      categoryId,
      amountKrw: 75000,
      spentOn: "2026-07-06",
      itemName: "선물 받은 유모차",
      paymentMethod: "unknown",
      expenseType: "gift"
    });

    await request(app.getHttpServer())
      .get(`/api/v1/home?childId=${childId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.totalExpenseKrw).toBe(0);
        expect(body.monthly.usedAmountKrw).toBe(0);
      });

    await request(app.getHttpServer())
      .get(`/api/v1/children/${childId}/reports/monthly?yearMonth=2026-07`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.totalExpenseKrw).toBe(0);
        expect(body.categoryTop).toEqual([]);
      });
  });

  it("creates a gift expense through the public create-expense API and excludes it from home and report totals", async () => {
    const accessToken = await login(app, `batch06-gift-api-${randomUUID()}`);
    const { childId } = await completeOnboarding(app, accessToken);

    const giftExpense = (
      await request(app.getHttpServer())
        .post(`/api/v1/children/${childId}/expenses`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({
          categoryId,
          amountKrw: 75000,
          spentOn: "2026-07-06",
          itemName: "선물 받은 유모차",
          expenseType: "gift"
        })
        .expect(200)
        .expect(({ body }) => {
          expect(body).toMatchObject({ expenseType: "gift" });
        })
    ).body as { id: string };

    await request(app.getHttpServer())
      .get(`/api/v1/home?childId=${childId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.totalExpenseKrw).toBe(0);
        expect(body.monthly.usedAmountKrw).toBe(0);
      });

    await request(app.getHttpServer())
      .get(`/api/v1/children/${childId}/reports/monthly?yearMonth=2026-07`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.totalExpenseKrw).toBe(0);
        expect(body.categoryTop).toEqual([]);
      });

    await request(app.getHttpServer())
      .patch(`/api/v1/expenses/${giftExpense.id}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ expenseType: "expense" })
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({ id: giftExpense.id, expenseType: "expense" });
      });

    await request(app.getHttpServer())
      .get(`/api/v1/home?childId=${childId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.totalExpenseKrw).toBe(75000);
      });

    await request(app.getHttpServer())
      .post(`/api/v1/children/${childId}/expenses`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        categoryId,
        amountKrw: 10000,
        spentOn: "2026-07-06",
        itemName: "지출 타입 오류",
        expenseType: "refund"
      })
      .expect(400)
      .expect(({ body }) => {
        expect(body.error.code).toBe("VALIDATION_ERROR");
      });
  });

  it("aggregates a full 12-month yearly report while excluding soft-deleted and gift expenses", async () => {
    const providerToken = `batch-yearly-report-${randomUUID()}`;
    const accessToken = await login(app, providerToken);
    const { childId } = await completeOnboarding(app, accessToken);

    const januaryExpense = (
      await request(app.getHttpServer())
        .post(`/api/v1/children/${childId}/expenses`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({
          categoryId,
          amountKrw: 20000,
          spentOn: "2026-01-15",
          itemName: "1월 기저귀",
          paymentMethod: "card"
        })
        .expect(200)
    ).body as { id: string };

    await request(app.getHttpServer())
      .post(`/api/v1/children/${childId}/expenses`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        categoryId,
        amountKrw: 30000,
        spentOn: "2026-07-06",
        itemName: "7월 기저귀",
        paymentMethod: "card"
      })
      .expect(200);

    const marchExpenseToDelete = (
      await request(app.getHttpServer())
        .post(`/api/v1/children/${childId}/expenses`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({
          categoryId,
          amountKrw: 15000,
          spentOn: "2026-03-10",
          itemName: "3월 삭제 예정",
          paymentMethod: "card"
        })
        .expect(200)
    ).body as { id: string };

    await request(app.getHttpServer())
      .delete(`/api/v1/expenses/${marchExpenseToDelete.id}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);

    const tokenService = moduleRef.get(TokenService);
    const store = moduleRef.get(OnboardingStoreService) as OnboardingStoreService & {
      createExpense: (
        user: Awaited<ReturnType<TokenService["createDevUser"]>>,
        childId: string,
        input: {
          categoryId: string;
          amountKrw: number;
          spentOn: string;
          itemName: string;
          paymentMethod: "unknown";
          expenseType: "gift";
        }
      ) => Promise<unknown>;
    };
    await store.createExpense(await tokenService.createDevUser("kakao", providerToken), childId, {
      categoryId,
      amountKrw: 99999,
      spentOn: "2026-02-01",
      itemName: "2월 선물",
      paymentMethod: "unknown",
      expenseType: "gift"
    });

    await request(app.getHttpServer())
      .get(`/api/v1/children/${childId}/reports/yearly?year=2026`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.childId).toBe(childId);
        expect(body.year).toBe("2026");
        expect(body.monthlyTotals).toHaveLength(12);
        expect(body.monthlyTotals.map((month: { yearMonth: string }) => month.yearMonth)).toEqual([
          "2026-01",
          "2026-02",
          "2026-03",
          "2026-04",
          "2026-05",
          "2026-06",
          "2026-07",
          "2026-08",
          "2026-09",
          "2026-10",
          "2026-11",
          "2026-12"
        ]);
        expect(body.monthlyTotals[0]).toEqual({ yearMonth: "2026-01", totalExpenseKrw: 20000 });
        expect(body.monthlyTotals[1]).toEqual({ yearMonth: "2026-02", totalExpenseKrw: 0 });
        expect(body.monthlyTotals[2]).toEqual({ yearMonth: "2026-03", totalExpenseKrw: 0 });
        expect(body.monthlyTotals[6]).toEqual({ yearMonth: "2026-07", totalExpenseKrw: 30000 });
        const sumOfMonths = body.monthlyTotals.reduce(
          (sum: number, month: { totalExpenseKrw: number }) => sum + month.totalExpenseKrw,
          0
        );
        expect(body.totalExpenseKrw).toBe(sumOfMonths);
        expect(body.totalExpenseKrw).toBe(50000);
      });

    await request(app.getHttpServer())
      .get(`/api/v1/children/${childId}/reports/yearly`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.year).toBe("2026");
        expect(body.totalExpenseKrw).toBe(50000);
      });

    expect(januaryExpense.id).toEqual(expect.any(String));
  });

  it("scopes the category report to a given month when yearMonth is provided, and to all time otherwise", async () => {
    const accessToken = await login(app, `batch-category-report-${randomUUID()}`);
    const { childId } = await completeOnboarding(app, accessToken);
    // Round 4 validates that categoryId references an existing categories row (see
    // requireExistingCategory in onboarding-store.service.ts), so this needs a real
    // seeded id rather than an arbitrary UUID. This is one of the deterministic
    // mobile-category-alias ids seeded in prisma/seed-data.ts (mobileCategoryAliasSeeds),
    // distinct from `categoryId` (the import-stub default id) used elsewhere in this file.
    const otherCategoryId = "c0a7e901-0000-4c04-8c04-c47e900ec004";

    await request(app.getHttpServer())
      .post(`/api/v1/children/${childId}/expenses`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        categoryId,
        amountKrw: 20000,
        spentOn: "2026-06-10",
        itemName: "6월 기저귀",
        paymentMethod: "card"
      })
      .expect(200);

    await request(app.getHttpServer())
      .post(`/api/v1/children/${childId}/expenses`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        categoryId: otherCategoryId,
        amountKrw: 30000,
        spentOn: "2026-07-06",
        itemName: "7월 분유",
        paymentMethod: "card"
      })
      .expect(200);

    await request(app.getHttpServer())
      .get(`/api/v1/children/${childId}/reports/category?yearMonth=2026-07`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.childId).toBe(childId);
        expect(body.categories).toEqual([
          { categoryId: otherCategoryId, amountKrw: 30000, count: 1 }
        ]);
      });

    await request(app.getHttpServer())
      .get(`/api/v1/children/${childId}/reports/category?yearMonth=2026-06`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.categories).toEqual([{ categoryId, amountKrw: 20000, count: 1 }]);
      });

    await request(app.getHttpServer())
      .get(`/api/v1/children/${childId}/reports/category`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.categories.sort((left: { amountKrw: number }, right: { amountKrw: number }) => right.amountKrw - left.amountKrw)).toEqual(
          [
            { categoryId: otherCategoryId, amountKrw: 30000, count: 1 },
            { categoryId, amountKrw: 20000, count: 1 }
          ]
        );
      });

    await request(app.getHttpServer())
      .get(`/api/v1/children/${childId}/reports/category?yearMonth=bad-format`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(400)
      .expect(({ body }) => {
        expect(body.error.code).toBe("VALIDATION_ERROR");
      });
  });

  it("scopes the category report to a year or quarter and rejects conflicting period params (REP-104)", async () => {
    const accessToken = await login(app, `rep104-category-period-${randomUUID()}`);
    const { childId } = await completeOnboarding(app, accessToken);
    // Deterministic mobile-category-alias seed id (prisma/seed-data.ts), same as the
    // yearMonth-scoped category test above.
    const otherCategoryId = "c0a7e901-0000-4c04-8c04-c47e900ec004";

    const seedExpense = async (input: { categoryId: string; amountKrw: number; spentOn: string; itemName: string }) =>
      (
        await request(app.getHttpServer())
          .post(`/api/v1/children/${childId}/expenses`)
          .set("Authorization", `Bearer ${accessToken}`)
          .send({ ...input, paymentMethod: "card" })
          .expect(200)
      ).body as { id: string };

    await seedExpense({ categoryId, amountKrw: 10000, spentOn: "2026-02-10", itemName: "1분기 기저귀" });
    await seedExpense({ categoryId: otherCategoryId, amountKrw: 20000, spentOn: "2026-05-03", itemName: "2분기 분유" });
    await seedExpense({ categoryId, amountKrw: 40000, spentOn: "2025-11-10", itemName: "작년 4분기 내복" });

    // Soft-deleted expense inside Q2 2026 must not count toward any breakdown.
    const deleted = await seedExpense({ categoryId, amountKrw: 5000, spentOn: "2026-04-01", itemName: "삭제될 지출" });
    await request(app.getHttpServer())
      .delete(`/api/v1/expenses/${deleted.id}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);

    // Whole year 2026: Q1 + Q2 expenses only, sorted by amount desc.
    await request(app.getHttpServer())
      .get(`/api/v1/children/${childId}/reports/category?year=2026`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.childId).toBe(childId);
        expect(body.categories).toEqual([
          { categoryId: otherCategoryId, amountKrw: 20000, count: 1 },
          { categoryId, amountKrw: 10000, count: 1 }
        ]);
      });

    // Quarter filters slice the same year differently -- Q1 vs Q2 breakdowns differ.
    await request(app.getHttpServer())
      .get(`/api/v1/children/${childId}/reports/category?year=2026&quarter=1`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.categories).toEqual([{ categoryId, amountKrw: 10000, count: 1 }]);
      });

    await request(app.getHttpServer())
      .get(`/api/v1/children/${childId}/reports/category?year=2026&quarter=2`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.categories).toEqual([{ categoryId: otherCategoryId, amountKrw: 20000, count: 1 }]);
      });

    // Q4 of the previous year (quarter range spans months 10-12).
    await request(app.getHttpServer())
      .get(`/api/v1/children/${childId}/reports/category?year=2025&quarter=4`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.categories).toEqual([{ categoryId, amountKrw: 40000, count: 1 }]);
      });

    // No params keeps the historical all-time behavior (both years, both categories).
    await request(app.getHttpServer())
      .get(`/api/v1/children/${childId}/reports/category`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.categories).toEqual([
          { categoryId, amountKrw: 50000, count: 2 },
          { categoryId: otherCategoryId, amountKrw: 20000, count: 1 }
        ]);
      });

    // quarter without year is rejected.
    await request(app.getHttpServer())
      .get(`/api/v1/children/${childId}/reports/category?quarter=2`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(400)
      .expect(({ body }) => {
        expect(body.error.code).toBe("REPORT_PERIOD_INVALID");
      });

    // yearMonth is mutually exclusive with year/quarter.
    await request(app.getHttpServer())
      .get(`/api/v1/children/${childId}/reports/category?yearMonth=2026-05&year=2026`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(400)
      .expect(({ body }) => {
        expect(body.error.code).toBe("REPORT_PERIOD_INVALID");
      });

    // Out-of-range quarter fails per-field DTO validation.
    await request(app.getHttpServer())
      .get(`/api/v1/children/${childId}/reports/category?year=2026&quarter=5`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(400)
      .expect(({ body }) => {
        expect(body.error.code).toBe("VALIDATION_ERROR");
      });
  });

  it("accepts both YYYY-MM and YYYY-MM-01 period inputs and rejects other days (REP-105)", async () => {
    const accessToken = await login(app, `rep105-period-tolerance-${randomUUID()}`);
    const { childId } = await completeOnboarding(app, accessToken);

    // Budget PUT tolerates the short `YYYY-MM` form; the response keeps the
    // unchanged first-of-month shape.
    await request(app.getHttpServer())
      .put(`/api/v1/children/${childId}/budget`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ yearMonth: "2026-07", amountKrw: 120000 })
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({ childId, yearMonth: "2026-07-01", amountKrw: 120000 });
      });

    // The long `YYYY-MM-01` form targets the same month (upsert, not a second row).
    await request(app.getHttpServer())
      .put(`/api/v1/children/${childId}/budget`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ yearMonth: "2026-07-01", amountKrw: 130000 })
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({ childId, yearMonth: "2026-07-01", amountKrw: 130000 });
      });

    // A mid-month day is rejected, never silently truncated to its month.
    await request(app.getHttpServer())
      .put(`/api/v1/children/${childId}/budget`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ yearMonth: "2026-08-15", amountKrw: 140000 })
      .expect(400)
      .expect(({ body }) => {
        expect(body.error.code).toBe("VALIDATION_ERROR");
      });

    await request(app.getHttpServer())
      .post(`/api/v1/children/${childId}/expenses`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ categoryId, amountKrw: 10000, spentOn: "2026-07-06", itemName: "기저귀", paymentMethod: "card" })
      .expect(200);

    // Monthly report: both query forms return the identical, unchanged response.
    const monthlyShort = await request(app.getHttpServer())
      .get(`/api/v1/children/${childId}/reports/monthly?yearMonth=2026-07`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);
    const monthlyLong = await request(app.getHttpServer())
      .get(`/api/v1/children/${childId}/reports/monthly?yearMonth=2026-07-01`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);
    expect(monthlyLong.body).toEqual(monthlyShort.body);
    expect(monthlyShort.body).toMatchObject({
      childId,
      yearMonth: "2026-07-01",
      totalExpenseKrw: 10000,
      budgetAmountKrw: 130000
    });

    await request(app.getHttpServer())
      .get(`/api/v1/children/${childId}/reports/monthly?yearMonth=2026-08-15`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(400)
      .expect(({ body }) => {
        expect(body.error.code).toBe("VALIDATION_ERROR");
      });

    // Category report: same tolerance on its yearMonth period param.
    const categoryShort = await request(app.getHttpServer())
      .get(`/api/v1/children/${childId}/reports/category?yearMonth=2026-07`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);
    const categoryLong = await request(app.getHttpServer())
      .get(`/api/v1/children/${childId}/reports/category?yearMonth=2026-07-01`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);
    expect(categoryLong.body).toEqual(categoryShort.body);
    expect(categoryShort.body.categories).toEqual([{ categoryId, amountKrw: 10000, count: 1 }]);

    await request(app.getHttpServer())
      .get(`/api/v1/children/${childId}/reports/category?yearMonth=2026-08-15`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(400)
      .expect(({ body }) => {
        expect(body.error.code).toBe("VALIDATION_ERROR");
      });

    // Expense list shares YearMonthQueryDto, so it picks up the same tolerance.
    await request(app.getHttpServer())
      .get(`/api/v1/children/${childId}/expenses?yearMonth=2026-07-01`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.totalAmountKrw).toBe(10000);
      });

    // Out-of-range months (00, 13-99) must fail validation up front with a 400
    // VALIDATION_ERROR — previously the unbounded pattern let them through to
    // getSeoulMonthRange, which threw and surfaced as a 500.
    for (const badMonth of ["2026-13", "2026-00"]) {
      await request(app.getHttpServer())
        .get(`/api/v1/children/${childId}/reports/monthly?yearMonth=${badMonth}`)
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(400)
        .expect(({ body }) => {
          expect(body.error.code).toBe("VALIDATION_ERROR");
        });

      await request(app.getHttpServer())
        .get(`/api/v1/children/${childId}/budget?yearMonth=${badMonth}`)
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(400)
        .expect(({ body }) => {
          expect(body.error.code).toBe("VALIDATION_ERROR");
        });

      await request(app.getHttpServer())
        .put(`/api/v1/children/${childId}/budget`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ yearMonth: badMonth, amountKrw: 150000 })
        .expect(400)
        .expect(({ body }) => {
          expect(body.error.code).toBe("VALIDATION_ERROR");
        });
    }
  });

  it("computes d100 and first-birthday milestone reports over the birth window (REP-103)", async () => {
    const accessToken = await login(app, `rep103-milestone-${randomUUID()}`);
    const { householdId } = await completeOnboarding(app, accessToken);
    // Deterministic mobile-category-alias seed id (prisma/seed-data.ts), same as the
    // category-report tests above. `categoryId` is the import-stub seed id.
    const otherCategoryId = "c0a7e901-0000-4c04-8c04-c47e900ec004";

    // Born child with a birth date; WOORIAI_STAGE_TODAY (2026-07-06, set in beforeEach)
    // pins "today" so the d100 window [2026-03-01, 2026-06-09) is fully elapsed while the
    // first-birthday window [2026-03-01, 2027-03-01) is still partial.
    const bornChildId = (
      await request(app.getHttpServer())
        .post("/api/v1/children")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ householdId, nickname: "백일이", stageMode: "born", birthDate: "2026-03-01" })
        .expect(200)
    ).body.id as string;

    const seedExpense = async (input: {
      categoryId: string;
      amountKrw: number;
      spentOn: string;
      itemName: string;
      expenseType?: string;
    }) =>
      (
        await request(app.getHttpServer())
          .post(`/api/v1/children/${bornChildId}/expenses`)
          .set("Authorization", `Bearer ${accessToken}`)
          .send({ ...input, paymentMethod: "card" })
          .expect(200)
      ).body as { id: string };

    // Inside the d100 window.
    await seedExpense({ categoryId, amountKrw: 30000, spentOn: "2026-03-10", itemName: "기저귀 스타터" });
    await seedExpense({ categoryId: otherCategoryId, amountKrw: 20000, spentOn: "2026-06-08", itemName: "배냇저고리" });
    // On the window's exclusive end (day 101) -- must not count toward d100, but does
    // count toward the (partial) first-birthday window.
    await seedExpense({ categoryId, amountKrw: 99000, spentOn: "2026-06-09", itemName: "101일째 지출" });
    // Before birth -- outside every milestone window.
    await seedExpense({ categoryId, amountKrw: 5000, spentOn: "2026-02-20", itemName: "출산 전 지출" });
    // Gift inside the window -- expenseType filter must exclude it.
    await seedExpense({ categoryId, amountKrw: 40000, spentOn: "2026-05-05", itemName: "선물 받은 바운서", expenseType: "gift" });
    // Soft-deleted inside the window -- must not count.
    const deleted = await seedExpense({ categoryId, amountKrw: 7000, spentOn: "2026-04-01", itemName: "삭제될 지출" });
    await request(app.getHttpServer())
      .delete(`/api/v1/expenses/${deleted.id}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);

    await request(app.getHttpServer())
      .get(`/api/v1/children/${bornChildId}/reports/milestone?type=d100`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual({
          childId: bornChildId,
          type: "d100",
          startDate: "2026-03-01",
          endDate: "2026-06-08",
          partial: false,
          daysCovered: 100,
          totalKrw: 50000,
          expenseCount: 2,
          topCategories: [
            { categoryId, code: "import_stub_default", name: "가져오기 기본", totalKrw: 30000, share: 0.6 },
            { categoryId: otherCategoryId, code: "mobile_clothes_laundry", name: "의류", totalKrw: 20000, share: 0.4 }
          ],
          avgDailyKrw: 500
        });
      });

    await request(app.getHttpServer())
      .get(`/api/v1/children/${bornChildId}/reports/milestone?type=first-birthday`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual({
          childId: bornChildId,
          type: "first-birthday",
          startDate: "2026-03-01",
          endDate: "2027-02-28",
          partial: true,
          // 2026-03-01 through 2026-07-06 inclusive, birth day counted as day 1.
          daysCovered: 128,
          totalKrw: 149000,
          expenseCount: 3,
          topCategories: [
            { categoryId, code: "import_stub_default", name: "가져오기 기본", totalKrw: 129000, share: 0.866 },
            { categoryId: otherCategoryId, code: "mobile_clothes_laundry", name: "의류", totalKrw: 20000, share: 0.134 }
          ],
          avgDailyKrw: Math.round(149000 / 128)
        });
      });
  });

  it("rejects milestone reports for children without a birth date and unknown milestone types (REP-103)", async () => {
    const accessToken = await login(app, `rep103-unavailable-${randomUUID()}`);
    // completeOnboarding creates a manual-stage child with no birthDate.
    const { childId } = await completeOnboarding(app, accessToken);

    await request(app.getHttpServer())
      .get(`/api/v1/children/${childId}/reports/milestone?type=d100`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(400)
      .expect(({ body }) => {
        expect(body.error.code).toBe("MILESTONE_UNAVAILABLE");
        expect(body.error.message).toContain("생년월일");
      });

    await request(app.getHttpServer())
      .get(`/api/v1/children/${childId}/reports/milestone?type=d200`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(400)
      .expect(({ body }) => {
        expect(body.error.code).toBe("VALIDATION_ERROR");
      });

    await request(app.getHttpServer())
      .get(`/api/v1/children/${childId}/reports/milestone`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(400)
      .expect(({ body }) => {
        expect(body.error.code).toBe("VALIDATION_ERROR");
      });
  });

  async function expectTotals(
    accessToken: string,
    childId: string,
    usedAmountKrw: number,
    remainingAmountKrw: number,
    expenseId: string
  ) {
    await request(app.getHttpServer())
      .get(`/api/v1/children/${childId}/expenses?yearMonth=2026-07`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.totalAmountKrw).toBe(usedAmountKrw);
        expect(body.expenses).toHaveLength(1);
        expect(body.expenses[0].id).toBe(expenseId);
      });

    await request(app.getHttpServer())
      .get(`/api/v1/children/${childId}/budget?yearMonth=2026-07`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          childId,
          yearMonth: "2026-07-01",
          amountKrw: 100000,
          usedAmountKrw,
          remainingAmountKrw
        });
      });

    await request(app.getHttpServer())
      .get(`/api/v1/home?childId=${childId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.totalExpenseKrw).toBe(usedAmountKrw);
        expect(body.monthly.usedAmountKrw).toBe(usedAmountKrw);
        expect(body.monthly.remainingAmountKrw).toBe(remainingAmountKrw);
        expect(body.recentExpenses[0].id).toBe(expenseId);
      });

    await request(app.getHttpServer())
      .get(`/api/v1/children/${childId}/reports/monthly?yearMonth=2026-07`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          childId,
          yearMonth: "2026-07-01",
          totalExpenseKrw: usedAmountKrw,
          budgetAmountKrw: 100000
        });
        expect(body.categoryTop[0]).toMatchObject({
          categoryId,
          amountKrw: usedAmountKrw
        });
      });
  }
});
