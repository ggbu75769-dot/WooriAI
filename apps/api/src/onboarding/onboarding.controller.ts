import { Controller, Get, Inject, Req, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../common/guards/auth.guard";
import type { AuthenticatedRequest } from "../common/types/authenticated-request";
import { OnboardingStoreService } from "./onboarding-store.service";

@Controller("onboarding")
@UseGuards(JwtAuthGuard)
export class OnboardingController {
  constructor(@Inject(OnboardingStoreService) private readonly store: OnboardingStoreService) {}

  @Get("status")
  status(@Req() request: AuthenticatedRequest) {
    return this.store.onboardingStatus(request.user!);
  }
}
