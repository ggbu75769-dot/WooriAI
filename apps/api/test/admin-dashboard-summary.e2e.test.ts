import type { INestApplication } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import { randomUUID } from "node:crypto";
import { generate as generateTotp } from "otplib";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { hashAdminPassword } from "../src/admin/admin-password";
import { AppModule } from "../src/app.module";
import { configureApiApp } from "../src/bootstrap";
import { PrismaService } from "../src/prisma/prisma.service";

const PASSWORD = "adm008-e2e-password-1";

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

const SUMMARY_KEYS = [
  "activeUsers",
  "households",
  "childrenCount",
  "expensesTotal",
  "affiliateClicks7d",
  "analyticsEvents7d",
  "pendingContentRevisions",
  "productLinksBrokenCount",
  // UX-X(R43) M-4: 링크 헬스는 활성 링크(active=true) 안에서만 세고, "아직 한 번도
  // 검사되지 않은 활성 링크" 수를 함께 내려준다 — 어드민 대시보드가 "깨짐 0"을
  // 전수 검사 결과인 양 보여주지 않으려면 미검사 수가 필요하다.
  "productLinksActiveCount",
  "productLinksUncheckedCount"
] as const;

type Summary = Record<(typeof SUMMARY_KEYS)[number], number>;

// ADM-008: GET /admin/dashboard/summary — 운영 현황 카운터 (읽기 전용, 모든 관리자 역할).
describe("Admin dashboard summary (ADM-008)", () => {
  let app: INestApplication;
  let moduleRef: TestingModule;
  let prisma: PrismaService;

  beforeEach(async () => {
    process.env.JWT_ACCESS_SECRET = "test-access-secret";
    process.env.JWT_REFRESH_SECRET = "test-refresh-secret";
    process.env.WOORIAI_ADMIN_TOKEN = "test-legacy-admin-token";

    moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApiApp(app);
    await app.init();
    prisma = moduleRef.get(PrismaService);
  });

  afterEach(async () => {
    await app.close();
  });

  async function createAdmin(email: string, role: "admin" | "editor" | "analyst") {
    return prisma.adminUser.create({
      data: { email, passwordHash: hashAdminPassword(PASSWORD), displayName: email, role, active: true }
    });
  }

  /** admin-users.e2e.test.ts와 동일한 실제 플로우: 비밀번호 로그인 + TOTP 등록. */
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

  async function fetchSummary(cookie: string): Promise<Summary> {
    const response = await request(app.getHttpServer())
      .get("/api/v1/admin/dashboard/summary")
      .set("Cookie", cookie)
      .expect(200);
    return response.body as Summary;
  }

  it("rejects unauthenticated requests (401 for a bad session cookie, legacy-guard 403 with no credentials)", async () => {
    // Invalid/expired admin_session cookie: the real session path fails with 401.
    await request(app.getHttpServer())
      .get("/api/v1/admin/dashboard/summary")
      .set("Cookie", "admin_session=not-a-real-session")
      .expect(401)
      .expect(({ body }) => expect(body.error.code).toBe("ADMIN_UNAUTHORIZED"));

    // No credentials at all: falls through to the dev/test-only legacy
    // x-admin-token guard, which fails closed with 403 (same as every other
    // admin route in this repo's test environment).
    await request(app.getHttpServer())
      .get("/api/v1/admin/dashboard/summary")
      .expect(403)
      .expect(({ body }) => expect(body.error.code).toBe("ADMIN_FORBIDDEN"));
  });

  it("returns every counter as a number for an analyst session (read-only, no RBAC restriction)", async () => {
    const analystEmail = freshEmail("adm008-analyst");
    await createAdmin(analystEmail, "analyst");
    const analyst = await loginAndEnroll(analystEmail);

    const summary = await fetchSummary(analyst.cookie);
    expect(Object.keys(summary).sort()).toEqual([...SUMMARY_KEYS].sort());
    for (const key of SUMMARY_KEYS) {
      expect(typeof summary[key], key).toBe("number");
      expect(summary[key], key).toBeGreaterThanOrEqual(0);
      expect(Number.isInteger(summary[key]), key).toBe(true);
    }
  });

  it("counts seeded data correctly: active-only users, 7d windows, in_review revisions, broken links", async () => {
    const adminEmail = freshEmail("adm008-admin");
    const adminRow = await createAdmin(adminEmail, "admin");
    const admin = await loginAndEnroll(adminEmail);

    const before = await fetchSummary(admin.cookie);

    // Users: one active and one withdrawn — only the active one may count.
    const activeUser = await prisma.user.create({
      data: { authProvider: "kakao", providerUserId: `adm008-active-${randomUUID()}`, status: "active" }
    });
    await prisma.user.create({
      data: { authProvider: "kakao", providerUserId: `adm008-withdrawn-${randomUUID()}`, status: "withdrawn" }
    });

    const household = await prisma.household.create({
      data: { name: "ADM008 가구", ownerUserId: activeUser.id }
    });
    const child = await prisma.child.create({
      data: { householdId: household.id, nickname: "adm008-child", stageMode: "born", birthDate: new Date("2025-01-01") }
    });

    const category = await prisma.category.findFirstOrThrow();
    await prisma.expense.create({
      data: {
        householdId: household.id,
        childId: child.id,
        createdByUserId: activeUser.id,
        categoryId: category.id,
        amountKrw: 12000,
        spentOn: new Date("2026-08-01"),
        itemName: "adm008-expense"
      }
    });

    // Affiliate clicks: one inside the 7d window, one 8 days old (excluded).
    const productLink = await prisma.productLink.findFirstOrThrow();
    const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
    await prisma.affiliateClick.create({
      data: { itemTemplateId: productLink.itemTemplateId, productLinkId: productLink.id, platform: productLink.platform }
    });
    await prisma.affiliateClick.create({
      data: {
        itemTemplateId: productLink.itemTemplateId,
        productLinkId: productLink.id,
        platform: productLink.platform,
        clickedAt: eightDaysAgo
      }
    });

    // Analytics events — PERF-115(F1): the 7d count follows occurredAt (event
    // occurrence time, same semantics as the analytics-summary KPI screen),
    // NOT receivedAt. One occurred now (counted), one occurred+received 8 days
    // ago (excluded), and one occurred 8 days ago but only received now — a
    // late-arriving backfill — which the old receivedAt-based count would have
    // included and the occurredAt-based count must exclude.
    await prisma.analyticsEvent.create({
      data: {
        eventName: "app_opened",
        eventVersion: 1,
        eventId: randomUUID(),
        occurredAt: new Date(),
        payload: {}
      }
    });
    await prisma.analyticsEvent.create({
      data: {
        eventName: "app_opened",
        eventVersion: 1,
        eventId: randomUUID(),
        occurredAt: eightDaysAgo,
        receivedAt: eightDaysAgo,
        payload: {}
      }
    });
    await prisma.analyticsEvent.create({
      data: {
        eventName: "app_opened",
        eventVersion: 1,
        eventId: randomUUID(),
        occurredAt: eightDaysAgo,
        // receivedAt defaults to now() — received inside the window, but the
        // occurrence is outside it, so it must not be counted.
        payload: {}
      }
    });

    // Content revisions: one in_review (counted) and one draft (not counted).
    await prisma.contentRevision.create({
      data: {
        entityType: "disclosure",
        revisionNo: 1,
        payload: { text: "adm008" },
        status: "in_review",
        authorAdminId: adminRow.id,
        submittedAt: new Date()
      }
    });
    await prisma.contentRevision.create({
      data: {
        entityType: "disclosure",
        revisionNo: 1,
        payload: { text: "adm008-draft" },
        status: "draft",
        authorAdminId: adminRow.id
      }
    });

    // Product links. UX-X(R43) M-4: every health counter is scoped to
    // active=true, and an active link with no verdict yet counts as 미검사.
    //  - active + broken   -> broken +1, active +1
    //  - active + ok       -> active +1 only
    //  - INACTIVE + broken -> nothing (a link users can't see isn't a broken 구매처)
    //  - active + no verdict -> unchecked +1, active +1
    await prisma.productLink.create({
      data: {
        itemTemplateId: productLink.itemTemplateId,
        platform: "custom",
        title: "adm008 broken link",
        url: "https://example.com/adm008-broken",
        healthStatus: "broken"
      }
    });
    await prisma.productLink.create({
      data: {
        itemTemplateId: productLink.itemTemplateId,
        platform: "custom",
        title: "adm008 healthy link",
        url: "https://example.com/adm008-ok",
        healthStatus: "ok"
      }
    });
    await prisma.productLink.create({
      data: {
        itemTemplateId: productLink.itemTemplateId,
        platform: "custom",
        title: "adm008 retired broken link",
        url: "https://example.com/adm008-retired",
        active: false,
        healthStatus: "broken"
      }
    });
    await prisma.productLink.create({
      data: {
        itemTemplateId: productLink.itemTemplateId,
        platform: "custom",
        title: "adm008 never checked link",
        url: "https://example.com/adm008-unchecked",
        // affiliateUrl 없음 = link-health.job.ts의 검사 대상이 아니라 영원히 NULL로 남는다.
        healthStatus: null
      }
    });

    const after = await fetchSummary(admin.cookie);

    // Delta assertions: every counter here is a database-wide `count()` with no
    // filter this test could scope to its own rows, so the only handle is the
    // before/after difference. That is exactly why this file takes the shared-DB
    // lock exclusively (test/helpers/db-lock.setup.ts) — a single row another
    // suite inserts between the two snapshots would land in the delta.
    expect(after.activeUsers - before.activeUsers).toBe(1);
    expect(after.households - before.households).toBe(1);
    expect(after.childrenCount - before.childrenCount).toBe(1);
    expect(after.expensesTotal - before.expensesTotal).toBe(1);
    expect(after.affiliateClicks7d - before.affiliateClicks7d).toBe(1);
    expect(after.analyticsEvents7d - before.analyticsEvents7d).toBe(1);
    expect(after.pendingContentRevisions - before.pendingContentRevisions).toBe(1);
    // 비활성 깨진 링크는 세지 않는다 — 4개를 만들었지만 깨짐은 활성 1개뿐이다.
    expect(after.productLinksBrokenCount - before.productLinksBrokenCount).toBe(1);
    expect(after.productLinksActiveCount - before.productLinksActiveCount).toBe(3);
    expect(after.productLinksUncheckedCount - before.productLinksUncheckedCount).toBe(1);
  });
});
