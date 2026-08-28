import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { Expense } from "../api/client";
import { buildCategoryNameLookup, categoryCatalog } from "../categories";
import { paymentMethodLabelKo } from "../expenses/expense-detail-rows";
import { expenseTypeLabelKo, recordsRowSubtitle } from "../expenses/records-list-view";
import {
  buildExpenseCsv,
  escapeCsvField,
  EXPENSE_CSV_HEADER,
  EXPORT_MAX_ROWS,
  expenseToCsvRow,
  sanitizeCsvCell,
  sourceLabelKo,
  UTF8_BOM
} from "./expense-csv";

const diaperCategory = categoryCatalog[0]; // 기저귀

function makeExpense(overrides: Partial<Expense> = {}): Expense {
  return {
    id: "e-1",
    childId: "child-1",
    categoryId: diaperCategory.id,
    amountKrw: 45900,
    spentOn: "2026-08-01",
    itemName: "기저귀 대형",
    merchant: null,
    memo: null,
    expenseType: "expense",
    source: "manual",
    version: 1,
    ...overrides
  };
}

describe("EXP-106 expense CSV builder", () => {
  it("prefixes a UTF-8 BOM and uses CRLF record separators (Excel compatibility)", () => {
    const { csv } = buildExpenseCsv([makeExpense()]);
    expect(csv.startsWith(UTF8_BOM)).toBe(true);
    expect(UTF8_BOM).toBe("﻿");
    expect(csv).toContain("\r\n");
    expect(csv.endsWith("\r\n")).toBe(true);
    // No bare LF records: removing CRLFs must leave no stray \n or \r.
    expect(csv.replaceAll("\r\n", "")).not.toMatch(/[\r\n]/);
  });

  it("writes the agreed header as the first record", () => {
    const { csv } = buildExpenseCsv([]);
    expect(csv).toBe(`${UTF8_BOM}날짜,구분,카테고리,항목,판매처,결제수단,금액(원),메모,출처\r\n`);
    expect(EXPENSE_CSV_HEADER).toBe("날짜,구분,카테고리,항목,판매처,결제수단,금액(원),메모,출처");
  });

  /**
   * 라운드 65 A(#1) — **서버 키워드 표를 소스에서 읽어** 대조한다(수기 미러 계약,
   * src/api/contracts-mirror.test.ts와 같은 관례).
   *
   * 종전에는 이 테스트가 키워드 26개를 **여기에 다시 적어** 두고 새 열이 그것들과 겹치지
   * 않는지만 봤다. 그래서 정작 반대 방향 — "우리가 내보내는 열을 서버가 알아보기는 하는가" —
   * 은 아무도 묻지 않았고, `항목`(품목명 열)이 item 키워드에 없다는 사실이 그대로 통과했다
   * (`"항목".includes("품목")`은 거짓이다). 내보낸 파일을 다시 올리면 전 행이
   * `missing_item_name`으로 잠기는 결함이 그 사이로 나갔다.
   *
   * 실제 파싱까지 돌려 보는 왕복 e2e는 서버 쪽에 있다
   * (apps/api/test/mobile-export-csv-roundtrip.test.ts). 이쪽은 그 계약의 **모바일 거울**이다.
   */
  it("CSV-127 / 라운드 48 T3 / 라운드 65 A: 9열이 서버 HEADER_KEYWORDS에서 의도한 역할로만 잡힌다", () => {
    const columns = EXPENSE_CSV_HEADER.split(",");
    expect(columns).toHaveLength(9);

    const parserSource = readFileSync(
      join(process.cwd(), "..", "..", "apps", "api", "src", "imports", "import-parser.ts"),
      "utf8"
    );
    const block = /const HEADER_KEYWORDS = \{([\s\S]*?)\n\};/.exec(parserSource);
    expect(block, "HEADER_KEYWORDS 리터럴을 import-parser.ts에서 찾지 못했다").not.toBeNull();

    const keywordsByRole: Record<string, string[]> = {};
    for (const entry of block![1].matchAll(/(\w+):\s*\[([^\]]*)\]/g)) {
      keywordsByRole[entry[1]] = [...entry[2].matchAll(/"([^"]+)"/g)].map((keyword) => keyword[1]);
    }
    // 표가 실제로 읽혔는지부터 (정규식이 조용히 죽으면 아래 단언이 전부 무의미해진다).
    expect(Object.keys(keywordsByRole).sort()).toEqual(["amount", "date", "item", "memo"]);
    for (const role of Object.keys(keywordsByRole)) {
      expect(keywordsByRole[role].length, `${role} 키워드가 비었다`).toBeGreaterThan(0);
    }

    // 서버 판정은 `헤더.includes(키워드)`다 — 한 열이 두 역할에 걸리면 else-if 사슬의 순서가
    // 결과를 정하므로, 열마다 걸리는 역할 집합을 **정확히** 못 박는다.
    const rolesFor = (column: string) =>
      Object.keys(keywordsByRole)
        .filter((role) => keywordsByRole[role].some((keyword) => column.includes(keyword)))
        .sort();

    expect(rolesFor("날짜")).toEqual(["date"]);
    expect(rolesFor("항목")).toEqual(["item"]);
    expect(rolesFor("금액(원)")).toEqual(["amount"]);
    expect(rolesFor("메모")).toEqual(["memo"]);
    // 나머지 다섯 열은 어떤 역할도 가로채지 않는다. 특히 "결제수단"은 date 키워드 "결제일"·
    // amount 키워드 "결제금액" 어느 쪽도 포함하지 않고, "판매처"는 item 키워드가 아니다.
    for (const column of ["구분", "카테고리", "판매처", "결제수단", "출처"]) {
      expect(rolesFor(column), `${column} 는 어떤 역할도 가져가면 안 된다`).toEqual([]);
    }
  });

  it("emits raw integer amounts, never src/money.ts formatting", () => {
    const row = expenseToCsvRow(makeExpense({ amountKrw: 1234567 }));
    expect(row).toContain(",1234567,");
    expect(row).not.toContain("1,234,567");
    expect(row).not.toContain("원,");
  });

  it("maps categoryId to the same Korean label the screens use, with 기타 fallback", () => {
    expect(expenseToCsvRow(makeExpense())).toContain(",기저귀,");
    expect(expenseToCsvRow(makeExpense({ categoryId: "not-a-known-id" }))).toContain(",기타,");
  });

  it("prefers a server-backed category lookup so the canonical seed categories keep their real names", () => {
    // The 12 canonical seed categories (apps/api/prisma/seed-data.ts categorySeeds) have no fixed
    // ids, so their per-database UUIDs are unknown to categoryNameFor and used to export as "기타".
    const serverCategoryId = "11111111-1111-4111-8111-111111111111";
    const categoryName = buildCategoryNameLookup([{ id: serverCategoryId, name: "수유/이유식" }]);

    expect(expenseToCsvRow(makeExpense({ categoryId: serverCategoryId }), categoryName)).toContain(",수유/이유식,");
    const { csv } = buildExpenseCsv([makeExpense({ categoryId: serverCategoryId })], { categoryName });
    expect(csv).toContain(",수유/이유식,");

    // Ids missing from the server list still fall back to the static catalog mapping, never a raw id.
    expect(expenseToCsvRow(makeExpense(), categoryName)).toContain(",기저귀,");
    expect(expenseToCsvRow(makeExpense({ categoryId: "not-a-known-id" }), categoryName)).toContain(",기타,");
    // No lookup passed (preview/offline): unchanged legacy behavior.
    expect(buildExpenseCsv([makeExpense({ categoryId: serverCategoryId })]).csv).toContain(",기타,");
  });

  it("maps expense source codes to Korean labels", () => {
    expect(sourceLabelKo("manual")).toBe("직접 입력");
    expect(sourceLabelKo("excel_import")).toBe("엑셀 가져오기");
    expect(sourceLabelKo("purchase_followup")).toBe("구매 연동");
    expect(sourceLabelKo("admin")).toBe("관리자");
    expect(sourceLabelKo("mystery_source")).toBe("mystery_source");
  });

  it("applies RFC 4180 quoting for commas, quotes, and newlines", () => {
    expect(escapeCsvField("plain")).toBe("plain");
    expect(escapeCsvField("a,b")).toBe('"a,b"');
    expect(escapeCsvField('say "hi"')).toBe('"say ""hi"""');
    expect(escapeCsvField("line1\nline2")).toBe('"line1\nline2"');
    expect(escapeCsvField("line1\r\nline2")).toBe('"line1\r\nline2"');

    const row = expenseToCsvRow(makeExpense({ itemName: "물티슈, 대용량", memo: '아기 "선물"용\n두 줄 메모' }));
    expect(row).toBe(`2026-08-01,지출,기저귀,"물티슈, 대용량",,,45900,"아기 ""선물""용\n두 줄 메모",직접 입력`);

    // CSV-127: 새 두 열도 같은 이스케이프를 그대로 통과한다 -- 판매처에 쉼표가 든 상호명은
    // 흔하다("쿠팡, 로켓배송"), 따옴표를 안 씌우면 열이 하나 밀려 파일 전체가 어긋난다.
    const merchantRow = expenseToCsvRow(makeExpense({ merchant: '쿠팡, "로켓"배송' }));
    expect(merchantRow).toContain(`"쿠팡, ""로켓""배송"`);
  });

  it("guards formula injection with the api import-parser convention (leading single quote)", () => {
    // Same DANGEROUS_LEADING_CHARS set as apps/api/src/imports/import-parser.ts.
    for (const dangerous of ["=", "+", "-", "@", "\t", "\r"]) {
      expect(sanitizeCsvCell(`${dangerous}cmd`)).toBe(`'${dangerous}cmd`);
    }
    expect(sanitizeCsvCell("safe=inside")).toBe("safe=inside");
    expect(sanitizeCsvCell("")).toBe("");

    const row = expenseToCsvRow(makeExpense({ itemName: "=SUM(A1:A9)", memo: "@evil" }));
    expect(row).toContain("'=SUM(A1:A9)");
    expect(row).toContain("'@evil");
  });

  it("renders a null memo as an empty field", () => {
    expect(expenseToCsvRow(makeExpense({ memo: null }))).toBe("2026-08-01,지출,기저귀,기저귀 대형,,,45900,,직접 입력");
  });

  it("CSV-127: 판매처가 없으면 빈 칸이다 (없는 상호를 지어내지 않는다)", () => {
    expect(expenseToCsvRow(makeExpense({ merchant: null }))).toBe("2026-08-01,지출,기저귀,기저귀 대형,,,45900,,직접 입력");
    expect(expenseToCsvRow(makeExpense({ merchant: undefined }))).toBe("2026-08-01,지출,기저귀,기저귀 대형,,,45900,,직접 입력");
    expect(expenseToCsvRow(makeExpense({ merchant: "쿠팡" }))).toBe("2026-08-01,지출,기저귀,기저귀 대형,쿠팡,,45900,,직접 입력");
  });

  /**
   * 라운드 48 T3(C2): 판매처 열은 **입력 경로가 없는 채로 유지**된다. 앱의 어떤 화면도
   * merchant를 쓰지 않아 직접 기록한 지출은 영원히 이 칸이 비지만, 엑셀 가져오기로 들어온
   * 행은 값을 갖고 서버도 왕복시킨다. 열을 지우면 이미 내보낸 CSV들과 헤더가 어긋나므로
   * 지우지 않는다 -- 이 테스트가 그 결정을 고정한다.
   */
  it("라운드 48 T3: 판매처 열은 (아직 입력 UI가 없어도) 헤더에 남아 있고, 값이 있으면 그대로 실린다", () => {
    expect(EXPENSE_CSV_HEADER.split(",")).toContain("판매처");
    expect(expenseToCsvRow(makeExpense({ merchant: "맘마마트" }))).toContain(",맘마마트,");
  });

  it("라운드 48 T3(C1): 결제수단 열이 사용자가 고른 값을 그대로 내보낸다", () => {
    expect(expenseToCsvRow(makeExpense({ paymentMethod: "card" }))).toBe(
      "2026-08-01,지출,기저귀,기저귀 대형,,카드,45900,,직접 입력"
    );
    expect(expenseToCsvRow(makeExpense({ paymentMethod: "transfer" }))).toContain(",계좌 이체,");
    expect(expenseToCsvRow(makeExpense({ paymentMethod: "mobile_pay" }))).toContain(",모바일 결제,");
    expect(expenseToCsvRow(makeExpense({ paymentMethod: "cash" }))).toContain(",현금,");
  });

  it("라운드 48 T3(C1): 결제수단 라벨은 지출 상세 행과 같은 모듈에서 나온다 (앱과 파일의 단어가 갈리지 않도록)", () => {
    // src/expenses/expense-detail-rows.ts가 단일 소스 -- 상세 화면은 행으로, CSV는 열로 쓴다
    // (CSV-127이 구분 열에서 세운 것과 같은 규칙).
    expect(paymentMethodLabelKo("transfer")).toBe("계좌 이체");
    expect(expenseToCsvRow(makeExpense({ paymentMethod: "transfer" }))).toContain(paymentMethodLabelKo("transfer")!);
  });

  it("라운드 48 T3(C1): 고르지 않은 결제 수단은 빈 칸이다 ('알 수 없음'을 지어내지 않는다)", () => {
    for (const empty of [undefined, null, "unknown" as const]) {
      expect(expenseToCsvRow(makeExpense({ paymentMethod: empty }))).toBe(
        "2026-08-01,지출,기저귀,기저귀 대형,,,45900,,직접 입력"
      );
    }
    // 모르는 값은 '카드' 따위로 둔갑시키지 않고 원본을 통과시킨다(sourceLabelKo와 같은 관례).
    expect(expenseToCsvRow(makeExpense({ paymentMethod: "crypto" as Expense["paymentMethod"] }))).toContain(",crypto,");
  });

  it("CSV-127: 구분 열이 지출/선물/환불을 나눈다 -- 예전에는 세 가지가 한 덩어리로 나갔다", () => {
    expect(expenseToCsvRow(makeExpense({ expenseType: "expense" }))).toContain(",지출,");
    expect(expenseToCsvRow(makeExpense({ expenseType: "gift" }))).toContain(",선물,");
    expect(expenseToCsvRow(makeExpense({ expenseType: "refund" }))).toContain(",환불,");
  });

  it("CSV-127: 구분 라벨은 기록 탭 행 부제와 같은 모듈에서 나온다 (앱과 파일의 단어가 갈리지 않도록)", () => {
    // src/expenses/records-list-view.ts가 단일 소스 -- 화면은 접두사로, CSV는 열로 쓴다.
    expect(expenseTypeLabelKo("gift")).toBe("선물");
    expect(expenseTypeLabelKo("refund")).toBe("환불");
    expect(recordsRowSubtitle({ expenseType: "gift", categoryLabel: "기저귀", dateLabel: "8월 4일" })).toContain("선물");
    expect(expenseToCsvRow(makeExpense({ expenseType: "gift" }))).toContain(expenseTypeLabelKo("gift"));
  });

  it("CSV-127: 모르는 구분은 '지출'로 둔갑시키지 않고 원본을 통과시킨다 (sourceLabelKo와 같은 관례)", () => {
    const row = expenseToCsvRow(makeExpense({ expenseType: "future_type" as Expense["expenseType"] }));
    expect(row).toContain(",future_type,");
    expect(row).not.toContain(",지출,");
  });

  it("DNC-015: 선물 행은 CSV에서도 구분이 되므로, 합계를 다시 계산하는 사람이 같은 결론에 도달한다", () => {
    const { csv } = buildExpenseCsv([
      makeExpense({ id: "e-1", amountKrw: 10000, expenseType: "expense" }),
      makeExpense({ id: "e-2", amountKrw: 90000, expenseType: "gift" })
    ]);
    const rows = csv.replace(UTF8_BOM, "").split("\r\n").filter(Boolean).slice(1);
    expect(rows).toHaveLength(2);
    // 선물 행을 걸러내면 앱이 보여주는 합계(10,000원)와 같은 수가 나온다.
    const expenseOnly = rows.filter((row) => row.split(",")[1] === "지출");
    expect(expenseOnly).toHaveLength(1);
    expect(expenseOnly[0]).toContain(",10000,");
  });

  it("caps rows at EXPORT_MAX_ROWS (5000 default) and reports truncation for the UI toast", () => {
    expect(EXPORT_MAX_ROWS).toBe(5000);
    const expenses = [makeExpense({ itemName: "one" }), makeExpense({ itemName: "two" }), makeExpense({ itemName: "three" })];

    const capped = buildExpenseCsv(expenses, { maxRows: 2 });
    expect(capped.rowCount).toBe(2);
    expect(capped.truncated).toBe(true);
    expect(capped.csv).toContain("two");
    expect(capped.csv).not.toContain("three");
    // Truncation is surfaced out-of-band (toast), never as a fake CSV "comment" record.
    expect(capped.csv.replace(UTF8_BOM, "").split("\r\n").filter(Boolean)).toHaveLength(3); // header + 2 rows

    const uncapped = buildExpenseCsv(expenses);
    expect(uncapped.rowCount).toBe(3);
    expect(uncapped.truncated).toBe(false);
  });
});
