import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { randomUUID } from "node:crypto";
import request from "supertest";
import { listCategoriesResponseSchema } from "@wooriai/contracts";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AppModule } from "../src/app.module";
import { configureApiApp } from "../src/bootstrap";

async function login(app: INestApplication) {
  const response = await request(app.getHttpServer())
    .post("/api/v1/auth/oauth-login")
    .send({ provider: "kakao", providerToken: `categories-token-${randomUUID()}` })
    .expect(200);

  return response.body.tokens.accessToken as string;
}

const CANONICAL_CODES = [
  "pregnancy_mother",
  "hospital_checkup",
  "birth_postpartum",
  "diaper_hygiene",
  "feeding_babyfood",
  "clothes_laundry",
  "sleep_furniture",
  "outing_mobility",
  "toys_books",
  "care_education",
  "insurance_savings",
  "etc"
];

/** CAT-124: 시드가 만들어 두는 노출 제외 행 — 모바일 퀵타일 별칭 8 + 가져오기 스텁 1. */
const NON_SELECTABLE_CODES = [
  "mobile_diaper_hygiene",
  "mobile_feeding_dairy",
  "mobile_feeding_meal",
  "mobile_clothes_laundry",
  "mobile_outing_mobility",
  "mobile_hospital_checkup",
  "mobile_toys_books",
  "mobile_etc",
  "import_stub_default"
];

// CAT-101: GET /categories — 시드된 활성 카테고리 목록.
describe("Categories API (CAT-101)", () => {
  let app: INestApplication;

  beforeEach(async () => {
    process.env.JWT_ACCESS_SECRET = "test-access-secret";
    process.env.JWT_REFRESH_SECRET = "test-refresh-secret";

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApiApp(app);
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it("requires authentication", async () => {
    await request(app.getHttpServer()).get("/api/v1/categories").expect(401);
  });

  it("returns the seeded active categories sorted by display order, matching the shared contract", async () => {
    const accessToken = await login(app);

    const response = await request(app.getHttpServer())
      .get("/api/v1/categories")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);

    // 응답 전체가 공유 계약(listCategoriesResponseSchema)에 맞아야 한다.
    const parsed = listCategoriesResponseSchema.parse(response.body);

    // 시드의 잠긴 12개 canonical 카테고리가 모두 포함된다.
    const codes = parsed.categories.map((category) => category.code);
    for (const seededCode of CANONICAL_CODES) {
      expect(codes).toContain(seededCode);
    }

    // 활성 카테고리만, displayOrder 오름차순.
    expect(parsed.categories.every((category) => category.active)).toBe(true);
    const orders = parsed.categories.map((category) => category.displayOrder);
    expect(orders).toEqual([...orders].sort((a, b) => a - b));

    const diaper = parsed.categories.find((category) => category.code === "diaper_hygiene");
    expect(diaper).toMatchObject({ name: "기저귀/위생", iconName: "diaper", isSystem: true });
  });
});

/**
 * CAT-124: 노출 범위(`selectable`). 기본 목록은 "고르라고 내밀 카테고리"만, `?includeAll=1`은
 * 전량. 핵심은 **행이 사라지지 않는다**는 것 — 이미 별칭 id로 저장된 지출이 목록·리포트에서
 * 계속 보이고, 그 id로 새 지출을 만드는 것도 여전히 허용된다(8타일 빠른 입력·오프라인 재전송).
 */
describe("Categories 노출 범위 (CAT-124)", () => {
  /** 모바일 퀵타일 "기저귀" 별칭 — mobileCategoryAliasSeeds의 고정 id. */
  const ALIAS_DIAPER_ID = "c0a7e901-0000-4c01-8c01-c47e900ec001";
  /** 엑셀 가져오기 스텁 — importStubCategorySeeds의 고정 id. */
  const IMPORT_STUB_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

  let app: INestApplication;

  beforeEach(async () => {
    process.env.JWT_ACCESS_SECRET = "test-access-secret";
    process.env.JWT_REFRESH_SECRET = "test-refresh-secret";
    process.env.WOORIAI_STAGE_TODAY = "2026-07-06";

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApiApp(app);
    await app.init();
  });

  afterEach(async () => {
    delete process.env.WOORIAI_STAGE_TODAY;
    await app.close();
  });

  async function listWith(accessToken: string, query = "") {
    const response = await request(app.getHttpServer())
      .get(`/api/v1/categories${query}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);
    return listCategoriesResponseSchema.parse(response.body).categories;
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

    return (
      await request(app.getHttpServer())
        .post("/api/v1/children")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ householdId, nickname: "노출범위", stageMode: "manual", manualStage: "infant_4_6" })
        .expect(200)
    ).body.id as string;
  }

  it("기본 목록은 정식 12개만 — 별칭 8 + 가져오기 스텁 1은 빠진다", async () => {
    const accessToken = await login(app);
    const categories = await listWith(accessToken);

    expect(categories.map((category) => category.code).sort()).toEqual([...CANONICAL_CODES].sort());
    expect(categories).toHaveLength(12);
    for (const hidden of NON_SELECTABLE_CODES) {
      expect(categories.map((category) => category.code)).not.toContain(hidden);
    }
    // 응답 DTO가 플래그를 실어 준다(계약상 optional이지만 서버는 항상 보낸다).
    expect(categories.every((category) => category.selectable === true)).toBe(true);
    // 이름이 겹쳐 보이던 쌍이 더는 나란히 뜨지 않는다 — 이 티켓의 본론.
    const names = categories.map((category) => category.name);
    expect(names).toContain("기저귀/위생");
    expect(names).not.toContain("기저귀");
    expect(names).toContain("수유/이유식");
    expect(names).not.toContain("분유/유제품");
    expect(names.filter((name) => name === "기타")).toHaveLength(1);
  });

  it("?includeAll=1은 전량(21행)을 돌려주고 selectable로 구분한다", async () => {
    const accessToken = await login(app);
    const categories = await listWith(accessToken, "?includeAll=1");

    expect(categories).toHaveLength(21);
    const byCode = new Map(categories.map((category) => [category.code, category]));
    for (const hidden of NON_SELECTABLE_CODES) {
      expect(byCode.get(hidden)).toMatchObject({ selectable: false, active: true });
    }
    for (const canonical of CANONICAL_CODES) {
      expect(byCode.get(canonical)).toMatchObject({ selectable: true, active: true });
    }
    // DNC-007: 행이 지워지지 않았고 모바일이 하드코딩한 id도 그대로다.
    expect(categories.some((category) => category.id === ALIAS_DIAPER_ID)).toBe(true);
    expect(categories.some((category) => category.id === IMPORT_STUB_ID)).toBe(true);
    // 정렬 계약은 전량 조회에서도 유지된다.
    const orders = categories.map((category) => category.displayOrder);
    expect(orders).toEqual([...orders].sort((a, b) => a - b));
  });

  it("includeAll=true도 같은 결과이고, 알 수 없는 값은 조용히 무시하지 않고 400이다", async () => {
    const accessToken = await login(app);

    expect(await listWith(accessToken, "?includeAll=true")).toHaveLength(21);
    expect(await listWith(accessToken, "?includeAll=0")).toHaveLength(12);

    await request(app.getHttpServer())
      .get("/api/v1/categories?includeAll=yes")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(400)
      .expect(({ body }) => {
        expect(body.error.code).toBe("VALIDATION_ERROR");
      });
  });

  it("하위 호환: 노출 제외 별칭 id로도 지출을 새로 만들 수 있고 목록·리포트에 그대로 잡힌다", async () => {
    const accessToken = await login(app);
    const childId = await completeOnboarding(accessToken);

    // 8타일 빠른 입력이 실제로 보내는 모양 — 기본 목록에 없는 별칭 id.
    const expenseId = (
      await request(app.getHttpServer())
        .post(`/api/v1/children/${childId}/expenses`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({
          categoryId: ALIAS_DIAPER_ID,
          amountKrw: 45900,
          spentOn: "2026-07-06",
          itemName: "빠른 기록 기저귀",
          paymentMethod: "card"
        })
        .expect(200)
    ).body.id as string;

    // 목록에 남는다.
    await request(app.getHttpServer())
      .get(`/api/v1/children/${childId}/expenses?yearMonth=2026-07`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200)
      .expect(({ body }) => {
        const match = (body.expenses as Array<{ id: string; categoryId: string }>).find(
          (expense) => expense.id === expenseId
        );
        expect(match?.categoryId).toBe(ALIAS_DIAPER_ID);
      });

    // 카테고리 리포트에도 별칭 id 그대로 집계된다.
    await request(app.getHttpServer())
      .get(`/api/v1/children/${childId}/reports/category?yearMonth=2026-07`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.categories).toEqual([{ categoryId: ALIAS_DIAPER_ID, amountKrw: 45900, count: 1 }]);
      });

    // 수정 경로의 categoryId 검증도 selectable을 보지 않는다(가져오기 스텁으로 옮겨도 통과).
    await request(app.getHttpServer())
      .patch(`/api/v1/expenses/${expenseId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ categoryId: IMPORT_STUB_ID })
      .expect(200)
      .expect(({ body }) => {
        expect(body.categoryId).toBe(IMPORT_STUB_ID);
      });

    // 그 이름은 전량 조회에서만 찾을 수 있다 — 이름 해석 경로가 includeAll=1을 써야 하는 이유.
    const all = await listWith(accessToken, "?includeAll=1");
    expect(all.find((category) => category.id === IMPORT_STUB_ID)?.name).toBe("가져오기 기본");
    const selectableOnly = await listWith(accessToken);
    expect(selectableOnly.some((category) => category.id === IMPORT_STUB_ID)).toBe(false);
  });
});
