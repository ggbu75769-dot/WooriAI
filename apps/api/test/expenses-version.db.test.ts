import { randomUUID } from "node:crypto";
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AppModule } from "../src/app.module";
import { configureApiApp } from "../src/bootstrap";
import {
  EXPENSE_VERSION_TRANSACTION_HOOK,
  type ExpenseVersionTransactionHook
} from "../src/finance/expenses.service";
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
  let failAfterMutation: "update" | "delete" | null = null;
  const transactionHook: ExpenseVersionTransactionHook = {
    afterMutation: (operation) => {
      if (failAfterMutation === operation) {
        failAfterMutation = null;
        throw new Error(`TEST_ONLY_FAIL_AFTER_${operation.toUpperCase()}`);
      }
    }
  };

  beforeAll(async () => {
    deployMigrations();
    process.env.JWT_ACCESS_SECRET = "test-access-secret";
    process.env.JWT_REFRESH_SECRET = "test-refresh-secret";
    process.env.WOORIAI_STAGE_TODAY = "2026-07-06";

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(EXPENSE_VERSION_TRANSACTION_HOOK)
      .useValue(transactionHook)
      .compile();
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

  it("rolls back both payload and version when a failure is injected after update mutation but before commit", async () => {
    const accessToken = await login("version-atomic-update");
    const { childId } = await completeOnboarding(accessToken);
    const created = await createExpense(accessToken, childId, "원자적 수정");

    failAfterMutation = "update";
    await request(app.getHttpServer())
      .patch(`/api/v1/expenses/${created.id}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ amountKrw: 77777, expectedVersion: 1 })
      .expect(500);

    await request(app.getHttpServer())
      .get(`/api/v1/expenses/${created.id}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.amountKrw).toBe(10000);
        expect(body.version).toBe(1);
      });
  });

  it("commits exactly one of two concurrent updates for the same expected version", async () => {
    const accessToken = await login("version-concurrent-update");
    const { childId } = await completeOnboarding(accessToken);
    const created = await createExpense(accessToken, childId, "동시 수정");

    const attempts = await Promise.all([
      request(app.getHttpServer())
        .patch(`/api/v1/expenses/${created.id}`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ amountKrw: 20000, expectedVersion: 1 }),
      request(app.getHttpServer())
        .patch(`/api/v1/expenses/${created.id}`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ amountKrw: 30000, expectedVersion: 1 })
    ]);

    expect(attempts.map((response) => response.status).sort()).toEqual([200, 409]);
    expect(attempts.find((response) => response.status === 409)?.body.error.code).toBe("VERSION_CONFLICT");

    await request(app.getHttpServer())
      .get(`/api/v1/expenses/${created.id}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect([20000, 30000]).toContain(body.amountKrw);
        expect(body.version).toBe(2);
      });
  });

  it("commits exactly one winner when update and delete race on the same expected version", async () => {
    const accessToken = await login("version-update-delete-race");
    const { childId } = await completeOnboarding(accessToken);
    const created = await createExpense(accessToken, childId, "동시 수정 삭제");

    const attempts = await Promise.all([
      request(app.getHttpServer())
        .patch(`/api/v1/expenses/${created.id}`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ amountKrw: 45678, expectedVersion: 1 }),
      request(app.getHttpServer())
        .delete(`/api/v1/expenses/${created.id}?expectedVersion=1`)
        .set("Authorization", `Bearer ${accessToken}`)
    ]);

    expect(attempts.map((response) => response.status).sort()).toEqual([200, 409]);
    expect(attempts.find((response) => response.status === 409)?.body.error.code).toBe("VERSION_CONFLICT");
    const updateWon = attempts[0]?.status === 200;
    const finalRead = await request(app.getHttpServer())
      .get(`/api/v1/expenses/${created.id}`)
      .set("Authorization", `Bearer ${accessToken}`);
    if (updateWon) {
      expect(finalRead.status).toBe(200);
      expect(finalRead.body).toMatchObject({ amountKrw: 45678, version: 2 });
    } else {
      expect(finalRead.status).toBe(404);
    }
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
        expect(body.error.code).toBe("VERSION_CONFLICT");
        expect(body.current).toEqual({ id: created.id, deleted: true, version: 2 });
      });
  });

  it("binds an expense idempotency key to expectedVersion in the DELETE query string", async () => {
    const accessToken = await login("version-delete-idempotency-query");
    const { childId } = await completeOnboarding(accessToken);
    const created = await createExpense(accessToken, childId, "삭제 쿼리 해시");
    const idempotencyKey = randomUUID();

    await request(app.getHttpServer())
      .delete(`/api/v1/expenses/${created.id}?expectedVersion=1`)
      .set("Authorization", `Bearer ${accessToken}`)
      .set("Idempotency-Key", idempotencyKey)
      .expect(200);

    await request(app.getHttpServer())
      .delete(`/api/v1/expenses/${created.id}?expectedVersion=2`)
      .set("Authorization", `Bearer ${accessToken}`)
      .set("Idempotency-Key", idempotencyKey)
      .expect(409)
      .expect(({ body }) => expect(body.error.code).toBe("IDEMPOTENCY_KEY_CONFLICT"));
  });

  it("rolls back both tombstone and version when a failure is injected after delete mutation but before commit", async () => {
    const accessToken = await login("version-atomic-delete");
    const { childId } = await completeOnboarding(accessToken);
    const created = await createExpense(accessToken, childId, "원자적 삭제");

    failAfterMutation = "delete";
    await request(app.getHttpServer())
      .delete(`/api/v1/expenses/${created.id}?expectedVersion=1`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(500);

    await request(app.getHttpServer())
      .get(`/api/v1/expenses/${created.id}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.id).toBe(created.id);
        expect(body.version).toBe(1);
        expect(body.deletedAt).toBeUndefined();
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
