import { Body, Controller, HttpCode, Inject, Param, Post, Req, UseGuards } from "@nestjs/common";
import { createDtoValidationPipe } from "../bootstrap";
import { JwtAuthGuard } from "../common/guards/auth.guard";
import type { AuthenticatedRequest } from "../common/types/authenticated-request";
import { ItemsCatalogService } from "../onboarding/items-catalog.service";
import { ProductLinkClickDto } from "./dto/items.dto";

@Controller("product-links")
@UseGuards(JwtAuthGuard)
export class CommerceController {
  constructor(@Inject(ItemsCatalogService) private readonly store: ItemsCatalogService) {}

  @Post(":productLinkId/click")
  @HttpCode(200)
  async click(
    @Req() request: AuthenticatedRequest,
    @Param("productLinkId") productLinkId: string,
    @Body(createDtoValidationPipe(ProductLinkClickDto)) body: ProductLinkClickDto
  ) {
    const userAgentHeader = request.headers?.["user-agent"];
    return await this.store.clickProductLink(request.user!, productLinkId, body, {
      ip: request.ip,
      userAgent: Array.isArray(userAgentHeader) ? userAgentHeader[0] : userAgentHeader
    });
  }
}
