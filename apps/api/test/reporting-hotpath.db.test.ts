import { randomUUID } from "node:crypto";
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { PrismaClient } from "@prisma/client";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AppModule } from "../src/app.module";
import { configureApiApp } from "../src/bootstrap";
import { deployMigrations, isDatabaseAvailable } from "./helpers/test-db";

const dbAvailable = await isDatabaseAvailable();
const categoryId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

/**
 * PERF-121: 홈(getHome)과 누적 리포트(getCumulativeReport)의 "전 행 로드 후 JS 집계"를
 * DB 집계(aggregate / groupBy)와 LIMIT으로 치환한 변경의 **동치**를 고정한다.
 *
 * 회귀를 잡는 방식이 핵심이다: 기대값을 손으로 적지 않고, 치환 전 구현과 동일한
 * "전 행을 읽어 JS로 접는" 참조 구현(referenceHome / referenceCumulative)을 이
 * 파일 안에서 Prisma raw 행으로 직접 계산해 API 응답과 비교한다. 어느 한 쪽만
 * 바뀌면(필터 누락, 정렬 변경, 선물 포함 여부, soft-delete 누락, 연도 경계 오프셋)
 * 즉시 불일치가 난다.
 *
 * 데이터 모양은 문제가 생길 수 있는 축을 모두 섞는다:
 *   - 행 다수(연도별 여러 건 + 같은 날짜 복수 건)
 *   - 선물(expenseType='gift') 혼합 — 합계에서 제외(DNC-015)되지만 최근 목록에는 포함
 *   - soft delete된 행 — 합계·최근 목록·누적 리포트 모두에서 제외(DNC-014)
 *   - 연도 경계(12-31 / 01-01) — 누적 리포트의 연도 버킷 분리
 */
describe.skipIf(!dbAvailable)("PERF-121 reporting hot paths (real Postgres)", () => {
  let app: INestApplication;
  let prisma: PrismaClient;

  beforeAll(async () => {
    deployMigrations();
    process.env.JWT_ACCESS_SECRET = "test-access-secret";
    process.env.JWT_REFRESH_SECRET = "test-refresh-secret";
    process.env.WOORIAI_STAGE_TODAY = "2026-07-06";

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApiApp(app);
    await app.init();
    prisma = new PrismaClient();
  });

  afterAll(async () => {
    delete process.env.WOORIAI_STAGE_TODAY;
    await prisma.$disconnect();
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
    const me = (await request(app.getHttpServer()).get("/api/v1/me").set("Authorization", `Bearer ${accessToken}`).expect(200))
      .body as { user: { id: string }; households: { id: string }[] };
    const householdId = me.households[0].id;
    const userId = me.user.id;

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

    return { childId, householdId, userId };
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

  /**
   * 치환 전 getHome과 같은 계산: 아이의 전 행을 읽어 JS에서 합계(선물 제외)와
   * 최근 3건(정렬 후 slice)을 뽑는다.
   *
   * FIX-121A(F1): 참조 구현도 서비스와 같은 `id desc` 타이브레이커를 쓴다 —
   * (spentOn, createdAt)만으로는 동률 행의 순서가 DB 재량이라 "전 행 slice"와
   * "LIMIT 3"의 대조 자체가 비결정적이 된다. 두 쪽이 같은 결정적 정렬을
   * 공유해야 이 파일의 동치 대조가 의미를 갖는다.
   */
  async function referenceHome(childId: string) {
    const rows = await prisma.expense.findMany({
      where: { childId, deletedAt: null },
      orderBy: [{ spentOn: "desc" }, { createdAt: "desc" }, { id: "desc" }]
    });
    return {
      totalExpenseKrw: rows
        .filter((row) => row.expenseType === "expense")
        .reduce((sum, row) => sum + row.amountKrw, 0),
      recentExpenseIds: rows.slice(0, 3).map((row) => row.id)
    };
  }

  /** 치환 전 getCumulativeReport와 같은 계산: 전 행 → JS 연도 집계. */
  async function referenceCumulative(childId: string) {
    const rows = await prisma.expense.findMany({
      where: { childId, deletedAt: null, expenseType: "expense" },
      select: { spentOn: true, amountKrw: true }
    });

    const yearly = new Map<string, { year: string; amountKrw: number; count: number }>();
    for (const row of rows) {
      const year = row.spentOn.toISOString().slice(0, 4);
      const current = yearly.get(year) ?? { year, amountKrw: 0, count: 0 };
      current.amountKrw += row.amountKrw;
      current.count += 1;
      yearly.set(year, current);
    }

    return {
      totalExpenseKrw: rows.reduce((sum, row) => sum + row.amountKrw, 0),
      yearly: [...yearly.values()].sort((left, right) => right.year.localeCompare(left.year))
    };
  }

  /**
   * 여러 해·같은 날짜 복수 건·선물·soft delete·연도 경계를 모두 담은 지출 집합을
   * 만든다. 두 테스트가 각각 자기 아이로 독립 실행한다.
   */
  async function seedMixedExpenses(accessToken: string, childId: string) {
    await createExpense(accessToken, childId, { amountKrw: 10000, spentOn: "2025-03-10", itemName: "2025 유모차" });
    await createExpense(accessToken, childId, { amountKrw: 20000, spentOn: "2025-12-31", itemName: "2025 마지막 날" });
    await createExpense(accessToken, childId, { amountKrw: 30000, spentOn: "2026-01-01", itemName: "2026 첫날" });
    await createExpense(accessToken, childId, { amountKrw: 1000, spentOn: "2026-05-05", itemName: "같은 날 A" });
    await createExpense(accessToken, childId, { amountKrw: 2000, spentOn: "2026-05-05", itemName: "같은 날 B" });
    await createExpense(accessToken, childId, { amountKrw: 4000, spentOn: "2026-07-04", itemName: "최근 지출" });
    // 선물: 합계에서 빠지지만(DNC-015) 최근 목록에는 남는다.
    await createExpense(accessToken, childId, {
      amountKrw: 99000,
      spentOn: "2026-07-05",
      itemName: "이모 선물",
      expenseType: "gift"
    });
    // soft delete: 모든 집계에서 빠진다(DNC-014).
    const deletedId = await createExpense(accessToken, childId, {
      amountKrw: 77000,
      spentOn: "2026-07-06",
      itemName: "잘못 적은 지출"
    });
    await request(app.getHttpServer())
      .delete(`/api/v1/expenses/${deletedId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);
    return { deletedId };
  }

  it("F1: 홈의 전 기간 합계·최근 3건이 전 행 로드 참조 구현과 동치다", async () => {
    const accessToken = await login("perf121-home");
    const { childId } = await completeOnboarding(accessToken);
    const { deletedId } = await seedMixedExpenses(accessToken, childId);

    const expected = await referenceHome(childId);
    const { body } = await request(app.getHttpServer())
      .get(`/api/v1/home?childId=${childId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);

    // 선물(99,000)과 삭제 행(77,000)을 뺀 전 기간 합계.
    expect(body.totalExpenseKrw).toBe(expected.totalExpenseKrw);
    expect(body.totalExpenseKrw).toBe(10000 + 20000 + 30000 + 1000 + 2000 + 4000);

    // 최근 3건: spentOn desc, createdAt desc. 선물은 포함, 삭제 행은 제외.
    expect(body.recentExpenses.map((expense: { id: string }) => expense.id)).toEqual(expected.recentExpenseIds);
    expect(
      body.recentExpenses.map((expense: { itemName: string; spentOn: string }) => [expense.spentOn, expense.itemName])
    ).toEqual([
      ["2026-07-05", "이모 선물"],
      ["2026-07-04", "최근 지출"],
      ["2026-05-05", "같은 날 B"]
    ]);
    expect(body.recentExpenses.map((expense: { id: string }) => expense.id)).not.toContain(deletedId);

    // 월간 예산 블록은 이번 달(2026-07)만 — 전 기간 합계와 분리돼 있어야 한다.
    expect(body.monthly.usedAmountKrw).toBe(4000);
  });

  /**
   * FIX-121A(F1) 회귀: `spent_on`과 `created_at`이 **모두 같은** 행이 여러 건 있는
   * 상태. 실제로 이런 데이터는 가져오기 확정(import-pipeline)이 만든다 — 한
   * 트랜잭션 안에서 여러 지출을 삽입하므로 `created_at` 기본값 now()가
   * 트랜잭션 시각으로 전부 동일해진다. 여기서는 createMany로 그 모양을 직접
   * 만든다(같은 날짜 + 같은 타임스탬프 5건).
   *
   * 타이브레이커가 없으면 Postgres가 동률 행을 어떤 순서로든 돌려줄 수 있어
   * PERF-121의 `LIMIT 3`(홈)이 종전 "전량 정렬 후 slice(0,3)"와 다른 3건을 뽑을
   * 수 있었다. `id desc`로 두 경로가 같은 3건을 결정적으로 고르는지 고정한다.
   */
  it("F1: (spentOn, createdAt) 동률에서도 홈 최근 3건이 id desc로 결정적이다", async () => {
    const accessToken = await login("fix121a-tie");
    const { childId, householdId, userId } = await completeOnboarding(accessToken);

    const sameCreatedAt = new Date("2026-06-06T03:00:00.000Z");
    const ids = Array.from({ length: 5 }, () => randomUUID());
    await prisma.expense.createMany({
      data: ids.map((id, index) => ({
        id,
        householdId,
        childId,
        createdByUserId: userId,
        categoryId,
        amountKrw: 1000 * (index + 1),
        spentOn: new Date("2026-06-06T00:00:00.000Z"),
        itemName: `동률 ${index}`,
        paymentMethod: "card" as const,
        createdAt: sameCreatedAt,
        updatedAt: sameCreatedAt
      }))
    });

    // 동률이라 정렬을 가르는 것은 id뿐 — uuid 텍스트 내림차순 상위 3건.
    const expectedTop3 = [...ids].sort().reverse().slice(0, 3);

    // 참조 구현("전 행 → slice")과 기대값이 먼저 일치해야 한다.
    const reference = await referenceHome(childId);
    expect(reference.recentExpenseIds).toEqual(expectedTop3);

    // 홈(LIMIT 3)이 같은 3건을, 반복 호출에도 흔들리지 않고 돌려준다.
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const { body } = await request(app.getHttpServer())
        .get(`/api/v1/home?childId=${childId}`)
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(200);
      expect(body.recentExpenses.map((expense: { id: string }) => expense.id)).toEqual(expectedTop3);
    }

    // 기록 탭(listExpenses)은 같은 정렬 정의를 공유하므로 전량 목록의 앞 3건이
    // 홈과 정확히 일치해야 한다 — 두 화면이 함께 안정화되는 것이 이 수정의 요지.
    const list = await request(app.getHttpServer())
      .get(`/api/v1/children/${childId}/expenses`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);
    expect(list.body.expenses.map((expense: { id: string }) => expense.id)).toEqual([...ids].sort().reverse());
    expect(list.body.expenses.slice(0, 3).map((expense: { id: string }) => expense.id)).toEqual(expectedTop3);
  });

  it("F1: 지출이 없는 아이도 합계 0 / 빈 최근 목록을 그대로 유지한다", async () => {
    const accessToken = await login("perf121-empty");
    const { childId } = await completeOnboarding(accessToken);

    await request(app.getHttpServer())
      .get(`/api/v1/home?childId=${childId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200)
      .expect(({ body }) => {
        // aggregate의 SUM은 행이 없으면 null — 0으로 정규화되는지 고정한다.
        expect(body.totalExpenseKrw).toBe(0);
        expect(body.recentExpenses).toEqual([]);
      });
  });

  it("F2: 누적 리포트의 연도 집계가 전 행 로드 참조 구현과 동치다", async () => {
    const accessToken = await login("perf121-cumulative");
    const { childId } = await completeOnboarding(accessToken);
    await seedMixedExpenses(accessToken, childId);

    const expected = await referenceCumulative(childId);
    const { body } = await request(app.getHttpServer())
      .get(`/api/v1/children/${childId}/reports/cumulative`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);

    expect(body).toEqual({ childId, totalExpenseKrw: expected.totalExpenseKrw, yearly: expected.yearly });
    // 참조 구현과 함께 절대값도 고정한다(둘 다 같은 방향으로 틀어지는 경우 방지).
    expect(body).toEqual({
      childId,
      totalExpenseKrw: 67000,
      yearly: [
        // 연도 내림차순. 2026 = 30,000 + 1,000 + 2,000 + 4,000 (선물·삭제 제외),
        // count는 같은 날짜 2건을 각각 센다.
        { year: "2026", amountKrw: 37000, count: 4 },
        // 12-31 지출이 2025 버킷에 남는다(연도 경계).
        { year: "2025", amountKrw: 30000, count: 2 }
      ]
    });
  });

  it("F2: 지출이 없는 아이의 누적 리포트는 빈 연도 배열과 합계 0을 준다", async () => {
    const accessToken = await login("perf121-cumulative-empty");
    const { childId } = await completeOnboarding(accessToken);

    await request(app.getHttpServer())
      .get(`/api/v1/children/${childId}/reports/cumulative`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual({ childId, totalExpenseKrw: 0, yearly: [] });
      });
  });
});
