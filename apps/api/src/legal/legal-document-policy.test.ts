import { describe, expect, it } from "vitest";
import { isUsableLegalDocument } from "./legal-document-policy";

const now = new Date("2026-07-16T00:00:00.000Z");
const validDocument = {
  locale: "ko-KR",
  placeholder: false,
  version: "2026-07-16",
  bodyMarkdown: "# Terms",
  publicUrl: null,
  contentHash: "a".repeat(64),
  effectiveAt: new Date("2026-07-15T00:00:00.000Z"),
  publishedAt: new Date("2026-07-15T00:00:00.000Z"),
  retiredAt: null,
  approvedAt: new Date("2026-07-15T00:00:00.000Z")
};

describe("legal current-document policy", () => {
  it("fails closed for placeholders, future publication/effective dates, retired documents, and invalid hashes", () => {
    expect(isUsableLegalDocument({ ...validDocument, placeholder: true }, now)).toBe(false);
    expect(
      isUsableLegalDocument(
        { ...validDocument, publishedAt: new Date("2026-07-17T00:00:00.000Z") },
        now
      )
    ).toBe(false);
    expect(
      isUsableLegalDocument(
        { ...validDocument, effectiveAt: new Date("2026-07-17T00:00:00.000Z") },
        now
      )
    ).toBe(false);
    expect(
      isUsableLegalDocument(
        { ...validDocument, retiredAt: new Date("2026-07-16T00:00:00.000Z") },
        now
      )
    ).toBe(false);
    expect(isUsableLegalDocument({ ...validDocument, contentHash: "not-a-hash" }, now)).toBe(false);
    expect(isUsableLegalDocument({ ...validDocument, approvedAt: null }, now)).toBe(false);
    expect(isUsableLegalDocument({ ...validDocument, locale: "ko-KR-test", approvedAt: null }, now)).toBe(true);
  });

  it("requires approved content or a non-placeholder HTTPS URL", () => {
    expect(isUsableLegalDocument(validDocument, now)).toBe(true);
    expect(
      isUsableLegalDocument(
        { ...validDocument, bodyMarkdown: "", publicUrl: "https://www.wooriai.kr/terms" },
        now
      )
    ).toBe(true);
    expect(
      isUsableLegalDocument(
        { ...validDocument, bodyMarkdown: "", publicUrl: "https://example.com/terms" },
        now
      )
    ).toBe(false);
    expect(
      isUsableLegalDocument(
        { ...validDocument, bodyMarkdown: "", publicUrl: "http://legal.wooriai.example/terms" },
        now
      )
    ).toBe(false);
    expect(
      isUsableLegalDocument(
        { ...validDocument, bodyMarkdown: "", publicUrl: "https://legal.wooriai.example/terms" },
        now
      )
    ).toBe(false);
  });
});
