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

type ImportJob = {
  id: string;
  // 라운드 41 K-2: 잡이 묶인 아이(검수 화면의 "대상 아이" 표시가 읽는 유일한 근거).
  childId: string;
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

  /**
   * 라운드 41 K-1: `duplicate_candidate`와 `low_confidence_duplicate_candidate`는 **검토 가능**
   * 상태다 -- 확정 불가 상태가 아니다.
   *
   * validationStatusForImportRow(import-pipeline.service.ts:430-431)가 두 판정을 모두
   * `!row.userReviewed` 조건 아래 두고, updateImportRow(189-192줄)는 어떤 PATCH에서도
   * `userReviewed: true`를 세운 뒤 상태를 다시 계산한다. 그래서 사람이 체크 한 번만 하면
   * 두 행 모두 valid가 되고 `selected: true`가 그대로 살아남는다.
   *
   * 검수 화면(app/import/[importJobId].tsx)이 이 두 상태를 잠가 버려서 가져올 방법 자체가
   * 사라진 회귀가 있었다. 화면 쪽 미러는 src/import/preview-rows.test.ts가 지키고, 이 테스트는
   * 그 미러가 흉내 내는 **서버 규칙 자체**를 고정한다.
   */
  it("lets the user clear duplicate/low-confidence rows by reviewing them: one PATCH makes them valid and keeps them selected", async () => {
    const accessToken = await login("import-parsing-review");
    const { childId } = await completeOnboarding(accessToken, "검토-아이");

    // 기존 지출 하나 -> CSV의 같은 날짜+금액 행이 중복 후보로 잡힌다.
    await request(app.getHttpServer())
      .post(`/api/v1/children/${childId}/expenses`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ categoryId: importStubCategoryId, amountKrw: 21000, spentOn: "2026-07-04", itemName: "기존 지출" })
      .expect(200);

    const csvContent =
      "날짜,적요,금액\n" +
      "2026-07-04,기저귀 재구매,21000\n" + // duplicate_candidate (기존 지출과 날짜+금액 일치)
      "2026-07-02,알수없는결제,7000\n"; // low_confidence_duplicate_candidate (키워드 매칭 없음)

    const job = (
      await request(app.getHttpServer())
        .post(`/api/v1/children/${childId}/imports/excel`)
        .set("Authorization", `Bearer ${accessToken}`)
        .field("fileName", "review-test.csv")
        .attach("file", Buffer.from(csvContent, "utf8"), "review-test.csv")
        .expect(200)
    ).body as ImportJob;
    expect(job.childId).toBe(childId);

    const rows = (
      await request(app.getHttpServer())
        .get(`/api/v1/imports/${job.id}/rows`)
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(200)
    ).body.rows as ImportRow[];

    const duplicateRow = rows.find((row) => row.validationStatus === "duplicate_candidate");
    const lowConfidenceRow = rows.find((row) => row.validationStatus === "low_confidence_duplicate_candidate");
    // 둘 다 처음에는 선택되지 않은 상태로 온다(사람의 확인을 기다린다).
    expect(duplicateRow).toMatchObject({ selected: false });
    expect(lowConfidenceRow).toMatchObject({ selected: false });

    // 화면이 보내는 것과 같은 최소 PATCH: `selected`만 담는다(서버가 나머지를 병합한다).
    for (const row of [duplicateRow!, lowConfidenceRow!]) {
      const reviewed = (
        await request(app.getHttpServer())
          .patch(`/api/v1/imports/${job.id}/rows/${row.id}`)
          .set("Authorization", `Bearer ${accessToken}`)
          .send({ selected: true })
          .expect(200)
      ).body as ImportRow;

      // 핵심 계약: 검토가 상태를 valid로 풀고, 체크가 false로 되돌려지지 않는다.
      expect(reviewed, row.validationStatus).toMatchObject({ id: row.id, validationStatus: "valid", selected: true });
    }

    // 그리고 그 두 행은 실제로 가져와진다 -- "가져올 방법이 없는 행"이 아니었다.
    await request(app.getHttpServer())
      .post(`/api/v1/imports/${job.id}/confirm`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ selectedRowIds: [duplicateRow!.id, lowConfidenceRow!.id] })
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual({ importedCount: 2, skippedCount: 0 });
      });

    const expensesResponse = await request(app.getHttpServer())
      .get(`/api/v1/children/${childId}/expenses?yearMonth=2026-07`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);
    // 기존 1건 + 검토를 마친 2건 = 3건.
    expect(expensesResponse.body.expenses).toHaveLength(3);
    expect(expensesResponse.body.totalAmountKrw).toBe(21000 + 21000 + 7000);
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
