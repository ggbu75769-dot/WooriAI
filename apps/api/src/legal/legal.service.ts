import { Inject, Injectable, NotFoundException, ServiceUnavailableException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { findCurrentLegalDocuments, isUsableLegalDocument, requiredLegalDocumentTypes } from "./legal-document-policy";

function toDto(document: {
  id: string;
  documentType: string;
  locale: string;
  version: string;
  title: string;
  bodyMarkdown: string;
  publicUrl: string | null;
  contentHash: string;
  required: boolean;
  placeholder: boolean;
  effectiveAt: Date;
  publishedAt: Date | null;
}) {
  return {
    ...document,
    effectiveAt: document.effectiveAt.toISOString(),
    publishedAt: document.publishedAt?.toISOString() ?? null
  };
}

@Injectable()
export class LegalService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async current(locale = "ko-KR") {
    const now = new Date();
    const documents = await findCurrentLegalDocuments(this.prisma, locale, now);
    const availableTypes = new Set(documents.map((document) => document.documentType));
    if (requiredLegalDocumentTypes.some((type) => !availableTypes.has(type))) {
      throw new ServiceUnavailableException({
        code: "LEGAL_DOCUMENT_UNAVAILABLE",
        message: "현재 필수 법적 문서를 제공할 수 없어요. 잠시 후 다시 시도해 주세요."
      });
    }
    return { documents: documents.map(toDto) };
  }

  async byTypeAndVersion(documentType: string, version: string, locale = "ko-KR") {
    const document = await this.prisma.legalDocument.findUnique({
      where: { documentType_locale_version: { documentType, locale, version } }
    });
    if (!document || !isUsableLegalDocument(document)) {
      throw new NotFoundException({ code: "LEGAL_DOCUMENT_NOT_FOUND", message: "법적 문서를 찾을 수 없어요." });
    }
    return toDto(document);
  }
}
