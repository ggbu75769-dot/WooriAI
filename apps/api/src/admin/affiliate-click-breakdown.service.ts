import { Inject, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { getSeoulToday } from "@wooriai/domain";
import { PrismaService } from "../prisma/prisma.service";

/** ADM-123: the only two windows the click breakdown supports (ADM-009 precedent). */
export const CLICK_BREAKDOWN_WINDOWS = [7, 30] as const;
export type ClickBreakdownWindow = (typeof CLICK_BREAKDOWN_WINDOWS)[number];

export function isClickBreakdownWindow(value: number): value is ClickBreakdownWindow {
  return (CLICK_BREAKDOWN_WINDOWS as readonly number[]).includes(value);
}

/** How many product links the "상위 링크" table returns. */
export const CLICK_BREAKDOWN_TOP_LIMIT = 10;

/** One row of the top-links table: which link/product is actually being clicked. */
export type AdminClickTopLink = {
  productLinkId: string;
  /** null when the link row is gone (clicks outlive an admin-deleted link). */
  productLinkTitle: string | null;
  itemTemplateId: string | null;
  itemTemplateName: string | null;
  /** Retailer the click went to (product_links.platform: coupang | naver | custom). */
  platform: string | null;
  count: number;
};

/** ADM-123: shape added to GET /admin/affiliate-clicks/summary. */
export type AdminClickBreakdown = {
  days: ClickBreakdownWindow;
  /** Clicks inside the window (the all-time `totalClicks` field is unchanged). */
  windowTotalClicks: number;
  /** Top links by click count in the window, desc; ties broken by id for stability. */
  topLinks: AdminClickTopLink[];
  /** One entry per Seoul-calendar day in the window (ascending, zero-filled). */
  dailyTotals: { date: string; count: number }[];
};

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * ADM-123: read-only aggregation over affiliate_clicks so the admin can see
 * WHICH link/product is being clicked, not just a platform total.
 *
 * DNC-009 (추천 점수에 제휴 수수료율을 변수로 넣지 않는다): this service is a
 * pure read path for the admin console. 여기서 나오는 클릭 수는 추천 랭킹/점수
 * 계산으로 되먹임되지 않으며(items-catalog의 추천 정렬은 이 서비스를 참조하지
 * 않는다), 수수료율은 집계에도 응답에도 포함하지 않는다. 클릭 통계 열람은
 * 추천 점수와 무관하다.
 *
 * Window semantics mirror the ADM-009 analytics summary: the last `days`
 * Seoul-calendar days INCLUDING today, i.e. clicked_at in
 * [Seoul midnight (days-1) days ago, next Seoul midnight). Korea has no DST,
 * so fixed +09:00 day arithmetic is exact.
 *
 * Cost: three aggregate queries over affiliate_clicks (count + grouped top-N +
 * per-day GROUP BY) plus two small metadata lookups keyed by id -- click rows
 * are never pulled into memory. The grouped top-N and the per-day rollup both
 * run index-only off idx_affiliate_clicks_clicked_product (added by migration
 * 000016 -- EXPLAIN 실측 근거는 그 마이그레이션 SQL 주석 참고) and the existing
 * idx_affiliate_clicks_clicked_at.
 */
@Injectable()
export class AffiliateClickBreakdownService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async getBreakdown(days: ClickBreakdownWindow): Promise<AdminClickBreakdown> {
    const seoulToday = getSeoulToday();
    // Seoul midnight at the END of today (exclusive upper bound).
    const windowEnd = new Date(new Date(`${seoulToday}T00:00:00+09:00`).getTime() + DAY_MS);
    const windowStart = new Date(windowEnd.getTime() - days * DAY_MS);
    const window = { gte: windowStart, lt: windowEnd };

    const [windowTotalClicks, groupedRows, dailyRows] = await Promise.all([
      this.prisma.affiliateClick.count({ where: { clickedAt: window } }),
      this.prisma.affiliateClick.groupBy({
        by: ["productLinkId"],
        where: { clickedAt: window },
        _count: { _all: true },
        // Secondary key so an exact tie at the top-N boundary is deterministic
        // instead of plan-dependent.
        orderBy: [{ _count: { productLinkId: "desc" } }, { productLinkId: "asc" }],
        take: CLICK_BREAKDOWN_TOP_LIMIT
      }),
      this.prisma.$queryRaw<{ date: string; count: bigint }[]>(Prisma.sql`
        SELECT to_char(clicked_at AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD') AS date,
               COUNT(*) AS count
        FROM affiliate_clicks
        WHERE clicked_at >= ${windowStart} AND clicked_at < ${windowEnd}
        GROUP BY 1
      `)
    ]);

    const topLinks = await this.decorateLinks(groupedRows);

    const countByDate = new Map<string, number>(dailyRows.map((row) => [row.date, Number(row.count)]));
    const dailyTotals = Array.from({ length: days }, (_, index) => {
      // windowStart + N days is Seoul midnight of that calendar day, so
      // getSeoulToday() of that instant is exactly that day's date string.
      const date = getSeoulToday(new Date(windowStart.getTime() + index * DAY_MS));
      return { date, count: countByDate.get(date) ?? 0 };
    });

    return { days, windowTotalClicks, topLinks, dailyTotals };
  }

  /**
   * Resolves the grouped product-link ids to display names. Two id-keyed
   * lookups (<= CLICK_BREAKDOWN_TOP_LIMIT rows each), never a join over the
   * click table. A link/template that no longer exists degrades to null rather
   * than dropping the row -- the click really happened and its count must
   * still reconcile with windowTotalClicks.
   */
  private async decorateLinks(
    groupedRows: { productLinkId: string; _count: { _all: number } }[]
  ): Promise<AdminClickTopLink[]> {
    if (groupedRows.length === 0) return [];

    const links = await this.prisma.productLink.findMany({
      where: { id: { in: groupedRows.map((row) => row.productLinkId) } },
      select: { id: true, title: true, platform: true, itemTemplateId: true }
    });
    const linkById = new Map(links.map((link) => [link.id, link]));

    const templateIds = [...new Set(links.map((link) => link.itemTemplateId))];
    const templates =
      templateIds.length === 0
        ? []
        : await this.prisma.itemTemplate.findMany({
            where: { id: { in: templateIds } },
            select: { id: true, name: true }
          });
    const templateNameById = new Map(templates.map((template) => [template.id, template.name]));

    return groupedRows.map((row) => {
      const link = linkById.get(row.productLinkId);
      return {
        productLinkId: row.productLinkId,
        productLinkTitle: link?.title ?? null,
        itemTemplateId: link?.itemTemplateId ?? null,
        itemTemplateName: link ? templateNameById.get(link.itemTemplateId) ?? null : null,
        platform: link?.platform ?? null,
        count: row._count._all
      };
    });
  }
}
