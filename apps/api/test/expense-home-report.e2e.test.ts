import type { INestApplication } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import { randomUUID } from "node:crypto";
import request from "supertest";
import {
  budgetSchema,
  errorResponseSchema,
  expenseSchema,
  homeSummarySchema,
  reportCategorySchema,
  reportMonthlySchema,
  reportYearlySchema
} from "@wooriai/contracts";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AppModule } from "../src/app.module";
import { configureApiApp } from "../src/bootstrap";
import { TokenService } from "../src/auth/token.service";
import { AuditLoggerService } from "../src/common/audit/audit-logger.service";
import { ExpensesStoreService } from "../src/onboarding/expenses-store.service";
import { PrismaService } from "../src/prisma/prisma.service";

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
        // CON-121: 홈 응답 전체가 공유 계약(homeSummarySchema)에 맞아야 한다 —
        // child/monthly/recommendedItems/recentExpenses까지 한 번에 고정된다.
        homeSummarySchema.parse(body);
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
          // CON-115: 지출 생성 응답 전체가 공유 계약(expenseSchema)에 맞아야 한다
          // (required categoryId·version 포함) — 계약을 살아있는 검증으로 유지.
          expenseSchema.parse(body);
          expect(body).toMatchObject({
            id: expect.any(String),
            childId,
            categoryId,
            amountKrw: 49800,
            spentOn: "2026-07-06",
            itemName: "기저귀",
            merchant: "맘마마트",
            // 라운드 48 T3(C1): 결제 수단은 저장만 되고 어떤 응답에도 실리지 않던
            // 쓰기 전용 필드였다 — 이제 생성 응답부터 그대로 돌아온다.
            paymentMethod: "card",
            memo: "첫 기록",
            // 연결이 없는 지출은 null이다(필드 자체가 빠지지 않는다).
            linkedItemTemplateId: null,
            expenseType: "expense",
            source: "manual",
            createdByUserId: userId,
            version: 1
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
        // CON-115: 지출 수정 응답도 동일한 공유 계약을 만족해야 한다.
        expenseSchema.parse(body);
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
        homeSummarySchema.parse(body);
        expect(body.totalExpenseKrw).toBe(0);
        expect(body.monthly.usedAmountKrw).toBe(0);
        expect(body.recentExpenses).toEqual([]);
      });

    await request(app.getHttpServer())
      .get(`/api/v1/children/${childId}/reports/monthly?yearMonth=2026-07`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200)
      .expect(({ body }) => {
        reportMonthlySchema.parse(body);
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

    // CS-101(라운드 56 트랙 C): 수정도 삭제와 같은 형식으로 남는다. before/after가
    // 없으면 "금액이 혼자 바뀌었어요" 문의에 어드민이 답할 근거가 없다 —
    // 바뀐 값(49,800 → 59,800)이 스냅샷 양쪽에 실제로 담겨야 한다.
    const updateEntry = auditLogger.entries.find(
      (entry) => entry.action === "expense.update" && entry.targetId === created.id
    );
    expect(updateEntry).toBeDefined();
    expect(updateEntry).toMatchObject({
      actorUserId: userId,
      householdId,
      targetType: "expense",
      before: expect.objectContaining({ id: created.id, amountKrw: 49800, memo: "첫 기록", version: 1 }),
      after: expect.objectContaining({ id: created.id, amountKrw: 59800, memo: "수정된 기록", version: 2 })
    });
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
        // CON-121: recentExpenses가 실제로 채워진 홈 응답 — 각 항목이 expenseSchema
        // (required categoryId·version 포함)를 만족하는지까지 여기서 고정된다.
        homeSummarySchema.parse(body);
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
        // CON-121: 400 대표 케이스 — 에러 봉투 전체가 errorResponseSchema다
        // (DTO 검증 실패라 details.fields까지 실린 형태).
        errorResponseSchema.parse(body);
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
        // CON-121: 서비스가 던진 도메인 400 — details 없이 code/message/requestId만
        // 실리는 형태도 같은 봉투 계약을 만족해야 한다(details는 optional).
        errorResponseSchema.parse(body);
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
    const store = moduleRef.get(ExpensesStoreService) as ExpensesStoreService & {
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

  /**
   * 라운드 36 F-7: DNC-013 "미래 지출 금지"의 **서버 방어선**을 경계에서 고정한다.
   *
   * 기존 케이스는 2999-01-01처럼 아주 먼 미래만 봤다 -- 그건 어떤 구현이든 걸리므로 "오늘까지는
   * 되고 내일부터는 안 된다"는 경계 자체를 지켜 주지 못한다(예: UTC 기준으로 판정하면 한국
   * 저녁에 오늘 날짜가 미래로 걸린다). 이 스위트의 오늘은 WOORIAI_STAGE_TODAY=2026-07-06라
   * 서울 기준 오늘/내일이 결정적이다.
   *
   * 규칙은 DTO가 아니라 서비스 계층에 있으므로(store-shared.assertExpenseDateWithinRange) 에러 코드는
   * VALIDATION_ERROR가 아니라 EXPENSE_FUTURE_DATE이고, **생성·수정 두 경로가 같은 코드를 쓴다**
   * (모바일 3경로의 isFutureSeoulDate를 우회해 API를 직접 호출해도 막힌다).
   */
  it("F-7: rejects tomorrow but accepts today on both create and update (DNC-013, Seoul-based)", async () => {
    const accessToken = await login(app, `r36-future-date-${randomUUID()}`);
    const { childId } = await completeOnboarding(app, accessToken);
    const seoulToday = "2026-07-06";
    const seoulTomorrow = "2026-07-07";

    // 오늘은 정상 경로다 -- 경계를 하루 당겨 오늘 지출을 막아 버리면 그게 더 큰 사고다.
    const created = (
      await request(app.getHttpServer())
        .post(`/api/v1/children/${childId}/expenses`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ categoryId, amountKrw: 12000, spentOn: seoulToday, itemName: "오늘 기저귀" })
        .expect(200)
        .expect(({ body }) => {
          expenseSchema.parse(body);
          expect(body.spentOn).toBe(seoulToday);
        })
    ).body as { id: string; version: number };

    // 내일은 하루만 넘어도 막힌다(생성 경로).
    await request(app.getHttpServer())
      .post(`/api/v1/children/${childId}/expenses`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ categoryId, amountKrw: 12000, spentOn: seoulTomorrow, itemName: "내일 기저귀" })
      .expect(400)
      .expect(({ body }) => {
        errorResponseSchema.parse(body);
        expect(body.error.code).toBe("EXPENSE_FUTURE_DATE");
      });

    // 수정 경로도 같은 방어선을 지난다 -- 오늘로 만든 지출을 나중에 내일로 밀 수 없다.
    await request(app.getHttpServer())
      .patch(`/api/v1/expenses/${created.id}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ spentOn: seoulTomorrow })
      .expect(400)
      .expect(({ body }) => {
        errorResponseSchema.parse(body);
        expect(body.error.code).toBe("EXPENSE_FUTURE_DATE");
      });

    // 거절된 수정이 행을 건드리지 않았는지까지 확인한다(부분 적용 금지).
    await request(app.getHttpServer())
      .patch(`/api/v1/expenses/${created.id}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ spentOn: seoulToday, itemName: "오늘 기저귀(수정)" })
      .expect(200)
      .expect(({ body }) => {
        expect(body.spentOn).toBe(seoulToday);
        expect(body.itemName).toBe("오늘 기저귀(수정)");
      });
  });

  /**
   * 라운드 68 A: 같은 값의 **아래쪽 경계**(20년). F-7이 위쪽만 막았고 아래쪽에는 아무것도 없어서,
   * `2026-08-14`를 `2016-08-14`로 한 자리 잘못 친 지출이 형식·실존·미래 셋을 전부 지나 저장됐다.
   * 그 지출은 **누적 총액에는 들어가는데**(전 기간 서버 집계) 앱의 읽는 쪽 넷이 전부 20년에서
   * 잠겨 있어 어느 화면에서도 그 달을 열 수 없다 — 총액은 늘었는데 그 금액을 찾아가 지울
   * 자리가 없다. 모바일 폼도 같은 규칙을 갖되(entry-form-guards.ts의 validateExpenseDateInput),
   * 그 가드를 우회한 호출을 막는 것이 서버의 몫이다.
   *
   * 이 스위트의 오늘은 WOORIAI_STAGE_TODAY = 2026-07-06이라 하한은 240개월 전 **달의 1일** =
   * 2006-07-01이다(달력 픽커의 과거 바닥이 달 단위라 하한도 그 달의 1일이다).
   * 코드는 미래 갈래와 **다르다**: 두 경계를 한 이름으로 부르지 않는다.
   */
  it("라운드 68 A: rejects a spentOn older than 20 years on both create and update (경계 세 값)", async () => {
    const accessToken = await login(app, `r68-date-floor-${randomUUID()}`);
    const { childId } = await completeOnboarding(app, accessToken);
    const floorDay = "2006-07-01";
    const oneDayTooOld = "2006-06-30";

    const expectTooOldError = ({ body }: { body: { error: { code: string; message: string } } }) => {
      errorResponseSchema.parse(body);
      expect(body.error.code).toBe("EXPENSE_DATE_TOO_OLD");
      // 앱 폼이 내는 문장과 **글자까지 같다**(entry-form-guards.ts의 EXPENSE_DATE_TOO_OLD_ERROR,
      // child-form.ts의 CHILD_BIRTH_DATE_TOO_OLD_ERROR와도 같은 한 문장이다).
      expect(body.error.message).toBe("20년보다 오래된 날은 고를 수 없어요.");
    };

    // 하한 당일은 정상 경로다 — 달력 픽커가 열어 주는 날을 서버가 거절하면 안 된다.
    const created = (
      await request(app.getHttpServer())
        .post(`/api/v1/children/${childId}/expenses`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ categoryId, amountKrw: 12000, spentOn: floorDay, itemName: "하한 당일" })
        .expect(200)
        .expect(({ body }) => {
          expenseSchema.parse(body);
          expect(body.spentOn).toBe(floorDay);
        })
    ).body as { id: string; version: number };

    // 하루만 넘어도 막힌다(생성 경로).
    await request(app.getHttpServer())
      .post(`/api/v1/children/${childId}/expenses`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ categoryId, amountKrw: 12000, spentOn: oneDayTooOld, itemName: "하루 초과" })
      .expect(400)
      .expect(expectTooOldError);

    // 실패 시나리오의 오타 그대로.
    await request(app.getHttpServer())
      .post(`/api/v1/children/${childId}/expenses`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ categoryId, amountKrw: 30000, spentOn: "1926-08-14", itemName: "오타 기저귀" })
      .expect(400)
      .expect(expectTooOldError);

    // 수정 경로도 같은 방어선을 지난다 — 저장된 지출을 나중에 도달 불가능한 달로 밀 수 없다.
    await request(app.getHttpServer())
      .patch(`/api/v1/expenses/${created.id}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ spentOn: oneDayTooOld })
      .expect(400)
      .expect(expectTooOldError);

    // 거절된 수정이 행을 건드리지 않았고, 정상 과거 날짜는 종전 그대로 통과한다.
    await request(app.getHttpServer())
      .patch(`/api/v1/expenses/${created.id}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ spentOn: "2016-08-14", itemName: "10년 전 기록" })
      .expect(200)
      .expect(({ body }) => {
        expect(body.spentOn).toBe("2016-08-14");
        expect(body.itemName).toBe("10년 전 기록");
      });
  });

  /**
   * 라운드 69 B: **바구니에서 갈라 나온 코드**.
   *
   * 존재하지 않는 카테고리로 저장하려는 요청에 서버는 오래전부터 완성된 해요체 문장을 답했는데,
   * 그 문장이 `VALIDATION_ERROR`라는 바구니 코드로 나갔다. 앱의 화이트리스트는 코드 단위라
   * (apps/mobile/src/api/api-error.ts) 바구니 코드로 나가는 문장은 구조적으로 꺼낼 수 없다 —
   * 그 코드를 표에 넣으면 DTO 검증 실패 **전량**이 카테고리 문구를 뒤집어쓴다.
   *
   * 그래서 이 갈래만 자기 코드를 받았다. **문장·status는 한 글자도 바뀌지 않았고**, 생성·수정
   * 두 경로가 같은 코드를 쓴다(`requireExistingCategory` 한 자리를 둘이 함께 지난다).
   * 오프라인에서 적은 지출이 flush 400을 받으면 그 행은 실패 행으로 파킹되고 재시도 버튼이
   * 사라지므로, 고칠 곳이 카테고리라는 사실이 화면까지 오는지가 이 코드의 존재 이유다.
   */
  it("라운드 69 B: 없는 카테고리는 400 EXPENSE_CATEGORY_INVALID (생성·수정 두 경로, 문장 무변경)", async () => {
    const accessToken = await login(app, `r69-category-code-${randomUUID()}`);
    const { childId } = await completeOnboarding(app, accessToken);
    const missingCategoryId = randomUUID();

    const expectCategoryError = ({ body }: { body: { error: { code: string; message: string } } }) => {
      errorResponseSchema.parse(body);
      expect(body.error.code).toBe("EXPENSE_CATEGORY_INVALID");
      // 앱의 표가 그대로 쓰는 문장이다(api-error.ts의 EXPENSE_CATEGORY_INVALID).
      expect(body.error.message).toBe("존재하지 않는 카테고리예요. 카테고리를 다시 선택해 주세요.");
      // 바구니 코드로는 더 이상 나가지 않는다.
      expect(body.error.code).not.toBe("VALIDATION_ERROR");
    };

    await request(app.getHttpServer())
      .post(`/api/v1/children/${childId}/expenses`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ categoryId: missingCategoryId, amountKrw: 12000, spentOn: "2026-07-06", itemName: "없는 분류" })
      .expect(400)
      .expect(expectCategoryError);

    const created = (
      await request(app.getHttpServer())
        .post(`/api/v1/children/${childId}/expenses`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ categoryId, amountKrw: 12000, spentOn: "2026-07-06", itemName: "정상 분류" })
        .expect(200)
    ).body as { id: string };

    await request(app.getHttpServer())
      .patch(`/api/v1/expenses/${created.id}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ categoryId: missingCategoryId })
      .expect(400)
      .expect(expectCategoryError);

    // DTO 검증 실패는 **종전 그대로** VALIDATION_ERROR다 — 갈라낸 것은 이 한 갈래뿐이다.
    await request(app.getHttpServer())
      .post(`/api/v1/children/${childId}/expenses`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ categoryId: "not-a-uuid", amountKrw: 12000, spentOn: "2026-07-06", itemName: "형식 위반" })
      .expect(400)
      .expect(({ body }) => {
        errorResponseSchema.parse(body);
        expect(body.error.code).toBe("VALIDATION_ERROR");
      });

    // 거절된 수정이 행을 건드리지 않았다(부분 적용 금지).
    await request(app.getHttpServer())
      .get(`/api/v1/expenses/${created.id}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.categoryId).toBe(categoryId);
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
        // CON-121: 선물 지출이 recentExpenses에 실린 홈 응답 — expenseType "gift"도
        // 같은 expenseSchema를 통과해야 한다(합계에서 빠지는 것과는 별개).
        homeSummarySchema.parse(body);
        expect(body.totalExpenseKrw).toBe(0);
        expect(body.monthly.usedAmountKrw).toBe(0);
      });

    await request(app.getHttpServer())
      .get(`/api/v1/children/${childId}/reports/monthly?yearMonth=2026-07`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200)
      .expect(({ body }) => {
        reportMonthlySchema.parse(body);
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
    const store = moduleRef.get(ExpensesStoreService) as ExpensesStoreService & {
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
        // CON-121: 연간 리포트 응답 계약 — 12개월 전부 채워진 형태까지 스키마가 고정한다.
        reportYearlySchema.parse(body);
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
        reportYearlySchema.parse(body);
        expect(body.year).toBe("2026");
        expect(body.totalExpenseKrw).toBe(50000);
      });

    expect(januaryExpense.id).toEqual(expect.any(String));
  });

  /**
   * PERF-127: getYearlyReport가 "행 전량 findMany + JS 접기"에서 spentOn 기준 groupBy로
   * 바뀌었다. 기존 연간 e2e는 월마다 지출이 한 건뿐이고 연 경계에 걸친 행이 없어, DB가 접는
   * 경로에서만 드러나는 두 가지를 증명하지 못한다 — (1) **같은 날짜 여러 건**이 한 그룹으로
   * 접힌 뒤에도 합계가 보존되는지, (2) 연 경계(12/31 포함 · 다음 해 1/1 제외 · 전 해 12/31
   * 제외)가 그대로인지. 두 축을 한 아이로 함께 검증한다.
   */
  it("folds same-day rows and honors the year boundary in the yearly report (PERF-127)", async () => {
    const accessToken = await login(app, `batch-yearly-groupby-${randomUUID()}`);
    const { childId } = await completeOnboarding(app, accessToken);

    const record = async (amountKrw: number, spentOn: string, itemName: string) => {
      await request(app.getHttpServer())
        .post(`/api/v1/children/${childId}/expenses`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ categoryId, amountKrw, spentOn, itemName, paymentMethod: "card" })
        .expect(200);
    };

    // 같은 날짜 3건 (groupBy가 한 행으로 접는다) + 같은 달 다른 날 1건.
    await record(11000, "2026-05-04", "5월 4일 A");
    await record(12000, "2026-05-04", "5월 4일 B");
    await record(13000, "2026-05-04", "5월 4일 C");
    await record(1000, "2026-05-31", "5월 말일");
    // 연 경계 양쪽. (미래 날짜는 EXPENSE_FUTURE_DATE로 막히므로 -- 이 스위트의 오늘은
    // WOORIAI_STAGE_TODAY=2026-07-06 -- 2025/2026 경계로 검증한다.)
    await record(7000, "2026-01-01", "새해 첫날");
    await record(400000, "2025-12-31", "전 해 마지막날");

    await request(app.getHttpServer())
      .get(`/api/v1/children/${childId}/reports/yearly?year=2026`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200)
      .expect(({ body }) => {
        reportYearlySchema.parse(body);
        expect(body.monthlyTotals).toHaveLength(12);
        // 5월: 11000+12000+13000(같은 날) + 1000 = 37000 -- 같은 날 3건이 접혀도 합이 보존된다.
        expect(body.monthlyTotals[4]).toEqual({ yearMonth: "2026-05", totalExpenseKrw: 37000 });
        // 하한(gte 2026-01-01) 포함, 전 해 마지막날은 제외.
        expect(body.monthlyTotals[0]).toEqual({ yearMonth: "2026-01", totalExpenseKrw: 7000 });
        expect(body.totalExpenseKrw).toBe(44000);
      });

    // 상한(lt 2026-01-01): 전 해 리포트에는 2025-12-31만 잡히고 2026-01-01은 새지 않는다.
    await request(app.getHttpServer())
      .get(`/api/v1/children/${childId}/reports/yearly?year=2025`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200)
      .expect(({ body }) => {
        reportYearlySchema.parse(body);
        expect(body.monthlyTotals[11]).toEqual({ yearMonth: "2025-12", totalExpenseKrw: 400000 });
        expect(body.totalExpenseKrw).toBe(400000);
      });
  });

  it("scopes the category report to a given month when yearMonth is provided, and to all time otherwise", async () => {
    const accessToken = await login(app, `batch-category-report-${randomUUID()}`);
    const { childId } = await completeOnboarding(app, accessToken);
    // Round 4 validates that categoryId references an existing categories row (see
    // requireExistingCategory in onboarding/expenses-store.service.ts), so this needs a real
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
        // CON-121: 카테고리 리포트는 월간 리포트의 categoryTop과 같은 집계를 쓰므로
        // 같은 항목 계약(categoryBreakdownEntrySchema)을 공유한다.
        reportCategorySchema.parse(body);
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
        reportCategorySchema.parse(body);
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
        errorResponseSchema.parse(body);
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
        // CON-121: 예산 upsert 응답도 조회와 같은 budgetSchema를 만족한다.
        budgetSchema.parse(body);
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
    reportMonthlySchema.parse(monthlyShort.body);
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
    reportCategorySchema.parse(categoryShort.body);
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

  /**
   * 라운드 48 T3: 쓰기 전용이던 두 필드(`paymentMethod` · `linkedItemTemplateId`)가
   * **모든 지출 응답 경로**에서 돌아오는지 고정한다 — 생성 · 단건 조회 · 목록 ·
   * 홈(recentExpenses). 한 곳(store-shared.ts `toExpenseDto`)이 넷을 함께 먹이므로
   * 여기서 갈릴 일은 없지만, 이 필드들이 다시 조용히 빠지면 사용자는 자기가 고른 값을
   * 또 볼 수 없게 된다(그게 정확히 이번 라운드 이전의 상태였다).
   *
   * 라운드 49 C-06: `linkedProductLinkId`는 더 이상 다크 필드가 아니다 — 구매 확인 카드의
   * "샀어요"에서 이어진 생성 경로가 그 값을 실어 보내고 서버가 저장한다. 여기서는 **보내지
   * 않은 기록에서 null로 내려오는지**를 고정하고(필드가 통째로 빠져 "구 서버"와 구분되지
   * 않는 상태를 만들지 않는다), 실제 저장·노출은 아래 라운드 49 C-06 테스트가 맡는다.
   */
  it("라운드 48 T3: paymentMethod·linkedItemTemplateId가 생성·조회·목록·홈 응답에 모두 실린다", async () => {
    const accessToken = await login(app, `r48t3-expense-writeonly-${randomUUID()}`);
    const { childId } = await completeOnboarding(app, accessToken);

    // ⚠️ 라운드 91 C — 이 자리가 필요로 하는 재료는 **연결할 준비템 id 하나**뿐인데, 종전에는
    // `GET items?tab=now` **전량 카탈로그**를 받아 `items[0].id`만 꺼냈다. 이 스위트가 쓰는
    // 테스트 DB는 라운드마다 **누적**되고 지우는 걸음이 없어서(test/global-setup.ts —
    // harness-catalog-cost.test.ts가 그 사실을 부정 단언으로 못 박는다), 실측으로 그 응답은
    // 이미 **2,818건 · 579,990바이트 · ~229ms**였다(라운드 82 주석이 적어 둔 2,651건에서 또 자랐고
    // 앞으로도 자란다). 시험 대상은 **목록이 아니라 지출 응답에 실리는 필드들**이므로,
    // 재료만 SQL 한 문장으로 얻는다 — 조건은 `tab=now`가 담는 것과 같다(활성 준비템 ∧
    // 아이의 현재 단계). 아래 판정(expectExposed)과 기대값은 **바이트 그대로**다.
    const [linkedTemplate] = await moduleRef.get(PrismaService).$queryRaw<Array<{ id: string }>>`
      SELECT t.id
      FROM item_templates t
      JOIN item_template_stages s ON s.item_template_id = t.id
      WHERE t.active AND s.stage_code::text = 'infant_4_6'
      ORDER BY t.display_order, t.id
      LIMIT 1
    `;
    // 종전 `expect(items.length).toBeGreaterThan(0)`이 지키던 성질 그대로 — 재료가 비면 여기서
    // 멈춘다(단계 값 'infant_4_6'은 이 파일의 completeOnboarding이 만드는 아이의 manualStage다).
    expect(linkedTemplate, "infant_4_6 아이의 tab=now에 담길 활성 준비템이 하나는 있어야 한다").toBeDefined();
    const linkedItemTemplateId = linkedTemplate.id;

    const expectExposed = (body: Record<string, unknown>) => {
      expenseSchema.parse(body);
      expect(body).toMatchObject({
        paymentMethod: "transfer",
        merchant: "맘마마트",
        linkedItemTemplateId
      });
      // 라운드 49 C-06: 보내지 않았으므로 값은 null이다 — 키 자체가 빠지지는 않는다.
      expect(body.linkedProductLinkId).toBeNull();
    };

    const created = (
      await request(app.getHttpServer())
        .post(`/api/v1/children/${childId}/expenses`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({
          categoryId,
          amountKrw: 42000,
          spentOn: "2026-07-06",
          itemName: "젖병 소독기",
          merchant: "맘마마트",
          paymentMethod: "transfer",
          linkedItemTemplateId
        })
        .expect(200)
        .expect(({ body }) => expectExposed(body))
    ).body as { id: string };

    await request(app.getHttpServer())
      .get(`/api/v1/expenses/${created.id}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200)
      .expect(({ body }) => expectExposed(body));

    await request(app.getHttpServer())
      .get(`/api/v1/children/${childId}/expenses?yearMonth=2026-07`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200)
      .expect(({ body }) => {
        const row = (body.expenses as Array<Record<string, unknown>>).find((expense) => expense.id === created.id);
        expect(row).toBeDefined();
        expectExposed(row!);
      });

    await request(app.getHttpServer())
      .get(`/api/v1/home?childId=${childId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200)
      .expect(({ body }) => {
        homeSummarySchema.parse(body);
        const row = (body.recentExpenses as Array<Record<string, unknown>>).find(
          (expense) => expense.id === created.id
        );
        expect(row).toBeDefined();
        expectExposed(row!);
      });

    // 연결이 없는 지출은 null로 내려온다 — 필드가 통째로 빠져 클라이언트가 "구 서버"와
    // 구분하지 못하는 상태를 만들지 않는다. 결제 수단을 고르지 않으면 서버 기본값 "unknown".
    await request(app.getHttpServer())
      .post(`/api/v1/children/${childId}/expenses`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ categoryId, amountKrw: 3000, spentOn: "2026-07-06", itemName: "연결 없는 지출" })
      .expect(200)
      .expect(({ body }) => {
        expenseSchema.parse(body);
        expect(body.linkedItemTemplateId).toBeNull();
        expect(body.linkedProductLinkId).toBeNull();
        expect(body.paymentMethod).toBe("unknown");
      });
  });

  /**
   * 라운드 49 C-06 — 링크 클릭에서 지출 기록까지의 사슬을 서버가 실제로 잇는다.
   *
   * 이 컬럼(`expenses.linked_product_link_id`)과 FK는 처음부터 있었는데 **어떤 쓰기 경로도
   * 채우지 않아** 언제나 null이었다: 구매 확인 카드는 어느 링크를 눌렀는지 알고 있었지만
   * 그 사실을 서버에 넘길 자리가 없었고(전역 ValidationPipe가 forbidNonWhitelisted라 DTO에
   * 없는 키는 400), 저장된 적이 없으니 응답에도 실을 이유가 없었다. 이제 셋이 함께 열린다.
   *
   * ⚠️ DNC-009: 이 값은 기록·정산용이다. 추천 점수·정렬에 유입되면 안 되고, 이 테스트가
   * 확인하는 것도 "저장되고 되읽힌다"까지다.
   */
  it("라운드 49 C-06: linkedProductLinkId가 생성 시 저장되고 모든 응답 경로에 실린다", async () => {
    const accessToken = await login(app, `r49c06-linked-product-${randomUUID()}`);
    const { childId } = await completeOnboarding(app, accessToken);

    // 이 아이의 준비템에 실제로 달려 있는 링크 하나를 그대로 쓴다(FK가 요구하는 것은
    // product_links에 존재하는 id다). 어느 항목에 링크가 달려 있는지는 카탈로그 사정이라 첫
    // 항목으로 단정하지 않고, **링크를 가진 항목** 중 목록에 담기는 하나를 고른다.
    //
    // ⚠️ 라운드 82 리뷰 추가-15 — 종전에는 "링크가 나올 때까지 항목 상세를 하나씩 열어 보는"
    // 루프였다. 이 스위트가 쓰는 테스트 DB는 라운드마다 **누적**되고(어드민 카탈로그 스위트가
    // 만든 품목이 지워지지 않는다) 그 품목들에는 링크가 없다 — 실측으로 `tab=now` 목록이
    // **2,651건**이었고 상세 한 건이 ~40ms라, 링크 없는 항목이 코드 순서 앞쪽에 몰리면 루프
    // 하나가 20초를 넘겼다(단독 실행 23.0s / 병렬 실행에서는 30초 문턱을 넘겨 빨개졌다).
    // 즉 **테스트가 느린 원인이 시드가 아니라 왕복 수**였고, 그 수는 앞으로도 계속 자란다.
    //
    // ⚠️ 라운드 91 C — 그 뒤로도 남아 있던 왕복 하나를 마저 없앤다. 라운드 82가 루프를 없애고도
    // 목록 **전량**은 계속 받았는데(그 사이 2,651 → **2,818건 · 579,990바이트 · ~217ms**로 또
    // 자랐다), 이 자리가 그 응답에서 쓰는 것은 **id 하나**다. 목록 요청과 링크 조회 둘을 SQL
    // 한 문장으로 합친다 — 조건은 `tab=now`가 담는 것(활성 준비템 ∧ 아이의 현재 단계)에
    // "활성 링크를 가진다"를 더한 것이고, 아래 판정·기대값은 **바이트 그대로**다.
    // 이제 이 테스트의 목록 왕복은 **0번**, 상세 왕복은 **한 번**이다.
    const [linkedItem] = await moduleRef.get(PrismaService).$queryRaw<Array<{ id: string }>>`
      SELECT t.id
      FROM item_templates t
      JOIN item_template_stages s ON s.item_template_id = t.id
      JOIN product_links l ON l.item_template_id = t.id AND l.active
      WHERE t.active AND s.stage_code::text = 'infant_4_6'
      ORDER BY t.display_order, t.id
      LIMIT 1
    `;
    expect(linkedItem, "시드 준비템 중 최소 하나에는 구매 링크가 있어야 한다").toBeDefined();

    const linkedItemTemplateId = linkedItem!.id;
    const detail = (
      await request(app.getHttpServer())
        .get(`/api/v1/children/${childId}/items/${linkedItemTemplateId}`)
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(200)
    ).body as { productLinks?: Array<{ id: string }> };
    // 응답이 실제로 그 링크를 싣는지도 함께 본다(종전 루프가 지키던 성질 그대로).
    expect(detail.productLinks?.length, "링크를 가진 항목의 상세가 판매처를 싣지 않았다").toBeGreaterThan(0);
    const linkedProductLinkId = detail.productLinks![0].id;

    const created = (
      await request(app.getHttpServer())
        .post(`/api/v1/children/${childId}/expenses`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({
          categoryId,
          amountKrw: 21000,
          spentOn: "2026-07-06",
          itemName: "젖병",
          merchant: "쿠팡",
          linkedItemTemplateId,
          linkedProductLinkId
        })
        .expect(200)
        .expect(({ body }) => {
          expenseSchema.parse(body);
          expect(body.linkedProductLinkId).toBe(linkedProductLinkId);
          // C-03: 같은 요청의 판매처도 그대로 왕복한다.
          expect(body.merchant).toBe("쿠팡");
        })
    ).body as { id: string };

    // 단건 조회·목록도 같은 값을 준다(toExpenseDto 하나가 넷을 함께 먹인다).
    await request(app.getHttpServer())
      .get(`/api/v1/expenses/${created.id}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200)
      .expect(({ body }) => {
        expenseSchema.parse(body);
        expect(body.linkedProductLinkId).toBe(linkedProductLinkId);
      });

    await request(app.getHttpServer())
      .get(`/api/v1/children/${childId}/expenses?yearMonth=2026-07`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200)
      .expect(({ body }) => {
        const row = (body.expenses as Array<Record<string, unknown>>).find((expense) => expense.id === created.id);
        expect(row?.linkedProductLinkId).toBe(linkedProductLinkId);
      });
  });

  /**
   * 라운드 49 C-06 — 유효하지 않은 링크 id의 처리. 형식이 UUID가 아니면 DTO가 400
   * VALIDATION_ERROR로 잡고, 존재하지 않는 id는 저장 경로에서 400으로 거절한다.
   * DB의 FK도 유지한다. 잘못된 링크 때문에 지출 행이 생기거나 5xx 재시도가 이어지지 않아야 한다.
   */
  it("라운드 49 C-06: 형식이 틀린 linkedProductLinkId는 400, 존재하지 않는 id는 저장되지 않는다", async () => {
    const accessToken = await login(app, `r49c06-linked-product-invalid-${randomUUID()}`);
    const { childId } = await completeOnboarding(app, accessToken);
    const body = { categoryId, amountKrw: 1000, spentOn: "2026-07-06", itemName: "형식 오류" };

    await request(app.getHttpServer())
      .post(`/api/v1/children/${childId}/expenses`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ ...body, linkedProductLinkId: "not-a-uuid" })
      .expect(400)
      .expect(({ body: error }) => {
        expect(error.error.code).toBe("VALIDATION_ERROR");
      });

    const before = (
      await request(app.getHttpServer())
        .get(`/api/v1/children/${childId}/expenses?yearMonth=2026-07`)
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(200)
    ).body.expenses.length as number;

    // 형식은 맞지만 존재하지 않는 링크: FK가 거절하므로 지출 행 자체가 생기지 않는다.
    //
    // 라운드 49 QA(P2-4): 상태코드를 400으로 **고정**한다. 예전 단언(>= 400)은 500도 통과시켰고
    // 실제로 500이었다 — 모바일 아웃박스는 5xx를 일시적 실패로 보고 무한 재시도하므로, 절대
    // 성공할 수 없는 이 요청이 큐 맨 앞에서 뒤의 멀쩡한 지출까지 막는 poison pill이 됐다.
    const missing = await request(app.getHttpServer())
      .post(`/api/v1/children/${childId}/expenses`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ ...body, itemName: "없는 링크", linkedProductLinkId: randomUUID() });
    expect(missing.status).toBe(400);
    expect(missing.body.error.code).toBe("LINKED_PRODUCT_LINK_NOT_FOUND");

    await request(app.getHttpServer())
      .get(`/api/v1/children/${childId}/expenses?yearMonth=2026-07`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200)
      .expect(({ body: list }) => {
        expect(list.expenses).toHaveLength(before);
      });
  });

  /**
   * 라운드 49 C-03 — 판매처가 PATCH로 고쳐진다.
   *
   * 없어서 무슨 일이 있었나: 판매처는 저장·표시·CSV·목록이 전부 왕복시키는 값인데 **수정
   * 계약에만 자리가 없었다.** 오프라인 충돌 해소의 "두 값 나란히 보기"는 판매처를 비교
   * 항목으로 내놓으므로(모바일 `diffExpenseFields`) 사용자가 거기서 값을 골랐는데도 그
   * 선택이 서버에 닿지 못했고(DTO에 없는 키는 400이라 아예 실을 수 없다), 같은 라운드에 생긴
   * 지출 상세의 판매처 편집도 같은 벽에 막혔을 것이다.
   */
  it("라운드 49 C-03: PATCH가 판매처를 고치고, 빈 문자열은 null로 정리한다", async () => {
    const accessToken = await login(app, `r49c03-merchant-patch-${randomUUID()}`);
    const { childId } = await completeOnboarding(app, accessToken);

    const created = (
      await request(app.getHttpServer())
        .post(`/api/v1/children/${childId}/expenses`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ categoryId, amountKrw: 12000, spentOn: "2026-07-06", itemName: "물티슈", merchant: "맘마마트" })
        .expect(200)
    ).body as { id: string };

    await request(app.getHttpServer())
      .patch(`/api/v1/expenses/${created.id}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ merchant: "이마트" })
      .expect(200)
      .expect(({ body }) => {
        expenseSchema.parse(body);
        expect(body.merchant).toBe("이마트");
      });

    // 보내지 않은 요청은 판매처를 손대지 않는다(additive optional의 핵심).
    await request(app.getHttpServer())
      .patch(`/api/v1/expenses/${created.id}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ itemName: "물티슈 대용량" })
      .expect(200)
      .expect(({ body }) => {
        expect(body.merchant).toBe("이마트");
      });

    // 빈 문자열은 "지웠다" — memo와 같은 cleanOptionalText 취급이라 null이 된다.
    await request(app.getHttpServer())
      .patch(`/api/v1/expenses/${created.id}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ merchant: "   " })
      .expect(200)
      .expect(({ body }) => {
        expenseSchema.parse(body);
        expect(body.merchant).toBeNull();
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
        // CON-115/CON-121: 목록 항목도 생성·수정 응답과 같은 expenseSchema다
        // (ExpensesVersionService.hydrateMany가 version을 채운다).
        for (const expense of body.expenses) {
          expenseSchema.parse(expense);
        }
        expect(body.totalAmountKrw).toBe(usedAmountKrw);
        expect(body.expenses).toHaveLength(1);
        expect(body.expenses[0].id).toBe(expenseId);
      });

    await request(app.getHttpServer())
      .get(`/api/v1/children/${childId}/budget?yearMonth=2026-07`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200)
      .expect(({ body }) => {
        // CON-121: 예산 조회 응답 계약(budgetSchema) — 홈의 monthly와 달리
        // amountKrw는 moneyKrwSchema(1원 이상)다. 예산이 없으면 404라 0은 나오지 않는다.
        budgetSchema.parse(body);
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
        homeSummarySchema.parse(body);
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
        // CON-121: categoryTop이 z.record(z.unknown())에서 실형태로 조여졌으므로
        // 이 parse가 {categoryId, amountKrw, count}까지 함께 고정한다.
        reportMonthlySchema.parse(body);
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
