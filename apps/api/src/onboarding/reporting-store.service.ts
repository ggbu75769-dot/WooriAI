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
    // PERF-103: the independent reads run in parallel instead of serially.
    //
    // PERF-121(F1): 종전에는 아이의 **전 기간 지출 행 전량**(memo/merchant 등 본문
    // 컬럼 포함)을 한 번에 읽어 와 합계(전량 순회)와 최근 3건(slice)에만 썼다.
    // 홈·준비템 탭이 매번 호출하는 경로라 아이의 지출이 쌓일수록 전송·역직렬화
    // 비용이 선형으로 늘어난다. 같은 술어를 그대로 유지한 채 DB에 맡기는 두 쿼리로
    // 나눈다 — 합계는 SUM(행 0건 전송), 최근 3건은 같은 정렬의 LIMIT 3.
    //   - totalExpenseKrw: 전 기간 + `expenseType='expense'`(선물 제외, DNC-015)
    //     = 종전 totalExpenseKrw(expenses)의 필터·합과 동치.
    //   - recentExpenses: 선물 포함(종전 slice가 타입을 가리지 않았다), 정렬은
    //     spentOn desc, createdAt desc 그대로.
    // 두 쿼리 모두 000001의 부분 인덱스 idx_expenses_not_deleted (child_id, spent_on)
    // WHERE deleted_at IS NULL 이 서빙한다(실측: docs/operations/perf-index-notes.md
    // PERF-121 절) — 신규 인덱스 불필요.
    const [budget, monthlyUsedKrw, totalExpenseKrw, recentExpenses, recommendedItems] = await Promise.all([
      this.prisma.budget.findUnique({
        where: { childId_yearMonth: { childId, yearMonth: toDateOnly(yearMonth) } }
      }),
      this.expensesStore.sumExpenses(childId, getSeoulMonthRange(yearMonth)),
      this.expensesStore.sumExpenses(childId),
      this.expensesStore.expensesForChild(childId, undefined, 3),
      this.itemsCatalog.recommendedItemsForChild(childId)
    ]);

    return {
      child: toChildDto(child),
      totalExpenseKrw,
      monthly: buildBudgetDto(childId, yearMonth, budget?.amountKrw ?? 0, monthlyUsedKrw),
      recommendedItems: recommendedItems.slice(0, 3),
      recentExpenses: recentExpenses.map((expense) => toExpenseDto(expense))
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

  /**
   * PERF-127: 종전에는 그 해의 지출 행을 **전량** 읽어 와 JS에서 월별로 접었다 — 한 해의
   * 행 수에 상한이 없어(가져오기 한 번에 수천 건이 들어올 수 있다) 전송·역직렬화 비용이
   * 기록 수에 선형으로 늘었다. PERF-121의 getCumulativeReport와 **같은 방식**으로 바꾼다:
   * Prisma는 파생식(월 추출) 기준 groupBy를 표현할 수 없으므로 spentOn(일자) 기준으로 DB에서
   * 먼저 접고, 일자→월 접기만 JS에 남긴다. 전송 행 수가 "지출 건수"에서 "지출이 있었던
   * 날짜 수"로 줄고(한 해라 366행이 상한), 합계는 DB의 SUM이 낸다. 필터(deletedAt null,
   * expenseType='expense' — 선물 제외 DNC-015), 연도 경계(UTC 저장 date-only를 fromDateOnly로
   * 자르는 방식), 12개월 채움, 응답 형태 모두 종전과 동치다.
   */
  async getYearlyReport(user: AuthenticatedUser, childId: string, year = currentYear()) {
    await this.childAccess.requireChildAccess(user, childId);
    const normalizedYear = this.requireValidYear(year);
    const byDay = await this.prisma.expense.groupBy({
      by: ["spentOn"],
      where: {
        childId,
        deletedAt: null,
        expenseType: "expense",
        spentOn: {
          gte: new Date(`${normalizedYear}-01-01T00:00:00.000Z`),
          lt: new Date(`${Number(normalizedYear) + 1}-01-01T00:00:00.000Z`)
        }
      },
      _sum: { amountKrw: true }
    });

    const totalsByMonth = new Map<string, number>();
    for (const day of byDay) {
      const key = fromDateOnly(day.spentOn).slice(0, 7);
      totalsByMonth.set(key, (totalsByMonth.get(key) ?? 0) + (day._sum.amountKrw ?? 0));
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

  /**
   * PERF-121(F2): 종전에는 아이의 전 기간 지출 행을 모두 읽어 JS에서 연도별로
   * 접었다 — 누적 리포트는 정의상 "전 기간"이라 행 수에 상한이 없다. Prisma는
   * 파생식(연도 추출) 기준 groupBy를 표현할 수 없으므로 **spentOn(일자) 기준**으로
   * DB에서 먼저 접고, 일자→연도 접기만 JS에 남긴다. 전송 행 수가 "지출 건수"에서
   * "지출이 있었던 날짜 수"로 줄고(달력일이 상한), 합계·건수는 DB의 SUM/COUNT가
   * 낸다. 필터(deletedAt null, expenseType='expense' — 선물 제외 DNC-015), 연도
   * 경계(UTC 저장 date-only를 fromDateOnly로 자르는 방식), 내림차순 정렬, 응답
   * 형태 모두 종전과 동치다.
   */
  async getCumulativeReport(user: AuthenticatedUser, childId: string) {
    await this.childAccess.requireChildAccess(user, childId);
    const byDay = await this.prisma.expense.groupBy({
      by: ["spentOn"],
      where: { childId, deletedAt: null, expenseType: "expense" },
      _sum: { amountKrw: true },
      _count: { _all: true }
    });

    const yearly = new Map<string, { year: string; amountKrw: number; count: number }>();
    for (const day of byDay) {
      const year = fromDateOnly(day.spentOn).slice(0, 4);
      const current = yearly.get(year) ?? { year, amountKrw: 0, count: 0 };
      current.amountKrw += day._sum.amountKrw ?? 0;
      current.count += day._count._all;
      yearly.set(year, current);
    }

    return {
      childId,
      totalExpenseKrw: [...yearly.values()].reduce((sum, entry) => sum + entry.amountKrw, 0),
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
