import { Body, Controller, Get, Inject, Param, Put, Query, Req, UseGuards, UseInterceptors } from "@nestjs/common";
import { IsOptional, Matches } from "class-validator";
import { createDtoValidationPipe } from "../bootstrap";
import { YEAR_MONTH_INPUT_PATTERN } from "../common/validation/year-month";
import { JwtAuthGuard } from "../common/guards/auth.guard";
import { IdempotencyInterceptor } from "../common/idempotency/idempotency.interceptor";
import type { AuthenticatedRequest } from "../common/types/authenticated-request";
import { UpsertBudgetDto } from "./dto/upsert-budget.dto";
import { OnboardingCoreService } from "./onboarding-core.service";

class BudgetQueryDto {
  // REP-105: PUT과 동일하게 YYYY-MM / YYYY-MM-01 모두 허용 (서비스는 월 단위로 정규화).
  // 월은 01-12로 제한 — 공유 YEAR_MONTH_INPUT_PATTERN과 동일 (2026-13 등은 400).
  @IsOptional()
  @Matches(YEAR_MONTH_INPUT_PATTERN)
  yearMonth?: string;
}

@Controller("children/:childId/budget")
@UseGuards(JwtAuthGuard)
export class BudgetsController {
  constructor(@Inject(OnboardingCoreService) private readonly store: OnboardingCoreService) {}

  @Get()
  async get(
    @Req() request: AuthenticatedRequest,
    @Param("childId") childId: string,
    @Query(createDtoValidationPipe(BudgetQueryDto)) query: BudgetQueryDto
  ) {
    return await this.store.getBudget(request.user!, childId, query.yearMonth);
  }

  @Put()
  @UseInterceptors(IdempotencyInterceptor)
  async upsert(
    @Req() request: AuthenticatedRequest,
    @Param("childId") childId: string,
    @Body(createDtoValidationPipe(UpsertBudgetDto)) body: UpsertBudgetDto
  ) {
    return await this.store.upsertBudget(request.user!, childId, body.yearMonth, body.amountKrw);
  }
}
