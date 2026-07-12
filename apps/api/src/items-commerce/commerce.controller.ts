import { Body, Controller, HttpCode, Inject, Param, Post, Req, UseGuards } from "@nestjs/common";
import { createDtoValidationPipe } from "../bootstrap";
import { JwtAuthGuard } from "../common/guards/auth.guard";
import type { AuthenticatedRequest } from "../common/types/authenticated-request";
import { OnboardingStoreService } from "../onboarding/onboarding-store.service";
import { ProductLinkClickDto } from "./dto/items.dto";

@Controller("product-links")
@UseGuards(JwtAuthGuard)
export class CommerceController {
  constructor(@Inject(OnboardingStoreService) private readonly store: OnboardingStoreService) {}

  @Post(":productLinkId/click")
  @HttpCode(200)
  async click(
    @Req() request: AuthenticatedRequest,
    @Param("productLinkId") productLinkId: string,
    @Body(createDtoValidationPipe(ProductLinkClickDto)) body: ProductLinkClickDto
  ) {
    return await this.store.clickProductLink(request.user!, productLinkId, body);
  }
}
