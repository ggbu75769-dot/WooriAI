import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import { getSeoulToday } from "@wooriai/domain";
import { PrismaService } from "../prisma/prisma.service";
import { ChildAccessService } from "../onboarding/child-access.service";
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
 * onboarding/store-shared.ts currentYearMonth) falls before the window's end, only the
 * elapsed part [birthDate, today] is aggregated and the response carries
 * `partial: true` plus the number of days actually covered (`daysCovered`, birth day
 * counted as day 1). `startDate`/`endDate` always describe the full milestone window
 * (endDate = last day inside the window, inclusive) regardless of coverage.
 *
 * Aggregation matches the other reports exactly: soft-deleted rows excluded,
 * `expenseType: "expense"` only (gifts/refunds never count).
 *
 * ## 라운드 108 트랙 C(C-3) — 아이 인가는 이 파일이 구현하지 않는다
 *
 * 종전: 이 서비스는 "finance가 소유한 서비스는 onboarding 스토어를 고치는 대신 자기 Prisma
 * 접근과 가구 인가를 직접 든다"는 ExpensesVersionService 선례를 따라 `requireChildView`라는
 * **아이 인가의 두 번째 구현**을 들고 있었다(그때는 참 — 그 스토어들을 다른 작업이 동시에
 * 소유하고 있었다). 그 메서드의 주석 스스로가 "mirroring ChildAccessService.requireChildAccess"
 * 라고 적었고, 실제로 저장소에서 아이 인가를 두 번 구현한 유일한 자리였다.
 *
 * 지금: `ChildAccessService`를 주입해 사본을 지웠다. 두 구현을 먼저 대조한 결과 **거동이 완전히
 * 같았다** — 같은 `child.findUnique` → `!child || child.deletedAt`이면 404 CHILD_NOT_FOUND
 * ("아이 프로필을 찾을 수 없어요.") → 역할 조회(사본의 인라인 식이 `memberRoleFor`와 글자까지
 * 같았다) → 역할이 없으면 403 FORBIDDEN("아이 프로필 접근 권한이 없어요."). 사본에 없던 것은
 * `edit` 인자 하나뿐이고 리포트는 읽기라 기본값 `false`가 종전과 같은 판정이다. 응답·상태·문구
 * 어느 것도 바뀌지 않는다.
 *
 * DI는 새 배선이 필요 없다: `FinanceModule`이 이미 `OnboardingModule`을 import 하고 그 모듈이
 * `ChildAccessService`를 export 한다(같은 파일의 `ExpensesVersionService`가 이미 그 경로로
 * `ExpensesStoreService`를 주입받는다).
 */
@Injectable()
export class MilestoneReportService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ChildAccessService) private readonly childAccess: ChildAccessService
  ) {}

  async getMilestoneReport(user: AuthenticatedUser, childId: string, type: MilestoneReportType) {
    // 라운드 108 C-3: 다른 모든 아이 경로와 **같은 한 벌**을 탄다(사본 제거 — 위 머리말).
    const child = await this.childAccess.requireChildAccess(user, childId);

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

  // 라운드 108 C-3: 종전 이 자리에 `requireChildView`가 있었다 — "View-only child access check,
  // mirroring ChildAccessService.requireChildAccess"라고 스스로 적은 **아이 인가의 두 번째
  // 구현**이었다(그때는 참). 지금은 지웠고 위 생성자가 주입한 `ChildAccessService` 한 벌만
  // 남는다. 거동 대조와 DI 근거는 이 클래스 머리말에 있다.

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
