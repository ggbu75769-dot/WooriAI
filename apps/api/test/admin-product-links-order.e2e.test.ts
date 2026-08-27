import type { INestApplication } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AppModule } from "../src/app.module";
import { configureApiApp } from "../src/bootstrap";

const adminToken = "dev-admin-token";

type AdminProductLink = { id: string; itemTemplateId: string; title: string };

// UX-X(R43) C7: GET /admin/product-links의 정렬 계약 — 준비템별로 묶고(itemTemplateId
// 오름차순) 그 안에서는 노출 순서(displayOrder)대로. 종전에는 정렬이 없어 같은
// 준비템의 링크가 표 곳곳에 흩어졌고, 목록 순서가 실행마다 달라질 수 있었다.
// 결과 "집합"은 바뀌지 않는다 — 순서만 결정적이 된다.
describe("GET /api/v1/admin/product-links ordering (UX-X C7)", () => {
  let app: INestApplication;
  let moduleRef: TestingModule;

  beforeEach(async () => {
    process.env.JWT_ACCESS_SECRET = "test-access-secret";
    process.env.JWT_REFRESH_SECRET = "test-refresh-secret";
    process.env.WOORIAI_ADMIN_TOKEN = adminToken;

    moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApiApp(app);
    await app.init();
  });

  afterEach(async () => {
    delete process.env.WOORIAI_ADMIN_TOKEN;
    await app.close();
  });

  async function createItemTemplate(name: string): Promise<string> {
    const response = await request(app.getHttpServer())
      .post("/api/v1/admin/item-templates")
      .set("x-admin-token", adminToken)
      .send({
        name,
        necessityLevel: "essential",
        reasonText: "정렬 계약 테스트 전용 준비템.",
        stageCodes: ["newborn_0_3"],
        active: false
      })
      .expect(200);
    return response.body.id as string;
  }

  async function createProductLink(itemTemplateId: string, title: string): Promise<string> {
    const response = await request(app.getHttpServer())
      .post("/api/v1/admin/product-links")
      .set("x-admin-token", adminToken)
      .send({
        itemTemplateId,
        platform: "custom",
        title,
        url: `https://example.com/${randomUUID()}`,
        isAffiliate: false,
        isSponsored: false,
        active: true
      })
      .expect(200);
    return response.body.id as string;
  }

  it("groups links by item template and keeps each template's links in display order", async () => {
    const suffix = randomUUID().slice(0, 8);
    const itemTemplateId = await createItemTemplate(`정렬 테스트 준비템 ${suffix}`);
    // 생성 순서 = displayOrder 순서 (adminCreateProductLink가 다음 순번을 매긴다).
    const first = await createProductLink(itemTemplateId, `첫 번째 링크 ${suffix}`);
    const second = await createProductLink(itemTemplateId, `두 번째 링크 ${suffix}`);
    const third = await createProductLink(itemTemplateId, `세 번째 링크 ${suffix}`);

    const links = (
      await request(app.getHttpServer())
        .get("/api/v1/admin/product-links")
        .set("x-admin-token", adminToken)
        .expect(200)
    ).body.links as AdminProductLink[];

    // 결과 집합 불변: 방금 만든 링크가 모두 그대로 들어 있다.
    const ids = links.map((link) => link.id);
    expect(ids).toEqual(expect.arrayContaining([first, second, third]));

    // 1차 정렬: itemTemplateId 오름차순 — 같은 준비템의 링크가 한 덩어리로 붙어 있다.
    const templateIds = links.map((link) => link.itemTemplateId);
    expect([...templateIds]).toEqual([...templateIds].sort());

    // 2차 정렬: 같은 준비템 안에서는 displayOrder(= 생성 순서)대로.
    expect(links.filter((link) => link.itemTemplateId === itemTemplateId).map((link) => link.id)).toEqual([
      first,
      second,
      third
    ]);
  });
});
