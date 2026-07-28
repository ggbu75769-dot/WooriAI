import { describe, expect, it } from "vitest";
import {
  decodeCursor,
  decodeCursorV2,
  encodeCursor,
  encodeCursorV2,
  InvalidCursorError
} from "../src/sync/cursor";

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

describe("household-scoped sync cursor v2", () => {
  const householdId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

  it("round-trips protocol, household, baseline, and current position", () => {
    const encoded = encodeCursorV2({
      householdId,
      baselineUpdatedAt: new Date("2026-07-24T01:00:00.000Z"),
      baselineId: "expense-9",
      updatedAt: new Date("2026-07-24T00:30:00.000Z"),
      id: "expense-4"
    });

    expect(decodeCursorV2(encoded, householdId)).toMatchObject({
      protocolVersion: 2,
      householdId,
      baselineId: "expense-9",
      id: "expense-4"
    });
  });

  it("rejects a cursor issued for another household", () => {
    const encoded = encodeCursorV2({
      householdId,
      baselineUpdatedAt: new Date("2026-07-24T01:00:00.000Z"),
      baselineId: "expense-9",
      updatedAt: new Date("2026-07-24T01:00:00.000Z"),
      id: "expense-9"
    });
    expect(() =>
      decodeCursorV2(encoded, "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb")
    ).toThrow(InvalidCursorError);
  });

  it("rejects a cursor whose signed payload was changed client-side", () => {
    const encoded = encodeCursorV2({
      householdId,
      baselineUpdatedAt: new Date("2026-07-24T01:00:00.000Z"),
      baselineId: "expense-9",
      updatedAt: new Date("2026-07-24T00:30:00.000Z"),
      id: "expense-4"
    });
    const parsed = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
    parsed.i = "expense-8";
    const tampered = Buffer.from(JSON.stringify(parsed), "utf8").toString("base64url");

    expect(() => decodeCursorV2(tampered, householdId)).toThrow(InvalidCursorError);
  });

  it("rejects a position beyond its immutable baseline", () => {
    const encoded = Buffer.from(
      JSON.stringify({
        v: 2,
        h: householdId,
        bu: "2026-07-24T01:00:00.000Z",
        bi: "expense-9",
        u: "2026-07-24T02:00:00.000Z",
        i: "expense-10"
      }),
      "utf8"
    ).toString("base64url");
    expect(() => decodeCursorV2(encoded, householdId)).toThrow(InvalidCursorError);
  });
});
