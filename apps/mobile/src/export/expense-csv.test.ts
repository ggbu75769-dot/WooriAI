import { describe, expect, it } from "vitest";
import type { Expense } from "../api/client";
import { buildCategoryNameLookup, categoryCatalog } from "../categories";
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
    expect(csv).toBe(`${UTF8_BOM}날짜,구분,카테고리,항목,판매처,금액(원),메모,출처\r\n`);
    expect(EXPENSE_CSV_HEADER).toBe("날짜,구분,카테고리,항목,판매처,금액(원),메모,출처");
  });

  it("CSV-127: 헤더는 8열이고, 재가져오기가 의존하는 날짜/금액/메모 키워드가 그대로 남는다", () => {
    const columns = EXPENSE_CSV_HEADER.split(",");
    expect(columns).toHaveLength(8);
    // apps/api/src/imports/import-parser.ts의 HEADER_KEYWORDS가 알아보는 열 -- 내보낸 파일을
    // 그대로 다시 엑셀 가져오기에 넣을 수 있어야 한다는 EXP-106의 계약.
    expect(columns).toContain("날짜");
    expect(columns).toContain("금액(원)");
    expect(columns).toContain("메모");
    // 새 두 열은 그 키워드 중 어느 것과도 겹치지 않는다(겹치면 가져오기가 엉뚱한 열을 집는다).
    // 특히 "판매처"는 item 키워드(가맹점/가맹점명/상품명/품목/내용/적요/거래내용/이용가맹점)가 아니다.
    for (const importKeyword of ["날짜", "일자", "거래일", "금액", "출금", "메모", "비고", "설명", "가맹점", "상품명", "품목", "내용", "적요"]) {
      expect(`구분`.includes(importKeyword), `구분 vs ${importKeyword}`).toBe(false);
      expect(`판매처`.includes(importKeyword), `판매처 vs ${importKeyword}`).toBe(false);
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
    expect(row).toBe(`2026-08-01,지출,기저귀,"물티슈, 대용량",,45900,"아기 ""선물""용\n두 줄 메모",직접 입력`);

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
    expect(expenseToCsvRow(makeExpense({ memo: null }))).toBe("2026-08-01,지출,기저귀,기저귀 대형,,45900,,직접 입력");
  });

  it("CSV-127: 판매처가 없으면 빈 칸이다 (없는 상호를 지어내지 않는다)", () => {
    expect(expenseToCsvRow(makeExpense({ merchant: null }))).toBe("2026-08-01,지출,기저귀,기저귀 대형,,45900,,직접 입력");
    expect(expenseToCsvRow(makeExpense({ merchant: undefined }))).toBe("2026-08-01,지출,기저귀,기저귀 대형,,45900,,직접 입력");
    expect(expenseToCsvRow(makeExpense({ merchant: "쿠팡" }))).toBe("2026-08-01,지출,기저귀,기저귀 대형,쿠팡,45900,,직접 입력");
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
