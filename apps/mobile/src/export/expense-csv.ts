import type { Expense } from "../api/client";
import { categoryNameFor, type CategoryNameLookup } from "../categories";
import { paymentMethodLabelKo } from "../expenses/expense-detail-rows";
import { expenseTypeLabelKo } from "../expenses/records-list-view";

/**
 * EXP-106 데이터 내보내기: pure CSV building for expense rows.
 *
 * Deliberate choices (mirrors the api-side import conventions so round-tripping works):
 * - Header is 날짜,구분,카테고리,항목,판매처,결제수단,금액(원),메모,출처 — 날짜/항목/금액(원)/메모 are the
 *   four columns apps/api/src/imports/import-parser.ts's HEADER_KEYWORDS recognizes (date/item/
 *   amount/memo), so a file we export can be fed straight back into the excel import.
 *
 *   라운드 65 A(#1): 그 문장은 **오랫동안 사실이 아니었다**. `항목`이 서버의 item 키워드에 없어서
 *   (`"항목".includes("품목")`은 거짓이다) 재가져오기의 itemIdx가 -1이 되고, 모든 행이 품목명 없이
 *   들어와 `missing_item_name`으로 잠겼다 — 확정 대상 0건. 고친 쪽은 **서버 키워드**다(이 헤더가
 *   아니라): 이미 사용자 손에 나가 있는 파일들까지 함께 살아나야 하므로, 이 문자열은 **한 글자도
 *   바꾸지 않는다**. 두 사실을 맞대 보는 테스트가 이제 양쪽에 있다 —
 *   apps/api/test/mobile-export-csv-roundtrip.test.ts(이 헤더를 읽어 실제 파서에 먹인다)와
 *   이 파일의 expense-csv.test.ts(서버 키워드 표를 읽어 열별 역할을 못 박는다).
 *
 * - 왕복의 **알려진 한계**: 파서의 `ParsedImportRow`에는 date/item/amount/memo 네 칸뿐이라
 *   구분·카테고리·판매처·결제수단·출처는 재가져오기에서 **버려진다**. 특히 `구분`이 사라지면
 *   선물·환불 행이 전부 지출로 되돌아온다 — CSV-127이 그 열을 더한 이유(DNC-015가 합계에서 빼는
 *   행을 구분할 수 없다)를 우리 가져오기가 되살리는 셈이다. 되살리려면 `import_rows`에 칸을
 *   더하는 스키마 변경과 확정 경로(insertExpense) 변경이 함께 필요해 DNC-012·DNC-015 판단이
 *   선행이므로 라운드 65 A의 범위 밖으로 두고, 그 사실만 위 왕복 테스트가 값으로 고정한다.
 * - CSV-127 added 구분 and 판매처. Both were already on every exported expense (`expenseType`,
 *   `merchant`) and both were silently dropped, so an exported file flattened 지출·선물·환불 into
 *   one indistinguishable list — the 선물 rows that DNC-015 deliberately keeps OUT of the 합계
 *   looked exactly like the rows that are in it, and anyone re-adding the column in a spreadsheet
 *   got a wrong total. Neither new header matches any HEADER_KEYWORDS entry ("판매처" is NOT one
 *   of the item keywords 가맹점/가맹점명/상품명/품목/…), so the import's column detection — and
 *   therefore the round-trip above — is unchanged by their presence.
 * - 구분 labels come from src/expenses/records-list-view.ts, the same module the 기록 탭 행 부제
 *   uses, so a row the user read as "선물" in-app exports as "선물" too.
 * - 라운드 48 T3 added 결제수단 (labels from src/expenses/expense-detail-rows.ts, the same module
 *   the 지출 상세 결제 수단 행 reads, for the same reason 구분 shares its module). The user picks
 *   it on every quick record, so leaving it out of the export dropped a field they had actually
 *   filled in. Placement follows CSV-127's own precedent -- the column sits next to 판매처, the
 *   other "where/how it was bought" field, rather than being tacked onto the end. Column detection
 *   on re-import is by header KEYWORD, not position, so the round-trip above is unchanged:
 *   "결제수단" contains none of the date/amount/item/memo keywords (note "결제일"/"결제금액" ARE
 *   keywords -- "결제수단" contains neither string, which is what keeps it from stealing a column).
 *   `unknown`/absent exports as an empty field, never as "알 수 없음".
 * - 판매처(`merchant`) 열은 라운드 49 C-03까지 **앱이 채울 수 없는 열**이었다: 저장·표시·CSV·API가
 *   전부 이 값을 왕복시키는데 정작 그것을 적을 화면이 하나도 없어서, 앱에서 만든 기록의 이 열은
 *   언제나 비어 있고 값이 있는 행은 엑셀 가져오기로 들어온 것뿐이었다. 이제 빠른 기록 시트
 *   (app/expenses/new.tsx의 판매처 입력칸 -- 세션이 있을 때만 렌더된다, EXP-001 픽셀 락)와
 *   지출 상세의 판매처 입력칸(app/expenses/[expenseId].tsx)이 둘 다 이 값을 쓴다. 구매 확인
 *   카드의 "샀어요"로 들어오는 기록에는 눌린 링크의 플랫폼 이름(쿠팡/네이버)이 미리 채워지고,
 *   사용자가 지우거나 고쳐 쓸 수 있다. 이 파일이 하는 일은 종전과 동일하다 -- 값이 있으면 그
 *   문자열 그대로 내보내고, 없으면 빈 칸이다.
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

export const EXPENSE_CSV_HEADER = "날짜,구분,카테고리,항목,판매처,결제수단,금액(원),메모,출처";

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
 * Column order matches EXPENSE_CSV_HEADER exactly. A missing 판매처 or 결제수단 exports as an empty
 * field -- the same "no invented data" rule the null memo above follows.
 */
export function expenseToCsvRow(expense: Expense, categoryName: CategoryNameLookup = categoryNameFor): string {
  return [
    csvCell(expense.spentOn),
    csvCell(expenseTypeLabelKo(expense.expenseType)),
    csvCell(categoryName(expense.categoryId)),
    csvCell(expense.itemName),
    csvCell(expense.merchant ?? ""),
    csvCell(paymentMethodLabelKo(expense.paymentMethod) ?? ""),
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
