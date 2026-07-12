import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { randomUUID } from "node:crypto";
import ExcelJS from "exceljs";
import iconv from "iconv-lite";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AppModule } from "../src/app.module";
import { configureApiApp } from "../src/bootstrap";
import { deployMigrations, isDatabaseAvailable } from "./helpers/test-db";

const dbAvailable = await isDatabaseAvailable();
const importStubCategoryId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

type ImportJob = { id: string; status: string; rowCount: number; candidateCount: number; importedCount: number };
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

/**
 * Covers real CSV/XLSX parsing end to end (see src/imports/import-parser.ts
 * and OnboardingStoreService.createImportJob): column detection from Korean
 * headers, amount/date normalization, CSV formula-injection sanitization,
 * duplicate-candidate detection against existing expenses, low-confidence
 * (uncategorized) rows staying unselected, and XLSX parsing via exceljs.
 * Every test uses a fresh randomized providerToken/child (see
 * concurrency.db.test.ts's isolation note) so this file is safe to run
 * alongside the rest of the suite against the same persistent database.
 */
describe.skipIf(!dbAvailable)("Import CSV/XLSX real parsing (real Postgres)", () => {
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
    return response.body.tokens.accessToken as string;
  }

  async function completeOnboarding(accessToken: string, nickname: string) {
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

    await request(app.getHttpServer())
      .post(`/api/v1/children/${childId}/prepared-items`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ itemTemplateIds: [] })
      .expect(200);

    await request(app.getHttpServer())
      .put(`/api/v1/children/${childId}/budget`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ yearMonth: "2026-07-01", amountKrw: 500000 })
      .expect(200);

    return { childId };
  }

  it("normalizes amounts/dates, sanitizes CSV formula injection, flags duplicates and low-confidence rows, and imports only the valid ones", async () => {
    const accessToken = await login("import-parsing-csv");
    const { childId } = await completeOnboarding(accessToken, "csv-파싱-아이");

    // Plant an existing expense so the CSV's 2026-07-03 / 15000 row is
    // detected as a duplicate candidate (same child, same date + amount).
    await request(app.getHttpServer())
      .post(`/api/v1/children/${childId}/expenses`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ categoryId: importStubCategoryId, amountKrw: 15000, spentOn: "2026-07-03", itemName: "기존 지출" })
      .expect(200);

    const csvContent =
      "날짜,적요,금액\n" +
      '2026-07-06,기저귀 대용량,"32,000원"\n' + // comma + 원 suffix must normalize to 32000
      "2026.07.05,분유 구매,33000\n" + // dot-separated date must normalize to 2026-07-05
      "2026-07-03,물티슈 재구매,15000\n" + // duplicate candidate (matches planted expense)
      "2026-07-02,알수없는결제,5000\n" + // no category keyword match -> low confidence
      "2026-07-01,=기저귀 자동주문,8000\n"; // formula-injection leading '=' must be neutralized

    const job = (
      await request(app.getHttpServer())
        .post(`/api/v1/children/${childId}/imports/excel`)
        .set("Authorization", `Bearer ${accessToken}`)
        .field("fileName", "parsing-test.csv")
        .attach("file", Buffer.from(csvContent, "utf8"), "parsing-test.csv")
        .expect(200)
    ).body as ImportJob;

    expect(job.rowCount).toBe(5);
    // candidateCount is a pure confidence>=0.7 count (see
    // OnboardingStoreService.createImportJob), independent of duplicate
    // flagging -- 4 of the 5 rows clear the confidence bar (only the
    // uncategorized "알수없는결제" row doesn't); the duplicate row is one of
    // those 4 but still won't be auto-selected (checked below).
    expect(job.candidateCount).toBe(4);

    const rows = (
      await request(app.getHttpServer())
        .get(`/api/v1/imports/${job.id}/rows`)
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(200)
    ).body.rows as ImportRow[];
    expect(rows).toHaveLength(5);

    const diaperRow = rows.find((row) => row.parsedItemName === "기저귀 대용량");
    expect(diaperRow).toMatchObject({
      parsedDate: "2026-07-06",
      parsedAmountKrw: 32000,
      selected: true,
      validationStatus: "valid"
    });

    const formulaRow = rows.find((row) => row.parsedAmountKrw === 8000);
    expect(formulaRow).toBeDefined();
    // The raw cell content ("=기저귀 자동주문") is neutralized: it must never be
    // persisted with a leading '=' (which spreadsheet software would treat as
    // a formula on export/open), but the rest of the text -- including the
    // category keyword -- is preserved.
    expect(formulaRow!.parsedItemName!.startsWith("=")).toBe(false);
    expect(formulaRow!.parsedItemName).toContain("기저귀 자동주문");
    expect(formulaRow!.validationStatus).toBe("valid");
    expect(formulaRow!.selected).toBe(true);

    const duplicateRow = rows.find((row) => row.parsedAmountKrw === 15000 && row.parsedDate === "2026-07-03");
    expect(duplicateRow).toMatchObject({ validationStatus: "duplicate_candidate", selected: false });

    const lowConfidenceRow = rows.find((row) => row.parsedItemName === "알수없는결제");
    expect(lowConfidenceRow).toMatchObject({ selected: false });
    expect(lowConfidenceRow!.confidence).toBeLessThan(0.7);
    expect(lowConfidenceRow!.validationStatus).toContain("low_confidence");

    // Confirm using the parser's own default selection (an empty
    // selectedRowIds falls back to each row's `selected` flag -- see
    // confirmImport's hasExplicitSelection): only the 3 genuinely-valid rows
    // should import.
    const confirmResponse = await request(app.getHttpServer())
      .post(`/api/v1/imports/${job.id}/confirm`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ selectedRowIds: [] })
      .expect(200);
    expect(confirmResponse.body).toEqual({ importedCount: 3, skippedCount: 0 });

    const expensesResponse = await request(app.getHttpServer())
      .get(`/api/v1/children/${childId}/expenses?yearMonth=2026-07`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);
    // 1 pre-existing (planted) expense + 3 imported = 4, totalling
    // 15000 + 32000 + 33000 + 8000 = 88000.
    expect(expensesResponse.body.expenses).toHaveLength(4);
    expect(expensesResponse.body.totalAmountKrw).toBe(88000);

    const homeResponse = await request(app.getHttpServer())
      .get(`/api/v1/home?childId=${childId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);
    expect(homeResponse.body.totalExpenseKrw).toBe(88000);
  });

  it("decodes a CP949-encoded CSV (no UTF-8 BOM) without garbling Korean text", async () => {
    const accessToken = await login("import-parsing-cp949");
    const { childId } = await completeOnboarding(accessToken, "cp949-아이");

    const csvContent = "날짜,적요,금액\n2026-07-06,병원 진료비,15000\n";
    const cp949Buffer = iconv.encode(csvContent, "cp949");

    const job = (
      await request(app.getHttpServer())
        .post(`/api/v1/children/${childId}/imports/excel`)
        .set("Authorization", `Bearer ${accessToken}`)
        .field("fileName", "cp949-test.csv")
        .attach("file", cp949Buffer, "cp949-test.csv")
        .expect(200)
    ).body as ImportJob;

    expect(job.rowCount).toBe(1);

    const rows = (
      await request(app.getHttpServer())
        .get(`/api/v1/imports/${job.id}/rows`)
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(200)
    ).body.rows as ImportRow[];

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      parsedDate: "2026-07-06",
      parsedItemName: "병원 진료비",
      parsedAmountKrw: 15000,
      validationStatus: "valid"
    });
  });

  it("parses an XLSX workbook (exceljs) with a Korean header row", async () => {
    const accessToken = await login("import-parsing-xlsx");
    const { childId } = await completeOnboarding(accessToken, "xlsx-아이");

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("거래내역");
    sheet.addRow(["날짜", "적요", "금액"]);
    sheet.addRow(["2026-07-06", "기저귀 세트", 20000]);
    sheet.addRow(["2026-07-05", "장난감 구매", 15000]);
    const xlsxBuffer = Buffer.from(await workbook.xlsx.writeBuffer());

    const job = (
      await request(app.getHttpServer())
        .post(`/api/v1/children/${childId}/imports/excel`)
        .set("Authorization", `Bearer ${accessToken}`)
        .field("fileName", "xlsx-test.xlsx")
        .attach("file", xlsxBuffer, "xlsx-test.xlsx")
        .expect(200)
    ).body as ImportJob;

    expect(job.rowCount).toBe(2);
    expect(job.candidateCount).toBe(2);

    const rows = (
      await request(app.getHttpServer())
        .get(`/api/v1/imports/${job.id}/rows`)
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(200)
    ).body.rows as ImportRow[];

    expect(rows).toHaveLength(2);
    const diaperRow = rows.find((row) => row.parsedItemName === "기저귀 세트");
    expect(diaperRow).toMatchObject({ parsedDate: "2026-07-06", parsedAmountKrw: 20000, validationStatus: "valid" });
    const toyRow = rows.find((row) => row.parsedItemName === "장난감 구매");
    expect(toyRow).toMatchObject({ parsedDate: "2026-07-05", parsedAmountKrw: 15000, validationStatus: "valid" });
  });
});
