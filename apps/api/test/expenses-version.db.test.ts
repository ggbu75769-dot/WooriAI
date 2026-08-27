import { randomUUID } from "node:crypto";
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { versionConflictResponseSchema } from "@wooriai/contracts";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AppModule } from "../src/app.module";
import { configureApiApp } from "../src/bootstrap";
import { deployMigrations, isDatabaseAvailable } from "./helpers/test-db";

const dbAvailable = await isDatabaseAvailable();
const categoryId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

/**
 * MOB-103 (design doc docs/5차/round5a-sprint1-plan.md §2.1-2.2): expense
 * `version` bookkeeping and the `expectedVersion` optimistic-concurrency branch
 * on PATCH/DELETE /v1/expenses/:id, implemented in
 * src/finance/expenses.service.ts (ExpensesVersionService) precisely so this
 * work never has to touch onboarding/onboarding-store.service.ts, which other
 * work this sprint owns concurrently.
 */
describe.skipIf(!dbAvailable)("Expense optimistic concurrency (version, real Postgres)", () => {
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

  async function login(prefix: string) {
    const providerToken = `${prefix}-${randomUUID()}`;
    const response = await request(app.getHttpServer())
      .post("/api/v1/auth/oauth-login")
      .send({ provider: "kakao", providerToken })
      .expect(200);
    return response.body.tokens.accessToken as string;
  }

  async function completeOnboarding(accessToken: string) {
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
        .send({ householdId, nickname: "버전테스트", stageMode: "manual", manualStage: "infant_4_6" })
        .expect(200)
    ).body.id as string;

    return { childId, householdId };
  }

  async function createExpense(accessToken: string, childId: string, itemName: string) {
    return (
      await request(app.getHttpServer())
        .post(`/api/v1/children/${childId}/expenses`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ categoryId, amountKrw: 10000, spentOn: "2026-07-06", itemName })
        .expect(200)
    ).body as { id: string; version: number };
  }

  it("starts every new expense at version 1, exposed on create/get/list/home", async () => {
    const accessToken = await login("version-create");
    const { childId } = await completeOnboarding(accessToken);
    const created = await createExpense(accessToken, childId, "버전1 기저귀");
    expect(created.version).toBe(1);

    await request(app.getHttpServer())
      .get(`/api/v1/expenses/${created.id}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200)
      .expect(({ body }) => expect(body.version).toBe(1));

    await request(app.getHttpServer())
      .get(`/api/v1/children/${childId}/expenses?yearMonth=2026-07`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.expenses.find((expense: { id: string }) => expense.id === created.id).version).toBe(1);
      });

    await request(app.getHttpServer())
      .get(`/api/v1/home?childId=${childId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.recentExpenses[0].version).toBe(1);
      });
  });

  it("increments version on update, with or without expectedVersion, and rejects a stale expectedVersion with 409 VERSION_CONFLICT + current", async () => {
    const accessToken = await login("version-update");
    const { childId } = await completeOnboarding(accessToken);
    const created = await createExpense(accessToken, childId, "버전2 분유");
    expect(created.version).toBe(1);

    // Legacy path: no expectedVersion -> existing behavior, but version still advances.
    const afterLegacyUpdate = (
      await request(app.getHttpServer())
        .patch(`/api/v1/expenses/${created.id}`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ amountKrw: 20000 })
        .expect(200)
    ).body as { version: number };
    expect(afterLegacyUpdate.version).toBe(2);

    // Correct expectedVersion -> succeeds and advances again.
    const afterConditionalUpdate = (
      await request(app.getHttpServer())
        .patch(`/api/v1/expenses/${created.id}`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ amountKrw: 30000, expectedVersion: 2 })
        .expect(200)
    ).body as { version: number };
    expect(afterConditionalUpdate.version).toBe(3);

    // Stale expectedVersion (server is now at 3) -> 409 with the current server state.
    await request(app.getHttpServer())
      .patch(`/api/v1/expenses/${created.id}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ amountKrw: 99999, expectedVersion: 2 })
      .expect(409)
      .expect(({ body }) => {
        // CON-115: 409 바디 전체가 공유 계약({error:{...}, current})에 맞아야 한다.
        versionConflictResponseSchema.parse(body);
        expect(body.error.code).toBe("VERSION_CONFLICT");
        expect(body.current).toMatchObject({ id: created.id, version: 3, amountKrw: 30000 });
      });

    // The rejected conditional update must not have applied its payload.
    await request(app.getHttpServer())
      .get(`/api/v1/expenses/${created.id}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.amountKrw).toBe(30000);
        expect(body.version).toBe(3);
      });
  });

  /**
   * 라운드 48 QA(P2-6) — 409 `current` 스냅숏이 결제 수단을 싣는다.
   *
   * `toExpenseSnapshot`은 주석에서 "store-shared.ts toExpenseDto의 미러 + version"이라고
   * 선언해 두고도 `paymentMethod`/`linkedItemTemplateId`를 빠뜨리고 있었다(두 필드는 라운드 48
   * T3에서 toExpenseDto에 열렸다). 그 누락이 사용자에게 닿던 자리가 앱의 충돌 화면
   * "두 값 나란히 보기"다: 로컬 대기 행에는 사용자가 고른 결제 수단이 있는데 서버 스냅숏에는
   * 그 키가 아예 없으니, **바꾼 적 없는 결제 수단이 매번 충돌 항목으로** 뜨고 서버 쪽 값은
   * "없음"으로 그려졌다 — 서버가 실제로 들고 있는 값을 두고 없다고 말하는 허위 표시다.
   *
   * 그리고 PATCH가 `paymentMethod`를 받는다: 충돌 화면이 이 필드를 고르게 해 놓고 그 선택을
   * 보낼 자리가 없으면(전역 ValidationPipe가 forbidNonWhitelisted라 실으면 400) 화면이 물어보고
   * 조용히 무시하는 셈이 된다.
   */
  it("409 current가 paymentMethod/linkedItemTemplateId를 싣고, PATCH가 paymentMethod를 받는다", async () => {
    const accessToken = await login("version-payment-method");
    const { childId } = await completeOnboarding(accessToken);

    const created = (
      await request(app.getHttpServer())
        .post(`/api/v1/children/${childId}/expenses`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({
          categoryId,
          amountKrw: 10000,
          spentOn: "2026-07-06",
          itemName: "결제수단 스냅숏",
          paymentMethod: "card"
        })
        .expect(200)
    ).body as { id: string; version: number; paymentMethod: string };
    expect(created.paymentMethod).toBe("card");

    // ① PATCH가 결제 수단을 실제로 받아 반영한다(예전에는 400 VALIDATION_ERROR였다).
    const updated = (
      await request(app.getHttpServer())
        .patch(`/api/v1/expenses/${created.id}`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ paymentMethod: "transfer", expectedVersion: created.version })
        .expect(200)
    ).body as { version: number; paymentMethod: string };
    expect(updated.paymentMethod).toBe("transfer");
    expect(updated.version).toBe(created.version + 1);

    // ② 낡은 expectedVersion으로 부딪히면, 409의 current가 **서버가 아는 결제 수단 그대로**를
    //    싣는다. 이 값이 없으면 앱 충돌 화면이 "없음"으로 그린다.
    await request(app.getHttpServer())
      .patch(`/api/v1/expenses/${created.id}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ amountKrw: 55000, expectedVersion: created.version })
      .expect(409)
      .expect(({ body }) => {
        versionConflictResponseSchema.parse(body);
        expect(body.current).toMatchObject({
          id: created.id,
          paymentMethod: "transfer",
          linkedItemTemplateId: null
        });
      });

    // ③ 모르는 결제 수단은 여전히 거절한다 — 계약을 넓힌 것이지 검증을 푼 것이 아니다.
    await request(app.getHttpServer())
      .patch(`/api/v1/expenses/${created.id}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ paymentMethod: "crypto" })
      .expect(400)
      .expect(({ body }) => expect(body.error.code).toBe("VALIDATION_ERROR"));
  });

  it("rolls back the version bump when the conditional update's field validation fails", async () => {
    const accessToken = await login("version-rollback");
    const { childId } = await completeOnboarding(accessToken);
    const created = await createExpense(accessToken, childId, "버전 롤백");

    await request(app.getHttpServer())
      .patch(`/api/v1/expenses/${created.id}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ itemName: "", expectedVersion: 1 })
      .expect(400);

    // A rejected (validation-failed) conditional update must not have burned the
    // version number -- the next attempt with the same expectedVersion succeeds.
    await request(app.getHttpServer())
      .patch(`/api/v1/expenses/${created.id}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ amountKrw: 15000, expectedVersion: 1 })
      .expect(200)
      .expect(({ body }) => expect(body.version).toBe(2));
  });

  it("conditionally deletes with expectedVersion, and returns a tombstone-shaped current on conflict", async () => {
    const accessToken = await login("version-delete");
    const { childId } = await completeOnboarding(accessToken);
    const created = await createExpense(accessToken, childId, "버전 삭제");

    await request(app.getHttpServer())
      .delete(`/api/v1/expenses/${created.id}?expectedVersion=99`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(409)
      .expect(({ body }) => {
        // CON-115: DELETE 충돌의 409 바디(살아있는 current)도 공유 계약에 맞아야 한다.
        versionConflictResponseSchema.parse(body);
        expect(body.error.code).toBe("VERSION_CONFLICT");
        expect(body.current).toMatchObject({ id: created.id, version: 1 });
      });

    await request(app.getHttpServer())
      .delete(`/api/v1/expenses/${created.id}?expectedVersion=1`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200)
      .expect(({ body }) => expect(body).toEqual({ success: true }));

    // Deleted expense: a further conditional update against the now-stale version
    // must 409 with a tombstone `current`, not a bare 404.
    await request(app.getHttpServer())
      .patch(`/api/v1/expenses/${created.id}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ amountKrw: 1000, expectedVersion: 1 })
      .expect(409)
      .expect(({ body }) => {
        // CON-115: 톰스톤 current를 포함한 409 바디도 공유 계약에 맞아야 한다.
        versionConflictResponseSchema.parse(body);
        expect(body.error.code).toBe("VERSION_CONFLICT");
        expect(body.current).toEqual({ id: created.id, deleted: true, version: 2 });
      });
  });

  it("does not leak another household's expense version/state through a 409 conflict (IDOR)", async () => {
    const ownerToken = await login("version-idor-owner");
    const { childId } = await completeOnboarding(ownerToken);
    const created = await createExpense(ownerToken, childId, "타가구 접근 차단");

    const strangerToken = await login("version-idor-stranger");

    await request(app.getHttpServer())
      .patch(`/api/v1/expenses/${created.id}`)
      .set("Authorization", `Bearer ${strangerToken}`)
      .send({ amountKrw: 1, expectedVersion: 1 })
      .expect(403)
      .expect(({ body }) => {
        expect(body.error.code).toBe("FORBIDDEN");
        expect(body.current).toBeUndefined();
      });

    await request(app.getHttpServer())
      .delete(`/api/v1/expenses/${created.id}?expectedVersion=1`)
      .set("Authorization", `Bearer ${strangerToken}`)
      .expect(403);
  });
});
