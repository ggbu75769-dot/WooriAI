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
 *
 * 라운드 69 #4가 실패 응답에 `Accept` 협상을 붙였다(redirect.controller.ts 머리말). 이 스위트가
 * 고정하는 네 갈래:
 *  1. 정상 302 — Accept가 무엇이든 **불변**(성공 경로는 협상 대상이 아니다).
 *  2·3·4. 미존재 · 비활성 · 허용목록 밖 도메인 — 브라우저 Accept에서 셋 다 404 + **바이트 단위로
 *     같은** HTML(존재 오라클 없음).
 * 그리고 JSON 클라이언트(`Accept: application/json` 및 Accept 헤더 없음)는 **종전 봉투 그대로**다.
 */
/** 실제 브라우저 내비게이션이 보내는 Accept 헤더. */
const BROWSER_ACCEPT = "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8";
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

  // ── 라운드 69 #4: 공유된 링크를 브라우저로 연 사람이 보는 화면 ──────────────────────
  describe("browser (Accept: text/html) failure page", () => {
    it("keeps the success path identical whatever the Accept header is (302 byte-for-byte, one click each)", async () => {
      const link = await createProductLink({
        url: "https://link.coupang.com/a/redirect-test",
        affiliateUrl: "https://link.coupang.com/a/redirect-affiliate"
      });

      const browser = await request(app.getHttpServer())
        .get(`/api/v1/r/${link.redirectCode}`)
        .set("Accept", BROWSER_ACCEPT)
        .redirects(0);
      const jsonClient = await request(app.getHttpServer()).get(`/api/v1/r/${link.redirectCode}`).redirects(0);

      // 성공 경로는 협상 대상이 아니다 — 상태와 Location이 Accept와 무관하게 같다.
      expect(browser.status).toBe(302);
      expect(jsonClient.status).toBe(302);
      expect(browser.headers.location).toBe("https://link.coupang.com/a/redirect-affiliate");
      expect(browser.headers.location).toBe(jsonClient.headers.location);
      // 302의 본문은 express의 `res.redirect`가 자체적으로 협상하는 한 줄짜리 예의 문구다
      // (`<p>Found. Redirecting to …</p>` vs 평문) — **이번 변경 이전부터 그랬고** 우리 페이지가
      // 아니다. 고정하는 것은 "실패 페이지가 성공 경로로 새지 않는다"이다.
      //
      // 라운드 69 리뷰 P-4: 그래서 단언도 **우리 것이 아닌 문자열에 기대지 않는 선까지만** 조인다.
      // 종전에는 목적지 URL까지 포함한 전문을 요구해서, express가 그 예의 문구의 문법(URL 이스케이프
      // 방식·문장)을 바꾸는 마이너 업그레이드가 이 스위트를 빨갛게 만들 수 있었다 — 우리 계약은
      // 위의 `Location` 헤더가 이미 못 박고 있다. 여기서는 "그 자리에 express의 302 본문이 서 있고,
      // 우리 실패 페이지가 새지 않았다"만 본다.
      expect(browser.text).toContain("Found. Redirecting to");
      expect(browser.text ?? "").not.toContain("이 구매 링크는 지금 열 수 없어요");

      // 클릭 행 생성 순서도 그대로다 — 성공 두 번이면 두 행.
      const clicks = await prisma.affiliateClick.findMany({ where: { productLinkId: link.id } });
      expect(clicks).toHaveLength(2);
    });

    it("renders a self-contained Korean page (404, text/html, no-store, DENY, noindex) for an unknown code", async () => {
      const response = await request(app.getHttpServer())
        .get("/api/v1/r/does-not-exist")
        .set("Accept", BROWSER_ACCEPT)
        .redirects(0);

      expect(response.status).toBe(404);
      expect(response.headers["content-type"]).toMatch(/^text\/html/);
      expect(response.headers["cache-control"]).toBe("no-store");
      expect(response.headers["x-frame-options"]).toBe("DENY");
      // 라운드 69 리뷰 P-1: 본문이 Accept에 따라 갈리는 응답이므로 캐시에게 그 사실을 말한다.
      expect(response.headers.vary?.toLowerCase()).toContain("accept");
      expect(response.text).toContain('<meta name="robots" content="noindex">');
      expect(response.text).toContain('<html lang="ko">');
      expect(response.text).toContain("이 구매 링크는 지금 열 수 없어요.");
      expect(response.text).toContain("우리아이 앱의 준비템에서 지금 열 수 있는 구매 링크를 확인할 수 있어요.");
    });

    it("never leaks the JSON envelope's internals (error code, server message, requestId) or the requested code", async () => {
      const response = await request(app.getHttpServer())
        .get("/api/v1/r/leak-probe-code")
        .set("Accept", BROWSER_ACCEPT)
        .redirects(0);

      expect(response.status).toBe(404);
      expect(response.text).not.toContain("PRODUCT_LINK_NOT_FOUND");
      expect(response.text).not.toContain("상품 링크를 찾을 수 없어요");
      expect(response.text).not.toContain("requestId");
      // 요청한 코드를 되비추지 않는다(이스케이프 문제·오라클 여지가 함께 사라진다).
      expect(response.text).not.toContain("leak-probe-code");
    });

    it("recommends no other seller: the page carries no link at all (DNC-010 / DNC-011)", async () => {
      const response = await request(app.getHttpServer())
        .get("/api/v1/r/does-not-exist")
        .set("Accept", BROWSER_ACCEPT)
        .redirects(0);

      expect(response.text).not.toContain("<a ");
      expect(response.text).not.toContain("href=");
      expect(response.text).not.toContain("http://");
      expect(response.text).not.toContain("https://");
      // 제휴 고지(DNC-010)가 필요한 구매 CTA 자체가 없다.
      expect(response.text).not.toContain("수수료");
    });

    it("serves the SAME page byte-for-byte for unknown / inactive / blocked-domain, and logs no click (no existence oracle)", async () => {
      const inactive = await createProductLink({ url: "https://link.coupang.com/a/inactive-html", active: false });
      const blocked = await createProductLink({ url: "https://evil-coupang.com/not-allowed-html" });

      const [unknownRes, inactiveRes, blockedRes] = await Promise.all([
        request(app.getHttpServer()).get("/api/v1/r/does-not-exist").set("Accept", BROWSER_ACCEPT).redirects(0),
        request(app.getHttpServer())
          .get(`/api/v1/r/${inactive.redirectCode}`)
          .set("Accept", BROWSER_ACCEPT)
          .redirects(0),
        request(app.getHttpServer()).get(`/api/v1/r/${blocked.redirectCode}`).set("Accept", BROWSER_ACCEPT).redirects(0)
      ]);

      for (const response of [unknownRes, inactiveRes, blockedRes]) {
        expect(response.status).toBe(404);
        expect(response.headers["content-type"]).toMatch(/^text\/html/);
      }
      // 세 갈래의 본문이 바이트 단위로 같다 — 무엇이 왜 실패했는지 화면이 말하지 않는다.
      expect(Buffer.from(inactiveRes.text, "utf8").equals(Buffer.from(unknownRes.text, "utf8"))).toBe(true);
      expect(Buffer.from(blockedRes.text, "utf8").equals(Buffer.from(unknownRes.text, "utf8"))).toBe(true);

      // 실패에는 여전히 클릭 행을 남기지 않는다.
      const clicks = await prisma.affiliateClick.findMany({
        where: { productLinkId: { in: [inactive.id, blocked.id] } }
      });
      expect(clicks).toHaveLength(0);
    });

    it("leaves the JSON contract as the default: an explicit application/json client still gets the old envelope", async () => {
      const inactive = await createProductLink({ url: "https://link.coupang.com/a/inactive-json", active: false });

      const response = await request(app.getHttpServer())
        .get(`/api/v1/r/${inactive.redirectCode}`)
        .set("Accept", "application/json")
        .redirects(0);

      expect(response.status).toBe(404);
      expect(response.headers["content-type"]).toMatch(/^application\/json/);
      expect(response.body.error.code).toBe("PRODUCT_LINK_NOT_FOUND");
      expect(response.body.error.message).toBe("상품 링크를 찾을 수 없어요.");
      expect(response.body.error.requestId).toEqual(expect.any(String));
      expect(response.text).not.toContain("이 구매 링크는 지금 열 수 없어요");
      // 라운드 69 리뷰 P-1: JSON 갈래에도 같은 `Vary`가 선다 — 협상이 일어나는 자리는 한
      // 응답이 아니라 **이 URL**이라, 두 표현 중 하나만 표시하면 캐시는 나머지 하나를 잘못 준다.
      expect(response.headers.vary?.toLowerCase()).toContain("accept");
    });

    it("keeps JSON for a wildcard Accept too (curl's default -- the smoke script's 404 check is unaffected)", async () => {
      const response = await request(app.getHttpServer())
        .get("/api/v1/r/does-not-exist")
        .set("Accept", "*/*")
        .redirects(0);

      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe("PRODUCT_LINK_NOT_FOUND");
      expect(response.headers["content-type"]).toMatch(/^application\/json/);
    });
  });
});
