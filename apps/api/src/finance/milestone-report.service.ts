import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { getSeoulToday, type MemberRole } from "@wooriai/domain";
import { PrismaService } from "../prisma/prisma.service";
import type { AuthenticatedUser } from "../common/types/authenticated-request";
import type { MilestoneReportType } from "./dto/milestone-query.dto";

/**
 * REP-103 "우리 아이 100일 비용 리포트" -- milestone cost summary the parent can share.
 *
 * Window definitions (Seoul calendar, half-open):
 *   d100:            [birthDate, birthDate + 100 days)
 *   first-birthday:  [birthDate, birthDate + 1 year)
 *
 * If "today" (Seoul; WOORIAI_STAGE_TODAY override honored, same convention as
 * OnboardingStoreService.currentYearMonth) falls before the window's end, only the
 * elapsed part [birthDate, today] is aggregated and the response carries
 * `partial: true` plus the number of days actually covered (`daysCovered`, birth day
 * counted as day 1). `startDate`/`endDate` always describe the full milestone window
 * (endDate = last day inside the window, inclusive) regardless of coverage.
 *
 * Aggregation matches the other reports exactly: soft-deleted rows excluded,
 * `expenseType: "expense"` only (gifts/refunds never count).
 *
 * Follows the ExpensesVersionService precedent of a finance-owned service that does
 * its own Prisma access + household authorization instead of editing
 * onboarding-store.service.ts (owned by concurrent work).
 */
@Injectable()
export class MilestoneReportService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async getMilestoneReport(user: AuthenticatedUser, childId: string, type: MilestoneReportType) {
    const child = await this.requireChildView(user, childId);

    if (!child.birthDate) {
      throw new BadRequestException({
        code: "MILESTONE_UNAVAILABLE",
        message: "아이 생년월일이 등록되어야 100일/첫돌 리포트를 만들 수 있어요. 아이 프로필에서 생년월일을 입력해 주세요."
      });
    }

    const startDate = dateOnlyOf(child.birthDate);
    const windowEndExclusive = type === "d100" ? addDays(startDate, 100) : addYears(startDate, 1);
    const today = this.seoulToday();

    // Coverage ends at min(window end, the day after today); clamped so a (theoretical)
    // future birth date yields an empty range instead of a negative one.
    const dayAfterToday = addDays(today, 1);
    const coveredEndExclusive = maxDateOnly(startDate, minDateOnly(windowEndExclusive, dayAfterToday));
    const partial = coveredEndExclusive < windowEndExclusive;
    const daysCovered = diffDays(startDate, coveredEndExclusive);

    const where = {
      childId,
      deletedAt: null,
      expenseType: "expense" as const,
      spentOn: { gte: toUtcDate(startDate), lt: toUtcDate(coveredEndExclusive) }
    };

    const [totals, grouped] = await Promise.all([
      this.prisma.expense.aggregate({ where, _sum: { amountKrw: true }, _count: { _all: true } }),
      this.prisma.expense.groupBy({ by: ["categoryId"], where, _sum: { amountKrw: true } })
    ]);

    const totalKrw = totals._sum.amountKrw ?? 0;
    const expenseCount = totals._count._all;

    const topGroups = grouped
      .map((group) => ({ categoryId: group.categoryId, totalKrw: group._sum.amountKrw ?? 0 }))
      .sort((left, right) => right.totalKrw - left.totalKrw)
      .slice(0, 5);

    const categories =
      topGroups.length === 0
        ? []
        : await this.prisma.category.findMany({
            where: { id: { in: topGroups.map((group) => group.categoryId) } },
            select: { id: true, code: true, name: true }
          });
    const categoryById = new Map(categories.map((category) => [category.id, category]));

    return {
      childId,
      type,
      startDate,
      endDate: addDays(windowEndExclusive, -1),
      partial,
      daysCovered,
      totalKrw,
      expenseCount,
      topCategories: topGroups.map((group) => ({
        categoryId: group.categoryId,
        code: categoryById.get(group.categoryId)?.code ?? "unknown",
        name: categoryById.get(group.categoryId)?.name ?? "기타",
        totalKrw: group.totalKrw,
        // Share of the window's total, as a fraction rounded to 3 decimal places.
        share: totalKrw > 0 ? Math.round((group.totalKrw / totalKrw) * 1000) / 1000 : 0
      })),
      avgDailyKrw: daysCovered > 0 ? Math.round(totalKrw / daysCovered) : 0
    };
  }

  /** View-only child access check, mirroring OnboardingStoreService.requireChildAccess. */
  private async requireChildView(user: AuthenticatedUser, childId: string) {
    const child = await this.prisma.child.findUnique({ where: { id: childId } });
    if (!child || child.deletedAt) {
      throw new NotFoundException({ code: "CHILD_NOT_FOUND", message: "아이 프로필을 찾을 수 없어요." });
    }
    const role: MemberRole | null =
      user.households.find((household) => household.id === child.householdId)?.role ?? null;
    if (!role) {
      throw new ForbiddenException({ code: "FORBIDDEN", message: "아이 프로필 접근 권한이 없어요." });
    }
    return child;
  }

  /** Seoul-calendar "today", honoring the WOORIAI_STAGE_TODAY test/dev override. */
  private seoulToday(): string {
    return process.env.WOORIAI_STAGE_TODAY ?? getSeoulToday();
  }
}

// ---------------------------------------------------------------------------
// Date-only (YYYY-MM-DD) calendar arithmetic. All math is done in UTC on the
// date-only string, which is safe for pure calendar-day arithmetic -- timezone
// resolution already happened when the string was produced (Seoul calendar,
// see getSeoulToday / the DB's date-only spentOn columns).
// ---------------------------------------------------------------------------

const DAY_MS = 86_400_000;

function toUtcDate(dateOnly: string): Date {
  return new Date(`${dateOnly}T00:00:00.000Z`);
}

function dateOnlyOf(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDays(dateOnly: string, days: number): string {
  return dateOnlyOf(new Date(toUtcDate(dateOnly).getTime() + days * DAY_MS));
}

/** Calendar-year addition; Feb 29 rolls forward to Mar 1 in non-leap years. */
function addYears(dateOnly: string, years: number): string {
  const date = toUtcDate(dateOnly);
  date.setUTCFullYear(date.getUTCFullYear() + years);
  return dateOnlyOf(date);
}

function diffDays(startInclusive: string, endExclusive: string): number {
  return Math.max(0, Math.round((toUtcDate(endExclusive).getTime() - toUtcDate(startInclusive).getTime()) / DAY_MS));
}

function minDateOnly(left: string, right: string): string {
  return left < right ? left : right;
}

function maxDateOnly(left: string, right: string): string {
  return left > right ? left : right;
}
