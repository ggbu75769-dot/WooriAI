import { describe, expect, it } from "vitest";
import { decodeCursor, encodeCursor, InvalidCursorError } from "../src/sync/cursor";

describe("sync cursor encode/decode", () => {
  it("round-trips an (updatedAt, id) pair through base64", () => {
    const updatedAt = new Date("2026-07-06T03:04:05.123Z");
    const id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

    const cursor = encodeCursor({ updatedAt, id });
    expect(typeof cursor).toBe("string");
    // Opaque: not directly readable as the raw "iso|id" string.
    expect(cursor).not.toContain(id);

    const decoded = decodeCursor(cursor);
    expect(decoded.id).toBe(id);
    expect(decoded.updatedAt.toISOString()).toBe(updatedAt.toISOString());
  });

  it("preserves millisecond precision so no two distinct instants collide", () => {
    const a = encodeCursor({ updatedAt: new Date("2026-07-06T03:04:05.001Z"), id: "x" });
    const b = encodeCursor({ updatedAt: new Date("2026-07-06T03:04:05.002Z"), id: "x" });
    expect(a).not.toBe(b);
  });

  it("rejects garbage input instead of silently returning an invalid date", () => {
    expect(() => decodeCursor("not-valid-base64!!!")).toThrow(InvalidCursorError);
  });

  it("rejects a validly-base64 payload missing the separator", () => {
    const malformed = Buffer.from("no-separator-here", "utf8").toString("base64");
    expect(() => decodeCursor(malformed)).toThrow(InvalidCursorError);
  });

  it("rejects a payload with an unparsable date component", () => {
    const malformed = Buffer.from("not-a-date|some-id", "utf8").toString("base64");
    expect(() => decodeCursor(malformed)).toThrow(InvalidCursorError);
  });

  it("rejects a payload with an empty id component", () => {
    const malformed = Buffer.from(`${new Date().toISOString()}|`, "utf8").toString("base64");
    expect(() => decodeCursor(malformed)).toThrow(InvalidCursorError);
  });
});
