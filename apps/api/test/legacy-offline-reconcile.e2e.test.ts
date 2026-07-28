import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AppModule } from "../src/app.module";
import { configureApiApp } from "../src/bootstrap";
import { PrismaService } from "../src/prisma/prisma.service";

async function session(app: INestApplication, label: string) {
  const login = await request(app.getHttpServer())
    .post("/api/v1/auth/oauth-login")
    .send({ provider: "kakao", providerToken: `release4f-${label}-${randomUUID()}` })
    .expect(200);
  const token = login.body.tokens.accessToken as string;
  const me = await request(app.getHttpServer())
    .get("/api/v1/me")
    .set("Authorization", `Bearer ${token}`)
    .expect(200);
  const householdId = me.body.households[0].id as string;
  await request(app.getHttpServer())
    .put("/api/v1/consents")
    .set("Authorization", `Bearer ${token}`)
    .send({
      consents: [
        { type: "terms", version: "2026-07-06", accepted: true },
        { type: "privacy", version: "2026-07-06", accepted: true }
      ]
    })
    .expect(200);
  const child = await request(app.getHttpServer())
    .post("/api/v1/children")
    .set("Authorization", `Bearer ${token}`)
    .send({ householdId, nickname: label, stageMode: "manual", manualStage: "newborn_0_3" })
    .expect(200);
  return { token, childId: child.body.id as string };
}

describe("legacy offline mutation reconciliation", () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeEach(async () => {
    process.env.JWT_ACCESS_SECRET = "test-access-secret";
    process.env.JWT_REFRESH_SECRET = "test-refresh-secret";
    process.env.NODE_ENV = "test";
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApiApp(app);
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterEach(async () => app.close());

  it("attributes only the current user's exact completed idempotent request", async () => {
    const owner = await session(app, "legacy-owner");
    const outsider = await session(app, "legacy-outsider");
    const category = await prisma.category.findFirstOrThrow();
    const idempotencyKey = randomUUID();
    const body = {
      categoryId: category.id,
      amountKrw: 42_000,
      spentOn: "2026-07-17",
      itemName: "기존 오프라인 지출",
      expenseType: "expense"
    };
    const path = `/children/${owner.childId}/expenses`;

    const created = await request(app.getHttpServer())
      .post(`/api/v1${path}`)
      .set("Authorization", `Bearer ${owner.token}`)
      .set("Idempotency-Key", idempotencyKey)
      .send(body)
      .expect(200);

    const mutation = {
      sourceLocalId: "legacy-local-1",
      sourceMutationId: "legacy-mutation-1",
      idempotencyKey,
      method: "POST",
      path,
      body
    };
    const ownerResult = await request(app.getHttpServer())
      .post("/api/v1/sync/offline/reconcile-legacy")
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ mutations: [mutation] })
      .expect(201);
    expect(ownerResult.body.results).toEqual([
      expect.objectContaining({
        sourceLocalId: mutation.sourceLocalId,
        sourceMutationId: mutation.sourceMutationId,
        disposition: "already_synced",
        reasonCode: "CURRENT_USER_COMPLETED_REQUEST_MATCH",
        response: expect.objectContaining({ id: created.body.id })
      })
    ]);

    const outsiderResult = await request(app.getHttpServer())
      .post("/api/v1/sync/offline/reconcile-legacy")
      .set("Authorization", `Bearer ${outsider.token}`)
      .send({ mutations: [mutation] })
      .expect(201);
    expect(outsiderResult.body.results).toEqual([
      expect.objectContaining({
        disposition: "ambiguous",
        reasonCode: "CURRENT_USER_IDEMPOTENCY_PROOF_NOT_FOUND"
      })
    ]);

    const changedBodyResult = await request(app.getHttpServer())
      .post("/api/v1/sync/offline/reconcile-legacy")
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ mutations: [{ ...mutation, body: { ...body, amountKrw: 99_000 } }] })
      .expect(201);
    expect(changedBodyResult.body.results).toEqual([
      expect.objectContaining({
        disposition: "ambiguous",
        reasonCode: "IDEMPOTENCY_REQUEST_HASH_MISMATCH"
      })
    ]);
  });
});
