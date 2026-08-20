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

    // 시드의 잠긴 12개 canonical 카테고리가 모두 포함된다 (모바일 별칭 카테고리가
    // 더 있을 수 있으므로 정확히 12개라고 단정하지는 않는다 — seed-data.test.ts 참고).
    const codes = parsed.categories.map((category) => category.code);
    for (const seededCode of [
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
    ]) {
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
