import { Inject, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { analyticsEventRegistry } from "@wooriai/contracts";
import { getSeoulToday } from "@wooriai/domain";
import { PrismaService } from "../prisma/prisma.service";

/** ADM-009: the only two windows GET /admin/analytics/summary supports. */
export const ANALYTICS_SUMMARY_WINDOWS = [7, 30] as const;
export type AnalyticsSummaryWindow = (typeof ANALYTICS_SUMMARY_WINDOWS)[number];

export function isAnalyticsSummaryWindow(value: number): value is AnalyticsSummaryWindow {
  return (ANALYTICS_SUMMARY_WINDOWS as readonly number[]).includes(value);
}

/**
 * Convenience aliases for the KPI funnel (design doc docs/5차 §4.3): the same
 * per-event counts as `byName`, but keyed so the admin frontend never has to
 * find-by-name.
 *
 * R27(L-5): these six keys are the LEGACY set, frozen — not "one key per
 * registry event". ANA-127 appended `item_detail_viewed` and
 * `purchase_followup_answered` to the registry without alias keys, and that is
 * the intended end state: the admin funnel view reads `byName`, so new events
 * surface there and this shape stays stable for anything already reading it.
 */
export type AdminAnalyticsFunnel = {
  appOpened: number;
  onboardingCompleted: number;
  expenseRecorded: number;
  itemStatusChanged: number;
  affiliateLinkClicked: number;
  expenseSynced: number;
};

/** ADM-009: shape returned by GET /admin/analytics/summary. */
export type AdminAnalyticsSummary = {
  days: AnalyticsSummaryWindow;
  totalEvents: number;
  /** Every registry event name is always present (count 0 included), registry
   * order first; any unregistered names found in the window are appended. */
  byName: { name: string; count: number }[];
  /** One entry per Seoul-calendar day in the window (ascending, zero-filled). */
  dailyTotals: { date: string; count: number }[];
  funnel: AdminAnalyticsFunnel;
  /** count(distinct user_anon_id) in the window (null anon ids excluded). */
  uniqueAnonUsers: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * eventName -> funnel alias key.
 *
 * R27(L-5): the alias set is the six LEGACY events only — exactly the first six
 * entries of `analyticsEventRegistry` — and it does NOT (and need not) cover the
 * whole registry; the previous "Must cover every registry event name" claim has
 * been false since ANA-127 appended two events. New events are exposed through
 * `byName` alone, which is what the admin funnel view reads; do not add keys
 * here, because `funnel`'s response shape is frozen for existing readers.
 * Exported so `admin-analytics-funnel-alias.test.ts` can pin that correspondence
 * against the registry without a database.
 */
export const FUNNEL_KEY_BY_EVENT_NAME: Record<string, keyof AdminAnalyticsFunnel> = {
  app_opened: "appOpened",
  onboarding_completed: "onboardingCompleted",
  expense_recorded: "expenseRecorded",
  item_status_changed: "itemStatusChanged",
  affiliate_link_clicked: "affiliateLinkClicked",
  expense_synced: "expenseSynced"
};

/**
 * ADM-009: read-only aggregation over analytics_events for the admin KPI
 * funnel view. Deliberately three grouped/aggregate queries (Prisma groupBy +
 * two raw GROUP BY/COUNT DISTINCT) -- payloads are never read and no rows are
 * ever pulled into memory, so the endpoint stays cheap as events accumulate.
 *
 * Window semantics: the last `days` Seoul-calendar days INCLUDING today, i.e.
 * occurred_at in [Seoul midnight (days-1) days ago, next Seoul midnight).
 * `occurredAt` (event time) is used for every metric so the per-day bars, the
 * per-name counts, and totalEvents all agree with each other. Korea has no
 * DST, so fixed +09:00 day arithmetic is exact.
 */
@Injectable()
export class AnalyticsSummaryService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async getSummary(days: AnalyticsSummaryWindow): Promise<AdminAnalyticsSummary> {
    const seoulToday = getSeoulToday();
    // Seoul midnight at the END of today (exclusive upper bound).
    const windowEnd = new Date(new Date(`${seoulToday}T00:00:00+09:00`).getTime() + DAY_MS);
    const windowStart = new Date(windowEnd.getTime() - days * DAY_MS);

    const [byNameRows, dailyRows, uniqueRows] = await Promise.all([
      this.prisma.analyticsEvent.groupBy({
        by: ["eventName"],
        where: { occurredAt: { gte: windowStart, lt: windowEnd } },
        _count: { _all: true }
      }),
      this.prisma.$queryRaw<{ date: string; count: bigint }[]>(Prisma.sql`
        SELECT to_char(occurred_at AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD') AS date,
               COUNT(*) AS count
        FROM analytics_events
        WHERE occurred_at >= ${windowStart} AND occurred_at < ${windowEnd}
        GROUP BY 1
      `),
      this.prisma.$queryRaw<{ count: bigint }[]>(Prisma.sql`
        SELECT COUNT(DISTINCT user_anon_id) AS count
        FROM analytics_events
        WHERE occurred_at >= ${windowStart} AND occurred_at < ${windowEnd}
          AND user_anon_id IS NOT NULL
      `)
    ]);

    const countByName = new Map<string, number>(
      byNameRows.map((row) => [row.eventName, row._count._all])
    );

    // Registry names first (zero-filled, registry order) so the response shape
    // never depends on which events happen to exist in the window; any
    // unregistered names still in the table are appended (sorted) rather than
    // silently dropped, so totalEvents always equals the sum of byName.
    const registryNames = analyticsEventRegistry.map((entry) => entry.eventName);
    const registryNameSet = new Set(registryNames);
    const extraNames = [...countByName.keys()].filter((name) => !registryNameSet.has(name)).sort();
    const byName = [...registryNames, ...extraNames].map((name) => ({
      name,
      count: countByName.get(name) ?? 0
    }));

    const totalEvents = byName.reduce((sum, entry) => sum + entry.count, 0);

    const funnel = Object.fromEntries(
      Object.entries(FUNNEL_KEY_BY_EVENT_NAME).map(([eventName, key]) => [
        key,
        countByName.get(eventName) ?? 0
      ])
    ) as AdminAnalyticsFunnel;

    const countByDate = new Map<string, number>(
      dailyRows.map((row) => [row.date, Number(row.count)])
    );
    const dailyTotals = Array.from({ length: days }, (_, index) => {
      // windowStart + N days is Seoul midnight of that calendar day, so
      // getSeoulToday() of that instant is exactly that day's date string.
      const date = getSeoulToday(new Date(windowStart.getTime() + index * DAY_MS));
      return { date, count: countByDate.get(date) ?? 0 };
    });

    return {
      days,
      totalEvents,
      byName,
      dailyTotals,
      funnel,
      uniqueAnonUsers: Number(uniqueRows[0]?.count ?? 0)
    };
  }
}
