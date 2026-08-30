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
  /**
   * 사용자에게 노출되는 준비템 전체 수(active=true) = 카탈로그의 크기.
   *
   * 라운드 83 트랙 C(W-3의 공백): 저장소의 판정 둘이 이 수에 기대는데
   * (known-limitations N-4의 재개 트리거 "카탈로그 200건" · 라운드 82가 `getHome`의
   * 카탈로그 전량 읽기를 기각하며 적은 같은 값), 그 수를 **세는 자리가 0건**이었다.
   * 이 표를 늘리는 것은 어드민이고(onboarding/items-catalog.service.ts의
   * `adminCreateItemTemplate`) 늘어난 날 아무 코드도 바뀌지 않으므로, 문턱이 넘어간
   * 사실은 누군가 DB를 손으로 세지 않는 한 아무도 모른다. 세는 자리를 여기 둔다.
   */
  itemTemplatesActiveCount: number;
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
      productLinksUncheckedCount,
      itemTemplatesActiveCount
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
      this.prisma.productLink.count({ where: { active: true, healthStatus: null } }),
      // 라운드 83 트랙 C: 카탈로그의 크기도 같은 규율 안에 있다 — `count({ where })`
      // 한 방이고, 행을 읽지도 밴드로 가르지도 않는다. 밴드별 카운트를 여기서 세지
      // 않는 이유는 `ItemTemplateStage`에 `ItemTemplate` 관계 필드가 없어
      // (schema.prisma) `where: { itemTemplate: { active: true } }`를 쓸 수 없고,
      // 우회하면 활성 id 전량을 먼저 읽는 비례 조회이거나 원시 SQL이기 때문이다 —
      // 둘 다 이 파일의 규율 밖이다. 재개 조건: 그 관계 필드가 생기는 날, 또는
      // 이 카운트가 문턱을 넘는 날(catalog-size-view.ts가 그 문턱을 인용한다).
      this.prisma.itemTemplate.count({ where: { active: true } })
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
      productLinksUncheckedCount,
      itemTemplatesActiveCount
    };
  }
}
