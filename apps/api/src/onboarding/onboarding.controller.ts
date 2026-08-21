import { Controller, Get, Inject, Query, Req, UseGuards } from "@nestjs/common";
import { IsOptional, IsUUID } from "class-validator";
import { createDtoValidationPipe } from "../bootstrap";
import { JwtAuthGuard } from "../common/guards/auth.guard";
import type { AuthenticatedRequest } from "../common/types/authenticated-request";
import { OnboardingCoreService } from "./onboarding-core.service";

/**
 * R19-C(F1): optional 다자녀 스코프. 생략하면 예전과 똑같이 가구의 첫째 아이 기준 요약을
 * 돌려주므로(하위호환), 기존 클라이언트는 그대로 동작한다.
 */
class OnboardingStatusQueryDto {
  @IsOptional()
  @IsUUID()
  childId?: string;
}

@Controller("onboarding")
@UseGuards(JwtAuthGuard)
export class OnboardingController {
  constructor(@Inject(OnboardingCoreService) private readonly store: OnboardingCoreService) {}

  @Get("status")
  async status(
    @Req() request: AuthenticatedRequest,
    @Query(createDtoValidationPipe(OnboardingStatusQueryDto)) query: OnboardingStatusQueryDto
  ) {
    return await this.store.onboardingStatus(request.user!, query.childId);
  }
}
