import type { INestApplication } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AppModule } from "../src/app.module";
import { configureApiApp } from "../src/bootstrap";

const categoryId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

async function login(app: INestApplication, token: string) {
  return (
    await request(app.getHttpServer())
      .post("/api/v1/auth/oauth-login")
      .send({ provider: "kakao", providerToken: token })
      .expect(200)
  ).body.tokens.accessToken as string;
}

async function createChild(app: INestApplication, accessToken: string) {
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

  return (
    await request(app.getHttpServer())
      .post("/api/v1/children")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ householdId, nickname: "다온이", stageMode: "manual", manualStage: "toddler_1_3" })
      .expect(200)
  ).body.id as string;
}

describe("PAY-001 user payment methods", () => {
  let app: INestApplication;
  let moduleRef: TestingModule;

  beforeEach(async () => {
    process.env.JWT_ACCESS_SECRET = "test-access-secret";
    process.env.JWT_REFRESH_SECRET = "test-refresh-secret";
    process.env.WOORIAI_STAGE_TODAY = "2026-07-14";
    moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApiApp(app);
    await app.init();
  });

  afterEach(async () => {
    delete process.env.WOORIAI_STAGE_TODAY;
    await app.close();
  });

  it("keeps the empty default unspecified and supports create, update, default, deactivate, and reactivate", async () => {
    const accessToken = await login(app, `pay-owner-${randomUUID()}`);

    await request(app.getHttpServer())
      .get("/api/v1/me/payment-methods")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200)
      .expect({ paymentMethods: [] });

    const cash = (
      await request(app.getHttpServer())
        .post("/api/v1/me/payment-methods")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ type: "cash", label: "현금", isDefault: false })
        .expect(200)
    ).body as { id: string };

    const card = (
      await request(app.getHttpServer())
        .post("/api/v1/me/payment-methods")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ type: "card", label: "생활비 카드", isDefault: true })
        .expect(200)
    ).body as { id: string };

    await request(app.getHttpServer())
      .patch(`/api/v1/me/payment-methods/${cash.id}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ label: "생활비 현금", isDefault: true })
      .expect(200);

    await request(app.getHttpServer())
      .get("/api/v1/me/payment-methods")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.paymentMethods.filter((method: { isDefault: boolean }) => method.isDefault)).toHaveLength(1);
        expect(body.paymentMethods).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ id: cash.id, label: "생활비 현금", isDefault: true, active: true }),
            expect.objectContaining({ id: card.id, label: "생활비 카드", isDefault: false, active: true })
          ])
        );
      });

    await request(app.getHttpServer())
      .delete(`/api/v1/me/payment-methods/${cash.id}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200)
      .expect(({ body }) => expect(body).toMatchObject({ id: cash.id, active: false, isDefault: false }));

    await request(app.getHttpServer())
      .put(`/api/v1/me/payment-methods/${cash.id}/active`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200)
      .expect(({ body }) => expect(body).toMatchObject({ id: cash.id, active: true, isDefault: false }));
  });

  it("rejects sensitive numbers and prevents cross-user access while preserving past expense linkage", async () => {
    const ownerToken = await login(app, `pay-owner-${randomUUID()}`);
    const otherToken = await login(app, `pay-other-${randomUUID()}`);
    const childId = await createChild(app, ownerToken);

    await request(app.getHttpServer())
      .post("/api/v1/me/payment-methods")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ type: "card", label: "1234-5678-9012-3456" })
      .expect(400)
      .expect(({ body }) => expect(body.error.code).toBe("PAYMENT_METHOD_SENSITIVE_NUMBER_FORBIDDEN"));

    const method = (
      await request(app.getHttpServer())
        .post("/api/v1/me/payment-methods")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ type: "card", label: "생활비 카드", isDefault: true })
        .expect(200)
    ).body as { id: string };

    await request(app.getHttpServer())
      .patch(`/api/v1/me/payment-methods/${method.id}`)
      .set("Authorization", `Bearer ${otherToken}`)
      .send({ label: "탈취 시도" })
      .expect(404);

    const expense = (
      await request(app.getHttpServer())
        .post(`/api/v1/children/${childId}/expenses`)
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({
          categoryId,
          amountKrw: 49_800,
          spentOn: "2026-07-14",
          itemName: "기저귀",
          paymentMethodId: method.id
        })
        .expect(200)
        .expect(({ body }) => expect(body).toMatchObject({ paymentMethod: "card", paymentMethodId: method.id }))
    ).body as { id: string };

    await request(app.getHttpServer())
      .delete(`/api/v1/me/payment-methods/${method.id}`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .expect(200);

    await request(app.getHttpServer())
      .get(`/api/v1/expenses/${expense.id}`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .expect(200)
      .expect(({ body }) => expect(body).toMatchObject({ paymentMethod: "card", paymentMethodId: method.id }));

    await request(app.getHttpServer())
      .patch(`/api/v1/expenses/${expense.id}`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ memo: "비활성 결제수단 연결 유지", paymentMethodId: method.id })
      .expect(200)
      .expect(({ body }) =>
        expect(body).toMatchObject({ memo: "비활성 결제수단 연결 유지", paymentMethodId: method.id })
      );

    await request(app.getHttpServer())
      .post(`/api/v1/children/${childId}/expenses`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        categoryId,
        amountKrw: 10_000,
        spentOn: "2026-07-14",
        itemName: "재사용 금지",
        paymentMethodId: method.id
      })
      .expect(404);
  });

  it("ranks up to six 90-day expense shortcuts without pre-filling a confirmed amount", async () => {
    const accessToken = await login(app, `shortcut-owner-${randomUUID()}`);
    const childId = await createChild(app, accessToken);
    const createExpense = (itemName: string, spentOn: string, amountKrw: number) =>
      request(app.getHttpServer())
        .post(`/api/v1/children/${childId}/expenses`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ categoryId, itemName, spentOn, amountKrw });

    await createExpense("기저귀", "2026-07-14", 49_800).expect(200);
    await createExpense("기저귀", "2026-07-13", 45_000).expect(200);
    for (const [index, itemName] of ["분유", "물티슈", "간식", "병원", "장난감", "도서"].entries()) {
      await createExpense(itemName, `2026-07-${String(12 - index).padStart(2, "0")}`, 10_000 + index).expect(200);
    }
    await createExpense("90일 밖 항목", "2026-04-01", 1_000).expect(200);

    await request(app.getHttpServer())
      .get(`/api/v1/children/${childId}/expense-shortcuts`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.shortcuts).toHaveLength(6);
        expect(body.shortcuts[0]).toEqual({
          itemName: "기저귀",
          categoryId,
          lastAmountKrw: 49_800,
          useCount: 2
        });
        expect(body.shortcuts.map((shortcut: { itemName: string }) => shortcut.itemName)).not.toContain("90일 밖 항목");
      });
  });

  it("serializes concurrent default switches so exactly one method remains default", async () => {
    const accessToken = await login(app, `pay-concurrent-${randomUUID()}`);
    const methods = await Promise.all(
      ["생활비 카드", "비상 현금"].map(async (label, index) =>
        (
          await request(app.getHttpServer())
            .post("/api/v1/me/payment-methods")
            .set("Authorization", `Bearer ${accessToken}`)
            .send({ type: index === 0 ? "card" : "cash", label, isDefault: false })
            .expect(200)
        ).body as { id: string }
      )
    );

    await Promise.all(
      methods.map((method) =>
        request(app.getHttpServer())
          .put(`/api/v1/me/payment-methods/${method.id}/default`)
          .set("Authorization", `Bearer ${accessToken}`)
          .expect(200)
      )
    );

    await request(app.getHttpServer())
      .get("/api/v1/me/payment-methods")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.paymentMethods.filter((method: { isDefault: boolean }) => method.isDefault)).toHaveLength(1);
      });
  });

  it("keeps 90-day shortcuts isolated between children in the same household", async () => {
    const accessToken = await login(app, `shortcut-isolation-${randomUUID()}`);
    const firstChildId = await createChild(app, accessToken);
    const secondChildId = await createChild(app, accessToken);
    const createExpense = (childId: string, itemName: string, spentOn: string) =>
      request(app.getHttpServer())
        .post(`/api/v1/children/${childId}/expenses`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ categoryId, itemName, spentOn, amountKrw: 10_000 });

    await createExpense(firstChildId, "첫째 기저귀", "2026-07-14").expect(200);
    await createExpense(secondChildId, "둘째 전용 분유", "2026-07-14").expect(200);
    await createExpense(secondChildId, "둘째 전용 분유", "2026-07-13").expect(200);

    await request(app.getHttpServer())
      .get(`/api/v1/children/${firstChildId}/expense-shortcuts`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.shortcuts).toEqual([
          { itemName: "첫째 기저귀", categoryId, lastAmountKrw: 10_000, useCount: 1 }
        ]);
      });
  });
});
