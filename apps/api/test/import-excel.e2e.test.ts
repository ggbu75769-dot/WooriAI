import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { randomUUID } from "node:crypto";
import ExcelJS from "exceljs";
import request from "supertest";
import { errorResponseSchema, importJobSchema, importRowSchema, MONEY_KRW_MAX } from "@wooriai/contracts";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AppModule } from "../src/app.module";
import { configureApiApp } from "../src/bootstrap";

const categoryId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

type ImportJob = {
  id: string;
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
      // 라운드 41 K-2: 잡이 묶인 아이를 응답이 직접 말한다. 검수 화면의 "대상 아이" 표시가
      // 클라이언트의 선택 아이 값을 추측하지 않도록 하는 유일한 근거라 계약으로 고정한다.
      childId,
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
        // 조회 응답도 같은 childId를 돌려준다(딥링크로 검수 화면에 바로 들어오는 경로).
        expect(body.childId).toBe(childId);
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

  /**
   * GAP-054 라운드 54 P1-1 — int4 상한을 넘는 금액 행은 **그 행만** 거절된다.
   *
   * 무슨 일이 있었나: `isMoneyKrw`에 상한이 없어서 `validationStatusForImportRow`가
   * 2,147,483,647을 넘는 행도 `valid`로 판정했고, 기본 선택까지 된 그 행이 확정
   * 트랜잭션의 insert에서 DB를 터뜨렸다. 확정은 한 트랜잭션이라 **파일 전체가 롤백**된다 —
   * 멀쩡한 다른 행까지 하나도 들어가지 않고, 사용자는 어느 행이 문제인지 알 방법이 없었다.
   *
   * 고친 뒤의 계약: 초과 행은 `invalid_amount`(기존 검증 상태 관례 그대로)이고 선택되지
   * 않으며, 같은 파일의 나머지 행은 평소대로 확정된다.
   */
  it("GAP-054 P1-1: int4 상한을 넘는 금액 행만 invalid_amount로 떨구고 나머지 행은 살린다", async () => {
    const accessToken = await login(app, "gap054-import-amount-max");
    const { childId } = await completeOnboarding(app, accessToken);

    // 두 번째 행이 상한(2,147,483,647) + 1이다 — 나머지 두 행은 평범한 지출이다.
    const csvContent = [
      "날짜,적요,금액",
      "2026-07-06,기저귀 구매,32000",
      `2026-07-05,상한 초과 결제,${MONEY_KRW_MAX + 1}`,
      "2026-07-04,분유 구매,33000",
      ""
    ].join("\n");

    const job = (
      await request(app.getHttpServer())
        .post(`/api/v1/children/${childId}/imports/excel`)
        .set("Authorization", `Bearer ${accessToken}`)
        .field("fileName", "over-limit.csv")
        .attach("file", Buffer.from(csvContent, "utf8"), "over-limit.csv")
        .expect(200)
    ).body as ImportJob;

    const rows = (
      await request(app.getHttpServer())
        .get(`/api/v1/imports/${job.id}/rows`)
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(200)
    ).body.rows as ImportRow[];

    expect(rows).toHaveLength(3);
    const overLimitRow = rows.find((row) => row.parsedItemName === "상한 초과 결제");
    expect(overLimitRow, "상한 초과 행을 찾지 못했다").toBeDefined();
    expect(overLimitRow!.validationStatus).toBe("invalid_amount");
    // 검증에 걸린 행은 기본 선택되지 않는다(선택돼 있으면 확정이 그 행을 집어삼킨다).
    expect(overLimitRow!.selected).toBe(false);
    // int4 컬럼에 담을 수 없는 값이라 금액 칸은 비어 있다 — 잘라서 그럴듯한 숫자를 만들지 않는다.
    expect(overLimitRow!.parsedAmountKrw).toBeUndefined();
    // 금액 오류는 그 한 행뿐이다 — 나머지 두 행은 멀쩡히 살아 있다.
    expect(rows.filter((row) => row.validationStatus === "invalid_amount")).toHaveLength(1);

    // 검수 화면에서 그 행의 금액을 다시 상한 위로 고쳐도 DB가 아니라 검증이 막는다(400).
    await request(app.getHttpServer())
      .patch(`/api/v1/imports/${job.id}/rows/${overLimitRow!.id}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ parsedAmountKrw: MONEY_KRW_MAX + 1 })
      .expect(400)
      .expect(({ body }) => {
        errorResponseSchema.parse(body);
        expect(body.error.code).toBe("EXPENSE_AMOUNT_TOO_LARGE");
      });

    // 확정: 초과 행을 명시적으로 선택해도 그 행만 건너뛰고 나머지는 들어간다(전체 롤백 없음).
    await request(app.getHttpServer())
      .post(`/api/v1/imports/${job.id}/confirm`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ selectedRowIds: rows.map((row) => row.id) })
      .expect(200)
      .expect(({ body }) => {
        expect(body.importedCount).toBe(2);
        expect(body.skippedCount).toBe(1);
      });

    await request(app.getHttpServer())
      .get(`/api/v1/children/${childId}/expenses?yearMonth=2026-07`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.expenses).toHaveLength(2);
        expect(body.totalAmountKrw).toBe(65_000);
      });
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
