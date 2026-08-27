import { reachedBudgetBoundaries } from "@wooriai/domain";
import {
  PURCHASE_FOLLOWUP_MAX_AGE_MS,
  PURCHASE_FOLLOWUP_MIN_AGE_MS,
  type PurchaseFollowupEntry
} from "../commerce/purchase-followup.store";
import type { WeeklySummary } from "../home/weekly-summary";
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
 * - budget_80 / budget_100 key on childId + the yearMonth (R19-D), so each fires at most once per
 *   CHILD per month and re-arms automatically when the month rolls over. The childId scope was
 *   missing before: with two children, whichever child's budget alert fired first suppressed the
 *   other child's alert for the rest of the month (stage_transition/weekly_summary were already
 *   child-scoped).
 * - stage_transition keys on childId + the NEW stage label, so each stage change fires once.
 * - purchase_pending keys on itemTemplateId + clickedAt, so each product-link click fires once
 *   (a fresh re-click has a new clickedAt and may fire again).
 * - weekly_summary (NOTI-103) keys on childId + the Seoul-calendar ISO week, so it fires at most
 *   once per child per week and re-arms every Monday 00:00 KST.
 */

/* R19-D: the old `BUDGET_WARNING_RATIO = 0.8` float ratio is gone -- nothing imported it and the
 * 80% threshold is now the domain module's exact integer comparison (spent*5 >= budget*4). */

export type BudgetNotificationInput = {
  /** Scopes the dedupeKey so each child gets its own monthly budget alert (R19-D). */
  childId: string;
  /** e.g. "2026-08" (HomeSummary.monthly.yearMonth). */
  yearMonth: string;
  budgetKrw: number;
  spentKrw: number;
};

/**
 * R19-D: the 80%/100% judgement comes from @wooriai/domain's reachedBudgetBoundaries -- the same
 * function the home banner (src/home/budget-warning.ts) and the server push dispatcher
 * (apps/api/src/push/push-dispatch.service.ts) use, so the three surfaces agree on which boundary
 * a given (budget, spent) pair has reached. budgetKrw <= 0 means "no budget set" (the home API
 * returns amountKrw: 0 then) and never nags -- that is the domain function's hasBudget: false.
 *
 * Buckets (identical to the banner's):
 * - reached 100% (spent >= budget) -> budget_100, EXACTLY at budget gets the banner's
 *   "모두 사용했어요" copy. Before R19-D this case fell into budget_80 ("80%를 사용했어요") while
 *   the banner and the server push both said "모두 사용했어요" -- three surfaces, three answers
 *   for the same month. "초과" itself stays strict > (0원 초과라고 말하면 허위 데이터).
 * - 80% <= usage < 100% -> budget_80.
 * Never both at once -- crossing straight past 100% yields only budget_100.
 *
 * legacyDedupeKeys 주의 (R19 M-3, 의도된 트레이드오프): 아래 legacy 키(`budget_80:{yearMonth}`)는
 * 월 스코프일 뿐 childId 스코프가 아니다 -- R19-D 이전 앱이 그렇게 썼기 때문이다. 그래서 업데이트가
 * 걸친 그 한 달 동안, 다자녀 계정에서 legacy 키를 이미 본 사용자는 **둘째 아이의 알림까지** 함께
 * 억제된다(새 키는 아이별로 다르지만, 둘 다 같은 legacy 키를 가리키므로). 중복 발화("이미 본 알림이
 * 다시 뜬다")보다 한 달치 누락이 덜 나쁘다고 판단해 그대로 둔다. 자기 소멸적이다: 키가 월 스코프라
 * 다음 달이면 legacy 키가 매칭되지 않고, 릴리스가 한 달 지나면 legacyDedupeKeys 자체를 지우면 된다.
 * (FIX-119B/F4로 억제 시 새 키도 dedupe 메모리에 기록되지만, 그것은 억제를 legacy 키 수명에서
 * 독립시킬 뿐 억제 범위를 넓히지도 좁히지도 않는다.)
 *
 * Copy note: unlike the live banner, an in-app notification is a SNAPSHOT that stays in the list,
 * so the 초과 case deliberately keeps the amount-free "이번 달 예산을 초과했어요" -- a frozen
 * "1원 초과했어요" row would read as stale once the month runs on. The banner (live) and the push
 * (delivered immediately) do name the amount.
 */
export function budgetNotifications(input: BudgetNotificationInput): AppNotificationCandidate[] {
  const { childId, yearMonth, budgetKrw, spentKrw } = input;
  const status = reachedBudgetBoundaries({ budgetKrw, spentKrw });
  if (!status.reached80) return [];
  if (status.reached100) {
    return [
      {
        type: "budget_100",
        title: status.exceeded ? "이번 달 예산을 초과했어요" : "이번 달 예산을 모두 사용했어요",
        body: "이번 달 지출을 확인해 볼까요?",
        dedupeKey: `budget_100:${childId}:${yearMonth}`,
        legacyDedupeKeys: [`budget_100:${yearMonth}`],
        childId
      }
    ];
  }
  return [
    {
      type: "budget_80",
      title: "이번 달 예산의 80%를 사용했어요",
      body: "남은 예산을 확인해보세요.",
      dedupeKey: `budget_80:${childId}:${yearMonth}`,
      legacyDedupeKeys: [`budget_80:${yearMonth}`],
      childId
    }
  ];
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
    dedupeKey: `stage_transition:${childId}:${stageLabel}`,
    childId
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
      dedupeKey: purchasePendingDedupeKey(entry),
      childId: entry.childId
    }));
}

/**
 * UX-J: 홈 주간 카드가 이미 만든 실제 주간 숫자(src/home/weekly-summary.ts). `WeeklySummary`가
 * 그대로 만족하는 부분집합이라 홈은 계산 결과를 통째로 넘기면 되고, 여기서 문장을 다시 만들지
 * 않으므로 카드와 알림의 문구·비교 의미론이 갈릴 여지가 없다(`text`는 "이번 주 84,200원 ·
 * 지난주 같은 요일까지보다 12,000원 적게 썼어요" 꼴이고, 부분 주 비교라는 사실을 "같은 요일까지"로
 * 스스로 밝힌다). 타입 전용 import라 런타임 의존은 생기지 않는다.
 */
export type WeeklySpendSnapshot = Pick<WeeklySummary, "totalKrw" | "text">;

export type WeeklySummaryInput = {
  childId: string;
  childName: string;
  /** HomeSummary.monthly.amountKrw -- 0 means "no monthly budget set". */
  budgetKrw: number;
  /** HomeSummary.monthly.usedAmountKrw -- the month-to-date total. */
  spentKrw: number;
  /** Epoch ms "now", used only to derive the Seoul-calendar ISO week identity. */
  now: number;
  /**
   * UX-J: 홈이 계산한 이번 주 합계. 있으면 이것으로 문구를 만들고, 없으면(주간 캐시가 아직/영영
   * 안 왔거나 구간을 못 덮어 홈 카드도 접힌 경우) 아래 월 페이스 폴백을 쓴다.
   */
  weekly?: WeeklySpendSnapshot | null;
};

/**
 * NOTI-103 weekly summary. UX-J부터 **진짜 이번 주 합계**를 말한다.
 *
 * 낡은 전제(라운드 32 이전): "HomeSummary만으로는 주간 합계를 낼 수 없다 -- recentExpenses는
 * 서버에서 3건으로 잘려 오고(apps/api/src/onboarding/reporting-store.service.ts), 새 API 호출은
 * NOTI-103이 금지한다." 그래서 이 알림은 **월 누적·예산 페이스**를 대신 말했다. 그 전제는 UX-A
 * 이후 거짓이다: 홈은 이미 `["expenses", childId, 이번 달/지난달]` 캐시(기록 탭과 공유, 오프라인
 * 대기 행까지 재조정)로 `evaluateWeeklySummary`를 돌려 주간 카드를 그린다. 새 요청 없이 그 값을
 * 그대로 받아 쓴다 -- 알림과 홈 카드가 **같은 숫자**를 말하게 하는 것이 이 변경의 요지다.
 *
 * Semantics:
 * - once per Seoul-calendar ISO week per child: the dedupeKey is
 *   weekly_summary:{childId}:{isoYear}-W{isoWeek}, so with the store's seenDedupeKeys memory the
 *   first evaluation (i.e. first app open with home data) of a week ingests it and every later
 *   evaluation that week is a no-op; Monday 00:00 KST starts a fresh key. UX-J도 키를 건드리지
 *   않는다 -- 문구만 바뀐다.
 * - `weekly` 있음: 문구는 홈 카드 첫 줄 그대로다. 이번 주 합계가 0원이면 candidate 자체를 만들지
 *   않는다("이번 주 지출은 아직 없어요"를 목록에 얼려 두는 것은 소음이다). 월 누적과 같은 이유로
 *   자연스러운 결과가 따라온다: 그 주에 지출이 생기면(키가 아직 안 쓰였으므로) 그때 발화한다.
 * - `weekly` 없음: 종전 월 페이스 문구로 폴백한다. 주간 캐시가 실패했다고 주간 알림이 통째로
 *   사라지면 안 된다. **순서 주의**: /home 응답이 지출 캐시보다 먼저 도착한 그 주 첫 평가는
 *   폴백 문구로 발화하고, 키가 그것으로 소진된다(주간 값이 늦게 와도 같은 주에는 다시 뜨지
 *   않는다). 둘 다 사실인 문장이라 허용하되, 홈이 두 값을 같은 렌더에서 넘기므로 지출 캐시가
 *   이미 채워진 평소 경로에서는 주간 문구가 나온다.
 *   - zero (or negative/invalid) month-to-date spend: return null -- a "0원 지금까지" summary is
 *     pure noise.
 *   - budget unset (amountKrw 0 from the home API): still fire, total only, no percentage.
 *   - budget set: "예산의 NN%" with NN = Math.round(spent/budget*100) -- may legitimately read
 *     0% for tiny spend or exceed 100% when over budget.
 */
export function weeklySummaryNotification(input: WeeklySummaryInput): AppNotificationCandidate | null {
  const { childId, childName, now } = input;
  const title = weeklySummaryTitle(input);
  if (!title) return null;
  return {
    type: "weekly_summary",
    title,
    body: `『${childName}』 지출 내역을 확인해보세요.`,
    dedupeKey: `weekly_summary:${childId}:${seoulIsoWeekKey(now)}`,
    childId
  };
}

/** 위 문서의 두 갈래(실주간 / 월 페이스 폴백). null이면 이번 평가에서는 알리지 않는다. */
function weeklySummaryTitle(input: WeeklySummaryInput): string | null {
  const { weekly, budgetKrw, spentKrw } = input;
  // 넘어온 주간 값이 온전할 때만 그것을 쓴다. 망가진 값(NaN 합계·빈 문구)은 "주간 값이 없다"와
  // 같이 다뤄 폴백으로 보낸다 -- 빈 제목의 알림을 목록에 남기지 않기 위해서다.
  if (weekly && Number.isFinite(weekly.totalKrw) && weekly.text.length > 0) {
    return weekly.totalKrw > 0 ? weekly.text : null;
  }
  if (!Number.isFinite(spentKrw) || spentKrw <= 0) return null;
  return budgetKrw > 0
    ? `이번 달 지금까지 ${formatKrw(spentKrw)} · 예산의 ${Math.round((spentKrw / budgetKrw) * 100)}%예요`
    : `이번 달 지금까지 ${formatKrw(spentKrw)}을 함께했어요`;
}

export type HomeNotificationInput = {
  child: { id: string; nickname: string; stageLabel: string };
  monthly: { yearMonth: string; amountKrw: number; usedAmountKrw: number };
  lastSeenStageLabel: string | null | undefined;
  followupEntries: PurchaseFollowupEntry[];
  now: number;
  /** UX-J: 홈 주간 카드가 이미 만든 이번 주 합계. 없으면 주간 알림이 월 페이스로 폴백한다. */
  weekly?: WeeklySpendSnapshot | null;
};

/** Everything the home screen's evaluation hook needs in one pure call. */
export function evaluateHomeNotifications(input: HomeNotificationInput): AppNotificationCandidate[] {
  const candidates: AppNotificationCandidate[] = [
    ...budgetNotifications({
      childId: input.child.id,
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
  // NOTI-103 + UX-J: weekly (Seoul ISO-week) summary. 홈이 주간 값을 함께 넘기면 홈 카드와 같은
  // 실제 주간 문구가 되고, 없으면 종전 월 페이스 문구로 폴백한다(요청은 늘지 않는다 -- 주간 값도
  // 홈이 이미 들고 있는 지출 캐시에서 나온다).
  const weeklyCandidate = weeklySummaryNotification({
    childId: input.child.id,
    childName: input.child.nickname,
    budgetKrw: input.monthly.amountKrw,
    spentKrw: input.monthly.usedAmountKrw,
    now: input.now,
    weekly: input.weekly
  });
  if (weeklyCandidate) candidates.push(weeklyCandidate);
  return candidates;
}
