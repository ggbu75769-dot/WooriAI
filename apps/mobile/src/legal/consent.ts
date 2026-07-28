import type { ConsentSelection, LegalDocument } from "../api/client";

const requiredTypes = ["terms", "privacy"] as const;

export type RequiredLegalDocuments = {
  terms: LegalDocument;
  privacy: LegalDocument;
};

export function resolveRequiredLegalDocuments(
  documents: LegalDocument[] | undefined
): RequiredLegalDocuments | null {
  if (!documents) return null;
  const terms = documents.find((document) => document.documentType === "terms");
  const privacy = documents.find((document) => document.documentType === "privacy");
  if (!terms || !privacy || terms.placeholder || privacy.placeholder) return null;
  return { terms, privacy };
}

export function buildConsentSelections(documents: RequiredLegalDocuments): ConsentSelection[] {
  return requiredTypes.map((documentType) => {
    const document = documents[documentType];
    return {
      documentType,
      version: document.version,
      contentHash: document.contentHash,
      accepted: true
    };
  });
}
