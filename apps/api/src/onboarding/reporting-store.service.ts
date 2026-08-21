import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import { getSeoulMonthRange } from "@wooriai/domain";
import { PrismaService } from "../prisma/prisma.service";
import type { AuthenticatedUser } from "../common/types/authenticated-request";
import { ChildAccessService } from "./child-access.service";
import { ExpensesStoreService } from "./expenses-store.service";
import { ItemsCatalogService } from "./items-catalog.service";
import {
  buildBudgetDto,
  currentYear,
  currentYearMonth,
  fromDateOnly,
  toChildDto,
  toDateOnly,
  toExpenseDto
} from "./store-shared";

/**
 * REF-118: home dashboard + report reads split out of the former
 * onboarding-store.service.ts god service. Read-only aggregation over expenses
 * (via ExpensesStoreService) and recommended items (via ItemsCatalogService);
 * public HTTP contract, error codes and response shapes are unchanged.
 */
@Injectable()
export class ReportingStoreService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ChildAccessService) private readonly childAccess: ChildAccessService,
    @Inject(ExpensesStoreService) private readonly expensesStore: ExpensesStoreService,
    @Inject(ItemsCatalogService) private readonly itemsCatalog: ItemsCatalogService
  ) {}

  async getHome(user: AuthenticatedUser, childId: string) {
    // View-access check must stay first: no data reads happen for a child the
    // caller is not allowed to see (PERF-103 kept this ordering intact).
    const child = await this.childAccess.requireChildAccess(user, childId);
    const yearMonth = currentYearMonth();
    // PERF-103: the child's expense rows are fetched ONCE (recentExpenses and
    // totalExpenseKrw both derive from `expenses`), and the four independent
    // reads run in parallel instead of serially.
    const [budget, monthlyUsedKrw, expenses, recommendedItems] = await Promise.all([
      this.prisma.budget.findUnique({
        where: { childId_yearMonth: { childId, yearMonth: toDateOnly(yearMonth) } }
      }),
      this.expensesStore.sumExpenses(childId, getSeoulMonthRange(yearMonth)),
      this.expensesStore.expensesForChild(childId),
      this.itemsCatalog.recommendedItemsForChild(childId)
    ]);

    return {
      child: toChildDto(child),
      totalExpenseKrw: this.expensesStore.totalExpenseKrw(expenses),
      monthly: buildBudgetDto(childId, yearMonth, budget?.amountKrw ?? 0, monthlyUsedKrw),
      recommendedItems: recommendedItems.slice(0, 3),
      recentExpenses: expenses.slice(0, 3).map((expense) => toExpenseDto(expense))
    };
  }

  async getMonthlyReport(user: AuthenticatedUser, childId: string, yearMonth = currentYearMonth()) {
    await this.childAccess.requireChildAccess(user, childId);
    const normalizedMonth = getSeoulMonthRange(yearMonth).yearMonth;
    const range = getSeoulMonthRange(normalizedMonth);
    const [totalExpenseKrw, budget, categoryTop] = await Promise.all([
      this.expensesStore.sumExpenses(childId, range),
      this.prisma.budget.findUnique({ where: { childId_yearMonth: { childId, yearMonth: toDateOnly(normalizedMonth) } } }),
      this.categoryBreakdown(childId, range)
    ]);

    return {
      childId,
      yearMonth: normalizedMonth,
      totalExpenseKrw,
      budgetAmountKrw: budget?.amountKrw ?? null,
      categoryTop
    };
  }

  async getYearlyReport(user: AuthenticatedUser, childId: string, year = currentYear()) {
    await this.childAccess.requireChildAccess(user, childId);
    const normalizedYear = this.requireValidYear(year);
    const rows = await this.prisma.expense.findMany({
      where: {
        childId,
        deletedAt: null,
        expenseType: "expense",
        spentOn: {
          gte: new Date(`${normalizedYear}-01-01T00:00:00.000Z`),
          lt: new Date(`${Number(normalizedYear) + 1}-01-01T00:00:00.000Z`)
        }
      },
      select: { spentOn: true, amountKrw: true }
    });

    const totalsByMonth = new Map<string, number>();
    for (const row of rows) {
      const key = fromDateOnly(row.spentOn).slice(0, 7);
      totalsByMonth.set(key, (totalsByMonth.get(key) ?? 0) + row.amountKrw);
    }

    const monthlyTotals = Array.from({ length: 12 }, (_, index) => {
      const yearMonth = `${normalizedYear}-${String(index + 1).padStart(2, "0")}`;
      return { yearMonth, totalExpenseKrw: totalsByMonth.get(yearMonth) ?? 0 };
    });

    return {
      childId,
      year: normalizedYear,
      totalExpenseKrw: monthlyTotals.reduce((sum, month) => sum + month.totalExpenseKrw, 0),
      monthlyTotals
    };
  }

  async getCumulativeReport(user: AuthenticatedUser, childId: string) {
    await this.childAccess.requireChildAccess(user, childId);
    const rows = await this.prisma.expense.findMany({
      where: { childId, deletedAt: null, expenseType: "expense" },
      select: { spentOn: true, amountKrw: true }
    });

    const yearly = new Map<string, { year: string; amountKrw: number; count: number }>();
    for (const row of rows) {
      const year = fromDateOnly(row.spentOn).slice(0, 4);
      const current = yearly.get(year) ?? { year, amountKrw: 0, count: 0 };
      current.amountKrw += row.amountKrw;
      current.count += 1;
      yearly.set(year, current);
    }

    return {
      childId,
      totalExpenseKrw: rows.reduce((sum, row) => sum + row.amountKrw, 0),
      yearly: [...yearly.values()].sort((left, right) => right.year.localeCompare(left.year))
    };
  }

  async getCategoryReport(
    user: AuthenticatedUser,
    childId: string,
    period: { yearMonth?: string; year?: string; quarter?: number } = {}
  ) {
    await this.childAccess.requireChildAccess(user, childId);
    return {
      childId,
      categories: await this.categoryBreakdown(childId, this.categoryReportRange(period))
    };
  }

  /**
   * REP-104: resolves the category report's optional period filter to a Seoul-calendar
   * date range. Exactly one period shape is accepted per request -- yearMonth (single
   * month), year (whole year), or year+quarter (calendar quarter); no period at all
   * keeps the historical all-time breakdown. Cross-field combinations the per-field
   * DTO validation cannot express are rejected here.
   */
  private categoryReportRange(period: {
    yearMonth?: string;
    year?: string;
    quarter?: number;
  }): { startInclusive: string; endExclusive: string } | undefined {
    const { yearMonth, year, quarter } = period;
    if (yearMonth && (year !== undefined || quarter !== undefined)) {
      throw new BadRequestException({
        code: "REPORT_PERIOD_INVALID",
        message: "조회 기간은 yearMonth 또는 year(+quarter) 중 하나로만 지정해 주세요."
      });
    }
    if (quarter !== undefined && year === undefined) {
      throw new BadRequestException({
        code: "REPORT_PERIOD_INVALID",
        message: "quarter는 year와 함께 지정해 주세요."
      });
    }
    if (yearMonth) return getSeoulMonthRange(yearMonth);
    if (year === undefined) return undefined;

    const normalizedYear = this.requireValidYear(year);
    const startMonth = quarter === undefined ? 1 : (quarter - 1) * 3 + 1;
    const endMonthExclusive = quarter === undefined ? 13 : startMonth + 3;
    const startInclusive = `${normalizedYear}-${String(startMonth).padStart(2, "0")}-01`;
    const endExclusive =
      endMonthExclusive > 12
        ? `${Number(normalizedYear) + 1}-01-01`
        : `${normalizedYear}-${String(endMonthExclusive).padStart(2, "0")}-01`;
    return { startInclusive, endExclusive };
  }

  private async categoryBreakdown(childId: string, range?: { startInclusive: string; endExclusive: string }) {
    const grouped = await this.prisma.expense.groupBy({
      by: ["categoryId"],
      where: {
        childId,
        deletedAt: null,
        expenseType: "expense",
        ...(range ? { spentOn: { gte: toDateOnly(range.startInclusive), lt: toDateOnly(range.endExclusive) } } : {})
      },
      _sum: { amountKrw: true },
      _count: { _all: true }
    });

    return grouped
      .map((group) => ({
        categoryId: group.categoryId,
        amountKrw: group._sum.amountKrw ?? 0,
        count: group._count._all
      }))
      .sort((left, right) => right.amountKrw - left.amountKrw);
  }

  private requireValidYear(year: string) {
    if (!/^\d{4}$/.test(year)) {
      throw new BadRequestException({ code: "YEAR_INVALID", message: "연도를 다시 확인해 주세요." });
    }
    return year;
  }
}
