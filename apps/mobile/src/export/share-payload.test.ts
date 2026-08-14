import { describe, expect, it } from "vitest";
import { capCsvForShare, MAX_SHARE_MESSAGE_BYTES, utf8ByteLength } from "./share-payload";

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
