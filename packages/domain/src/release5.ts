export type TodayActionKind =
  | "safety_acknowledgement"
  | "sync_conflict"
  | "overdue_assigned"
  | "replacement_due"
  | "recurring_due"
  | "due_this_week"
  | "planned_cost_unassigned"
  | "recommendation";

export type TodayActionCandidate = {
  actionKey: string;
  kind: TodayActionKind;
  sourceId: string;
  childId: string | null;
  dueDate: string | null;
  assignedUserId: string | null;
  safetyBlocking?: boolean;
  financial?: boolean;
};

export type TodayActionPreference = {
  actionKey: string;
  mode: "snooze" | "hide_lifecycle";
  snoozedUntil: string | null;
};

const todayPriority: Record<TodayActionKind, number> = {
  safety_acknowledgement: 0,
  sync_conflict: 1,
  overdue_assigned: 2,
  replacement_due: 3,
  recurring_due: 4,
  due_this_week: 5,
  planned_cost_unassigned: 6,
  recommendation: 7
};

function dateDistance(referenceDate: string, dueDate: string | null) {
  if (!dueDate) return Number.MAX_SAFE_INTEGER;
  return Math.round((Date.parse(`${dueDate}T00:00:00.000Z`) - Date.parse(`${referenceDate}T00:00:00.000Z`)) / 86_400_000);
}

export function selectTodayActions(input: {
  referenceDate: string;
  currentUserId: string;
  canViewFinancial: boolean;
  candidates: TodayActionCandidate[];
  preferences?: TodayActionPreference[];
  limit?: number;
}) {
  const preferences = new Map((input.preferences ?? []).map((preference) => [preference.actionKey, preference]));
  const seen = new Set<string>();
  return input.candidates
    .filter((candidate) => {
      if (seen.has(candidate.actionKey)) return false;
      seen.add(candidate.actionKey);
      if (candidate.financial && !input.canViewFinancial) return false;
      const preference = preferences.get(candidate.actionKey);
      if (!preference || candidate.safetyBlocking) return true;
      if (preference.mode === "hide_lifecycle") return false;
      return !preference.snoozedUntil || preference.snoozedUntil <= input.referenceDate;
    })
    .sort((left, right) => {
      const priority = todayPriority[left.kind] - todayPriority[right.kind];
      if (priority !== 0) return priority;
      const assigned = Number(right.assignedUserId === input.currentUserId) - Number(left.assignedUserId === input.currentUserId);
      if (assigned !== 0) return assigned;
      const due = dateDistance(input.referenceDate, left.dueDate) - dateDistance(input.referenceDate, right.dueDate);
      return due || left.actionKey.localeCompare(right.actionKey);
    })
    .slice(0, Math.min(3, Math.max(1, input.limit ?? 3)));
}

export type PreparationScheduleInput = {
  planId: string;
  itemDefinitionId: string;
  childId: string | null;
  assignedUserId: string | null;
  dueDate: string | null;
  replacementDueAt: string | null;
  nextPurchaseDueAt: string | null;
  state: string;
};

export function buildPreparationCalendarEvents(plans: PreparationScheduleInput[]) {
  const terminal = new Set(["not_needed", "retired", "ended"]);
  return plans
    .filter((plan) => !terminal.has(plan.state))
    .flatMap((plan) => ([
      plan.dueDate ? { eventId: `${plan.planId}:preparation`, type: "preparation" as const, date: plan.dueDate, ...plan } : null,
      plan.replacementDueAt ? { eventId: `${plan.planId}:replacement`, type: "replacement" as const, date: plan.replacementDueAt, ...plan } : null,
      plan.nextPurchaseDueAt ? { eventId: `${plan.planId}:recurring`, type: "recurring" as const, date: plan.nextPurchaseDueAt, ...plan } : null
    ]))
    .filter((event): event is NonNullable<typeof event> => Boolean(event))
    .sort((left, right) => left.date.localeCompare(right.date) || left.eventId.localeCompare(right.eventId));
}

export function kstWeekStart(referenceDate: string) {
  const date = new Date(`${referenceDate}T00:00:00Z`);
  const day = date.getUTCDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  date.setUTCDate(date.getUTCDate() + mondayOffset);
  return date.toISOString().slice(0, 10);
}

export function predictRecurringPurchase(input: { purchaseDates: string[]; enabled?: boolean }) {
  if (input.enabled === false) return null;
  const dates = [...new Set(input.purchaseDates)].sort();
  if (dates.length < 3) return null;
  let intervals = dates.slice(1).map((date, index) => Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${dates[index]}T00:00:00Z`)) / 86_400_000)).filter((days) => days > 0);
  if (intervals.length < 2) return null;
  const median = (values: number[]) => {
    const sorted = [...values].sort((left, right) => left - right);
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2;
  };
  if (intervals.length >= 4) {
    const center = median(intervals);
    const deviation = median(intervals.map((value) => Math.abs(value - center)));
    const boundary = Math.max(7, deviation * 3);
    const filtered = intervals.filter((value) => Math.abs(value - center) <= boundary);
    if (filtered.length >= 2) intervals = filtered;
  }
  const intervalDays = Math.max(1, Math.round(median(intervals)));
  const latest = new Date(`${dates.at(-1)}T00:00:00Z`);
  latest.setUTCDate(latest.getUTCDate() + intervalDays);
  const spread = Math.max(...intervals) - Math.min(...intervals);
  const confidence = dates.length >= 6 && spread / intervalDays <= 0.2 ? "high" : dates.length >= 4 ? "medium" : "low";
  return { predictedDate: latest.toISOString().slice(0, 10), intervalDays, confidence } as const;
}

export function explainBudgetVariance(input: {
  plannedKrw: number;
  actualKrw: number;
  actualRecordCount: number;
  categories: Array<{ name: string; actualKrw: number }>;
  giftKrw?: number;
  refundKrw?: number;
  supportKrw?: number;
}) {
  if (input.actualRecordCount < 2 || (input.plannedKrw === 0 && input.actualKrw === 0)) return null;
  const varianceKrw = input.actualKrw - input.plannedKrw;
  const direction = varianceKrw > 0 ? "over" : varianceKrw < 0 ? "under" : "matched";
  const amount = Math.abs(varianceKrw).toLocaleString("ko-KR");
  const summary = direction === "matched"
    ? "실제 지출이 계획과 같아요."
    : `실제 지출은 계획보다 ${amount}원 ${direction === "over" ? "많아요" : "적어요"}.`;
  const topDrivers = input.categories
    .filter((category) => category.actualKrw > 0)
    .sort((left, right) => right.actualKrw - left.actualKrw || left.name.localeCompare(right.name, "ko-KR"))
    .slice(0, 2)
    .map((category) => ({ name: category.name, actualKrw: category.actualKrw }));
  return {
    varianceKrw,
    direction,
    summary,
    topDrivers,
    adjustments: {
      giftKrw: Math.max(0, input.giftKrw ?? 0),
      refundKrw: Math.max(0, input.refundKrw ?? 0),
      supportKrw: Math.max(0, input.supportKrw ?? 0)
    },
    basis: "report_v3_ledger_and_plan" as const
  };
}
