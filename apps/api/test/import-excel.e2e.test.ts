import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { randomUUID } from "node:crypto";
import ExcelJS from "exceljs";
import request from "supertest";
import { errorResponseSchema, importJobSchema, importRowSchema, MONEY_KRW_MAX } from "@wooriai/contracts";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AppModule } from "../src/app.module";
import { configureApiApp } from "../src/bootstrap";
import { PrismaService } from "../src/prisma/prisma.service";

const categoryId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

/**
 * 라운드 66 적대 리뷰(S-4) — **미래 날짜 행은 오늘에서 파생한다.**
 *
 * 두 시나리오는 "미래 날짜라 확정에서 빠지는 행"으로 건수를 가른다(선택된 행 수가 아니라 실제로
 * 들어간 행 수를 세고 있음을 드러내는 장치다). 그 행의 날짜가 `2027-01-05`로 박혀 있었는데,
 * 미래 판정은 **서울 오늘** 기준이라(packages/domain의 `isFutureExpenseDate`) 그날이 오면 그 행이
 * 갑자기 유효해지고 두 단언(`{ importedCount: 1, skippedCount: 1 }` · `{ 2, 1 }`)이 동시에 깨진다.
 * 시한폭탄이라 실패 시점의 사람은 원인을 이 파일에서 찾지 못한다.
 *
 * 그래서 실행 시각 + 180일로 만든다 — 시간대 차이(±1일)로도 뒤집히지 않을 만큼 멀고,
 * 그 자체가 "미래"라는 사실 말고 다른 무엇도 뜻하지 않는다.
 */
function futureRowDate(): string {
  return new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/**
 * 라운드 68 A — **하한보다 오래된 행**도 같은 이유로 오늘에서 파생한다.
 *
 * 하한은 "240개월 전 달의 1일"이라 해가 갈수록 앞으로 움직인다(packages/domain의
 * `getEntryDateFloor`). `1970-01-01` 같은 값을 박아 두면 지금은 통과하지만 그 자체로는
 * 경계를 지켜 주지 못하고, 반대로 하한 근처를 박으면 언젠가 조용히 유효해진다. 21년 전이면
 * 시간대 차이로도 뒤집히지 않을 만큼 하한 아래이고, 그 자체가 "20년보다 오래됐다"는 사실
 * 말고 다른 무엇도 뜻하지 않는다(위 `futureRowDate`와 같은 규율).
 */
function tooOldRowDate(): string {
  const today = new Date();
  return new Date(Date.UTC(today.getUTCFullYear() - 21, today.getUTCMonth(), 15)).toISOString().slice(0, 10);
}

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
   * 라운드 68 A — **20년보다 오래된 날짜 행**도 그 행만 거절된다.
   *
   * 무슨 일이 있었나: 행 판정이 보던 날짜 규칙은 미래 하나뿐이었다
   * (`validationStatusForImportRow` → `assertExpenseDateWithinRange`). 그래서 엑셀 날짜 열이 시리얼 값으로
   * 오해돼 연도 1000대의 날짜가 만들어져도 그 행은 `valid`로 미리보기를 통과하고 기본 선택까지
   * 됐다 — 사용자가 친 오타가 아닌데도, 확정되고 나면 그 지출은 누적 총액에는 들어가면서
   * 어느 읽기 화면에서도 그 달을 열 수 없는 자리에 놓인다.
   *
   * 고친 뒤의 계약: 그 행은 `invalid_date`(기존 검증 상태 관례 그대로 — 새 상태를 만들지
   * 않는다)이고 **선택되지 않으며**(DNC-012: 승인 전에는 저장하지 않는다), 같은 파일의 나머지
   * 행은 평소대로 확정된다. 서버 가드 한 자리(store-shared의 `assertExpenseDateWithinPastFloor`)를
   * 지나므로 지출 생성·수정과 **같은 경계**다.
   */
  it("라운드 68 A: 20년보다 오래된 날짜 행만 invalid_date로 떨구고 나머지 행은 살린다", async () => {
    const accessToken = await login(app, "r68-import-date-floor");
    const { childId } = await completeOnboarding(app, accessToken);
    const tooOld = tooOldRowDate();

    const csvContent = [
      "날짜,적요,금액",
      "2026-07-06,기저귀 구매,32000",
      `${tooOld},시리얼 오해된 행,41000`,
      "2026-07-04,분유 구매,33000",
      ""
    ].join("\n");

    const job = (
      await request(app.getHttpServer())
        .post(`/api/v1/children/${childId}/imports/excel`)
        .set("Authorization", `Bearer ${accessToken}`)
        .field("fileName", "too-old.csv")
        .attach("file", Buffer.from(csvContent, "utf8"), "too-old.csv")
        .expect(200)
    ).body as ImportJob;

    const rows = (
      await request(app.getHttpServer())
        .get(`/api/v1/imports/${job.id}/rows`)
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(200)
    ).body.rows as ImportRow[];

    expect(rows).toHaveLength(3);
    const tooOldRow = rows.find((row) => row.parsedItemName === "시리얼 오해된 행");
    expect(tooOldRow, "하한보다 오래된 행을 찾지 못했다").toBeDefined();
    expect(tooOldRow!.validationStatus).toBe("invalid_date");
    // 사유를 달고 선택에서 빠진다 — 선택돼 있으면 확정이 그 행을 집어삼킨다.
    expect(tooOldRow!.selected).toBe(false);
    // 날짜 오류는 그 한 행뿐이다.
    expect(rows.filter((row) => row.validationStatus === "invalid_date")).toHaveLength(1);
    expect(rows.filter((row) => row.selected)).toHaveLength(2);

    // 사용자가 그 행을 직접 골라 확정에 실어도 서버가 다시 판정하므로 들어가지 않는다.
    await request(app.getHttpServer())
      .post(`/api/v1/imports/${job.id}/confirm`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ selectedRowIds: rows.map((row) => row.id) })
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual({ importedCount: 2, skippedCount: 1 });
      });
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

  /**
   * 라운드 57 QA(P2-13) + GAP-058 #8 — 상한을 넘는 품목명 행은 **그 행만** 떨어진다.
   *
   * 무슨 일이 있었나(57): `import_rows.parsed_item_name`은 varchar(120)인데 가져오기는 사용자가
   * 만든 파일을 그대로 읽는다. 121자 이상인 셀이 한 줄이라도 있으면 미리보기 행 insert가 DB에서
   * 터지고, 그 insert는 잡 생성 트랜잭션 안이라 **업로드 전체가 500**으로 끝났다 — 검증 상태를
   * 붙일 기회도 없이 파일이 통째로 거절된다. 금액(int4)에서 GAP-054 P1-1이 고친 것과 같은
   * 형태의 결함이다.
   *
   * 남아 있던 비대칭(58 #8): 57은 컬럼 폭(120)만 봤다. 확정은 DTO를 지나지 않으므로(
   * `confirmImport` -> `insertExpense`) 101~120자 품목명은 **그대로 지출이 됐고**, 그렇게 생긴
   * 지출은 지출 상세에서 저장하는 순간 `UpdateExpenseDto.itemName`의 `@MaxLength(100)`에 걸려
   * 400이 됐다 — 앱이 만들어 놓고 앱이 고칠 수 없는 기록. 이제 강등 임계는 계약값 100이고,
   * 121자 이상과 같은 상태(`item_name_too_long`)·같은 미선택으로 떨어진다.
   *
   * 고친 뒤의 계약(금액과 같은 판단): **자르지 않는다.** 잘라 담으면 사용자가 적은 값이 조용히
   * 짧아지고 원본을 되찾을 길이 없다(허위 절단 금지). 121자 이상은 담을 칸이 없어 값을 비우고,
   * 101~120자는 원문을 그대로 둔 채 상태만 떨군다.
   */
  it("GAP-058 #8: 품목명 100자 초과 행을 계약과 같은 임계로 떨구고 파일 전체를 500으로 만들지 않는다", async () => {
    const accessToken = await login(app, "r58-import-item-name-len");
    const { childId } = await completeOnboarding(app, accessToken);

    // 카테고리 키워드("기저귀")를 앞에 두어 길이 말고는 전부 평범한 행이 되게 한다 --
    // 이 테스트가 보는 것은 분류 신뢰도가 아니라 **길이** 하나다.
    const overColumnName = `기저귀 ${"가".repeat(117)}`; // 121자 (컬럼 폭 초과 — 담을 수 없다)
    const overContractName = `기저귀 ${"나".repeat(106)}`; // 110자 (담을 수는 있으나 계약 초과)
    const boundaryName = `기저귀 ${"다".repeat(96)}`; // 정확히 100자 (계약 경계 — 통과)
    const csvContent = [
      "날짜,적요,금액",
      "2026-07-06,기저귀 구매,32000",
      `2026-07-05,${overColumnName},41000`,
      `2026-07-04,${overContractName},33000`,
      `2026-07-03,${boundaryName},21000`,
      ""
    ].join("\n");

    // 예전에는 이 줄이 500이었다 -- 200이라는 사실 자체가 57 항목의 회귀 방지선이다.
    const job = (
      await request(app.getHttpServer())
        .post(`/api/v1/children/${childId}/imports/excel`)
        .set("Authorization", `Bearer ${accessToken}`)
        .field("fileName", "long-item-name.csv")
        .attach("file", Buffer.from(csvContent, "utf8"), "long-item-name.csv")
        .expect(200)
    ).body as ImportJob;

    const rows = (
      await request(app.getHttpServer())
        .get(`/api/v1/imports/${job.id}/rows`)
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(200)
    ).body.rows as ImportRow[];

    expect(rows).toHaveLength(4);
    // 길이 오류는 **두 행뿐**이다(121자 · 110자) -- 나머지 두 행은 평소대로 살아 있다.
    const tooLongRows = rows.filter((row) => row.validationStatus === "item_name_too_long");
    expect(tooLongRows).toHaveLength(2);
    for (const row of tooLongRows) {
      expect(row.selected, "상한을 넘은 행은 기본 선택에서 빠진다").toBe(false);
    }

    // 121자: **잘라서** 그럴듯한 이름을 만들지 않는다 -- 담을 수 없으면 비운다(금액과 같은 규칙).
    const overColumnRow = tooLongRows.find((row) => row.parsedItemName === undefined);
    expect(overColumnRow, "121자 행이 사라졌다").toBeDefined();

    // 110자: 담을 수 있는 값은 비우지 않는다 -- 원문을 그대로 두고 상태만 떨군다.
    const overContractRow = tooLongRows.find((row) => row.parsedItemName === overContractName);
    expect(overContractRow, "110자 행의 품목명이 사라지거나 잘렸다").toBeDefined();
    expect(overContractRow!.parsedItemName).toHaveLength(110);
    expect(overContractRow!.validationStatus).toBe("item_name_too_long");
    expect(overContractRow!.selected).toBe(false);

    // 100자 경계는 통과한다(계약과 같은 자를 쓴다는 증거).
    const boundaryRow = rows.find((row) => row.parsedItemName === boundaryName);
    expect(boundaryRow, "100자 행이 잘렸거나 사라졌다").toBeDefined();
    expect(boundaryRow!.parsedItemName).toHaveLength(100);
    expect(boundaryRow!.validationStatus).toBe("valid");
    // 짧은 평범한 행도 그대로다.
    expect(rows.some((row) => row.parsedItemName === "기저귀 구매")).toBe(true);

    // 검수 화면에서 이름을 고치면 그 행도 살아난다(앱 안의 탈출구가 실제로 동작한다).
    await request(app.getHttpServer())
      .patch(`/api/v1/imports/${job.id}/rows/${overContractRow!.id}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ parsedItemName: "정기 결제" })
      .expect(200)
      .expect(({ body }) => {
        expect(body.parsedItemName).toBe("정기 결제");
        expect(body.validationStatus).toBe("valid");
      });

    // 확정: 고치지 않은 121자 행까지 통째로 선택해도 나머지 행은 평소대로 들어간다(전체 롤백 없음).
    await request(app.getHttpServer())
      .post(`/api/v1/imports/${job.id}/confirm`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ selectedRowIds: rows.map((row) => row.id) })
      .expect(200)
      .expect(({ body }) => {
        expect(body.importedCount).toBe(3);
        expect(body.skippedCount).toBe(1);
      });

    // #8의 본론: 확정으로 **생긴 지출**이 지출 계약과 어긋나지 않는다.
    const expenses = (
      await request(app.getHttpServer())
        .get(`/api/v1/children/${childId}/expenses?yearMonth=2026-07`)
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(200)
    ).body.expenses as { id: string; itemName: string }[];

    expect(expenses).toHaveLength(3);
    for (const expense of expenses) {
      expect(expense.itemName.length, `가져오기가 계약(100자)을 넘는 지출을 만들었다: ${expense.itemName}`)
        .toBeLessThanOrEqual(100);
    }

    // 가장 긴(100자 경계) 지출을 상세에서 그대로 저장해도 400이 아니다 -- 예전에는 110자짜리가
    // 여기서 400 VALIDATION_FAILED로 막혀 "고칠 수 없는 기록"이 됐다.
    const longest = expenses.reduce((max, expense) => (expense.itemName.length > max.itemName.length ? expense : max));
    expect(longest.itemName).toBe(boundaryName);
    await request(app.getHttpServer())
      .patch(`/api/v1/expenses/${longest.id}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ itemName: longest.itemName, amountKrw: 22_000 })
      .expect(200)
      .expect(({ body }) => {
        expect(body.itemName).toBe(boundaryName);
        expect(body.amountKrw).toBe(22_000);
      });
  });

  /**
   * 라운드 58 통합리뷰 P2-4 — **배포 전에 만들어진 잡**의 110자 행이 검수 화면에서 정직하게 보인다.
   *
   * 무슨 일이 남아 있었나: 상태를 묻는 자리가 셋인데(미리보기 생성 · 검수 PATCH · 확정) 읽기
   * 경로만 저장된 문자열을 그대로 돌려줬다. 그래서 GAP-058 #8 배포 **이전에** 만들어진 잡의
   * 101~120자 행은 검수 화면에 `valid`로, 체크된 채로 서 있다가 확정에서만 조용히 빠졌다 —
   * 화면이 보여 준 것과 실제 동작이 다른 자리다.
   *
   * 재현 방법: 지금 파이프라인은 그런 행을 만들지 않으므로, 만들어진 행을 DB에서 **옛 상태로
   * 되돌려** 배포 전 잡을 흉내 낸다(그 시절의 저장 모양 그대로 — valid + 기본 선택).
   */
  it("라운드 58 P2-4: 배포 전 저장된 valid 상태를 읽기 경로가 다시 판정해 검수 화면이 사실을 말한다", async () => {
    const accessToken = await login(app, "r58-import-stale-status");
    const { childId } = await completeOnboarding(app, accessToken);

    const overContractName = `기저귀 ${"나".repeat(106)}`; // 110자 (컬럼에는 담기나 계약 초과)
    const csvContent = [
      "날짜,적요,금액",
      "2026-07-06,기저귀 구매,32000",
      `2026-07-05,${overContractName},33000`,
      ""
    ].join("\n");

    const job = (
      await request(app.getHttpServer())
        .post(`/api/v1/children/${childId}/imports/excel`)
        .set("Authorization", `Bearer ${accessToken}`)
        .field("fileName", "stale-status.csv")
        .attach("file", Buffer.from(csvContent, "utf8"), "stale-status.csv")
        .expect(200)
    ).body as ImportJob;

    // 배포 전 잡 흉내: 그 시절 파이프라인은 이 행을 valid로 판정하고 기본 선택까지 했다.
    const prisma = app.get(PrismaService);
    const staleRow = await prisma.importRow.findFirstOrThrow({
      where: { importJobId: job.id, parsedItemName: overContractName }
    });
    await prisma.importRow.update({
      where: { id: staleRow.id },
      data: { validationStatus: "valid", selected: true }
    });

    const rows = (
      await request(app.getHttpServer())
        .get(`/api/v1/imports/${job.id}/rows`)
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(200)
    ).body.rows as ImportRow[];

    const reviewedRow = rows.find((row) => row.id === staleRow.id);
    expect(reviewedRow, "110자 행이 목록에서 사라졌다").toBeDefined();
    // 읽기 경로가 확정과 **같은 자**로 다시 판정한다 -- 저장된 "valid"를 그대로 되풀이하지 않는다.
    expect(reviewedRow!.validationStatus).toBe("item_name_too_long");
    // 원문은 그대로다(자르지 않는다 — 사용자가 검수 화면에서 고칠 값이다).
    expect(reviewedRow!.parsedItemName).toBe(overContractName);
    // 같은 파일의 짧은 행은 아무 영향을 받지 않는다.
    const shortRow = rows.find((row) => row.parsedItemName === "기저귀 구매");
    expect(shortRow!.validationStatus).toBe("valid");

    // 화면이 말한 대로 동작한다: 그 행을 명시적으로 선택해도 확정에서 빠진다(전체 롤백도 없다).
    await request(app.getHttpServer())
      .post(`/api/v1/imports/${job.id}/confirm`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ selectedRowIds: rows.map((row) => row.id) })
      .expect(200)
      .expect(({ body }) => {
        expect(body.importedCount).toBe(1);
        expect(body.skippedCount).toBe(1);
      });
  });

  /**
   * 라운드 60 리뷰(P2-3) — 아이당 검수 중인 잡은 하나까지.
   *
   * `preview_ready` 잡을 끝내는 경로가 없어서, 같은 아이에게 가져오기를 여러 번 시도하고
   * 검수를 마치지 않으면 승인한 적 없는 금융 내역 사본(import_rows)이 그 횟수만큼 쌓였다 —
   * 파기 잡의 phase 9는 `preview_ready`를 일부러 건드리지 않기 때문이다. 새 미리보기를 만드는
   * 순간 같은 아이의 이전 미리보기는 끝난 것으로 본다(`cancelled`).
   */
  it("라운드 60 리뷰(P2-3): 새 가져오기가 같은 아이의 이전 미확정 미리보기를 취소한다 (상한 1)", async () => {
    const accessToken = await login(app, "import-preview-cap");
    const { childId } = await completeOnboarding(app, accessToken);
    const prisma = app.get(PrismaService);
    const csv = "날짜,적요,금액\n2026-07-06,기저귀 구매,32000\n";

    const upload = async () =>
      (
        await request(app.getHttpServer())
          .post(`/api/v1/children/${childId}/imports/excel`)
          .set("Authorization", `Bearer ${accessToken}`)
          .field("fileName", "wooriai-import.csv")
          .attach("file", Buffer.from(csv, "utf8"), "wooriai-import.csv")
          .expect(200)
      ).body as ImportJob;

    const first = await upload();
    const second = await upload();
    const third = await upload();

    // 검수 중인 잡은 언제나 **가장 최근 하나**다.
    const previewReady = await prisma.importJob.findMany({
      where: { childId, status: "preview_ready" },
      select: { id: true }
    });
    expect(previewReady.map((job) => job.id)).toEqual([third.id]);

    // 이전 잡들은 파기가 아니라 상태 전이다 — 잡도 행도 그대로 남아 CS 조회에 답할 수 있고,
    // 이제 phase 9의 90일 창(IMPORT_ROWS_PURGEABLE_JOB_STATUSES)에 들어온다.
    for (const previous of [first, second]) {
      const job = await prisma.importJob.findUnique({ where: { id: previous.id } });
      expect(job?.status).toBe("cancelled");
      expect(await prisma.importRow.count({ where: { importJobId: previous.id } })).toBe(1);
    }

    // DNC-012: 취소는 확정이 아니다 — 지출은 단 한 건도 만들어지지 않는다.
    await request(app.getHttpServer())
      .get(`/api/v1/children/${childId}/expenses?yearMonth=2026-07`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.expenses).toEqual([]);
      });

    // 취소된 잡은 더 이상 확정할 수 없다(같은 봉투로 거절된다).
    await request(app.getHttpServer())
      .post(`/api/v1/imports/${first.id}/confirm`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ selectedRowIds: [] })
      .expect(400)
      .expect(({ body }) => {
        errorResponseSchema.parse(body);
        expect(body.error.code).toBe("IMPORT_NOT_CONFIRMABLE");
      });

    // 다른 아이의 미리보기는 건드리지 않는다.
    const otherToken = await login(app, "import-preview-cap-other");
    const other = await completeOnboarding(app, otherToken);
    const otherJob = (
      await request(app.getHttpServer())
        .post(`/api/v1/children/${other.childId}/imports/excel`)
        .set("Authorization", `Bearer ${otherToken}`)
        .field("fileName", "wooriai-import.csv")
        .attach("file", Buffer.from(csv, "utf8"), "wooriai-import.csv")
        .expect(200)
    ).body as ImportJob;
    await upload();
    expect((await prisma.importJob.findUnique({ where: { id: otherJob.id } }))?.status).toBe("preview_ready");
  });

  /**
   * GAP-064 #9: 승인(확정)의 순간이 서버에 남는다 — `import_jobs.approved_at` + `import.confirm`
   * 감사 로그. DNC-012의 핵심 사건이 종전에는 무기록이었다(approved_at은 읽기·쓰기 0인 죽은
   * 컬럼이었고 가져오기 컨트롤러에는 감사 로그가 한 건도 없었다).
   *
   * 함께 고정하는 계약 셋:
   *  1. HTTP 응답 모양은 **한 글자도 바뀌지 않는다**(`{ importedCount, skippedCount }`) —
   *     감사 봉투는 컨트롤러가 벗겨 내고 밖으로 나가지 않는다.
   *  2. 봉투에 **파일명이 없다** — 파일명은 파기 잡 phase 11이 90일 뒤 마스킹하는 값이라
   *     730일 보존되는 감사 로그에 복사하면 그 마스킹이 무의미해진다(GAP-063 #6).
   *  3. 확정되지 않은 요청(400)은 **아무것도 남기지 않는다** — approved_at도 감사 로그도.
   */
  it("GAP-064 #9: 확정이 approved_at과 import.confirm 감사 로그를 남기고, 봉투에 파일명이 없다", async () => {
    const accessToken = await login(app, "import-approval-audit");
    const { childId } = await completeOnboarding(app, accessToken);
    const prisma = app.get(PrismaService);

    const me = (
      await request(app.getHttpServer())
        .get("/api/v1/me")
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(200)
    ).body as { user: { id: string }; households: { id: string }[] };

    // 2행 중 1행만 유효(둘째 행은 미래 날짜라 확정에서 빠진다) — before/after의 건수가
    // 서로 다른 값이어야 "몇 건이 들어가고 몇 건이 빠졌나"를 실제로 검증할 수 있다.
    const fileName = "카드내역-2026년7월-홍길동.csv";
    const csv = `날짜,적요,금액\n2026-07-06,기저귀 구매,32000\n${futureRowDate()},분유 구매,33000\n`;
    const job = (
      await request(app.getHttpServer())
        .post(`/api/v1/children/${childId}/imports/excel`)
        .set("Authorization", `Bearer ${accessToken}`)
        .field("fileName", fileName)
        .attach("file", Buffer.from(csv, "utf8"), fileName)
        .expect(200)
    ).body as ImportJob;

    const rows = (
      await request(app.getHttpServer())
        .get(`/api/v1/imports/${job.id}/rows`)
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(200)
    ).body.rows as ImportRow[];
    expect(rows).toHaveLength(2);

    // 확정 전에는 승인 시각이 없다(NULL = "아직 승인된 적 없다").
    expect((await prisma.importJob.findUniqueOrThrow({ where: { id: job.id } })).approvedAt).toBeNull();

    const beforeConfirm = Date.now();
    await request(app.getHttpServer())
      .post(`/api/v1/imports/${job.id}/confirm`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ selectedRowIds: rows.map((row) => row.id) })
      .expect(200)
      // 응답 계약 무변경 — 감사 봉투는 응답으로 나가지 않는다.
      .expect(({ body }) => {
        expect(body).toEqual({ importedCount: 1, skippedCount: 1 });
      });

    const confirmed = await prisma.importJob.findUniqueOrThrow({ where: { id: job.id } });
    expect(confirmed.status).toBe("confirmed");
    // status=confirmed면 approved_at이 있다(확정 CAS가 같은 statement로 적는다).
    expect(confirmed.approvedAt).toBeInstanceOf(Date);
    expect(confirmed.approvedAt!.getTime()).toBeGreaterThanOrEqual(beforeConfirm - 1000);
    expect(confirmed.approvedAt!.getTime()).toBeLessThanOrEqual(Date.now() + 1000);

    const entries = await prisma.auditLog.findMany({
      where: { action: "import.confirm", targetId: job.id },
      orderBy: { createdAt: "asc" }
    });
    expect(entries).toHaveLength(1);
    const entry = entries[0];
    expect(entry.actorUserId).toBe(me.user.id);
    expect(entry.householdId).toBe(me.households[0].id);
    expect(entry.targetType).toBe("import_job");
    // before는 확정 직전의 잡 그대로다(같은 값이 미리보기 응답에도 있었다).
    expect(job.rowCount).toBe(2);
    expect(entry.beforeJson).toEqual({
      status: "preview_ready",
      rowCount: job.rowCount,
      candidateCount: job.candidateCount
    });
    expect(entry.afterJson).toEqual({
      status: "confirmed",
      importedCount: 1,
      skippedCount: 1,
      approvedAt: confirmed.approvedAt!.toISOString()
    });

    // 파일명(과 그 조각)은 봉투 어디에도 없다 — phase 11이 마스킹하는 값이다.
    const envelope = JSON.stringify([entry.beforeJson, entry.afterJson]);
    expect(envelope).not.toContain("홍길동");
    expect(envelope).not.toContain(".csv");
    expect(envelope).not.toContain("카드내역");

    // 확정되지 않는 재시도(같은 잡은 두 번 확정할 수 없다)는 아무 기록도 더하지 않는다.
    await request(app.getHttpServer())
      .post(`/api/v1/imports/${job.id}/confirm`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ selectedRowIds: rows.map((row) => row.id) })
      .expect(400)
      .expect(({ body }) => {
        errorResponseSchema.parse(body);
        expect(body.error.code).toBe("IMPORT_NOT_CONFIRMABLE");
      });
    expect(await prisma.auditLog.count({ where: { action: "import.confirm", targetId: job.id } })).toBe(1);
    // 승인 시각도 그대로다(두 번째 요청은 CAS를 통과하지 못한다).
    expect(
      (await prisma.importJob.findUniqueOrThrow({ where: { id: job.id } })).approvedAt?.toISOString()
    ).toBe(confirmed.approvedAt!.toISOString());
  });

  /**
   * GAP-066 #5: 확정이 만든 지출이 **어느 가져오기에서** 왔는지 남는다
   * (`expenses.import_job_id` — 컬럼·FK는 000001부터 있었고 채우는 곳만 없었다).
   *
   * 값 계약은 하나다: **확정 뒤 그 잡 id로 조회한 지출 수 = `importedCount`.**
   * 이 테스트가 필요한 이유는 "쓰지 않는다"는 사실을 깨뜨리는 단언이 있을 수 없기
   * 때문이다(빈 값도 유효한 값이라 어떤 기존 테스트도 실패하지 않았다 — 그래서 이
   * 컬럼이 스무 라운드 넘게 비어 있었다).
   *
   * 함께 고정하는 것 셋:
   *  1. **두 파일이 구별된다** — 같은 아이에 두 번 가져와도 각 잡 id가 자기 행만 센다
   *     (이 후보의 실패 시나리오가 바로 "지난달 파일 행과 오늘 파일 행이 구별되지 않는다").
   *  2. **다른 생성 경로는 종전과 같은 행을 만든다** — 수동 기록의 `importJobId`는 NULL이다
   *     (`insertExpense`의 기본값 `?? null`).
   *  3. **응답 DTO에 노출되지 않는다** — 되돌리기 설계와 함께 정할 일이라 이번에는 서버가
   *     사실을 기록만 한다(`toExpenseDto`에 이 키가 없다).
   */
  it("GAP-066 #5: 확정이 expenses.import_job_id를 채우고, 그 잡 id의 지출 수가 importedCount와 같다", async () => {
    const accessToken = await login(app, "import-job-origin");
    const { childId } = await completeOnboarding(app, accessToken);
    const prisma = app.get(PrismaService);

    // 가져오기와 무관한 수동 기록 — 확정이 남의 행에 출처를 칠하지 않는지 대조군이다.
    const manualExpenseId = (
      await request(app.getHttpServer())
        .post(`/api/v1/children/${childId}/expenses`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ categoryId, amountKrw: 15000, spentOn: "2026-07-02", itemName: "손으로 적은 기저귀" })
        .expect(200)
    ).body.id as string;
    expect((await prisma.expense.findUniqueOrThrow({ where: { id: manualExpenseId } })).importJobId).toBeNull();

    async function uploadAndConfirm(fileName: string, csv: string) {
      const uploaded = (
        await request(app.getHttpServer())
          .post(`/api/v1/children/${childId}/imports/excel`)
          .set("Authorization", `Bearer ${accessToken}`)
          .field("fileName", fileName)
          .attach("file", Buffer.from(csv, "utf8"), fileName)
          .expect(200)
      ).body as ImportJob;

      const uploadedRows = (
        await request(app.getHttpServer())
          .get(`/api/v1/imports/${uploaded.id}/rows`)
          .set("Authorization", `Bearer ${accessToken}`)
          .expect(200)
      ).body.rows as ImportRow[];

      // 확정 전에는 이 잡에서 온 지출이 0건이다(DNC-012 — 승인 전에는 expenses에 넣지 않는다).
      expect(await prisma.expense.count({ where: { importJobId: uploaded.id } })).toBe(0);

      const confirmResponse = (
        await request(app.getHttpServer())
          .post(`/api/v1/imports/${uploaded.id}/confirm`)
          .set("Authorization", `Bearer ${accessToken}`)
          .send({ selectedRowIds: uploadedRows.map((row) => row.id) })
          .expect(200)
      ).body as { importedCount: number; skippedCount: number };

      return { job: uploaded, confirmResponse };
    }

    // 첫 파일: 유효 2행 + 미래 날짜 1행(확정에서 빠진다 — 건수가 행 수와 달라야
    // "선택된 행 수"가 아니라 **들어간 행 수**를 세고 있음이 드러난다).
    const july = await uploadAndConfirm(
      "카드내역-7월-1차.csv",
      `날짜,적요,금액\n2026-07-06,기저귀 구매,32000\n2026-07-05,물티슈 구매,12000\n${futureRowDate()},분유 구매,33000\n`
    );
    expect(july.confirmResponse).toEqual({ importedCount: 2, skippedCount: 1 });

    // 둘째 파일: 유효 1행(같은 아이·같은 달에 두 번째로 올리는 파일 — 실패 시나리오 그대로).
    const august = await uploadAndConfirm("카드내역-7월-2차.csv", "날짜,적요,금액\n2026-07-04,젖병 구매,21000\n");
    expect(august.confirmResponse).toEqual({ importedCount: 1, skippedCount: 0 });

    for (const { job: confirmedJob, confirmResponse } of [july, august]) {
      // 값 계약: 그 잡 id의 지출 수 = importedCount(= 잡 행이 기록한 건수).
      expect(await prisma.expense.count({ where: { importJobId: confirmedJob.id } })).toBe(
        confirmResponse.importedCount
      );
      expect(
        (await prisma.importJob.findUniqueOrThrow({ where: { id: confirmedJob.id } })).importedCount
      ).toBe(confirmResponse.importedCount);
    }

    // 두 파일은 서로 섞이지 않는다 — 같은 아이·같은 달의 지출이지만 출처가 다르다.
    const importedExpenses = await prisma.expense.findMany({
      where: { childId, source: "excel_import" },
      select: { id: true, importJobId: true }
    });
    expect(importedExpenses).toHaveLength(3);
    expect(new Set(importedExpenses.map((expense) => expense.importJobId))).toEqual(
      new Set([july.job.id, august.job.id])
    );

    // 수동 기록은 종전 그대로다 — 확정은 자기가 만든 행에만 출처를 남긴다.
    expect((await prisma.expense.findUniqueOrThrow({ where: { id: manualExpenseId } })).importJobId).toBeNull();

    // 응답 DTO는 이 값을 모른다(노출은 되돌리기 설계와 함께 정한다).
    await request(app.getHttpServer())
      .get(`/api/v1/children/${childId}/expenses?yearMonth=2026-07`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.expenses).toHaveLength(4);
        for (const expense of body.expenses as Record<string, unknown>[]) {
          expect(expense).not.toHaveProperty("importJobId");
        }
      });
  });

  /**
   * GAP-067 #3: 확정한 가져오기를 **한 번에 되돌린다**(`POST /imports/:id/undo`).
   *
   * 라운드 66이 지출에 출처를 남기기 시작한 뒤에도 사용자가 그것을 되돌릴 길은 0건이었다 —
   * 앱의 수단은 한 건씩 롱프레스 삭제뿐이었다(200번). 이 테스트가 고정하는 값 계약 넷:
   *  1. **그 잡의 행만** 사라진다(같은 아이의 수동 기록·다른 파일의 행은 그대로다). 라운드 67
   *     적대 리뷰(#4): **확정 뒤에 고친 행도** 사라진다 — 앱의 확인 Alert가 그렇게 약속한다.
   *  2. **soft delete**다(DNC-014) — 행은 남고 `deleted_at`·`deleted_by_user_id`가 찍히며
   *     `version`이 **행마다 한 칸씩** 오른다(오프라인 아웃박스가 들고 있던 expectedVersion이
   *     통과해 되살아나지 않도록 — 고쳐서 이미 2인 행은 3이 된다). 그래서 델타 동기화가 그
   *     행들을 **삭제 툼스톤**으로 실어 나른다.
   *  3. **감사 로그는 묶음 1행**(`import.undo`) — 건수·잡 id를 싣고 파일명은 싣지 않는다.
   *  4. **멱등** — 두 번째 호출은 0건이고 잡 상태·건수는 그대로다(되돌리기의 되돌리기가 없다).
   */
  it("GAP-067 #3: 확정한 가져오기를 되돌리면 그 잡의 지출만 soft delete되고 감사 로그 1행이 남는다", async () => {
    const accessToken = await login(app, "import-undo");
    const { childId } = await completeOnboarding(app, accessToken);
    const prisma = app.get(PrismaService);

    const me = (
      await request(app.getHttpServer())
        .get("/api/v1/me")
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(200)
    ).body as { user: { id: string }; households: { id: string }[] };

    // 대조군 둘: 수동 기록 1건 + **다른 파일**에서 온 1건. 되돌리기가 "그 파일에서 온 행"만
    // 고른다는 사실은 이 둘이 살아남아야 드러난다.
    const manualExpenseId = (
      await request(app.getHttpServer())
        .post(`/api/v1/children/${childId}/expenses`)
        .set("Authorization", `Bearer ${accessToken}`)
        .send({ categoryId, amountKrw: 15000, spentOn: "2026-07-02", itemName: "손으로 적은 기저귀" })
        .expect(200)
    ).body.id as string;

    async function uploadAndConfirm(fileName: string, csv: string) {
      const job = (
        await request(app.getHttpServer())
          .post(`/api/v1/children/${childId}/imports/excel`)
          .set("Authorization", `Bearer ${accessToken}`)
          .field("fileName", fileName)
          .attach("file", Buffer.from(csv, "utf8"), fileName)
          .expect(200)
      ).body as ImportJob;
      const rows = (
        await request(app.getHttpServer())
          .get(`/api/v1/imports/${job.id}/rows`)
          .set("Authorization", `Bearer ${accessToken}`)
          .expect(200)
      ).body.rows as ImportRow[];
      const confirmed = (
        await request(app.getHttpServer())
          .post(`/api/v1/imports/${job.id}/confirm`)
          .set("Authorization", `Bearer ${accessToken}`)
          .send({ selectedRowIds: rows.map((row) => row.id) })
          .expect(200)
      ).body as { importedCount: number; skippedCount: number };
      return { job, confirmed };
    }

    const other = await uploadAndConfirm("카드내역-다른파일.csv", "날짜,적요,금액\n2026-07-01,젖병 구매,21000\n");
    expect(other.confirmed.importedCount).toBe(1);

    // 되돌릴 파일: 유효 2행 + 미래 날짜 1행(확정에서 빠진다 — 되돌린 건수가 **들어간 건수**와
    // 같고 파일의 행 수와는 다르다는 사실이 드러난다).
    const undoTargetFileName = "카드내역-되돌릴파일-홍길동.csv";
    const target = await uploadAndConfirm(
      undoTargetFileName,
      `날짜,적요,금액\n2026-07-06,기저귀 구매,32000\n2026-07-05,물티슈 구매,12000\n${futureRowDate()},분유 구매,33000\n`
    );
    expect(target.confirmed).toEqual({ importedCount: 2, skippedCount: 1 });

    const listJuly = async () =>
      (
        await request(app.getHttpServer())
          .get(`/api/v1/children/${childId}/expenses?yearMonth=2026-07`)
          .set("Authorization", `Bearer ${accessToken}`)
          .expect(200)
      ).body.expenses as Array<{ id: string }>;
    // 수동 1 + 다른 파일 1 + 되돌릴 파일 2.
    expect(await listJuly()).toHaveLength(4);

    const importedBefore = await prisma.expense.findMany({
      where: { importJobId: target.job.id },
      orderBy: { spentOn: "asc" }
    });
    expect(importedBefore).toHaveLength(2);
    for (const expense of importedBefore) {
      expect(expense.deletedAt).toBeNull();
      expect(expense.version).toBe(1);
    }

    /**
     * 라운드 67 적대 리뷰(#4) — **확정 뒤에 고친 행도 되돌리기의 대상이다.**
     *
     * 앱의 확인 Alert가 그 사실을 문장으로 약속한다("가져온 뒤에 고친 기록도 함께 사라져요" —
     * apps/mobile/src/import/import-resume.ts). 그런데 서버 쪽에서 그 약속을 붙들고 있는 것은
     * 아무것도 없었다: 이 시나리오의 두 행은 확정 뒤 손대지 않은 version 1짜리였고, 되돌리기의
     * 선택 조건이 언젠가 "확정 이후 바뀌지 않은 행"으로 좁아져도(낙관적 잠금을 잘못 옮겨 오는
     * 흔한 변경이다) 테스트는 초록이었다. 그래서 **한 행을 실제로 고쳐 놓고**(version 1→2)
     * 되돌린다 — 그 행도 함께 사라져야 하고, 버전은 개별 삭제와 같은 모양으로 **한 칸 더**
     * 올라야 한다(오프라인 아웃박스가 들고 있던 expectedVersion이 되살리지 못하게).
     */
    const editedExpenseId = importedBefore[0].id;
    const untouchedExpenseId = importedBefore[1].id;
    await request(app.getHttpServer())
      .patch(`/api/v1/expenses/${editedExpenseId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ amountKrw: 40000, memo: "확정 뒤에 금액을 고쳤다" })
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({ id: editedExpenseId, amountKrw: 40000, version: 2 });
      });

    const beforeUndo = Date.now();
    await request(app.getHttpServer())
      .post(`/api/v1/imports/${target.job.id}/undo`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200)
      // 응답은 건수 하나다 — 감사 봉투는 컨트롤러가 벗겨 낸다.
      .expect(({ body }) => {
        expect(body).toEqual({ deletedCount: 2 });
      });

    // 1. 목록에서 사라진다(그리고 대조군 둘은 그대로다).
    const remaining = await listJuly();
    expect(remaining).toHaveLength(2);
    expect(remaining.map((expense) => expense.id)).toContain(manualExpenseId);
    expect(await prisma.expense.count({ where: { importJobId: other.job.id, deletedAt: null } })).toBe(1);

    // 2. soft delete다 — 행은 남고, 출처도 남고(어느 파일에서 왔는지는 지운 뒤에도 사실이다),
    //    지운 사람과 버전이 개별 삭제와 같은 모양으로 찍힌다.
    const importedAfter = await prisma.expense.findMany({ where: { importJobId: target.job.id } });
    expect(importedAfter).toHaveLength(2);
    // 고친 행의 버전은 2에서 3으로, 손대지 않은 행은 1에서 2로 — 되돌리기가 **행마다 한 칸씩**
    // 올린다(고쳐서 버전이 앞선 행을 건너뛰지도, 버전을 2로 되감지도 않는다).
    const expectedVersionById = new Map([
      [editedExpenseId, 3],
      [untouchedExpenseId, 2]
    ]);
    for (const expense of importedAfter) {
      expect(expense.deletedAt).toBeInstanceOf(Date);
      expect(expense.deletedAt!.getTime()).toBeGreaterThanOrEqual(beforeUndo - 1000);
      expect(expense.deletedByUserId).toBe(me.user.id);
      expect(expense.version, expense.id).toBe(expectedVersionById.get(expense.id));
    }
    // 같은 순간에 지워진다(묶음 하나라 시각이 하나여야 CS가 "이 되돌리기"를 셀 수 있다).
    expect(new Set(importedAfter.map((expense) => expense.deletedAt!.toISOString())).size).toBe(1);

    // 델타 동기화가 그 행들을 **삭제 툼스톤**으로 실어 나른다(오프라인 클라이언트도 수렴한다).
    const changes = (
      await request(app.getHttpServer())
        .get("/api/v1/sync/changes?limit=200")
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(200)
    ).body.changes as Array<{ type: string; op: string; id?: string; version?: number }>;
    for (const expense of importedAfter) {
      expect(changes).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ type: "expense", op: "delete", id: expense.id, version: expense.version })
        ])
      );
    }

    // 3. 감사 로그는 묶음 1행이고, 봉투에 파일명이 없다.
    const undoEntries = await prisma.auditLog.findMany({
      where: { action: "import.undo", targetId: target.job.id },
      orderBy: { createdAt: "asc" }
    });
    expect(undoEntries).toHaveLength(1);
    expect(undoEntries[0].actorUserId).toBe(me.user.id);
    expect(undoEntries[0].householdId).toBe(me.households[0].id);
    expect(undoEntries[0].targetType).toBe("import_job");
    expect(undoEntries[0].beforeJson).toEqual({ status: "confirmed", importedCount: 2 });
    expect(undoEntries[0].afterJson).toMatchObject({ status: "confirmed", deletedCount: 2 });
    const envelope = JSON.stringify([undoEntries[0].beforeJson, undoEntries[0].afterJson]);
    expect(envelope).not.toContain("홍길동");
    expect(envelope).not.toContain(".csv");
    expect(envelope).not.toContain("카드내역");
    // 확정 로그는 그대로 남는다 — 한 잡의 이력이 두 줄로 순서까지 읽힌다.
    expect(await prisma.auditLog.count({ where: { action: "import.confirm", targetId: target.job.id } })).toBe(1);

    // 4. 멱등: 두 번째는 0건이고, 이미 지워진 행의 삭제 시각·버전은 덮이지 않는다.
    const firstDeletedAt = importedAfter[0].deletedAt!.toISOString();
    await request(app.getHttpServer())
      .post(`/api/v1/imports/${target.job.id}/undo`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual({ deletedCount: 0 });
      });
    const afterSecond = await prisma.expense.findMany({ where: { importJobId: target.job.id } });
    for (const expense of afterSecond) {
      expect(expense.version, expense.id).toBe(expectedVersionById.get(expense.id));
    }
    expect(afterSecond.map((expense) => expense.deletedAt!.toISOString())).toContain(firstDeletedAt);

    // 잡 자신은 그대로다 — "이 파일이 승인됐다"는 사실은 되돌린 뒤에도 참이고, 상태를 되돌리면
    // 확정 CAS가 다시 열려 같은 파일을 두 번 확정할 수 있게 된다.
    const jobAfter = await prisma.importJob.findUniqueOrThrow({ where: { id: target.job.id } });
    expect(jobAfter.status).toBe("confirmed");
    expect(jobAfter.importedCount).toBe(2);
  });

  /**
   * 라운드 67 적대 리뷰(#4) — **되돌리기의 권한 게이트.**
   *
   * 앱은 확인 Alert **앞에서** 보기 전용 역할을 막는다(app/import/index.tsx의 `expenseGate`) —
   * 그 게이트가 있는 이유가 "서버도 403이다"였는데, 정작 그 사실을 붙들고 있는 테스트가 없었다.
   * 되돌리기는 지출 200건을 한 번에 지우는 경로라, 권한이 조용히 넓어지면(예: `edit` 플래그를
   * 빠뜨린 리팩터링) 보기 전용 참여자가 남의 가계부를 비울 수 있게 된다.
   *
   * 두 갈래를 함께 본다.
   *  - **같은 가구의 뷰어** → 403 FORBIDDEN(잡은 보이지만 쓰기가 아니다).
   *  - **남의 가구 사람** → 같은 403 FORBIDDEN이다. `requireImportJobAccess`가 잡을 먼저 찾고
   *    그다음 `requireChildAccess`가 판정하므로, **없는 잡의 404와 남의 잡의 403이 갈린다**
   *    (저장소 전체가 지키는 순서다 — 위 테스트가 404 쪽을 이미 붙들고 있다). 여기서 굳이
   *    404로 뭉개지 않는 이유는 그 순서를 바꾸는 것이 이 라운드의 변경이 아니기 때문이고,
   *    갈린다는 사실 자체를 테스트가 적어 두면 다음 사람이 판단할 근거가 남는다.
   *  - 그리고 **소유자는 여전히 200**이다 — 게이트가 역할을 막은 것이지 경로를 막은 것이 아니다.
   */
  it("라운드 67 적대 리뷰 #4: 되돌리기는 편집 권한을 요구한다 (뷰어·남의 가구 거절, 소유자만 통과)", async () => {
    const ownerToken = await login(app, "import-undo-rbac-owner");
    const { childId } = await completeOnboarding(app, ownerToken);
    const householdId = (
      await request(app.getHttpServer())
        .get("/api/v1/me")
        .set("Authorization", `Bearer ${ownerToken}`)
        .expect(200)
    ).body.households[0].id as string;

    const fileName = "권한게이트.csv";
    const job = (
      await request(app.getHttpServer())
        .post(`/api/v1/children/${childId}/imports/excel`)
        .set("Authorization", `Bearer ${ownerToken}`)
        .field("fileName", fileName)
        .attach("file", Buffer.from("날짜,적요,금액\n2026-07-06,기저귀 구매,32000\n", "utf8"), fileName)
        .expect(200)
    ).body as ImportJob;
    const rows = (
      await request(app.getHttpServer())
        .get(`/api/v1/imports/${job.id}/rows`)
        .set("Authorization", `Bearer ${ownerToken}`)
        .expect(200)
    ).body.rows as ImportRow[];
    await request(app.getHttpServer())
      .post(`/api/v1/imports/${job.id}/confirm`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ selectedRowIds: rows.map((row) => row.id) })
      .expect(200)
      .expect(({ body }) => {
        expect(body.importedCount).toBe(1);
      });

    // 같은 가구의 **뷰어**: 잡은 읽히지만 되돌리기는 막힌다.
    const viewerInvite = (
      await request(app.getHttpServer())
        .post(`/api/v1/households/${householdId}/invites`)
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ role: "viewer", channel: "link" })
        .expect(200)
    ).body as { inviteUrl: string };
    const viewerToken = await login(app, "import-undo-rbac-viewer");
    await request(app.getHttpServer())
      .post(`/api/v1/invites/${viewerInvite.inviteUrl.split("/invite/")[1]}/accept`)
      .set("Authorization", `Bearer ${viewerToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.household.role).toBe("viewer");
      });

    await request(app.getHttpServer())
      .get(`/api/v1/imports/${job.id}`)
      .set("Authorization", `Bearer ${viewerToken}`)
      .expect(200);
    await request(app.getHttpServer())
      .post(`/api/v1/imports/${job.id}/undo`)
      .set("Authorization", `Bearer ${viewerToken}`)
      .expect(403)
      .expect(({ body }) => {
        errorResponseSchema.parse(body);
        expect(body.error.code).toBe("FORBIDDEN");
      });

    // 남의 가구 사람: 같은 거절이고, 없는 잡의 404와는 갈린다.
    const strangerToken = await login(app, "import-undo-rbac-stranger");
    await completeOnboarding(app, strangerToken);
    await request(app.getHttpServer())
      .post(`/api/v1/imports/${job.id}/undo`)
      .set("Authorization", `Bearer ${strangerToken}`)
      .expect(403)
      .expect(({ body }) => {
        errorResponseSchema.parse(body);
        expect(body.error.code).toBe("FORBIDDEN");
      });

    // 거절당한 두 번의 호출은 아무것도 지우지 않았다.
    const prisma = app.get(PrismaService);
    expect(await prisma.expense.count({ where: { importJobId: job.id, deletedAt: null } })).toBe(1);
    expect(await prisma.auditLog.count({ where: { action: "import.undo", targetId: job.id } })).toBe(0);

    // 소유자는 통과한다 — 막힌 것은 역할이지 경로가 아니다.
    await request(app.getHttpServer())
      .post(`/api/v1/imports/${job.id}/undo`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual({ deletedCount: 1 });
      });
  });

  it("GAP-067 #3: 확정되지 않은 잡은 되돌릴 수 없다 (400 IMPORT_NOT_UNDOABLE)", async () => {
    const accessToken = await login(app, "import-undo-guard");
    const { childId } = await completeOnboarding(app, accessToken);

    const job = (
      await request(app.getHttpServer())
        .post(`/api/v1/children/${childId}/imports/excel`)
        .set("Authorization", `Bearer ${accessToken}`)
        .field("fileName", "미확정.csv")
        .attach("file", Buffer.from("날짜,적요,금액\n2026-07-06,기저귀 구매,32000\n", "utf8"), "미확정.csv")
        .expect(200)
    ).body as ImportJob;
    expect(job.status).toBe("preview_ready");

    await request(app.getHttpServer())
      .post(`/api/v1/imports/${job.id}/undo`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(400)
      .expect(({ body }) => {
        errorResponseSchema.parse(body);
        expect(body.error.code).toBe("IMPORT_NOT_UNDOABLE");
      });

    // 없는 잡은 종전 봉투 그대로다(되돌리기가 새 실패 모양을 만들지 않는다).
    await request(app.getHttpServer())
      .post(`/api/v1/imports/${randomUUID()}/undo`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(404)
      .expect(({ body }) => {
        errorResponseSchema.parse(body);
        expect(body.error.code).toBe("IMPORT_JOB_NOT_FOUND");
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

/**
 * 라운드 81 E — **왕복을 세는 그물.**
 *
 * ## 왜 이 자리에 계약이 필요한가
 * 이 파이프라인의 상한은 `importMaxRows` = 2,000행이고 그 값은 **계약**이다(AC-IMP-001 ·
 * source-lock IMPAPI-001 · QA 런북 QR-10). 그런데 두 트랜잭션의 문장 수가 행 수에 비례했다 —
 * 미리보기 **N + 3**(행마다 `importRow.create`), 확정 **2N + 2**(행마다 `insertExpense`,
 * 그 안에서 행마다 `category.findUnique`). 즉 지원한다고 약속한 끝값의 파일이 **그 약속 때문에**
 * 트랜잭션 예산을 넘길 수 있는 모양이었고, 확정에서 터지면 사용자의 검수 30분이 함께 사라진다.
 *
 * ## 세는 방법을 계약이 정한다
 * ⚠️ 이 저장소에는 왕복을 세는 자리가 **한 곳도 없었다**. 그래서 세는 방법부터 정한다:
 * `PrismaService`를 **query 이벤트를 내보내는 인스턴스로 갈아 끼우고**(아래 서브클래스 —
 * Prisma 6에는 `$use` 미들웨어가 없다) 요청 하나가 내보낸 **SQL 문장 수를 실측**한다.
 * BEGIN/COMMIT과 인증·권한 조회까지 전부 세지만, 그 몫은 **행 수와 무관한 상수**라 아래
 * 두 단언에서 서로 상쇄된다.
 *
 * ## 단언이 손으로 적은 수치를 쓰지 않는 이유
 * "확정은 몇 문장"을 상수로 박으면 다음 라운드에 낡는다(그리고 낡은 줄은 계약이 아니라
 * 유지비다). 그래서 두 단언 다 **행 수 자신으로** 표현한다.
 *  1. **행 수보다 적다** — 400행짜리 요청의 문장 수가 400 미만이어야 한다. 종전 소스에서는
 *     미리보기 403 · 확정 802라 둘 다 빨개진다.
 *  2. **행 수를 4배로 늘려도 문장 수가 그만큼 늘지 않는다** — 늘어난 행 수의 10분의 1 미만.
 *     비례하는 구현에서는 증가분이 늘어난 행 수와 같아지므로(300) 반드시 빨개진다.
 * 여유(10분의 1)를 두는 것은 확정이 트랜잭션 뒤에 fire-and-forget으로 거는 예산 경계 평가
 * (`onBudgetRelevantChange`)가 **행 수와 무관한** 몇 문장을 측정 창 안팎에 흘릴 수 있기
 * 때문이다 — 그 흔들림은 한 자릿수이고, 비례/비비례를 가르는 300과는 자릿수가 다르다.
 */
class QueryCountingPrismaService extends PrismaService {
  constructor() {
    // 기본 PrismaService는 로그 설정이 없어 query 이벤트를 내보내지 않는다. 서브클래스가
    // 생성 인자만 바꾼다(동작·연결 방식은 그대로 상속한다).
    super({ log: [{ level: "query", emit: "event" }] });
  }
}

/** `$on("query")`는 로그를 이벤트로 설정한 클라이언트에서만 타입이 열린다(생성 옵션이 타입에
 *  실리지 않는 서브클래스라 이 좁은 모양으로 받는다). */
type QueryLogEmitter = { $on(eventType: "query", callback: (event: { query: string }) => void): unknown };

describe("라운드 81 E — 가져오기 트랜잭션의 왕복 수 계약", () => {
  /** 비교의 작은 쪽/큰 쪽 행 수. 큰 쪽이 작은 쪽의 4배라는 것 말고 다른 뜻은 없다. */
  const SMALL_ROWS = 100;
  const LARGE_ROWS = 400;

  let app: INestApplication;
  const statements: string[] = [];

  beforeEach(async () => {
    process.env.JWT_ACCESS_SECRET = "test-access-secret";
    process.env.JWT_REFRESH_SECRET = "test-refresh-secret";
    process.env.WOORIAI_STAGE_TODAY = "2026-07-06";

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useClass(QueryCountingPrismaService)
      .compile();

    app = moduleRef.createNestApplication();
    configureApiApp(app);
    await app.init();

    (app.get(PrismaService) as unknown as QueryLogEmitter).$on("query", (event) => {
      statements.push(event.query);
    });
  });

  afterEach(async () => {
    delete process.env.WOORIAI_STAGE_TODAY;
    statements.length = 0;
    await app.close();
  });

  /**
   * query 이벤트는 엔진에서 올라오므로 HTTP 응답보다 조금 늦게 도착할 수 있다. 측정 앞뒤로
   * 같은 시간을 기다려 창의 경계를 맞춘다(앞의 대기는 직전 요청의 잔여 이벤트를 비우는 몫).
   */
  async function settleQueryLog() {
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  async function countStatements(run: () => Promise<void>): Promise<number> {
    await settleQueryLog();
    statements.length = 0;
    await run();
    await settleQueryLog();
    // 다음 라운드가 실측값을 다시 보고 싶을 때 쓰는 창(단언은 이 값을 쓰지 않는다):
    // `WOORIAI_LOG_STATEMENT_COUNTS=1 npx vitest run test/import-excel.e2e.test.ts`.
    if (process.env.WOORIAI_LOG_STATEMENT_COUNTS) console.log(`[statements] ${statements.length}`);
    return statements.length;
  }

  /** 전부 유효·고신뢰(품목명이 키워드에 걸린다)이고 금액만 다른 행 N개. */
  function csvWithRows(rowCount: number): string {
    const lines = ["날짜,적요,금액"];
    for (let index = 0; index < rowCount; index += 1) {
      lines.push(`2026-07-06,기저귀 구매,${1000 + index}`);
    }
    return `${lines.join("\n")}\n`;
  }

  async function uploadRows(accessToken: string, childId: string, rowCount: number): Promise<ImportJob> {
    const response = await request(app.getHttpServer())
      .post(`/api/v1/children/${childId}/imports/excel`)
      .set("Authorization", `Bearer ${accessToken}`)
      .field("fileName", `wooriai-${rowCount}.csv`)
      .attach("file", Buffer.from(csvWithRows(rowCount), "utf8"), `wooriai-${rowCount}.csv`)
      .expect(200);
    return response.body as ImportJob;
  }

  /** 확정 DTO는 `selectedRowIds`를 요구한다(ConfirmImportDto) — 검수 화면이 보내는 그 목록. */
  async function selectedRowIdsOf(accessToken: string, importJobId: string): Promise<string[]> {
    const response = await request(app.getHttpServer())
      .get(`/api/v1/imports/${importJobId}/rows`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);
    return (response.body.rows as ImportRow[]).filter((row) => row.selected).map((row) => row.id);
  }

  it("미리보기 생성의 문장 수는 행 수에 비례하지 않는다", async () => {
    const accessToken = await login(app, "r81e-preview-statements");
    const { childId } = await completeOnboarding(app, accessToken);

    // 같은 아이에 연달아 올린다 — 두 측정이 지나는 자리(취소 updateMany 포함)를 같게 두려는
    // 것이고, 아직 확정한 적이 없어 중복 후보 조회의 모집단도 양쪽 다 0이다.
    let small: ImportJob | undefined;
    const smallStatements = await countStatements(async () => {
      small = await uploadRows(accessToken, childId, SMALL_ROWS);
    });
    let large: ImportJob | undefined;
    const largeStatements = await countStatements(async () => {
      large = await uploadRows(accessToken, childId, LARGE_ROWS);
    });

    // 값 계약이 먼저다 — 행이 실제로 다 들어갔을 때만 문장 수 비교가 뜻을 가진다.
    expect(small!.rowCount).toBe(SMALL_ROWS);
    expect(large!.rowCount).toBe(LARGE_ROWS);

    expect(largeStatements).toBeLessThan(LARGE_ROWS);
    expect(largeStatements - smallStatements).toBeLessThan((LARGE_ROWS - SMALL_ROWS) / 10);
  });

  it("확정의 문장 수는 행 수에 비례하지 않는다", async () => {
    const accessToken = await login(app, "r81e-confirm-statements");

    // ⚠️ 아이를 둘로 나눈다: 확정이 만든 지출은 같은 아이의 **다음 파일에서 중복 후보**가
    // 되므로(같은 날짜·같은 금액), 한 아이로 두 번 재면 두 측정이 서로 다른 일을 한다.
    const { childId: smallChildId } = await completeOnboarding(app, accessToken);
    const { childId: largeChildId } = await completeOnboarding(app, accessToken);

    async function confirmStatements(childId: string, rowCount: number): Promise<number> {
      const job = await uploadRows(accessToken, childId, rowCount);
      expect(job.rowCount).toBe(rowCount);
      // 행 목록 조회는 측정 창 **밖**이다 — 재는 것은 확정 요청 하나다.
      const selectedRowIds = await selectedRowIdsOf(accessToken, job.id);
      expect(selectedRowIds).toHaveLength(rowCount);
      return await countStatements(async () => {
        await request(app.getHttpServer())
          .post(`/api/v1/imports/${job.id}/confirm`)
          .set("Authorization", `Bearer ${accessToken}`)
          .send({ selectedRowIds })
          .expect(200)
          .expect(({ body }) => {
            // 값 계약: 선택된 행이 전부 지출이 됐다(문장 수를 줄이면서 건수가 줄지 않았다).
            expect(body).toEqual({ importedCount: rowCount, skippedCount: 0 });
          });
      });
    }

    const smallStatements = await confirmStatements(smallChildId, SMALL_ROWS);
    const largeStatements = await confirmStatements(largeChildId, LARGE_ROWS);

    expect(largeStatements).toBeLessThan(LARGE_ROWS);
    expect(largeStatements - smallStatements).toBeLessThan((LARGE_ROWS - SMALL_ROWS) / 10);
  });

  /**
   * 확정이 `insertExpense`가 아니라 배치 INSERT로 행을 넣게 됐으므로, **그 행의 모양**을
   * 값으로 고정한다. 여기가 빨개지면 지출 생성의 단일 소스와 가져오기 경로가 갈라진 것이다
   * (import-pipeline.service.ts `insertImportedExpenses` 주석의 마지막 경고).
   */
  it("확정이 만든 지출 행의 모양은 종전과 같다", async () => {
    const accessToken = await login(app, "r81e-row-shape");
    const { childId } = await completeOnboarding(app, accessToken);
    const prisma = app.get(PrismaService);

    const job = await uploadRows(accessToken, childId, 2);
    await request(app.getHttpServer())
      .post(`/api/v1/imports/${job.id}/confirm`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ selectedRowIds: await selectedRowIdsOf(accessToken, job.id) })
      .expect(200);

    const child = await prisma.child.findUniqueOrThrow({ where: { id: childId }, select: { householdId: true } });
    const created = await prisma.expense.findMany({ where: { importJobId: job.id }, orderBy: { amountKrw: "asc" } });
    expect(created).toHaveLength(2);
    for (const expense of created) {
      expect(expense).toMatchObject({
        childId,
        categoryId: expect.any(String),
        itemName: "기저귀 구매",
        merchant: null,
        memo: null,
        paymentMethod: "unknown",
        expenseType: "expense",
        source: "excel_import",
        linkedItemTemplateId: null,
        linkedProductLinkId: null,
        importJobId: job.id,
        deletedAt: null,
        deletedByUserId: null,
        version: 1
      });
      // 가구·작성자는 잡이 아는 값 그대로다(권한 검증을 통과한 그 잡의 가구, 확정을 누른 사람).
      expect(expense.householdId).toBe(child.householdId);
      expect(expense.createdByUserId).toEqual(expect.any(String));
    }
    expect(created.map((expense) => expense.amountKrw)).toEqual([1000, 1001]);
    // 날짜는 파일의 값 그대로다(문자열 → date-only 변환이 이 경로에서도 같은 자를 쓴다).
    expect(created.every((expense) => expense.spentOn.toISOString().slice(0, 10) === "2026-07-06")).toBe(true);
  });

  /**
   * 상한이 계약인 입력의 **끝값**이 실제로 통과하는지를 한 번 재현한다(2,000행). 정찰이
   * "지원 범위의 끝값"이라고 부른 그 파일이고, 종전 소스에서는 미리보기 2,003문장 · 확정
   * 4,002문장이 기본 5초 예산 안에서 직렬로 돌았다.
   */
  it("상한(2,000행) 파일이 미리보기·확정을 모두 통과한다", async () => {
    const accessToken = await login(app, "r81e-max-rows");
    const { childId } = await completeOnboarding(app, accessToken);

    const job = await uploadRows(accessToken, childId, 2000);
    expect(job.rowCount).toBe(2000);
    expect(job.candidateCount).toBe(2000);

    const selectedRowIds = await selectedRowIdsOf(accessToken, job.id);
    expect(selectedRowIds).toHaveLength(2000);
    await request(app.getHttpServer())
      .post(`/api/v1/imports/${job.id}/confirm`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ selectedRowIds })
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual({ importedCount: 2000, skippedCount: 0 });
      });

    // 합계는 1000..2999의 합이다 — 건수만이 아니라 값이 다 들어갔음을 본다.
    const expectedTotal = (1000 + 2999) * (2000 / 2);
    await request(app.getHttpServer())
      .get(`/api/v1/children/${childId}/reports/monthly?yearMonth=2026-07`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.totalExpenseKrw).toBe(expectedTotal);
      });
  }, 60_000);
});
