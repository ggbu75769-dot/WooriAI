import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseImportFile } from "../src/imports/import-parser";

/**
 * 라운드 65 A(#1) — **내보내기 ↔ 가져오기 왕복 계약**(두 앱을 잇는 유일한 테스트).
 *
 *   client: apps/mobile/src/export/expense-csv.ts -> `EXPENSE_CSV_HEADER`
 *   server: apps/api/src/imports/import-parser.ts -> `HEADER_KEYWORDS` / `detectHeaderColumns`
 *
 * 왜 필요한가: 내보내기 모듈은 스스로 "a file we export can be fed straight back into the
 * excel import"라고 적어 두었고, 서버 파서는 그 머리글을 알아본다고 가정했다. 그런데 두
 * 사실을 **맞대 보는 테스트가 어느 쪽에도 없었다** — `expense-csv.test.ts`는 헤더 문자열만
 * 고정하고 `import-parser-inference.test.ts`는 키워드 표만 고정한다. 그 사이로 `항목`
 * (품목명 열)이 빠져나가, 우리가 내보낸 CSV를 그대로 다시 올리면 **전 행이 잠기는** 결함이
 * 라운드 내내 살아남았다.
 *
 * 그래서 이 테스트는 문자열을 다시 적지 않는다. 모바일의 헤더 상수를 **소스에서 읽어**
 * 그대로 파서에 먹이고, 네 역할(date · item · amount · memo)이 전부 잡히는지 본다. 모바일
 * 파일을 import하지 않고 텍스트로 읽는 이유는 `mobile-category-alias-contract.test.ts`와
 * 같다: apps/mobile은 이 앱의 tsconfig 밖(React Native/Expo) 프로젝트라, 리터럴만 읽어
 * 크로스 앱 모듈 해석을 api 스위트에 들이지 않는다.
 *
 * DB를 쓰지 않는 순수 테스트다(shared 레인 — exclusive-suites.ts 등재 대상이 아니다).
 */
const apiRoot = fileURLToPath(new URL("..", import.meta.url));
const repoRoot = join(apiRoot, "..", "..");
const expenseCsvPath = join(repoRoot, "apps", "mobile", "src", "export", "expense-csv.ts");

function exportedCsvHeader(): string {
  expect(existsSync(expenseCsvPath), `${expenseCsvPath} must exist`).toBe(true);
  const source = readFileSync(expenseCsvPath, "utf8");
  const match = /export const EXPENSE_CSV_HEADER = "([^"]+)";/.exec(source);
  expect(match, `EXPENSE_CSV_HEADER literal not found in ${expenseCsvPath}`).not.toBeNull();
  return match![1];
}

/**
 * 내보내기가 실제로 싣는 값의 **대표 한 벌**(열 머리글 -> 그 열에 들어가는 문자열).
 * `expenseToCsvRow`의 열 순서를 여기에 다시 적지 않고, 아래 테스트가 헤더에서 읽은 순서대로
 * 조립한다 — 그래서 내보내기가 열을 하나 더하면 **이 표가 먼저 실패한다**(왕복을 검토하지
 * 않은 채 열이 늘어나는 것이 후보 #1이 생긴 경로다).
 */
const SAMPLE_BY_COLUMN: Record<string, string> = {
  "날짜": "2026-07-06",
  "구분": "선물",
  "카테고리": "기저귀/위생",
  "항목": "기저귀 대용량",
  "판매처": "쿠팡",
  "결제수단": "카드",
  "금액(원)": "32000",
  "메모": "정기배송",
  "출처": "직접 입력"
};

/** 내보내기와 같은 모양의 파일: UTF-8 BOM + CRLF 레코드(`buildExpenseCsv`). */
function buildExportedCsvBuffer(header: string, rows: string[][]): Buffer {
  const lines = [header, ...rows.map((cells) => cells.join(","))];
  return Buffer.from(`﻿${lines.join("\r\n")}\r\n`, "utf8");
}

describe("내보낸 CSV -> 엑셀 가져오기 왕복 계약", () => {
  it("헤더 상수를 실제로 읽는다 (이 테스트가 조용히 무의미해지는 것을 막는다)", () => {
    const header = exportedCsvHeader();
    const columns = header.split(",");

    expect(columns.length).toBeGreaterThan(0);
    // 표가 헤더와 정확히 같은 열 집합을 덮는지 — 어느 한쪽이 늘거나 줄면 여기서 멈춘다.
    expect(new Set(columns)).toEqual(new Set(Object.keys(SAMPLE_BY_COLUMN)));
    expect(new Set(columns).size).toBe(columns.length);
  });

  it("우리가 내보낸 파일을 그대로 올리면 날짜·품목명·금액·메모 네 열이 모두 잡힌다", async () => {
    const header = exportedCsvHeader();
    const columns = header.split(",");
    const cells = columns.map((column) => SAMPLE_BY_COLUMN[column]);

    const { rows, fileType } = await parseImportFile(buildExportedCsvBuffer(header, [cells]), "wooriai-export.csv", {
      referenceYear: 2026
    });

    expect(fileType).toBe("csv");
    expect(rows).toHaveLength(1);
    // 네 역할이 전부 잡혔다는 것을 **값으로** 단언한다(-1 열은 빈 문자열 -> null이 된다).
    expect(rows[0]).toEqual({
      rowIndex: 0,
      dateIso: "2026-07-06",
      itemName: "기저귀 대용량",
      amountKrw: 32000,
      memo: "정기배송",
      categoryCode: "diaper_hygiene",
      confidence: 0.92
    });
  });

  it("확정까지 갈 수 있는 행이다 — 파이프라인이 요구하는 세 값이 전부 채워진다", async () => {
    const header = exportedCsvHeader();
    const columns = header.split(",");
    const make = (date: string, item: string, amount: string) =>
      columns.map((column) => {
        if (column === "날짜") return date;
        if (column === "항목") return item;
        if (column === "금액(원)") return amount;
        return SAMPLE_BY_COLUMN[column];
      });

    const { rows } = await parseImportFile(
      buildExportedCsvBuffer(header, [
        make("2026-07-06", "기저귀 대용량", "32000"),
        make("2026-07-05", "분유 2단계", "45900"),
        make("2026-07-04", "쿠팡 정기배송", "12000")
      ]),
      "wooriai-export.csv",
      { referenceYear: 2026 }
    );

    expect(rows).toHaveLength(3);
    // `validationStatusForImportRow`가 잠그는 세 가지(날짜 없음 · 품목명 없음 · 금액 없음)가
    // 한 행도 없어야 확정 버튼이 0건을 가져가지 않는다.
    for (const row of rows) {
      expect(row.dateIso).not.toBeNull();
      expect(row.itemName).not.toBeNull();
      expect(row.amountKrw).not.toBeNull();
    }
    expect(rows.map((row) => row.itemName)).toEqual(["기저귀 대용량", "분유 2단계", "쿠팡 정기배송"]);
    // 키워드에 걸리지 않는 가맹점 이름 행도 품목명 자체는 살아 있다(분류는 검수 화면에서 고른다).
    expect(rows[2].categoryCode).toBeNull();
  });

  it("`항목`이 없던 시절의 결함을 재현으로 고정한다 (품목명 열을 빼면 전 행이 잠긴다)", async () => {
    const header = exportedCsvHeader();
    const columns = header.split(",");
    const itemIndex = columns.indexOf("항목");
    expect(itemIndex).toBeGreaterThan(-1);

    // 품목명 머리글만 파서가 모르는 낱말로 바꾼 대조군 — 나머지는 같은 파일이다.
    const brokenHeader = columns.map((column, index) => (index === itemIndex ? "무엇" : column)).join(",");
    const cells = columns.map((column) => SAMPLE_BY_COLUMN[column]);

    const { rows } = await parseImportFile(buildExportedCsvBuffer(brokenHeader, [cells]), "wooriai-export.csv", {
      referenceYear: 2026
    });

    // 날짜·금액은 여전히 잡히지만 품목명이 비어 파이프라인이 missing_item_name으로 떨군다.
    expect(rows[0].dateIso).toBe("2026-07-06");
    expect(rows[0].amountKrw).toBe(32000);
    expect(rows[0].itemName).toBeNull();
    expect(rows[0].confidence).toBe(0.3);
  });

  it("나머지 다섯 열은 어떤 역할도 훔치지 않는다 (구분·카테고리·판매처·결제수단·출처)", async () => {
    const header = exportedCsvHeader();
    const columns = header.split(",");
    const passthroughColumns = columns.filter(
      (column) => !["날짜", "항목", "금액(원)", "메모"].includes(column)
    );
    expect(passthroughColumns).toEqual(["구분", "카테고리", "판매처", "결제수단", "출처"]);

    // 다섯 열에 **역할 키워드와 헷갈릴 만한 값**을 넣어도 네 역할의 값이 그대로여야 한다.
    const cells = columns.map((column) => {
      if (column === "카테고리") return "9999";
      if (column === "판매처") return "2026-01-01";
      if (column === "출처") return "77777";
      return SAMPLE_BY_COLUMN[column];
    });

    const { rows } = await parseImportFile(buildExportedCsvBuffer(header, [cells]), "wooriai-export.csv", {
      referenceYear: 2026
    });

    expect(rows[0]).toMatchObject({
      dateIso: "2026-07-06",
      itemName: "기저귀 대용량",
      amountKrw: 32000,
      memo: "정기배송"
    });
  });

  /**
   * 라운드 65 A의 **의도적 미해결**을 한자리에 적어 둔다.
   *
   * 내보내기는 `구분`(지출/선물/환불)과 `판매처`·`결제수단`·`출처`를 싣는데, 파서의
   * `ParsedImportRow`에는 그 자리가 없다. 즉 재가져오기에서 **선물 행이 지출로 바뀐다** —
   * DNC-015가 합계에서 빼 두는 그 행들이다. 되살리려면 `import_rows`에 칸을 더하는 스키마
   * 변경 + 확정이 `insertExpense`에 넘기는 값 증가(DNC-012·DNC-015)라 PM 판단이 선행이고,
   * 이번 라운드의 몫은 **그 사실을 두 문장이 나란히 읽히는 자리에 남기는 것**이다.
   * (지금까지는 "내보내기가 구분을 싣는다"와 "가져오기가 구분을 버린다"가 각자 자기 파일에만
   * 적혀 있었다.)
   */
  it("구분·판매처·결제수단·출처는 아직 왕복하지 않는다 (알려진 한계를 값으로 고정)", async () => {
    const header = exportedCsvHeader();
    const columns = header.split(",");
    const cells = columns.map((column) => SAMPLE_BY_COLUMN[column]);

    const { rows } = await parseImportFile(buildExportedCsvBuffer(header, [cells]), "wooriai-export.csv", {
      referenceYear: 2026
    });

    // ParsedImportRow가 가진 칸의 전부. `expenseType`/`merchant`/`paymentMethod`/`source`는 없다.
    expect(Object.keys(rows[0]).sort()).toEqual(
      ["amountKrw", "categoryCode", "confidence", "dateIso", "itemName", "memo", "rowIndex"].sort()
    );
    // "선물"이라고 적힌 열은 어디에도 실리지 않는다(메모로 흘러들지도 않는다).
    expect(JSON.stringify(rows[0])).not.toContain("선물");
  });
});
