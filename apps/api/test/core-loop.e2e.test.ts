import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AppModule } from "../src/app.module";
import { configureApiApp } from "../src/bootstrap";

// See admin-settings.e2e.test.ts's login() comment: a random suffix keeps dev-login
// isolated per test run against the persistent Postgres database.
async function login(app: INestApplication, providerToken: string) {
  const response = await request(app.getHttpServer())
    .post("/api/v1/auth/oauth-login")
    .send({ provider: "kakao", providerToken: `${providerToken}-${randomUUID()}` })
    .expect(200);

  return response.body.tokens.accessToken as string;
}

describe("Release core loop e2e", () => {
  let app: INestApplication;

  beforeEach(async () => {
    process.env.JWT_ACCESS_SECRET = "test-access-secret";
    process.env.JWT_REFRESH_SECRET = "test-refresh-secret";
    process.env.WOORIAI_STAGE_TODAY = "2026-07-06";

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule]
    }).compile();

    app = moduleRef.createNestApplication();
    configureApiApp(app);
    await app.init();
  });

  afterEach(async () => {
    delete process.env.WOORIAI_STAGE_TODAY;
    await app.close();
  });

  it("covers auth, categories, onboarding, device push, expense, reports (monthly/category/milestone), item detail, affiliate click, family invite, and worker health in one release smoke", async () => {
    const accessToken = await login(app, "batch11-core-loop");
    const householdId = (
      await request(app.getHttpServer())
        .get("/api/v1/me")
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(200)
    ).body.households[0].id as string;

    // QA-E2E-CORE 1) Category list right after login — the expense form's source of
    // truth. Non-empty, active-only, and the journey's expense uses a returned id
    // instead of a hardcoded seed uuid.
    const categories = (
      await request(app.getHttpServer())
        .get("/api/v1/categories")
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(200)
    ).body.categories as Array<{ id: string; code: string; active: boolean }>;
    expect(categories.length).toBeGreaterThan(0);
    expect(categories.every((category) => category.active)).toBe(true);
    const diaperCategory = categories.find((category) => category.code === "diaper_hygiene");
    expect(diaperCategory).toBeTruthy();
    const categoryId = diaperCategory!.id;

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

    // QA-E2E-CORE 2) Push device registration during onboarding + notification toggle.
    const device = (
      await request(app.getHttpServer())
        .post("/api/v1/me/devices")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ platform: "ios", pushToken: `core-loop-push-${randomUUID()}`, appVersion: "1.0.0" })
        .expect(200)
    ).body as { id: string; notificationEnabled: boolean; pushToken?: string };
    expect(device.id).toBeTruthy();
    expect(device.notificationEnabled).toBe(true);
    // Push token raw value never echoes back.
    expect(device.pushToken).toBeUndefined();

    await request(app.getHttpServer())
      .patch(`/api/v1/me/devices/${device.id}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ notificationEnabled: false })
      .expect(200)
      .expect(({ body }) => {
        expect(body.notificationEnabled).toBe(false);
      });

    // QA-E2E-CORE 3) The journey child is BORN with a birthDate (2026-05-06 →
    // 2 completed months on the frozen stage clock 2026-07-06, i.e. still the
    // newborn_0_3 stage the journey always exercised) so the milestone report
    // can answer 200 instead of 400 MILESTONE_UNAVAILABLE.
    const childId = (
      await request(app.getHttpServer())
        .post("/api/v1/children")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({
          householdId,
          nickname: "batch11-child",
          stageMode: "born",
          birthDate: "2026-05-06"
        })
        .expect(200)
    ).body.id as string;

    await request(app.getHttpServer())
      .post(`/api/v1/children/${childId}/prepared-items`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ itemTemplateIds: [] })
      .expect(200);

    await request(app.getHttpServer())
      .put(`/api/v1/children/${childId}/budget`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ yearMonth: "2026-07-01", amountKrw: 100000 })
      .expect(200);

    await request(app.getHttpServer())
      .post(`/api/v1/children/${childId}/expenses`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        categoryId,
        amountKrw: 49800,
        spentOn: "2026-07-06",
        itemName: "Release smoke diapers",
        paymentMethod: "card"
      })
      .expect(200);

    await request(app.getHttpServer())
      .get(`/api/v1/home?childId=${childId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.totalExpenseKrw).toBe(49800);
        expect(body.monthly.usedAmountKrw).toBe(49800);
        expect(body.recommendedItems.length).toBeGreaterThan(0);
      });

    await request(app.getHttpServer())
      .get(`/api/v1/children/${childId}/reports/monthly?yearMonth=2026-07`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.totalExpenseKrw).toBe(49800);
      });

    // QA-E2E-CORE 3) Yearly category breakdown (current journey year) sees the expense
    // under the id picked from GET /categories.
    await request(app.getHttpServer())
      .get(`/api/v1/children/${childId}/reports/category?year=2026`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.childId).toBe(childId);
        expect(body.categories).toEqual([{ categoryId, amountKrw: 49800, count: 1 }]);
      });

    // QA-E2E-CORE 3) Milestone (100-day) report: born child with birthDate → 200.
    // Window [2026-05-06, 2026-08-14) is still open on the frozen clock, so the
    // report is partial with 62 covered days and the single journey expense.
    await request(app.getHttpServer())
      .get(`/api/v1/children/${childId}/reports/milestone?type=d100`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          childId,
          type: "d100",
          startDate: "2026-05-06",
          partial: true,
          daysCovered: 62,
          totalKrw: 49800,
          expenseCount: 1
        });
        expect(body.topCategories).toEqual([expect.objectContaining({ categoryId, totalKrw: 49800, share: 1 })]);
      });

    const items = (
      await request(app.getHttpServer())
        .get(`/api/v1/children/${childId}/items?tab=now`)
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(200)
    ).body.items as Array<{ id: string; name: string }>;
    expect(items.length).toBeGreaterThan(0);

    let affiliateLink: { id: string; isAffiliate: boolean; disclosureText?: string } | undefined;
    for (const item of items) {
      const detail = (
        await request(app.getHttpServer())
          .get(`/api/v1/children/${childId}/items/${item.id}`)
          .set("Authorization", `Bearer ${accessToken}`)
          .expect(200)
      ).body as { productLinks: Array<{ id: string; isAffiliate: boolean; disclosureText?: string }> };
      affiliateLink = detail.productLinks.find((link) => link.isAffiliate);
      if (affiliateLink) break;
    }

    expect(affiliateLink?.disclosureText).toBeTruthy();

    await request(app.getHttpServer())
      .post(`/api/v1/product-links/${affiliateLink!.id}/click`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ childId, referrerScreenId: "ITEM-003" })
      .expect(200)
      .expect(({ body }) => {
        expect(body.clickId).toEqual(expect.any(String));
        expect(body.disclosureText).toBeTruthy();
      });

    // QA-E2E-CORE 4) Family invite loop: owner creates a co-parent invite …
    const inviteUrl = (
      await request(app.getHttpServer())
        .post(`/api/v1/households/${householdId}/invites`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ role: "co_parent", channel: "link" })
        .expect(200)
    ).body.inviteUrl as string;
    const inviteToken = inviteUrl.split("/invite/")[1];
    expect(inviteToken).toBeTruthy();

    // … the public (unauthenticated, outside /api/v1) landing page renders HTML with
    // the app deep link …
    await request(app.getHttpServer())
      .get(`/invite/${inviteToken}`)
      .expect(200)
      .expect(({ headers, text }) => {
        expect(headers["content-type"]).toMatch(/^text\/html/);
        expect(text).toContain(`href="wooriai://family/accept/${inviteToken}"`);
      });

    // … a second user accepts and shows up as an active member of the household.
    const coParentToken = await login(app, "batch11-core-loop-coparent");
    await request(app.getHttpServer())
      .post(`/api/v1/invites/${inviteToken}/accept`)
      .set("Authorization", `Bearer ${coParentToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.household).toMatchObject({ id: householdId, role: "co_parent" });
      });

    await request(app.getHttpServer())
      .get(`/api/v1/households/${householdId}/members`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.members).toHaveLength(2);
        expect(body.members).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ householdId, role: "owner", status: "active" }),
            expect.objectContaining({ householdId, role: "co_parent", status: "active" })
          ])
        );
      });

    // QA-E2E-CORE 5) Worker observability shape at the end of the smoke (worker is
    // never enabled in the test env, so the disabled/empty contract applies).
    await request(app.getHttpServer())
      .get("/api/v1/health/worker")
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({ enabled: false, stale: false });
        expect(body.intervalMs).toEqual(expect.any(Number));
        expect(Array.isArray(body.jobs)).toBe(true);
      });
  });
});
