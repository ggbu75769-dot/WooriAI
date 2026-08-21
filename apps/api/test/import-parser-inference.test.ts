import { BadRequestException } from "@nestjs/common";
import ExcelJS from "exceljs";
import iconv from "iconv-lite";
import { describe, expect, it } from "vitest";
import { parseImportFile } from "../src/imports/import-parser";

/**
 * COV-T1: unit coverage for the header-less column-inference path
 * (`inferColumns` in src/imports/import-parser.ts). The parser is pure
 * (no DB), so unlike import-parsing.db.test.ts (a full Nest e2e suite that
 * only exercises the Korean-header path) these tests call parseImportFile
 * directly and assert observable output: parsed rows, inferred column roles,
 * confidence values, and the IMPORT_* error codes.
 *
 * Confidence contract (computeConfidence): date+amount+name+category = 0.92,
 * date+amount+name without a category keyword = 0.67, anything missing = 0.3.
 */

const REF_YEAR = 2026;

function parseCsv(content: string, options?: { referenceYear?: number; maxRows?: number }) {
  return parseImportFile(Buffer.from(content, "utf8"), "headerless.csv", {
    referenceYear: REF_YEAR,
    ...options
  });
}

async function expectBadRequestCode(promise: Promise<unknown>, code: string) {
  let caught: unknown;
  try {
    await promise;
  } catch (error) {
    caught = error;
  }
  expect(caught).toBeInstanceOf(BadRequestException);
  expect((caught as BadRequestException).getResponse()).toMatchObject({ code });
}

describe("parseImportFile - header-less column inference (inferColumns)", () => {
  it("infers date/name/amount columns from value patterns in a clean header-less CSV", async () => {
    const csv =
      "2026-07-06,기저귀 대용량,32000\n" +
      '2026-07-05,분유 구매,"33,000원"\n' +
      "2026-07-03,물티슈,15000\n";

    const result = await parseCsv(csv);

    expect(result.fileType).toBe("csv");
    expect(result.rows).toHaveLength(3);
    expect(result.rows[0]).toEqual({
      rowIndex: 0,
      dateIso: "2026-07-06",
      itemName: "기저귀 대용량",
      amountKrw: 32000,
      memo: null,
      categoryCode: "diaper_hygiene",
      confidence: 0.92
    });
    expect(result.rows[1]).toMatchObject({
      dateIso: "2026-07-05",
      itemName: "분유 구매",
      amountKrw: 33000,
      categoryCode: "feeding_babyfood",
      confidence: 0.92
    });
    expect(result.rows[2]).toMatchObject({ dateIso: "2026-07-03", amountKrw: 15000 });
  });

  it("assigns the leftover fourth column as memo when date/amount/name are inferred", async () => {
    const csv =
      "2026-07-06,기저귀 대용량,32000,쿠팡 정기배송\n" +
      "2026-07-05,분유 구매,15000,둘째용\n";

    const { rows } = await parseCsv(csv);

    expect(rows[0]).toMatchObject({
      dateIso: "2026-07-06",
      itemName: "기저귀 대용량",
      amountKrw: 32000,
      memo: "쿠팡 정기배송"
    });
    expect(rows[1].memo).toBe("둘째용");
  });

  it("ambiguous numeric columns: value shape (median >= 100) beats column order, so the real amount column wins over a leading quantity column", async () => {
    // 갱신 근거(FIX-IMPORT-INFER 관찰 1): 종전에는 동률 hits에서 왼쪽 열이
    // 이겨 수량열(3,2,1)을 amountKrw로 오인하는 현재 동작을 고정하고 있었다.
    // 새 타이브레이크는 중앙값 크기(전형적 금액대 >= 100)로 실제 금액열을
    // 선택한다. 수량열은 remaining으로 흘러 itemIdx가 된다.
    const csv = "2026-07-01,3,32000,젖병\n" + "2026-07-02,2,15000,분유\n" + "2026-07-03,1,8000,물티슈\n";

    const { rows } = await parseCsv(csv);

    expect(rows[0]).toMatchObject({
      dateIso: "2026-07-01",
      amountKrw: 32000,
      itemName: "3",
      memo: "젖병"
    });
    expect(rows[1]).toMatchObject({ amountKrw: 15000, itemName: "2", memo: "분유" });
  });

  it("near-tied hits (one refund row) still resolve to the typical-magnitude column, not the quantity column", async () => {
    // FIX-IMPORT-INFER 관찰 1 신규 케이스: 금액열에 환불(-5000) 한 행이 있어
    // hits가 2 대 3으로 수량열보다 하나 적어도(±1 '유사' 범위) 중앙값 크기
    // 타이브레이크가 금액열을 선택해야 한다.
    const csv = "2026-07-01,3,32000,젖병\n" + "2026-07-02,2,-5000,분유\n" + "2026-07-03,1,8000,물티슈\n";

    const { rows } = await parseCsv(csv);

    expect(rows[0]).toMatchObject({ dateIso: "2026-07-01", amountKrw: 32000, itemName: "3", memo: "젖병" });
    // Refund row: amount fails to parse -> null, confidence floors.
    expect(rows[1]).toMatchObject({ amountKrw: null, confidence: 0.3 });
    expect(rows[2]).toMatchObject({ amountKrw: 8000 });
  });

  it("both numeric columns in the typical range: digit-count variety breaks the tie toward the varied (real amount) column", async () => {
    // FIX-IMPORT-INFER 관찰 1 신규 케이스: 균일한 고정치 열(5000,5000,5000 —
    // 예: 회비/고정요금)과 자릿수가 다양한 열이 모두 중앙값 >= 100이면
    // 자릿수 다양성이 큰 쪽을 금액열로 선택한다(균일 열이 왼쪽이어도).
    const csv = "2026-07-01,5000,32000,젖병\n" + "2026-07-02,5000,4500,분유\n" + "2026-07-03,5000,158000,물티슈\n";

    const { rows } = await parseCsv(csv);

    expect(rows[0]).toMatchObject({ amountKrw: 32000, itemName: "5000", memo: "젖병" });
    expect(rows[1]).toMatchObject({ amountKrw: 4500 });
    expect(rows[2]).toMatchObject({ amountKrw: 158000 });
  });

  it("hit counts differing by more than 1 dominate the shape tiebreak (guardrail: sparse large-value column loses)", async () => {
    // FIX-IMPORT-INFER 관찰 1 신규 케이스(가드레일): 타이브레이크는 동률/±1
    // '유사' hits에만 적용된다. 큰 값 열이 5행 중 2행만 금액으로 파싱되면
    // (hits 5 대 3, 차이 > 1) 종전대로 hits가 많은 열이 금액으로 선택된다.
    const csv =
      "2026-07-01,3,32000,젖병\n" +
      "2026-07-02,2,판매불가,분유\n" +
      "2026-07-03,1,-8000,물티슈\n" +
      "2026-07-04,4,15000,장난감\n" +
      "2026-07-05,2,20000,침대\n";

    const { rows } = await parseCsv(csv);

    expect(rows[0]).toMatchObject({ amountKrw: 3, itemName: "32000", memo: "젖병" });
    expect(rows[3]).toMatchObject({ amountKrw: 4, itemName: "15000" });
  });

  it("fully tied shape (both small, uniform digit counts): the leftmost candidate column is kept for stability", async () => {
    // FIX-IMPORT-INFER 관찰 1 신규 케이스: 두 수치열이 hits·중앙값 대역·자릿수
    // 다양성까지 전부 같으면 판단 근거가 없으므로 종전 규칙(왼쪽 열 유지)을
    // 따른다 — 타이브레이크가 무근거 스왑을 만들지 않음을 고정.
    const csv = "2026-07-01,2,5,젖병\n" + "2026-07-02,3,6,분유\n" + "2026-07-03,4,7,물티슈\n";

    const { rows } = await parseCsv(csv);

    expect(rows[0]).toMatchObject({ amountKrw: 2, itemName: "5", memo: "젖병" });
    expect(rows[1]).toMatchObject({ amountKrw: 3, itemName: "6", memo: "분유" });
  });

  it("date detection honors options.referenceYear (leap-day M/D rows are detected as the date column)", async () => {
    // FIX-IMPORT-INFER 관찰 3 신규 케이스: 종전 감지는 new Date()의 현재
    // 연도를 써서 2/29가 비윤년(예: 2026)에는 날짜로 인정되지 않아 열 감지가
    // 실패했다. 감지도 referenceYear를 쓰므로 윤년 2024 기준으로는 날짜열로
    // 잡혀야 하며, 결과는 벽시계 연도와 무관하게 결정적이다.
    const csv = "02/29,분유,15000\n" + "2/29,기저귀,32000\n";

    const { rows } = await parseCsv(csv, { referenceYear: 2024 });

    expect(rows[0]).toMatchObject({ dateIso: "2024-02-29", itemName: "분유", amountKrw: 15000, confidence: 0.92 });
    expect(rows[1]).toMatchObject({ dateIso: "2024-02-29", itemName: "기저귀", amountKrw: 32000 });
  });

  it("a compact-date column (YYYYMMDD) is claimed by date inference and not double-counted as the amount column", async () => {
    // "20260706" parses both as a date and as an amount; the date pass runs
    // first and the amount pass must skip the date column.
    const csv = "20260706,기저귀,32000\n" + "20260705,분유,15000\n";

    const { rows } = await parseCsv(csv);

    expect(rows[0]).toMatchObject({ dateIso: "2026-07-06", itemName: "기저귀", amountKrw: 32000 });
    expect(rows[1]).toMatchObject({ dateIso: "2026-07-05", itemName: "분유", amountKrw: 15000 });
  });

  it("normalizes Korean bank/card date formats: dots, slashes, compact, and month-day with reference year", async () => {
    const csv =
      "2026.07.06,분유,10000\n" +
      "2026/07/05,기저귀,20000\n" +
      "20260704,물티슈,30000\n" +
      "07/03,장난감,40000\n" +
      "7-2,침대,50000\n";

    const { rows } = await parseCsv(csv, { referenceYear: 2026 });

    expect(rows.map((row) => row.dateIso)).toEqual([
      "2026-07-06",
      "2026-07-05",
      "2026-07-04",
      "2026-07-03", // MM/DD resolved against referenceYear
      "2026-07-02" // M-D resolved against referenceYear
    ]);
    expect(rows.every((row) => row.confidence === 0.92)).toBe(true);
  });

  it("normalizes amount formats (commas, 원, ₩, +, decimals) and nulls out refunds/negatives", async () => {
    const csv =
      '2026-07-01,분유,"1,000원"\n' +
      "2026-07-02,분유,₩2000\n" +
      "2026-07-03,분유,3000원\n" +
      '2026-07-04,분유,"(4,000)"\n' + // parenthesized negative -> not an expense
      "2026-07-05,분유,-5000\n" + // negative -> not an expense
      "2026-07-06,분유,+6000\n" +
      "2026-07-07,분유,7000.49\n";

    const { rows } = await parseCsv(csv);

    expect(rows.map((row) => row.amountKrw)).toEqual([1000, 2000, 3000, null, null, 6000, 7000]);
    // Rows whose amount failed to parse drop to floor confidence.
    expect(rows[3].confidence).toBe(0.3);
    expect(rows[4].confidence).toBe(0.3);
    expect(rows[0].confidence).toBe(0.92);
  });

  it("infers roles regardless of column order (name,amount,date shuffle)", async () => {
    const csv = "기저귀 구매,32000,2026-07-06\n" + "분유,15000,2026-07-05\n" + "물티슈,5000,2026-07-04\n";

    const { rows } = await parseCsv(csv);

    expect(rows[0]).toEqual({
      rowIndex: 0,
      dateIso: "2026-07-06",
      itemName: "기저귀 구매",
      amountKrw: 32000,
      memo: null,
      categoryCode: "diaper_hygiene",
      confidence: 0.92
    });
    expect(rows[2]).toMatchObject({ dateIso: "2026-07-04", itemName: "물티슈", amountKrw: 5000 });
  });

  it("single text column degenerates to name-only rows at floor confidence (category keywords still matched)", async () => {
    const csv = "기저귀\n분유\n장난감\n";

    const { rows } = await parseCsv(csv);

    expect(rows).toHaveLength(3);
    expect(rows[0]).toEqual({
      rowIndex: 0,
      dateIso: null,
      itemName: "기저귀",
      amountKrw: null,
      memo: null,
      categoryCode: "diaper_hygiene",
      confidence: 0.3
    });
    expect(rows[1].categoryCode).toBe("feeding_babyfood");
    expect(rows[2].categoryCode).toBe("toys_books");
  });

  it("single date column yields date-only rows with no name/amount and floor confidence", async () => {
    const csv = "2026-07-01\n2026-07-02\n";

    const { rows } = await parseCsv(csv);

    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({
      rowIndex: 0,
      dateIso: "2026-07-01",
      itemName: null,
      amountKrw: null,
      memo: null,
      categoryCode: null,
      confidence: 0.3
    });
  });

  it("rejects an empty file with IMPORT_FILE_INVALID", async () => {
    await expectBadRequestCode(parseCsv(""), "IMPORT_FILE_INVALID");
  });

  it("rejects a newline-only file with IMPORT_FILE_INVALID", async () => {
    await expectBadRequestCode(parseCsv("\n\n\n"), "IMPORT_FILE_INVALID");
  });

  it("returns zero rows (not an error) for a file containing only empty delimited cells", async () => {
    const { rows } = await parseCsv(",,\n,,\n");
    expect(rows).toEqual([]);
  });

  it("rejects header-less files whose non-blank rows exceed the cap with IMPORT_TOO_MANY_ROWS", async () => {
    const csv = ["2026-07-01,기저귀,1000", "2026-07-02,분유,2000", "2026-07-03,물티슈,3000", "2026-07-04,장난감,4000"].join(
      "\n"
    );
    await expectBadRequestCode(parseCsv(csv, { maxRows: 3 }), "IMPORT_TOO_MANY_ROWS");
  });

  it("accepts exactly cap-many rows and does not count blank lines against the cap", async () => {
    const csv = "2026-07-01,기저귀,1000\n\n2026-07-02,분유,2000\n\n2026-07-03,물티슈,3000\n\n";

    const { rows } = await parseCsv(csv, { maxRows: 3 });

    expect(rows).toHaveLength(3);
    // Blank rows are dropped before indexing, so rowIndex stays contiguous.
    expect(rows.map((row) => row.rowIndex)).toEqual([0, 1, 2]);
  });

  it("enforces the default 2000-row cap on header-less files", async () => {
    const over = Array.from({ length: 2001 }, (_, i) => `2026-07-01,아이템${i},1000`).join("\n");
    await expectBadRequestCode(parseCsv(over), "IMPORT_TOO_MANY_ROWS");

    const atCap = Array.from({ length: 2000 }, (_, i) => `2026-07-01,아이템${i},1000`).join("\n");
    const { rows } = await parseCsv(atCap);
    expect(rows).toHaveLength(2000);
    expect(rows[1999]).toMatchObject({ rowIndex: 1999, dateIso: "2026-07-01", amountKrw: 1000 });
  });

  it("decodes a CP949-encoded header-less CSV and still infers columns from the decoded values", async () => {
    const csv = "2026-07-06,기저귀 대용량,32000\n" + "2026-07-05,병원 진료비,15000\n";
    const cp949Buffer = iconv.encode(csv, "cp949");

    const result = await parseImportFile(cp949Buffer, "cp949-headerless.csv", { referenceYear: REF_YEAR });

    expect(result.rows).toHaveLength(2);
    expect(result.rows[0]).toMatchObject({
      dateIso: "2026-07-06",
      itemName: "기저귀 대용량",
      amountKrw: 32000,
      categoryCode: "diaper_hygiene",
      confidence: 0.92
    });
    expect(result.rows[1]).toMatchObject({
      itemName: "병원 진료비",
      categoryCode: "hospital_checkup"
    });
  });

  it("neutralizes formula-injection prefixes in the inferred name column while preserving content and category match", async () => {
    const csv =
      "2026-07-06,=기저귀 자동주문,8000\n" + "2026-07-05,@악성 매크로,7000\n" + "2026-07-04,+분유 더하기,6000\n";

    const { rows } = await parseCsv(csv);

    expect(rows[0].itemName).toBe("'=기저귀 자동주문");
    expect(rows[1].itemName).toBe("'@악성 매크로");
    expect(rows[2].itemName).toBe("'+분유 더하기");
    // Sanitization must not break category keyword matching or confidence.
    expect(rows[0].categoryCode).toBe("diaper_hygiene");
    expect(rows[0].confidence).toBe(0.92);
    expect(rows[2].categoryCode).toBe("feeding_babyfood");
  });

  it("caps sanitized name cells at 500 characters", async () => {
    const longName = `=${"기".repeat(600)}`;
    const csv = `2026-07-06,${longName},8000\n`;

    const { rows } = await parseCsv(csv);

    expect(rows[0].itemName!.length).toBe(500);
    expect(rows[0].itemName!.startsWith("'=기")).toBe(true);
  });

  it("mixed valid/garbage rows: inference survives a garbage minority and confidence reflects each row", async () => {
    const csv =
      "2026-07-06,기저귀,32000\n" +
      "안녕하세요 이건,쓰레기,데이터\n" +
      "2026-07-04,분유,15000\n" +
      "2026-07-03,장난감,20000\n" +
      "\n" +
      "2026-07-01,알수없는가게,9000\n";

    const { rows } = await parseCsv(csv);

    expect(rows).toHaveLength(5); // blank line dropped
    expect(rows.map((row) => row.confidence)).toEqual([
      0.92, // date+amount+name+category
      0.3, // garbage row: no date, no amount
      0.92,
      0.92,
      0.67 // no category keyword -> penalized but above floor
    ]);
    expect(rows[1]).toMatchObject({ dateIso: null, amountKrw: null, itemName: "쓰레기" });
    expect(rows[4]).toMatchObject({ dateIso: "2026-07-01", amountKrw: 9000, categoryCode: null });
  });

  it("garbage-majority sample: no date/amount column clears the 50% bar, so every row (even later valid ones) floors at 0.3", async () => {
    // Only the first 5 rows are sampled for inference; 3 of 5 are garbage, so
    // date/amount hit ratios are 2/5 and no column is assigned those roles.
    const csv =
      "잡담,아무거나,텍스트\n" +
      "또잡담,값없음,텍스트\n" +
      "세번째,잡음,값\n" +
      "2026-07-01,기저귀,5000\n" +
      "2026-07-02,분유,6000\n";

    const { rows } = await parseCsv(csv);

    expect(rows).toHaveLength(5);
    expect(rows.every((row) => row.dateIso === null && row.amountKrw === null)).toBe(true);
    expect(rows.every((row) => row.confidence === 0.3)).toBe(true);
    // First remaining column becomes the name, second becomes memo.
    expect(rows[3]).toMatchObject({ itemName: "2026-07-01", memo: "기저귀" });
  });

  it("infers columns for a header-less XLSX sheet, including Date and numeric cells", async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("거래내역");
    sheet.addRow([new Date(Date.UTC(2026, 6, 6)), "기저귀 세트", 20000]);
    sheet.addRow([new Date(Date.UTC(2026, 6, 5)), "장난감 기차", 15000]);
    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());

    const result = await parseImportFile(buffer, "headerless.xlsx", { referenceYear: REF_YEAR });

    expect(result.fileType).toBe("xlsx");
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0]).toMatchObject({
      dateIso: "2026-07-06",
      itemName: "기저귀 세트",
      amountKrw: 20000,
      categoryCode: "diaper_hygiene",
      confidence: 0.92
    });
    expect(result.rows[1]).toMatchObject({
      dateIso: "2026-07-05",
      itemName: "장난감 기차",
      amountKrw: 15000,
      categoryCode: "toys_books"
    });
  });
});
