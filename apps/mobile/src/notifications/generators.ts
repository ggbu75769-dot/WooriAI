import {
  PURCHASE_FOLLOWUP_MAX_AGE_MS,
  PURCHASE_FOLLOWUP_MIN_AGE_MS,
  type PurchaseFollowupEntry
} from "../commerce/purchase-followup.store";
import { formatKrw } from "../money";
import { seoulIsoWeekKey } from "./iso-week";
import type { AppNotificationCandidate } from "./notification.store";

/**
 * NOTI-102 notification generators: pure functions from data the app already has (home summary,
 * purchase-followup clicks) to candidate notifications with STABLE dedupeKeys. The store's
 * dedupe memory (notification.store.ts seenDedupeKeys) guarantees each key fires at most once,
 * so re-running a generator on every home refetch is safe -- stability of the key IS the
 * "fire once" semantics:
 *
 * - budget_80 / budget_100 key on the yearMonth, so each fires at most once per month and
 *   re-arms automatically when the month rolls over.
 * - stage_transition keys on childId + the NEW stage label, so each stage change fires once.
 * - purchase_pending keys on itemTemplateId + clickedAt, so each product-link click fires once
 *   (a fresh re-click has a new clickedAt and may fire again).
 * - weekly_summary (NOTI-103) keys on childId + the Seoul-calendar ISO week, so it fires at most
 *   once per child per week and re-arms every Monday 00:00 KST.
 */

export const BUDGET_WARNING_RATIO = 0.8;

export type BudgetNotificationInput = {
  /** e.g. "2026-08" (HomeSummary.monthly.yearMonth). */
  yearMonth: string;
  budgetKrw: number;
  spentKrw: number;
};

/**
 * budget_100 once spending strictly exceeds the budget (same strict-> semantics as the home
 * screen's isOverBudget: spending exactly the budget is not "초과"), otherwise budget_80 from
 * 80% usage. Never both at once -- crossing straight past 100% yields only budget_100.
 * budgetKrw <= 0 means "no budget set" (home API returns amountKrw: 0 then) -- never nag.
 */
export function budgetNotifications(input: BudgetNotificationInput): AppNotificationCandidate[] {
  const { yearMonth, budgetKrw, spentKrw } = input;
  if (budgetKrw <= 0) return [];
  if (spentKrw > budgetKrw) {
    return [
      {
        type: "budget_100",
        title: "이번 달 예산을 초과했어요",
        body: "이번 달 지출을 확인해 볼까요?",
        dedupeKey: `budget_100:${yearMonth}`
      }
    ];
  }
  if (spentKrw / budgetKrw >= BUDGET_WARNING_RATIO) {
    return [
      {
        type: "budget_80",
        title: "이번 달 예산의 80%를 사용했어요",
        body: "남은 예산을 확인해보세요.",
        dedupeKey: `budget_80:${yearMonth}`
      }
    ];
  }
  return [];
}

export type StageTransitionInput = {
  childId: string;
  childName: string;
  /** Current stage label from the home summary (HomeSummary.child.stageLabel). */
  stageLabel: string;
  /** What this device last saw for the child (notification.store.ts lastSeenStageByChild),
   * null/undefined on first sighting -- the first sighting only records, never notifies. */
  lastSeenStageLabel: string | null | undefined;
};

export function stageTransitionNotification(input: StageTransitionInput): AppNotificationCandidate | null {
  const { childId, childName, stageLabel, lastSeenStageLabel } = input;
  if (!stageLabel || !lastSeenStageLabel || lastSeenStageLabel === stageLabel) return null;
  return {
    type: "stage_transition",
    title: `『${childName}』이(가) ${stageLabel}에 들어섰어요.`,
    body: "새 준비템을 확인해보세요.",
    dedupeKey: `stage_transition:${childId}:${stageLabel}`
  };
}

export function purchasePendingDedupeKey(entry: Pick<PurchaseFollowupEntry, "itemTemplateId" | "clickedAt">): string {
  return `purchase_pending:${entry.itemTemplateId}:${entry.clickedAt}`;
}

/** Recovers the itemTemplateId from a purchase_pending dedupeKey so app/notifications.tsx can
 * route a row tap to /items/[itemTemplateId] without widening the persisted entry shape.
 * Robust to ":" inside the id itself (the clickedAt suffix is always the last segment). */
export function itemTemplateIdFromPurchaseDedupeKey(dedupeKey: string): string | null {
  const parts = dedupeKey.split(":");
  if (parts[0] !== "purchase_pending" || parts.length < 3) return null;
  const itemTemplateId = parts.slice(1, -1).join(":");
  return itemTemplateId.length > 0 ? itemTemplateId : null;
}

/**
 * purchase_pending: one candidate per still-pending purchase-followup click inside the same
 * 3min-24h window the COM-108 prompt uses (isPromptEligible in purchase-followup.store.ts):
 * younger than PURCHASE_FOLLOWUP_MIN_AGE_MS the user is probably still mid-purchase, older
 * than PURCHASE_FOLLOWUP_MAX_AGE_MS the click is stale -- the prompt stays silent then and
 * this notification must too. Read-only over the followup entries.
 */
export function purchasePendingNotifications(
  entries: PurchaseFollowupEntry[],
  now: number
): AppNotificationCandidate[] {
  return entries
    .filter((entry) => {
      if (entry.status !== "pending") return false;
      const age = now - entry.clickedAt;
      return age >= PURCHASE_FOLLOWUP_MIN_AGE_MS && age <= PURCHASE_FOLLOWUP_MAX_AGE_MS;
    })
    .map((entry) => ({
      type: "purchase_pending" as const,
      title: `『${entry.itemName}』 구매 확인이 기다리고 있어요.`,
      body: "구매하셨다면 지출로 기록해보세요.",
      dedupeKey: purchasePendingDedupeKey(entry)
    }));
}

export type WeeklySummaryInput = {
  childId: string;
  childName: string;
  /** HomeSummary.monthly.amountKrw -- 0 means "no monthly budget set". */
  budgetKrw: number;
  /** HomeSummary.monthly.usedAmountKrw -- the month-to-date total. */
  spentKrw: number;
  /** Epoch ms "now", used only to derive the Seoul-calendar ISO week identity. */
  now: number;
};

/**
 * NOTI-103 weekly summary -- MONTHLY-PACE VARIANT, not a true last-week total.
 *
 * Data-availability decision: the ticket's preferred copy ("지난주 『아이명』에게 000,000원을
 * 함께했어요") needs last week's spend, but the evaluation hook only receives HomeSummary
 * (src/api/client.ts): `monthly` carries month totals (yearMonth/amountKrw/usedAmountKrw), and
 * `recentExpenses` is capped server-side at the 3 most recent rows (see
 * apps/api/src/onboarding/onboarding-store.service.ts, `.slice(0, 3)`), so a weekly sum computed
 * from it would silently undercount whenever a week has more than 3 expenses. Deriving weekly
 * spend would therefore require a new API call (e.g. listExpenses), which NOTI-103 explicitly
 * rules out. Fallback per ticket: fire on the first evaluation of each ISO week with the
 * month-to-date total and budget pace instead.
 *
 * Semantics:
 * - once per Seoul-calendar ISO week per child: the dedupeKey is
 *   weekly_summary:{childId}:{isoYear}-W{isoWeek}, so with the store's seenDedupeKeys memory the
 *   first evaluation (i.e. first app open with home data) of a week ingests it and every later
 *   evaluation that week is a no-op; Monday 00:00 KST starts a fresh key.
 * - zero (or negative/invalid) month-to-date spend: return null -- a "0원 지금까지" summary is
 *   pure noise. Note the natural consequence: if the first open of a week has zero spend, the
 *   summary fires later that week once spend appears (the week's key is still unseen).
 * - budget unset (amountKrw 0 from the home API): still fire, total only, no percentage.
 * - budget set: "예산의 NN%" with NN = Math.round(spent/budget*100) -- may legitimately read
 *   0% for tiny spend or exceed 100% when over budget.
 */
export function weeklySummaryNotification(input: WeeklySummaryInput): AppNotificationCandidate | null {
  const { childId, childName, budgetKrw, spentKrw, now } = input;
  if (!Number.isFinite(spentKrw) || spentKrw <= 0) return null;
  const title =
    budgetKrw > 0
      ? `이번 달 지금까지 ${formatKrw(spentKrw)} · 예산의 ${Math.round((spentKrw / budgetKrw) * 100)}%예요`
      : `이번 달 지금까지 ${formatKrw(spentKrw)}을 함께했어요`;
  return {
    type: "weekly_summary",
    title,
    body: `『${childName}』 지출 내역을 확인해보세요.`,
    dedupeKey: `weekly_summary:${childId}:${seoulIsoWeekKey(now)}`
  };
}

export type HomeNotificationInput = {
  child: { id: string; nickname: string; stageLabel: string };
  monthly: { yearMonth: string; amountKrw: number; usedAmountKrw: number };
  lastSeenStageLabel: string | null | undefined;
  followupEntries: PurchaseFollowupEntry[];
  now: number;
};

/** Everything the home screen's evaluation hook needs in one pure call. */
export function evaluateHomeNotifications(input: HomeNotificationInput): AppNotificationCandidate[] {
  const candidates: AppNotificationCandidate[] = [
    ...budgetNotifications({
      yearMonth: input.monthly.yearMonth,
      budgetKrw: input.monthly.amountKrw,
      spentKrw: input.monthly.usedAmountKrw
    })
  ];
  const stage = stageTransitionNotification({
    childId: input.child.id,
    childName: input.child.nickname,
    stageLabel: input.child.stageLabel,
    lastSeenStageLabel: input.lastSeenStageLabel
  });
  if (stage) candidates.push(stage);
  candidates.push(...purchasePendingNotifications(input.followupEntries, input.now));
  // NOTI-103: weekly (Seoul ISO-week) monthly-pace summary -- all inputs are already in the
  // NOTI-102 home snapshot, so no hook/screen changes were needed to wire it.
  const weekly = weeklySummaryNotification({
    childId: input.child.id,
    childName: input.child.nickname,
    budgetKrw: input.monthly.amountKrw,
    spentKrw: input.monthly.usedAmountKrw,
    now: input.now
  });
  if (weekly) candidates.push(weekly);
  return candidates;
}
