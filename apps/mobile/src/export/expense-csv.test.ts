import { describe, expect, it } from "vitest";
import type { Expense } from "../api/client";
import { categoryCatalog } from "../categories";
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
    expect(csv).toBe(`${UTF8_BOM}날짜,카테고리,항목,금액(원),메모,출처\r\n`);
    expect(EXPENSE_CSV_HEADER).toBe("날짜,카테고리,항목,금액(원),메모,출처");
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
    expect(row).toBe(`2026-08-01,기저귀,"물티슈, 대용량",45900,"아기 ""선물""용\n두 줄 메모",직접 입력`);
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
    expect(expenseToCsvRow(makeExpense({ memo: null }))).toBe("2026-08-01,기저귀,기저귀 대형,45900,,직접 입력");
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
