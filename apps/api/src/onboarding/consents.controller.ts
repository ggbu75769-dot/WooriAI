import { Body, Controller, Get, Inject, Put, Req, UseGuards } from "@nestjs/common";
import { createDtoValidationPipe } from "../bootstrap";
import { JwtAuthGuard } from "../common/guards/auth.guard";
import type { AuthenticatedRequest } from "../common/types/authenticated-request";
import { UpsertConsentsDto } from "./dto/upsert-consents.dto";
import { OnboardingCoreService } from "./onboarding-core.service";

@Controller("consents")
@UseGuards(JwtAuthGuard)
export class ConsentsController {
  constructor(@Inject(OnboardingCoreService) private readonly store: OnboardingCoreService) {}

  @Get()
  async list(@Req() request: AuthenticatedRequest) {
    return await this.store.listConsents(request.user!);
  }

  @Put()
  async upsert(
    @Req() request: AuthenticatedRequest,
    @Body(createDtoValidationPipe(UpsertConsentsDto)) body: UpsertConsentsDto
  ) {
    return await this.store.upsertConsents(request.user!, body.consents);
  }
}
