import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AppModule } from "../src/app.module";
import { configureApiApp } from "../src/bootstrap";

// Round 4: dev-login persists a real users/households row per providerToken, and
// this helper is called from two separate `it` blocks in this file plus reused
// across test runs against the same persistent database. A random suffix keeps
// every login isolated to its own fresh account/household.
async function login(app: INestApplication) {
  const response = await request(app.getHttpServer())
    .post("/api/v1/auth/oauth-login")
    .send({ provider: "kakao", providerToken: `onboarding-token-${randomUUID()}` })
    .expect(200);

  return response.body.tokens.accessToken as string;
}

describe("Auth and onboarding API", () => {
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

  it("blocks onboarding until required consents are accepted, then completes child/prepared/budget steps", async () => {
    const accessToken = await login(app);

    const meResponse = await request(app.getHttpServer())
      .get("/api/v1/me")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);
    const householdId = meResponse.body.households[0].id as string;

    await request(app.getHttpServer())
      .get("/api/v1/onboarding/status")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual({
          completed: false,
          nextStep: "consents",
          canRestart: true,
          summary: { consentsAccepted: false, child: null, preparedItemsCount: null, budget: null }
        });
      });

    await request(app.getHttpServer())
      .post("/api/v1/children")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ householdId, nickname: "튼튼이", stageMode: "manual", manualStage: "infant_4_6" })
      .expect(403)
      .expect(({ body }) => {
        expect(body.error.code).toBe("CONSENT_REQUIRED");
      });

    await request(app.getHttpServer())
      .get("/api/v1/consents")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.consents).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ type: "terms", required: true, accepted: false }),
            expect.objectContaining({ type: "privacy", required: true, accepted: false })
          ])
        );
      });

    await request(app.getHttpServer())
      .put("/api/v1/consents")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        consents: [
          { type: "terms", version: "2026-07-06", accepted: true },
          { type: "privacy", version: "2026-07-06", accepted: true },
          { type: "marketing", version: "2026-07-06", accepted: false }
        ]
      })
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual({ success: true });
      });

    await request(app.getHttpServer())
      .get("/api/v1/onboarding/status")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual({
          completed: false,
          nextStep: "child-profile",
          canRestart: true,
          summary: { consentsAccepted: true, child: null, preparedItemsCount: null, budget: null }
        });
      });

    // MOB-101: same Idempotency-Key resubmitted (app retry after a lost response, or a
    // resume-flow re-render before the previous request settled) must return the same child
    // instead of creating a duplicate one.
    const createChildBody = {
      householdId,
      nickname: "튼튼이",
      stageMode: "pregnant",
      dueDate: "2026-08-31"
    };
    const idempotencyKey = randomUUID();

    const childResponse = await request(app.getHttpServer())
      .post("/api/v1/children")
      .set("Authorization", `Bearer ${accessToken}`)
      .set("Idempotency-Key", idempotencyKey)
      .send(createChildBody)
      .expect(200);

    expect(childResponse.body).toMatchObject({
      id: expect.any(String),
      householdId,
      nickname: "튼튼이",
      stageMode: "pregnant",
      currentStage: "pregnancy_late"
    });

    const childId = childResponse.body.id as string;

    const replayedChildResponse = await request(app.getHttpServer())
      .post("/api/v1/children")
      .set("Authorization", `Bearer ${accessToken}`)
      .set("Idempotency-Key", idempotencyKey)
      .send(createChildBody)
      .expect(200);
    expect(replayedChildResponse.body.id).toBe(childId);

    await request(app.getHttpServer())
      .get("/api/v1/children")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.children).toHaveLength(1);
        expect(body.children[0].id).toBe(childId);
      });

    await request(app.getHttpServer())
      .patch(`/api/v1/children/${childId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ nickname: "반짝이" })
      .expect(200)
      .expect(({ body }) => {
        expect(body.nickname).toBe("반짝이");
      });

    await request(app.getHttpServer())
      .post(`/api/v1/children/${childId}/prepared-items`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        itemTemplateIds: [
          "11111111-1111-4111-8111-111111111111",
          "22222222-2222-4222-8222-222222222222"
        ]
      })
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual({ updatedCount: 2 });
      });

    await request(app.getHttpServer())
      .get("/api/v1/onboarding/status")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual({
          completed: false,
          nextStep: "budget",
          canRestart: false,
          summary: {
            consentsAccepted: true,
            child: expect.objectContaining({ id: childId, nickname: "반짝이" }),
            preparedItemsCount: 0,
            budget: null
          }
        });
      });

    await request(app.getHttpServer())
      .put(`/api/v1/children/${childId}/budget`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ yearMonth: "2026-07-01", amountKrw: 500000 })
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          childId,
          yearMonth: "2026-07-01",
          amountKrw: 500000,
          usedAmountKrw: 0,
          remainingAmountKrw: 500000
        });
      });

    await request(app.getHttpServer())
      .get("/api/v1/onboarding/status")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual({
          completed: true,
          nextStep: "home",
          canRestart: false,
          summary: {
            consentsAccepted: true,
            child: expect.objectContaining({ id: childId, nickname: "반짝이" }),
            preparedItemsCount: 0,
            budget: { yearMonth: "2026-07-01", amountKrw: 500000 }
          }
        });
      });
  });

  it("keeps onboarding budget amounts as positive KRW integers", async () => {
    const accessToken = await login(app);
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

    const householdId = (
      await request(app.getHttpServer())
        .get("/api/v1/me")
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(200)
    ).body.households[0].id as string;

    const childId = (
      await request(app.getHttpServer())
        .post("/api/v1/children")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ householdId, nickname: "튼튼이", stageMode: "manual", manualStage: "infant_4_6" })
        .expect(200)
    ).body.id as string;

    await request(app.getHttpServer())
      .put(`/api/v1/children/${childId}/budget`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ yearMonth: "2026-07-01", amountKrw: 0 })
      .expect(400)
      .expect(({ body }) => {
        expect(body.error.code).toBe("VALIDATION_ERROR");
      });
  });

  // MOB-101: the onboarding resume screen (ONB-006) only offers "처음부터 시작" while no child
  // has been created yet for the household -- once a child exists, restarting risks orphaning
  // it or (if the user re-enters child-profile) creating a duplicate, so canRestart flips to
  // false and stays false for the rest of onboarding.
  it("flips onboarding status canRestart to false once a child exists, and rejects a reused Idempotency-Key sent with a different body", async () => {
    const accessToken = await login(app);
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

    const householdId = (
      await request(app.getHttpServer())
        .get("/api/v1/me")
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(200)
    ).body.households[0].id as string;

    await request(app.getHttpServer())
      .get("/api/v1/onboarding/status")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.canRestart).toBe(true);
      });

    const idempotencyKey = randomUUID();
    await request(app.getHttpServer())
      .post("/api/v1/children")
      .set("Authorization", `Bearer ${accessToken}`)
      .set("Idempotency-Key", idempotencyKey)
      .send({ householdId, nickname: "튼튼이", stageMode: "manual", manualStage: "infant_4_6" })
      .expect(200);

    await request(app.getHttpServer())
      .get("/api/v1/onboarding/status")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.canRestart).toBe(false);
      });

    // Same key, different body (a second, distinct child) is a genuine conflict, not a retry --
    // must not silently create a second child under cover of the first key.
    await request(app.getHttpServer())
      .post("/api/v1/children")
      .set("Authorization", `Bearer ${accessToken}`)
      .set("Idempotency-Key", idempotencyKey)
      .send({ householdId, nickname: "다른아이", stageMode: "manual", manualStage: "toddler_1_3" })
      .expect(409)
      .expect(({ body }) => {
        expect(body.error.code).toBe("IDEMPOTENCY_KEY_CONFLICT");
      });

    await request(app.getHttpServer())
      .get("/api/v1/children")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.children).toHaveLength(1);
      });
  });

  it("creates multiple child profiles and immediately applies a corrected stage mode", async () => {
    const accessToken = await login(app);
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

    const householdId = (
      await request(app.getHttpServer())
        .get("/api/v1/me")
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(200)
    ).body.households[0].id as string;

    const first = await request(app.getHttpServer())
      .post("/api/v1/children")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ householdId, nickname: "첫째", stageMode: "manual", manualStage: "infant_4_6" })
      .expect(200);
    const second = await request(app.getHttpServer())
      .post("/api/v1/children")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ householdId, nickname: "둘째", stageMode: "manual", manualStage: "newborn_0_3" })
      .expect(200);

    await request(app.getHttpServer())
      .patch(`/api/v1/children/${second.body.id}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ nickname: "둘째 수정", stageMode: "born", birthDate: "2025-07-14" })
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({ id: second.body.id, nickname: "둘째 수정", stageMode: "born" });
        expect(body.currentStage).not.toBe("newborn_0_3");
      });

    await request(app.getHttpServer())
      .get("/api/v1/children")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.children.map((child: { id: string }) => child.id)).toEqual(
          expect.arrayContaining([first.body.id, second.body.id])
        );
      });
  });
});
