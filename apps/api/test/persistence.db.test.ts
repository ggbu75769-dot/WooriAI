import { randomUUID } from "node:crypto";
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { PrismaClient } from "@prisma/client";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AppModule } from "../src/app.module";
import { configureApiApp } from "../src/bootstrap";
import { deployMigrations, isDatabaseAvailable } from "./helpers/test-db";

const dbAvailable = await isDatabaseAvailable();

const defaultImportCategoryId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

async function bootApp(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication();
  configureApiApp(app);
  await app.init();
  return app;
}

async function login(app: INestApplication, providerToken: string) {
  const response = await request(app.getHttpServer())
    .post("/api/v1/auth/oauth-login")
    .send({ provider: "kakao", providerToken })
    .expect(200);
  return response.body.tokens.accessToken as string;
}

async function completeOnboarding(app: INestApplication, accessToken: string, nickname: string) {
  const householdId = (
    await request(app.getHttpServer()).get("/api/v1/me").set("Authorization", `Bearer ${accessToken}`).expect(200)
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
      .send({ householdId, nickname, stageMode: "manual", manualStage: "infant_4_6" })
      .expect(200)
  ).body.id as string;

  return { householdId, childId };
}

describe.skipIf(!dbAvailable)("Round 4 persistence (real Postgres)", () => {
  beforeAll(() => {
    deployMigrations();
    process.env.JWT_ACCESS_SECRET = "test-access-secret";
    process.env.JWT_REFRESH_SECRET = "test-refresh-secret";
    process.env.WOORIAI_STAGE_TODAY = "2026-07-06";
  });

  afterAll(() => {
    delete process.env.WOORIAI_STAGE_TODAY;
  });

  it("keeps expense data visible from a brand-new Nest app instance against the same database (process-restart simulation)", async () => {
    const firstApp = await bootApp();
    let accessToken: string;
    let childId: string;
    let expenseId: string;

    try {
      accessToken = await login(firstApp, `persistence-restart-${randomUUID()}`);
      ({ childId } = await completeOnboarding(firstApp, accessToken, "재시작 테스트"));

      const created = await request(firstApp.getHttpServer())
        .post(`/api/v1/children/${childId}/expenses`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({
          categoryId: defaultImportCategoryId,
          amountKrw: 45000,
          spentOn: "2026-07-06",
          itemName: "재시작 후에도 남아있어야 하는 지출",
          paymentMethod: "card"
        })
        .expect(200);
      expenseId = created.body.id as string;
    } finally {
      // Simulates the API process restarting: the first Nest app instance (and
      // whatever in-process state it held) is fully torn down before the second
      // instance is created below. Only data actually persisted to Postgres can
      // survive this.
      await firstApp.close();
    }

    const secondApp = await bootApp();
    try {
      // Reusing the same JWT across app instances is intentional and valid: the
      // token is a stateless bearer credential (HMAC-signed with an env-var
      // secret), and the guard re-derives the user's live status/households from
      // the database on every request (see HouseholdRuntimeService.enrichUser) —
      // nothing about auth depends on which app instance issued the token.
      const expenseResponse = await request(secondApp.getHttpServer())
        .get(`/api/v1/expenses/${expenseId}`)
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(200);
      expect(expenseResponse.body).toMatchObject({
        id: expenseId,
        childId,
        amountKrw: 45000,
        itemName: "재시작 후에도 남아있어야 하는 지출"
      });

      const listResponse = await request(secondApp.getHttpServer())
        .get(`/api/v1/children/${childId}/expenses?yearMonth=2026-07`)
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(200);
      expect(listResponse.body.expenses).toEqual(
        expect.arrayContaining([expect.objectContaining({ id: expenseId })])
      );
    } finally {
      await secondApp.close();
    }
  });

  it("rolls back every expense from a confirmImport call when one selected row turns out to be unimportable", async () => {
    const app = await bootApp();
    const prisma = new PrismaClient();

    try {
      const accessToken = await login(app, `persistence-import-rollback-${randomUUID()}`);
      const { childId } = await completeOnboarding(app, accessToken, "롤백 테스트");

      const job = (
        await request(app.getHttpServer())
          .post(`/api/v1/children/${childId}/imports/excel`)
          .set("Authorization", `Bearer ${accessToken}`)
          .field("fileName", "rollback-test.csv")
          .attach("file", Buffer.from("date,item,amount\n2026-07-06,rollback,1000\n"), "rollback-test.csv")
          .expect(200)
      ).body as { id: string };

      const rows = await prisma.importRow.findMany({ where: { importJobId: job.id }, orderBy: { rowIndex: "asc" } });
      expect(rows.length).toBeGreaterThanOrEqual(2);

      // Row 0 is a normal, genuinely-valid stub row (real seeded categoryId) that
      // confirmImport would otherwise import successfully on its own. Row 1 is
      // force-selected with a categoryId that references nothing in `categories` —
      // simulating a corrupted/legacy row (e.g. from data migrated before the
      // categories table existed) that passes row-level validation (which only
      // checks a categoryId is present, not that it resolves) but fails
      // insertExpense's real existence check (requireExistingCategory) at
      // expense-creation time, inside the confirmImport transaction.
      //
      // import_rows.category_id normally has a real FK to categories(id), which
      // would reject writing a dangling reference outright — so the corrupted row
      // is constructed by briefly disabling that FK trigger for this one write,
      // the same way a one-off manual data-repair script touching legacy rows
      // would have to.
      const importableRow = rows[0];
      const brokenRow = rows[1];
      const danglingCategoryId = randomUUID();
      await prisma.$transaction([
        prisma.$executeRawUnsafe("ALTER TABLE import_rows DISABLE TRIGGER ALL"),
        prisma.$executeRawUnsafe(
          `UPDATE import_rows SET selected = true, category_id = '${danglingCategoryId}', validation_status = 'valid' WHERE id = '${brokenRow.id}'`
        ),
        prisma.$executeRawUnsafe("ALTER TABLE import_rows ENABLE TRIGGER ALL")
      ]);

      await request(app.getHttpServer())
        .post(`/api/v1/imports/${job.id}/confirm`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ selectedRowIds: [importableRow.id, brokenRow.id] })
        .expect(400);

      // Neither row's expense should exist: the transaction wrapping confirmImport
      // must have rolled back the otherwise-successful insert for importableRow
      // once brokenRow's categoryId failed the existence check.
      const expenseCount = await prisma.expense.count({ where: { childId } });
      expect(expenseCount).toBe(0);

      const jobAfter = await prisma.importJob.findUniqueOrThrow({ where: { id: job.id } });
      expect(jobAfter.status).toBe("preview_ready");
      expect(jobAfter.importedCount).toBe(0);
    } finally {
      await prisma.$disconnect();
      await app.close();
    }
  });

  it("blocks a user from a different household from accessing another household's child (403)", async () => {
    const app = await bootApp();

    try {
      const ownerToken = await login(app, `persistence-cross-household-owner-${randomUUID()}`);
      const { childId } = await completeOnboarding(app, ownerToken, "다른 가구 아이");

      const outsiderToken = await login(app, `persistence-cross-household-outsider-${randomUUID()}`);
      // The outsider never joins the owner's household (no invite accepted), so
      // they have no membership row granting access to childId at all.

      await request(app.getHttpServer())
        .get(`/api/v1/children/${childId}`)
        .set("Authorization", `Bearer ${outsiderToken}`)
        .expect(403)
        .expect(({ body }) => {
          expect(body.error.code).toBe("FORBIDDEN");
        });

      await request(app.getHttpServer())
        .get(`/api/v1/children/${childId}/expenses`)
        .set("Authorization", `Bearer ${outsiderToken}`)
        .expect(403);
    } finally {
      await app.close();
    }
  });
});
