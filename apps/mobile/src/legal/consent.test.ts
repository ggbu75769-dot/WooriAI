import { describe, expect, it } from "vitest";
import type { LegalDocument } from "../api/client";
import { buildConsentSelections, resolveRequiredLegalDocuments } from "./consent";

function document(documentType: LegalDocument["documentType"]): LegalDocument {
  return {
    documentType,
    version: "2026-07-16",
    locale: "ko-KR",
    title: documentType,
    bodyMarkdown: "approved",
    publicUrl: null,
    contentHash: documentType === "terms" ? "a".repeat(64) : "b".repeat(64),
    effectiveAt: "2026-07-16T00:00:00.000Z",
    publishedAt: "2026-07-16T00:00:00.000Z",
    placeholder: false
  };
}

describe("legal consent boundary", () => {
  it("requires both current documents before consent can proceed", () => {
    expect(resolveRequiredLegalDocuments(undefined)).toBeNull();
    expect(resolveRequiredLegalDocuments([document("terms")])).toBeNull();
    expect(resolveRequiredLegalDocuments([document("terms"), document("privacy")])).not.toBeNull();
  });

  it("binds consent to the exact document version and content hash", () => {
    const resolved = resolveRequiredLegalDocuments([document("terms"), document("privacy")]);
    expect(resolved).not.toBeNull();
    expect(buildConsentSelections(resolved!)).toEqual([
      {
        documentType: "terms",
        version: "2026-07-16",
        contentHash: "a".repeat(64),
        accepted: true
      },
      {
        documentType: "privacy",
        version: "2026-07-16",
        contentHash: "b".repeat(64),
        accepted: true
      }
    ]);
  });
});
