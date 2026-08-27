import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { randomUUID } from "node:crypto";
import request from "supertest";
import { reportTrendSchema } from "@wooriai/contracts";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AppModule } from "../src/app.module";
import { configureApiApp } from "../src/bootstrap";

const categoryId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

/**
 * REP-128: GET /children/:childId/reports/trend — 모바일 리포트 월간 탭의 6개월 추이 차트가
 * `GET /reports/monthly`를 막대 하나당 한 번씩 6번 부르던 워터폴을 대체하는 단일 엔드포인트.
 *
 * 이 파일이 잡으려는 회귀는 "요청 수를 줄이는 대신 값이 달라지는 것"이다. 그래서 기대값을
 * 손으로 적는 대신, **같은 달에 대한 기존 월간 리포트 응답**을 참조 구현으로 삼아 동치를
 * 고정한다(아래 첫 테스트) — 술어(선물 제외 DNC-015, soft delete 제외 DNC-014), 월 경계,
 * 빈 달 0 채움 중 어느 하나만 어긋나도 즉시 불일치가 난다.
 *
 * `GET /reports/monthly`는 예산·카테고리 분해를 함께 쓰는 화면들 때문에 그대로 남는다
 * (하위호환) — 이 파일도 그 엔드포인트를 계속 호출해 두 경로가 살아있음을 함께 확인한다.
 */
describe("REP-128 report trend API", () => {
  let app: INestApplication;

  beforeAll(async () => {
    process.env.JWT_ACCESS_SECRET = "test-access-secret";
    process.env.JWT_REFRESH_SECRET = "test-refresh-secret";
    process.env.WOORIAI_STAGE_TODAY = "2026-07-06";

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApiApp(app);
    await app.init();
  });

  afterAll(async () => {
    delete process.env.WOORIAI_STAGE_TODAY;
    await app.close();
  });

  async function login(prefix: string) {
    const response = await request(app.getHttpServer())
      .post("/api/v1/auth/oauth-login")
      .send({ provider: "kakao", providerToken: `${prefix}-${randomUUID()}` })
      .expect(200);
    return response.body.tokens.accessToken as string;
  }

  async function completeOnboarding(accessToken: string) {
    const householdId = (
      await request(app.getHttpServer()).get("/api/v1/me").set("Authorization", `Bearer ${accessToken}`).expect(200)
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
        .send({ householdId, nickname: "튼튼이", stageMode: "manual", manualStage: "infant_4_6" })
        .expect(200)
    ).body.id as string;

    await request(app.getHttpServer())
      .post(`/api/v1/children/${childId}/prepared-items`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ itemTemplateIds: [] })
      .expect(200);

    return { childId, householdId };
  }

  async function createExpense(
    accessToken: string,
    childId: string,
    seed: { amountKrw: number; spentOn: string; itemName: string; expenseType?: "expense" | "gift" }
  ) {
    const response = await request(app.getHttpServer())
      .post(`/api/v1/children/${childId}/expenses`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ categoryId, paymentMethod: "card", ...seed })
      .expect(200);
    return response.body.id as string;
  }

  async function trend(accessToken: string, childId: string, query = "") {
    const response = await request(app.getHttpServer())
      .get(`/api/v1/children/${childId}/reports/trend${query}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);
    reportTrendSchema.parse(response.body);
    return response.body as { childId: string; months: { yearMonth: string; totalExpenseKrw: number }[] };
  }

  async function monthlyTotal(accessToken: string, childId: string, yearMonth: string) {
    const response = await request(app.getHttpServer())
      .get(`/api/v1/children/${childId}/reports/monthly?yearMonth=${yearMonth}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);
    return response.body as { yearMonth: string; totalExpenseKrw: number };
  }

  /**
   * 월 경계·빈 달·선물·soft delete·창 밖 지출을 모두 섞은 집합. 창(2026-02..2026-07) 안에서
   *   - 2026-02: 월 첫날/마지막 날 각 1건 (월 경계가 [1일, 다음달 1일)로 정확히 잘리는지)
   *   - 2026-03: 없음 (0으로 채워지는지)
   *   - 2026-04: 선물 1건뿐 → 합계 0 (DNC-015)
   *   - 2026-05: 같은 날 2건
   *   - 2026-06: soft delete된 1건 + 살아있는 1건 (DNC-014)
   *   - 2026-07: 1건
   * 창 밖으로 2025-12(연말) 1건을 둬, 6개월 창이 그 앞을 끌어오지 않는지 확인한다.
   */
  async function seedTrendExpenses(accessToken: string, childId: string) {
    await createExpense(accessToken, childId, { amountKrw: 90000, spentOn: "2025-12-31", itemName: "창 밖 2025" });
    await createExpense(accessToken, childId, { amountKrw: 11000, spentOn: "2026-02-01", itemName: "2월 첫날" });
    await createExpense(accessToken, childId, { amountKrw: 12000, spentOn: "2026-02-28", itemName: "2월 마지막 날" });
    await createExpense(accessToken, childId, {
      amountKrw: 55000,
      spentOn: "2026-04-10",
      itemName: "이모 선물",
      expenseType: "gift"
    });
    await createExpense(accessToken, childId, { amountKrw: 1000, spentOn: "2026-05-05", itemName: "같은 날 A" });
    await createExpense(accessToken, childId, { amountKrw: 2000, spentOn: "2026-05-05", itemName: "같은 날 B" });
    await createExpense(accessToken, childId, { amountKrw: 30000, spentOn: "2026-06-15", itemName: "6월 지출" });
    const deletedId = await createExpense(accessToken, childId, {
      amountKrw: 77000,
      spentOn: "2026-06-16",
      itemName: "잘못 적은 지출"
    });
    await request(app.getHttpServer())
      .delete(`/api/v1/expenses/${deletedId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);
    await createExpense(accessToken, childId, { amountKrw: 4000, spentOn: "2026-07-04", itemName: "7월 지출" });
  }

  it("6개월 추이의 각 달이 같은 달의 월간 리포트 6회 호출과 정확히 일치한다(동치)", async () => {
    const accessToken = await login("rep128-equivalence");
    const { childId } = await completeOnboarding(accessToken);
    await seedTrendExpenses(accessToken, childId);

    const body = await trend(accessToken, childId, "?months=6&endYearMonth=2026-07");
    expect(body.childId).toBe(childId);
    expect(body.months).toHaveLength(6);

    // 참조 구현 = 종전 모바일이 실제로 보내던 6번의 요청. 값도 순서도 그대로여야 한다.
    const perMonth = [];
    for (const yearMonth of ["2026-02", "2026-03", "2026-04", "2026-05", "2026-06", "2026-07"]) {
      const monthly = await monthlyTotal(accessToken, childId, yearMonth);
      perMonth.push({ yearMonth: monthly.yearMonth, totalExpenseKrw: monthly.totalExpenseKrw });
    }
    expect(body.months).toEqual(perMonth);

    // 값 자체도 한 번 못 박아 둔다 — 참조 구현과 새 구현이 같은 방향으로 함께 틀어지는
    // 경우(둘 다 선물을 더하는 등)를 참조 대조만으로는 잡을 수 없다.
    expect(body.months).toEqual([
      { yearMonth: "2026-02-01", totalExpenseKrw: 23000 }, // 월 첫날 + 마지막 날
      { yearMonth: "2026-03-01", totalExpenseKrw: 0 }, // 기록 없는 달
      { yearMonth: "2026-04-01", totalExpenseKrw: 0 }, // 선물만 있는 달 (DNC-015)
      { yearMonth: "2026-05-01", totalExpenseKrw: 3000 }, // 같은 날 2건
      { yearMonth: "2026-06-01", totalExpenseKrw: 30000 }, // soft delete 제외 (DNC-014)
      { yearMonth: "2026-07-01", totalExpenseKrw: 4000 }
    ]);

    // 창 밖(2025-12)의 90000원은 어느 막대에도 섞이지 않는다.
    expect(body.months.reduce((sum, month) => sum + month.totalExpenseKrw, 0)).toBe(60000);
  });

  it("months/endYearMonth를 생략하면 서울 기준 이번 달로 끝나는 6개월을 준다", async () => {
    const accessToken = await login("rep128-defaults");
    const { childId } = await completeOnboarding(accessToken);
    await seedTrendExpenses(accessToken, childId);

    const body = await trend(accessToken, childId);
    // WOORIAI_STAGE_TODAY = 2026-07-06 → 마지막 달은 2026-07.
    expect(body.months.map((month) => month.yearMonth)).toEqual([
      "2026-02-01",
      "2026-03-01",
      "2026-04-01",
      "2026-05-01",
      "2026-06-01",
      "2026-07-01"
    ]);
    expect(await trend(accessToken, childId, "?months=6&endYearMonth=2026-07")).toEqual(body);
  });

  it("연말을 넘는 창과 months=1/12 경계도 연속된 달을 준다", async () => {
    const accessToken = await login("rep128-window");
    const { childId } = await completeOnboarding(accessToken);
    await seedTrendExpenses(accessToken, childId);

    // 2026-01로 끝나는 6개월은 2025-08부터다 — 연 경계를 정수 산술로 넘는다.
    const crossYear = await trend(accessToken, childId, "?months=6&endYearMonth=2026-01");
    expect(crossYear.months.map((month) => month.yearMonth)).toEqual([
      "2025-08-01",
      "2025-09-01",
      "2025-10-01",
      "2025-11-01",
      "2025-12-01",
      "2026-01-01"
    ]);
    // 2025-12의 90000원은 이 창 안에서는 보인다(창 밖 배제가 "그 달을 못 본다"는 뜻이 아니다).
    expect(crossYear.months).toContainEqual({ yearMonth: "2025-12-01", totalExpenseKrw: 90000 });

    const single = await trend(accessToken, childId, "?months=1&endYearMonth=2026-05");
    expect(single.months).toEqual([{ yearMonth: "2026-05-01", totalExpenseKrw: 3000 }]);

    const twelve = await trend(accessToken, childId, "?months=12&endYearMonth=2026-07");
    expect(twelve.months).toHaveLength(12);
    expect(twelve.months[0]!.yearMonth).toBe("2025-08-01");
    expect(twelve.months.at(-1)!.yearMonth).toBe("2026-07-01");
    // 12개월 창의 합 = 시드한 살아있는 지출(선물·soft delete 제외) 전량.
    expect(twelve.months.reduce((sum, month) => sum + month.totalExpenseKrw, 0)).toBe(150000);
  });

  it("endYearMonth는 다른 기간 필드와 같은 YYYY-MM / YYYY-MM-01 관용 포맷을 받는다 (REP-105)", async () => {
    const accessToken = await login("rep128-tolerance");
    const { childId } = await completeOnboarding(accessToken);
    await seedTrendExpenses(accessToken, childId);

    const short = await trend(accessToken, childId, "?endYearMonth=2026-07");
    const long = await trend(accessToken, childId, "?endYearMonth=2026-07-01");
    expect(long).toEqual(short);
  });

  it("months 범위 밖과 잘못된 endYearMonth는 400 VALIDATION_ERROR", async () => {
    const accessToken = await login("rep128-validation");
    const { childId } = await completeOnboarding(accessToken);

    for (const query of [
      "?months=0",
      "?months=13",
      "?months=-1",
      "?months=1.5",
      "?months=abc",
      "?endYearMonth=2026-08-15", // 월 중 날짜는 조용히 잘리지 않는다 (REP-105)
      "?endYearMonth=2026-13",
      "?endYearMonth=2026-00",
      "?endYearMonth=2026",
      "?months=6&yearMonth=2026-07" // forbidNonWhitelisted: 월간 리포트의 파라미터 이름 오용
    ]) {
      await request(app.getHttpServer())
        .get(`/api/v1/children/${childId}/reports/trend${query}`)
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(400)
        .expect(({ body }) => {
          expect(body.error.code).toBe("VALIDATION_ERROR");
        });
    }
  });

  it("다른 가구의 아이는 추이도 볼 수 없다 (IDOR)", async () => {
    const ownerToken = await login("rep128-owner");
    const { childId } = await completeOnboarding(ownerToken);
    await seedTrendExpenses(ownerToken, childId);

    const outsiderToken = await login("rep128-outsider");
    await completeOnboarding(outsiderToken);

    // 다른 리포트 엔드포인트와 **같은** 접근 규약(ChildAccessService.requireChildAccess):
    // 존재하지만 내 가구가 아닌 아이는 403 FORBIDDEN, 없는 아이는 404 CHILD_NOT_FOUND.
    await request(app.getHttpServer())
      .get(`/api/v1/children/${childId}/reports/trend?months=6&endYearMonth=2026-07`)
      .set("Authorization", `Bearer ${outsiderToken}`)
      .expect(403)
      .expect(({ body }) => {
        expect(body.error.code).toBe("FORBIDDEN");
      });

    await request(app.getHttpServer())
      .get(`/api/v1/children/${randomUUID()}/reports/trend`)
      .set("Authorization", `Bearer ${outsiderToken}`)
      .expect(404)
      .expect(({ body }) => {
        expect(body.error.code).toBe("CHILD_NOT_FOUND");
      });

    // 접근 검증은 쿼리 검증보다 **먼저**여도 안 되고(잘못된 쿼리로 남의 아이 존재를
    // 떠보는 것도 400에서 멈춘다), 뒤여도 안 된다 — 여기서는 400이 먼저 나야 한다.
    await request(app.getHttpServer())
      .get(`/api/v1/children/${childId}/reports/trend?months=99`)
      .set("Authorization", `Bearer ${outsiderToken}`)
      .expect(400);

    // 토큰 없이도 마찬가지 (JwtAuthGuard).
    await request(app.getHttpServer())
      .get(`/api/v1/children/${childId}/reports/trend`)
      .expect(401);
  });

  it("지출이 하나도 없는 아이는 요청한 개월 수만큼 0으로 채운 막대를 준다", async () => {
    const accessToken = await login("rep128-empty");
    const { childId } = await completeOnboarding(accessToken);

    const body = await trend(accessToken, childId, "?months=6&endYearMonth=2026-07");
    expect(body.months).toEqual([
      { yearMonth: "2026-02-01", totalExpenseKrw: 0 },
      { yearMonth: "2026-03-01", totalExpenseKrw: 0 },
      { yearMonth: "2026-04-01", totalExpenseKrw: 0 },
      { yearMonth: "2026-05-01", totalExpenseKrw: 0 },
      { yearMonth: "2026-06-01", totalExpenseKrw: 0 },
      { yearMonth: "2026-07-01", totalExpenseKrw: 0 }
    ]);
  });
});
