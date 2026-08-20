import { Controller, Get, Inject, UseGuards } from "@nestjs/common";
import { AdminAuthGuard } from "./admin-auth.guard";
import { DashboardSummaryService } from "./dashboard-summary.service";

/**
 * ADM-008: GET /admin/dashboard/summary -- read-only counters for the admin
 * dashboard home. Guarded by AdminAuthGuard but intentionally WITHOUT
 * `@RequireAdminRoles(...)`: every admin role (admin/editor/analyst) may read
 * it, matching the other read-only admin GET endpoints.
 */
@Controller("admin/dashboard")
@UseGuards(AdminAuthGuard)
export class DashboardSummaryController {
  constructor(@Inject(DashboardSummaryService) private readonly summaries: DashboardSummaryService) {}

  @Get("summary")
  async getSummary() {
    return await this.summaries.getSummary();
  }
}
