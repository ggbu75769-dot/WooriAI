import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { randomUUID } from "node:crypto";
import ExcelJS from "exceljs";
import request from "supertest";
import { errorResponseSchema, importJobSchema, importRowSchema } from "@wooriai/contracts";
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

    // Real CSV content: two clearly-categorized high-confidence rows (기저귀 ->
    // diaper_hygiene, 분유 -> feeding_babyfood) and one uncategorized row whose
    // item text matches no known keyword, which real parsing scores below the
    // 0.7 confidence threshold (see import-parser.ts's computeConfidence).
    const csvContent =
      "날짜,적요,금액\n2026-07-06,기저귀 구매,32000\n2026-07-05,분유 구매,33000\n2026-07-04,알수없는 결제,9000\n";

    const job = (
      await request(app.getHttpServer())
        .post(`/api/v1/children/${childId}/imports/excel`)
        .set("Authorization", `Bearer ${accessToken}`)
        .field("fileName", "wooriai-import.csv")
        .attach("file", Buffer.from(csvContent, "utf8"), "wooriai-import.csv")
        .expect(200)
    ).body as ImportJob;

    // CON-121: 가져오기 잡 응답 계약 — status는 IMPORT_STATUSES 열거값이어야 한다.
    importJobSchema.parse(job);
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
        importJobSchema.parse(body);
        expect(body.status).toBe("preview_ready");
      });

    const rows = (
      await request(app.getHttpServer())
        .get(`/api/v1/imports/${job.id}/rows`)
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(200)
    ).body.rows as ImportRow[];

    // CON-121: 미리보기 행 각각이 importRowSchema를 만족해야 한다 — 저신뢰/중복후보
    // 행까지 포함해 confidence(0~1), selected, validationStatus 형태가 고정된다.
    for (const row of rows) {
      importRowSchema.parse(row);
    }

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

    // CON-121: 행 수정 응답도 같은 행 계약을 돌려준다.
    importRowSchema.parse(editedRow);
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

  // SEC-115 F2: fileName is stored verbatim into import_jobs.fileName, so an
  // unbounded value must be rejected with the standard validation envelope
  // instead of being persisted.
  it("rejects a fileName longer than 255 chars with 400 VALIDATION_ERROR", async () => {
    const accessToken = await login(app, "sec115-filename");
    const { childId } = await completeOnboarding(app, accessToken);
    const oversizedFileName = `${"a".repeat(256)}.csv`;

    const response = await request(app.getHttpServer())
      .post(`/api/v1/children/${childId}/imports/excel`)
      .set("Authorization", `Bearer ${accessToken}`)
      .field("fileName", oversizedFileName)
      .attach("file", Buffer.from("날짜,적요,금액\n2026-07-06,기저귀 구매,32000\n", "utf8"), "short.csv")
      .expect(400);

    errorResponseSchema.parse(response.body);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
    expect(response.body.error.details.fields).toEqual([
      expect.objectContaining({ field: "fileName" })
    ]);
  });

  // API-130: 형식 판정이 파일명 확장자에만 기대던 것을 (1) mimetype 1차 관문과
  // (2) 매직바이트 본검사로 나눠 잡는다. 둘 다 기존 400 IMPORT_FILE_TYPE_INVALID
  // 봉투를 그대로 쓴다 — 사용자에게는 "지원하지 않는 파일" 하나의 사실이다.
  describe("API-130 업로드 형식 판정", () => {
    const validCsv = "날짜,적요,금액\n2026-07-06,기저귀 구매,32000\n";

    async function upload(
      accessToken: string,
      childId: string,
      fileName: string,
      buffer: Buffer,
      attachOptions: string | { filename: string; contentType?: string }
    ) {
      return await request(app.getHttpServer())
        .post(`/api/v1/children/${childId}/imports/excel`)
        .set("Authorization", `Bearer ${accessToken}`)
        .field("fileName", fileName)
        .attach("file", buffer, attachOptions);
    }

    it("확장자만 .xlsx인 위장 파일(zip 시그니처 아님)을 400 IMPORT_FILE_TYPE_INVALID로 거절한다", async () => {
      const accessToken = await login(app, "api130-disguised");
      const { childId } = await completeOnboarding(app, accessToken);

      // mimetype은 진짜 xlsx처럼 보이지만(1차 관문 통과) 내용은 그냥 텍스트다.
      const response = await upload(
        accessToken,
        childId,
        "disguised.xlsx",
        Buffer.from(validCsv, "utf8"),
        "disguised.xlsx"
      );

      expect(response.status).toBe(400);
      errorResponseSchema.parse(response.body);
      expect(response.body.error.code).toBe("IMPORT_FILE_TYPE_INVALID");
    });

    it("확장자만 .csv인 바이너리(널바이트 포함)도 400 IMPORT_FILE_TYPE_INVALID로 거절한다", async () => {
      const accessToken = await login(app, "api130-binary-csv");
      const { childId } = await completeOnboarding(app, accessToken);

      const response = await upload(
        accessToken,
        childId,
        "renamed.csv",
        Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0x00, 0x00]),
        "renamed.csv"
      );

      expect(response.status).toBe(400);
      errorResponseSchema.parse(response.body);
      expect(response.body.error.code).toBe("IMPORT_FILE_TYPE_INVALID");
    });

    it("명백히 다른 mimetype(image/png)은 mimetype 관문에서 400으로 거른다", async () => {
      const accessToken = await login(app, "api130-mimetype");
      const { childId } = await completeOnboarding(app, accessToken);

      const response = await upload(accessToken, childId, "photo.csv", Buffer.from(validCsv, "utf8"), {
        filename: "photo.png",
        contentType: "image/png"
      });

      expect(response.status).toBe(400);
      errorResponseSchema.parse(response.body);
      expect(response.body.error.code).toBe("IMPORT_FILE_TYPE_INVALID");
    });

    it("정상 csv/xlsx는 그대로 통과한다 (mimetype이 octet-stream으로 와도 매직바이트로 판정)", async () => {
      const accessToken = await login(app, "api130-happy");
      const { childId } = await completeOnboarding(app, accessToken);

      // 모바일 앱(client.ts)은 mimeType을 모를 때 application/octet-stream을 보낸다.
      const csvJob = await upload(accessToken, childId, "plain.csv", Buffer.from(validCsv, "utf8"), {
        filename: "plain.csv",
        contentType: "application/octet-stream"
      });
      expect(csvJob.status).toBe(200);
      importJobSchema.parse(csvJob.body);
      expect(csvJob.body.rowCount).toBe(1);

      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet("Sheet1");
      sheet.addRow(["날짜", "적요", "금액"]);
      sheet.addRow(["2026-07-06", "기저귀 구매", 32000]);
      const xlsxBuffer = Buffer.from(await workbook.xlsx.writeBuffer());

      const xlsxJob = await upload(accessToken, childId, "real.xlsx", xlsxBuffer, "real.xlsx");
      expect(xlsxJob.status).toBe(200);
      importJobSchema.parse(xlsxJob.body);
      expect(xlsxJob.body.rowCount).toBe(1);
    });
  });
});
