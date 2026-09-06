import type { INestApplication } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
import request from "supertest";
import { MONEY_KRW_MAX, budgetSchema, errorResponseSchema, reportMonthlySchema } from "@wooriai/contracts";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AppModule } from "../src/app.module";
import { configureApiApp } from "../src/bootstrap";
import { CATEGORY_BUDGET_MAX_PER_MONTH } from "../src/onboarding/onboarding-core.service";

/**
 * 라운드 102 T1 — 카테고리별 예산 e2e.
 * 설계: docs/5차/round102-category-budget-design.md (§2 계약 · §9 확정 · §6.7 리스크).
 *
 * 신규 엔드포인트 0(§2.1): 기존 PUT/GET /children/:childId/budget과
 * GET /reports/monthly의 **가산 필드**만 검증한다. 핵심 경계는 §10의 e2e 목록 전수 —
 * 필드 부재 무접촉(R5) · 빈 배열 해제 · 총액 없는 달 404 불변(R3) · 검증(중복 id·
 * 비활성/미존재 카테고리·상한 30·금액 범위) · viewer 403 · 멱등 재전송 · 감사 봉투 가산 ·
 * 월간 리포트 가산 · 아이 파기 캐스케이드(§1.5).
 *
 * 데이터 격리: 자기 oauth-login으로 만든 사용자/가구/아이와 그 아이의 budgets/
 * category_budgets 행만 만들고 읽는다(test-db.ts 하단 관례). 비활성 카테고리 경계용
 * 행 하나는 이 스위트가 만들고 afterAll이 지운다 — categories.e2e(시드 전량 21행을
 * 고정하는 스위트)는 **배타 스위트**라(exclusive-suites.ts) 이 스위트와 겹쳐 돌지 않고,
 * 정리 후에는 전량이 종전 그대로다.
 */

/** 시드의 모바일 퀵타일 별칭(기저귀) — active:true·selectable:false 고정 id (prisma/seed-data.ts). */
const ALIAS_DIAPER_ID = "c0a7e901-0000-4c01-8c01-c47e900ec001";

async function login(app: INestApplication, providerToken: string) {
  const response = await request(app.getHttpServer())
    .post("/api/v1/auth/oauth-login")
    .send({ provider: "kakao", providerToken: `${providerToken}-${randomUUID()}` })
    .expect(200);
  return response.body.tokens.accessToken as string;
}

async function whoAmI(app: INestApplication, accessToken: string) {
  const body = (
    await request(app.getHttpServer()).get("/api/v1/me").set("Authorization", `Bearer ${accessToken}`).expect(200)
  ).body;
  return { userId: body.user.id as string, householdId: body.households[0].id as string };
}

async function createChildWithConsents(app: INestApplication, accessToken: string, householdId: string) {
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

  return (
    await request(app.getHttpServer())
      .post("/api/v1/children")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ householdId, nickname: "예산둥이", stageMode: "manual", manualStage: "newborn_0_3" })
      .expect(200)
  ).body.id as string;
}

type Entry = { categoryId: string; amountKrw: number };

const sortedAsc = (entries: Entry[]) =>
  [...entries].sort((a, b) => (a.categoryId < b.categoryId ? -1 : a.categoryId > b.categoryId ? 1 : 0));

describe("Category budgets API (라운드 102 T1)", () => {
  let app: INestApplication;
  let moduleRef: TestingModule;
  let prisma: PrismaClient;

  let ownerToken: string;
  let ownerUserId: string;
  let householdId: string;
  let childId: string;
  /** 정식 선택 가능 카테고리 셋(시드 12 중 앞의 셋) — 예산 축의 기본 모집단. */
  let formalIds: string[] = [];
  let inactiveCategoryId: string;

  beforeAll(async () => {
    process.env.JWT_ACCESS_SECRET = "test-access-secret";
    process.env.JWT_REFRESH_SECRET = "test-refresh-secret";

    prisma = new PrismaClient();
    moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApiApp(app);
    await app.init();

    ownerToken = await login(app, "r102-category-budget-owner");
    const me = await whoAmI(app, ownerToken);
    ownerUserId = me.userId;
    householdId = me.householdId;
    childId = await createChildWithConsents(app, ownerToken, householdId);

    const categories = (
      await request(app.getHttpServer())
        .get("/api/v1/categories")
        .set("Authorization", `Bearer ${ownerToken}`)
        .expect(200)
    ).body.categories as Array<{ id: string }>;
    formalIds = categories.slice(0, 3).map((category) => category.id);

    // §6.5 경계용 비활성 카테고리 — 운영자가 숨긴 행의 대역. afterAll이 지운다(위 머리말).
    inactiveCategoryId = (
      await prisma.category.create({
        data: {
          code: `r102_inactive_${randomUUID().slice(0, 8)}`,
          name: "숨김경계",
          active: false,
          selectable: false,
          isSystem: false,
          displayOrder: 5000
        }
      })
    ).id;
  });

  afterAll(async () => {
    const childIds = (await prisma.child.findMany({ where: { householdId }, select: { id: true } })).map(
      (child) => child.id
    );
    const budgetIds = (
      await prisma.budget.findMany({ where: { childId: { in: childIds } }, select: { id: true } })
    ).map((budget) => budget.id);
    // 공유 DB에 감사 행을 남기지 않는다(onboarding.e2e의 budget.upsert 테스트와 같은 관례).
    await prisma.auditLog.deleteMany({ where: { targetId: { in: budgetIds } } });
    // budgets는 FK 캐스케이드가 없으므로(000001) 아이보다 먼저 걷어낸다.
    // category_budgets는 child_id ON DELETE CASCADE(000023)라 child 삭제가 함께 지운다 —
    // 그 정리 경로 자체가 검증 대상이라 직접 지우지 않는다(잔존 단언은 캐스케이드 테스트).
    await prisma.budget.deleteMany({ where: { childId: { in: childIds } } });
    await prisma.childItemStatus.deleteMany({ where: { childId: { in: childIds } } });
    await prisma.expense.deleteMany({ where: { childId: { in: childIds } } });
    await prisma.child.deleteMany({ where: { id: { in: childIds } } });
    await prisma.category.deleteMany({ where: { id: inactiveCategoryId } });
    await prisma.$disconnect();
    await app.close();
  });

  function putBudget(body: Record<string, unknown>, token = ownerToken) {
    return request(app.getHttpServer())
      .put(`/api/v1/children/${childId}/budget`)
      .set("Authorization", `Bearer ${token}`)
      .send(body);
  }

  async function getBudget(yearMonth: string, token = ownerToken) {
    return (
      await request(app.getHttpServer())
        .get(`/api/v1/children/${childId}/budget?yearMonth=${yearMonth}`)
        .set("Authorization", `Bearer ${token}`)
        .expect(200)
    ).body;
  }

  async function dbRows(yearMonth: string) {
    const rows = await prisma.categoryBudget.findMany({
      where: { childId, yearMonth: new Date(`${yearMonth}T00:00:00.000Z`) },
      select: { categoryId: true, amountKrw: true }
    });
    return sortedAsc(rows);
  }

  it("replace-set(§2.2): 필드 존재 = 집합 교체(정렬 응답·행 삭제 포함), 빈 배열 = 전부 해제, GET은 항상 categoryBudgets를 싣는다", async () => {
    const [a, b, c] = formalIds;
    // 입력을 일부러 역순으로 — 응답·GET·DB 전부 categoryId 오름차순이어야 한다(§2.3).
    const first = sortedAsc([
      { categoryId: b, amountKrw: 80000 },
      { categoryId: a, amountKrw: 120000 }
    ]);
    await putBudget({ yearMonth: "2026-07", amountKrw: 300000, categoryBudgets: [...first].reverse() })
      .expect(200)
      .expect(({ body }) => {
        // 기존 계약 통과(additive) + 가산 필드가 정렬돼 실린다.
        budgetSchema.parse(body);
        expect(body).toMatchObject({ childId, yearMonth: "2026-07-01", amountKrw: 300000 });
        expect(body.categoryBudgets).toEqual(first);
      });
    expect((await getBudget("2026-07")).categoryBudgets).toEqual(first);
    expect(await dbRows("2026-07-01")).toEqual(first);

    // 교체: a 금액 변경 · b 탈락 · c 신규 — 배열에 없는 기존 행(b)은 삭제된다.
    const second = sortedAsc([
      { categoryId: a, amountKrw: 150000 },
      { categoryId: c, amountKrw: 50000 }
    ]);
    await putBudget({ yearMonth: "2026-07", amountKrw: 300000, categoryBudgets: second }).expect(200);
    expect(await dbRows("2026-07-01")).toEqual(second);
    expect((await getBudget("2026-07")).categoryBudgets).toEqual(second);

    // 빈 배열 = 그 달 전부 해제(행 단위 DELETE 엔드포인트가 필요 없는 이유).
    await putBudget({ yearMonth: "2026-07", amountKrw: 300000, categoryBudgets: [] })
      .expect(200)
      .expect(({ body }) => expect(body.categoryBudgets).toEqual([]));
    expect(await dbRows("2026-07-01")).toEqual([]);
    // 해제 후에도 GET 200은 빈 배열을 **항상** 싣는다(§2.3).
    expect((await getBudget("2026-07")).categoryBudgets).toEqual([]);
  });

  it("필드 부재 = 무접촉(R5): 구클라이언트형 PUT은 총액만 바꾸고 카테고리 행을 한 건도 건드리지 않는다", async () => {
    const kept = sortedAsc([
      { categoryId: formalIds[0], amountKrw: 70000 },
      { categoryId: formalIds[1], amountKrw: 30000 }
    ]);
    await putBudget({ yearMonth: "2026-08", amountKrw: 200000, categoryBudgets: kept }).expect(200);

    // categoryBudgets 필드가 없는 저장(온보딩 예산 화면·구클라이언트의 그 본문).
    await putBudget({ yearMonth: "2026-08", amountKrw: 250000 })
      .expect(200)
      .expect(({ body }) => {
        expect(body.amountKrw).toBe(250000);
        // 무접촉 갈래는 카테고리 행을 읽지도 않으므로(§2.2) 응답에 키 자체가 없다 —
        // 계약(T2)의 optional이 이 갈래를 통과시킨다.
        expect(body).not.toHaveProperty("categoryBudgets");
      });
    expect(await dbRows("2026-08-01")).toEqual(kept);
    const after = await getBudget("2026-08");
    expect(after.amountKrw).toBe(250000);
    expect(after.categoryBudgets).toEqual(kept);
  });

  it("총액 없는 달 404 불변(R3, §1.3(b)): GET은 종전 BUDGET_NOT_FOUND 그대로다", async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/children/${childId}/budget?yearMonth=2031-01`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .expect(404)
      .expect(({ body }) => {
        errorResponseSchema.parse(body);
        expect(body.error.code).toBe("BUDGET_NOT_FOUND");
      });
    // 존재 종속은 DTO 구조가 진다: amountKrw(총액)는 종전대로 필수라 "총액 없는 달의
    // 카테고리 예산"은 요청 형태상 만들 수 없다. (부재 값은 @IsInt/@Min/@Max 전부에
    // 걸리고, 그중 max 위반이 P2-6 규칙으로 EXPENSE_AMOUNT_TOO_LARGE로 승격된다 —
    // 이 검증의 계약은 코드가 아니라 400 거절 + 행 무생성이다.)
    await putBudget({ yearMonth: "2031-01", categoryBudgets: [{ categoryId: formalIds[0], amountKrw: 10000 }] })
      .expect(400);
    expect(await dbRows("2031-01-01")).toEqual([]);
  });

  it("검증(§2.2·§9.3): 중복 id·금액 0은 VALIDATION_ERROR, 미존재/비활성은 CATEGORY_BUDGET_INVALID_CATEGORY(부분 적용 없음), 상한 초과는 CATEGORY_BUDGET_LIMIT_EXCEEDED, 상한 초과 금액은 EXPENSE_AMOUNT_TOO_LARGE", async () => {
    const existing = sortedAsc([{ categoryId: formalIds[2], amountKrw: 40000 }]);
    await putBudget({ yearMonth: "2026-09", amountKrw: 100000, categoryBudgets: existing }).expect(200);

    // 배열 내 categoryId 중복 = DTO 형식 위반.
    await putBudget({
      yearMonth: "2026-09",
      amountKrw: 100000,
      categoryBudgets: [
        { categoryId: formalIds[0], amountKrw: 10000 },
        { categoryId: formalIds[0], amountKrw: 20000 }
      ]
    })
      .expect(400)
      .expect(({ body }) => expect(body.error.code).toBe("VALIDATION_ERROR"));

    // 0원 예산은 존재하지 않는다(§1.2 — 부재가 곧 미설정).
    await putBudget({
      yearMonth: "2026-09",
      amountKrw: 100000,
      categoryBudgets: [{ categoryId: formalIds[0], amountKrw: 0 }]
    })
      .expect(400)
      .expect(({ body }) => expect(body.error.code).toBe("VALIDATION_ERROR"));

    // 중첩 금액도 총액과 같은 단일 상한 한 벌(GAP-054 #2) — 같은 전용 코드로 갈린다.
    await putBudget({
      yearMonth: "2026-09",
      amountKrw: 100000,
      categoryBudgets: [{ categoryId: formalIds[0], amountKrw: MONEY_KRW_MAX + 1 }]
    })
      .expect(400)
      .expect(({ body }) => expect(body.error.code).toBe("EXPENSE_AMOUNT_TOO_LARGE"));

    // 미존재 카테고리 — 전체 거절이라 유효한 행(formalIds[0])도 적용되지 않는다.
    await putBudget({
      yearMonth: "2026-09",
      amountKrw: 100000,
      categoryBudgets: [
        { categoryId: formalIds[0], amountKrw: 10000 },
        { categoryId: randomUUID(), amountKrw: 20000 }
      ]
    })
      .expect(400)
      .expect(({ body }) => {
        errorResponseSchema.parse(body);
        expect(body.error.code).toBe("CATEGORY_BUDGET_INVALID_CATEGORY");
      });

    // active:false(운영자가 숨긴 행)에는 새로 세울 수 없다(§6.5).
    await putBudget({
      yearMonth: "2026-09",
      amountKrw: 100000,
      categoryBudgets: [{ categoryId: inactiveCategoryId, amountKrw: 20000 }]
    })
      .expect(400)
      .expect(({ body }) => expect(body.error.code).toBe("CATEGORY_BUDGET_INVALID_CATEGORY"));

    // 상한 30 초과(§1.4) — 상한 검사는 실재 검사 앞이라 id는 아무 uuid여도 같은 답이다.
    await putBudget({
      yearMonth: "2026-09",
      amountKrw: 100000,
      categoryBudgets: Array.from({ length: CATEGORY_BUDGET_MAX_PER_MONTH + 1 }, () => ({
        categoryId: randomUUID(),
        amountKrw: 10000
      }))
    })
      .expect(400)
      .expect(({ body }) => expect(body.error.code).toBe("CATEGORY_BUDGET_LIMIT_EXCEEDED"));

    // 거절된 요청들은 아무것도 바꾸지 않았고(부분 적용 없음), 총액도 그대로다.
    expect(await dbRows("2026-09-01")).toEqual(existing);
    expect((await getBudget("2026-09")).amountKrw).toBe(100000);

    // selectable은 보지 않는다(§2.2): 별칭 행(active:true·selectable:false)은 지출의
    // categoryId 검증과 같은 선에서 허용된다.
    await putBudget({
      yearMonth: "2026-09",
      amountKrw: 100000,
      categoryBudgets: [{ categoryId: ALIAS_DIAPER_ID, amountKrw: 15000 }]
    })
      .expect(200)
      .expect(({ body }) => expect(body.categoryBudgets).toEqual([{ categoryId: ALIAS_DIAPER_ID, amountKrw: 15000 }]));
  });

  it("권한(§2.7): viewer 쓰기는 403 FORBIDDEN(행 무접촉), 읽기는 구성원 전원 — categoryBudgets 포함", async () => {
    const rows = sortedAsc([{ categoryId: formalIds[0], amountKrw: 60000 }]);
    await putBudget({ yearMonth: "2026-10", amountKrw: 150000, categoryBudgets: rows }).expect(200);

    const viewerToken = await login(app, "r102-category-budget-viewer");
    const viewer = await whoAmI(app, viewerToken);
    await prisma.householdMember.create({
      data: { householdId, userId: viewer.userId, role: "viewer", status: "active", joinedAt: new Date() }
    });

    await putBudget({ yearMonth: "2026-10", amountKrw: 999000, categoryBudgets: [] }, viewerToken)
      .expect(403)
      .expect(({ body }) => {
        errorResponseSchema.parse(body);
        expect(body.error.code).toBe("FORBIDDEN");
      });
    // 거절된 쓰기는 총액도 카테고리 행도 바꾸지 않았다.
    expect(await dbRows("2026-10-01")).toEqual(rows);

    const seen = await getBudget("2026-10", viewerToken);
    expect(seen.amountKrw).toBe(150000);
    expect(seen.categoryBudgets).toEqual(rows);
  });

  it("멱등(§2.7): 같은 키+같은 본문 재전송은 첫 응답 재생이고 행 집합이 그대로다(replace-set 자연 멱등)", async () => {
    const key = `r102-${randomUUID()}`;
    const body = {
      yearMonth: "2026-11",
      amountKrw: 180000,
      categoryBudgets: sortedAsc([
        { categoryId: formalIds[0], amountKrw: 90000 },
        { categoryId: formalIds[1], amountKrw: 45000 }
      ])
    };

    const first = (await putBudget(body).set("Idempotency-Key", key).expect(200)).body;
    const replayed = (await putBudget(body).set("Idempotency-Key", key).expect(200)).body;
    expect(replayed).toEqual(first);
    expect(await dbRows("2026-11-01")).toEqual(body.categoryBudgets);
    expect(await prisma.categoryBudget.count({ where: { childId, yearMonth: new Date("2026-11-01T00:00:00.000Z") } })).toBe(2);
  });

  it("감사 봉투 가산(§2.6): 필드가 있으면 before/after에 categoryBudgets(오름차순), 없으면 종전 세 키 그대로 — action은 budget.upsert 하나다", async () => {
    // 다른 테스트의 봉투와 섞이지 않게 전용 아이로 처음부터 기록한다.
    const auditChildId = (
      await request(app.getHttpServer())
        .post("/api/v1/children")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ householdId, nickname: "봉투둥이", stageMode: "manual", manualStage: "newborn_0_3" })
        .expect(200)
    ).body.id as string;
    const put = (body: Record<string, unknown>) =>
      request(app.getHttpServer())
        .put(`/api/v1/children/${auditChildId}/budget`)
        .set("Authorization", `Bearer ${ownerToken}`)
        .send(body);

    const firstSet = sortedAsc([
      { categoryId: formalIds[0], amountKrw: 50000 },
      { categoryId: formalIds[1], amountKrw: 25000 }
    ]);
    const secondSet = sortedAsc([{ categoryId: formalIds[2], amountKrw: 33000 }]);
    // 1) 첫 설정(필드 있음) — before는 null 그대로(첫 설정이라는 정보 유지).
    await put({ yearMonth: "2026-07", amountKrw: 300000, categoryBudgets: firstSet }).expect(200);
    // 2) 덮어쓰기(필드 있음) — before가 직전 집합을 진다.
    await put({ yearMonth: "2026-07", amountKrw: 280000, categoryBudgets: secondSet }).expect(200);
    // 3) 필드 없는 저장 — 봉투는 종전과 바이트 단위로 같다(기존 감사 화면·테스트 무접촉).
    await put({ yearMonth: "2026-07", amountKrw: 260000 }).expect(200);

    const budgetRow = await prisma.budget.findFirst({ where: { childId: auditChildId } });
    expect(budgetRow).not.toBeNull();
    const rows = await prisma.auditLog.findMany({
      where: { action: "budget.upsert", targetId: budgetRow!.id },
      orderBy: { createdAt: "asc" }
    });
    expect(rows).toHaveLength(3);

    expect(rows[0]!.beforeJson).toBeNull();
    expect(rows[0]!.afterJson).toEqual({
      childId: auditChildId,
      yearMonth: "2026-07-01",
      amountKrw: 300000,
      categoryBudgets: firstSet
    });
    expect(rows[1]!.beforeJson).toEqual({
      childId: auditChildId,
      yearMonth: "2026-07-01",
      amountKrw: 300000,
      categoryBudgets: firstSet
    });
    expect(rows[1]!.afterJson).toEqual({
      childId: auditChildId,
      yearMonth: "2026-07-01",
      amountKrw: 280000,
      categoryBudgets: secondSet
    });
    // 필드가 없던 저장의 봉투 — 키는 종전 셋뿐이다(카테고리 행을 읽지도 않는다, R5).
    expect(rows[2]!.beforeJson).toEqual({ childId: auditChildId, yearMonth: "2026-07-01", amountKrw: 280000 });
    expect(rows[2]!.afterJson).toEqual({ childId: auditChildId, yearMonth: "2026-07-01", amountKrw: 260000 });
    for (const envelope of [rows[2]!.beforeJson, rows[2]!.afterJson]) {
      expect(Object.keys(envelope as Record<string, unknown>).sort()).toEqual(["amountKrw", "childId", "yearMonth"]);
    }
    expect(rows.every((row) => row.actorUserId === ownerUserId && row.targetType === "budget")).toBe(true);

    // 공유 DB에 남기지 않는다(라운드 45 오염 사고 재발 차단).
    await prisma.auditLog.deleteMany({ where: { targetId: budgetRow!.id } });
  });

  it("월간 리포트 가산(§2.4): 그 달 행이 categoryId 오름차순으로 실리고, 없는 달은 []다", async () => {
    const rows = sortedAsc([
      { categoryId: formalIds[0], amountKrw: 110000 },
      { categoryId: formalIds[2], amountKrw: 44000 }
    ]);
    await putBudget({ yearMonth: "2026-12", amountKrw: 400000, categoryBudgets: rows }).expect(200);

    await request(app.getHttpServer())
      .get(`/api/v1/children/${childId}/reports/monthly?yearMonth=2026-12`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .expect(200)
      .expect(({ body }) => {
        reportMonthlySchema.parse(body);
        expect(body.budgetAmountKrw).toBe(400000);
        expect(body.categoryBudgets).toEqual(rows);
      });

    // 카테고리 예산이 없는 달(총액 유무와 무관)은 빈 배열 — 없는 사실을 지어내지 않는다.
    await request(app.getHttpServer())
      .get(`/api/v1/children/${childId}/reports/monthly?yearMonth=2031-02`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.budgetAmountKrw).toBeNull();
        expect(body.categoryBudgets).toEqual([]);
      });
  });

  it("아이 물리 삭제 시 category_budgets가 FK CASCADE로 함께 사라진다(고아 0 — §1.5)", async () => {
    const cascadeChildId = (
      await request(app.getHttpServer())
        .post("/api/v1/children")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ householdId, nickname: "고아검증둥이", stageMode: "manual", manualStage: "newborn_0_3" })
        .expect(200)
    ).body.id as string;
    await request(app.getHttpServer())
      .put(`/api/v1/children/${cascadeChildId}/budget`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        yearMonth: "2026-07",
        amountKrw: 100000,
        categoryBudgets: [{ categoryId: formalIds[0], amountKrw: 30000 }]
      })
      .expect(200);
    expect(await prisma.categoryBudget.count({ where: { childId: cascadeChildId } })).toBe(1);

    // 파기 잡의 purgeChildRows와 같은 물리 삭제 경로(child.deleteMany) — 000023의
    // ON DELETE CASCADE가 함께 지우므로 잡 코드에 새 deleteMany phase가 필요 없다(§1.5).
    // budgets는 FK 캐스케이드가 없어 종전대로 잡이 명시적으로 지운다 — 여기서도 먼저 걷고,
    // 그 봉투(감사 행)도 함께 걷는다(공유 DB 오염 방지 — afterAll은 지워진 budget id를 모른다).
    const cascadeBudgetIds = (
      await prisma.budget.findMany({ where: { childId: cascadeChildId }, select: { id: true } })
    ).map((budget) => budget.id);
    await prisma.auditLog.deleteMany({ where: { targetId: { in: cascadeBudgetIds } } });
    await prisma.budget.deleteMany({ where: { childId: cascadeChildId } });
    await prisma.child.deleteMany({ where: { id: cascadeChildId } });
    expect(await prisma.categoryBudget.count({ where: { childId: cascadeChildId } })).toBe(0);
  });
});
