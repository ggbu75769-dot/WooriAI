import { Controller, Get, Inject, Param, Query, Req, UseGuards } from "@nestjs/common";
import { createDtoValidationPipe } from "../bootstrap";
import { JwtAuthGuard } from "../common/guards/auth.guard";
import type { AuthenticatedRequest } from "../common/types/authenticated-request";
import { ReportingStoreService } from "../onboarding/reporting-store.service";
import { CategoryReportQueryDto, TrendReportQueryDto, YearMonthQueryDto, YearQueryDto } from "./dto/query.dto";
import { MilestoneReportQueryDto } from "./dto/milestone-query.dto";
import { MilestoneReportService } from "./milestone-report.service";

@Controller("children/:childId/reports")
@UseGuards(JwtAuthGuard)
export class ReportsController {
  constructor(
    @Inject(ReportingStoreService) private readonly store: ReportingStoreService,
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

  /**
   * REP-128: 최근 N개월(기본 6, 상한 12) 월별 합계를 한 번에. 모바일 리포트 월간 탭의
   * 추이 차트가 위의 `monthly`를 막대 하나당 한 번씩 6번 부르던 워터폴을 대체한다.
   * `monthly`는 예산·카테고리 분해를 함께 쓰는 화면들 때문에 그대로 둔다(하위호환).
   */
  @Get("trend")
  async trend(
    @Req() request: AuthenticatedRequest,
    @Param("childId") childId: string,
    @Query(createDtoValidationPipe(TrendReportQueryDto)) query: TrendReportQueryDto
  ) {
    return await this.store.getTrendReport(request.user!, childId, {
      months: query.months,
      endYearMonth: query.endYearMonth
    });
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
