import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

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
    const documents = await this.prisma.legalDocument.findMany({
      where: {
        locale,
        effectiveAt: { lte: now },
        publishedAt: { lte: now },
        OR: [{ retiredAt: null }, { retiredAt: { gt: now } }]
      },
      orderBy: [{ documentType: "asc" }, { effectiveAt: "desc" }, { version: "desc" }]
    });
    const currentByType = new Map<string, (typeof documents)[number]>();
    for (const document of documents) {
      if (!currentByType.has(document.documentType)) currentByType.set(document.documentType, document);
    }
    return { documents: [...currentByType.values()].map(toDto) };
  }

  async byTypeAndVersion(documentType: string, version: string, locale = "ko-KR") {
    const document = await this.prisma.legalDocument.findUnique({
      where: { documentType_locale_version: { documentType, locale, version } }
    });
    if (!document || !document.publishedAt) {
      throw new NotFoundException({ code: "LEGAL_DOCUMENT_NOT_FOUND", message: "법적 문서를 찾을 수 없어요." });
    }
    return toDto(document);
  }
}
