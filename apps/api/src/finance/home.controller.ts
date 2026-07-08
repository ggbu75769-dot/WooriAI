import { Controller, Get, Inject, Query, Req, UseGuards } from "@nestjs/common";
import { createDtoValidationPipe } from "../bootstrap";
import { JwtAuthGuard } from "../common/guards/auth.guard";
import type { AuthenticatedRequest } from "../common/types/authenticated-request";
import { OnboardingStoreService } from "../onboarding/onboarding-store.service";
import { HomeQueryDto } from "./dto/query.dto";

@Controller("home")
@UseGuards(JwtAuthGuard)
export class HomeController {
  constructor(@Inject(OnboardingStoreService) private readonly store: OnboardingStoreService) {}

  @Get()
  get(
    @Req() request: AuthenticatedRequest,
    @Query(createDtoValidationPipe(HomeQueryDto)) query: HomeQueryDto
  ) {
    return this.store.getHome(request.user!, query.childId);
  }
}
