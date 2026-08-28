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
 *
 * ## GAP-056 #9 — 잘림에는 두 종류가 있고, 잘리는 쪽이 서로 다르다
 *
 * 예전에는 둘을 `truncated` 한 개로 뭉쳐 "(용량 제한으로 일부만 포함됐어요)" 한 문장만 냈다.
 * 실제로 일어나는 일은 둘이다:
 *
 *  1. **행 상한**(EXPORT_MAX_ROWS, export-range.ts의 수집 단계) — GAP-056 #9 이후 네 구간이
 *     모두 최신 달부터 모으므로 빠지는 것은 언제나 **오래된 기록**이다.
 *  2. **공유 본문 용량 제한**(capCsvForShare, 위) — 본문을 헤더부터 앞으로 채우는데 수집기가
 *     돌려주는 목록은 날짜 **오름차순**이라(export-range.ts의 `sortBySpentOnAscending`),
 *     빠지는 것은 뒤쪽 = **최근 기록**이다.
 *
 * 방향이 정반대라 "일부만 포함됐어요" 한 문장으로는 사용자가 무엇을 잃었는지 알 수 없다. 그래서
 * **두 문장 모두** 잘린 쪽을 직접 말한다(라운드 56 B 잔여). 다만 **세기는 다르다**(라운드 57 QA
 * P2-12): 용량 제한은 이 모듈이 직접 버린 행을 세므로 "빠졌어요"라고 단정할 수 있고, 행 상한은
 * 수집기가 "열어 보지 못한 과거 달이 남았다"까지 함께 담는 플래그라 "빠졌을 수 있어요"까지만 말한다. 예전 용량 제한 문구("용량 제한으로
 * 일부만 포함됐어요")는 거짓은 아니었지만, 바로 옆에 붙는 행 상한 문장이 "오래된 기록부터"라고
 * 말하는 탓에 같은 괄호 안의 침묵이 "그럼 이쪽도 오래된 쪽이겠거니"로 읽혔다 — 실제로는 정반대
 * 끝이 빠진, 즉 방금 적은 기록이 빠진 파일이다. 두 문장은 함께 붙을 수 있으므로 각자 자기 원인과
 * 자기 방향을 한 번씩만 말한다.
 */
export function csvShareToastMessage(input: {
  /** OS가 공유 완료 여부를 알려 주는가(iOS만 true). */
  outcomeKnown: boolean;
  /** 공유 본문에 실제로 담긴 행 수. */
  rowCount: number;
  /** 공유 본문 용량 제한으로 잘렸는가 — 빠지는 것은 뒤쪽(최근) 행이다. */
  truncated: boolean;
  /**
   * 행 상한 때문에 오래된 행이 빠졌**을 수 있는가** (GAP-056 #9 / 라운드 57 QA P2-12).
   *
   * 값의 출처는 `collectExpensesForRange`의 `truncated`이고, 그 플래그는 "실제로 버렸다"와
   * "상한 때문에 멈춰 열어 보지 못한 과거 달이 남았다"를 함께 뜻한다 — 그래서 문구도 단정하지
   * 않는다(그 판정 규칙과 근거는 export-range.ts의 `truncated` 주석이 단일 소스다).
   */
  rowCapTruncated?: boolean;
}): string {
  const base = input.outcomeKnown
    ? `기록 ${input.rowCount}건을 내보냈어요.`
    : `기록 ${input.rowCount}건으로 공유 화면을 열었어요.`;
  const notes: string[] = [];
  // 라운드 57 QA(P2-12): 행 상한 쪽은 **"빠졌을 수 있어요"**다. 수집기의 `truncated`는 "행을
  // 실제로 버렸다" 또는 "상한 때문에 멈춘 시점에 아직 열어 보지 않은 과거 달이 남았다"를 함께
  // 뜻하고, 뒤쪽 경우의 남은 달들이 전부 비어 있었다면 실제로 빠진 행은 없다(수집기가 그것을 알
  // 방법은 그 달들을 다 받아 보는 것뿐인데, 그러면 상한을 둔 이유가 사라진다). 그러니 문장도 딱
  // 아는 만큼만 말한다 — 방향은 확실하므로(오래된 쪽) 그건 그대로 단언한다.
  if (input.rowCapTruncated) notes.push("행 상한에 닿아 오래된 기록이 빠졌을 수 있어요");
  // 용량 제한 쪽은 이 모듈이 **직접 버린 행**을 세어 정한다(droppedRows > 0) -- 관측한 사실이라
  // 단정형 그대로다.
  if (input.truncated) notes.push("용량 제한으로 최근 기록부터 빠졌어요");
  return notes.length > 0 ? `${base} (${notes.join(" · ")})` : base;
}
