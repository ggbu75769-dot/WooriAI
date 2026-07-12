import { randomUUID } from "node:crypto";
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AppModule } from "../src/app.module";
import { configureApiApp } from "../src/bootstrap";
import { deployMigrations, isDatabaseAvailable } from "./helpers/test-db";

const dbAvailable = await isDatabaseAvailable();

/**
 * Covers the concurrency fixes: refresh-token double-spend, double-confirm of an
 * excel import, and double-accept of a single-use household invite. Each test uses
 * `Promise.all` to fire two requests that race against the same underlying
 * single-use resource and asserts exactly one of them can win.
 *
 * Isolation: every test uses a fresh, randomly-suffixed providerToken (and derives
 * a fresh household/child/import job/invite from it), and every assertion is scoped
 * to that test's own ids -- never a bare table-wide count -- so this file is safe to
 * run alongside other DB-backed suites that write to the same tables in parallel
 * (see test-db.ts's note on why there's no table-truncate helper).
 */
describe.skipIf(!dbAvailable)("Concurrency fixes (real Postgres)", () => {
  let app: INestApplication;

  beforeAll(async () => {
    deployMigrations();
    process.env.JWT_ACCESS_SECRET = "test-access-secret";
    process.env.JWT_REFRESH_SECRET = "test-refresh-secret";
    process.env.WOORIAI_STAGE_TODAY = "2026-07-06";

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApiApp(app);
    await app.init();
  });

  afterAll(async () => {
    delete process.env.WOORIAI_STAGE_TODAY;
    await app.close();
  });

  async function login(providerTokenPrefix: string) {
    const providerToken = `${providerTokenPrefix}-${randomUUID()}`;
    const response = await request(app.getHttpServer())
      .post("/api/v1/auth/oauth-login")
      .send({ provider: "kakao", providerToken })
      .expect(200);
    return {
      userId: response.body.user.id as string,
      accessToken: response.body.tokens.accessToken as string,
      refreshToken: response.body.tokens.refreshToken as string
    };
  }

  async function householdIdFor(accessToken: string) {
    return (
      await request(app.getHttpServer()).get("/api/v1/me").set("Authorization", `Bearer ${accessToken}`).expect(200)
    ).body.households[0].id as string;
  }

  async function completeOnboarding(accessToken: string, nickname: string) {
    const householdId = await householdIdFor(accessToken);

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
        .send({ householdId, nickname, stageMode: "manual", manualStage: "infant_4_6" })
        .expect(200)
    ).body.id as string;

    return { householdId, childId };
  }

  it("H1: rejects double-spend of the same refresh token when two requests race, and the winner's new token is also invalidated by the resulting family revoke", async () => {
    const { refreshToken } = await login("db-concurrency-refresh");

    const [first, second] = await Promise.all([
      request(app.getHttpServer()).post("/api/v1/auth/refresh").send({ refreshToken }),
      request(app.getHttpServer()).post("/api/v1/auth/refresh").send({ refreshToken })
    ]);

    // Exactly one of the two concurrent redemptions of the same single-use
    // refresh token succeeds; the other is rejected.
    expect([first.status, second.status].sort()).toEqual([200, 401]);

    const successful = first.status === 200 ? first : second;
    const newRefreshToken = successful.body.refreshToken as string;
    expect(newRefreshToken).toEqual(expect.any(String));

    // The losing request's reuse-style failure revokes the whole family, so even
    // the winner's freshly-issued token can no longer be redeemed afterward.
    await request(app.getHttpServer())
      .post("/api/v1/auth/refresh")
      .send({ refreshToken: newRefreshToken })
      .expect(401);

    // Replaying the original (already-claimed) token also stays rejected.
    await request(app.getHttpServer()).post("/api/v1/auth/refresh").send({ refreshToken }).expect(401);
  });

  it("H2: confirms an excel import exactly once under concurrent confirm requests, creating expenses only once", async () => {
    const { accessToken } = await login("db-concurrency-import");
    const { childId } = await completeOnboarding(accessToken, "동시성-가져오기");

    const job = (
      await request(app.getHttpServer())
        .post(`/api/v1/children/${childId}/imports/excel`)
        .set("Authorization", `Bearer ${accessToken}`)
        .field("fileName", "concurrency-import.csv")
        .attach("file", Buffer.from("date,item,amount\n2026-07-06,diapers,32000\n"), "concurrency-import.csv")
        .expect(200)
    ).body as { id: string; candidateCount: number };

    expect(job.candidateCount).toBeGreaterThan(0);

    const rows = (
      await request(app.getHttpServer())
        .get(`/api/v1/imports/${job.id}/rows`)
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(200)
    ).body.rows as Array<{ id: string; selected: boolean }>;
    const selectedRowIds = rows.filter((row) => row.selected).map((row) => row.id);
    expect(selectedRowIds).toHaveLength(job.candidateCount);

    const [first, second] = await Promise.all([
      request(app.getHttpServer())
        .post(`/api/v1/imports/${job.id}/confirm`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ selectedRowIds }),
      request(app.getHttpServer())
        .post(`/api/v1/imports/${job.id}/confirm`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ selectedRowIds })
    ]);

    // Exactly one of the two concurrent confirms wins the compare-and-swap; the
    // other gets the same IMPORT_NOT_CONFIRMABLE error a sequential double-confirm
    // already produced.
    expect([first.status, second.status].sort()).toEqual([200, 400]);
    const successful = first.status === 200 ? first : second;
    const failed = first.status === 200 ? second : first;
    expect(successful.body.importedCount).toBe(job.candidateCount);
    expect(failed.body.error.code).toBe("IMPORT_NOT_CONFIRMABLE");

    // Expenses were created exactly once (selected-row count), not twice.
    const expensesResponse = await request(app.getHttpServer())
      .get(`/api/v1/children/${childId}/expenses?yearMonth=2026-07`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);
    expect(expensesResponse.body.expenses).toHaveLength(job.candidateCount);
  });

  it("M2: accepts a shared invite token exactly once when two different users race to accept it", async () => {
    const { accessToken: ownerToken } = await login("db-concurrency-invite-owner");
    const householdId = await householdIdFor(ownerToken);

    const inviteResponse = await request(app.getHttpServer())
      .post(`/api/v1/households/${householdId}/invites`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ role: "co_parent", channel: "link" })
      .expect(200);
    const inviteToken = (inviteResponse.body.inviteUrl as string).split("/invite/")[1]!;

    const { accessToken: userAToken } = await login("db-concurrency-invite-a");
    const { accessToken: userBToken } = await login("db-concurrency-invite-b");

    const [first, second] = await Promise.all([
      request(app.getHttpServer())
        .post(`/api/v1/invites/${inviteToken}/accept`)
        .set("Authorization", `Bearer ${userAToken}`),
      request(app.getHttpServer())
        .post(`/api/v1/invites/${inviteToken}/accept`)
        .set("Authorization", `Bearer ${userBToken}`)
    ]);

    // Exactly one of the two different users wins the accept race; the other gets
    // the same INVITE_NOT_PENDING error a sequential re-accept already produced.
    expect([first.status, second.status].sort()).toEqual([200, 400]);
    const failed = first.status === 200 ? second : first;
    expect(failed.body.error.code).toBe("INVITE_NOT_PENDING");

    const members = (
      await request(app.getHttpServer())
        .get(`/api/v1/households/${householdId}/members`)
        .set("Authorization", `Bearer ${ownerToken}`)
        .expect(200)
    ).body.members as Array<{ role: string; status: string }>;

    // Only one new co_parent member was added -- not two.
    expect(members.filter((member) => member.role === "co_parent" && member.status === "active")).toHaveLength(1);
  });
});
