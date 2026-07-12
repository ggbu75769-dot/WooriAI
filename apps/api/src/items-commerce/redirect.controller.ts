import { randomUUID } from "node:crypto";
import { Controller, Get, Inject, Ip, Logger, NotFoundException, Param, Req, Res } from "@nestjs/common";
import type { Response } from "express";
import { PrismaService } from "../prisma/prisma.service";
import type { AuthenticatedRequest } from "../common/types/authenticated-request";
import { isHttpOrHttpsUrl } from "../common/validation/url-scheme";
import { hashClickIp, isAllowedAffiliateUrl, PRODUCT_LINK_NOT_FOUND_ERROR } from "./affiliate-link-guard.util";

/**
 * COM-106 (round5a-sprint2-plan.md §4): the opaque, public, unauthenticated affiliate
 * redirect. No JwtAuthGuard here on purpose -- this is meant to be shared/clicked by
 * anyone, including someone with no WooriAI account. Query params received on this
 * route are never read or reflected into the Location header (open-redirect
 * prevention): the only thing that decides the destination is the stored product
 * link's own url/affiliateUrl, looked up by the opaque redirectCode.
 */
@Controller("r")
export class AffiliateRedirectController {
  private readonly logger = new Logger(AffiliateRedirectController.name);

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  @Get(":code")
  async redirect(
    @Param("code") code: string,
    @Ip() ip: string,
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response
  ) {
    const productLink = await this.prisma.productLink.findFirst({ where: { redirectCode: code, active: true } });
    if (!productLink) {
      throw new NotFoundException(PRODUCT_LINK_NOT_FOUND_ERROR);
    }

    const targetUrl = productLink.affiliateUrl ?? productLink.url;
    // Same allowlist as POST /product-links/:id/click (affiliate-link-guard.util.ts).
    // A disallowed/unsafe target does NOT deactivate the link -- just a warning log and
    // the same 404 as an unknown code, so a bad domain can be fixed by an admin without
    // losing the link's click history.
    if (!isHttpOrHttpsUrl(targetUrl) || !isAllowedAffiliateUrl(targetUrl)) {
      this.logger.warn(
        `Affiliate redirect blocked for product link ${productLink.id}: target domain is not on AFFILIATE_ALLOWED_DOMAINS`
      );
      throw new NotFoundException(PRODUCT_LINK_NOT_FOUND_ERROR);
    }

    // Anonymous click: no authenticated user/household/child (migration 000008 made
    // these nullable specifically for this route). subId is a self-generated uuid
    // reused as the row's own id -- never derived from any user/child identifier.
    const clickId = randomUUID();
    const userAgentHeader = request.headers?.["user-agent"];
    await this.prisma.affiliateClick.create({
      data: {
        id: clickId,
        userId: null,
        householdId: null,
        childId: null,
        itemTemplateId: productLink.itemTemplateId,
        productLinkId: productLink.id,
        platform: productLink.platform,
        referrerScreenId: "redirect",
        subId: clickId,
        ipHash: hashClickIp(ip),
        userAgent: Array.isArray(userAgentHeader) ? userAgentHeader[0] : userAgentHeader
      }
    });

    response.redirect(302, targetUrl);
  }
}
