import type { INestApplication } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AppModule } from "../src/app.module";
import { configureApiApp } from "../src/bootstrap";
import { PrismaService } from "../src/prisma/prisma.service";
import {
  YEAR_MONTH_INPUT_PATTERN,
  reportYearRange,
  yearInputPattern
} from "../src/common/validation/year-month";

/**
 * 기간 필드(`yearMonth` · `year`)의 **연도 창**을 API 표면에서 못박는다.
 *
 * ## 무엇이 문제였나 (재현 실측, @prisma/client 6.19.3)
 * 종전 `YEAR_MONTH_INPUT_PATTERN`은 달만 01~12로 묶고 연도는 `\d{4}`로 열어 뒀다. 달력상
 * 실존하는 값이니 형식은 맞다 — 그런데 `getSeoulMonthRange`가 **다음 달**을 문자열 산술로
 * 만들 때(`${nextYear}-${pad2(nextMonth)}-01`) nextYear가 `Number`라 0채움이 없다:
 *
 *   getSeoulMonthRange("9999-12").endExclusive === "10000-01-01"   // 5자리
 *   getSeoulMonthRange("0001-01").endExclusive === "1-02-01"       // 1자리
 *   new Date("10000-01-01T00:00:00.000Z")  → Invalid Date
 *   prisma.expense.aggregate({ where: { spentOn: { lt: <Invalid Date> } } })
 *     → PrismaClientValidationError (HttpException이 아니다)
 *   → GlobalExceptionFilter가 500 INTERNAL_SERVER_ERROR
 *
 * 전수로 세면 `yearMonth`는 11,988개 값(0001-01~0999-11과 9999-12), 맨 연도는 999개 값
 * (0001~0998과 9999)이 전부 500이었다. `?year=`는 `requireValidYear`가 같은 `/^\d{4}$/`만
 * 보고 통과시킨 뒤 `Number(year) + 1`에서 같은 방식으로 터진다.
 *
 * ## 왜 500이 400보다 나쁜가 — PUT /budget
 * 여섯 경로 중 다섯은 읽기라 500이 "빈손"으로 끝난다. `PUT /budget`만 **쓰기**다:
 * 행이 커밋된 **뒤** 응답 조립에서 터지므로, 500을 받은 그 달의 행이 DB에 남고 그 뒤
 * `GET /budget?yearMonth=<그 달>`이 계속 500이 된다(재현 실측: budgets 0행 → 1행,
 * yearMonth=9999-12-01, 이후 GET 500). 아래 두 번째 테스트가 **행이 만들어지지 않는 것**까지
 * 확인하는 이유다.
 *
 * ## 앱 UI로는 못 가는데 왜 고치나
 * 모바일의 달 점프·기록·리포트는 [오늘-240개월, 오늘]에 물려 있어 이 값들을 만들 수 없다.
 * 즉 화면 결함이 아니라 **API 표면의 4xx/5xx 계약 결함**이다 — 인증된 아이 스코프의 평범한
 * 쿼리 한 줄이 500을 만들고, 그 중 하나는 지울 수 없는 행을 남긴다.
 */

/** 이 스위트가 만든 행만 지우기 위한 자기 접두 — afterAll이 이 접두로만 정리한다. */
const PROVIDER_PREFIX = "year-bound-";

/** 창의 두 끝(통과해야 하는 값)과 그 한 칸 밖(400이어야 하는 값). */
const { min: YEAR_MIN, max: YEAR_MAX } = reportYearRange();
const IN_RANGE_YEAR_MONTHS = [`${YEAR_MIN}-01`, `${YEAR_MAX}-12`];
/**
 * 창 밖. **500을 실제로 내던 두 값이 앞에 온다**(`9999-12`는 endExclusive가 `10000-01-01`,
 * `0001-01`은 `1-02-01`) — 연도 창을 지워 보는 역돌연변이에서 첫 실패가 곧 그 500이도록
 * 순서를 고정한다. 뒤의 둘은 창의 한 칸 밖(경계 자체)이라 그때는 200으로 통과했다.
 */
const OUT_OF_RANGE_YEAR_MONTHS = ["9999-12", "0001-01", `${YEAR_MIN - 1}-12`, `${YEAR_MAX + 1}-01`];
const IN_RANGE_YEARS = [String(YEAR_MIN), String(YEAR_MAX)];
const OUT_OF_RANGE_YEARS = ["9999", "0001", String(YEAR_MIN - 1), String(YEAR_MAX + 1)];

async function login(app: INestApplication, providerToken: string) {
  const response = await request(app.getHttpServer())
    .post("/api/v1/auth/oauth-login")
    .send({ provider: "kakao", providerToken })
    .expect(200);
  return response.body.tokens.accessToken as string;
}

async function completeOnboarding(app: INestApplication, accessToken: string) {
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

  return { childId, householdId };
}

describe("period year bound (yearMonth · year)", () => {
  let app: INestApplication;
  let moduleRef: TestingModule;
  let prisma: PrismaService;
  const createdUserIds: string[] = [];

  beforeAll(async () => {
    process.env.JWT_ACCESS_SECRET = "test-access-secret";
    process.env.JWT_REFRESH_SECRET = "test-refresh-secret";
    process.env.WOORIAI_STAGE_TODAY = "2026-07-06";

    moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApiApp(app);
    await app.init();
    prisma = moduleRef.get(PrismaService);
  });

  /**
   * 자기 접두(`PROVIDER_PREFIX`)가 붙은 사용자에서 출발해 그 사용자가 만든 행만 지운다.
   * 순서는 FK를 거스르지 않도록 자식 → 부모이고(이 저장소의 FK는 대부분 NO ACTION),
   * 정리 하나가 던져도 `app.close()`는 반드시 돌도록 try/finally로 감싼다
   * (admin-categories-users-lookup.e2e.ts 라운드 46 Q-7의 관례).
   */
  afterAll(async () => {
    try {
      const users = await prisma.user.findMany({
        where: { providerUserId: { startsWith: PROVIDER_PREFIX } },
        select: { id: true }
      });
      const userIds = users.map((row) => row.id);
      if (userIds.length) {
        const householdIds = [
          ...new Set(
            (
              await prisma.householdMember.findMany({
                where: { userId: { in: userIds } },
                select: { householdId: true }
              })
            ).map((row) => row.householdId)
          )
        ];
        const childIds = (
          await prisma.child.findMany({ where: { householdId: { in: householdIds } }, select: { id: true } })
        ).map((row) => row.id);

        await prisma.categoryBudget.deleteMany({ where: { childId: { in: childIds } } });
        await prisma.budget.deleteMany({ where: { childId: { in: childIds } } });
        await prisma.childItemStatus.deleteMany({ where: { childId: { in: childIds } } });
        await prisma.expense.deleteMany({ where: { childId: { in: childIds } } });
        await prisma.child.deleteMany({ where: { id: { in: childIds } } });
        await prisma.consent.deleteMany({ where: { userId: { in: userIds } } });
        await prisma.auditLog.deleteMany({ where: { actorUserId: { in: userIds } } });
        await prisma.refreshToken.deleteMany({ where: { userId: { in: userIds } } });
        await prisma.householdMember.deleteMany({ where: { householdId: { in: householdIds } } });
        await prisma.household.deleteMany({ where: { id: { in: householdIds } } });
        await prisma.user.deleteMany({ where: { id: { in: userIds } } });
      }
      // 잔여 0을 스위트 스스로 못박는다 — 정리가 반쯤 돌고 조용히 끝나는 것을 막는다.
      expect(await prisma.user.count({ where: { providerUserId: { startsWith: PROVIDER_PREFIX } } })).toBe(0);
    } finally {
      createdUserIds.length = 0;
      delete process.env.WOORIAI_STAGE_TODAY;
      await app.close();
    }
  });

  /**
   * 여섯 도달 경로 전부: 창 안은 그대로 살아 있고(정상 입력을 새로 막지 않는다), 창 밖은
   * **400 VALIDATION_ERROR**다. 종전에는 창 밖 전부가 500 INTERNAL_SERVER_ERROR였다.
   */
  it("keeps in-window periods working and turns out-of-window ones into 400, not 500", async () => {
    const accessToken = await login(app, `${PROVIDER_PREFIX}reads-${randomUUID()}`);
    const { childId } = await completeOnboarding(app, accessToken);
    const get = (path: string) =>
      request(app.getHttpServer()).get(`/api/v1${path}`).set("Authorization", `Bearer ${accessToken}`);

    // yearMonth를 받는 다섯 입구 — 마지막 GET /budget은 예산 행이 없으므로 404
    // BUDGET_NOT_FOUND가 정상 통과의 증거다(형식 검사를 지났다는 뜻).
    const yearMonthPaths = (yearMonth: string) => [
      { path: `/children/${childId}/expenses?yearMonth=${yearMonth}`, okStatus: 200 },
      { path: `/children/${childId}/reports/monthly?yearMonth=${yearMonth}`, okStatus: 200 },
      { path: `/children/${childId}/reports/category?yearMonth=${yearMonth}`, okStatus: 200 },
      { path: `/children/${childId}/reports/trend?endYearMonth=${yearMonth}`, okStatus: 200 },
      { path: `/children/${childId}/budget?yearMonth=${yearMonth}`, okStatus: 404 }
    ];

    for (const yearMonth of IN_RANGE_YEAR_MONTHS) {
      for (const { path, okStatus } of yearMonthPaths(yearMonth)) {
        const response = await get(path);
        expect(response.status, `${path} → ${JSON.stringify(response.body)}`).toBe(okStatus);
        if (okStatus === 404) expect(response.body.error.code).toBe("BUDGET_NOT_FOUND");
      }
    }

    for (const yearMonth of OUT_OF_RANGE_YEAR_MONTHS) {
      for (const { path } of yearMonthPaths(yearMonth)) {
        const response = await get(path);
        expect(response.status, `${path} → ${JSON.stringify(response.body)}`).toBe(400);
        expect(response.body.error.code).toBe("VALIDATION_ERROR");
      }
    }

    // 맨 연도를 받는 두 입구(`/reports/yearly`, `/reports/category?year=`).
    const yearPaths = (year: string) => [
      `/children/${childId}/reports/yearly?year=${year}`,
      `/children/${childId}/reports/category?year=${year}`
    ];

    for (const year of IN_RANGE_YEARS) {
      for (const path of yearPaths(year)) {
        const response = await get(path);
        expect(response.status, `${path} → ${JSON.stringify(response.body)}`).toBe(200);
      }
    }

    for (const year of OUT_OF_RANGE_YEARS) {
      for (const path of yearPaths(year)) {
        const response = await get(path);
        expect(response.status, `${path} → ${JSON.stringify(response.body)}`).toBe(400);
        expect(response.body.error.code).toBe("VALIDATION_ERROR");
      }
    }
  }, 120_000);

  /**
   * 여섯 경로 중 유일한 쓰기. 창 밖 연월은 400이어야 하고, **그 달의 budgets 행이 생기지
   * 않아야** 한다 — 종전에는 행이 커밋된 뒤 500이 나서 그 달의 GET이 영구히 500이었다.
   * 창 안의 두 끝은 200으로 저장되고 바로 뒤 GET이 그 값을 돌려준다(상한이 정상 쓰기를
   * 막지 않는다는 반대편 증거).
   */
  it("rejects an out-of-window budget PUT without committing a row", async () => {
    const accessToken = await login(app, `${PROVIDER_PREFIX}budget-${randomUUID()}`);
    const { childId } = await completeOnboarding(app, accessToken);
    const auth = (test: request.Test) => test.set("Authorization", `Bearer ${accessToken}`);

    const budgetRowCount = () => prisma.budget.count({ where: { childId } });
    expect(await budgetRowCount()).toBe(0);

    for (const yearMonth of OUT_OF_RANGE_YEAR_MONTHS) {
      const response = await auth(request(app.getHttpServer()).put(`/api/v1/children/${childId}/budget`)).send({
        yearMonth,
        amountKrw: 150000
      });
      expect(response.status, `PUT ${yearMonth} → ${JSON.stringify(response.body)}`).toBe(400);
      expect(response.body.error.code).toBe("VALIDATION_ERROR");
      // 핵심 단언: 거절된 쓰기는 흔적을 남기지 않는다.
      expect(await budgetRowCount(), `PUT ${yearMonth} committed a row`).toBe(0);

      // 그 뒤의 읽기도 500이 아니라 같은 400이다(종전에는 남은 행 때문에 500이었다).
      const followUp = await auth(
        request(app.getHttpServer()).get(`/api/v1/children/${childId}/budget?yearMonth=${yearMonth}`)
      );
      expect(followUp.status).toBe(400);
      expect(followUp.body.error.code).toBe("VALIDATION_ERROR");
    }

    for (const yearMonth of IN_RANGE_YEAR_MONTHS) {
      await auth(request(app.getHttpServer()).put(`/api/v1/children/${childId}/budget`))
        .send({ yearMonth, amountKrw: 150000 })
        .expect(200);
      await auth(request(app.getHttpServer()).get(`/api/v1/children/${childId}/budget?yearMonth=${yearMonth}`))
        .expect(200)
        .expect(({ body }) => {
          expect(body.yearMonth).toBe(`${yearMonth}-01`);
          expect(body.amountKrw).toBe(150000);
        });
    }
    expect(await budgetRowCount()).toBe(IN_RANGE_YEAR_MONTHS.length);
  }, 120_000);

  /**
   * 정규식과 숫자 상수가 **같은 집합**을 뜻하는지 0000~9999 전수로 확인한다.
   * `YEAR_RANGE_SOURCE`는 `REPORT_YEAR_MIN`/`REPORT_YEAR_MAX`를 손으로 옮겨 적은 것이라
   * 이 확인이 없으면 둘이 조용히 갈릴 수 있다(라운드 54 P2-8: 주석은 드리프트를 막지 못한다).
   */
  it("pins the regex to the named window across all 4-digit years", () => {
    const yearPattern = yearInputPattern();
    for (let year = 0; year <= 9999; year += 1) {
      const text = String(year).padStart(4, "0");
      const inWindow = year >= YEAR_MIN && year <= YEAR_MAX;
      expect(yearPattern.test(text), `year ${text}`).toBe(inWindow);
      expect(YEAR_MONTH_INPUT_PATTERN.test(`${text}-01`), `yearMonth ${text}-01`).toBe(inWindow);
      expect(YEAR_MONTH_INPUT_PATTERN.test(`${text}-12-01`), `yearMonth ${text}-12-01`).toBe(inWindow);
    }
    // 달 상한(REP-105/R24-L5)은 종전 그대로다 — 연도 창을 더하면서 함께 무너지지 않았다.
    expect(YEAR_MONTH_INPUT_PATTERN.test(`${YEAR_MIN}-13`)).toBe(false);
    expect(YEAR_MONTH_INPUT_PATTERN.test(`${YEAR_MIN}-00`)).toBe(false);
    expect(YEAR_MONTH_INPUT_PATTERN.test(`${YEAR_MIN}-07-15`)).toBe(false);
  });
});
