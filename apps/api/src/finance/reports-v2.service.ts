import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { explainBudgetVariance, resolveReportV3State } from "@wooriai/domain";
import type { Expense, ExpenseType } from "@prisma/client";
import type { AuthenticatedUser } from "../common/types/authenticated-request";
import { PrismaService } from "../prisma/prisma.service";
import type { ReportRangeQueryDto, ReportSourcesQueryDto } from "./dto/reports-v2.dto";
import { AppConfigService } from "../app-config/app-config.service";

type LedgerRow = Pick<Expense, "id" | "childId" | "householdId" | "createdByUserId" | "payerUserId" | "categoryId" | "expenseCategoryV2Id" | "linkedItemDefinitionId" | "amountKrw" | "spentOn" | "itemName" | "merchant" | "expenseType">;
type Totals = {
  expenseKrw: number;
  giftKrw: number;
  refundKrw: number;
  supportKrw: number;
  netHouseholdOutflowKrw: number;
  linkedPreparationCostKrw: number;
  unlinkedCostKrw: number;
  recordCount: number;
};

const legacyCategoryMap: Record<string, string> = {
  pregnancy_mother: "pregnancy_mother_health",
  birth_postpartum: "birth_postpartum",
  hospital_checkup: "hospital_health",
  mobile_hospital_checkup: "hospital_health",
  diaper_hygiene: "diaper_hygiene",
  mobile_diaper_hygiene: "diaper_hygiene",
  feeding_babyfood: "feeding_food",
  mobile_feeding_dairy: "feeding_food",
  mobile_feeding_meal: "feeding_food",
  clothes_laundry: "clothes_shoes_laundry",
  mobile_clothes_laundry: "clothes_shoes_laundry",
  sleep_furniture: "sleep_furniture_storage",
  outing_mobility: "outing_mobility_travel",
  mobile_outing_mobility: "outing_mobility_travel",
  toys_books: "play_books_development",
  mobile_toys_books: "play_books_development",
  care_education: "care_education",
  insurance_savings: "insurance_savings"
};

const necessityLabels = {
  required: "필수 준비",
  recommended: "권장 준비",
  conditional: "상황별 준비",
  optional: "선택 준비",
  unknown: "기타 준비"
} as const;

function dateOnly(value: Date) {
  return value.toISOString().slice(0, 10);
}

function monthKey(value: Date) {
  return dateOnly(value).slice(0, 7);
}

function parseDateOnly(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) || dateOnly(parsed) !== value ? null : parsed;
}

export type ReportPeriodKind = "month" | "quarter" | "year" | "custom";
export type ResolvedReportPeriod = {
  kind: ReportPeriodKind;
  anchor: string;
  periodStart: string;
  periodEnd: string;
  periodEndExclusive: string;
  timezone: "Asia/Seoul";
  currency: "KRW";
  from: string;
  to: string;
};

export function resolveReportPeriod(input: Pick<ReportRangeQueryDto, "period" | "anchor" | "from" | "to">): ResolvedReportPeriod {
  const hasNamedPeriod = Boolean(input.period || input.anchor);
  const hasCustomRange = Boolean(input.from || input.to);
  if (hasNamedPeriod && hasCustomRange) {
    throw new BadRequestException({ code: "REPORT_PERIOD_AMBIGUOUS", message: "Use a named period or a custom range, not both." });
  }
  if (hasNamedPeriod) {
    if (!input.period || !input.anchor) {
      throw new BadRequestException({ code: "REPORT_PERIOD_INCOMPLETE", message: "Named reports require period and anchor." });
    }
    const anchor = parseDateOnly(input.anchor);
    if (!anchor) throw new BadRequestException({ code: "REPORT_ANCHOR_INVALID", message: "Invalid report anchor." });
    const year = anchor.getUTCFullYear();
    const month = anchor.getUTCMonth();
    const start = input.period === "month"
      ? new Date(Date.UTC(year, month, 1))
      : input.period === "quarter"
        ? new Date(Date.UTC(year, Math.floor(month / 3) * 3, 1))
        : new Date(Date.UTC(year, 0, 1));
    const endExclusive = input.period === "month"
      ? new Date(Date.UTC(year, month + 1, 1))
      : input.period === "quarter"
        ? new Date(Date.UTC(year, Math.floor(month / 3) * 3 + 3, 1))
        : new Date(Date.UTC(year + 1, 0, 1));
    const from = dateOnly(start);
    const to = dateOnly(new Date(endExclusive.getTime() - 86_400_000));
    return {
      kind: input.period,
      anchor: input.anchor,
      periodStart: from,
      periodEnd: to,
      periodEndExclusive: dateOnly(endExclusive),
      timezone: "Asia/Seoul",
      currency: "KRW",
      from,
      to
    };
  }
  if (!input.from || !input.to) {
    throw new BadRequestException({ code: "REPORT_RANGE_INCOMPLETE", message: "Custom reports require from and to." });
  }
  if (!parseDateOnly(input.from) || !parseDateOnly(input.to)) {
    throw new BadRequestException({ code: "REPORT_RANGE_INVALID", message: "Invalid report date range." });
  }
  return {
    kind: "custom",
    anchor: input.from,
    periodStart: input.from,
    periodEnd: input.to,
    periodEndExclusive: dateOnly(new Date(parseDateOnly(input.to)!.getTime() + 86_400_000)),
    timezone: "Asia/Seoul",
    currency: "KRW",
    from: input.from,
    to: input.to
  };
}

export function previousReportPeriod(period: ResolvedReportPeriod): ResolvedReportPeriod | null {
  if (period.kind === "custom") return null;
  const currentStart = parseDateOnly(period.periodStart);
  if (!currentStart) return null;
  const year = currentStart.getUTCFullYear();
  const month = currentStart.getUTCMonth();
  const start = period.kind === "month"
    ? new Date(Date.UTC(year, month - 1, 1))
    : period.kind === "quarter"
      ? new Date(Date.UTC(year, month - 3, 1))
      : new Date(Date.UTC(year - 1, 0, 1));
  const end = new Date(currentStart.getTime() - 86_400_000);
  const from = dateOnly(start);
  const to = dateOnly(end);
  return {
    kind: period.kind,
    anchor: from,
    periodStart: from,
    periodEnd: to,
    periodEndExclusive: period.periodStart,
    timezone: "Asia/Seoul",
    currency: "KRW",
    from,
    to
  };
}

function emptyTotals(): Totals {
  return { expenseKrw: 0, giftKrw: 0, refundKrw: 0, supportKrw: 0, netHouseholdOutflowKrw: 0, linkedPreparationCostKrw: 0, unlinkedCostKrw: 0, recordCount: 0 };
}

function addRow(total: Totals, row: LedgerRow) {
  if (row.expenseType === "expense") total.expenseKrw += row.amountKrw;
  else if (row.expenseType === "gift") total.giftKrw += row.amountKrw;
  else if (row.expenseType === "refund") total.refundKrw += row.amountKrw;
  else total.supportKrw += row.amountKrw;
  const signed = row.expenseType === "expense" ? row.amountKrw : row.expenseType === "refund" || row.expenseType === "support" ? -row.amountKrw : 0;
  total.netHouseholdOutflowKrw += signed;
  if (row.linkedItemDefinitionId) total.linkedPreparationCostKrw += signed;
  else total.unlinkedCostKrw += signed;
  total.recordCount += 1;
  return total;
}

function totalsFor(rows: LedgerRow[]) {
  return rows.reduce(addRow, emptyTotals());
}

function signedLedgerAmount(row: LedgerRow) {
  if (row.expenseType === "expense") return row.amountKrw;
  if (row.expenseType === "refund" || row.expenseType === "support") return -row.amountKrw;
  return 0;
}

function percentages(values: number[]) {
  const positive = values.map((value) => Math.max(0, value));
  const total = positive.reduce((sum, value) => sum + value, 0);
  if (total === 0) return positive.map(() => 0);
  let assigned = 0;
  return positive.map((value, index) => {
    const percentage = index === positive.length - 1 ? Math.max(0, Math.round((100 - assigned) * 100) / 100) : Math.round((value / total) * 10000) / 100;
    assigned += percentage;
    return percentage;
  });
}

function normalizedRecurringKey(value: string) {
  return value.normalize("NFKC").toLocaleLowerCase("ko-KR").replace(/[\s\p{P}\p{S}]/gu, "");
}

@Injectable()
export class ReportsV2Service {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AppConfigService) private readonly appConfig?: AppConfigService
  ) {}

  private range(input: Pick<ReportRangeQueryDto, "period" | "anchor" | "from" | "to">) {
    const period = resolveReportPeriod(input);
    const start = parseDateOnly(period.from);
    const end = parseDateOnly(period.to);
    if (!start || !end || start > end) throw new BadRequestException({ code: "REPORT_RANGE_INVALID", message: "Invalid report date range." });
    const days = Math.floor((end.getTime() - start.getTime()) / 86_400_000) + 1;
    if (days > 366) throw new BadRequestException({ code: "REPORT_RANGE_TOO_LARGE", message: "Report range cannot exceed 366 days." });
    const endExclusive = new Date(end.getTime() + 86_400_000);
    return { start, end, endExclusive, period };
  }

  private async requireChild(user: AuthenticatedUser, childId: string) {
    const child = await this.prisma.child.findUnique({ where: { id: childId }, select: { id: true, householdId: true, deletedAt: true } });
    if (!child || child.deletedAt) throw new NotFoundException({ code: "CHILD_NOT_FOUND", message: "Child not found." });
    const membership = user.households.find((household) => household.id === child.householdId);
    if (!membership) {
      throw new ForbiddenException({ code: "HOUSEHOLD_FORBIDDEN", message: "Household access is required." });
    }
    if (membership.role === "gift_participant") {
      throw new ForbiddenException({ code: "REPORT_PRIVATE", message: "Household financial reports are not available to gift participants." });
    }
    return child;
  }

  private async scopeBase(user: AuthenticatedUser, query: ReportRangeQueryDto) {
    const child = await this.requireChild(user, query.childId);
    const range = this.range(query);
    return {
      child,
      range,
      period: {
        householdId: child.householdId,
        childId: query.childId,
        ...range.period
      }
    };
  }

  private async scope(user: AuthenticatedUser, query: ReportRangeQueryDto) {
    const base = await this.scopeBase(user, query);
    const rows = await this.prisma.expense.findMany({
      where: { childId: query.childId, householdId: base.child.householdId, deletedAt: null, spentOn: { gte: base.range.start, lt: base.range.endExclusive } },
      orderBy: [{ spentOn: "desc" }, { createdAt: "desc" }],
      select: { id: true, childId: true, householdId: true, createdByUserId: true, payerUserId: true, categoryId: true, expenseCategoryV2Id: true, linkedItemDefinitionId: true, amountKrw: true, spentOn: true, itemName: true, merchant: true, expenseType: true }
    });
    return { ...base, rows };
  }

  private maturity(rows: LedgerRow[]) {
    const distinctMonths = new Set(rows.map((row) => monthKey(row.spentOn))).size;
    const distinctMembers = new Set(rows.map((row) => row.createdByUserId)).size;
    const showCategories = rows.length >= 3;
    const showTrend = distinctMonths >= 2;
    const showRecurring = distinctMonths >= 3;
    const showMembers = distinctMembers >= 2;
    const showAnnual = distinctMonths >= 12;
    const level = rows.length === 0 ? "empty" : rows.length < 3 ? "sparse" : showAnnual ? "annual" : showRecurring ? "recurring" : showTrend ? "trend" : "categorized";
    return { recordCount: rows.length, distinctMonths, distinctMembers, level, showCategories, showTrend, showRecurring, showMembers, showAnnual } as const;
  }

  async summary(user: AuthenticatedUser, query: ReportRangeQueryDto) {
    const scoped = await this.scope(user, query);
    const currentTotals = totalsFor(scoped.rows);
    const categoryFor = await this.categoryIndex(scoped.rows);
    const categoryGroups = new Map<string, { categoryCode: string; categoryNameKo: string; rows: LedgerRow[] }>();
    for (const row of scoped.rows) {
      const category = categoryFor(row);
      const group = categoryGroups.get(category.code) ?? {
        categoryCode: category.code,
        categoryNameKo: category.nameKo,
        rows: []
      };
      group.rows.push(row);
      categoryGroups.set(category.code, group);
    }
    const categoryRows = [...categoryGroups.values()]
      .map((group) => ({ ...group, totals: totalsFor(group.rows) }))
      .sort((left, right) => right.totals.netHouseholdOutflowKrw - left.totals.netHouseholdOutflowKrw);
    const categoryPercentages = percentages(categoryRows.map((group) => group.totals.netHouseholdOutflowKrw));
    const categoryBreakdown = categoryRows.map((group, index) => ({
      categoryCode: group.categoryCode,
      categoryNameKo: group.categoryNameKo,
      ...group.totals,
      percentage: categoryPercentages[index]
    }));
    const seriesUnit = scoped.period.kind === "quarter" || scoped.period.kind === "year" ? "month" : "day";
    const seriesGroups = new Map<string, LedgerRow[]>();
    for (const row of scoped.rows) {
      const key = seriesUnit === "month" ? monthKey(row.spentOn) : dateOnly(row.spentOn);
      seriesGroups.set(key, [...(seriesGroups.get(key) ?? []), row]);
    }
    const series = [...seriesGroups.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, rows]) => ({ key, label: seriesUnit === "month" ? `${Number(key.slice(5))}월` : key.slice(5).replace("-", "/"), ...totalsFor(rows) }));
    const dataMaturity = this.maturity(scoped.rows);
    const previousPeriod = previousReportPeriod(scoped.range.period);
    const previousRows = previousPeriod
      ? await this.prisma.expense.findMany({
          where: {
            childId: query.childId,
            householdId: scoped.child.householdId,
            deletedAt: null,
            spentOn: {
              gte: parseDateOnly(previousPeriod.from)!,
              lt: new Date(parseDateOnly(previousPeriod.to)!.getTime() + 86_400_000)
            }
          },
          select: { id: true, childId: true, householdId: true, createdByUserId: true, payerUserId: true, categoryId: true, expenseCategoryV2Id: true, linkedItemDefinitionId: true, amountKrw: true, spentOn: true, itemName: true, merchant: true, expenseType: true }
        })
      : null;
    const previousTotals = previousRows ? totalsFor(previousRows) : null;
    const deltaKrw = previousTotals ? currentTotals.netHouseholdOutflowKrw - previousTotals.netHouseholdOutflowKrw : 0;
    return {
      period: scoped.period,
      totals: currentTotals,
      periodStart: scoped.period.periodStart,
      periodEndExclusive: scoped.period.periodEndExclusive,
      timezone: scoped.period.timezone,
      currency: scoped.period.currency,
      expenseTotal: currentTotals.expenseKrw,
      refundTotal: currentTotals.refundKrw,
      giftTotal: currentTotals.giftKrw,
      supportTotal: currentTotals.supportKrw,
      netOutflow: currentTotals.netHouseholdOutflowKrw,
      categoryBreakdown,
      series,
      dataMaturity,
      previousPeriodComparison: previousPeriod && previousTotals ? {
        periodStart: previousPeriod.periodStart,
        periodEnd: previousPeriod.periodEnd,
        currentNetOutflowKrw: currentTotals.netHouseholdOutflowKrw,
        previousNetOutflowKrw: previousTotals.netHouseholdOutflowKrw,
        deltaKrw,
        deltaPercentage: previousTotals.netHouseholdOutflowKrw === 0
          ? null
          : Math.round((deltaKrw / previousTotals.netHouseholdOutflowKrw) * 1000) / 10
      } : null,
      maturity: dataMaturity,
      recent: scoped.rows.slice(0, 5).map((row) => ({ id: row.id, spentOn: dateOnly(row.spentOn), itemName: row.itemName, expenseType: row.expenseType, amountKrw: row.amountKrw }))
    };
  }

  private async categoryIndex(rows: LedgerRow[]) {
    const [v2, legacy] = await Promise.all([
      this.prisma.expenseCategoryV2.findMany({ where: { OR: [{ id: { in: rows.flatMap((row) => row.expenseCategoryV2Id ? [row.expenseCategoryV2Id] : []) } }, { householdId: null }] }, select: { id: true, code: true, nameKo: true } }),
      this.prisma.category.findMany({ where: { id: { in: rows.map((row) => row.categoryId) } }, select: { id: true, code: true } })
    ]);
    const v2ById = new Map(v2.map((entry) => [entry.id, entry]));
    const v2ByCode = new Map(v2.map((entry) => [entry.code, entry]));
    const legacyById = new Map(legacy.map((entry) => [entry.id, entry.code]));
    return (row: LedgerRow) => {
      const direct = row.expenseCategoryV2Id ? v2ById.get(row.expenseCategoryV2Id) : undefined;
      if (direct) return direct;
      const code = legacyCategoryMap[legacyById.get(row.categoryId) ?? ""] ?? "other";
      return v2ByCode.get(code) ?? { id: "other", code: "other", nameKo: "기타" };
    };
  }

  async categories(user: AuthenticatedUser, query: ReportRangeQueryDto) {
    const scoped = await this.scope(user, query);
    const categoryFor = await this.categoryIndex(scoped.rows);
    const grouped = new Map<string, { categoryId: string; categoryCode: string; categoryNameKo: string; rows: LedgerRow[] }>();
    for (const row of scoped.rows) {
      const category = categoryFor(row);
      const group = grouped.get(category.code) ?? { categoryId: category.id, categoryCode: category.code, categoryNameKo: category.nameKo, rows: [] };
      group.rows.push(row);
      grouped.set(category.code, group);
    }
    let categories = [...grouped.values()].map((group) => ({ ...group, totals: totalsFor(group.rows) })).sort((left, right) => right.totals.netHouseholdOutflowKrw - left.totals.netHouseholdOutflowKrw);
    if (categories.length > 6) {
      const overflow = categories.slice(5);
      categories = [...categories.slice(0, 5), { categoryId: "other", categoryCode: "other", categoryNameKo: "기타", rows: overflow.flatMap((group) => group.rows), totals: totalsFor(overflow.flatMap((group) => group.rows)) }];
    }
    const shares = percentages(categories.map((category) => category.totals.netHouseholdOutflowKrw));
    const result = categories.map((category, index) => ({ categoryId: category.categoryId, categoryCode: category.categoryCode, categoryNameKo: category.categoryNameKo, ...category.totals, percentage: shares[index] }));
    return { period: scoped.period, categories: result, percentageTotal: Math.round(result.reduce((sum, row) => sum + row.percentage, 0) * 100) / 100, maturity: this.maturity(scoped.rows) };
  }

  async trend(user: AuthenticatedUser, query: ReportRangeQueryDto, unit: "day" | "month") {
    const scoped = await this.scope(user, query);
    const grouped = new Map<string, LedgerRow[]>();
    for (const row of scoped.rows) {
      const key = unit === "month" ? monthKey(row.spentOn) : dateOnly(row.spentOn);
      grouped.set(key, [...(grouped.get(key) ?? []), row]);
    }
    const buckets = [...grouped.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([key, rows]) => ({ key, label: unit === "month" ? `${Number(key.slice(5))}월` : key.slice(5).replace("-", "/"), ...totalsFor(rows) }));
    return { period: scoped.period, unit, buckets, maturity: this.maturity(scoped.rows) };
  }

  async members(user: AuthenticatedUser, query: ReportRangeQueryDto) {
    const scoped = await this.scope(user, query);
    const grouped = new Map<string, LedgerRow[]>();
    for (const row of scoped.rows) grouped.set(row.createdByUserId, [...(grouped.get(row.createdByUserId) ?? []), row]);
    const users = await this.prisma.user.findMany({ where: { id: { in: [...grouped.keys()] } }, select: { id: true, displayName: true } });
    const names = new Map(users.map((entry) => [entry.id, entry.displayName ?? "가족"]));
    const raw = [...grouped.entries()].map(([userId, rows]) => ({ userId, displayName: names.get(userId) ?? "가족", ...totalsFor(rows) })).sort((left, right) => right.netHouseholdOutflowKrw - left.netHouseholdOutflowKrw);
    const shares = percentages(raw.map((entry) => entry.netHouseholdOutflowKrw));
    const members = raw.map((entry, index) => ({ ...entry, percentage: shares[index] }));
    return { period: scoped.period, members, percentageTotal: Math.round(members.reduce((sum, row) => sum + row.percentage, 0) * 100) / 100, maturity: this.maturity(scoped.rows) };
  }

  async preparation(user: AuthenticatedUser, query: ReportRangeQueryDto) {
    const scoped = await this.scope(user, query);
    const linkedRows = scoped.rows.filter((row) => row.linkedItemDefinitionId);
    const definitions = await this.prisma.itemDefinition.findMany({ where: { id: { in: linkedRows.map((row) => row.linkedItemDefinitionId!) } }, select: { id: true, necessity: true } });
    const necessityById = new Map(definitions.map((entry) => [entry.id, entry.necessity]));
    const grouped = new Map<keyof typeof necessityLabels, LedgerRow[]>();
    for (const row of linkedRows) {
      const necessity = necessityById.get(row.linkedItemDefinitionId!) ?? "unknown";
      grouped.set(necessity, [...(grouped.get(necessity) ?? []), row]);
    }
    const plans = await this.prisma.userItemPlan.aggregate({ where: { householdId: scoped.child.householdId, childId: query.childId, state: { in: ["need", "researching", "planned", "ordered", "replacement_needed"] } }, _sum: { budgetKrw: true } });
    const groups = [...grouped.entries()].map(([necessity, rows]) => ({ necessity, label: necessityLabels[necessity], ...totalsFor(rows) })).sort((left, right) => right.netHouseholdOutflowKrw - left.netHouseholdOutflowKrw);
    return { period: scoped.period, groups, plannedBudgetKrw: plans._sum.budgetKrw ?? 0, maturity: this.maturity(scoped.rows) };
  }

  async v3(user: AuthenticatedUser, query: ReportRangeQueryDto) {
    const scoped = await this.scope(user, query);
    const plans = await this.prisma.userItemPlan.findMany({
      where: {
        householdId: scoped.child.householdId,
        childId: query.childId,
        state: { notIn: ["not_considered", "not_needed", "retired", "ended"] }
      }
    });
    const scheduledPlans = plans.filter((plan) => plan.dueDate && plan.dueDate >= scoped.range.start && plan.dueDate < scoped.range.endExclusive);
    const unscheduledPlans = plans.filter((plan) => !plan.dueDate);
    const reportPlans = [...scheduledPlans, ...unscheduledPlans];
    const unscheduledPlanCount = unscheduledPlans.length;
    const definitions = await this.prisma.itemDefinition.findMany({
      where: { id: { in: [...new Set([...plans.map((plan) => plan.itemDefinitionId), ...scoped.rows.flatMap((row) => row.linkedItemDefinitionId ? [row.linkedItemDefinitionId] : [])])] } },
      select: { id: true, necessity: true }
    });
    const necessityByItem = new Map(definitions.map((definition) => [definition.id, definition.necessity]));
    const splitFor = (necessity: string | undefined) => necessity === "required" ? "essential" as const : necessity === "optional" ? "optional" as const : "convenience" as const;
    const linkedRows = scoped.rows.filter((row) => row.linkedItemDefinitionId);
    const splits = (["essential", "convenience", "optional"] as const).map((key) => {
      const planRows = reportPlans.filter((plan) => splitFor(necessityByItem.get(plan.itemDefinitionId)) === key);
      const expenseRows = linkedRows.filter((row) => splitFor(necessityByItem.get(row.linkedItemDefinitionId!)) === key);
      const plannedCostKrw = planRows.reduce((sum, plan) => sum + (plan.budgetKrw ?? 0), 0);
      const actualCostKrw = totalsFor(expenseRows).netHouseholdOutflowKrw;
      return { key, plannedCostKrw, actualCostKrw, remainingPlannedCostKrw: Math.max(0, plannedCostKrw - Math.max(0, actualCostKrw)), planCount: planRows.length, recordCount: expenseRows.length };
    });
    const plannedPreparationCostKrw = splits.reduce((sum, row) => sum + row.plannedCostKrw, 0);
    const actualPreparationTotals = totalsFor(linkedRows);
    const actualPreparationCostKrw = actualPreparationTotals.netHouseholdOutflowKrw;
    const recurringPlans = plans.filter((plan) => plan.recurringIntervalDays && (!plan.dueDate || plan.dueDate < scoped.range.endExclusive));
    const reportRecurringPlans = reportPlans.filter((plan) => plan.recurringIntervalDays);
    const recurringItemIds = new Set(recurringPlans.map((plan) => plan.itemDefinitionId));
    const recurringActualRows = linkedRows.filter((row) => recurringItemIds.has(row.linkedItemDefinitionId!));
    const monthlyRecurringEstimateKrw = recurringPlans.reduce((sum, plan) => sum + Math.round((plan.budgetKrw ?? 0) * 30.4375 / plan.recurringIntervalDays!), 0);
    const payerGroups = new Map<string, LedgerRow[]>();
    for (const row of scoped.rows) {
      const payerId = row.payerUserId ?? row.createdByUserId;
      payerGroups.set(payerId, [...(payerGroups.get(payerId) ?? []), row]);
    }
    const payerUsers = await this.prisma.user.findMany({ where: { id: { in: [...payerGroups.keys()] } }, select: { id: true, displayName: true } });
    const payerNames = new Map(payerUsers.map((entry) => [entry.id, entry.displayName ?? "가족"]));
    const payerRaw = [...payerGroups.entries()].map(([payerUserId, rows]) => ({ payerUserId, displayName: payerNames.get(payerUserId) ?? "가족", ...totalsFor(rows) })).sort((left, right) => right.netHouseholdOutflowKrw - left.netHouseholdOutflowKrw);
    const payerShares = percentages(payerRaw.map((row) => row.netHouseholdOutflowKrw));
    const payerContributions = payerRaw.map((row, index) => ({ ...row, percentage: payerShares[index] }));
    const maturity = this.maturity(scoped.rows);
    const remainingPlannedCostKrw = Math.max(0, plannedPreparationCostKrw - Math.max(0, actualPreparationCostKrw));
    const linkedExpenseRows = linkedRows.filter((row) => row.expenseType === "expense");
    const forecastReady = scheduledPlans.filter((plan) => plan.budgetKrw !== null).length >= 3 && linkedExpenseRows.length >= 3;
    const forecast = forecastReady ? {
      basis: "scheduled_plan_budget_minus_period_linked_net_cost",
      rangeLowKrw: remainingPlannedCostKrw,
      rangeHighKrw: remainingPlannedCostKrw + monthlyRecurringEstimateKrw,
      scheduledPlanCount: scheduledPlans.length,
      linkedRecordCount: linkedExpenseRows.length,
      horizon: { from: scoped.period.periodStart, to: scoped.period.periodEnd },
      confidence: "limited" as const
    } : null;
    const ledger = totalsFor(scoped.rows);
    const categoryFor = await this.categoryIndex(scoped.rows);
    const categoryGroups = new Map<string, { categoryId: string; categoryCode: string; categoryNameKo: string; rows: LedgerRow[] }>();
    for (const row of scoped.rows) {
      const category = categoryFor(row);
      const group = categoryGroups.get(category.code) ?? {
        categoryId: category.id,
        categoryCode: category.code,
        categoryNameKo: category.nameKo,
        rows: []
      };
      group.rows.push(row);
      categoryGroups.set(category.code, group);
    }
    const rawCategories = [...categoryGroups.values()]
      .map((group) => ({ ...group, totals: totalsFor(group.rows) }))
      .sort((left, right) => right.totals.netHouseholdOutflowKrw - left.totals.netHouseholdOutflowKrw);
    const categoryShares = percentages(rawCategories.map((category) => category.totals.netHouseholdOutflowKrw));
    const categories = rawCategories.map((category, index) => ({
      categoryId: category.categoryId,
      categoryCode: category.categoryCode,
      categoryNameKo: category.categoryNameKo,
      ...category.totals,
      percentage: categoryShares[index]
    }));
    const trendUnit = scoped.period.kind === "quarter" || scoped.period.kind === "year" ? "month" as const : "day" as const;
    const trendGroups = new Map<string, LedgerRow[]>();
    for (const row of scoped.rows) {
      const key = trendUnit === "month" ? monthKey(row.spentOn) : dateOnly(row.spentOn);
      trendGroups.set(key, [...(trendGroups.get(key) ?? []), row]);
    }
    const trendBuckets = [...trendGroups.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, rows]) => ({
        key,
        label: trendUnit === "month" ? `${Number(key.slice(5))}월` : key.slice(5).replace("-", "/"),
        ...totalsFor(rows)
      }));
    const previousPeriod = previousReportPeriod(scoped.range.period);
    const previousRows = previousPeriod
      ? await this.prisma.expense.findMany({
          where: {
            childId: query.childId,
            householdId: scoped.child.householdId,
            deletedAt: null,
            spentOn: {
              gte: parseDateOnly(previousPeriod.from)!,
              lt: new Date(parseDateOnly(previousPeriod.to)!.getTime() + 86_400_000)
            }
          },
          select: { id: true, childId: true, householdId: true, createdByUserId: true, payerUserId: true, categoryId: true, expenseCategoryV2Id: true, linkedItemDefinitionId: true, amountKrw: true, spentOn: true, itemName: true, merchant: true, expenseType: true }
        })
      : null;
    const previousTotals = previousRows ? totalsFor(previousRows) : null;
    const previousDeltaKrw = previousTotals ? ledger.netHouseholdOutflowKrw - previousTotals.netHouseholdOutflowKrw : 0;
    const reportState = resolveReportV3State({
      actualRecordCount: ledger.recordCount,
      plannedPreparationCostKrw,
      recurringPlanCount: recurringPlans.length,
      monthlyRecurringEstimateKrw
    });
    const scheduledPlannedCostKrw = scheduledPlans.reduce((sum, plan) => sum + (plan.budgetKrw ?? 0), 0);
    const unscheduledPlannedCostKrw = unscheduledPlans.reduce((sum, plan) => sum + (plan.budgetKrw ?? 0), 0);
    const nextDueDate = scheduledPlans
      .flatMap((plan) => plan.dueDate ? [dateOnly(plan.dueDate)] : [])
      .sort()[0] ?? null;
    return {
      period: scoped.period,
      maturity,
      reportState,
      summary: {
        plannedPreparationCostKrw,
        scheduledPlannedCostKrw,
        unscheduledPlannedCostKrw,
        actualPreparationCostKrw,
        remainingPlannedCostKrw,
        budgetVarianceKrw: actualPreparationCostKrw - plannedPreparationCostKrw,
        unscheduledPlanCount,
        nextDueDate
      },
      necessitySplit: splits,
      costNature: {
        oneTime: {
          plannedCostKrw: reportPlans.filter((plan) => !plan.recurringIntervalDays).reduce((sum, plan) => sum + (plan.budgetKrw ?? 0), 0),
          actualCostKrw: totalsFor(linkedRows.filter((row) => !recurringItemIds.has(row.linkedItemDefinitionId!))).netHouseholdOutflowKrw
        },
        recurring: {
          plannedCostKrw: reportRecurringPlans.reduce((sum, plan) => sum + (plan.budgetKrw ?? 0), 0),
          actualCostKrw: totalsFor(recurringActualRows).netHouseholdOutflowKrw,
          monthlyEstimateKrw: monthlyRecurringEstimateKrw,
          planCount: recurringPlans.length
        }
      },
      payerContributions,
      ledger,
      categories,
      trend: { unit: trendUnit, buckets: trendBuckets },
      previousPeriodComparison: previousTotals ? {
        currentNetOutflowKrw: ledger.netHouseholdOutflowKrw,
        previousNetOutflowKrw: previousTotals.netHouseholdOutflowKrw,
        deltaKrw: previousDeltaKrw,
        deltaPercentage: previousTotals.netHouseholdOutflowKrw === 0
          ? null
          : Math.round((previousDeltaKrw / previousTotals.netHouseholdOutflowKrw) * 1000) / 10
      } : null,
      forecast,
      forecastUnavailableReason: forecast ? null : "At least three scheduled plan budgets and three linked expense records are required.",
      selectorProvenance: "All sections use the same KST report period and expense ledger selector."
    };
  }

  async varianceExplanation(user: AuthenticatedUser, query: ReportRangeQueryDto) {
    if (!(process.env.NODE_ENV !== "production" && process.env.RELEASE5_INTERNAL_FEATURES === "1")) {
      if (!this.appConfig) throw new NotFoundException({ code: "FEATURE_DISABLED", message: "This feature is not active." });
      const current = await this.appConfig.get();
      if (current.source !== "database" || !current.config.featureFlags.budget_variance_explanation) {
        throw new NotFoundException({ code: "FEATURE_DISABLED", message: "This feature is not active." });
      }
    }
    const report = await this.v3(user, query);
    return {
      period: report.period,
      explanation: explainBudgetVariance({
        plannedKrw: report.summary.plannedPreparationCostKrw,
        actualKrw: report.summary.actualPreparationCostKrw,
        actualRecordCount: report.ledger.recordCount,
        categories: report.categories.map((category) => ({ name: category.categoryNameKo, actualKrw: category.netHouseholdOutflowKrw })),
        giftKrw: report.ledger.giftKrw,
        refundKrw: report.ledger.refundKrw,
        supportKrw: report.ledger.supportKrw
      }),
      source: "report_v3" as const
    };
  }

  async sources(user: AuthenticatedUser, query: ReportSourcesQueryDto) {
    const planSource = query.kind === "planned" || query.kind === "unscheduled_planned" || query.kind === "recurring_planned";
    const scoped = planSource
      ? { ...(await this.scopeBase(user, query)), rows: [] as LedgerRow[] }
      : await this.scope(user, query);
    type SourceItem =
      | {
          sourceType: "plan";
          id: string;
          itemDefinitionId: string;
          itemName: string;
          state: string;
          amountKrw: number;
          signedAmountKrw: number;
          dueDate: string | null;
          recurringIntervalDays: number | null;
          sortKey: string;
        }
      | {
          sourceType: "expense";
          id: string;
          itemName: string;
          amountKrw: number;
          signedAmountKrw: number;
          spentOn: string;
          expenseType: ExpenseType;
          payerUserId: string;
          payerDisplayName: string;
          linkedItemDefinitionId: string | null;
          sortKey: string;
        };

    let sourceItems: SourceItem[];
    if (planSource) {
      const plans = await this.prisma.userItemPlan.findMany({
        where: {
          householdId: scoped.child.householdId,
          childId: query.childId,
          state: { notIn: ["not_considered", "not_needed", "retired", "ended"] }
        },
        orderBy: [{ dueDate: "asc" }, { updatedAt: "desc" }, { id: "asc" }]
      });
      const scheduledPlans = plans.filter(
        (plan) => plan.dueDate && plan.dueDate >= scoped.range.start && plan.dueDate < scoped.range.endExclusive
      );
      const unscheduledPlans = plans.filter((plan) => !plan.dueDate);
      const reportPlans = [...scheduledPlans, ...unscheduledPlans];
      const selectedPlans = query.kind === "unscheduled_planned"
        ? unscheduledPlans
        : query.kind === "recurring_planned"
          ? reportPlans.filter((plan) => Boolean(plan.recurringIntervalDays))
          : reportPlans;
      const definitions = await this.prisma.itemDefinition.findMany({
        where: { id: { in: selectedPlans.map((plan) => plan.itemDefinitionId) } },
        select: { id: true, nameKo: true }
      });
      const nameById = new Map(definitions.map((definition) => [definition.id, definition.nameKo]));
      sourceItems = selectedPlans.map((plan) => {
        const amountKrw = query.kind === "recurring_planned" && plan.recurringIntervalDays
          ? Math.round((plan.budgetKrw ?? 0) * 30.4375 / plan.recurringIntervalDays)
          : (plan.budgetKrw ?? 0);
        return {
          sourceType: "plan" as const,
          id: plan.id,
          itemDefinitionId: plan.itemDefinitionId,
          itemName: nameById.get(plan.itemDefinitionId) ?? "준비 항목",
          state: plan.state,
          amountKrw,
          signedAmountKrw: amountKrw,
          dueDate: plan.dueDate ? dateOnly(plan.dueDate) : null,
          recurringIntervalDays: plan.recurringIntervalDays,
          sortKey: plan.dueDate ? `${dateOnly(plan.dueDate)}:${plan.id}` : `9999-12-31:${plan.updatedAt.toISOString()}:${plan.id}`
        };
      });
    } else {
      const selectedRows = query.kind === "actual_preparation"
        ? scoped.rows.filter((row) => Boolean(row.linkedItemDefinitionId))
        : query.kind === "household_net"
          ? scoped.rows
          : scoped.rows.filter((row) => row.expenseType === query.kind);
      const payerIds = [...new Set(selectedRows.map((row) => row.payerUserId ?? row.createdByUserId))];
      const payerUsers = await this.prisma.user.findMany({
        where: { id: { in: payerIds } },
        select: { id: true, displayName: true }
      });
      const payerNames = new Map(payerUsers.map((entry) => [entry.id, entry.displayName ?? "가족"]));
      sourceItems = selectedRows.map((row) => {
        const payerUserId = row.payerUserId ?? row.createdByUserId;
        return {
          sourceType: "expense" as const,
          id: row.id,
          itemName: row.itemName,
          amountKrw: row.amountKrw,
          signedAmountKrw: signedLedgerAmount(row),
          spentOn: dateOnly(row.spentOn),
          expenseType: row.expenseType,
          payerUserId,
          payerDisplayName: payerNames.get(payerUserId) ?? "가족",
          linkedItemDefinitionId: row.linkedItemDefinitionId,
          sortKey: `${dateOnly(row.spentOn)}:${row.id}`
        };
      });
    }

    sourceItems.sort((left, right) =>
      left.sourceType === "plan"
        ? left.sortKey.localeCompare(right.sortKey) || left.id.localeCompare(right.id)
        : right.sortKey.localeCompare(left.sortKey) || right.id.localeCompare(left.id)
    );
    let startIndex = 0;
    if (query.cursor) {
      let cursorId: string;
      try {
        cursorId = Buffer.from(query.cursor, "base64url").toString("utf8");
      } catch {
        throw new BadRequestException({ code: "REPORT_SOURCE_CURSOR_INVALID", message: "Invalid report source cursor." });
      }
      const cursorIndex = sourceItems.findIndex((item) => item.id === cursorId);
      if (cursorIndex < 0) {
        throw new BadRequestException({ code: "REPORT_SOURCE_CURSOR_INVALID", message: "Invalid report source cursor." });
      }
      startIndex = cursorIndex + 1;
    }
    const page = sourceItems.slice(startIndex, startIndex + query.limit);
    const hasMore = startIndex + page.length < sourceItems.length;
    const pageTotals = {
      amountKrw: page.reduce((sum, item) => sum + item.amountKrw, 0),
      signedAmountKrw: page.reduce((sum, item) => sum + item.signedAmountKrw, 0),
      recordCount: page.length
    };
    return {
      period: scoped.period,
      kind: query.kind,
      items: page.map(({ sortKey: _sortKey, ...item }) => item),
      totals: {
        amountKrw: sourceItems.reduce((sum, item) => sum + item.amountKrw, 0),
        signedAmountKrw: sourceItems.reduce((sum, item) => sum + item.signedAmountKrw, 0),
        recordCount: sourceItems.length
      },
      pageTotals,
      nextCursor: hasMore && page.length > 0
        ? Buffer.from(page[page.length - 1].id, "utf8").toString("base64url")
        : null
    };
  }

  async recurring(user: AuthenticatedUser, query: ReportRangeQueryDto) {
    const scoped = await this.scope(user, query);
    const maturity = this.maturity(scoped.rows);
    if (!maturity.showRecurring) return { period: scoped.period, items: [], maturity };
    const grouped = new Map<string, LedgerRow[]>();
    for (const row of scoped.rows.filter((entry) => entry.expenseType === "expense")) {
      const key = `${normalizedRecurringKey(row.merchant ?? "")}::${normalizedRecurringKey(row.itemName)}`;
      grouped.set(key, [...(grouped.get(key) ?? []), row]);
    }
    const items = [...grouped.entries()].flatMap(([key, rows]) => {
      const distinctMonths = new Set(rows.map((row) => monthKey(row.spentOn))).size;
      if (distinctMonths < 2) return [];
      const totalExpenseKrw = rows.reduce((sum, row) => sum + row.amountKrw, 0);
      return [{ key, itemName: rows[0].itemName, merchant: rows[0].merchant, totalExpenseKrw, recordCount: rows.length, distinctMonths, averageExpenseKrw: Math.round(totalExpenseKrw / rows.length), latestSpentOn: dateOnly(rows.reduce((latest, row) => row.spentOn > latest ? row.spentOn : latest, rows[0].spentOn)) }];
    }).sort((left, right) => right.totalExpenseKrw - left.totalExpenseKrw);
    return { period: scoped.period, items: items.slice(0, 20), maturity };
  }

  async refreshAndCheckIntegrity(childId: string, yearMonth: string) {
    if (!/^\d{4}-\d{2}$/.test(yearMonth)) throw new BadRequestException({ code: "REPORT_MONTH_INVALID", message: "Invalid report month." });
    const from = `${yearMonth}-01`;
    const start = parseDateOnly(from);
    if (!start) throw new BadRequestException({ code: "REPORT_MONTH_INVALID", message: "Invalid report month." });
    const nextMonth = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));
    const to = dateOnly(new Date(nextMonth.getTime() - 86_400_000));
    const child = await this.prisma.child.findUnique({ where: { id: childId }, select: { householdId: true, deletedAt: true } });
    if (!child || child.deletedAt) throw new NotFoundException({ code: "CHILD_NOT_FOUND", message: "Child not found." });
    const rows = await this.prisma.expense.findMany({ where: { childId, householdId: child.householdId, deletedAt: null, spentOn: { gte: start, lt: nextMonth } }, select: { id: true, childId: true, householdId: true, createdByUserId: true, payerUserId: true, categoryId: true, expenseCategoryV2Id: true, linkedItemDefinitionId: true, amountKrw: true, spentOn: true, itemName: true, merchant: true, expenseType: true } });
    const categoryFor = await this.categoryIndex(rows);
    const aggregateGroups = new Map<string, { aggregateDate: Date; expenseType: ExpenseType; categoryCode: string; memberUserId: string; amountKrw: number; recordCount: number }>();
    for (const row of rows) {
      const categoryCode = categoryFor(row).code;
      const key = `${dateOnly(row.spentOn)}|${row.expenseType}|${categoryCode}|${row.createdByUserId}`;
      const group = aggregateGroups.get(key) ?? { aggregateDate: row.spentOn, expenseType: row.expenseType, categoryCode, memberUserId: row.createdByUserId, amountKrw: 0, recordCount: 0 };
      group.amountKrw += row.amountKrw;
      group.recordCount += 1;
      aggregateGroups.set(key, group);
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.reportDailyAggregate.deleteMany({ where: { childId, aggregateDate: { gte: start, lt: nextMonth } } });
      if (aggregateGroups.size) await tx.reportDailyAggregate.createMany({ data: [...aggregateGroups.values()].map((group) => ({ childId, ...group, refreshedAt: new Date() })) });
    });
    const aggregate = await this.prisma.reportDailyAggregate.groupBy({ by: ["expenseType"], where: { childId, aggregateDate: { gte: start, lt: nextMonth } }, _sum: { amountKrw: true } });
    const signedTotal = (values: Array<{ expenseType: ExpenseType; amountKrw: number }>) => values.reduce((sum, value) => sum + (value.expenseType === "expense" ? value.amountKrw : value.expenseType === "refund" || value.expenseType === "support" ? -value.amountKrw : 0), 0);
    const ledgerTotalKrw = signedTotal(rows);
    const aggregateTotalKrw = signedTotal(aggregate.map((entry) => ({ expenseType: entry.expenseType, amountKrw: entry._sum.amountKrw ?? 0 })));
    const matched = ledgerTotalKrw === aggregateTotalKrw;
    await this.prisma.reportIntegrityCheck.create({ data: { childId, yearMonth: start, ledgerTotalKrw, aggregateTotalKrw, matched } });
    return { code: matched ? "REPORT_INTEGRITY_MATCHED" : "REPORT_INTEGRITY_MISMATCH", details: { childId, yearMonth, ledgerTotalKrw, aggregateTotalKrw } };
  }
}
