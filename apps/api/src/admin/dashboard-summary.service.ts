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
  /** 활성 링크 중 깨짐 판정을 받은 수 (UX-X(R43) M-4: 비활성 링크는 제외). */
  productLinksBrokenCount: number;
  /** 사용자에게 노출되는 링크 전체 수(active=true). 깨짐/미검사의 분모. */
  productLinksActiveCount: number;
  /** 활성 링크 중 아직 한 번도 검사되지 않은 수(health_status IS NULL). */
  productLinksUncheckedCount: number;
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
      productLinksBrokenCount,
      productLinksActiveCount,
      productLinksUncheckedCount
    ] = await Promise.all([
      this.prisma.user.count({ where: { status: "active" } }),
      this.prisma.household.count(),
      this.prisma.child.count(),
      this.prisma.expense.count(),
      this.prisma.affiliateClick.count({ where: { clickedAt: { gte: since7d } } }),
      // PERF-115(F1): 의도적 의미 변경 — 수신 시각(receivedAt)이 아닌 발생 시각
      // (occurredAt) 기준 7일 카운트. KPI 화면(analytics-summary.service.ts)과
      // 의미가 정합해지고, received_at에는 시간 인덱스가 없어 가장 빨리 자라는
      // analytics_events를 풀스캔하던 것이 000011의
      // idx_analytics_events_occurred_at 인덱스를 타게 된다.
      this.prisma.analyticsEvent.count({ where: { occurredAt: { gte: since7d } } }),
      this.prisma.contentRevision.count({ where: { status: "in_review" } }),
      // UX-X(R43) M-4: 링크 헬스 3종은 모두 active=true 안에서 센다.
      //  - 깨짐: 종전에는 active 조건이 없어 이미 내린(비활성) 링크까지 카드에 남았다.
      //    사용자에게 안 보이는 링크는 "깨진 구매처"가 아니다.
      //  - 미검사: link-health.job.ts의 검사 대상은 `active AND affiliate_url IS NOT NULL`
      //    뿐이라, 제휴 URL이 없는 활성 링크는 검사가 켜져 있어도 영원히 health_status가
      //    NULL로 남는다. 그 수를 함께 내려야 대시보드가 "깨짐 0"을 전수 검사 결과인 양
      //    보여주지 않는다(worker-health-view.ts brokenLinkCountCaption).
      //  - 활성 전체: 위 두 수의 분모. 세 개 다 count({where}) 한 방이라 비용은 그대로다.
      this.prisma.productLink.count({ where: { active: true, healthStatus: "broken" } }),
      this.prisma.productLink.count({ where: { active: true } }),
      this.prisma.productLink.count({ where: { active: true, healthStatus: null } })
    ]);

    return {
      activeUsers,
      households,
      childrenCount,
      expensesTotal,
      affiliateClicks7d,
      analyticsEvents7d,
      pendingContentRevisions,
      productLinksBrokenCount,
      productLinksActiveCount,
      productLinksUncheckedCount
    };
  }
}
