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

  async function createProductLink(
    itemTemplateId: string,
    title: string,
    overrides: Record<string, unknown> = {}
  ): Promise<string> {
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
        active: true,
        ...overrides
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

    // 라운드 64 C-1: 종전 단언은 서버와 **같은 식**을 테스트에서 다시 조립해 비교했다 —
    // 동어반복이라 그 URL이 실제로 어디로도 가지 않는다는 사실(경로에 /api/v1이 빠져 전부
    // 404였다)을 통과시켰다. 그래서 값의 모양을 보지 않고 **그 주소를 실제로 때린다**.
    const sharePath = new URL(String(shareLink.redirectShareUrl)).pathname;
    const redirected = await request(app.getHttpServer()).get(sharePath);
    // 302 = 실제로 서 있는 라우트를 가리킨다(404면 존재하지 않는 경로를 나눠 준 것이다).
    expect(redirected.status, `공유 URL이 가리키는 경로가 응답하지 않는다: ${sharePath}`).toBe(302);
    // 목적지도 그 링크 자신의 주소다(리다이렉트가 다른 곳을 가리키지 않는다).
    expect(redirected.headers.location).toBe(shareLink.url);
  });

  /**
   * 라운드 64 S-1 — 비활성 링크에는 공유 URL을 싣지 않는다.
   *
   * `GET /api/v1/r/:code`는 `active: true`인 행만 302로 보내고 나머지는 404다
   * (redirect.controller.ts). 그래서 비활성 행에도 URL을 실으면 어드민 표에 **누르면
   * 404가 나는 복사 버튼**이 선다. 코드(`redirectCode`)는 그대로 남는다 — 링크를 되살리면
   * 같은 코드가 다시 도달 가능해진다는 사실이 어드민에 보여야 한다.
   */
  it("hides the share URL for a deactivated link, and the route agrees (round 64 S-1)", async () => {
    const suffix = randomUUID().slice(0, 8);
    const itemTemplateId = await createItemTemplate(`비활성 공유 테스트템 ${suffix}`);
    const linkId = await createProductLink(itemTemplateId, `내려둘 링크 ${suffix}`);

    const readLink = async () => {
      const links = (
        await request(app.getHttpServer())
          .get("/api/v1/admin/product-links")
          .set("x-admin-token", adminToken)
          .expect(200)
      ).body.links as Array<Record<string, unknown>>;
      return links.find((link) => link.id === linkId)!;
    };

    // 활성일 때: URL이 실리고 그 경로가 실제로 302를 준다.
    const active = await readLink();
    const sharePath = new URL(String(active.redirectShareUrl)).pathname;
    await request(app.getHttpServer()).get(sharePath).expect(302);

    await request(app.getHttpServer())
      .patch(`/api/v1/admin/product-links/${linkId}`)
      .set("x-admin-token", adminToken)
      .send({ active: false })
      .expect(200);

    const inactive = await readLink();
    // 필드 부재(null): 화면이 죽은 버튼을 그릴 근거 자체가 없다.
    expect(inactive.redirectShareUrl).toBeNull();
    // 코드는 남는다 — 되살릴 때 같은 주소가 돌아온다.
    expect(inactive.redirectCode).toBe(active.redirectCode);
    // 그 판정의 근거: 같은 경로가 이제 404다(302가 아니다).
    await request(app.getHttpServer()).get(sharePath).expect(404);
  });

  /**
   * 라운드 64 M-1 — 앱 밖으로 나가는 문구에는 제휴 수수료 문장이 반드시 들어간다.
   *
   * 앱의 공유(`purchaseLinkShareMessage`)는 `withAffiliateDisclosure`를 지나 이 규율을
   * 지키는데, 어드민의 "공유 링크 복사"는 저장된 원문만 실어서 **앱보다 약한 고지**가 앱보다
   * 넓게 나갔다(DNC-010). 판정을 서버 한 곳으로 모았으니 여기서 고정한다: 편집용
   * `disclosureText`는 운영이 쓴 값 그대로, 공유용 `shareDisclosureText`에는 종별 기본
   * 수수료 문구가 이어붙는다.
   */
  it("adds the commission sentence to an affiliate link's share copy (round 64 M-1)", async () => {
    const suffix = randomUUID().slice(0, 8);
    const itemTemplateId = await createItemTemplate(`공유 고지 테스트템 ${suffix}`);
    const custom = "쿠팡 파트너스 활동의 일환이에요";
    const affiliateId = await createProductLink(itemTemplateId, `제휴 링크 ${suffix}`, {
      isAffiliate: true,
      disclosureText: custom
    });
    const plainId = await createProductLink(itemTemplateId, `일반 링크 ${suffix}`);

    const links = (
      await request(app.getHttpServer())
        .get("/api/v1/admin/product-links")
        .set("x-admin-token", adminToken)
        .expect(200)
    ).body.links as Array<Record<string, unknown>>;
    const byId = new Map(links.map((link) => [link.id as string, link]));

    const affiliateDefault = (
      await request(app.getHttpServer()).get("/api/v1/admin/disclosures").set("x-admin-token", adminToken).expect(200)
    ).body.disclosures.find((row: { key: string }) => row.key === "affiliate_purchase").text as string;

    const affiliate = byId.get(affiliateId)!;
    // 편집 칸은 운영이 쓴 값 그대로다(자기가 쓴 값을 되읽는다).
    expect(affiliate.disclosureText).toBe(custom);
    // 공유 문구에는 원문이 남고 수수료 문장이 이어붙는다.
    expect(affiliate.shareDisclosureText).toBe(`${custom}. ${affiliateDefault}`);

    // 제휴가 아닌 링크에는 없는 고지를 지어내지 않는다 — 두 값이 같고 둘 다 비어 있다.
    const plain = byId.get(plainId)!;
    expect(plain.disclosureText).toBeUndefined();
    expect(plain.shareDisclosureText).toBeUndefined();
  });
});
