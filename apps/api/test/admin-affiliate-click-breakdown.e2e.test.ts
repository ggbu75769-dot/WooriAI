import type { INestApplication } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { generate as generateTotp } from "otplib";
import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { getSeoulToday } from "@wooriai/domain";
import { hashAdminPassword } from "../src/admin/admin-password";
import { AppModule } from "../src/app.module";
import { configureApiApp } from "../src/bootstrap";
import { PrismaService } from "../src/prisma/prisma.service";

const PASSWORD = "adm123-e2e-password-1";
const DAY_MS = 24 * 60 * 60 * 1000;
/** 이 스위트가 만드는 준비템 코드 접두 (아래 선제 정리의 식별자). */
const FIXTURE_ITEM_CODE_PREFIX = "adm123-";

/**
 * TEST-131: 이전 실행이 크래시로 afterEach를 못 돌았을 때 남는 이 스위트 소유의
 * 준비템/링크/클릭을 시작 전에 지운다. 자기 접두에 걸리는 행만 건드린다.
 *
 * afterEach의 주석이 말하는 눈덩이를 크래시 경로에서도 막는 장치다: 남은 클릭이
 * `windowMaxCount` 기준선을 계속 끌어올리면 다음 실행이 심어야 할 클릭 수가 실행마다
 * 불어나고, 이 배타 스위트가 워커 풀을 붙잡는 시간도 같이 늘어난다.
 *
 * R31 리뷰 F6 (자가 봉쇄 예방): 마이그레이션 000001은 Prisma 스키마에 없는 진짜 SQL FK를
 * 만든다. item_templates / product_links를 **캐스케이드 없이** 참조하는 것은
 * `expenses.linked_item_template_id`와 `expenses.linked_product_link_id` 둘뿐이다. 이
 * 스위트는 지금 지출을 만들지 않으므로 도달 불가 경로지만, 한 번이라도 연결되는 순간
 * 정리가 FK 위반으로 실패하고 그 뒤로는 남은 잔여물이 매 실행을 막는 자가 봉쇄가 된다 —
 * 그래서 지우기 전에 **null로 끊기만** 한다(지출 자체는 남의 것일 수 있어 삭제하지 않는다).
 *
 * ⚠ 이 스위트가 나중에 자기 카탈로그 행을 import_rows·attachments 같은 다른 테이블에
 * 연결하게 되면 이 헬퍼도 같이 넓혀야 한다. (현재 그 둘은 expenses(id)만 참조한다.)
 */
async function removeOwnFixtureLeftovers(prisma: PrismaClient) {
  const staleTemplates = await prisma.itemTemplate.findMany({
    where: { code: { startsWith: FIXTURE_ITEM_CODE_PREFIX } },
    select: { id: true }
  });
  if (staleTemplates.length === 0) return;

  const templateIds = staleTemplates.map((template) => template.id);
  const itemTemplateId = { in: templateIds };
  const staleLinks = await prisma.productLink.findMany({ where: { itemTemplateId }, select: { id: true } });
  await prisma.expense.updateMany({
    where: { linkedItemTemplateId: { in: templateIds } },
    data: { linkedItemTemplateId: null }
  });
  if (staleLinks.length > 0) {
    await prisma.expense.updateMany({
      where: { linkedProductLinkId: { in: staleLinks.map((link) => link.id) } },
      data: { linkedProductLinkId: null }
    });
  }
  await prisma.affiliateClick.deleteMany({ where: { itemTemplateId } });
  await prisma.childItemStatus.deleteMany({ where: { itemTemplateId } });
  await prisma.productLink.deleteMany({ where: { itemTemplateId } });
  await prisma.itemTemplate.deleteMany({ where: { id: itemTemplateId } });
}

type TopLink = {
  productLinkId: string;
  productLinkTitle: string | null;
  itemTemplateId: string | null;
  itemTemplateName: string | null;
  platform: string | null;
  count: number;
};

type Summary = {
  totalClicks: number;
  byPlatform: { platform: string; count: number }[];
  days: number;
  windowTotalClicks: number;
  topLinks: TopLink[];
  dailyTotals: { date: string; count: number }[];
};

type SeededLink = {
  templateId: string;
  templateName: string;
  linkId: string;
  linkTitle: string;
  platform: "coupang" | "naver" | "custom";
};

function freshEmail(prefix: string) {
  return `${prefix}-${randomUUID()}@wooriai.local`;
}

function parseSetCookies(response: request.Response): Record<string, string> {
  const raw = response.headers["set-cookie"];
  const setCookieHeaders: string[] = Array.isArray(raw) ? raw : raw ? [raw] : [];
  const cookies: Record<string, string> = {};
  for (const header of setCookieHeaders) {
    const [pair] = header.split(";");
    const separatorIndex = pair.indexOf("=");
    if (separatorIndex === -1) continue;
    cookies[pair.slice(0, separatorIndex).trim()] = pair.slice(separatorIndex + 1).trim();
  }
  return cookies;
}

function cookieHeader(cookies: Record<string, string>): string {
  return Object.entries(cookies)
    .map(([name, value]) => `${name}=${value}`)
    .join("; ");
}

/** Noon (Seoul) `daysAgo` Seoul-calendar days before today — unambiguously
 * inside that calendar day no matter when within the day the test runs. */
function seoulNoonDaysAgo(daysAgo: number): Date {
  return new Date(new Date(`${getSeoulToday()}T12:00:00+09:00`).getTime() - daysAgo * DAY_MS);
}

function dailyCount(summary: Summary, date: string): number {
  return summary.dailyTotals.find((entry) => entry.date === date)?.count ?? 0;
}

function topLink(summary: Summary, productLinkId: string): TopLink | undefined {
  return summary.topLinks.find((entry) => entry.productLinkId === productLinkId);
}

/** 상위 N(10) 표에 확실히 들어가도록, 현재 윈도우 1위 클릭 수를 기준선으로 쓴다.
 * 공유 테스트 DB에는 다른 스위트가 남긴 클릭이 누적돼 있어 절대값을 못 쓴다. */
function windowMaxCount(...summaries: Summary[]): number {
  return Math.max(0, ...summaries.map((summary) => summary.topLinks[0]?.count ?? 0));
}

// ADM-123: GET /admin/affiliate-clicks/summary — 플랫폼 총계(전체 기간, 기존
// 계약) + 기간 분해(상위 링크 / 일별 추이). 읽기 전용, 모든 관리자 역할.
describe("Admin affiliate click breakdown (ADM-123)", () => {
  let app: INestApplication;
  let moduleRef: TestingModule;
  let prisma: PrismaService;
  let seeded: SeededLink[] = [];
  let cleanupPrisma: PrismaClient;

  beforeAll(async () => {
    cleanupPrisma = new PrismaClient();
    await removeOwnFixtureLeftovers(cleanupPrisma);
  });

  afterAll(async () => {
    await removeOwnFixtureLeftovers(cleanupPrisma);
    await cleanupPrisma.$disconnect();
  });

  beforeEach(async () => {
    process.env.JWT_ACCESS_SECRET = "test-access-secret";
    process.env.JWT_REFRESH_SECRET = "test-refresh-secret";
    process.env.WOORIAI_ADMIN_TOKEN = "test-legacy-admin-token";

    seeded = [];
    moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApiApp(app);
    await app.init();
    prisma = moduleRef.get(PrismaService);
  });

  afterEach(async () => {
    // 이 파일이 만든 클릭/링크/준비템만 되돌린다. 남겨두면 다음 실행의
    // "윈도우 1위 클릭 수" 기준선이 계속 커져 시드량이 눈덩이처럼 불어난다.
    if (seeded.length > 0) {
      const linkIds = seeded.map((entry) => entry.linkId);
      const templateIds = seeded.map((entry) => entry.templateId);
      await prisma.affiliateClick.deleteMany({ where: { productLinkId: { in: linkIds } } });
      await prisma.productLink.deleteMany({ where: { id: { in: linkIds } } });
      await prisma.itemTemplate.deleteMany({ where: { id: { in: templateIds } } });
    }
    await app.close();
  });

  async function createAdmin(email: string, role: "admin" | "editor" | "analyst") {
    return prisma.adminUser.create({
      data: { email, passwordHash: hashAdminPassword(PASSWORD), displayName: email, role, active: true }
    });
  }

  /** admin-analytics-summary.e2e.test.ts와 동일한 실제 플로우: 비밀번호 로그인 + TOTP 등록. */
  async function loginAndEnroll(email: string) {
    const loginResponse = await request(app.getHttpServer())
      .post("/api/v1/admin/auth/login")
      .send({ email, password: PASSWORD })
      .expect(200);
    expect(loginResponse.body.mfaRequired).toBe(false);

    const cookies = parseSetCookies(loginResponse);
    const cookie = cookieHeader(cookies);
    const csrfToken = cookies.admin_csrf;

    const setupStart = await request(app.getHttpServer())
      .post("/api/v1/admin/auth/mfa/setup/start")
      .set("Cookie", cookie)
      .set("X-CSRF-Token", csrfToken)
      .expect(200);
    const secret = setupStart.body.secret as string;
    await request(app.getHttpServer())
      .post("/api/v1/admin/auth/mfa/setup/verify")
      .set("Cookie", cookie)
      .set("X-CSRF-Token", csrfToken)
      .send({ code: await generateTotp({ secret }) })
      .expect(200);

    return { cookie, csrfToken };
  }

  async function fetchSummary(cookie: string, days?: number): Promise<Summary> {
    const response = await request(app.getHttpServer())
      .get(`/api/v1/admin/affiliate-clicks/summary${days === undefined ? "" : `?days=${days}`}`)
      .set("Cookie", cookie)
      .expect(200);
    return response.body as Summary;
  }

  /** 준비템 + 상품 링크 한 쌍(집계가 이름/리테일러를 붙일 대상). */
  async function seedLink(platform: "coupang" | "naver" | "custom", label: string): Promise<SeededLink> {
    const suffix = randomUUID();
    const template = await prisma.itemTemplate.create({
      data: {
        code: `${FIXTURE_ITEM_CODE_PREFIX}${label}-${suffix}`,
        name: `ADM123 준비템 ${label}`,
        necessityLevel: "essential",
        reasonText: "ADM-123 집계 테스트용",
        active: false
      }
    });
    const link = await prisma.productLink.create({
      data: {
        itemTemplateId: template.id,
        platform,
        title: `ADM123 링크 ${label}`,
        url: "https://example.test/adm123",
        active: false
      }
    });
    const entry: SeededLink = {
      templateId: template.id,
      templateName: template.name,
      linkId: link.id,
      linkTitle: link.title,
      platform
    };
    seeded.push(entry);
    return entry;
  }

  async function seedClicks(link: SeededLink, clickedAt: Date, times: number) {
    await prisma.affiliateClick.createMany({
      data: Array.from({ length: times }, () => ({
        itemTemplateId: link.templateId,
        productLinkId: link.linkId,
        platform: link.platform,
        clickedAt
      }))
    });
  }

  it("rejects unauthenticated requests (401 for a bad session cookie, legacy-guard 403 with no credentials)", async () => {
    await request(app.getHttpServer())
      .get("/api/v1/admin/affiliate-clicks/summary")
      .set("Cookie", "admin_session=not-a-real-session")
      .expect(401)
      .expect(({ body }) => expect(body.error.code).toBe("ADMIN_UNAUTHORIZED"));

    await request(app.getHttpServer())
      .get("/api/v1/admin/affiliate-clicks/summary")
      .expect(403)
      .expect(({ body }) => expect(body.error.code).toBe("ADMIN_FORBIDDEN"));
  });

  it("rejects any days outside {7, 30} with 400 VALIDATION_ERROR", async () => {
    const email = freshEmail("adm123-days");
    await createAdmin(email, "admin");
    const { cookie } = await loginAndEnroll(email);

    for (const bad of ["14", "0", "-7", "abc", "7.5", ""]) {
      await request(app.getHttpServer())
        .get(`/api/v1/admin/affiliate-clicks/summary?days=${bad}`)
        .set("Cookie", cookie)
        .expect(400)
        .expect(({ body }) => expect(body.error.code).toBe("VALIDATION_ERROR"));
    }
  });

  it("keeps the legacy shape and adds the breakdown for every admin role, defaulting to days=7", async () => {
    for (const role of ["admin", "editor", "analyst"] as const) {
      const email = freshEmail(`adm123-${role}`);
      await createAdmin(email, role);
      const { cookie } = await loginAndEnroll(email);

      const summary = await fetchSummary(cookie);

      // 기존 계약(전체 기간 누적)은 그대로.
      expect(typeof summary.totalClicks).toBe("number");
      expect(Array.isArray(summary.byPlatform)).toBe(true);
      expect(summary.byPlatform.reduce((sum, entry) => sum + entry.count, 0)).toBe(summary.totalClicks);

      // 덧붙인 기간 분해.
      expect(summary.days).toBe(7);
      expect(summary.dailyTotals).toHaveLength(7);
      expect(summary.dailyTotals[6].date).toBe(getSeoulToday());
      const dates = summary.dailyTotals.map((entry) => entry.date);
      expect([...dates].sort()).toEqual(dates);
      expect(summary.dailyTotals.reduce((sum, entry) => sum + entry.count, 0)).toBe(summary.windowTotalClicks);
      expect(summary.windowTotalClicks).toBeLessThanOrEqual(summary.totalClicks);
      expect(summary.topLinks.length).toBeLessThanOrEqual(10);
      // 상위 링크는 클릭 수 내림차순.
      const counts = summary.topLinks.map((entry) => entry.count);
      expect([...counts].sort((a, b) => b - a)).toEqual(counts);
      // DNC-009: 응답에는 수수료/점수 관련 필드가 없다 — 열람용 집계일 뿐이다.
      for (const entry of summary.topLinks) {
        expect(Object.keys(entry).sort()).toEqual(
          ["count", "itemTemplateId", "itemTemplateName", "platform", "productLinkId", "productLinkTitle"].sort()
        );
      }

      const summary30 = await fetchSummary(cookie, 30);
      expect(summary30.days).toBe(30);
      expect(summary30.dailyTotals).toHaveLength(30);
      expect(summary30.dailyTotals[29].date).toBe(getSeoulToday());
      expect(summary30.windowTotalClicks).toBeGreaterThanOrEqual(summary.windowTotalClicks);
    }
  });

  it("ranks links by click count in the window and resolves 준비템 이름·리테일러", async () => {
    const email = freshEmail("adm123-rank");
    await createAdmin(email, "analyst");
    const { cookie } = await loginAndEnroll(email);

    const hot = await seedLink("coupang", "hot");
    const warm = await seedLink("naver", "warm");
    const cold = await seedLink("custom", "cold");

    // 델타 검증: 공유 테스트 DB에 다른 스위트의 클릭 행이 남아 있다.
    const before = await fetchSummary(cookie, 7);
    const baseline = windowMaxCount(before);

    await seedClicks(hot, seoulNoonDaysAgo(0), baseline + 30);
    await seedClicks(warm, seoulNoonDaysAgo(1), baseline + 20);
    await seedClicks(cold, seoulNoonDaysAgo(2), baseline + 10);
    const addedClicks = 3 * baseline + 60;

    const after = await fetchSummary(cookie, 7);

    expect(after.windowTotalClicks - before.windowTotalClicks).toBe(addedClicks);
    expect(after.totalClicks - before.totalClicks).toBe(addedClicks);

    // 세 링크가 기준선을 넘겼으니 상위 3위를 그대로 차지한다.
    expect(after.topLinks.slice(0, 3).map((entry) => entry.productLinkId)).toEqual([
      hot.linkId,
      warm.linkId,
      cold.linkId
    ]);

    const hotRow = topLink(after, hot.linkId);
    expect(hotRow?.count).toBe(baseline + 30);
    expect(hotRow?.itemTemplateId).toBe(hot.templateId);
    expect(hotRow?.itemTemplateName).toBe(hot.templateName);
    expect(hotRow?.productLinkTitle).toBe(hot.linkTitle);
    expect(hotRow?.platform).toBe("coupang");

    expect(topLink(after, warm.linkId)?.count).toBe(baseline + 20);
    expect(topLink(after, warm.linkId)?.platform).toBe("naver");
    expect(topLink(after, cold.linkId)?.count).toBe(baseline + 10);
    expect(topLink(after, cold.linkId)?.platform).toBe("custom");
  });

  it("applies the window boundary: 7d excludes clicks that the 30d window still counts", async () => {
    const email = freshEmail("adm123-window");
    await createAdmin(email, "analyst");
    const { cookie } = await loginAndEnroll(email);

    const link = await seedLink("coupang", "window");

    const before7 = await fetchSummary(cookie, 7);
    const before30 = await fetchSummary(cookie, 30);
    const baseline = windowMaxCount(before7, before30);

    // 7일 창은 "오늘 포함 최근 7일" = 6일 전까지 포함, 7일 전은 제외.
    await seedClicks(link, seoulNoonDaysAgo(0), baseline + 30);
    await seedClicks(link, seoulNoonDaysAgo(6), 10);
    await seedClicks(link, seoulNoonDaysAgo(7), 40);
    // 30일 창은 29일 전까지 포함, 30일 전은 제외.
    await seedClicks(link, seoulNoonDaysAgo(29), 20);
    await seedClicks(link, seoulNoonDaysAgo(30), 50);

    const after7 = await fetchSummary(cookie, 7);
    const after30 = await fetchSummary(cookie, 30);

    // 7일: 오늘(baseline+30) + 6일 전(10). 7일/29일/30일 전은 창 밖.
    expect(after7.windowTotalClicks - before7.windowTotalClicks).toBe(baseline + 40);
    expect(topLink(after7, link.linkId)?.count).toBe(baseline + 40);
    // 30일: 위 둘 + 7일 전(40) + 29일 전(20). 30일 전(50)만 창 밖.
    expect(after30.windowTotalClicks - before30.windowTotalClicks).toBe(baseline + 100);
    expect(topLink(after30, link.linkId)?.count).toBe(baseline + 100);

    // 일별 버킷이 서울 기준 날짜에 정확히 떨어지고, 창 밖 날짜는 아예 없다.
    const today = getSeoulToday();
    const sixDaysAgo = getSeoulToday(seoulNoonDaysAgo(6));
    expect(dailyCount(after7, today) - dailyCount(before7, today)).toBe(baseline + 30);
    expect(dailyCount(after7, sixDaysAgo) - dailyCount(before7, sixDaysAgo)).toBe(10);
    expect(after7.dailyTotals.some((entry) => entry.date === getSeoulToday(seoulNoonDaysAgo(7)))).toBe(false);

    const twentyNineDaysAgo = getSeoulToday(seoulNoonDaysAgo(29));
    expect(dailyCount(after30, twentyNineDaysAgo) - dailyCount(before30, twentyNineDaysAgo)).toBe(20);
    expect(after30.dailyTotals.some((entry) => entry.date === getSeoulToday(seoulNoonDaysAgo(30)))).toBe(false);
    // 총합은 언제나 일별 합계와 일치한다.
    expect(after30.dailyTotals.reduce((sum, entry) => sum + entry.count, 0)).toBe(after30.windowTotalClicks);
  });

  it("has the ADM-123 aggregation index (migration 000016)", async () => {
    const rows = await prisma.$queryRaw<{ indexdef: string }[]>`
      SELECT indexdef FROM pg_indexes
      WHERE schemaname = 'public'
        AND tablename = 'affiliate_clicks'
        AND indexname = 'idx_affiliate_clicks_clicked_product'`;
    expect(rows[0]?.indexdef).toBeDefined();
    expect(rows[0].indexdef).toContain("(clicked_at, product_link_id)");
  });
});
