import { describe, expect, it } from "vitest";
import { redactForLog } from "./redact";

describe("structured log redaction", () => {
  it("redacts nested secrets and PII while preserving operational identifiers", () => {
    expect(redactForLog({
      requestId: "request-1",
      dedupeKey: "dedupe-1",
      accessToken: "secret",
      nested: { email: "person@example.com", itemName: "기저귀", status: 500 }
    })).toEqual({
      requestId: "request-1",
      dedupeKey: "dedupe-1",
      accessToken: "[REDACTED]",
      nested: { email: "[REDACTED]", itemName: "[REDACTED]", status: 500 }
    });
  });
});
