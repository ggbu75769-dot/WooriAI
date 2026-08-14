import { Controller, Get, Inject, Param, Query, Req, UseGuards } from "@nestjs/common";
import { createDtoValidationPipe } from "../bootstrap";
import { JwtAuthGuard } from "../common/guards/auth.guard";
import type { AuthenticatedRequest } from "../common/types/authenticated-request";
import { OnboardingStoreService } from "../onboarding/onboarding-store.service";
import { CategoryReportQueryDto, YearMonthQueryDto, YearQueryDto } from "./dto/query.dto";
import { MilestoneReportQueryDto } from "./dto/milestone-query.dto";
import { MilestoneReportService } from "./milestone-report.service";

@Controller("children/:childId/reports")
@UseGuards(JwtAuthGuard)
export class ReportsController {
  constructor(
    @Inject(OnboardingStoreService) private readonly store: OnboardingStoreService,
    @Inject(MilestoneReportService) private readonly milestoneReports: MilestoneReportService
  ) {}

  @Get("monthly")
  async monthly(
    @Req() request: AuthenticatedRequest,
    @Param("childId") childId: string,
    @Query(createDtoValidationPipe(YearMonthQueryDto)) query: YearMonthQueryDto
  ) {
    return await this.store.getMonthlyReport(request.user!, childId, query.yearMonth);
  }

  @Get("yearly")
  async yearly(
    @Req() request: AuthenticatedRequest,
    @Param("childId") childId: string,
    @Query(createDtoValidationPipe(YearQueryDto)) query: YearQueryDto
  ) {
    return await this.store.getYearlyReport(request.user!, childId, query.year);
  }

  @Get("cumulative")
  async cumulative(@Req() request: AuthenticatedRequest, @Param("childId") childId: string) {
    return await this.store.getCumulativeReport(request.user!, childId);
  }

  // REP-103: 100일/첫돌 milestone cost report (type=d100 | first-birthday).
  @Get("milestone")
  async milestone(
    @Req() request: AuthenticatedRequest,
    @Param("childId") childId: string,
    @Query(createDtoValidationPipe(MilestoneReportQueryDto)) query: MilestoneReportQueryDto
  ) {
    return await this.milestoneReports.getMilestoneReport(request.user!, childId, query.type);
  }

  @Get("category")
  async category(
    @Req() request: AuthenticatedRequest,
    @Param("childId") childId: string,
    @Query(createDtoValidationPipe(CategoryReportQueryDto)) query: CategoryReportQueryDto
  ) {
    return await this.store.getCategoryReport(request.user!, childId, {
      yearMonth: query.yearMonth,
      year: query.year,
      quarter: query.quarter
    });
  }
}
