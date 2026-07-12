import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AppModule } from "../src/app.module";
import { configureApiApp } from "../src/bootstrap";

const categoryId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

type ImportJob = {
  id: string;
  status: string;
  rowCount: number;
  candidateCount: number;
  importedCount: number;
};

type ImportRow = {
  id: string;
  rowIndex: number;
  parsedDate?: string;
  parsedItemName?: string;
  parsedAmountKrw?: number;
  categoryId?: string;
  confidence: number;
  selected: boolean;
  validationStatus: string;
};

// See admin-settings.e2e.test.ts's login() comment: a random suffix keeps dev-login
// isolated per test run against the persistent Postgres database.
async function login(app: INestApplication, providerToken: string) {
  const response = await request(app.getHttpServer())
    .post("/api/v1/auth/oauth-login")
    .send({ provider: "kakao", providerToken: `${providerToken}-${randomUUID()}` })
    .expect(200);

  return response.body.tokens.accessToken as string;
}

async function completeOnboarding(app: INestApplication, accessToken: string) {
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
      .send({
        householdId,
        nickname: "batch09-child",
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

  return { childId };
}

describe("Excel import beta API", () => {
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

  it("keeps preview rows out of expenses until the user confirms selected rows", async () => {
    const accessToken = await login(app, "batch09-import");
    const { childId } = await completeOnboarding(app, accessToken);

    await request(app.getHttpServer())
      .get(`/api/v1/children/${childId}/expenses?yearMonth=2026-07`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.expenses).toEqual([]);
        expect(body.totalAmountKrw).toBe(0);
      });

    const job = (
      await request(app.getHttpServer())
        .post(`/api/v1/children/${childId}/imports/excel`)
        .set("Authorization", `Bearer ${accessToken}`)
        .field("fileName", "wooriai-import.csv")
        .attach("file", Buffer.from("date,item,amount\n2026-07-06,diapers,32000\n"), "wooriai-import.csv")
        .expect(200)
    ).body as ImportJob;

    expect(job).toMatchObject({
      id: expect.any(String),
      status: "preview_ready",
      rowCount: 3,
      candidateCount: 2,
      importedCount: 0
    });

    await request(app.getHttpServer())
      .get(`/api/v1/imports/${job.id}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.status).toBe("preview_ready");
      });

    const rows = (
      await request(app.getHttpServer())
        .get(`/api/v1/imports/${job.id}/rows`)
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(200)
    ).body.rows as ImportRow[];

    expect(rows).toHaveLength(3);
    expect(rows.filter((row) => row.selected)).toHaveLength(2);
    expect(rows.some((row) => row.confidence < 0.7 && !row.selected)).toBe(true);
    expect(rows.some((row) => row.validationStatus.includes("duplicate_candidate"))).toBe(true);

    await request(app.getHttpServer())
      .get(`/api/v1/children/${childId}/expenses?yearMonth=2026-07`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.expenses).toEqual([]);
        expect(body.totalAmountKrw).toBe(0);
      });

    const lowConfidenceRow = rows.find((row) => row.confidence < 0.7);
    expect(lowConfidenceRow).toBeDefined();

    const editedRow = (
      await request(app.getHttpServer())
        .patch(`/api/v1/imports/${job.id}/rows/${lowConfidenceRow!.id}`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({
          selected: true,
          parsedItemName: "Imported wipes",
          parsedAmountKrw: 12000,
          categoryId
        })
        .expect(200)
    ).body as ImportRow;

    expect(editedRow).toMatchObject({
      selected: true,
      parsedItemName: "Imported wipes",
      parsedAmountKrw: 12000,
      validationStatus: "valid"
    });

    const selectedRowIds = rows.filter((row) => row.selected).map((row) => row.id).concat(editedRow.id);

    await request(app.getHttpServer())
      .post(`/api/v1/imports/${job.id}/confirm`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ selectedRowIds })
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual({ importedCount: 3, skippedCount: 0 });
      });

    await request(app.getHttpServer())
      .get(`/api/v1/children/${childId}/expenses?yearMonth=2026-07`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.expenses).toHaveLength(3);
        expect(body.totalAmountKrw).toBe(77000);
        expect(body.expenses.every((expense: { source: string }) => expense.source === "excel_import")).toBe(true);
      });

    await request(app.getHttpServer())
      .get(`/api/v1/children/${childId}/reports/monthly?yearMonth=2026-07`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.totalExpenseKrw).toBe(77000);
      });
  });
});
