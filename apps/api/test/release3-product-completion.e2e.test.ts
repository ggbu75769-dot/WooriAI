import { randomUUID } from "node:crypto";
import type { INestApplication } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AppModule } from "../src/app.module";
import { configureApiApp } from "../src/bootstrap";

const categoryId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

describe("Release 3 product completion APIs", () => {
  let app: INestApplication;
  let moduleRef: TestingModule;
  let token: string;
  let householdId: string;

  beforeEach(async () => {
    process.env.JWT_ACCESS_SECRET = "test-access-secret";
    process.env.JWT_REFRESH_SECRET = "test-refresh-secret";
    moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApiApp(app);
    await app.init();
    const login = await request(app.getHttpServer())
      .post("/api/v1/auth/oauth-login")
      .send({ provider: "kakao", providerToken: `release3-product-${randomUUID()}` })
      .expect(200);
    token = login.body.tokens.accessToken;
    householdId = login.body.user.households[0].id;
  });

  afterEach(async () => { await app.close(); });

  it("creates, sorts, uses, and archives a user quick-expense preset", async () => {
    const created = await request(app.getHttpServer())
      .post(`/api/v1/households/${householdId}/expense-presets`)
      .set("Authorization", `Bearer ${token}`)
      .send({ itemName: "기저귀 묶음", categoryId, defaultAmountKrw: 42000, pinned: true })
      .expect(200);
    await request(app.getHttpServer())
      .post(`/api/v1/households/${householdId}/expense-presets/${created.body.id}/use`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200)
      .expect(({ body }) => expect(body.useCount).toBe(1));
    await request(app.getHttpServer())
      .get(`/api/v1/households/${householdId}/expense-presets`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200)
      .expect(({ body }) => expect(body.presets[0]).toMatchObject({ id: created.body.id, pinned: true }));
    await request(app.getHttpServer())
      .delete(`/api/v1/households/${householdId}/expense-presets/${created.body.id}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
  });

  it("keeps marketing notification opt-in off and removes a device token on disable", async () => {
    await request(app.getHttpServer())
      .get("/api/v1/notification-preferences")
      .set("Authorization", `Bearer ${token}`)
      .expect(200)
      .expect(({ body }) => expect(body.marketingEnabled).toBe(false));
    await request(app.getHttpServer())
      .put("/api/v1/notification-preferences")
      .set("Authorization", `Bearer ${token}`)
      .send({ quietHoursStart: "22:00", quietHoursEnd: "07:00", marketingEnabled: false })
      .expect(200);
    const device = await request(app.getHttpServer())
      .post("/api/v1/devices")
      .set("Authorization", `Bearer ${token}`)
      .send({ platform: "android", deviceId: `device-${randomUUID()}`, pushToken: "test-push-token" })
      .expect(200);
    await request(app.getHttpServer())
      .delete(`/api/v1/devices/${device.body.id}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
  });

  it("accepts bounded reason-code support reports without free-form PII", async () => {
    await request(app.getHttpServer())
      .post("/api/v1/support/reports")
      .set("Authorization", `Bearer ${token}`)
      .send({ targetType: "sync", reasonCode: "SYNC_FAILURE" })
      .expect(200)
      .expect(({ body }) => expect(body).toMatchObject({ targetType: "sync", reasonCode: "SYNC_FAILURE", state: "open" }));
    await request(app.getHttpServer())
      .post("/api/v1/support/reports")
      .set("Authorization", `Bearer ${token}`)
      .send({ targetType: "sync", reasonCode: "free form secret" })
      .expect(400);
  });
});
