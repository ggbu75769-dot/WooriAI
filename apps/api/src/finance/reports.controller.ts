import { Controller, Get, Inject, Param, Query, Req, UseGuards } from "@nestjs/common";
import { createDtoValidationPipe } from "../bootstrap";
import { JwtAuthGuard } from "../common/guards/auth.guard";
import type { AuthenticatedRequest } from "../common/types/authenticated-request";
import { OnboardingStoreService } from "../onboarding/onboarding-store.service";
import { YearMonthQueryDto, YearQueryDto } from "./dto/query.dto";

@Controller("children/:childId/reports")
@UseGuards(JwtAuthGuard)
export class ReportsController {
  constructor(@Inject(OnboardingStoreService) private readonly store: OnboardingStoreService) {}

  @Get("monthly")
  monthly(
    @Req() request: AuthenticatedRequest,
    @Param("childId") childId: string,
    @Query(createDtoValidationPipe(YearMonthQueryDto)) query: YearMonthQueryDto
  ) {
    return this.store.getMonthlyReport(request.user!, childId, query.yearMonth);
  }

  @Get("yearly")
  yearly(
    @Req() request: AuthenticatedRequest,
    @Param("childId") childId: string,
    @Query(createDtoValidationPipe(YearQueryDto)) query: YearQueryDto
  ) {
    return this.store.getYearlyReport(request.user!, childId, query.year);
  }

  @Get("cumulative")
  cumulative(@Req() request: AuthenticatedRequest, @Param("childId") childId: string) {
    return this.store.getCumulativeReport(request.user!, childId);
  }

  @Get("category")
  category(@Req() request: AuthenticatedRequest, @Param("childId") childId: string) {
    return this.store.getCategoryReport(request.user!, childId);
  }
}
