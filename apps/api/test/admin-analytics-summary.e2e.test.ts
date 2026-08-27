import type { INestApplication } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import { randomUUID } from "node:crypto";
import { generate as generateTotp } from "otplib";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getSeoulToday } from "@wooriai/domain";
import { hashAdminPassword } from "../src/admin/admin-password";
import { AppModule } from "../src/app.module";
import { configureApiApp } from "../src/bootstrap";
import { PrismaService } from "../src/prisma/prisma.service";

const PASSWORD = "adm009-e2e-password-1";
const DAY_MS = 24 * 60 * 60 * 1000;

// Canonical registry order (packages/contracts/src/analytics.ts) — the byName
// contract zero-fills exactly these six names, in this order, before any
// unregistered stragglers.
const REGISTRY_EVENT_NAMES = [
  "app_opened",
  "onboarding_completed",
  "expense_recorded",
  "expense_synced",
  "item_status_changed",
  "affiliate_link_clicked"
] as const;

const FUNNEL_KEYS = [
  "appOpened",
  "onboardingCompleted",
  "expenseRecorded",
  "itemStatusChanged",
  "affiliateLinkClicked",
  "expenseSynced"
] as const;

type Summary = {
  days: number;
  totalEvents: number;
  byName: { name: string; count: number }[];
  dailyTotals: { date: string; count: number }[];
  funnel: Record<(typeof FUNNEL_KEYS)[number], number>;
  // ANA-128: purchase_followup_answered의 payload.answer 3갈래 분해.
  purchaseFollowup: { purchased: number; notPurchased: number; dismissed: number };
  uniqueAnonUsers: number;
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

function byNameCount(summary: Summary, name: string): number {
  return summary.byName.find((entry) => entry.name === name)?.count ?? 0;
}

function dailyCount(summary: Summary, date: string): number {
  return summary.dailyTotals.find((entry) => entry.date === date)?.count ?? 0;
}

// ADM-009: GET /admin/analytics/summary — KPI 퍼널용 이벤트 집계 (읽기 전용, 모든 관리자 역할).
describe("Admin analytics summary (ADM-009)", () => {
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

  /** admin-dashboard-summary.e2e.test.ts와 동일한 실제 플로우: 비밀번호 로그인 + TOTP 등록. */
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
      .get(`/api/v1/admin/analytics/summary${days === undefined ? "" : `?days=${days}`}`)
      .set("Cookie", cookie)
      .expect(200);
    return response.body as Summary;
  }

  /** Direct-prisma seeding (same table the ANA-101 ingestion endpoint writes),
   * so the test controls occurredAt and user_anon_id exactly. */
  async function seedEvent(
    eventName: string,
    occurredAt: Date,
    userAnonId: string | null,
    // ANA-128: 이 스위트가 심는 페이로드는 문자열 값(answer/platform)뿐이고,
    // 레거시/손상 케이스로 null도 넣는다.
    payload: Record<string, string | null> = {}
  ) {
    await prisma.analyticsEvent.create({
      data: {
        eventName,
        eventVersion: 1,
        eventId: randomUUID(),
        occurredAt,
        userAnonId,
        payload
      }
    });
  }

  it("rejects unauthenticated requests (401 for a bad session cookie, legacy-guard 403 with no credentials)", async () => {
    await request(app.getHttpServer())
      .get("/api/v1/admin/analytics/summary")
      .set("Cookie", "admin_session=not-a-real-session")
      .expect(401)
      .expect(({ body }) => expect(body.error.code).toBe("ADMIN_UNAUTHORIZED"));

    await request(app.getHttpServer())
      .get("/api/v1/admin/analytics/summary")
      .expect(403)
      .expect(({ body }) => expect(body.error.code).toBe("ADMIN_FORBIDDEN"));
  });

  it("rejects any days outside {7, 30} with 400 VALIDATION_ERROR", async () => {
    const email = freshEmail("adm009-days");
    await createAdmin(email, "admin");
    const { cookie } = await loginAndEnroll(email);

    for (const bad of ["14", "0", "-7", "abc", "7.5", ""]) {
      await request(app.getHttpServer())
        .get(`/api/v1/admin/analytics/summary?days=${bad}`)
        .set("Cookie", cookie)
        .expect(400)
        .expect(({ body }) => expect(body.error.code).toBe("VALIDATION_ERROR"));
    }
  });

  it("returns the full contract shape for an analyst session (read-only, no RBAC restriction), defaulting to days=7", async () => {
    const email = freshEmail("adm009-analyst");
    await createAdmin(email, "analyst");
    const { cookie } = await loginAndEnroll(email);

    const summary = await fetchSummary(cookie);
    expect(summary.days).toBe(7);
    expect(typeof summary.totalEvents).toBe("number");
    expect(typeof summary.uniqueAnonUsers).toBe("number");

    // byName: all six registry names always present (0 included), registry order first.
    expect(summary.byName.slice(0, 6).map((entry) => entry.name)).toEqual([...REGISTRY_EVENT_NAMES]);
    for (const entry of summary.byName) {
      expect(Number.isInteger(entry.count)).toBe(true);
      expect(entry.count).toBeGreaterThanOrEqual(0);
    }

    // funnel: one convenience alias per registry name, matching byName exactly.
    expect(Object.keys(summary.funnel).sort()).toEqual([...FUNNEL_KEYS].sort());
    expect(summary.funnel.appOpened).toBe(byNameCount(summary, "app_opened"));
    expect(summary.funnel.onboardingCompleted).toBe(byNameCount(summary, "onboarding_completed"));
    expect(summary.funnel.expenseRecorded).toBe(byNameCount(summary, "expense_recorded"));
    expect(summary.funnel.itemStatusChanged).toBe(byNameCount(summary, "item_status_changed"));
    expect(summary.funnel.affiliateLinkClicked).toBe(byNameCount(summary, "affiliate_link_clicked"));
    expect(summary.funnel.expenseSynced).toBe(byNameCount(summary, "expense_synced"));

    // ANA-128: purchaseFollowup은 항상 세 키가 모두 있는 정수 분해다 (0건 포함).
    expect(Object.keys(summary.purchaseFollowup).sort()).toEqual(["dismissed", "notPurchased", "purchased"]);
    for (const value of Object.values(summary.purchaseFollowup)) {
      expect(Number.isInteger(value)).toBe(true);
      expect(value).toBeGreaterThanOrEqual(0);
    }
    // 분해 합계는 이벤트 이름 총계를 넘지 않는다 (answer 없는 행은 무시되므로 작을 수는 있다).
    const classified =
      summary.purchaseFollowup.purchased +
      summary.purchaseFollowup.notPurchased +
      summary.purchaseFollowup.dismissed;
    expect(classified).toBeLessThanOrEqual(byNameCount(summary, "purchase_followup_answered"));

    // dailyTotals: exactly 7 ascending Seoul-calendar days ending today, and
    // their sum reconciles with totalEvents (same occurredAt window).
    expect(summary.dailyTotals).toHaveLength(7);
    expect(summary.dailyTotals[6].date).toBe(getSeoulToday());
    const dates = summary.dailyTotals.map((entry) => entry.date);
    expect([...dates].sort()).toEqual(dates);
    expect(summary.dailyTotals.reduce((sum, entry) => sum + entry.count, 0)).toBe(summary.totalEvents);

    const summary30 = await fetchSummary(cookie, 30);
    expect(summary30.days).toBe(30);
    expect(summary30.dailyTotals).toHaveLength(30);
    expect(summary30.dailyTotals[29].date).toBe(getSeoulToday());
  });

  it("filters by window (7d vs 30d), zero-fills daily buckets, and counts distinct non-null anon users", async () => {
    const email = freshEmail("adm009-window");
    await createAdmin(email, "analyst");
    const { cookie } = await loginAndEnroll(email);

    // Delta assertions: totalEvents / uniqueAnonUsers / dailyTotals are all
    // database-wide aggregates the endpoint offers no way to filter, so the only
    // handle is the before/after difference — which is why this file takes the
    // shared-DB lock exclusively (test/helpers/db-lock.setup.ts).
    const before7 = await fetchSummary(cookie, 7);
    const before30 = await fetchSummary(cookie, 30);

    const anonA = `adm009-anon-a-${randomUUID()}`;
    const anonB = `adm009-anon-b-${randomUUID()}`;
    const anonC = `adm009-anon-c-${randomUUID()}`;
    const anonD = `adm009-anon-d-${randomUUID()}`;

    // In the 7d window: 2 expense_recorded today (same anon user A), 1
    // affiliate_link_clicked two days ago (B), 1 anonymous app_opened today
    // (userAnonId null — must not count toward uniqueAnonUsers).
    await seedEvent("expense_recorded", seoulNoonDaysAgo(0), anonA);
    await seedEvent("expense_recorded", seoulNoonDaysAgo(0), anonA);
    await seedEvent("affiliate_link_clicked", seoulNoonDaysAgo(2), anonB);
    await seedEvent("app_opened", seoulNoonDaysAgo(0), null);
    // In the 30d window only: 1 item_status_changed ten days ago (C).
    await seedEvent("item_status_changed", seoulNoonDaysAgo(10), anonC);
    // Outside both windows: 1 app_opened forty days ago (D).
    await seedEvent("app_opened", seoulNoonDaysAgo(40), anonD);

    const after7 = await fetchSummary(cookie, 7);
    const after30 = await fetchSummary(cookie, 30);

    // 7d: today's 3 + the 2-days-ago click; the 10d and 40d rows are excluded.
    expect(after7.totalEvents - before7.totalEvents).toBe(4);
    expect(byNameCount(after7, "expense_recorded") - byNameCount(before7, "expense_recorded")).toBe(2);
    expect(byNameCount(after7, "affiliate_link_clicked") - byNameCount(before7, "affiliate_link_clicked")).toBe(1);
    expect(byNameCount(after7, "app_opened") - byNameCount(before7, "app_opened")).toBe(1);
    expect(byNameCount(after7, "item_status_changed") - byNameCount(before7, "item_status_changed")).toBe(0);
    expect(after7.funnel.expenseRecorded - before7.funnel.expenseRecorded).toBe(2);
    expect(after7.funnel.itemStatusChanged - before7.funnel.itemStatusChanged).toBe(0);
    // Distinct anon users: A and B only (the null-anon row adds nothing).
    expect(after7.uniqueAnonUsers - before7.uniqueAnonUsers).toBe(2);

    // Daily buckets land on the correct Seoul-calendar dates.
    const today = getSeoulToday();
    const twoDaysAgo = getSeoulToday(seoulNoonDaysAgo(2));
    expect(dailyCount(after7, today) - dailyCount(before7, today)).toBe(3);
    expect(dailyCount(after7, twoDaysAgo) - dailyCount(before7, twoDaysAgo)).toBe(1);
    expect(after7.dailyTotals.reduce((sum, entry) => sum + entry.count, 0)).toBe(after7.totalEvents);

    // 30d: additionally picks up the 10-days-ago row (and anon user C), but
    // still not the 40-days-ago one.
    expect(after30.totalEvents - before30.totalEvents).toBe(5);
    expect(byNameCount(after30, "item_status_changed") - byNameCount(before30, "item_status_changed")).toBe(1);
    expect(byNameCount(after30, "app_opened") - byNameCount(before30, "app_opened")).toBe(1);
    expect(after30.uniqueAnonUsers - before30.uniqueAnonUsers).toBe(3);
    expect(after30.dailyTotals.reduce((sum, entry) => sum + entry.count, 0)).toBe(after30.totalEvents);
  });

  /**
   * ANA-128: 이벤트 이름 단위 집계만으로는 "구매 확인 응답" 3갈래 합계밖에 낼 수 없어
   * 링크 클릭 → 실구매 전환율이 부풀려졌다. payload.answer별 분해가 byName 총계와
   * **병존**하는지(기존 필드 불변), 그리고 answer가 없는 레거시/손상 페이로드가 어느
   * 갈래에도 섞이지 않는지 고정한다.
   */
  it("breaks purchase_followup_answered down by payload.answer, alongside the unchanged byName total", async () => {
    const email = freshEmail("ana128-followup");
    await createAdmin(email, "analyst");
    const { cookie } = await loginAndEnroll(email);

    // 델타 비교: 공유 테스트 DB에 다른 스위트의 행이 이미 있을 수 있다.
    const before7 = await fetchSummary(cookie, 7);
    const before30 = await fetchSummary(cookie, 30);

    const anon = `ana128-anon-${randomUUID()}`;
    // 7일 창: 샀어요 x2, 아직이요 x1, 괜찮아요 x1.
    await seedEvent("purchase_followup_answered", seoulNoonDaysAgo(0), anon, {
      answer: "purchased",
      platform: "coupang"
    });
    await seedEvent("purchase_followup_answered", seoulNoonDaysAgo(1), anon, { answer: "purchased" });
    await seedEvent("purchase_followup_answered", seoulNoonDaysAgo(2), anon, { answer: "not_purchased" });
    await seedEvent("purchase_followup_answered", seoulNoonDaysAgo(3), anon, { answer: "dismissed" });
    // 30일 창에만: 샀어요 x1.
    await seedEvent("purchase_followup_answered", seoulNoonDaysAgo(12), anon, { answer: "purchased" });

    const after7 = await fetchSummary(cookie, 7);
    const after30 = await fetchSummary(cookie, 30);

    expect(after7.purchaseFollowup.purchased - before7.purchaseFollowup.purchased).toBe(2);
    expect(after7.purchaseFollowup.notPurchased - before7.purchaseFollowup.notPurchased).toBe(1);
    expect(after7.purchaseFollowup.dismissed - before7.purchaseFollowup.dismissed).toBe(1);
    // 기존 이벤트 이름 총계는 그대로 4건 증가 — 분해가 총계를 대체하지 않는다.
    expect(
      byNameCount(after7, "purchase_followup_answered") - byNameCount(before7, "purchase_followup_answered")
    ).toBe(4);
    expect(after7.totalEvents - before7.totalEvents).toBe(4);

    // 30일 창은 12일 전 "샀어요"까지 포함한다.
    expect(after30.purchaseFollowup.purchased - before30.purchaseFollowup.purchased).toBe(3);
    expect(after30.purchaseFollowup.notPurchased - before30.purchaseFollowup.notPurchased).toBe(1);
    expect(after30.purchaseFollowup.dismissed - before30.purchaseFollowup.dismissed).toBe(1);
    expect(
      byNameCount(after30, "purchase_followup_answered") - byNameCount(before30, "purchase_followup_answered")
    ).toBe(5);
  });

  /**
   * ANA-128: answer가 없거나(레거시 페이로드) 레지스트리에 없는 문자열이면 **무시**한다 —
   * 임의로 한 갈래에 넣으면 그 자체가 허위 집계다. 이벤트 이름 총계에는 그대로 남으므로
   * 분해 합계 < byName 총계라는 차이가 화면에서 "분류 불가"로 드러난다.
   */
  it("ignores purchase_followup_answered rows whose payload has no usable answer (they stay in byName)", async () => {
    const email = freshEmail("ana128-legacy");
    await createAdmin(email, "analyst");
    const { cookie } = await loginAndEnroll(email);

    const before = await fetchSummary(cookie, 7);
    const anon = `ana128-legacy-anon-${randomUUID()}`;

    await seedEvent("purchase_followup_answered", seoulNoonDaysAgo(0), anon, {}); // 레거시: answer 없음
    await seedEvent("purchase_followup_answered", seoulNoonDaysAgo(0), anon, { answer: null }); // 손상: null
    await seedEvent("purchase_followup_answered", seoulNoonDaysAgo(0), anon, { answer: "maybe" }); // 미등록 값
    await seedEvent("purchase_followup_answered", seoulNoonDaysAgo(0), anon, { answer: "purchased" }); // 정상 1건

    const after = await fetchSummary(cookie, 7);

    // 정상 1건만 분해에 잡힌다.
    expect(after.purchaseFollowup.purchased - before.purchaseFollowup.purchased).toBe(1);
    expect(after.purchaseFollowup.notPurchased - before.purchaseFollowup.notPurchased).toBe(0);
    expect(after.purchaseFollowup.dismissed - before.purchaseFollowup.dismissed).toBe(0);
    // 그래도 4건 모두 이벤트 이름 총계에는 남는다 (버려지는 것은 분류뿐).
    expect(
      byNameCount(after, "purchase_followup_answered") - byNameCount(before, "purchase_followup_answered")
    ).toBe(4);
    expect(after.totalEvents - before.totalEvents).toBe(4);
  });
});
