import { BadRequestException, Controller, Get, Inject, Query, UseGuards } from "@nestjs/common";
import { AdminAuthGuard } from "./admin-auth.guard";
import {
  ANALYTICS_SUMMARY_WINDOWS,
  AnalyticsSummaryService,
  isAnalyticsSummaryWindow,
  type AnalyticsSummaryWindow
} from "./analytics-summary.service";

/**
 * ADM-009: GET /admin/analytics/summary?days=7|30 -- read-only KPI funnel
 * aggregation over analytics_events. Guarded by AdminAuthGuard but
 * intentionally WITHOUT `@RequireAdminRoles(...)`: every admin role
 * (admin/editor/analyst) may read it, matching the other read-only admin GET
 * endpoints (ADM-008 dashboard summary precedent).
 */
@Controller("admin/analytics")
@UseGuards(AdminAuthGuard)
export class AnalyticsSummaryController {
  constructor(@Inject(AnalyticsSummaryService) private readonly summaries: AnalyticsSummaryService) {}

  @Get("summary")
  async getSummary(@Query("days") daysRaw?: string) {
    const days: number = daysRaw === undefined ? 7 : Number(daysRaw);
    if (!isAnalyticsSummaryWindow(days)) {
      throw new BadRequestException({
        code: "VALIDATION_ERROR",
        message: `days는 ${ANALYTICS_SUMMARY_WINDOWS.join(" 또는 ")}만 지원해요.`
      });
    }
    return await this.summaries.getSummary(days satisfies AnalyticsSummaryWindow);
  }
}
