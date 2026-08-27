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

  /**
   * R24-M2: 구조는 멀쩡하지만 `id`가 UUID가 아닌 커서. 종전에는 빈 문자열만 걸러서
   * 이런 값이 그대로 `expenses.id`(@db.Uuid) 술어에 들어갔고, Prisma 드라이버가
   * 던지는 예외는 GlobalExceptionFilter에서 500으로 나갔다 — 사용자 입력이 원인인데
   * 서버 오류로 보이는 셈이다. 이제 디코더에서 InvalidCursorError로 잡아
   * 400 SYNC_CURSOR_INVALID가 되게 한다.
   */
  it("rejects a structurally valid payload whose id is not a UUID (would 500 in Prisma otherwise)", () => {
    const iso = "2026-07-06T03:04:05.123Z";
    for (const badId of [
      "not-a-uuid",
      "12345",
      // 하이픈 위치가 다른 32자리 hex — Postgres uuid 리터럴로도 이 모양은 받지 않는다.
      "aaaaaaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaa",
      // 한 글자 모자란 UUID.
      "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa",
      // 16진이 아닌 문자가 섞인 UUID 모양.
      "zzzzzzzz-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
    ]) {
      const malformed = Buffer.from(`${iso}|${badId}`, "utf8").toString("base64");
      expect(() => decodeCursor(malformed), badId).toThrow(InvalidCursorError);
    }
  });

  it("accepts an uppercase UUID id (Postgres uuid is case-insensitive)", () => {
    const iso = "2026-07-06T03:04:05.123Z";
    const upper = "AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA";
    const decoded = decodeCursor(Buffer.from(`${iso}|${upper}`, "utf8").toString("base64"));
    expect(decoded.id).toBe(upper);
  });

  /**
   * R24-L4: 인코더는 `toISOString()`(UTC 밀리초 3자리)만 만든다. sub-ms 정밀도가
   * 담긴 커서는 인코더가 만들 수 없는 값이므로 손상 커서로 본다 — 조용히 받아들이면
   * `new Date()`가 마이크로초를 잘라 내림된 커서가 되고, 그 경계에 걸친 행이
   * `updated_at > 커서` 술어에서 빠져 동기화가 한 건을 영영 흘릴 수 있다.
   */
  it("rejects a cursor carrying sub-millisecond precision the encoder can never produce", () => {
    const id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    for (const isoDate of [
      "2026-07-06T03:04:05.123456Z", // 마이크로초
      "2026-07-06T03:04:05.1234Z", // 0.1ms
      "2026-07-06T03:04:05Z", // 밀리초 생략 (인코더가 만들지 않는 모양)
      "2026-07-06T03:04:05.123+00:00" // 오프셋 표기 (인코더는 항상 Z)
    ]) {
      const malformed = Buffer.from(`${isoDate}|${id}`, "utf8").toString("base64");
      expect(() => decodeCursor(malformed), isoDate).toThrow(InvalidCursorError);
    }
  });

  it("still round-trips every cursor the encoder itself produces", () => {
    // 위 두 검증이 정상 커서를 하나도 막지 않는지 — 인코더 출력만이 유일한 정상 입력이다.
    const id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    for (const iso of ["2026-07-06T03:04:05.000Z", "2026-07-06T03:04:05.123Z", "2024-01-01T00:00:00.001Z"]) {
      const decoded = decodeCursor(encodeCursor({ updatedAt: new Date(iso), id }));
      expect(decoded.updatedAt.toISOString()).toBe(iso);
      expect(decoded.id).toBe(id);
    }
  });
});
