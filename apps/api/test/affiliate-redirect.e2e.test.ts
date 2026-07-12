import type { INestApplication } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AppModule } from "../src/app.module";
import { configureApiApp } from "../src/bootstrap";
import { PrismaService } from "../src/prisma/prisma.service";

/**
 * COM-106 (round5a-sprint2-plan.md §4): the public, unauthenticated opaque affiliate
 * redirect GET /r/:code. Product links are created directly through Prisma (rather
 * than through the admin API) since this suite only needs isolated rows with a known
 * redirectCode, not the full admin content-revision flow.
 */
describe("Affiliate opaque redirect (GET /r/:code)", () => {
  let app: INestApplication;
  let moduleRef: TestingModule;
  let prisma: PrismaService;
  let itemTemplateId: string;
  const createdProductLinkIds: string[] = [];

  beforeEach(async () => {
    process.env.JWT_ACCESS_SECRET = "test-access-secret";
    process.env.JWT_REFRESH_SECRET = "test-refresh-secret";

    moduleRef = await Test.createTestingModule({
      imports: [AppModule]
    }).compile();

    app = moduleRef.createNestApplication();
    configureApiApp(app);
    await app.init();

    prisma = moduleRef.get(PrismaService);
    const template = await prisma.itemTemplate.findFirstOrThrow({ where: { active: true } });
    itemTemplateId = template.id;
  });

  afterEach(async () => {
    if (createdProductLinkIds.length > 0) {
      await prisma.affiliateClick.deleteMany({ where: { productLinkId: { in: createdProductLinkIds } } });
      await prisma.productLink.deleteMany({ where: { id: { in: createdProductLinkIds } } });
      createdProductLinkIds.length = 0;
    }
    await app.close();
  });

  async function createProductLink(overrides: Partial<{ url: string; affiliateUrl: string | null; active: boolean }>) {
    const link = await prisma.productLink.create({
      data: {
        itemTemplateId,
        platform: "coupang",
        title: "리다이렉트 테스트 링크",
        url: overrides.url ?? "https://link.coupang.com/a/redirect-test",
        affiliateUrl: overrides.affiliateUrl ?? undefined,
        active: overrides.active ?? true
      }
    });
    createdProductLinkIds.push(link.id);
    return link;
  }

  it("redirects with 302 to the affiliate URL and logs an anonymous click (no user/household/child, subId=own id, ipHash present)", async () => {
    const link = await createProductLink({
      url: "https://link.coupang.com/a/redirect-test",
      affiliateUrl: "https://link.coupang.com/a/redirect-affiliate"
    });

    const response = await request(app.getHttpServer())
      .get(`/api/v1/r/${link.redirectCode}`)
      .set("User-Agent", "wooriai-e2e-redirect-agent/1.0")
      .redirects(0);

    expect(response.status).toBe(302);
    expect(response.headers.location).toBe("https://link.coupang.com/a/redirect-affiliate");

    const clicks = await prisma.affiliateClick.findMany({ where: { productLinkId: link.id } });
    expect(clicks).toHaveLength(1);
    const click = clicks[0];
    expect(click.userId).toBeNull();
    expect(click.householdId).toBeNull();
    expect(click.childId).toBeNull();
    expect(click.itemTemplateId).toBe(itemTemplateId);
    expect(click.referrerScreenId).toBe("redirect");
    expect(click.subId).toBe(click.id);
    expect(click.ipHash).toMatch(/^[0-9a-f]{64}$/);
    expect(click.userAgent).toBe("wooriai-e2e-redirect-agent/1.0");
  });

  it("works with no Authorization header at all (public route)", async () => {
    const link = await createProductLink({ url: "https://smartstore.naver.com/dev/redirect-test" });

    const response = await request(app.getHttpServer()).get(`/api/v1/r/${link.redirectCode}`).redirects(0);

    expect(response.status).toBe(302);
    expect(response.headers.location).toBe("https://smartstore.naver.com/dev/redirect-test");
  });

  it("ignores any query parameters -- they never reach the Location header (open-redirect prevention)", async () => {
    const link = await createProductLink({ url: "https://link.coupang.com/a/redirect-test" });

    const response = await request(app.getHttpServer())
      .get(`/api/v1/r/${link.redirectCode}?next=https://evil.example.net&foo=bar`)
      .redirects(0);

    expect(response.status).toBe(302);
    expect(response.headers.location).toBe("https://link.coupang.com/a/redirect-test");
    expect(response.headers.location).not.toContain("evil.example.net");
  });

  it("returns 404 without logging a click when the target domain is not on the affiliate allowlist", async () => {
    const link = await createProductLink({ url: "https://evil-coupang.com/not-allowed" });

    const response = await request(app.getHttpServer()).get(`/api/v1/r/${link.redirectCode}`).redirects(0);

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("PRODUCT_LINK_NOT_FOUND");

    const clicks = await prisma.affiliateClick.findMany({ where: { productLinkId: link.id } });
    expect(clicks).toHaveLength(0);
  });

  it("returns 404 without logging a click for an inactive link", async () => {
    const link = await createProductLink({ url: "https://link.coupang.com/a/inactive-test", active: false });

    const response = await request(app.getHttpServer()).get(`/api/v1/r/${link.redirectCode}`).redirects(0);

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("PRODUCT_LINK_NOT_FOUND");

    const clicks = await prisma.affiliateClick.findMany({ where: { productLinkId: link.id } });
    expect(clicks).toHaveLength(0);
  });

  it("returns 404 for an unknown redirect code", async () => {
    const response = await request(app.getHttpServer()).get("/api/v1/r/does-not-exist").redirects(0);

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("PRODUCT_LINK_NOT_FOUND");
  });
});
