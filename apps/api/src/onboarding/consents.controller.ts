import { Body, Controller, Get, Inject, Put, Req, UseGuards } from "@nestjs/common";
import { createDtoValidationPipe } from "../bootstrap";
import { JwtAuthGuard } from "../common/guards/auth.guard";
import type { AuthenticatedRequest } from "../common/types/authenticated-request";
import { UpsertConsentsDto } from "./dto/upsert-consents.dto";
import { OnboardingStoreService } from "./onboarding-store.service";

@Controller("consents")
@UseGuards(JwtAuthGuard)
export class ConsentsController {
  constructor(@Inject(OnboardingStoreService) private readonly store: OnboardingStoreService) {}

  @Get()
  list(@Req() request: AuthenticatedRequest) {
    return this.store.listConsents(request.user!);
  }

  @Put()
  upsert(
    @Req() request: AuthenticatedRequest,
    @Body(createDtoValidationPipe(UpsertConsentsDto)) body: UpsertConsentsDto
  ) {
    return this.store.upsertConsents(request.user!, body.consents);
  }
}
