import type { Expense } from "../api/client";
import { categoryNameFor, type CategoryNameLookup } from "../categories";
import { expenseTypeLabelKo } from "../expenses/records-list-view";

/**
 * EXP-106 데이터 내보내기: pure CSV building for expense rows.
 *
 * Deliberate choices (mirrors the api-side import conventions so round-tripping works):
 * - Header is 날짜,구분,카테고리,항목,판매처,금액(원),메모,출처 — the 날짜/금액/메모 keywords are
 *   ones apps/api/src/imports/import-parser.ts's HEADER_KEYWORDS already recognizes, so a file we
 *   export can be fed straight back into the excel import.
 * - CSV-127 added 구분 and 판매처. Both were already on every exported expense (`expenseType`,
 *   `merchant`) and both were silently dropped, so an exported file flattened 지출·선물·환불 into
 *   one indistinguishable list — the 선물 rows that DNC-015 deliberately keeps OUT of the 합계
 *   looked exactly like the rows that are in it, and anyone re-adding the column in a spreadsheet
 *   got a wrong total. Neither new header matches any HEADER_KEYWORDS entry ("판매처" is NOT one
 *   of the item keywords 가맹점/가맹점명/상품명/품목/…), so the import's column detection — and
 *   therefore the round-trip above — is unchanged by their presence.
 * - 구분 labels come from src/expenses/records-list-view.ts, the same module the 기록 탭 행 부제
 *   uses, so a row the user read as "선물" in-app exports as "선물" too.
 * - 금액(원) is the raw integer `amountKrw` (e.g. "45900"), NOT src/money.ts's formatted
 *   "45,900원" — formatted amounts would both break re-import and confuse spreadsheet math.
 * - Category labels come from src/categories.ts, the same mapping the records/reports screens
 *   render, so the CSV matches what the user sees in-app. Callers with a session pass the
 *   server's `GET /categories` list through `buildCategoryNameLookup` (app/(tabs)/more.tsx) so
 *   the 12 canonical seed categories -- whose ids are random per database -- get their real
 *   names; `categoryNameFor` stays the default/fallback for everything else.
 * - RFC 4180: fields containing `"`, `,`, CR or LF are wrapped in double quotes with inner
 *   quotes doubled; records are CRLF-terminated for Excel compatibility.
 * - UTF-8 BOM prefix so Excel (Windows) detects the encoding and Korean renders correctly.
 * - Formula-injection guard: cells whose first character is in DANGEROUS_LEADING_CHARS get a
 *   leading single quote — the exact convention used by the api's import parser (see
 *   `DANGEROUS_LEADING_CHARS` in apps/api/src/imports/import-parser.ts).
 */

export const EXPENSE_CSV_HEADER = "날짜,구분,카테고리,항목,판매처,금액(원),메모,출처";

export const UTF8_BOM = "\uFEFF";

/** Hard cap on exported rows; callers surface truncation in the UI (toast), never in the CSV. */
export const EXPORT_MAX_ROWS = 5000;

// Same set as apps/api/src/imports/import-parser.ts's DANGEROUS_LEADING_CHARS.
const DANGEROUS_LEADING_CHARS = new Set(["=", "+", "-", "@", "\t", "\r"]);

/** Korean labels for `Expense.source`; unknown values pass through unchanged. */
export function sourceLabelKo(source: Expense["source"] | string): string {
  switch (source) {
    case "manual":
      return "직접 입력";
    case "excel_import":
      return "엑셀 가져오기";
    case "purchase_followup":
      return "구매 연동";
    case "admin":
      return "관리자";
    default:
      return String(source);
  }
}

/** Formula-injection guard: prefix dangerous leading characters with a single quote. */
export function sanitizeCsvCell(value: string): string {
  if (value.length > 0 && DANGEROUS_LEADING_CHARS.has(value[0])) {
    return `'${value}`;
  }
  return value;
}

/** RFC 4180 quoting: wrap in quotes when the field contains a quote, comma, CR or LF. */
export function escapeCsvField(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replaceAll('"', '""')}"`;
  }
  return value;
}

function csvCell(value: string): string {
  return escapeCsvField(sanitizeCsvCell(value));
}

/**
 * One CRLF-free CSV record (no trailing line break) for a single expense.
 * `categoryName` defaults to the static `categoryNameFor` mapping; pass a server-backed lookup
 * (see `buildCategoryNameLookup`) to resolve the per-database canonical category ids.
 *
 * Column order matches EXPENSE_CSV_HEADER exactly. A missing 판매처 exports as an empty field --
 * the same "no invented data" rule the null memo above follows.
 */
export function expenseToCsvRow(expense: Expense, categoryName: CategoryNameLookup = categoryNameFor): string {
  return [
    csvCell(expense.spentOn),
    csvCell(expenseTypeLabelKo(expense.expenseType)),
    csvCell(categoryName(expense.categoryId)),
    csvCell(expense.itemName),
    csvCell(expense.merchant ?? ""),
    csvCell(String(expense.amountKrw)),
    csvCell(expense.memo ?? ""),
    csvCell(sourceLabelKo(expense.source))
  ].join(",");
}

export type BuildExpenseCsvResult = {
  /** BOM-prefixed, CRLF-terminated CSV text. */
  csv: string;
  /** Number of expense rows actually written (excludes the header). */
  rowCount: number;
  /** True when `maxRows` cut off some expenses — surface this in the UI. */
  truncated: boolean;
};

export function buildExpenseCsv(
  expenses: Expense[],
  options: { maxRows?: number; categoryName?: CategoryNameLookup } = {}
): BuildExpenseCsvResult {
  const maxRows = options.maxRows ?? EXPORT_MAX_ROWS;
  const categoryName = options.categoryName ?? categoryNameFor;
  const included = expenses.slice(0, maxRows);
  const lines = [EXPENSE_CSV_HEADER, ...included.map((expense) => expenseToCsvRow(expense, categoryName))];
  return {
    csv: `${UTF8_BOM}${lines.join("\r\n")}\r\n`,
    rowCount: included.length,
    truncated: expenses.length > included.length
  };
}
