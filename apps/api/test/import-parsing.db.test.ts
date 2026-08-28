import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import ExcelJS from "exceljs";
import iconv from "iconv-lite";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AppModule } from "../src/app.module";
import { configureApiApp } from "../src/bootstrap";
import { deployMigrations, isDatabaseAvailable } from "./helpers/test-db";

const dbAvailable = await isDatabaseAvailable();

/**
 * 라운드 65 A(#1) — 모바일 내보내기의 헤더 상수를 **소스에서 그대로** 읽는다. 문자열을 여기에
 * 다시 적으면 두 벌이 되고, 그 순간 이 왕복 테스트는 "우리가 정말 내보내는 파일"이 아니라
 * "우리가 내보낸다고 믿는 파일"을 검사하게 된다. 파서 단위의 같은 계약은
 * test/mobile-export-csv-roundtrip.test.ts에 있고, 이 파일은 그 위에 **확정까지**를 얹는다.
 */
function exportedCsvHeader(): string {
  const path = join(
    fileURLToPath(new URL("..", import.meta.url)),
    "..",
    "..",
    "apps",
    "mobile",
    "src",
    "export",
    "expense-csv.ts"
  );
  const match = /export const EXPENSE_CSV_HEADER = "([^"]+)";/.exec(readFileSync(path, "utf8"));
  expect(match, `EXPENSE_CSV_HEADER literal not found in ${path}`).not.toBeNull();
  return match![1];
}
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

  /**
   * 라운드 65 A(#1) — **우리가 내보낸 CSV를 그대로 다시 올린다.**
   *
   * 실패 시나리오는 이랬다: 기기를 바꾸려고 [내보내기]로 받은 파일을 그대로 올리면 파싱은
   * 성공하고 미리보기도 열리는데, `항목`(품목명 열)이 서버 키워드에 없어 **모든 행의 품목명이
   * 비고** 전 행이 `missing_item_name`으로 잠겼다. 확정 버튼이 가져가는 행은 0건이고, 화면은
   * "원본 파일에서 고친 뒤 다시 올려 주세요"라고 말하는데 그 원본이 이 앱이 만든 파일이었다.
   *
   * 그래서 이 테스트는 파싱이 아니라 **확정 결과**를 본다 -- 지출이 실제로 생겨야 통과한다.
   */
  it("라운드 65 A: 앱이 내보낸 형태의 CSV가 그대로 다시 들어와 확정까지 된다 (0건 잠금 회귀 금지)", async () => {
    const accessToken = await login("import-parsing-roundtrip");
    const { childId } = await completeOnboarding(accessToken, "왕복-아이");

    const header = exportedCsvHeader();
    expect(header.split(",")).toContain("항목");

    // 내보내기가 실제로 쓰는 열 순서·값 모양 그대로(날짜,구분,카테고리,항목,판매처,결제수단,
    // 금액(원),메모,출처). 금액은 포맷하지 않은 정수, 레코드는 CRLF, 앞에 UTF-8 BOM.
    const csvContent =
      `﻿${header}\r\n` +
      "2026-07-06,지출,기저귀/위생,기저귀 대용량,쿠팡,카드,32000,정기배송,직접 입력\r\n" +
      "2026-07-05,선물,장난감/도서,장난감 기차,,카드,20000,,직접 입력\r\n" +
      "2026-07-04,지출,수유/이유식,분유 2단계,이마트,,45900,,엑셀 가져오기\r\n";

    const job = (
      await request(app.getHttpServer())
        .post(`/api/v1/children/${childId}/imports/excel`)
        .set("Authorization", `Bearer ${accessToken}`)
        .field("fileName", "wooriai-export.csv")
        .attach("file", Buffer.from(csvContent, "utf8"), "wooriai-export.csv")
        .expect(200)
    ).body as ImportJob;

    expect(job.rowCount).toBe(3);
    expect(job.candidateCount).toBe(3);

    const rows = (
      await request(app.getHttpServer())
        .get(`/api/v1/imports/${job.id}/rows`)
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(200)
    ).body.rows as ImportRow[];

    expect(rows).toHaveLength(3);
    // 품목명은 `항목` 열에서 온다 -- `카테고리` 열(왼쪽 이웃)이 그 자리를 가로채면 안 된다.
    expect(rows.map((row) => row.parsedItemName)).toEqual(["기저귀 대용량", "장난감 기차", "분유 2단계"]);
    expect(rows.map((row) => row.parsedDate)).toEqual(["2026-07-06", "2026-07-05", "2026-07-04"]);
    expect(rows.map((row) => row.parsedAmountKrw)).toEqual([32000, 20000, 45900]);
    // 잠긴 행이 하나도 없다 = 확정 버튼이 3건을 가져간다(종전에는 0건이었다).
    expect(rows.every((row) => row.validationStatus === "valid")).toBe(true);
    expect(rows.every((row) => row.selected)).toBe(true);

    await request(app.getHttpServer())
      .post(`/api/v1/imports/${job.id}/confirm`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ selectedRowIds: [] })
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual({ importedCount: 3, skippedCount: 0 });
      });

    const expenses = (
      await request(app.getHttpServer())
        .get(`/api/v1/children/${childId}/expenses?yearMonth=2026-07`)
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(200)
    ).body as { expenses: Array<{ expenseType: string; itemName: string }>; totalAmountKrw: number };

    expect(expenses.expenses).toHaveLength(3);
    expect(expenses.totalAmountKrw).toBe(97900);

    /**
     * **알려진 한계(의도적)**: `구분` 열은 파서의 ParsedImportRow에 자리가 없어 왕복하지 않는다.
     * "선물"이라고 적혀 있던 행도 일반 지출로 들어오므로, DNC-015가 합계에서 빼 두는 그 구분이
     * 재가져오기에서 사라진다 -- 그래서 위 합계 97,900원에 20,000원이 포함된다. 되살리려면
     * `import_rows` 스키마와 확정 경로(insertExpense) 변경이 함께 필요해 DNC-012·DNC-015 판단이
     * 선행이다(라운드 65 A의 범위 밖). 그 사실을 값으로 남겨 다음 라운드가 다시 발견하지 않게 한다.
     */
    expect(expenses.expenses.every((expense) => expense.expenseType === "expense")).toBe(true);
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
