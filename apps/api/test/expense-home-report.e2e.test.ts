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
        expect(body.error.code).toBe("EXPENSE_DATE_TOO_FAR");
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

  it("stores tomorrow as scheduled, excludes it from realized totals, and rejects the day after tomorrow", async () => {
    const accessToken = await login(app, `batch06-scheduled-${randomUUID()}`);
    const { childId } = await completeOnboarding(app, accessToken);

    await request(app.getHttpServer())
      .post(`/api/v1/children/${childId}/expenses`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ categoryId, amountKrw: 23000, spentOn: "2026-07-07", itemName: "내일 예정 지출" })
      .expect(200);

    await request(app.getHttpServer())
      .post(`/api/v1/children/${childId}/expenses`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ categoryId, amountKrw: 24000, spentOn: "2026-07-08", itemName: "모레 지출" })
      .expect(400)
      .expect(({ body }) => expect(body.error.code).toBe("EXPENSE_DATE_TOO_FAR"));

    await request(app.getHttpServer())
      .get(`/api/v1/children/${childId}/expenses?yearMonth=2026-07`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.expenses).toEqual([expect.objectContaining({ itemName: "내일 예정 지출", spentOn: "2026-07-07" })]);
        expect(body.totalAmountKrw).toBe(0);
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
