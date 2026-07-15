import { randomUUID } from "node:crypto";
import type { INestApplication } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import { PrismaClient } from "@prisma/client";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AppModule } from "../src/app.module";
import { configureApiApp } from "../src/bootstrap";
import { HouseholdRuntimeService } from "../src/households/household-runtime.service";
import { PrivacyService } from "../src/privacy/privacy.service";

describe("Release 3 legal, privacy, and ownership contracts", () => {
  let app: INestApplication;
  let moduleRef: TestingModule;
  let prisma: PrismaClient;

  beforeEach(async () => {
    process.env.JWT_ACCESS_SECRET = "test-access-secret";
    process.env.JWT_REFRESH_SECRET = "test-refresh-secret";
    process.env.PRIVACY_STATUS_TOKEN_SECRET = "test-status-token-secret";
    moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApiApp(app);
    await app.init();
    prisma = new PrismaClient();
  });

  afterEach(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  async function login(prefix: string) {
    const response = await request(app.getHttpServer())
      .post("/api/v1/auth/oauth-login")
      .send({ provider: "kakao", providerToken: `${prefix}-${randomUUID()}` })
      .expect(200);
    return {
      token: response.body.tokens.accessToken as string,
      userId: response.body.user.id as string,
      householdId: response.body.user.households[0].id as string
    };
  }

  it("serves versioned legal content and persists consent snapshot + hash-bound event", async () => {
    const user = await login("release3-legal");
    const current = await request(app.getHttpServer()).get("/api/v1/legal/documents/current").expect(200);
    const terms = current.body.documents.find((document: { documentType: string }) => document.documentType === "terms");
    expect(terms).toMatchObject({ version: "2026-07-06", required: true, placeholder: true });
    expect(terms.contentHash).toMatch(/^[a-f0-9]{64}$/);

    await request(app.getHttpServer())
      .put("/api/v1/consents")
      .set("Authorization", `Bearer ${user.token}`)
      .send({ consents: [{ type: "terms", version: terms.version, accepted: true }], appVersion: "3.0.0-rc.1" })
      .expect(200);

    const history = await request(app.getHttpServer())
      .get("/api/v1/consents/history")
      .set("Authorization", `Bearer ${user.token}`)
      .expect(200);
    expect(history.body.events[0]).toMatchObject({
      documentType: "terms",
      version: terms.version,
      action: "accepted",
      contentHash: terms.contentHash,
      appVersion: "3.0.0-rc.1"
    });
    expect(await prisma.consent.findUnique({
      where: { userId_consentType_version: { userId: user.userId, consentType: "terms", version: terms.version } }
    })).toMatchObject({ accepted: true });
  });

  it("allows one CAS ownership transfer and never leaves the household without one active owner", async () => {
    const owner = await login("release3-owner");
    const target = await login("release3-target");
    const invite = await request(app.getHttpServer())
      .post(`/api/v1/households/${owner.householdId}/invites`)
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ role: "co_parent", channel: "link" })
      .expect(200);
    const inviteToken = new URL(invite.body.inviteUrl).pathname.split("/").pop()!;
    await request(app.getHttpServer())
      .post(`/api/v1/invites/${inviteToken}/accept`)
      .set("Authorization", `Bearer ${target.token}`)
      .expect(200);

    const runtime = moduleRef.get(HouseholdRuntimeService);
    const ownerContext = await runtime.enrichUser({
      id: owner.userId,
      displayName: "owner",
      email: null,
      status: "active",
      households: []
    });
    const attempts = await Promise.allSettled([
      runtime.transferOwnership(ownerContext, owner.householdId, target.userId),
      runtime.transferOwnership(ownerContext, owner.householdId, target.userId)
    ]);
    expect(attempts.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(attempts.filter((result) => result.status === "rejected")).toHaveLength(1);
    const activeOwners = await prisma.householdMember.findMany({
      where: { householdId: owner.householdId, status: "active", role: "owner" }
    });
    expect(activeOwners).toHaveLength(1);
    expect(activeOwners[0]?.userId).toBe(target.userId);
  });

  it("creates idempotent deletion work, revokes access immediately, and exposes token-bound status", async () => {
    const user = await login("release3-delete");
    const runtime = moduleRef.get(HouseholdRuntimeService);
    const privacy = moduleRef.get(PrivacyService);
    const enriched = await runtime.enrichUser({
      id: user.userId,
      displayName: "test",
      email: null,
      status: "active",
      households: []
    });
    const [first, second] = await Promise.all([
      privacy.requestDeletion(enriched),
      privacy.requestDeletion(enriched)
    ]);
    expect(second.id).toBe(first.id);
    expect(second.statusToken).toBe(first.statusToken);

    await request(app.getHttpServer())
      .get(`/api/v1/privacy/public/requests/${first.id}`)
      .query({ statusToken: first.statusToken })
      .expect(200)
      .expect(({ body }) => expect(body.state).toBe("access_revoked"));
    await request(app.getHttpServer())
      .get(`/api/v1/privacy/public/requests/${first.id}`)
      .query({ statusToken: "wrong" })
      .expect(403);
    await request(app.getHttpServer()).get("/api/v1/me").set("Authorization", `Bearer ${user.token}`).expect(401);

    expect(await prisma.jobOutbox.count({
      where: { topic: "privacy.delete", dedupeKey: first.id }
    })).toBe(1);
    expect(await prisma.privacyRequestEvent.count({ where: { privacyRequestId: first.id } })).toBe(2);
  });

  it("deduplicates concurrent export requests into one outbox job", async () => {
    const user = await login("release3-export");
    const requests = await Promise.all([
      request(app.getHttpServer())
        .post("/api/v1/privacy/data-export")
        .set("Authorization", `Bearer ${user.token}`)
        .send({ confirmationText: "EXPORT DATA" }),
      request(app.getHttpServer())
        .post("/api/v1/privacy/data-export")
        .set("Authorization", `Bearer ${user.token}`)
        .send({ confirmationText: "EXPORT DATA" })
    ]);
    expect(requests.map((result) => result.status)).toEqual([202, 202]);
    expect(requests[0]?.body.id).toBe(requests[1]?.body.id);
    expect(await prisma.jobOutbox.count({
      where: { topic: "privacy.export", dedupeKey: requests[0]?.body.id }
    })).toBe(1);
  });
});
