import { Inject, Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

/** ADM-008: shape returned by GET /admin/dashboard/summary. All plain counts. */
export type AdminDashboardSummary = {
  activeUsers: number;
  households: number;
  childrenCount: number;
  expensesTotal: number;
  affiliateClicks7d: number;
  analyticsEvents7d: number;
  pendingContentRevisions: number;
  productLinksBrokenCount: number;
};

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * ADM-008: read-only ops-visibility counters for the admin dashboard home.
 * Deliberately a handful of `count({ where })` queries -- no row scans, no
 * aggregation over payloads -- so it stays cheap enough to hit on every
 * dashboard load.
 */
@Injectable()
export class DashboardSummaryService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async getSummary(): Promise<AdminDashboardSummary> {
    const since7d = new Date(Date.now() - SEVEN_DAYS_MS);

    const [
      activeUsers,
      households,
      childrenCount,
      expensesTotal,
      affiliateClicks7d,
      analyticsEvents7d,
      pendingContentRevisions,
      productLinksBrokenCount
    ] = await Promise.all([
      this.prisma.user.count({ where: { status: "active" } }),
      this.prisma.household.count(),
      this.prisma.child.count(),
      this.prisma.expense.count(),
      this.prisma.affiliateClick.count({ where: { clickedAt: { gte: since7d } } }),
      this.prisma.analyticsEvent.count({ where: { receivedAt: { gte: since7d } } }),
      this.prisma.contentRevision.count({ where: { status: "in_review" } }),
      this.prisma.productLink.count({ where: { healthStatus: "broken" } })
    ]);

    return {
      activeUsers,
      households,
      childrenCount,
      expensesTotal,
      affiliateClicks7d,
      analyticsEvents7d,
      pendingContentRevisions,
      productLinksBrokenCount
    };
  }
}
