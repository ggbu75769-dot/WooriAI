import { Inject, Injectable } from "@nestjs/common";
import type { ProductLink } from "@prisma/client";
import { PRODUCT_PLATFORMS, type ProductPlatform } from "@wooriai/domain";
import { isAllowedAffiliateUrl } from "../items-commerce/affiliate-link-guard.util";
import { PrismaService } from "../prisma/prisma.service";
import { parseBulkCsv, type BulkCsvRow } from "./product-link-bulk-csv.util";

export type BulkRowErrorCode =
  | "BULK_ROW_IDENTIFIER_MISSING"
  | "BULK_ROW_PLATFORM_INVALID"
  | "BULK_ROW_LINK_NOT_FOUND"
  | "BULK_ROW_LINK_AMBIGUOUS"
  | "BULK_ROW_DUPLICATE_TARGET"
  | "BULK_ROW_URL_INVALID"
  | "BULK_ROW_DOMAIN_NOT_ALLOWED"
  | "BULK_ROW_PRICE_INVALID";

const ROW_ERROR_MESSAGES: Record<BulkRowErrorCode, string> = {
  BULK_ROW_IDENTIFIER_MISSING: "productLinkId 또는 itemTemplate과 platform을 입력해 주세요.",
  BULK_ROW_PLATFORM_INVALID: "platform은 coupang, naver, custom 중 하나여야 해요.",
  BULK_ROW_LINK_NOT_FOUND: "대상 상품 링크를 찾을 수 없어요.",
  BULK_ROW_LINK_AMBIGUOUS: "조건에 맞는 상품 링크가 여러 개예요. productLinkId로 지정해 주세요.",
  BULK_ROW_DUPLICATE_TARGET: "같은 상품 링크를 대상으로 하는 행이 이미 있어요.",
  BULK_ROW_URL_INVALID: "affiliateUrl은 https:// 로 시작하는 올바른 URL이어야 해요.",
  BULK_ROW_DOMAIN_NOT_ALLOWED: "허용된 제휴 도메인이 아니에요.",
  BULK_ROW_PRICE_INVALID: "priceSnapshotKrw는 0 이상의 정수여야 해요."
};

export type BulkPreviewRow = {
  /** 1-based CSV line number (line 1 is the header row). */
  rowNumber: number;
  status: "valid" | "error";
  matchedProductLinkId: string | null;
  matchedTitle: string | null;
  currentAffiliateUrl: string | null;
  newAffiliateUrl: string | null;
  errorCode?: BulkRowErrorCode;
  errorMessage?: string;
};

export type BulkPreviewResult = {
  rows: BulkPreviewRow[];
  summary: { total: number; valid: number; errors: number };
};

export type BulkApplyResult = { applied: number; skipped: number; errors: number };

type ValidatedRow = {
  preview: BulkPreviewRow;
  /** Present only for status "valid": the target link plus the values to write. */
  update?: { link: ProductLink; affiliateUrl: string; priceSnapshotKrw?: number };
};

/**
 * COM-107-prep: bulk affiliate-link replacement. When 쿠팡 파트너스/네이버 커넥트
 * approval arrives, the 58 seeded example.com product links get swapped via a
 * single CSV upload: preview validates every row without writing; apply updates
 * only the valid rows transactionally and is idempotent (an unchanged row
 * counts as skipped, so re-uploading the same CSV is a no-op).
 */
@Injectable()
export class ProductLinkBulkService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async preview(csv: string): Promise<BulkPreviewResult> {
    const validated = await this.validate(csv);
    return this.toPreviewResult(validated);
  }

  async apply(csv: string): Promise<BulkApplyResult & { preview: BulkPreviewResult }> {
    const validated = await this.validate(csv);
    const updates = validated.flatMap((row) => (row.update ? [row.update] : []));

    // Idempotency: rows whose target already carries the exact requested values
    // are skipped instead of rewritten (keeps updatedAt stable on re-uploads).
    const changed = updates.filter(({ link, affiliateUrl, priceSnapshotKrw }) => {
      if (link.affiliateUrl !== affiliateUrl) return true;
      if (!link.isAffiliate) return true;
      if (priceSnapshotKrw !== undefined && link.priceSnapshotKrw !== priceSnapshotKrw) return true;
      return false;
    });

    await this.prisma.$transaction(
      changed.map(({ link, affiliateUrl, priceSnapshotKrw }) =>
        this.prisma.productLink.update({
          where: { id: link.id },
          data: {
            affiliateUrl,
            // A replaced link is by definition an affiliate link now — surface
            // the mobile app's disclosure UI for it.
            isAffiliate: true,
            ...(priceSnapshotKrw === undefined ? {} : { priceSnapshotKrw })
          }
        })
      )
    );

    const errors = validated.filter((row) => row.preview.status === "error").length;
    return {
      applied: changed.length,
      skipped: updates.length - changed.length,
      errors,
      preview: this.toPreviewResult(validated)
    };
  }

  private toPreviewResult(validated: ValidatedRow[]): BulkPreviewResult {
    const rows = validated.map((row) => row.preview);
    const valid = rows.filter((row) => row.status === "valid").length;
    return { rows, summary: { total: rows.length, valid, errors: rows.length - valid } };
  }

  private async validate(csv: string): Promise<ValidatedRow[]> {
    const csvRows = parseBulkCsv(csv);

    // Small tables (58 seeded links today, capped CSV) — load once and match
    // in memory instead of a query per row.
    const [links, templates] = await Promise.all([
      this.prisma.productLink.findMany(),
      this.prisma.itemTemplate.findMany({ select: { id: true, code: true, name: true } })
    ]);
    const linkById = new Map(links.map((link) => [link.id, link]));

    const seenTargetIds = new Set<string>();
    return csvRows.map((row) => {
      const validated = this.validateRow(row, linkById, links, templates);
      if (validated.update) {
        if (seenTargetIds.has(validated.update.link.id)) {
          return {
            preview: {
              ...validated.preview,
              status: "error",
              errorCode: "BULK_ROW_DUPLICATE_TARGET",
              errorMessage: ROW_ERROR_MESSAGES.BULK_ROW_DUPLICATE_TARGET
            }
          };
        }
        seenTargetIds.add(validated.update.link.id);
      }
      return validated;
    });
  }

  private validateRow(
    row: BulkCsvRow,
    linkById: Map<string, ProductLink>,
    links: ProductLink[],
    templates: Array<{ id: string; code: string; name: string }>
  ): ValidatedRow {
    const error = (code: BulkRowErrorCode, link?: ProductLink): ValidatedRow => ({
      preview: {
        rowNumber: row.lineNumber,
        status: "error",
        matchedProductLinkId: link?.id ?? null,
        matchedTitle: link?.title ?? null,
        currentAffiliateUrl: link?.affiliateUrl ?? null,
        newAffiliateUrl: null,
        errorCode: code,
        errorMessage: ROW_ERROR_MESSAGES[code]
      }
    });

    // 1) Resolve the target link: productLinkId wins; otherwise itemTemplate
    //    (code or name) + platform must match exactly one link.
    const { productLinkId, itemTemplate, platform } = row.cells;
    let link: ProductLink | undefined;
    if (productLinkId) {
      link = linkById.get(productLinkId);
      if (!link) {
        return error("BULK_ROW_LINK_NOT_FOUND");
      }
    } else if (itemTemplate) {
      if (!platform) {
        return error("BULK_ROW_IDENTIFIER_MISSING");
      }
      if (!PRODUCT_PLATFORMS.includes(platform as ProductPlatform)) {
        return error("BULK_ROW_PLATFORM_INVALID");
      }
      const templateIds = new Set(
        templates.filter((template) => template.code === itemTemplate || template.name === itemTemplate).map((t) => t.id)
      );
      const matches = links.filter((candidate) => templateIds.has(candidate.itemTemplateId) && candidate.platform === platform);
      if (matches.length === 0) {
        return error("BULK_ROW_LINK_NOT_FOUND");
      }
      if (matches.length > 1) {
        return error("BULK_ROW_LINK_AMBIGUOUS");
      }
      link = matches[0];
    } else {
      return error("BULK_ROW_IDENTIFIER_MISSING");
    }

    // 2) New affiliate URL: well-formed, https-only (stricter than the http-or-
    //    https single-link form — bulk swaps target real partner links), and on
    //    the AFFILIATE_ALLOWED_DOMAINS allowlist shared with the /r/:code
    //    redirect guard.
    const affiliateUrl = row.cells.affiliateUrl;
    if (!affiliateUrl) {
      return error("BULK_ROW_URL_INVALID", link);
    }
    let parsed: URL;
    try {
      parsed = new URL(affiliateUrl);
    } catch {
      return error("BULK_ROW_URL_INVALID", link);
    }
    if (parsed.protocol !== "https:") {
      return error("BULK_ROW_URL_INVALID", link);
    }
    if (!isAllowedAffiliateUrl(affiliateUrl)) {
      return error("BULK_ROW_DOMAIN_NOT_ALLOWED", link);
    }

    // 3) Optional price snapshot.
    let priceSnapshotKrw: number | undefined;
    const priceRaw = row.cells.priceSnapshotKrw;
    if (priceRaw !== undefined) {
      const digits = priceRaw.replace(/,/g, "");
      if (!/^\d+$/.test(digits)) {
        return error("BULK_ROW_PRICE_INVALID", link);
      }
      priceSnapshotKrw = Number(digits);
    }

    return {
      preview: {
        rowNumber: row.lineNumber,
        status: "valid",
        matchedProductLinkId: link.id,
        matchedTitle: link.title,
        currentAffiliateUrl: link.affiliateUrl,
        newAffiliateUrl: affiliateUrl
      },
      update: { link, affiliateUrl, priceSnapshotKrw }
    };
  }
}
