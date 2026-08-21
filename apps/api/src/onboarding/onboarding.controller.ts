import { Controller, Get, Inject, Req, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../common/guards/auth.guard";
import type { AuthenticatedRequest } from "../common/types/authenticated-request";
import { OnboardingCoreService } from "./onboarding-core.service";

@Controller("onboarding")
@UseGuards(JwtAuthGuard)
export class OnboardingController {
  constructor(@Inject(OnboardingCoreService) private readonly store: OnboardingCoreService) {}

  @Get("status")
  async status(@Req() request: AuthenticatedRequest) {
    return await this.store.onboardingStatus(request.user!);
  }
}
