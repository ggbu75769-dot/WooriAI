import { Body, Controller, Get, Inject, Param, Put, Query, Req, UseGuards } from "@nestjs/common";
import { IsOptional, Matches } from "class-validator";
import { createDtoValidationPipe } from "../bootstrap";
import { JwtAuthGuard } from "../common/guards/auth.guard";
import type { AuthenticatedRequest } from "../common/types/authenticated-request";
import { UpsertBudgetDto } from "./dto/upsert-budget.dto";
import { OnboardingStoreService } from "./onboarding-store.service";

class BudgetQueryDto {
  @IsOptional()
  @Matches(/^\d{4}-\d{2}$/)
  yearMonth?: string;
}

@Controller("children/:childId/budget")
@UseGuards(JwtAuthGuard)
export class BudgetsController {
  constructor(@Inject(OnboardingStoreService) private readonly store: OnboardingStoreService) {}

  @Get()
  get(
    @Req() request: AuthenticatedRequest,
    @Param("childId") childId: string,
    @Query(createDtoValidationPipe(BudgetQueryDto)) query: BudgetQueryDto
  ) {
    return this.store.getBudget(request.user!, childId, query.yearMonth);
  }

  @Put()
  upsert(
    @Req() request: AuthenticatedRequest,
    @Param("childId") childId: string,
    @Body(createDtoValidationPipe(UpsertBudgetDto)) body: UpsertBudgetDto
  ) {
    return this.store.upsertBudget(request.user!, childId, body.yearMonth, body.amountKrw);
  }
}
