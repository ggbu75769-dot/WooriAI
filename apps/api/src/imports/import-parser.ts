import ExcelJS from "exceljs";
import iconv from "iconv-lite";
import { BadRequestException } from "@nestjs/common";
import { isValidCalendarDate } from "@wooriai/domain";

export type ParsedImportRow = {
  rowIndex: number;
  dateIso: string | null;
  itemName: string | null;
  amountKrw: number | null;
  memo: string | null;
  categoryCode: string | null;
  confidence: number;
};

export type ParseImportFileResult = {
  rows: ParsedImportRow[];
  fileType: "csv" | "xlsx";
};

export type ParseImportFileOptions = {
  referenceYear?: number;
  maxRows?: number;
};

const DEFAULT_MAX_ROWS = 2000;
const MAX_CELL_LENGTH = 500;

type ColumnMap = {
  dateIdx: number;
  amountIdx: number;
  itemIdx: number;
  memoIdx: number;
};

const HEADER_KEYWORDS = {
  date: ["날짜", "일자", "거래일", "이용일", "사용일", "결제일", "일시"],
  amount: ["금액", "출금액", "출금", "사용금액", "결제금액", "이용금액", "승인금액", "지출금액"],
  item: ["내용", "적요", "가맹점명", "가맹점", "상품명", "품목", "거래내용", "이용가맹점"],
  memo: ["메모", "비고", "설명"]
};

// Keyword -> seeded category code (see prisma/seed-data.ts's `categorySeeds`, the
// locked 12-category list). Order matters only in that the first matching entry
// wins; keywords across entries are chosen to avoid realistic overlap.
const CATEGORY_KEYWORDS: Array<{ code: string; keywords: string[] }> = [
  { code: "diaper_hygiene", keywords: ["기저귀", "물티슈", "위생", "밴드", "로션"] },
  { code: "feeding_babyfood", keywords: ["분유", "이유식", "젖병", "수유", "모유", "베이비푸드", "우유"] },
  { code: "clothes_laundry", keywords: ["의류", "내복", "우주복", "세탁", "유아복", "아기옷"] },
  { code: "hospital_checkup", keywords: ["병원", "소아과", "진료", "검사", "예방접종", "약국", "처방"] },
  { code: "toys_books", keywords: ["장난감", "완구", "동화책", "도서", "교구"] },
  { code: "outing_mobility", keywords: ["유모차", "카시트", "기저귀가방", "외출용품"] },
  { code: "sleep_furniture", keywords: ["침대", "가구", "범퍼", "이불", "매트리스"] },
  { code: "birth_postpartum", keywords: ["조리원", "산후", "출산용품"] },
  { code: "pregnancy_mother", keywords: ["임신", "산모", "엽산", "영양제"] },
  { code: "care_education", keywords: ["돌봄", "교육비", "어린이집", "놀이학교"] },
  { code: "insurance_savings", keywords: ["보험", "저축", "적금"] }
];

const DANGEROUS_LEADING_CHARS = new Set(["=", "+", "-", "@", "\t", "\r"]);

/**
 * Parses an uploaded import file (CSV or XLSX) buffer into normalized row
 * candidates. Pure/DB-free: callers (OnboardingStoreService) resolve
 * `categoryCode` to a real `categories.id`, run duplicate detection against
 * existing expenses, and persist. Throws BadRequestException with
 * IMPORT_FILE_INVALID / IMPORT_TOO_MANY_ROWS on unreadable files or files that
 * exceed the row cap, so callers don't need to re-validate those cases.
 */
export async function parseImportFile(
  buffer: Buffer,
  fileName: string,
  options: ParseImportFileOptions = {}
): Promise<ParseImportFileResult> {
  const extension = fileName.split(".").pop()?.toLowerCase();
  const maxRows = options.maxRows ?? DEFAULT_MAX_ROWS;
  const referenceYear = options.referenceYear ?? new Date().getUTCFullYear();

  const fileType: "csv" | "xlsx" = extension === "xlsx" ? "xlsx" : "csv";
  const grid = fileType === "xlsx" ? await parseXlsxGrid(buffer) : parseCsvGrid(buffer);

  if (grid.length === 0) {
    throw new BadRequestException({ code: "IMPORT_FILE_INVALID", message: "가져올 데이터를 찾을 수 없어요." });
  }

  const header = detectHeaderColumns(grid[0]);
  const dataRows = header ? grid.slice(1) : grid;
  const columns = header ?? inferColumns(dataRows.slice(0, Math.min(5, dataRows.length)));

  const nonBlankRows = dataRows.filter((cells) => cells.some((cell) => cell.trim() !== ""));

  if (nonBlankRows.length > maxRows) {
    throw new BadRequestException({ code: "IMPORT_TOO_MANY_ROWS", message: "Import files can include up to 2,000 rows." });
  }

  const rows = nonBlankRows.map((cells, index) => toParsedRow(cells, index, columns, referenceYear));

  return { rows, fileType };
}

function toParsedRow(cells: string[], rowIndex: number, columns: ColumnMap, referenceYear: number): ParsedImportRow {
  const dateRaw = columns.dateIdx >= 0 ? (cells[columns.dateIdx] ?? "") : "";
  const amountRaw = columns.amountIdx >= 0 ? (cells[columns.amountIdx] ?? "") : "";
  const itemRaw = columns.itemIdx >= 0 ? (cells[columns.itemIdx] ?? "") : "";
  const memoRaw = columns.memoIdx >= 0 ? (cells[columns.memoIdx] ?? "") : "";

  const dateIso = dateRaw.trim() ? parseDateToIso(dateRaw, referenceYear) : null;
  const amountKrw = amountRaw.trim() ? parseAmount(amountRaw) : null;
  const itemName = itemRaw.trim() ? sanitizeText(itemRaw.trim()) : null;
  const memo = memoRaw.trim() ? sanitizeText(memoRaw.trim()) : null;
  const categoryCode = matchCategory(itemName);
  const confidence = computeConfidence(Boolean(dateIso), amountKrw !== null, Boolean(itemName), Boolean(categoryCode));

  return { rowIndex, dateIso, itemName, amountKrw, memo, categoryCode, confidence };
}

// ---------------------------------------------------------------------------
// CSV
// ---------------------------------------------------------------------------

function parseCsvGrid(buffer: Buffer): string[][] {
  const text = decodeCsvBuffer(buffer);
  return tokenizeCsv(text);
}

function decodeCsvBuffer(buffer: Buffer): string {
  let bytes = buffer;
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    bytes = bytes.subarray(3);
  }

  const utf8Text = bytes.toString("utf8");
  if (!utf8Text.includes("�")) {
    return utf8Text;
  }

  // UTF-8 decode produced replacement characters -> likely CP949/EUC-KR bytes.
  try {
    const decoded = iconv.decode(bytes, "cp949");
    return decoded;
  } catch {
    return utf8Text;
  }
}

function tokenizeCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let sawAnyContent = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      sawAnyContent = true;
      continue;
    }
    if (char === ",") {
      row.push(field);
      field = "";
      sawAnyContent = true;
      continue;
    }
    if (char === "\r") {
      continue;
    }
    if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      continue;
    }
    field += char;
    sawAnyContent = true;
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  if (!sawAnyContent) {
    return [];
  }

  return rows;
}

// ---------------------------------------------------------------------------
// XLSX
// ---------------------------------------------------------------------------

async function parseXlsxGrid(buffer: Buffer): Promise<string[][]> {
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  } catch {
    throw new BadRequestException({ code: "IMPORT_FILE_INVALID", message: "엑셀 파일을 읽을 수 없어요." });
  }

  const sheet = workbook.worksheets[0];
  if (!sheet) {
    throw new BadRequestException({ code: "IMPORT_FILE_INVALID", message: "엑셀 파일에 시트가 없어요." });
  }

  const rows: string[][] = [];
  sheet.eachRow({ includeEmpty: false }, (row) => {
    const cells: string[] = [];
    let maxCol = 0;
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      maxCol = Math.max(maxCol, colNumber);
    });
    for (let col = 1; col <= maxCol; col++) {
      cells.push(cellToText(row.getCell(col)));
    }
    rows.push(cells);
  });

  return rows;
}

function cellToText(cell: ExcelJS.Cell): string {
  const value = cell.value;
  if (value == null) return "";
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === "object") {
    const asRecord = value as unknown as Record<string, unknown>;
    if ("result" in asRecord) return String(asRecord.result ?? "");
    if (Array.isArray(asRecord.richText)) {
      return (asRecord.richText as Array<{ text?: string }>).map((part) => part.text ?? "").join("");
    }
    if ("text" in asRecord) return String(asRecord.text ?? "");
    return "";
  }
  return String(value);
}

// ---------------------------------------------------------------------------
// column detection
// ---------------------------------------------------------------------------

function detectHeaderColumns(headerRow: string[]): ColumnMap | null {
  const map: Partial<ColumnMap> = {};
  headerRow.forEach((cell, idx) => {
    const text = cell.trim();
    if (!text) return;
    if (map.dateIdx === undefined && HEADER_KEYWORDS.date.some((k) => text.includes(k))) {
      map.dateIdx = idx;
    } else if (map.amountIdx === undefined && HEADER_KEYWORDS.amount.some((k) => text.includes(k))) {
      map.amountIdx = idx;
    } else if (map.itemIdx === undefined && HEADER_KEYWORDS.item.some((k) => text.includes(k))) {
      map.itemIdx = idx;
    } else if (map.memoIdx === undefined && HEADER_KEYWORDS.memo.some((k) => text.includes(k))) {
      map.memoIdx = idx;
    }
  });

  if (map.dateIdx === undefined && map.amountIdx === undefined && map.itemIdx === undefined) {
    return null;
  }

  return {
    dateIdx: map.dateIdx ?? -1,
    amountIdx: map.amountIdx ?? -1,
    itemIdx: map.itemIdx ?? -1,
    memoIdx: map.memoIdx ?? -1
  };
}

function inferColumns(sampleRows: string[][]): ColumnMap {
  const colCount = sampleRows.reduce((max, row) => Math.max(max, row.length), 0);
  let dateIdx = -1;
  let amountIdx = -1;
  let bestDateHits = 0;
  let bestAmountHits = 0;
  const referenceYear = new Date().getUTCFullYear();

  for (let col = 0; col < colCount; col++) {
    let dateHits = 0;
    let amountHits = 0;
    let nonEmpty = 0;
    for (const row of sampleRows) {
      const cell = (row[col] ?? "").trim();
      if (!cell) continue;
      nonEmpty++;
      if (parseDateToIso(cell, referenceYear)) dateHits++;
      if (parseAmount(cell) !== null) amountHits++;
    }
    if (nonEmpty === 0) continue;
    if (dateHits / nonEmpty > 0.5 && dateHits > bestDateHits) {
      bestDateHits = dateHits;
      dateIdx = col;
    }
  }

  for (let col = 0; col < colCount; col++) {
    if (col === dateIdx) continue;
    let amountHits = 0;
    let nonEmpty = 0;
    for (const row of sampleRows) {
      const cell = (row[col] ?? "").trim();
      if (!cell) continue;
      nonEmpty++;
      if (parseAmount(cell) !== null) amountHits++;
    }
    if (nonEmpty === 0) continue;
    if (amountHits / nonEmpty > 0.5 && amountHits > bestAmountHits) {
      bestAmountHits = amountHits;
      amountIdx = col;
    }
  }

  const remaining = Array.from({ length: colCount }, (_, i) => i).filter((i) => i !== dateIdx && i !== amountIdx);
  const itemIdx = remaining[0] ?? -1;
  const memoIdx = remaining[1] ?? -1;

  return { dateIdx, amountIdx, itemIdx, memoIdx };
}

// ---------------------------------------------------------------------------
// field normalization
// ---------------------------------------------------------------------------

function parseDateToIso(raw: string, referenceYear: number): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const datePart = trimmed.split(/[ T]/)[0];

  let match = datePart.match(/^(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})$/);
  if (match) {
    return isoFrom(Number(match[1]), Number(match[2]), Number(match[3]));
  }

  match = datePart.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (match) {
    return isoFrom(Number(match[1]), Number(match[2]), Number(match[3]));
  }

  match = datePart.match(/^(\d{1,2})[.\-/](\d{1,2})$/);
  if (match) {
    return isoFrom(referenceYear, Number(match[1]), Number(match[2]));
  }

  return null;
}

function isoFrom(year: number, month: number, day: number): string | null {
  if (year < 1000 || year > 9999) return null;
  const iso = `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  return isValidCalendarDate(iso) ? iso : null;
}

function parseAmount(raw: string): number | null {
  let text = raw.trim();
  if (!text) return null;

  let negative = false;
  if (/^\(.*\)$/.test(text)) {
    negative = true;
    text = text.slice(1, -1);
  }

  text = text.replace(/[,\s원₩]/g, "");
  if (text.startsWith("-")) {
    negative = true;
    text = text.slice(1);
  } else if (text.startsWith("+")) {
    text = text.slice(1);
  }

  if (!/^\d+(\.\d+)?$/.test(text)) return null;

  const value = Math.round(Number(text));
  if (!Number.isFinite(value) || value <= 0) return null;
  if (negative) return null;

  return value;
}

function matchCategory(itemName: string | null): string | null {
  if (!itemName) return null;
  for (const { code, keywords } of CATEGORY_KEYWORDS) {
    if (keywords.some((keyword) => itemName.includes(keyword))) {
      return code;
    }
  }
  return null;
}

function computeConfidence(hasDate: boolean, hasAmount: boolean, hasItemName: boolean, categoryMatched: boolean): number {
  if (!hasDate || !hasAmount || !hasItemName) {
    return 0.3;
  }
  let score = 0.92;
  if (!categoryMatched) {
    score -= 0.25;
  }
  score = Math.min(0.97, Math.max(0.3, score));
  return Math.round(score * 1000) / 1000;
}

/**
 * CSV formula injection defense: a cell that opens with `=`, `+`, `-`, `@`, a
 * tab, or a carriage return can be interpreted as a formula by spreadsheet
 * software if this value is later exported/opened in Excel/Sheets. Prefixing
 * with `'` neutralizes it (Excel treats a leading apostrophe as "force text")
 * while preserving the original content for review. Also enforces the
 * 500-char per-cell cap.
 */
function sanitizeText(value: string): string {
  let text = value;
  if (text.length > 0 && DANGEROUS_LEADING_CHARS.has(text[0])) {
    text = `'${text}`;
  }
  return text.slice(0, MAX_CELL_LENGTH);
}
