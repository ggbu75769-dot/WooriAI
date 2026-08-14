// COM-107-prep: CSV parsing for the admin bulk affiliate-link replacement tool.
// Mirrors src/imports/import-parser.ts's safe-CSV conventions (quoted-field
// tokenizer, formula-injection neutralization, per-cell length cap) without
// importing it: that parser is column-inference-based for bank exports, while
// this one is a strict named-header parser owned by the admin module.

import { BadRequestException } from "@nestjs/common";

export const BULK_CSV_MAX_ROWS = 500;
const MAX_CELL_LENGTH = 500;

// COM-107: the affiliateUrl column must NOT be silently truncated — a >500-char
// URL whose 500-char prefix is still well-formed and allowlisted would
// otherwise validate as "valid" and bulk-apply would write the corrupted URL.
// The full value is kept here and length-validated by the service instead
// (BULK_ROW_URL_TOO_LONG, see product-link-bulk.service.ts). The overall
// request body is already bounded (AdminProductLinkBulkCsvDto MaxLength), so
// keeping full cells is memory-safe.
const UNTRUNCATED_COLUMNS: ReadonlySet<BulkCsvColumn> = new Set(["affiliateUrl"]);

/**
 * CSV formula injection defense (same policy as import-parser.ts): a cell
 * opening with `=`, `+`, `-`, `@`, a tab, or a carriage return could be
 * interpreted as a formula if the value is later exported to Excel/Sheets.
 * Prefixing with `'` forces text while preserving the content.
 */
const DANGEROUS_LEADING_CHARS = new Set(["=", "+", "-", "@", "\t", "\r"]);

export function sanitizeCsvCell(value: string, maxLength: number = MAX_CELL_LENGTH): string {
  let text = value;
  if (text.length > 0 && DANGEROUS_LEADING_CHARS.has(text[0])) {
    text = `'${text}`;
  }
  return text.slice(0, maxLength);
}

/** Canonical column keys for the bulk-replace CSV template. */
export type BulkCsvColumn = "productLinkId" | "itemTemplate" | "platform" | "affiliateUrl" | "priceSnapshotKrw";

/** Accepted header spellings (lowercased) -> canonical column key. */
const HEADER_ALIASES: Record<string, BulkCsvColumn> = {
  productlinkid: "productLinkId",
  itemtemplate: "itemTemplate",
  itemtemplatecode: "itemTemplate",
  itemtemplatename: "itemTemplate",
  platform: "platform",
  affiliateurl: "affiliateUrl",
  pricesnapshotkrw: "priceSnapshotKrw"
};

export type BulkCsvRow = {
  /** 1-based CSV line number; line 1 is the header row. */
  lineNumber: number;
  cells: Partial<Record<BulkCsvColumn, string>>;
};

/**
 * Parses bulk-replace CSV content into named-column rows. Throws
 * BadRequestException (ADMIN_BULK_* codes, matching the global error envelope)
 * on structurally unusable input: empty content, a header row that lacks
 * `affiliateUrl` or any identifier column, or more than BULK_CSV_MAX_ROWS data
 * rows. Blank data lines are skipped. Per-row semantic validation (URL shape,
 * allowlist, target resolution) is the service's job.
 */
export function parseBulkCsv(csv: string): BulkCsvRow[] {
  const grid = tokenizeCsv(csv);
  if (grid.length === 0) {
    throw new BadRequestException({ code: "ADMIN_BULK_CSV_REQUIRED", message: "CSV 내용을 입력해 주세요." });
  }

  const header = grid[0].map((cell) => cell.trim().toLowerCase().replace(/["\s]/g, ""));
  const columnByIndex = new Map<number, BulkCsvColumn>();
  for (let i = 0; i < header.length; i++) {
    const canonical = HEADER_ALIASES[header[i]];
    if (canonical && ![...columnByIndex.values()].includes(canonical)) {
      columnByIndex.set(i, canonical);
    }
  }

  const columns = new Set(columnByIndex.values());
  if (!columns.has("affiliateUrl") || (!columns.has("productLinkId") && !columns.has("itemTemplate"))) {
    throw new BadRequestException({
      code: "ADMIN_BULK_CSV_HEADER_INVALID",
      message: "CSV 헤더에 affiliateUrl 열과 productLinkId 또는 itemTemplate 열이 필요해요."
    });
  }

  const rows: BulkCsvRow[] = [];
  for (let lineIndex = 1; lineIndex < grid.length; lineIndex++) {
    const rawCells = grid[lineIndex];
    if (rawCells.every((cell) => cell.trim() === "")) {
      continue;
    }
    const cells: Partial<Record<BulkCsvColumn, string>> = {};
    for (const [columnIndex, column] of columnByIndex) {
      const raw = (rawCells[columnIndex] ?? "").trim();
      const value = UNTRUNCATED_COLUMNS.has(column)
        ? sanitizeCsvCell(raw, Number.POSITIVE_INFINITY)
        : sanitizeCsvCell(raw);
      if (value) {
        cells[column] = value;
      }
    }
    rows.push({ lineNumber: lineIndex + 1, cells });
  }

  if (rows.length === 0) {
    throw new BadRequestException({ code: "ADMIN_BULK_CSV_REQUIRED", message: "CSV에 데이터 행이 없어요." });
  }
  if (rows.length > BULK_CSV_MAX_ROWS) {
    throw new BadRequestException({
      code: "ADMIN_BULK_TOO_MANY_ROWS",
      message: `CSV는 한 번에 최대 ${BULK_CSV_MAX_ROWS}행까지 처리할 수 있어요.`
    });
  }

  return rows;
}

/** RFC-4180-style tokenizer: quoted fields, `""` escapes, CRLF/LF endings. */
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

  return sawAnyContent ? rows : [];
}
