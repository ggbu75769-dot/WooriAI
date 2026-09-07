import type { INestApplication } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import request from "supertest";
import { errorResponseSchema, listCategoriesResponseSchema } from "@wooriai/contracts";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AppModule } from "../src/app.module";
import { configureApiApp } from "../src/bootstrap";
import {
  customCategoryMaxPerHousehold,
  customCategoryNameMaxLength
} from "../src/finance/dto/custom-categories.dto";

/**
 * 라운드 103 T1 — 커스텀 지출 분류 e2e.
 * 설계: docs/5차/round103-custom-expense-category-design.md (§2 계약 · §9 확정 · §10 검증 계획).
 *
 * 무는 것(설계 §8의 T1 행 전수): CRUD(생성·이름변경·보관·복원) · 권한(viewer 403 · 비구성원
 * 403 · 타 가구 404) · 멱등 재제출 · 한도 15(보관 포함) · 이름 중복(**시드 21행 이름 — 별칭
 * 포함**) · `GET /categories` 합류와 includeAll 갈래 · **보관 후 지출 무변경 + 이름 계속 해석** ·
 * 지출/예산/가져오기 확정의 타 가구 거절 · 어드민 무오염 · 감사 봉투(이름 미기록).
 * 파기 캐스케이드는 이 파일이 아니라 배타 스위트 `data-retention-purge.db.test.ts`의 라운드
 * 103 단언이 증명한다 — 파기 잡은 DB 전역을 지우므로 병렬 스위트에서 돌릴 수 없다.
 *
 * ⚠️ `packages/contracts`의 **신규 심볼을 import하지 않는다**(설계 §8 비고 — T2와 독립).
 * 쓰는 계약 심볼은 이 라운드 이전부터 있던 둘(`listCategoriesResponseSchema` ·
 * `errorResponseSchema`)뿐이고, 가산 필드 `householdId`는 **원본 응답 바디**에서 확인한다
 * (zod 객체는 모르는 키를 떨구므로 parse 결과로 물으면 그 필드가 유령이 된다).
 *
 * 데이터 격리: 자기 oauth-login으로 만든 사용자/가구/아이와, **그 가구가 소유한**
 * `categories` 행만 만들고 읽는다(test-db.ts 하단 관례). 커스텀 행은 `household_id`가
 * NOT NULL이라 다른 스위트의 `GET /categories`·`GET /admin/categories`에서 구조적으로
 * 보이지 않는다 — 시드 21행을 고정하는 `categories.e2e`(배타 스위트)와 겹쳐도 안전한 이유가
 * 그것이고, 이 스위트가 그 사실 자체를 단언으로 문다.
 */

/** 시드 21행 중 이름 충돌 모집단의 대표 셋 — 정식 · 모바일 퀵타일 별칭 · 가져오기 스텁. */
const SEED_NAME_FORMAL = "기저귀/위생";
const SEED_NAME_ALIAS = "기저귀";
const SEED_NAME_IMPORT_STUB = "가져오기 기본";

type CategoryBody = {
  id: string;
  code: string;
  name: string;
  iconName: string | null;
  displayOrder: number;
  isSystem: boolean;
  active: boolean;
  selectable: boolean;
  householdId?: string;
};

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

async function createChildWithConsents(
  app: INestApplication,
  accessToken: string,
  householdId: string,
  nickname: string
) {
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
      .send({ householdId, nickname, stageMode: "manual", manualStage: "newborn_0_3" })
      .expect(200)
  ).body.id as string;
}

describe("Custom expense categories API (라운드 103 T1)", () => {
  let app: INestApplication;
  let moduleRef: TestingModule;
  let prisma: PrismaClient;

  /** 가구 A — 이 스위트의 주인공. */
  let ownerToken: string;
  let ownerUserId: string;
  let householdId: string;
  let childId: string;
  /** 가구 B — 교차 가구 경계(R1)의 반대편. */
  let otherToken: string;
  let otherHouseholdId: string;
  /** 가구 A의 viewer — 쓰기 403의 반대편(§2.4). */
  let viewerToken: string;

  beforeAll(async () => {
    process.env.JWT_ACCESS_SECRET = "test-access-secret";
    process.env.JWT_REFRESH_SECRET = "test-refresh-secret";
    // 어드민 무오염(R6)을 HTTP로 묻기 위한 dev/test 전용 레거시 게이트
    // (admin-idempotency.e2e.test.ts와 같은 관례 — 쿠키 세션 + TOTP 등록 없이 admin 경로를 탄다).
    process.env.WOORIAI_ADMIN_TOKEN = "test-r103-admin-token";

    prisma = new PrismaClient();
    moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApiApp(app);
    await app.init();

    ownerToken = await login(app, "r103-custom-category-owner");
    const me = await whoAmI(app, ownerToken);
    ownerUserId = me.userId;
    householdId = me.householdId;
    childId = await createChildWithConsents(app, ownerToken, householdId, "분류둥이");

    otherToken = await login(app, "r103-custom-category-other");
    const other = await whoAmI(app, otherToken);
    otherHouseholdId = other.householdId;
    // 가구 B에도 아이를 둔다 — 교차 가구 경계가 "빈 껍데기 가구"에서만 성립하지 않게(afterAll이 걷는다).
    await createChildWithConsents(app, otherToken, otherHouseholdId, "옆집둥이");

    viewerToken = await login(app, "r103-custom-category-viewer");
    const viewer = await whoAmI(app, viewerToken);
    await prisma.householdMember.create({
      data: { householdId, userId: viewer.userId, role: "viewer", status: "active", joinedAt: new Date() }
    });
  });

  afterAll(async () => {
    const householdIds = [householdId, otherHouseholdId];
    const childIds = (
      await prisma.child.findMany({ where: { householdId: { in: householdIds } }, select: { id: true } })
    ).map((child) => child.id);
    // 000001의 FK 순서대로 안쪽부터: categories를 가리키는 행을 먼저 걷어낸 뒤 분류 행을 지운다
    // (`expenses.category_id`·`import_rows.category_id`·`category_budgets.category_id`는
    //  캐스케이드 없는 FK다 — 그 사실이 이 라운드 설계 §1.1의 출발점이기도 하다).
    const jobIds = (
      await prisma.importJob.findMany({ where: { childId: { in: childIds } }, select: { id: true } })
    ).map((job) => job.id);
    await prisma.importRow.deleteMany({ where: { importJobId: { in: jobIds } } });
    await prisma.importJob.deleteMany({ where: { id: { in: jobIds } } });
    await prisma.expense.deleteMany({ where: { childId: { in: childIds } } });
    await prisma.categoryBudget.deleteMany({ where: { childId: { in: childIds } } });
    await prisma.budget.deleteMany({ where: { childId: { in: childIds } } });
    await prisma.childItemStatus.deleteMany({ where: { childId: { in: childIds } } });
    await prisma.child.deleteMany({ where: { id: { in: childIds } } });
    await prisma.auditLog.deleteMany({ where: { householdId: { in: householdIds } } });
    // 커스텀 분류 행. 가구를 지우면 000024의 ON DELETE CASCADE가 함께 지우지만, 이 스위트는
    // 가구를 남기므로 명시로 걷는다(파기 캐스케이드 자체는 파기 스위트가 증명한다).
    await prisma.category.deleteMany({ where: { householdId: { in: householdIds } } });
    await prisma.$disconnect();
    await app.close();
  });

  // ---------------------------------------------------------------- helpers

  function createRequest(name: string, token = ownerToken, targetHouseholdId = householdId) {
    return request(app.getHttpServer())
      .post(`/api/v1/households/${targetHouseholdId}/categories`)
      .set("Authorization", `Bearer ${token}`)
      .send({ name });
  }

  async function createCategory(
    name: string,
    token = ownerToken,
    targetHouseholdId = householdId
  ): Promise<CategoryBody> {
    return (await createRequest(name, token, targetHouseholdId).expect(200)).body as CategoryBody;
  }

  function patchRequest(
    categoryId: string,
    body: Record<string, unknown>,
    token = ownerToken,
    targetHouseholdId = householdId
  ) {
    return request(app.getHttpServer())
      .patch(`/api/v1/households/${targetHouseholdId}/categories/${categoryId}`)
      .set("Authorization", `Bearer ${token}`)
      .send(body);
  }

  async function listCategories(token = ownerToken, query = ""): Promise<CategoryBody[]> {
    const response = await request(app.getHttpServer())
      .get(`/api/v1/categories${query}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    // 계약(구 심볼)으로 모양을 한 번 확인하고, 가산 필드는 **원본 바디**에서 읽는다.
    listCategoriesResponseSchema.parse(response.body);
    return response.body.categories as CategoryBody[];
  }

  function uniqueName(label: string) {
    return `${label}-${randomUUID().slice(0, 8)}`;
  }

  // ---------------------------------------------------------------- CRUD · 합류

  it("생성 → GET /categories 합류 → 이름 변경 → 보관 → 복원이 §9.2 모양 그대로 왕복한다", async () => {
    const name = uniqueName("산후도우미");
    const created = await createCategory(name);

    // §2.3의 서버 결정값 전수: 요청은 이름 하나만 정한다.
    expect(created.name).toBe(name);
    expect(created.code.startsWith("custom_")).toBe(true);
    expect(created.code).toHaveLength("custom_".length + 32); // 32hex — 전역 UNIQUE varchar(50) 안
    expect(created.isSystem).toBe(false);
    expect(created.active).toBe(true);
    expect(created.selectable).toBe(true);
    expect(created.iconName).toBeNull(); // 아이콘·색은 주지 않는다(§1.5)
    expect(created.householdId).toBe(householdId);
    // 시드 대역(정식 10~999 · 별칭·스텁 1001~1009)보다 큰 자리 — 언제나 시드 뒤에 선다(§1.7).
    expect(created.displayOrder).toBe(2000);

    // 기본 목록에 정상 항목으로 합류하고, 시드 뒤에 선다.
    const listed = await listCategories();
    const mine = listed.find((category) => category.id === created.id);
    expect(mine).toMatchObject({ name, isSystem: false, active: true, selectable: true, householdId });
    expect(listed[listed.length - 1]!.id).toBe(created.id);
    const orders = listed.map((category) => category.displayOrder);
    expect(orders).toEqual([...orders].sort((left, right) => left - right));
    // 시드 행에는 householdId 키 자체가 없다(§2.2의 가산 필드 규칙).
    const seedRow = listed.find((category) => category.code === "diaper_hygiene")!;
    expect("householdId" in seedRow).toBe(false);

    // 이름 변경(오타 교정의 정답 — §1.6).
    const renamed = uniqueName("산후도우미비");
    const patched = (await patchRequest(created.id, { name: `  ${renamed}  ` }).expect(200)).body as CategoryBody;
    expect(patched).toMatchObject({ id: created.id, code: created.code, name: renamed, active: true });

    // 보관: 행·id·code는 그대로이고 기본 목록에서만 빠진다.
    const archived = (await patchRequest(created.id, { active: false }).expect(200)).body as CategoryBody;
    expect(archived).toMatchObject({ id: created.id, code: created.code, name: renamed, active: false });
    expect((await listCategories()).some((category) => category.id === created.id)).toBe(false);
    // ?includeAll=1에는 남는다 — 보관해도 이름은 영원히 해석된다(§1.6 · R28-F3의 규칙 재사용).
    const all = await listCategories(ownerToken, "?includeAll=1");
    expect(all.find((category) => category.id === created.id)).toMatchObject({ name: renamed, active: false });

    // 복원.
    const restored = (await patchRequest(created.id, { active: true }).expect(200)).body as CategoryBody;
    expect(restored.active).toBe(true);
    expect((await listCategories()).some((category) => category.id === created.id)).toBe(true);

    // DELETE는 존재하지 않는다(§1.6 — 지우지 않는 동사에 그 메서드를 붙이지 않는다).
    await request(app.getHttpServer())
      .delete(`/api/v1/households/${householdId}/categories/${created.id}`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .expect(404);
    expect(await prisma.category.findUnique({ where: { id: created.id } })).not.toBeNull();
  });

  // ------------------------------------------------- 보관 후 지출 무변경(§1.6의 본론)

  it("보관해도 그 분류의 지출은 한 바이트도 바뀌지 않고 이름이 계속 해석된다", async () => {
    const name = uniqueName("돌잔치");
    const category = await createCategory(name);

    const expenseId = (
      await request(app.getHttpServer())
        .post(`/api/v1/children/${childId}/expenses`)
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({
          categoryId: category.id,
          amountKrw: 480000,
          spentOn: "2026-07-06",
          itemName: "돌잔치 대관료",
          paymentMethod: "card"
        })
        .expect(200)
    ).body.id as string;

    const before = await prisma.expense.findUniqueOrThrow({ where: { id: expenseId } });

    await patchRequest(category.id, { active: false }).expect(200);

    // ⓐ 지출 행이 바이트 그대로다 — 재배정도, updated_at 갱신도, soft delete도 없다.
    expect(await prisma.expense.findUniqueOrThrow({ where: { id: expenseId } })).toEqual(before);

    // ⓑ 목록·리포트가 그 id로 계속 잡는다(집계 술어 무접촉).
    await request(app.getHttpServer())
      .get(`/api/v1/children/${childId}/expenses?yearMonth=2026-07`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .expect(200)
      .expect(({ body }) => {
        const match = (body.expenses as Array<{ id: string; categoryId: string }>).find(
          (expense) => expense.id === expenseId
        );
        expect(match?.categoryId).toBe(category.id);
      });
    await request(app.getHttpServer())
      .get(`/api/v1/children/${childId}/reports/category?yearMonth=2026-07`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.categories).toContainEqual({ categoryId: category.id, amountKrw: 480000, count: 1 });
      });

    // ⓒ 이름은 ?includeAll=1이 계속 해석하고, 기본 목록(= 새로 고를 목록)에서만 빠졌다.
    expect(
      (await listCategories(ownerToken, "?includeAll=1")).find((entry) => entry.id === category.id)?.name
    ).toBe(name);
    expect((await listCategories()).some((entry) => entry.id === category.id)).toBe(false);

    // ⓓ 보관은 되돌릴 수 있는 조작이다 — "삭제"라는 말을 쓰지 않는 근거의 절반(§1.6).
    await patchRequest(category.id, { active: true }).expect(200);
    expect((await listCategories()).some((entry) => entry.id === category.id)).toBe(true);
  });

  // ------------------------------------------------------------- 교차 가구(R1)

  it("타 가구의 커스텀 분류는 목록·지출 저장·지출 수정·예산·가져오기 확정 어디에도 서지 않는다", async () => {
    const foreign = await createCategory(uniqueName("옆집분류"), otherToken, otherHouseholdId);
    expect(foreign.householdId).toBe(otherHouseholdId);

    // ⓐ 목록: 기본에도 전량에도 없다(양쪽 갈래 모두).
    for (const query of ["", "?includeAll=1"]) {
      expect((await listCategories(ownerToken, query)).some((entry) => entry.id === foreign.id)).toBe(false);
    }

    // ⓑ 지출 저장: 종전과 같은 400 EXPENSE_CATEGORY_INVALID — 그 사람에게 그 분류는 실제로
    //    존재하지 않는다(§2.6 — 새 에러 코드 0건).
    await request(app.getHttpServer())
      .post(`/api/v1/children/${childId}/expenses`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        categoryId: foreign.id,
        amountKrw: 10000,
        spentOn: "2026-07-06",
        itemName: "남의 분류로 기록 시도",
        paymentMethod: "card"
      })
      .expect(400)
      .expect(({ body }) => {
        errorResponseSchema.parse(body);
        expect(body.error.code).toBe("EXPENSE_CATEGORY_INVALID");
      });

    // ⓒ 지출 수정: 같은 코드로 거절된다(자기 분류로 만든 행을 남의 분류로 옮길 수 없다).
    const own = await createCategory(uniqueName("우리분류"));
    const expenseId = (
      await request(app.getHttpServer())
        .post(`/api/v1/children/${childId}/expenses`)
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({
          categoryId: own.id,
          amountKrw: 20000,
          spentOn: "2026-07-06",
          itemName: "수정 경계용",
          paymentMethod: "card"
        })
        .expect(200)
    ).body.id as string;
    await request(app.getHttpServer())
      .patch(`/api/v1/expenses/${expenseId}`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ categoryId: foreign.id })
      .expect(400)
      .expect(({ body }) => expect(body.error.code).toBe("EXPENSE_CATEGORY_INVALID"));
    expect((await prisma.expense.findUniqueOrThrow({ where: { id: expenseId } })).categoryId).toBe(own.id);

    // ⓓ 카테고리 예산: 라운드 102의 코드 그대로 거절되고, **자기 가구 커스텀에는 세워진다**
    //    (`category_budgets.category_id`가 같은 표를 가리키므로 마이그레이션 0건 — 설계 §5).
    await request(app.getHttpServer())
      .put(`/api/v1/children/${childId}/budget`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        yearMonth: "2026-07",
        amountKrw: 500000,
        categoryBudgets: [{ categoryId: foreign.id, amountKrw: 100000 }]
      })
      .expect(400)
      .expect(({ body }) => expect(body.error.code).toBe("CATEGORY_BUDGET_INVALID_CATEGORY"));
    await request(app.getHttpServer())
      .put(`/api/v1/children/${childId}/budget`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        yearMonth: "2026-07",
        amountKrw: 500000,
        categoryBudgets: [{ categoryId: own.id, amountKrw: 100000 }]
      })
      .expect(200)
      .expect(({ body }) => {
        expect(body.categoryBudgets).toEqual([{ categoryId: own.id, amountKrw: 100000 }]);
      });

    // ⓔ 가져오기 확정: 검수에서 남의 분류 id를 심어도 확정이 같은 코드로 거절한다(§1.9 #7).
    const job = (
      await request(app.getHttpServer())
        .post(`/api/v1/children/${childId}/imports/excel`)
        .set("Authorization", `Bearer ${ownerToken}`)
        .field("fileName", "r103-import.csv")
        .attach("file", Buffer.from("날짜,적요,금액\n2026-07-06,기저귀 구매,32000\n", "utf8"), "r103-import.csv")
        .expect(200)
    ).body as { id: string };
    const rows = (
      await request(app.getHttpServer())
        .get(`/api/v1/imports/${job.id}/rows`)
        .set("Authorization", `Bearer ${ownerToken}`)
        .expect(200)
    ).body.rows as Array<{ id: string }>;
    // 행 수정은 분류 실재를 묻지 않는다(종전 그대로) — 거절은 확정에서 난다.
    await request(app.getHttpServer())
      .patch(`/api/v1/imports/${job.id}/rows/${rows[0].id}`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ selected: true, categoryId: foreign.id })
      .expect(200);
    await request(app.getHttpServer())
      .post(`/api/v1/imports/${job.id}/confirm`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ selectedRowIds: [rows[0].id] })
      .expect(400)
      .expect(({ body }) => expect(body.error.code).toBe("EXPENSE_CATEGORY_INVALID"));
    // 확정이 롤백됐으므로 그 분류의 지출은 0건이다(부분 적용 없음).
    expect(await prisma.expense.count({ where: { childId, categoryId: foreign.id } })).toBe(0);

    // ⓕ 쓰기 대상으로도 잡히지 않는다: 남의 분류 id는 **404**다(403이 아니다 — 그 사람에게는
    //    "내가 만든 분류"라는 자원이 없고, 존재 신탁을 만들지 않는다는 부수 효과도 얻는다).
    await patchRequest(foreign.id, { name: "빼앗기" })
      .expect(404)
      .expect(({ body }) => {
        errorResponseSchema.parse(body);
        expect(body.error.code).toBe("CUSTOM_CATEGORY_NOT_FOUND");
      });
    expect((await prisma.category.findUniqueOrThrow({ where: { id: foreign.id } })).name).toBe(foreign.name);
  });

  it("시드 행 id·UUID가 아닌 id도 같은 404로 떨어진다 (쓰기 대상은 그 가구의 커스텀 행뿐)", async () => {
    const seed = (await listCategories()).find((entry) => entry.code === "diaper_hygiene")!;
    for (const target of [seed.id, "not-a-uuid", randomUUID()]) {
      await patchRequest(target, { active: false })
        .expect(404)
        .expect(({ body }) => expect(body.error.code).toBe("CUSTOM_CATEGORY_NOT_FOUND"));
    }
    // 시드 행은 한 바이트도 바뀌지 않았다.
    expect((await prisma.category.findUniqueOrThrow({ where: { id: seed.id } })).active).toBe(true);
  });

  // ------------------------------------------------------------------ 권한(§2.4)

  it("viewer의 쓰기는 403이고, 비구성원 가구 id도 403이다 (읽기는 구성원 전원)", async () => {
    const category = await createCategory(uniqueName("권한경계"));

    for (const send of [
      () => createRequest(uniqueName("뷰어생성"), viewerToken),
      () => patchRequest(category.id, { name: uniqueName("뷰어수정") }, viewerToken)
    ]) {
      await send()
        .expect(403)
        .expect(({ body }) => {
          errorResponseSchema.parse(body);
          expect(body.error.code).toBe("FORBIDDEN");
        });
    }
    expect((await prisma.category.findUniqueOrThrow({ where: { id: category.id } })).name).toBe(category.name);

    // 남의 가구 URL로 만들려 해도 가드가 먼저 막는다(가구 멤버십이 없다).
    await createRequest(uniqueName("남의가구"), ownerToken, otherHouseholdId).expect(403);
    expect(await prisma.category.count({ where: { householdId: otherHouseholdId, name: { contains: "남의가구" } } })).toBe(0);

    // ⚠️ 읽기는 좁히지 않는다(§2.4): 보기 전용 참여자도 리포트 범례·CSV에서 이름을 봐야 한다.
    expect((await listCategories(viewerToken)).some((entry) => entry.id === category.id)).toBe(true);
  });

  // -------------------------------------------------------------- 이름 중복(§1.4)

  it("이름 중복은 시드 21행 전량(별칭·스텁 포함)과 자기 가구 커스텀 전량(보관 포함)을 기준으로 거절된다", async () => {
    // ⓐ 시드 이름 — **별칭 이름이 핵심이다.** "기저귀"는 기본 목록에 서지 않지만
    //    (selectable:false), 모바일의 `buildRecordsCategoryChips`는 전량 목록을 훑으므로
    //    같은 이름의 커스텀이 그 별칭 id를 자기 matchIds로 흡수해 무관한 지출을 합계로
    //    끌어온다. DB의 부분 유니크 색인은 이 축을 지키지 못한다(시드는 household_id가
    //    NULL이라 색인 밖) — **서비스 검사가 유일한 방어선**이고, 그 사실이 이 단언이다.
    for (const seedName of [SEED_NAME_FORMAL, SEED_NAME_ALIAS, SEED_NAME_IMPORT_STUB]) {
      await createRequest(seedName)
        .expect(400)
        .expect(({ body }) => {
          errorResponseSchema.parse(body);
          expect(body.error.code).toBe("CUSTOM_CATEGORY_NAME_DUPLICATE");
        });
    }

    // ⓑ 자기 가구의 활성 커스텀 이름.
    const name = uniqueName("조리원추가결제");
    const mine = await createCategory(name);
    await createRequest(name).expect(400).expect(({ body }) => {
      expect(body.error.code).toBe("CUSTOM_CATEGORY_NAME_DUPLICATE");
    });

    // ⓒ 정규화(trim · 내부 연속 공백 1칸 · 대소문자)는 같은 이름으로 읽힌다.
    for (const variant of [`  ${name}  `, name.toUpperCase()]) {
      await createRequest(variant).expect(400);
    }
    const spaced = await createCategory(uniqueName("산후 도우미"));
    await createRequest(spaced.name.replace(" ", "   ")).expect(400);

    // ⓓ **보관된 행도 모집단이다** — 보관 해제가 중복을 만들면 안 된다.
    await patchRequest(mine.id, { active: false }).expect(200);
    await createRequest(name).expect(400).expect(({ body }) => {
      expect(body.error.code).toBe("CUSTOM_CATEGORY_NAME_DUPLICATE");
    });
    // 이름 변경 경로도 같은 모집단을 본다(자기 자신은 제외 — 같은 이름 재저장은 통과).
    await patchRequest(spaced.id, { name }).expect(400);
    await patchRequest(spaced.id, { name: spaced.name }).expect(200);

    // ⓔ **다른 가구의 같은 이름은 막지 않는다** — 남의 가구에 어떤 이름이 있는지 알려 주는
    //    신탁이 되어서는 안 되고, 지출은 가구별로 갈려 있어 잘못 매칭되지도 않는다(§6.6).
    const twin = await createCategory(name, otherToken, otherHouseholdId);
    expect(twin.householdId).toBe(otherHouseholdId);
  });

  // ------------------------------------------------------------------ 한도(§1.7)

  it("가구당 상한은 15이고 보관된 행도 센다 (초과는 400 CUSTOM_CATEGORY_LIMIT_EXCEEDED)", async () => {
    // 상한 축은 이 가구를 통째로 채우므로 다른 테스트와 섞이지 않게 별도 가구를 쓴다.
    const token = await login(app, "r103-custom-category-limit");
    const me = await whoAmI(app, token);
    const limit = customCategoryMaxPerHousehold();
    expect(limit).toBe(15);

    const created: CategoryBody[] = [];
    for (let index = 0; index < limit; index += 1) {
      created.push(
        (
          await request(app.getHttpServer())
            .post(`/api/v1/households/${me.householdId}/categories`)
            .set("Authorization", `Bearer ${token}`)
            .send({ name: `상한${index}` })
            .expect(200)
        ).body as CategoryBody
      );
    }
    // display_order는 시드 대역 뒤에서 순서대로 매겨진다(§1.7).
    expect(created.map((entry) => entry.displayOrder)).toEqual(
      Array.from({ length: limit }, (_, index) => 2000 + index)
    );

    const rejected = await request(app.getHttpServer())
      .post(`/api/v1/households/${me.householdId}/categories`)
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "열여섯번째" })
      .expect(400);
    errorResponseSchema.parse(rejected.body);
    expect(rejected.body.error.code).toBe("CUSTOM_CATEGORY_LIMIT_EXCEEDED");
    expect(rejected.body.error.message).toContain(String(limit));

    // ⚠️ 보관해도 자리는 비지 않는다 — 세지 않으면 "만들고 보관"으로 전량 목록을 무한히
    //    불릴 수 있다(§1.7-3). 오타는 이름 바꾸기로 고치는 것이지 새 행으로 고치는 것이 아니다.
    await request(app.getHttpServer())
      .patch(`/api/v1/households/${me.householdId}/categories/${created[0].id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ active: false })
      .expect(200);
    await request(app.getHttpServer())
      .post(`/api/v1/households/${me.householdId}/categories`)
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "보관해도열여섯" })
      .expect(400)
      .expect(({ body }) => expect(body.error.code).toBe("CUSTOM_CATEGORY_LIMIT_EXCEEDED"));

    expect(await prisma.category.count({ where: { householdId: me.householdId } })).toBe(limit);
    await prisma.category.deleteMany({ where: { householdId: me.householdId } });
  });

  // ------------------------------------------------------------------ 멱등(§2.4)

  it("같은 Idempotency-Key 재제출은 첫 응답을 재생하고 행을 하나만 만든다 (다른 본문은 409)", async () => {
    const key = randomUUID();
    const name = uniqueName("멱등분류");

    const first = await request(app.getHttpServer())
      .post(`/api/v1/households/${householdId}/categories`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .set("Idempotency-Key", key)
      .send({ name })
      .expect(200);
    const second = await request(app.getHttpServer())
      .post(`/api/v1/households/${householdId}/categories`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .set("Idempotency-Key", key)
      .send({ name })
      .expect(200);

    expect(second.body).toEqual(first.body);
    expect(await prisma.category.count({ where: { householdId, name } })).toBe(1);

    await request(app.getHttpServer())
      .post(`/api/v1/households/${householdId}/categories`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .set("Idempotency-Key", key)
      .send({ name: uniqueName("다른본문") })
      .expect(409)
      .expect(({ body }) => expect(body.error.code).toBe("IDEMPOTENCY_KEY_CONFLICT"));
  });

  // ------------------------------------------------------------- DTO 검증(§9.2)

  it("이름 형식과 PATCH 본문 최소 하나 규칙이 400 VALIDATION_ERROR로 걸린다", async () => {
    const maxLength = customCategoryNameMaxLength();
    expect(maxLength).toBe(50); // categories.name varchar(50)와 동치(§1.4)

    for (const bad of ["", "   ", "가".repeat(maxLength + 1)]) {
      await createRequest(bad)
        .expect(400)
        .expect(({ body }) => {
          errorResponseSchema.parse(body);
          expect(body.error.code).toBe("VALIDATION_ERROR");
        });
    }
    // 딱 50자는 통과하고, 저장값은 정규화된 값이다(= 검증된 값).
    const longName = `가${"나".repeat(maxLength - 1)}`;
    const created = await createCategory(longName);
    expect(created.name).toBe(longName);

    // 요청이 정할 수 없는 축은 화이트리스트 밖 — 조용히 무시하지 않고 400이다(§2.3).
    for (const forbidden of [{ code: "custom_hack" }, { displayOrder: 1 }, { isSystem: true }, { selectable: false }]) {
      await request(app.getHttpServer())
        .post(`/api/v1/households/${householdId}/categories`)
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ name: uniqueName("화이트리스트"), ...forbidden })
        .expect(400);
    }

    // PATCH는 둘 중 하나가 필요하다.
    await patchRequest(created.id, {})
      .expect(400)
      .expect(({ body }) => {
        expect(body.error.code).toBe("VALIDATION_ERROR");
        expect(body.error.details.fields[0].constraints.required).toContain("name, active");
      });
    await patchRequest(created.id, { active: "false" }).expect(400);
  });

  // -------------------------------------------------------- 어드민 무오염(R6)

  it("어드민 목록·단건·수정은 커스텀 분류를 보지 못한다 (개인 데이터 표면 신설 금지)", async () => {
    const category = await createCategory(uniqueName("어드민무오염"));

    const listed = (
      await request(app.getHttpServer())
        .get("/api/v1/admin/categories")
        .set("x-admin-token", "test-r103-admin-token")
        .expect(200)
    ).body.categories as Array<{ id: string; code: string }>;
    expect(listed.some((row) => row.id === category.id)).toBe(false);
    expect(listed.some((row) => row.code.startsWith("custom_"))).toBe(false);
    // 그물 확인: 시드 행은 여전히 전량 실린다(필터가 목록을 통째로 비운 것이 아니다).
    expect(listed.some((row) => row.code === "diaper_hygiene")).toBe(true);
    expect(listed.some((row) => row.code === "import_stub_default")).toBe(true);

    // 커스텀 id로 어드민 수정 → 종전과 같은 404 CATEGORY_NOT_FOUND(R6).
    await request(app.getHttpServer())
      .patch(`/api/v1/admin/categories/${category.id}`)
      .set("x-admin-token", "test-r103-admin-token")
      .send({ active: false })
      .expect(404)
      .expect(({ body }) => {
        errorResponseSchema.parse(body);
        expect(body.error.code).toBe("CATEGORY_NOT_FOUND");
      });
    expect((await prisma.category.findUniqueOrThrow({ where: { id: category.id } })).active).toBe(true);
  });

  // --------------------------------------------------------- 감사 봉투(§2.5)

  it("custom_category.update 봉투에 이름 문자열이 없고, 생성은 감사 로그를 남기지 않는다", async () => {
    const name = uniqueName("감사봉투");
    const category = await createCategory(name);

    // 생성은 로그를 남기지 않는다 — 행 자체가 기록이고 soft delete가 없어 사라지지 않는다.
    expect(
      await prisma.auditLog.count({ where: { targetId: category.id, action: { startsWith: "custom_category." } } })
    ).toBe(0);

    const renamed = uniqueName("감사봉투바뀜");
    await patchRequest(category.id, { name: renamed, active: false }).expect(200);

    const entry = await prisma.auditLog.findFirstOrThrow({
      where: { targetId: category.id, action: "custom_category.update" },
      orderBy: { createdAt: "desc" }
    });
    expect(entry.actorUserId).toBe(ownerUserId);
    expect(entry.householdId).toBe(householdId);
    expect(entry.targetType).toBe("categories");
    expect(entry.afterJson).toEqual({
      categoryId: category.id,
      householdId,
      changed: ["name", "active"],
      activeBefore: true,
      activeAfter: false
    });
    // ⚠️ 이름 문자열은 봉투 어디에도 없다(§2.5 — 자유 문자열은 개인정보 밀도가 높은 축).
    //    알려진 귀결도 그대로 받아들인다: 이름의 **이전 값은 남지 않는다**.
    const envelope = JSON.stringify({ before: entry.beforeJson, after: entry.afterJson });
    expect(envelope).not.toContain(name);
    expect(envelope).not.toContain(renamed);
    expect(entry.beforeJson).toBeNull();

    // 축 하나만 보낸 요청은 changed도 하나다.
    await patchRequest(category.id, { active: true }).expect(200);
    const latest = await prisma.auditLog.findFirstOrThrow({
      where: { targetId: category.id, action: "custom_category.update" },
      orderBy: { createdAt: "desc" }
    });
    expect(latest.afterJson).toMatchObject({ changed: ["active"], activeBefore: false, activeAfter: true });
  });

  // ------------------------------------------------ 색인 위반의 HTTP 계약(리뷰 M-3)

  /**
   * 라운드 103 리뷰 렌즈1 M-3 — 색인이 잡는 위반이 **HTTP로 어떻게 나가는지**를 문다.
   * 종전에는 아래 ⓐ가 Prisma 직접 쓰기로 `rejects.toThrow()`만 확인해서, 그 위반이 사용자에게
   * 500 `INTERNAL_ERROR`("잠시 후 다시 시도해 주세요")로 보이는 것을 아무도 잡지 못했다.
   * 다시 눌러도 같은 결과인 실패에 재시도를 권하는 것은 DNC-018이 금지하는 틀린 안내다.
   *
   * 서비스 선검사(`requireUniqueName`)를 건너뛰는 창을 테스트에서 만들 수는 없으므로, 대신
   * **서비스가 P2002를 번역하는지**를 그 창이 열렸을 때와 같은 모양으로 확인한다: 색인만
   * 잡을 수 있는 이름(선검사의 JS 정규화는 통과하지만 PG `lower(btrim(...))`에서는 충돌하는
   * 값)을 쓸 수 없으므로, 여기서는 선검사가 먼저 답하는 정상 경로가 **400 + 그 코드**임을
   * 값으로 고정한다. 번역 함수 자체의 존재는 소스 계약으로 함께 문다.
   */
  it("이름 중복은 어느 방어선에서 잡히든 400 CUSTOM_CATEGORY_NAME_DUPLICATE로 나간다 (500 금지)", async () => {
    const name = uniqueName("중복계약");
    await createCategory(name);

    const duplicate = await createRequest(`  ${name.toUpperCase()}  `);

    expect(duplicate.status).toBe(400);
    expect(duplicate.body?.error?.code).toBe("CUSTOM_CATEGORY_NAME_DUPLICATE");
    // 500으로 새면 이 단언이 먼저 깨진다 — 그것이 이 테스트의 요점이다.
    expect(duplicate.status).not.toBe(500);

    // 마지막 방어선(P2002)도 같은 코드로 번역된다는 사실을 소스로 고정한다. 선검사와 색인
    // 사이의 창(경합·정규화 갈림)은 e2e로 열 수 없지만, 번역이 사라지면 그 창이 다시 500이 된다.
    const service = readFileSync(
      resolve(__dirname, "../src/households/custom-categories.service.ts"),
      "utf8"
    );
    expect(service).toContain("translateNameUniqueViolation");
    expect(service).toContain('(error as { code?: string }).code !== "P2002"');
    expect(service).toContain("throw duplicateNameError()");
    // P2002가 아닌 오류를 삼키지 않는다(서버 버그가 입력 오류로 위장되지 않게).
    expect(service).toContain("throw error;");
  });

  // ------------------------------------------------ DB 마지막 방어선(000024)

  it("DB가 마지막 방어선을 진다: 같은 가구의 동명 색인과 소유자↔is_system CHECK", async () => {
    const name = uniqueName("디비방어선");
    const created = await createCategory(name);

    // ⓐ 부분 유니크 색인 uq_categories_household_name — 서비스를 건너뛴 쓰기도 막힌다.
    //    (정규화가 색인 식 `lower(btrim(name))`과 같은 규칙이라 대소문자·앞뒤 공백이 같은 값으로 읽힌다.)
    await expect(
      prisma.category.create({
        data: {
          householdId,
          code: `custom_${randomUUID().replace(/-/gu, "")}`,
          name: `  ${name.toUpperCase()}  `,
          isSystem: false,
          displayOrder: 2999
        }
      })
    ).rejects.toThrow();

    // ⓑ CHECK chk_categories_owner_is_system — 가구 소유 행은 시스템 시드를 자처할 수 없다.
    //    ⚠️ 두 시점: 설계 §1은 이 자리에 **양방향 등호**를 적었고 "오늘 21행 전부 is_system=true"를
    //    근거로 들었지만, 실측은 정식 12행만 true이고 별칭 8 + 스텁 1은 **false로 시드된다**
    //    (prisma/seed.ts). 그래서 마이그레이션 000024는 지켜야 하는 방향만 남겼다.
    await expect(
      prisma.category.create({
        data: {
          householdId,
          code: `custom_${randomUUID().replace(/-/gu, "")}`,
          name: uniqueName("체크제약"),
          isSystem: true,
          displayOrder: 2998
        }
      })
    ).rejects.toThrow();

    // ⓒ 그리고 그 반대 방향은 오늘 참이 아니다 — 시드 아홉 행이 (household_id IS NULL,
    //    is_system = false)로 살아 있다. `isSystem === false`를 커스텀의 표식으로 읽으면 안 되는
    //    이유가 이 값이고, 표식은 응답의 `householdId` 하나다(§2.2 정정).
    const seedNonSystem = await prisma.category.findMany({
      where: { householdId: null, isSystem: false },
      select: { code: true }
    });
    expect(seedNonSystem.length).toBeGreaterThanOrEqual(9);
    expect(seedNonSystem.map((row) => row.code)).toContain("import_stub_default");

    expect((await prisma.category.count({ where: { householdId, name } }))).toBe(1);
    expect(created.isSystem).toBe(false);
  });
});
