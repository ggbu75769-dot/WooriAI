import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AppModule } from "../src/app.module";
import { configureApiApp } from "../src/bootstrap";

const categoryId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

// See admin-settings.e2e.test.ts's login() comment: a random suffix keeps dev-login
// isolated per test run against the persistent Postgres database.
async function login(app: INestApplication, providerToken: string) {
  const response = await request(app.getHttpServer())
    .post("/api/v1/auth/oauth-login")
    .send({ provider: "kakao", providerToken: `${providerToken}-${randomUUID()}` })
    .expect(200);

  return response.body.tokens.accessToken as string;
}

async function householdIdFor(app: INestApplication, accessToken: string) {
  return (
    await request(app.getHttpServer())
      .get("/api/v1/me")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200)
  ).body.households[0].id as string;
}

async function completeOwnerOnboarding(app: INestApplication, accessToken: string) {
  const householdId = await householdIdFor(app, accessToken);

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
        nickname: "튼튼이",
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

function tokenFromInviteUrl(inviteUrl: string) {
  const token = inviteUrl.split("/invite/")[1];
  expect(token).toBeTruthy();
  return token;
}

describe("Family invites and household RBAC", () => {
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

  it("lets an owner invite a co-parent whose expense is reflected in the same child report", async () => {
    const ownerToken = await login(app, "batch08-owner");
    const { householdId, childId } = await completeOwnerOnboarding(app, ownerToken);

    await request(app.getHttpServer())
      .get(`/api/v1/households/${householdId}/members`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.members).toEqual([
          expect.objectContaining({
            householdId,
            role: "owner",
            status: "active"
          })
        ]);
      });

    const inviteResponse = await request(app.getHttpServer())
      .post(`/api/v1/households/${householdId}/invites`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ role: "co_parent", channel: "link" })
      .expect(200);

    expect(inviteResponse.body).toMatchObject({
      inviteUrl: expect.stringContaining("/invite/"),
      expiresAt: expect.any(String)
    });
    const inviteToken = tokenFromInviteUrl(inviteResponse.body.inviteUrl);

    await request(app.getHttpServer())
      .get(`/api/v1/invites/${inviteToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          householdName: "우리 가족",
          role: "co_parent",
          expiresAt: inviteResponse.body.expiresAt
        });
      });

    const coParentToken = await login(app, "batch08-co-parent");
    await request(app.getHttpServer())
      .post(`/api/v1/invites/${inviteToken}/accept`)
      .set("Authorization", `Bearer ${coParentToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.household).toMatchObject({
          id: householdId,
          name: "우리 가족",
          role: "co_parent"
        });
      });

    await request(app.getHttpServer())
      .get("/api/v1/children")
      .set("Authorization", `Bearer ${coParentToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.children).toEqual([expect.objectContaining({ id: childId })]);
      });

    await request(app.getHttpServer())
      .post(`/api/v1/children/${childId}/expenses`)
      .set("Authorization", `Bearer ${coParentToken}`)
      .send({
        categoryId,
        amountKrw: 42000,
        spentOn: "2026-07-06",
        itemName: "공동부모 기저귀",
        paymentMethod: "card"
      })
      .expect(200);

    await request(app.getHttpServer())
      .get(`/api/v1/children/${childId}/reports/monthly?yearMonth=2026-07`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.totalExpenseKrw).toBe(42000);
      });

    await request(app.getHttpServer())
      .post(`/api/v1/households/${householdId}/invites`)
      .set("Authorization", `Bearer ${coParentToken}`)
      .send({ role: "viewer", channel: "link" })
      .expect(403);
  });

  it("rejects an existing active member re-accepting an invite instead of overwriting their role (owner lockout regression)", async () => {
    const ownerToken = await login(app, "batch08-self-invite-owner");
    const { householdId } = await completeOwnerOnboarding(app, ownerToken);

    const viewerInvite = await request(app.getHttpServer())
      .post(`/api/v1/households/${householdId}/invites`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ role: "viewer", channel: "link" })
      .expect(200);

    await request(app.getHttpServer())
      .post(`/api/v1/invites/${tokenFromInviteUrl(viewerInvite.body.inviteUrl)}/accept`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .expect(409)
      .expect(({ body }) => {
        expect(body.error.code).toBe("HOUSEHOLD_ALREADY_MEMBER");
      });

    await request(app.getHttpServer())
      .get(`/api/v1/households/${householdId}/members`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.members).toEqual([
          expect.objectContaining({ householdId, role: "owner", status: "active" })
        ]);
      });

    await request(app.getHttpServer())
      .post(`/api/v1/households/${householdId}/invites`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ role: "co_parent", channel: "link" })
      .expect(200);
  });

  it("allows viewer report access but blocks viewer expense writes and invite creation", async () => {
    const ownerToken = await login(app, "batch08-viewer-owner");
    const { householdId, childId } = await completeOwnerOnboarding(app, ownerToken);
    const viewerInvite = await request(app.getHttpServer())
      .post(`/api/v1/households/${householdId}/invites`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ role: "viewer", channel: "link" })
      .expect(200);

    const viewerToken = await login(app, "batch08-viewer");
    await request(app.getHttpServer())
      .post(`/api/v1/invites/${tokenFromInviteUrl(viewerInvite.body.inviteUrl)}/accept`)
      .set("Authorization", `Bearer ${viewerToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.household.role).toBe("viewer");
      });

    await request(app.getHttpServer())
      .get(`/api/v1/children/${childId}/reports/monthly?yearMonth=2026-07`)
      .set("Authorization", `Bearer ${viewerToken}`)
      .expect(200);

    await request(app.getHttpServer())
      .post(`/api/v1/children/${childId}/expenses`)
      .set("Authorization", `Bearer ${viewerToken}`)
      .send({
        categoryId,
        amountKrw: 12000,
        spentOn: "2026-07-06",
        itemName: "viewer blocked",
        paymentMethod: "card"
      })
      .expect(403);

    await request(app.getHttpServer())
      .post(`/api/v1/households/${householdId}/invites`)
      .set("Authorization", `Bearer ${viewerToken}`)
      .send({ role: "co_parent", channel: "link" })
      .expect(403);
  });

  it("lists only still-usable pending invites for the owner and never re-exposes the invite token", async () => {
    const ownerToken = await login(app, "fam121b-list-owner");
    const { householdId } = await completeOwnerOnboarding(app, ownerToken);

    await request(app.getHttpServer())
      .get(`/api/v1/households/${householdId}/invites`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.invites).toEqual([]);
      });

    const coParentInvite = await request(app.getHttpServer())
      .post(`/api/v1/households/${householdId}/invites`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ role: "co_parent", channel: "link" })
      .expect(200);
    const viewerInvite = await request(app.getHttpServer())
      .post(`/api/v1/households/${householdId}/invites`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ role: "viewer", channel: "link" })
      .expect(200);

    const listed = (
      await request(app.getHttpServer())
        .get(`/api/v1/households/${householdId}/invites`)
        .set("Authorization", `Bearer ${ownerToken}`)
        .expect(200)
    ).body.invites as Array<Record<string, unknown>>;

    expect(listed).toHaveLength(2);
    expect(listed.map((invite) => invite.role).sort()).toEqual(["co_parent", "viewer"]);
    for (const invite of listed) {
      expect(invite).toMatchObject({
        householdId,
        status: "pending",
        channel: "link",
        canReshareLink: false,
        expiresAt: expect.any(String),
        createdAt: expect.any(String)
      });
      // The plaintext token only ever exists in the create response; the row keeps a
      // sha256 hash, so the listing must not leak a token, a hash, or a usable link.
      const serialized = JSON.stringify(invite);
      expect(serialized).not.toContain("/invite/");
      expect(serialized.toLowerCase()).not.toContain("token");
      expect(serialized).not.toContain(tokenFromInviteUrl(coParentInvite.body.inviteUrl));
      expect(serialized).not.toContain(tokenFromInviteUrl(viewerInvite.body.inviteUrl));
    }

    // An accepted invite drops out of the pending listing.
    const coParentToken = await login(app, "fam121b-list-co-parent");
    await request(app.getHttpServer())
      .post(`/api/v1/invites/${tokenFromInviteUrl(coParentInvite.body.inviteUrl)}/accept`)
      .set("Authorization", `Bearer ${coParentToken}`)
      .expect(200);

    await request(app.getHttpServer())
      .get(`/api/v1/households/${householdId}/invites`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.invites.map((invite: { role: string }) => invite.role)).toEqual(["viewer"]);
      });

    // Non-owner members cannot see the household's pending invites.
    await request(app.getHttpServer())
      .get(`/api/v1/households/${householdId}/invites`)
      .set("Authorization", `Bearer ${coParentToken}`)
      .expect(403);

    const outsiderToken = await login(app, "fam121b-list-outsider");
    await request(app.getHttpServer())
      .get(`/api/v1/households/${householdId}/invites`)
      .set("Authorization", `Bearer ${outsiderToken}`)
      .expect(403);
  });

  it("lets an owner cancel a pending invite, which then stops working and disappears from the listing", async () => {
    const ownerToken = await login(app, "fam121b-cancel-owner");
    const { householdId } = await completeOwnerOnboarding(app, ownerToken);

    const invite = await request(app.getHttpServer())
      .post(`/api/v1/households/${householdId}/invites`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ role: "viewer", channel: "link" })
      .expect(200);
    const inviteToken = tokenFromInviteUrl(invite.body.inviteUrl);

    const inviteId = (
      await request(app.getHttpServer())
        .get(`/api/v1/households/${householdId}/invites`)
        .set("Authorization", `Bearer ${ownerToken}`)
        .expect(200)
    ).body.invites[0].id as string;

    const otherOwnerToken = await login(app, "fam121b-cancel-other-owner");
    await request(app.getHttpServer())
      .delete(`/api/v1/households/${householdId}/invites/${inviteId}`)
      .set("Authorization", `Bearer ${otherOwnerToken}`)
      .expect(403);

    await request(app.getHttpServer())
      .delete(`/api/v1/households/${householdId}/invites/00000000-0000-4000-8000-000000000000`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .expect(404)
      .expect(({ body }) => {
        expect(body.error.code).toBe("INVITE_NOT_FOUND");
      });

    await request(app.getHttpServer())
      .delete(`/api/v1/households/${householdId}/invites/${inviteId}`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual({ success: true });
      });

    await request(app.getHttpServer())
      .get(`/api/v1/households/${householdId}/invites`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.invites).toEqual([]);
      });

    // The cancelled link is dead for both preview and acceptance.
    await request(app.getHttpServer())
      .get(`/api/v1/invites/${inviteToken}`)
      .expect(400)
      .expect(({ body }) => {
        expect(body.error.code).toBe("INVITE_NOT_PENDING");
      });

    const inviteeToken = await login(app, "fam121b-cancel-invitee");
    await request(app.getHttpServer())
      .post(`/api/v1/invites/${inviteToken}/accept`)
      .set("Authorization", `Bearer ${inviteeToken}`)
      .expect(400)
      .expect(({ body }) => {
        expect(body.error.code).toBe("INVITE_NOT_PENDING");
      });

    // Cancelling twice is rejected rather than silently succeeding.
    await request(app.getHttpServer())
      .delete(`/api/v1/households/${householdId}/invites/${inviteId}`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .expect(400)
      .expect(({ body }) => {
        expect(body.error.code).toBe("INVITE_NOT_PENDING");
      });
  });

  it("lets an owner force-remove a member; blocks non-owners and self-removal, and revokes access", async () => {
    const ownerToken = await login(app, "batch08-remove-owner");
    const { householdId, childId } = await completeOwnerOnboarding(app, ownerToken);

    const coParentInvite = await request(app.getHttpServer())
      .post(`/api/v1/households/${householdId}/invites`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ role: "co_parent", channel: "link" })
      .expect(200);
    const coParentToken = await login(app, "batch08-remove-co-parent");
    await request(app.getHttpServer())
      .post(`/api/v1/invites/${tokenFromInviteUrl(coParentInvite.body.inviteUrl)}/accept`)
      .set("Authorization", `Bearer ${coParentToken}`)
      .expect(200);

    const viewerInvite = await request(app.getHttpServer())
      .post(`/api/v1/households/${householdId}/invites`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ role: "viewer", channel: "link" })
      .expect(200);
    const viewerToken = await login(app, "batch08-remove-viewer");
    await request(app.getHttpServer())
      .post(`/api/v1/invites/${tokenFromInviteUrl(viewerInvite.body.inviteUrl)}/accept`)
      .set("Authorization", `Bearer ${viewerToken}`)
      .expect(200);

    const membersBefore = (
      await request(app.getHttpServer())
        .get(`/api/v1/households/${householdId}/members`)
        .set("Authorization", `Bearer ${ownerToken}`)
        .expect(200)
    ).body.members as Array<{ id: string; role: string }>;

    const ownerMemberId = membersBefore.find((member) => member.role === "owner")!.id;
    const coParentMemberId = membersBefore.find((member) => member.role === "co_parent")!.id;
    const viewerMemberId = membersBefore.find((member) => member.role === "viewer")!.id;

    await request(app.getHttpServer())
      .delete(`/api/v1/households/${householdId}/members/${viewerMemberId}`)
      .set("Authorization", `Bearer ${coParentToken}`)
      .expect(403);

    await request(app.getHttpServer())
      .delete(`/api/v1/households/${householdId}/members/${coParentMemberId}`)
      .set("Authorization", `Bearer ${viewerToken}`)
      .expect(403);

    await request(app.getHttpServer())
      .delete(`/api/v1/households/${householdId}/members/${ownerMemberId}`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .expect(400)
      .expect(({ body }) => {
        expect(body.error.code).toBe("HOUSEHOLD_MEMBER_REMOVE_OWNER_FORBIDDEN");
      });

    await request(app.getHttpServer())
      .delete(`/api/v1/households/${householdId}/members/00000000-0000-4000-8000-000000000000`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .expect(404);

    await request(app.getHttpServer())
      .delete(`/api/v1/households/${householdId}/members/${coParentMemberId}`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual({ success: true });
      });

    await request(app.getHttpServer())
      .get(`/api/v1/households/${householdId}/members`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.members.map((member: { id: string }) => member.id)).not.toContain(coParentMemberId);
      });

    await request(app.getHttpServer())
      .get(`/api/v1/children/${childId}/reports/monthly?yearMonth=2026-07`)
      .set("Authorization", `Bearer ${coParentToken}`)
      .expect(403);

    await request(app.getHttpServer())
      .post(`/api/v1/children/${childId}/expenses`)
      .set("Authorization", `Bearer ${coParentToken}`)
      .send({
        categoryId,
        amountKrw: 10000,
        spentOn: "2026-07-06",
        itemName: "removed member blocked",
        paymentMethod: "card"
      })
      .expect(403);
  });
});
