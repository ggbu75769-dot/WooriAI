import type { CategoryReport } from "../api/client";

export type ReportPeriod = "월간" | "분기" | "연간";

export function addMonths(date: Date, months: number) {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

export function yearMonthOf(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function monthsForPeriod(period: ReportPeriod, anchor: Date): string[] {
  if (period === "월간") return [yearMonthOf(anchor)];
  if (period === "분기") {
    const start = new Date(anchor.getFullYear(), Math.floor(anchor.getMonth() / 3) * 3, 1);
    return [start, addMonths(start, 1), addMonths(start, 2)].map(yearMonthOf);
  }
  return Array.from({ length: 12 }, (_, index) => `${anchor.getFullYear()}-${String(index + 1).padStart(2, "0")}`);
}

export function mergeCategoryReports(reports: CategoryReport[]) {
  const merged = new Map<string, { categoryId: string; amountKrw: number; count: number }>();
  for (const report of reports) {
    for (const row of report.categories) {
      const current = merged.get(row.categoryId) ?? { categoryId: row.categoryId, amountKrw: 0, count: 0 };
      current.amountKrw += row.amountKrw;
      current.count += row.count;
      merged.set(row.categoryId, current);
    }
  }
  return [...merged.values()].sort((left, right) => right.amountKrw - left.amountKrw || left.categoryId.localeCompare(right.categoryId));
}

export function canShowTrend(points: number[] | undefined) {
  return Boolean(points && points.filter((point) => point > 0).length >= 2);
}
