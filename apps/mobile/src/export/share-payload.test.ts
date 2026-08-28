import { describe, expect, it } from "vitest";
import { capCsvForShare, csvShareToastMessage, MAX_SHARE_MESSAGE_BYTES, utf8ByteLength } from "./share-payload";

describe("EXP-106 share payload cap (Share.share message path)", () => {
  it("measures UTF-8 bytes correctly for ASCII, Korean, and astral characters", () => {
    expect(utf8ByteLength("abc")).toBe(3);
    expect(utf8ByteLength("날짜")).toBe(6); // Hangul syllables: 3 bytes each
    expect(utf8ByteLength("👶")).toBe(4); // astral plane: 4 bytes
    expect(utf8ByteLength("")).toBe(0);
  });

  it("defaults to a ~100KB budget", () => {
    expect(MAX_SHARE_MESSAGE_BYTES).toBe(102400);
  });

  it("returns small CSVs untouched", () => {
    const csv = "날짜,금액\r\n2026-08-01,1000\r\n";
    expect(capCsvForShare(csv)).toEqual({ message: csv, truncated: false, droppedRows: 0 });
  });

  it("truncates at whole-row boundaries, always keeping the header", () => {
    const header = "날짜,금액";
    const rows = ["2026-08-01,1000", "2026-08-02,2000", "2026-08-03,3000"];
    const csv = `${header}\r\n${rows.join("\r\n")}\r\n`;
    // Budget fits header + first row only.
    const budget = utf8ByteLength(header) + 2 + utf8ByteLength(rows[0]) + 2;
    const result = capCsvForShare(csv, budget);
    expect(result.message).toBe(`${header}\r\n${rows[0]}\r\n`);
    expect(result.truncated).toBe(true);
    expect(result.droppedRows).toBe(2);
    expect(utf8ByteLength(result.message)).toBeLessThanOrEqual(budget);
  });

  it("keeps the header even when the budget is smaller than the header itself", () => {
    const csv = "날짜,카테고리,항목,금액(원),메모,출처\r\nrow-1\r\n";
    const result = capCsvForShare(csv, 4);
    expect(result.message).toBe("날짜,카테고리,항목,금액(원),메모,출처\r\n");
    expect(result.truncated).toBe(true);
    expect(result.droppedRows).toBe(1);
  });
});

/**
 * GAP-056 #9 — 잘림 안내가 **어느 쪽이 잘렸는지** 말한다.
 *
 * 잘림에는 두 종류가 있고 잘리는 쪽이 정반대다: 행 상한은 최신 달부터 모으므로 오래된 기록이
 * 빠지고(export-range.ts), 공유 본문 용량 제한은 앞에서부터 채우므로 최근 기록이 빠진다
 * (위 capCsvForShare). 예전에는 둘을 한 플래그로 뭉쳐 "일부만 포함됐어요"만 말했다.
 */
describe("GAP-056 #9 CSV 토스트의 잘림 문구", () => {
  it("행 상한으로 잘리면 오래된 쪽이 빠졌다고 말한다", () => {
    expect(csvShareToastMessage({ outcomeKnown: true, rowCount: 5000, truncated: false, rowCapTruncated: true })).toBe(
      "기록 5000건을 내보냈어요. (행 상한을 넘어 오래된 기록부터 빠졌어요)"
    );
  });

  it("용량 제한 문구는 종전 그대로다 (원인을 이미 짚고 있는 문장이라 새로 짓지 않는다)", () => {
    expect(csvShareToastMessage({ outcomeKnown: false, rowCount: 3, truncated: true })).toBe(
      "기록 3건으로 공유 화면을 열었어요. (용량 제한으로 일부만 포함됐어요)"
    );
    // rowCapTruncated를 명시적으로 false로 넘겨도 같은 문장이다(기본값 = 안 잘림).
    expect(csvShareToastMessage({ outcomeKnown: false, rowCount: 3, truncated: true, rowCapTruncated: false })).toBe(
      "기록 3건으로 공유 화면을 열었어요. (용량 제한으로 일부만 포함됐어요)"
    );
  });

  it("두 잘림이 함께 일어나면 두 사실을 모두 적는다", () => {
    expect(csvShareToastMessage({ outcomeKnown: true, rowCount: 4000, truncated: true, rowCapTruncated: true })).toBe(
      "기록 4000건을 내보냈어요. (행 상한을 넘어 오래된 기록부터 빠졌어요 · 용량 제한으로 일부만 포함됐어요)"
    );
  });

  it("잘리지 않았으면 괄호 안내가 아예 붙지 않는다", () => {
    expect(csvShareToastMessage({ outcomeKnown: true, rowCount: 12, truncated: false, rowCapTruncated: false })).toBe(
      "기록 12건을 내보냈어요."
    );
  });
});
