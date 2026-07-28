import { BadRequestException } from "@nestjs/common";
import ExcelJS from "exceljs";
import iconv from "iconv-lite";
import { createHash } from "node:crypto";
import type { CatalogDraftImportRowDto } from "./dto/catalog-v2.dto";

const HEADERS = ["code", "nameKo", "shortDescription", "reasonText", "timingSummary", "sourceSummary"] as const;
const HEADER_SET = new Set<string>(HEADERS);
const MAX_ROWS = 1000;
const MAX_COLUMNS = HEADERS.length;
const MAX_CELL_LENGTH = 5000;
const MAX_TOTAL_CHARACTERS = 2_000_000;
const MAX_ZIP_ENTRIES = 200;
const MAX_ZIP_ENTRY_UNCOMPRESSED = 10 * 1024 * 1024;
const MAX_ZIP_TOTAL_UNCOMPRESSED = 20 * 1024 * 1024;
const MAX_ZIP_RATIO = 100;
const FORMULA_PREFIX = /^[=+\-@\t\r]/;

export async function parseCatalogImportFile(buffer: Buffer, originalName: string) {
  const fileName = originalName.split(/[\\/]/).at(-1)?.slice(0, 200) ?? "catalog-import";
  const extension = fileName.split(".").at(-1)?.toLocaleLowerCase();
  if (extension !== "csv" && extension !== "xlsx") {
    throw new BadRequestException({ code: "CATALOG_IMPORT_FILE_TYPE_INVALID", message: "Only CSV and XLSX catalog imports are supported." });
  }
  const grid = extension === "xlsx" ? await parseXlsx(buffer) : parseCsv(buffer);
  const rows = gridToRows(grid);
  return { sourceName: fileName, sourceHash: createHash("sha256").update(buffer).digest("hex"), rows };
}

function gridToRows(grid: string[][]): CatalogDraftImportRowDto[] {
  if (grid.length < 2) throw new BadRequestException({ code: "CATALOG_IMPORT_EMPTY", message: "A header and at least one data row are required." });
  if (grid.length - 1 > MAX_ROWS) throw new BadRequestException({ code: "CATALOG_IMPORT_TOO_MANY_ROWS", message: `Catalog imports support up to ${MAX_ROWS} rows.` });
  const headers = grid[0]!.map((cell) => cell.trim());
  if (headers.length > MAX_COLUMNS || headers.some((header) => !HEADER_SET.has(header)) || new Set(headers).size !== headers.length || !headers.includes("code")) {
    throw new BadRequestException({ code: "CATALOG_IMPORT_HEADER_INVALID", message: `Headers must be unique known fields and include code: ${HEADERS.join(", ")}.` });
  }
  let totalCharacters = 0;
  return grid.slice(1).filter((cells) => cells.some((cell) => cell.trim())).map((cells) => {
    if (cells.length > MAX_COLUMNS) throw new BadRequestException({ code: "CATALOG_IMPORT_TOO_MANY_COLUMNS", message: `Catalog imports support up to ${MAX_COLUMNS} columns.` });
    const row: Record<string, string> = {};
    headers.forEach((header, index) => {
      const value = (cells[index] ?? "").trim();
      totalCharacters += value.length;
      if (value.length > MAX_CELL_LENGTH || totalCharacters > MAX_TOTAL_CHARACTERS) {
        throw new BadRequestException({ code: "CATALOG_IMPORT_CONTENT_TOO_LARGE", message: "Catalog import cell content is too large." });
      }
      if (value && FORMULA_PREFIX.test(value)) {
        throw new BadRequestException({ code: "CATALOG_IMPORT_FORMULA_FORBIDDEN", message: "Spreadsheet formulas and formula-like prefixes are not allowed." });
      }
      if (value) row[header] = value;
    });
    return row as CatalogDraftImportRowDto;
  });
}

function parseCsv(buffer: Buffer) {
  let bytes = buffer;
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) bytes = bytes.subarray(3);
  const utf8 = bytes.toString("utf8");
  const text = utf8.includes("�") ? iconv.decode(bytes, "cp949") : utf8;
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]!;
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') { field += '"'; index += 1; }
      else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"') quoted = true;
    else if (char === ",") { row.push(field); field = ""; }
    else if (char === "\n") { row.push(field); rows.push(row); row = []; field = ""; if (rows.length > MAX_ROWS + 1) break; }
    else if (char !== "\r") field += char;
  }
  if (quoted) throw new BadRequestException({ code: "CATALOG_IMPORT_CSV_INVALID", message: "CSV contains an unterminated quoted field." });
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows;
}

async function parseXlsx(buffer: Buffer) {
  assertSafeXlsxArchive(buffer);
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  } catch {
    throw new BadRequestException({ code: "CATALOG_IMPORT_XLSX_INVALID", message: "The XLSX workbook could not be read." });
  }
  if (workbook.worksheets.length !== 1) throw new BadRequestException({ code: "CATALOG_IMPORT_SHEET_COUNT_INVALID", message: "Catalog XLSX imports must contain exactly one worksheet." });
  const sheet = workbook.worksheets[0]!;
  if (sheet.rowCount > MAX_ROWS + 1 || sheet.columnCount > MAX_COLUMNS) {
    throw new BadRequestException({ code: "CATALOG_IMPORT_DIMENSIONS_INVALID", message: "Catalog XLSX dimensions exceed the row or column limit." });
  }
  const rows: string[][] = [];
  sheet.eachRow({ includeEmpty: false }, (row) => {
    const cells: string[] = [];
    for (let column = 1; column <= row.cellCount; column += 1) {
      const cell = row.getCell(column);
      const value = cell.value;
      if (value && typeof value === "object" && "formula" in (value as object)) {
        throw new BadRequestException({ code: "CATALOG_IMPORT_FORMULA_FORBIDDEN", message: "Spreadsheet formulas are not allowed." });
      }
      if (value == null) cells.push("");
      else if (typeof value === "object" && "richText" in (value as object)) cells.push(((value as { richText: Array<{ text?: string }> }).richText ?? []).map((part) => part.text ?? "").join(""));
      else if (typeof value === "object" && "text" in (value as object)) cells.push(String((value as { text?: unknown }).text ?? ""));
      else cells.push(String(value));
    }
    rows.push(cells);
  });
  return rows;
}

function assertSafeXlsxArchive(buffer: Buffer) {
  let entries = 0;
  let totalCompressed = 0;
  let totalUncompressed = 0;
  for (let offset = 0; offset + 46 <= buffer.length; offset += 1) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) continue;
    entries += 1;
    const compressed = buffer.readUInt32LE(offset + 20);
    const uncompressed = buffer.readUInt32LE(offset + 24);
    if (compressed === 0xffffffff || uncompressed === 0xffffffff) throw new BadRequestException({ code: "CATALOG_IMPORT_ZIP64_FORBIDDEN", message: "ZIP64 XLSX files are not supported." });
    totalCompressed += compressed;
    totalUncompressed += uncompressed;
    if (entries > MAX_ZIP_ENTRIES || uncompressed > MAX_ZIP_ENTRY_UNCOMPRESSED || totalUncompressed > MAX_ZIP_TOTAL_UNCOMPRESSED || (compressed > 0 && uncompressed / compressed > MAX_ZIP_RATIO)) {
      throw new BadRequestException({ code: "CATALOG_IMPORT_ZIP_BOMB", message: "XLSX archive expansion limits were exceeded." });
    }
    const fileNameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    offset += 45 + fileNameLength + extraLength + commentLength;
  }
  if (entries === 0 || totalCompressed === 0) throw new BadRequestException({ code: "CATALOG_IMPORT_XLSX_INVALID", message: "The XLSX archive directory is missing." });
}
