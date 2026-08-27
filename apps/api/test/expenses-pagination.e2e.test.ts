import { randomUUID } from "node:crypto";
import type { INestApplication } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import request from "supertest";
import {
  EXPENSE_LIST_DEFAULT_LIMIT,
  EXPENSE_LIST_MAX_LIMIT,
  listExpensesResponseSchema
} from "@wooriai/contracts";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AppModule } from "../src/app.module";
import { configureApiApp } from "../src/bootstrap";
import { PrismaService } from "../src/prisma/prisma.service";

const categoryId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

type ExpenseListBody = {
  expenses: Array<{ id: string; amountKrw: number; spentOn: string; version: number }>;
  totalAmountKrw: number;
  hasMore: boolean;
  nextCursor: string | null;
};

/**
 * API-124: GET /api/v1/children/:childId/expenses 커서 페이지네이션.
 *
 * 종전에는 `yearMonth`를 생략하면 전 기간 지출이 무제한으로 실려 나왔다. 이제
 * `limit`(기본 200, 상한 500) + `cursor`로 페이지를 나눈다. 이 스펙이 지키는 계약:
 *  - 기본 limit이 실제로 잘라낸다(hasMore/nextCursor로 이어진다).
 *  - limit+cursor 왕복으로 전량을 모으면 페이지 없는 결과와 **정확히 같다**(누락/중복 없음).
 *  - `totalAmountKrw`는 페이지 합이 아니라 조회 범위 전체 합이다(DNC-015: 선물 제외).
 *  - `yearMonth`와 병용해도 그 달 안에서만 페이지가 돈다.
 *  - 손상된 커서는 400 EXPENSE_CURSOR_INVALID (조용히 무시하지 않는다).
 */
describe("Expense list pagination (GET /v1/children/:childId/expenses)", () => {
  let app: INestApplication;
  let moduleRef: TestingModule;

  beforeEach(async () => {
    process.env.JWT_ACCESS_SECRET = "test-access-secret";
    process.env.JWT_REFRESH_SECRET = "test-refresh-secret";
    process.env.WOORIAI_STAGE_TODAY = "2026-07-06";

    moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApiApp(app);
    await app.init();
  });

  afterEach(async () => {
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
        .send({ householdId, nickname: "페이지네이션", stageMode: "manual", manualStage: "infant_4_6" })
        .expect(200)
    ).body.id as string;

    return { childId, householdId };
  }

  async function createExpense(
    accessToken: string,
    childId: string,
    input: { amountKrw: number; spentOn: string; itemName: string; expenseType?: "expense" | "gift" }
  ) {
    return (
      await request(app.getHttpServer())
        .post(`/api/v1/children/${childId}/expenses`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ categoryId, ...input })
        .expect(200)
    ).body as { id: string };
  }

  async function listPage(accessToken: string, childId: string, query = "") {
    const response = await request(app.getHttpServer())
      .get(`/api/v1/children/${childId}/expenses${query}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);
    // 응답 전체가 공유 계약(packages/contracts)에 맞는지 매 페이지 확인한다.
    listExpensesResponseSchema.parse(response.body);
    return response.body as ExpenseListBody;
  }

  /** limit+cursor 왕복으로 전 페이지를 모아 하나의 목록으로 되돌린다. */
  async function collectAllPages(accessToken: string, childId: string, limit: number, extraQuery = "") {
    const collected: ExpenseListBody["expenses"] = [];
    const totals: number[] = [];
    let cursor: string | null = null;
    let pages = 0;
    // 커서가 전진하지 않는 버그가 무한 루프 대신 실패로 드러나도록 안전 상한을 둔다.
    const maxPages = 50;

    while (pages < maxPages) {
      const cursorParam: string = cursor ? `&cursor=${encodeURIComponent(cursor)}` : "";
      const page: ExpenseListBody = await listPage(
        accessToken,
        childId,
        `?limit=${limit}${cursorParam}${extraQuery}`
      );
      collected.push(...page.expenses);
      totals.push(page.totalAmountKrw);
      cursor = page.nextCursor;
      pages += 1;
      if (!page.hasMore) break;
      expect(page.expenses).toHaveLength(limit);
    }

    expect(pages).toBeLessThan(maxPages);
    return { expenses: collected, totals, pages };
  }

  it("pages a child's all-time expenses by cursor, and a full round-trip reassembles exactly the unpaginated list", async () => {
    const accessToken = await login("expenses-page-roundtrip");
    const { childId } = await completeOnboarding(accessToken);

    // 같은 날짜(정렬 동률)와 다른 날짜를 섞어, id 타이브레이커까지 커서에 실려야만
    // 왕복이 성립하도록 만든다.
    const days = ["2026-07-06", "2026-07-05", "2026-07-04"];
    for (let index = 0; index < 9; index += 1) {
      await createExpense(accessToken, childId, {
        amountKrw: 1000 * (index + 1),
        spentOn: days[index % days.length],
        itemName: `페이지 품목 ${index + 1}`
      });
    }
    const expectedTotal = Array.from({ length: 9 }, (_, index) => 1000 * (index + 1)).reduce((a, b) => a + b, 0);

    // 한 페이지에 다 담기는 큰 limit = 페이지네이션 이전과 같은 "전량" 응답.
    const unpaginated = await listPage(accessToken, childId, "?limit=500");
    expect(unpaginated.expenses).toHaveLength(9);
    expect(unpaginated.hasMore).toBe(false);

    // 작은 limit으로 여러 번 왕복 -> 같은 순서, 같은 집합.
    const paged = await collectAllPages(accessToken, childId, 2);
    expect(paged.pages).toBeGreaterThan(1);
    expect(paged.expenses).toEqual(unpaginated.expenses);

    const ids = paged.expenses.map((expense) => expense.id);
    expect(new Set(ids).size).toBe(ids.length); // 중복 없음
    expect(new Set(ids)).toEqual(new Set(unpaginated.expenses.map((expense) => expense.id))); // 누락 없음

    // 총액은 페이지 크기와 무관하게 항상 전체 합이다(페이지 합이 아니다).
    expect(unpaginated.totalAmountKrw).toBe(expectedTotal);
    for (const total of paged.totals) {
      expect(total).toBe(expectedTotal);
    }
  });

  it("applies a default page size when limit is omitted, and keeps totalAmountKrw at the all-time sum (gifts excluded, DNC-015)", async () => {
    const accessToken = await login("expenses-page-default");
    const { childId } = await completeOnboarding(accessToken);

    await createExpense(accessToken, childId, { amountKrw: 10000, spentOn: "2026-07-06", itemName: "지출 A" });
    await createExpense(accessToken, childId, { amountKrw: 20000, spentOn: "2026-07-05", itemName: "지출 B" });
    // 선물은 목록에는 나오되 합계에서는 빠진다 — 기존 규칙(DNC-015)이 그대로 유지되는지 확인.
    await createExpense(accessToken, childId, {
      amountKrw: 500000,
      spentOn: "2026-07-04",
      itemName: "선물 받은 유모차",
      expenseType: "gift"
    });

    // limit/cursor를 모르는 기존 클라이언트의 요청 그대로 — 종전 필드가 전부 유지된다.
    const legacyShaped = await listPage(accessToken, childId);
    expect(legacyShaped.expenses).toHaveLength(3);
    expect(legacyShaped.totalAmountKrw).toBe(30000);
    expect(legacyShaped.hasMore).toBe(false);
    expect(legacyShaped.expenses[0]).toMatchObject({ itemName: "지출 A", version: 1 });

    // 한 건씩 끊어 읽어도 총액은 그대로 30000(페이지 합 10000/20000/0이 아니다).
    const firstPage = await listPage(accessToken, childId, "?limit=1");
    expect(firstPage.expenses).toHaveLength(1);
    expect(firstPage.hasMore).toBe(true);
    expect(firstPage.totalAmountKrw).toBe(30000);
    expect(typeof firstPage.nextCursor).toBe("string");

    const paged = await collectAllPages(accessToken, childId, 1);
    expect(paged.expenses.map((expense) => expense.id)).toEqual(legacyShaped.expenses.map((expense) => expense.id));
    for (const total of paged.totals) {
      expect(total).toBe(30000);
    }
  });

  it("paginates within a yearMonth filter and keeps totalAmountKrw scoped to that month", async () => {
    const accessToken = await login("expenses-page-yearmonth");
    const { childId } = await completeOnboarding(accessToken);

    await createExpense(accessToken, childId, { amountKrw: 1000, spentOn: "2026-07-06", itemName: "7월 A" });
    await createExpense(accessToken, childId, { amountKrw: 2000, spentOn: "2026-07-05", itemName: "7월 B" });
    await createExpense(accessToken, childId, { amountKrw: 4000, spentOn: "2026-07-04", itemName: "7월 C" });
    await createExpense(accessToken, childId, { amountKrw: 900000, spentOn: "2026-06-10", itemName: "6월 제외" });

    const monthAtOnce = await listPage(accessToken, childId, "?yearMonth=2026-07");
    expect(monthAtOnce.expenses).toHaveLength(3);
    expect(monthAtOnce.totalAmountKrw).toBe(7000);

    const paged = await collectAllPages(accessToken, childId, 2, "&yearMonth=2026-07");
    expect(paged.pages).toBeGreaterThan(1);
    expect(paged.expenses).toEqual(monthAtOnce.expenses);
    // 6월 건은 어느 페이지에도 새어 나오지 않고, 총액도 7월분만이다.
    expect(paged.expenses.map((expense) => expense.spentOn).every((day) => day.startsWith("2026-07"))).toBe(true);
    for (const total of paged.totals) {
      expect(total).toBe(7000);
    }

    // 전 기간 조회는 6월분까지 포함한 합계 — yearMonth 유무의 의미는 종전과 같다.
    const allTime = await listPage(accessToken, childId, "?limit=500");
    expect(allTime.totalAmountKrw).toBe(907000);
  });

  it("caps an unlimited (limit-less) request at the default page size instead of returning every row (API-124 regression)", async () => {
    const accessToken = await login("expenses-page-default-cap");
    const { childId, householdId } = await completeOnboarding(accessToken);
    const userId = (
      await request(app.getHttpServer())
        .get("/api/v1/me")
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(200)
    ).body.user.id as string;

    // 기본 limit을 넘기려면 200건 이상이 필요하다 — HTTP로 한 건씩 만들면 느리므로
    // 행만 직접 심는다(경로가 읽는 조건은 childId/deletedAt/expenseType로 동일).
    const rowCount = EXPENSE_LIST_DEFAULT_LIMIT + 5;
    const prisma = moduleRef.get(PrismaService);
    await prisma.expense.createMany({
      data: Array.from({ length: rowCount }, (_, index) => ({
        householdId,
        childId,
        createdByUserId: userId,
        categoryId,
        amountKrw: 100,
        spentOn: new Date("2026-07-06T00:00:00.000Z"),
        itemName: `대량 품목 ${index + 1}`,
        paymentMethod: "unknown" as const,
        expenseType: "expense" as const,
        source: "manual" as const
      }))
    });

    const first = await listPage(accessToken, childId);
    expect(first.expenses).toHaveLength(EXPENSE_LIST_DEFAULT_LIMIT);
    expect(first.hasMore).toBe(true);
    // 총액은 잘린 페이지가 아니라 전체 기준을 유지한다.
    expect(first.totalAmountKrw).toBe(100 * rowCount);

    // 전량은 커서로만 도달할 수 있고, 왕복하면 정확히 전체 건수가 모인다.
    const paged = await collectAllPages(accessToken, childId, EXPENSE_LIST_DEFAULT_LIMIT);
    expect(paged.expenses).toHaveLength(rowCount);
    expect(new Set(paged.expenses.map((expense) => expense.id)).size).toBe(rowCount);
  });

  it("rejects a malformed cursor with 400 EXPENSE_CURSOR_INVALID rather than silently ignoring it", async () => {
    const accessToken = await login("expenses-page-bad-cursor");
    const { childId } = await completeOnboarding(accessToken);
    await createExpense(accessToken, childId, { amountKrw: 1000, spentOn: "2026-07-06", itemName: "커서 테스트" });

    // 구현 선택: 잘못된 커서는 조용히 무시(=1페이지 재전송)하지 않고 400으로 거부한다.
    // 무시하면 클라이언트가 "다음 페이지"를 요청했는데 첫 페이지를 받고도 모른 채
    // 무한 루프에 빠질 수 있다. sync.service.ts의 SYNC_CURSOR_INVALID와 같은 태도.
    for (const badCursor of ["not-a-cursor!!!", Buffer.from("only-one-part", "utf8").toString("base64")]) {
      await request(app.getHttpServer())
        .get(`/api/v1/children/${childId}/expenses?cursor=${encodeURIComponent(badCursor)}`)
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(400)
        .expect(({ body }) => {
          expect(body.error.code).toBe("EXPENSE_CURSOR_INVALID");
        });
    }
  });

  it("validates limit bounds (1..max) and rejects anything above the max", async () => {
    const accessToken = await login("expenses-page-limit-bounds");
    const { childId } = await completeOnboarding(accessToken);

    await request(app.getHttpServer())
      .get(`/api/v1/children/${childId}/expenses?limit=${EXPENSE_LIST_MAX_LIMIT}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);

    for (const badLimit of [EXPENSE_LIST_MAX_LIMIT + 1, 0, -1]) {
      await request(app.getHttpServer())
        .get(`/api/v1/children/${childId}/expenses?limit=${badLimit}`)
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(400)
        .expect(({ body }) => {
          expect(body.error.code).toBe("VALIDATION_ERROR");
        });
    }
  });

  it("returns an empty page (not another household's rows) for a stranger and still requires auth", async () => {
    const ownerToken = await login("expenses-page-idor-owner");
    const { childId } = await completeOnboarding(ownerToken);
    await createExpense(ownerToken, childId, { amountKrw: 1000, spentOn: "2026-07-06", itemName: "남의 집 품목" });

    const strangerToken = await login("expenses-page-idor-stranger");
    await completeOnboarding(strangerToken);

    await request(app.getHttpServer())
      .get(`/api/v1/children/${childId}/expenses?limit=10`)
      .set("Authorization", `Bearer ${strangerToken}`)
      .expect((response) => {
        expect([403, 404]).toContain(response.status);
      });

    await request(app.getHttpServer()).get(`/api/v1/children/${childId}/expenses`).expect(401);
  });
});
