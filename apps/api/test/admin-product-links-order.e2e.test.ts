import type { INestApplication } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AppModule } from "../src/app.module";
import { configureApiApp } from "../src/bootstrap";
import { PrismaService } from "../src/prisma/prisma.service";

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

  /**
   * GAP-064 #4 · #8 — 어드민 DTO가 **자기가 쓴 값을 되읽을 수 있는가**.
   *
   * ⓐ 가격 두 칸: CSV 일괄 교체가 쓰는 유일한 값인데 어드민 응답에 없었다(헬스는 있고
   *    가격만 없는 비대칭). 앱 DTO의 "가격 + 확인 시각이 둘 다 있을 때만" 규칙을 여기서
   *    재사용하지 않는 것이 요점이다 — 어드민이 봐야 하는 것이 바로 그 규칙에 걸려 앱에서
   *    사라진 행이라, **값은 그대로 싣고** 만료 여부만 서버가 판정해 불리언으로 준다
   *    (문턱 숫자를 어드민 번들에 다시 박지 않기 위해서다 — 라운드 63 #9).
   * ⓑ `redirectCode`/`redirectShareUrl`: `/r/:code` 공개 리다이렉트는 완성돼 있었는데 코드를
   *    노출하는 화면이 없어 도달 불가였다(전 소스에서 그 컬럼을 읽는 곳이 컨트롤러 한 줄뿐).
   */
  it("carries the price snapshot and the public share URL (GAP-064 #4 · #8)", async () => {
    const suffix = randomUUID().slice(0, 8);
    const itemTemplateId = await createItemTemplate(`가격 왕복 테스트템 ${suffix}`);
    const freshId = await createProductLink(itemTemplateId, `가격 있는 링크 ${suffix}`);
    const staleId = await createProductLink(itemTemplateId, `만료된 가격 링크 ${suffix}`);
    const undatedId = await createProductLink(itemTemplateId, `시각 없는 가격 링크 ${suffix}`);

    const prisma = moduleRef.get(PrismaService);
    await prisma.productLink.update({
      where: { id: freshId },
      data: { priceSnapshotKrw: 159_000, priceCheckedAt: new Date() }
    });
    await prisma.productLink.update({
      where: { id: staleId },
      // 문턱(LINK_PRICE_MAX_AGE_DAYS)보다 확실히 오래된 값 — 앱은 이미 그리지 않는다.
      data: { priceSnapshotKrw: 89_000, priceCheckedAt: new Date("2020-01-02T00:00:00.000Z") }
    });
    await prisma.productLink.update({
      where: { id: undatedId },
      data: { priceSnapshotKrw: 42_000, priceCheckedAt: null }
    });

    const links = (
      await request(app.getHttpServer())
        .get("/api/v1/admin/product-links")
        .set("x-admin-token", adminToken)
        .expect(200)
    ).body.links as Array<Record<string, unknown>>;
    const byId = new Map(links.map((link) => [link.id as string, link]));

    expect(byId.get(freshId)).toMatchObject({ priceSnapshotKrw: 159_000, priceExpired: false });
    expect(byId.get(freshId)!.priceCheckedAt).toEqual(expect.any(String));
    expect(byId.get(staleId)).toMatchObject({ priceSnapshotKrw: 89_000, priceExpired: true });
    // 확인 시각이 없는 행: 앱은 이 가격을 아예 내려받지 못하지만 어드민은 값을 되읽는다.
    expect(byId.get(undatedId)).toMatchObject({ priceSnapshotKrw: 42_000, priceCheckedAt: null });

    // #8: 공유 URL은 서버가 조립한다(베이스는 API 환경변수라 브라우저가 읽을 수 없다).
    const shareLink = byId.get(freshId)!;
    expect(shareLink.redirectCode).toEqual(expect.any(String));
    expect(shareLink.redirectShareUrl).toBe(
      `${(process.env.INVITE_LINK_BASE_URL ?? "https://wooriai.local").replace(/\/+$/, "")}/r/${shareLink.redirectCode}`
    );
  });
});
