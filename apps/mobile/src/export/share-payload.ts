/**
 * EXP-106 데이터 내보내기: pure size-cap logic for handing the CSV to the OS share sheet.
 *
 * Kept free of react-native imports so it runs under vitest (RN has no node binding here);
 * the RN glue lives in src/export/share-csv.ts and is covered by the source-contract test.
 */

/**
 * ~100KB cap on the shared message. The chosen share path is React Native's built-in
 * `Share.share({ message })` (see share-csv.ts for why), and share extensions/intents choke on
 * unbounded text payloads, so the CSV is capped at whole-row boundaries and the drop is
 * surfaced to the caller for a UI toast.
 */
export const MAX_SHARE_MESSAGE_BYTES = 100 * 1024;

/** UTF-8 byte length without TextEncoder (not guaranteed across RN JS engines/test envs). */
export function utf8ByteLength(text: string): number {
  let bytes = 0;
  for (const character of text) {
    const codePoint = character.codePointAt(0)!;
    bytes += codePoint <= 0x7f ? 1 : codePoint <= 0x7ff ? 2 : codePoint <= 0xffff ? 3 : 4;
  }
  return bytes;
}

export type CapCsvResult = {
  /** The (possibly shortened) CSV text to hand to Share.share. */
  message: string;
  /** True when rows were dropped to fit the byte budget. */
  truncated: boolean;
  /** How many data rows were dropped. */
  droppedRows: number;
};

/**
 * Caps a CRLF-terminated CSV (header + data rows) to `maxBytes` of UTF-8 at row boundaries.
 * The header line always survives; rows are kept front-to-back until the budget runs out.
 */
export function capCsvForShare(csv: string, maxBytes: number = MAX_SHARE_MESSAGE_BYTES): CapCsvResult {
  if (utf8ByteLength(csv) <= maxBytes) {
    return { message: csv, truncated: false, droppedRows: 0 };
  }

  const newline = "\r\n";
  const newlineBytes = 2;
  // Trailing CRLF produces one empty trailing segment; drop it, re-append on join.
  const lines = csv.split(newline);
  if (lines[lines.length - 1] === "") lines.pop();

  const keptLines: string[] = [];
  let usedBytes = 0;
  for (const line of lines) {
    const lineBytes = utf8ByteLength(line) + newlineBytes;
    // Always keep the header (first line) even in a pathologically small budget.
    if (keptLines.length > 0 && usedBytes + lineBytes > maxBytes) break;
    keptLines.push(line);
    usedBytes += lineBytes;
  }

  const droppedRows = lines.length - keptLines.length;
  return {
    message: `${keptLines.join(newline)}${newline}`,
    truncated: droppedRows > 0,
    droppedRows
  };
}
