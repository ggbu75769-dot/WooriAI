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

/**
 * 라운드 45 O-8: 공유 시트를 닫은 뒤 띄울 토스트 문구.
 *
 * `Share.dismissedAction`은 iOS 전용이라, Android에서는 사용자가 시트를 그냥 닫아도 결과가
 * `sharedAction`으로 돌아온다(share-csv.ts의 `outcomeKnown` 주석). 그래서 예전 문구
 * "기록 n건을 내보냈어요."는 Android에서 **아무것도 안 보낸 사람에게도** 성공을 단정했다.
 * 아는 만큼만 말한다 — 결과를 아는 iOS는 종전대로 성공을 단정하고, 모르는 Android는 실제로
 * 일어난 사실("공유 화면을 열었어요")만 적는다. 잘림 안내는 어느 쪽이든 사실이라 그대로 붙인다.
 */
export function csvShareToastMessage(input: {
  /** OS가 공유 완료 여부를 알려 주는가(iOS만 true). */
  outcomeKnown: boolean;
  /** 공유 본문에 실제로 담긴 행 수. */
  rowCount: number;
  truncated: boolean;
}): string {
  const base = input.outcomeKnown
    ? `기록 ${input.rowCount}건을 내보냈어요.`
    : `기록 ${input.rowCount}건으로 공유 화면을 열었어요.`;
  return input.truncated ? `${base} (용량 제한으로 일부만 포함됐어요)` : base;
}
