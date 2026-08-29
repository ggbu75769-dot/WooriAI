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

/**
 * 열 인식 키워드. 판정은 `text.includes(k)`이고 else-if 사슬이라 **먼저 나오는 열이
 * 이긴다**(detectHeaderColumns).
 *
 * 라운드 65 A(#1) — item에 `"항목"`이 없었다. 이 앱이 스스로 내보내는 CSV의 품목명 열
 * 머리글이 정확히 `항목`인데(`apps/mobile/src/export/expense-csv.ts`의
 * `EXPENSE_CSV_HEADER`), `"항목".includes(k)`는 여덟 키워드 모두에서 거짓이었다
 * (`품목`과 `항목`은 다른 글자다). 그래서 우리가 내보낸 파일을 그대로 다시 올리면
 * itemIdx가 -1이 되어 **모든 행의 품목명이 비고**, 파이프라인이 전 행을
 * `missing_item_name`으로 떨어뜨려 확정 대상이 0건이 됐다 — 화면은 "원본 파일에서 고친
 * 뒤 다시 올려 주세요"라고 말하는데 그 원본이 이 앱이 만든 파일이었다.
 *
 * 고치는 쪽을 **키워드로 정한 이유**: 내보내기 머리글을 `품목`으로 바꾸면 이미 사용자
 * 손에 나가 있는 파일들은 여전히 못 읽는다. 키워드를 넓히면 과거 파일까지 함께 살아난다.
 *
 * 라운드 65 후속(#2) — **`항목`은 폴백 키워드다(주석 정정).** 라운드 65 A(#1)는 부작용을
 * "먼저 나오는 열이 이기니 종전과 같다"고 적었지만, 그 문장이 곧 결함이었다: 은행/가계부
 * 양식에서 `항목`은 **분류 열**의 머리글로 흔히 쓰이고(`날짜 | 항목 | 적요 | 금액`), 열 순서상
 * `항목`이 `적요`보다 앞에 오므로 종전에 `적요`가 가져가던 품목 열을 **분류 열이 빼앗았다** —
 * 모든 행의 품목명이 "식비"·"생활" 같은 분류 이름으로 들어온다. 이 앱이 만든 파일을 살리려다
 * 남의 파일을 망가뜨리는 교환이라 받아들일 수 없다.
 *
 * 그래서 `항목`만 `itemFallback`으로 내린다: **구체어(`item`)가 헤더에 하나도 없을 때만**
 * 품목 열이 된다. 우리 내보내기 CSV의 헤더 아홉 열
 * (`날짜,구분,카테고리,항목,판매처,결제수단,금액(원),메모,출처` —
 * `apps/mobile/src/export/expense-csv.ts`의 `EXPENSE_CSV_HEADER`를 그대로 옮긴 것이다.
 * 라운드 66 F 정정: 종전 주석은 여섯 열짜리 목록을 인용하고 있었다 — 결론은 그대로 옳지만
 * 그 문장으로 열 수를 세면 어긋난다)에는 구체어가 하나도 없으므로
 * A(#1)이 살린 왕복은 그대로 살아 있고, 두 후보가 함께 있는 파일은 라운드 65 이전과
 * **한 글자도 다르지 않게** 동작한다. 열 순서 규칙(먼저 나오는 열이 이긴다)은 같은 등급 안에서
 * 종전 그대로다.
 *
 * 왕복 계약은 `test/mobile-export-csv-roundtrip.test.ts`가 고정하고(모바일의 헤더 상수를
 * 그대로 읽어 이 파서에 먹인다), 두 후보 공존 케이스는
 * `test/import-parser-inference.test.ts`가 고정한다.
 */
const HEADER_KEYWORDS = {
  date: ["날짜", "일자", "거래일", "이용일", "사용일", "결제일", "일시"],
  amount: ["금액", "출금액", "출금", "사용금액", "결제금액", "이용금액", "승인금액", "지출금액"],
  /** 품목 열의 **구체어**. 하나라도 헤더에 있으면 그 등급 안에서 먼저 나오는 열이 이긴다. */
  item: ["내용", "적요", "가맹점명", "가맹점", "상품명", "품목", "거래내용", "이용가맹점"],
  /** 품목 열의 **폴백어**. 위 구체어가 헤더에 하나도 없을 때만 품목 열로 쓴다. */
  itemFallback: ["항목"],
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

// ---------------------------------------------------------------------------
// API-130: 확장자 위장 방어 (매직바이트 검사)
// ---------------------------------------------------------------------------

/** xlsx는 zip 컨테이너(OOXML) — 로컬 파일 헤더 시그니처로 시작한다. */
const ZIP_LOCAL_FILE_HEADER = Buffer.from([0x50, 0x4b, 0x03, 0x04]); // "PK\x03\x04"

/**
 * csv 자리에 올 수 없는 것이 명백한 바이너리 컨테이너 시그니처들. 여기 없는
 * 바이너리는 아래 널바이트 검사가 대부분 걸러낸다.
 */
const BINARY_SIGNATURES: Array<{ label: string; bytes: Buffer }> = [
  { label: "zip/xlsx", bytes: ZIP_LOCAL_FILE_HEADER },
  { label: "zip(empty)", bytes: Buffer.from([0x50, 0x4b, 0x05, 0x06]) },
  { label: "xls(OLE2)", bytes: Buffer.from([0xd0, 0xcf, 0x11, 0xe0]) },
  { label: "pdf", bytes: Buffer.from("%PDF-", "ascii") },
  { label: "png", bytes: Buffer.from([0x89, 0x50, 0x4e, 0x47]) },
  { label: "jpeg", bytes: Buffer.from([0xff, 0xd8, 0xff]) },
  { label: "gif", bytes: Buffer.from("GIF8", "ascii") },
  { label: "gzip", bytes: Buffer.from([0x1f, 0x8b]) }
];

function fileTypeFromName(fileName: string): "csv" | "xlsx" {
  return fileName.split(".").pop()?.toLowerCase() === "xlsx" ? "xlsx" : "csv";
}

/**
 * API-130: 업로드 파일의 형식을 **확장자 대신 실제 바이트**로 확인한다.
 *
 * 왜 필요한가: 지금까지 형식 판정은 파일명 확장자뿐이었다. `.xlsx`로 이름만
 * 바꾼 임의의 바이너리는 exceljs가 zip을 열다 실패해야 비로소 걸러졌고,
 * `.csv`로 이름만 바꾼 바이너리는 CP949 폴백 디코딩까지 통과해 쓰레기 행으로
 * 파싱될 수 있었다.
 *
 * 규칙(느슨하게, 명백한 불일치만):
 *  - xlsx: zip 로컬 파일 헤더 `PK\x03\x04`로 시작해야 한다. (OOXML은 항상 zip)
 *  - csv:  널바이트(0x00)가 없어야 하고, 알려진 바이너리 시그니처로 시작하지
 *          않아야 한다.
 *
 * csv에 **UTF-8 유효성은 요구하지 않는다** — 이 파서는 은행/카드사 내보내기의
 * CP949(EUC-KR) csv를 명시적으로 지원하고(decodeCsvBuffer), CP949 바이트열은
 * UTF-8로 유효하지 않기 때문이다. 널바이트 부재만으로도 UTF-16/실행파일/압축
 * 파일 같은 실제 위장 사례는 걸러진다.
 *
 * 형식 불일치는 확장자 화이트리스트와 같은 오류 코드(IMPORT_FILE_TYPE_INVALID)로
 * 400을 던진다 — 사용자에게는 "지원하지 않는 파일" 하나의 사실이기 때문.
 */
export function assertImportFileMatchesExtension(buffer: Buffer, fileName: string): void {
  const fileType = fileTypeFromName(fileName);

  if (fileType === "xlsx") {
    if (!buffer.subarray(0, ZIP_LOCAL_FILE_HEADER.length).equals(ZIP_LOCAL_FILE_HEADER)) {
      throw new BadRequestException({
        code: "IMPORT_FILE_TYPE_INVALID",
        message: "Only csv or xlsx files are allowed."
      });
    }
    return;
  }

  const disguised =
    buffer.includes(0) ||
    BINARY_SIGNATURES.some(({ bytes }) => buffer.subarray(0, bytes.length).equals(bytes));
  if (disguised) {
    throw new BadRequestException({
      code: "IMPORT_FILE_TYPE_INVALID",
      message: "Only csv or xlsx files are allowed."
    });
  }
}

/**
 * Parses an uploaded import file (CSV or XLSX) buffer into normalized row
 * candidates. Pure/DB-free: callers (ImportPipelineService) resolve
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
  const maxRows = options.maxRows ?? DEFAULT_MAX_ROWS;
  const referenceYear = options.referenceYear ?? new Date().getUTCFullYear();

  const fileType = fileTypeFromName(fileName);
  const grid = fileType === "xlsx" ? await parseXlsxGrid(buffer, maxRows) : parseCsvGrid(buffer);

  if (grid.length === 0) {
    throw new BadRequestException({ code: "IMPORT_FILE_INVALID", message: "가져올 데이터를 찾을 수 없어요." });
  }

  const header = detectHeaderColumns(grid[0]);
  const dataRows = header ? grid.slice(1) : grid;
  const columns = header ?? inferColumns(dataRows.slice(0, Math.min(5, dataRows.length)), referenceYear);

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

async function parseXlsxGrid(buffer: Buffer, maxRows: number): Promise<string[][]> {
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

  // 압축 폭탄 방어: 고압축 xlsx는 10MB 업로드 제한을 통과하고도 수십만 행으로
  // 팽창할 수 있다. 행 축적을 상한(헤더 여유분 +1)에서 즉시 중단해 메모리 고갈을 막는다.
  const rowCap = maxRows + 1;
  if (sheet.rowCount > rowCap) {
    throw new BadRequestException({ code: "IMPORT_TOO_MANY_ROWS", message: "Import files can include up to 2,000 rows." });
  }

  const rows: string[][] = [];
  let truncated = false;
  sheet.eachRow({ includeEmpty: false }, (row) => {
    if (rows.length >= rowCap) {
      truncated = true;
      return;
    }
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

  if (truncated) {
    throw new BadRequestException({ code: "IMPORT_TOO_MANY_ROWS", message: "Import files can include up to 2,000 rows." });
  }

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
  /**
   * 라운드 65 후속(#2): 폴백어(`항목`)는 **구체어가 헤더에 하나도 없을 때만** 품목 열이 된다.
   * 판정에 필요한 것은 헤더 전체를 한 번 훑은 사실 하나뿐이라, 아래 열 순회 규칙(먼저 나오는
   * 열이 이긴다)은 그대로 두고 이 술어만 갈아 끼운다.
   */
  const hasSpecificItemHeader = headerRow.some((cell) => {
    const text = cell.trim();
    return text !== "" && HEADER_KEYWORDS.item.some((k) => text.includes(k));
  });
  const matchesItemHeader = (text: string) =>
    HEADER_KEYWORDS.item.some((k) => text.includes(k)) ||
    (!hasSpecificItemHeader && HEADER_KEYWORDS.itemFallback.some((k) => text.includes(k)));

  headerRow.forEach((cell, idx) => {
    const text = cell.trim();
    if (!text) return;
    if (map.dateIdx === undefined && HEADER_KEYWORDS.date.some((k) => text.includes(k))) {
      map.dateIdx = idx;
    } else if (map.amountIdx === undefined && HEADER_KEYWORDS.amount.some((k) => text.includes(k))) {
      map.amountIdx = idx;
    } else if (map.itemIdx === undefined && matchesItemHeader(text)) {
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

/** 전형적 금액대 하한: 실제 은행/가계부 내보내기의 KRW 금액은 최소 수백 원대. */
const TYPICAL_AMOUNT_MEDIAN_MIN = 100;

type AmountCandidate = {
  col: number;
  hits: number;
  /** 중앙값이 전형적 금액대(≥100)인지 — 수량열(1~9)과 금액열 구분의 1차 신호. */
  typicalMagnitude: boolean;
  /** 파싱된 값들의 자릿수 종류 수 — 실제 금액은 자릿수가 다양하고 수량은 균일한 경향. */
  digitLengthVariety: number;
};

/**
 * FIX-IMPORT-INFER(관찰 1): hits만으로는 수량열(1~3 등)과 실제 금액열을 구분할 수
 * 없다(둘 다 전 행에서 금액으로 파싱됨). hits가 동률이거나 유사(±1 — 환불/공란
 * 한 행 차이)하면 열 위치 대신 값의 모양으로 타이브레이크한다:
 * 중앙값 크기(전형적 금액대 ≥ 100) 우선, 다음으로 자릿수 다양성.
 * hits 차이가 1을 넘으면 종전대로 hits가 많은 쪽이 이긴다.
 */
function isBetterAmountCandidate(candidate: AmountCandidate, best: AmountCandidate): boolean {
  if (Math.abs(candidate.hits - best.hits) > 1) return candidate.hits > best.hits;
  if (candidate.typicalMagnitude !== best.typicalMagnitude) return candidate.typicalMagnitude;
  if (candidate.digitLengthVariety !== best.digitLengthVariety) {
    return candidate.digitLengthVariety > best.digitLengthVariety;
  }
  // 모양까지 같으면 hits가 많은 쪽, 그것도 같으면 기존 후보(왼쪽 열) 유지.
  return candidate.hits > best.hits;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function inferColumns(sampleRows: string[][], referenceYear: number): ColumnMap {
  const colCount = sampleRows.reduce((max, row) => Math.max(max, row.length), 0);
  let dateIdx = -1;
  let bestDateHits = 0;

  for (let col = 0; col < colCount; col++) {
    let dateHits = 0;
    let nonEmpty = 0;
    for (const row of sampleRows) {
      const cell = (row[col] ?? "").trim();
      if (!cell) continue;
      nonEmpty++;
      // FIX-IMPORT-INFER(관찰 3): 감지도 파싱과 동일한 referenceYear를 사용
      // (기본값은 parseImportFile에서 현재 연도로 동일하게 채워짐).
      if (parseDateToIso(cell, referenceYear)) dateHits++;
    }
    if (nonEmpty === 0) continue;
    if (dateHits / nonEmpty > 0.5 && dateHits > bestDateHits) {
      bestDateHits = dateHits;
      dateIdx = col;
    }
  }

  let bestAmount: AmountCandidate | null = null;
  for (let col = 0; col < colCount; col++) {
    if (col === dateIdx) continue;
    const values: number[] = [];
    let nonEmpty = 0;
    for (const row of sampleRows) {
      const cell = (row[col] ?? "").trim();
      if (!cell) continue;
      nonEmpty++;
      const amount = parseAmount(cell);
      if (amount !== null) values.push(amount);
    }
    if (nonEmpty === 0 || values.length / nonEmpty <= 0.5) continue;
    const candidate: AmountCandidate = {
      col,
      hits: values.length,
      typicalMagnitude: median(values) >= TYPICAL_AMOUNT_MEDIAN_MIN,
      digitLengthVariety: new Set(values.map((value) => String(value).length)).size
    };
    if (bestAmount === null || isBetterAmountCandidate(candidate, bestAmount)) {
      bestAmount = candidate;
    }
  }
  const amountIdx = bestAmount?.col ?? -1;

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
