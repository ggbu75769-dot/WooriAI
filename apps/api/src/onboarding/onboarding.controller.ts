import { Body, Controller, Get, HttpCode, Inject, Post, Req, UseGuards, UseInterceptors } from "@nestjs/common";
import { createDtoValidationPipe } from "../bootstrap";
import { JwtAuthGuard } from "../common/guards/auth.guard";
import { HouseholdRoleGuard, RequireHouseholdRoles } from "../common/guards/household-role.guard";
import { IdempotencyInterceptor } from "../common/idempotency/idempotency.interceptor";
import type { AuthenticatedRequest } from "../common/types/authenticated-request";
import { CompleteOnboardingDto, StarterItemsPreviewDto } from "./dto/complete-onboarding.dto";
import { OnboardingStoreService } from "./onboarding-store.service";

@Controller("onboarding")
@UseGuards(JwtAuthGuard)
export class OnboardingController {
  constructor(@Inject(OnboardingStoreService) private readonly store: OnboardingStoreService) {}

  @Get("status")
  async status(@Req() request: AuthenticatedRequest) {
    return await this.store.onboardingStatus(request.user!);
  }

  @Post("starter-items/preview")
  @HttpCode(200)
  async starterItems(
    @Req() request: AuthenticatedRequest,
    @Body(createDtoValidationPipe(StarterItemsPreviewDto)) body: StarterItemsPreviewDto
  ) {
    return await this.store.starterItemsPreview(request.user!, body);
  }

  @Post("complete")
  @HttpCode(200)
  @UseGuards(JwtAuthGuard, HouseholdRoleGuard)
  @RequireHouseholdRoles("owner", "co_parent")
  @UseInterceptors(IdempotencyInterceptor)
  async complete(
    @Req() request: AuthenticatedRequest,
    @Body(createDtoValidationPipe(CompleteOnboardingDto)) body: CompleteOnboardingDto
  ) {
    return await this.store.completeOnboarding(request.user!, body);
  }
}
