import type { Prisma } from "@prisma/client";

export const requiredLegalDocumentTypes = ["terms", "privacy"] as const;

type LegalDb = Pick<Prisma.TransactionClient, "legalDocument">;

export function legalDocumentLocale() {
  return process.env.NODE_ENV === "test" ? "ko-KR-test" : "ko-KR";
}

export function isUsableLegalDocument(document: {
  locale: string;
  placeholder: boolean;
  version: string;
  bodyMarkdown: string;
  publicUrl: string | null;
  contentHash: string;
  effectiveAt: Date;
  publishedAt: Date | null;
  retiredAt: Date | null;
  approvedAt: Date | null;
}, now = new Date()) {
  if (document.placeholder || !document.publishedAt || document.publishedAt > now || document.effectiveAt > now) return false;
  if (document.retiredAt && document.retiredAt <= now) return false;
  if (document.locale !== "ko-KR-test" && !document.approvedAt) return false;
  if (!document.version.trim() || !/^[a-f0-9]{64}$/.test(document.contentHash)) return false;
  const hasBody = document.bodyMarkdown.trim().length > 0;
  const hasApprovedUrl = (() => {
    if (!document.publicUrl) return false;
    try {
      const url = new URL(document.publicUrl);
      const hostname = url.hostname.toLowerCase().replace(/\.$/, "");
      const placeholderOrLocalHost =
        hostname === "localhost" ||
        hostname === "::1" ||
        hostname === "[::1]" ||
        hostname.startsWith("127.") ||
        hostname.startsWith("10.") ||
        hostname.startsWith("192.168.") ||
        hostname.startsWith("169.254.") ||
        /^172\.(1[6-9]|2\d|3[01])\./.test(hostname) ||
        [".localhost", ".test", ".example", ".invalid"].some((suffix) => hostname.endsWith(suffix)) ||
        ["example.com", "example.org", "example.net"].some(
          (reserved) => hostname === reserved || hostname.endsWith(`.${reserved}`)
        );
      return url.protocol === "https:" && !placeholderOrLocalHost;
    } catch {
      return false;
    }
  })();
  return hasBody || hasApprovedUrl;
}

export async function findCurrentLegalDocuments(db: LegalDb, locale: string, now = new Date()) {
  const documents = await db.legalDocument.findMany({
    where: {
      locale,
      placeholder: false,
      ...(locale === "ko-KR-test" ? {} : { approvedAt: { not: null } }),
      effectiveAt: { lte: now },
      publishedAt: { lte: now },
      OR: [{ retiredAt: null }, { retiredAt: { gt: now } }]
    },
    orderBy: [{ documentType: "asc" }, { effectiveAt: "desc" }, { version: "desc" }]
  });
  const currentByType = new Map<string, (typeof documents)[number]>();
  for (const document of documents) {
    if (!currentByType.has(document.documentType) && isUsableLegalDocument(document, now)) {
      currentByType.set(document.documentType, document);
    }
  }
  return [...currentByType.values()];
}
