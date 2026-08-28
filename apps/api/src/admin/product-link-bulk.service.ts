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
  | "BULK_ROW_URL_TOO_LONG"
  | "BULK_ROW_DOMAIN_NOT_ALLOWED"
  | "BULK_ROW_PRICE_INVALID";

/**
 * COM-107: hard cap for the replacement affiliate URL. The CSV parser keeps the
 * affiliateUrl column untruncated (see product-link-bulk-csv.util.ts) precisely
 * so an over-limit URL fails validation here as a visible row error instead of
 * being silently cut to a still-well-formed prefix and written as "valid".
 */
export const BULK_MAX_AFFILIATE_URL_LENGTH = 2000;

const ROW_ERROR_MESSAGES: Record<BulkRowErrorCode, string> = {
  BULK_ROW_IDENTIFIER_MISSING: "productLinkId 또는 itemTemplate과 platform을 입력해 주세요.",
  BULK_ROW_PLATFORM_INVALID: "platform은 coupang, naver, custom 중 하나여야 해요.",
  BULK_ROW_LINK_NOT_FOUND: "대상 상품 링크를 찾을 수 없어요.",
  BULK_ROW_LINK_AMBIGUOUS: "조건에 맞는 상품 링크가 여러 개예요. productLinkId로 지정해 주세요.",
  BULK_ROW_DUPLICATE_TARGET: "같은 상품 링크를 대상으로 하는 행이 이미 있어요.",
  BULK_ROW_URL_INVALID: "affiliateUrl은 https:// 로 시작하는 올바른 URL이어야 해요.",
  BULK_ROW_URL_TOO_LONG: `affiliateUrl은 ${BULK_MAX_AFFILIATE_URL_LENGTH}자 이하여야 해요.`,
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
  /**
   * 라운드 64 D(#4ⓐ): 대상 링크에 **지금 저장돼 있는** 가격(없으면 null).
   *
   * 미리보기가 URL만 대조하던 탓에 CSV로 쓴 가격은 어디에서도 확인할 수 없었다 —
   * 적용 후 받는 것은 `{applied, skipped, errors}` 숫자 셋뿐이고, 타임아웃 뒤 패널이
   * 권하는 재조회조차 "현재 제휴 URL이 새 URL과 같으면 반영된 것"만 말할 수 있었다
   * (ProductLinkBulkReplace.tsx). 이 두 칸이 그 대조를 가격까지 넓힌다.
   */
  currentPriceSnapshotKrw: number | null;
  /** 이 행이 쓰려는 가격. CSV에 가격 칸이 비어 있으면 null(= 가격은 그대로 둔다). */
  newPriceSnapshotKrw: number | null;
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
      // 라운드 51 QA(P2-5): 값이 같아도 **확인 시각이 비어 있으면** 갱신 대상이다.
      //
      // 아래 주석이 "CSV에 가격 칸이 있으면 값이 같아도 now로 갱신한다"고 말하는데, 이 필터가
      // 값만 비교해서 그 행을 통째로 skipped로 걸러 냈다. 그 어긋남이 실제로 다치는 자리는
      // priceCheckedAt이 NULL인 채 가격만 있는 레거시 행이다: 앱은 확인 시각이 없는 가격을
      // 아예 내려받지 못하므로(items-catalog.service.ts toProductLinkDto), 운영자가 같은 값을
      // 다시 올려 시각을 채우려 해도 영원히 skipped가 되어 그 가격이 화면에 나타나지 않았다.
      if (priceSnapshotKrw !== undefined && link.priceCheckedAt === null) return true;
      return false;
    });

    // 라운드 51 #9: 가격을 쓰는 자리에서 그 가격의 **확인 시각**(000020)도 함께 쓴다.
    // 앱은 확인 시각이 없는 가격을 아예 내려받지 못하므로(items-catalog.service.ts
    // toProductLinkDto), 이 시각이 없으면 CSV로 채운 가격은 화면에 영원히 나타나지
    // 않는다. CSV에 가격 칸이 있다는 것은 운영자가 업로드 시점에 그 값을 확인했다는
    // 뜻이므로 값이 같아도 now로 갱신한다("아직 이 가격이 맞다"는 확인).
    //
    // 가격 칸이 없는 행(priceSnapshotKrw === undefined)은 시각도 건드리지 않는다 —
    // 제휴 URL만 교체한 것은 가격을 확인한 것이 아니다. 갱신 자체가 일어나지 않는
    // 행(위 changed 필터에서 걸러진 무변경 행)도 마찬가지로 시각이 그대로 남아,
    // **시각이 이미 있는** 행에 대한 같은 CSV 재업로드는 여전히 완전한 no-op이다
    // (라운드 51 QA P2-5: 시각이 비어 있는 행만 한 번 더 갱신 대상이 되고, 그 한 번으로
    // 시각이 채워지면 그다음 재업로드부터는 다시 no-op이다).
    const priceConfirmedAt = new Date();
    await this.prisma.$transaction(
      changed.map(({ link, affiliateUrl, priceSnapshotKrw }) =>
        this.prisma.productLink.update({
          where: { id: link.id },
          data: {
            affiliateUrl,
            // A replaced link is by definition an affiliate link now — surface
            // the mobile app's disclosure UI for it.
            isAffiliate: true,
            ...(priceSnapshotKrw === undefined ? {} : { priceSnapshotKrw, priceCheckedAt: priceConfirmedAt })
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
        currentPriceSnapshotKrw: link?.priceSnapshotKrw ?? null,
        // 오류 행은 아무것도 쓰지 않는다 — 쓰려던 값을 "새 가격"으로 보여주면
        // 반영될 값처럼 읽힌다.
        newPriceSnapshotKrw: null,
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
    // Full-length check (the parser deliberately does not truncate this
    // column): an over-limit URL is a row error, never a truncated write.
    if (affiliateUrl.length > BULK_MAX_AFFILIATE_URL_LENGTH) {
      return error("BULK_ROW_URL_TOO_LONG", link);
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
        newAffiliateUrl: affiliateUrl,
        currentPriceSnapshotKrw: link.priceSnapshotKrw ?? null,
        newPriceSnapshotKrw: priceSnapshotKrw ?? null
      },
      update: { link, affiliateUrl, priceSnapshotKrw }
    };
  }
}
