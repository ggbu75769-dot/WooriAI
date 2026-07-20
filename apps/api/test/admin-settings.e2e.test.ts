import type { INestApplication } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AppModule } from "../src/app.module";
import { configureApiApp } from "../src/bootstrap";
import { AuditLoggerService } from "../src/common/audit/audit-logger.service";

const adminToken = "dev-admin-token";
const categoryId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

// Round 4: dev-login now persists a real users/households row per providerToken
// (instead of a per-process in-memory Map), so reusing the same literal
// providerToken across test runs against a persistent database would reuse the
// same account/household and leak state between runs. Appending a random suffix
// keeps every login (even with the same descriptive prefix) isolated.
async function login(app: INestApplication, providerToken: string) {
  const response = await request(app.getHttpServer())
    .post("/api/v1/auth/oauth-login")
    .send({ provider: "kakao", providerToken: `${providerToken}-${randomUUID()}` })
    .expect(200);

  return response.body.tokens.accessToken as string;
}

async function completeOnboarding(app: INestApplication, accessToken: string) {
  const householdId = (
    await request(app.getHttpServer())
      .get("/api/v1/me")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200)
  ).body.households[0].id as string;

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

  const childId = (
    await request(app.getHttpServer())
      .post("/api/v1/children")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        householdId,
        nickname: "batch10-child",
        stageMode: "manual",
        manualStage: "infant_4_6"
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
    .send({ yearMonth: "2026-07-01", amountKrw: 300000 })
    .expect(200);

  return { householdId, childId };
}

describe("Admin CMS and settings APIs", () => {
  let app: INestApplication;
  let moduleRef: TestingModule;

  beforeEach(async () => {
    process.env.JWT_ACCESS_SECRET = "test-access-secret";
    process.env.JWT_REFRESH_SECRET = "test-refresh-secret";
    process.env.WOORIAI_ADMIN_TOKEN = adminToken;
    process.env.WOORIAI_STAGE_TODAY = "2026-07-06";

    moduleRef = await Test.createTestingModule({
      imports: [AppModule]
    }).compile();

    app = moduleRef.createNestApplication();
    configureApiApp(app);
    await app.init();
  });

  afterEach(async () => {
    delete process.env.WOORIAI_ADMIN_TOKEN;
    delete process.env.WOORIAI_STAGE_TODAY;
    await app.close();
  });

  it("lets internal admins update preparation items, product links, and disclosure copy without a mobile deploy", async () => {
    const accessToken = await login(app, "batch10-admin-cms");
    const { childId } = await completeOnboarding(app, accessToken);

    await request(app.getHttpServer()).get("/api/v1/admin/item-templates").expect(403);

    await request(app.getHttpServer())
      .post("/api/v1/admin/item-templates")
      .set("x-admin-token", adminToken)
      .send({
        name: "Optional without skip copy",
        necessityLevel: "optional",
        reasonText: "This should be rejected."
      })
      .expect(400)
      .expect(({ body }) => {
        expect(body.error.code).toBe("ADMIN_SKIP_REASON_REQUIRED");
      });

    const itemTemplate = (
      await request(app.getHttpServer())
        .post("/api/v1/admin/item-templates")
        .set("x-admin-token", adminToken)
        .send({
          name: "Batch10 stroller fan",
          categoryId,
          necessityLevel: "optional",
          timingLabel: "summer outings",
          reasonText: "Keeps stroller outings more comfortable.",
          skipReasonText: "Skip when outings are short or shaded.",
          usedSecondhandOk: true,
          stageCodes: ["infant_4_6"],
          active: true
        })
        .expect(200)
    ).body as { id: string; name: string };

    await request(app.getHttpServer())
      .patch(`/api/v1/admin/item-templates/${itemTemplate.id}`)
      .set("x-admin-token", adminToken)
      .send({ reasonText: "Updated by admin CMS." })
      .expect(200)
      .expect(({ body }) => {
        expect(body.reasonText).toBe("Updated by admin CMS.");
      });

    await request(app.getHttpServer())
      .put("/api/v1/admin/disclosures/affiliate_purchase")
      .set("x-admin-token", adminToken)
      .send({ text: "Batch10 affiliate disclosure near CTA." })
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({ key: "affiliate_purchase", text: "Batch10 affiliate disclosure near CTA." });
      });

    await request(app.getHttpServer())
      .post("/api/v1/admin/product-links")
      .set("x-admin-token", adminToken)
      .send({
        itemTemplateId: itemTemplate.id,
        platform: "custom",
        title: "Malicious scheme link",
        url: "javascript:alert(1)",
        isAffiliate: false,
        isSponsored: false,
        active: true
      })
      .expect(400);

    const productLink = (
      await request(app.getHttpServer())
        .post("/api/v1/admin/product-links")
        .set("x-admin-token", adminToken)
        .send({
          itemTemplateId: itemTemplate.id,
          platform: "custom",
          title: "Admin managed shop link",
          url: "https://example.com/admin-managed",
          isAffiliate: true,
          isSponsored: false,
          active: true
        })
        .expect(200)
    ).body as { id: string };

    await request(app.getHttpServer())
      .patch(`/api/v1/admin/product-links/${productLink.id}`)
      .set("x-admin-token", adminToken)
      .send({ url: "data:text/html,evil" })
      .expect(400);

    await request(app.getHttpServer())
      .patch(`/api/v1/admin/product-links/${productLink.id}`)
      .set("x-admin-token", adminToken)
      .send({
        title: "Updated admin shop link",
        disclosureText: "Specific product disclosure override."
      })
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          id: productLink.id,
          title: "Updated admin shop link",
          disclosureText: "Specific product disclosure override."
        });
      });

    await request(app.getHttpServer())
      .get(`/api/v1/children/${childId}/items/${itemTemplate.id}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          id: itemTemplate.id,
          reasonText: "Updated by admin CMS."
        });
        expect(body.productLinks).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              id: productLink.id,
              title: "Updated admin shop link",
              isAffiliate: true,
              disclosureText: "Specific product disclosure override."
            })
          ])
        );
      });
  });

  it("keeps account deletion, household leave, and child profile deletion as separate two-step settings flows", async () => {
    const accessToken = await login(app, "batch10-settings");
    const { householdId, childId } = await completeOnboarding(app, accessToken);

    await request(app.getHttpServer())
      .post(`/api/v1/children/${childId}/expenses`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        categoryId,
        amountKrw: 15000,
        spentOn: "2026-07-06",
        itemName: "삭제될 지출",
        paymentMethod: "card"
      })
      .expect(200);

    await request(app.getHttpServer())
      .get("/api/v1/settings/privacy")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.flows.map((flow: { id: string }) => flow.id)).toEqual([
          "account_delete",
          "household_leave",
          "child_profile_delete"
        ]);
      });

    await request(app.getHttpServer())
      .post(`/api/v1/settings/children/${childId}/delete-preview`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          flowId: "child_profile_delete",
          confirmationText: "DELETE CHILD",
          requiresSecondStep: true
        });
        expect(body.impact).toEqual(expect.arrayContaining([expect.stringContaining("child profile")]));
      });

    await request(app.getHttpServer())
      .post(`/api/v1/settings/children/${childId}/delete-confirm`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ confirmationText: "WRONG" })
      .expect(400)
      .expect(({ body }) => {
        expect(body.error.code).toBe("SETTINGS_CONFIRMATION_REQUIRED");
      });

    await request(app.getHttpServer())
      .post(`/api/v1/settings/children/${childId}/delete-confirm`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ confirmationText: "DELETE CHILD" })
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual({ success: true, flowId: "child_profile_delete" });
      });

    await request(app.getHttpServer())
      .get(`/api/v1/children/${childId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(404);

    const auditLogger = moduleRef.get(AuditLoggerService);
    expect(auditLogger.entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          actorUserId: expect.any(String),
          householdId,
          action: "child_profile.delete",
          targetType: "child_profile",
          targetId: childId,
          after: expect.objectContaining({ deletedExpenseCount: 1, deletedAt: expect.any(String) })
        })
      ])
    );

    await request(app.getHttpServer())
      .post(`/api/v1/settings/households/${householdId}/leave-preview`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.flowId).toBe("household_leave");
        expect(body.confirmationText).toBe("LEAVE HOUSEHOLD");
      });

    await request(app.getHttpServer())
      .post("/api/v1/settings/account/delete-preview")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.flowId).toBe("account_delete");
        expect(body.confirmationText).toBe("DELETE ACCOUNT");
      });

    await request(app.getHttpServer())
      .post("/api/v1/settings/account/delete-confirm")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ confirmationText: "DELETE ACCOUNT" })
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual({
          success: true,
          flowId: "account_delete",
          deletion: expect.objectContaining({ requestType: "deletion", state: "requested", dueAt: expect.any(String) })
        });
      });

    await request(app.getHttpServer())
      .get("/api/v1/me")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);
  });
});
