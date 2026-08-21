import { describe, expect, it } from "vitest";
import {
  PURCHASE_FOLLOWUP_MAX_AGE_MS,
  PURCHASE_FOLLOWUP_MIN_AGE_MS,
  type PurchaseFollowupEntry
} from "../commerce/purchase-followup.store";
import { evaluateBudgetWarning } from "../home/budget-warning";
import {
  budgetNotifications,
  evaluateHomeNotifications,
  itemTemplateIdFromPurchaseDedupeKey,
  purchasePendingDedupeKey,
  purchasePendingNotifications,
  stageTransitionNotification,
  weeklySummaryNotification
} from "./generators";
import { SEOUL_UTC_OFFSET_MS } from "./iso-week";

const NOW = 1_700_000_000_000;

function followupEntry(overrides: Partial<PurchaseFollowupEntry> = {}): PurchaseFollowupEntry {
  return {
    itemTemplateId: "item-diaper",
    itemName: "네이처러브 기저귀 팬티형",
    childId: "child-1",
    clickedAt: NOW - PURCHASE_FOLLOWUP_MIN_AGE_MS,
    status: "pending",
    promptCount: 0,
    ...overrides
  };
}

describe("NOTI-102 budget generators (budget_80 / budget_100)", () => {
  const budgetInput = { childId: "child-1", yearMonth: "2026-08", budgetKrw: 1_000_000, spentKrw: 850_000 };

  it("stays silent with no budget set (amountKrw 0 means unset, never '초과')", () => {
    expect(budgetNotifications({ ...budgetInput, budgetKrw: 0, spentKrw: 999_999 })).toEqual([]);
  });

  it("stays silent under 80% usage", () => {
    expect(budgetNotifications({ ...budgetInput, spentKrw: 799_999 })).toEqual([]);
  });

  it("fires budget_80 from exactly 80% with a child+month-scoped dedupeKey", () => {
    const candidates = budgetNotifications({ ...budgetInput, spentKrw: 800_000 });
    expect(candidates).toEqual([
      {
        type: "budget_80",
        title: "이번 달 예산의 80%를 사용했어요",
        body: "남은 예산을 확인해보세요.",
        dedupeKey: "budget_80:child-1:2026-08",
        legacyDedupeKeys: ["budget_80:2026-08"],
        childId: "child-1"
      }
    ]);
  });

  it("R19-D: spending EXACTLY the budget is budget_100 with the home banner's '모두 사용했어요' copy", () => {
    // Regression: this used to land in budget_80 ("예산의 80%를 사용했어요") while the home banner
    // and the server push both said "모두 사용했어요" for the very same month.
    const candidates = budgetNotifications({ ...budgetInput, spentKrw: 1_000_000 });
    expect(candidates).toEqual([
      {
        type: "budget_100",
        title: "이번 달 예산을 모두 사용했어요",
        body: "이번 달 지출을 확인해 볼까요?",
        dedupeKey: "budget_100:child-1:2026-08",
        legacyDedupeKeys: ["budget_100:2026-08"],
        childId: "child-1"
      }
    ]);
  });

  it("fires only budget_100 once spending exceeds the budget (never both at once)", () => {
    const candidates = budgetNotifications({ ...budgetInput, spentKrw: 1_000_001 });
    expect(candidates).toEqual([
      {
        type: "budget_100",
        // Amount-free on purpose: a stored notification is a snapshot, so it must not freeze
        // "1원 초과했어요" -- the live banner/push name the amount instead.
        title: "이번 달 예산을 초과했어요",
        body: "이번 달 지출을 확인해 볼까요?",
        dedupeKey: "budget_100:child-1:2026-08",
        legacyDedupeKeys: ["budget_100:2026-08"],
        childId: "child-1"
      }
    ]);
  });

  it("keeps dedupeKeys stable across re-evaluation but re-arms on month rollover", () => {
    expect(budgetNotifications(budgetInput)[0]!.dedupeKey).toBe(budgetNotifications(budgetInput)[0]!.dedupeKey);
    const nextMonth = budgetNotifications({ ...budgetInput, yearMonth: "2026-09" });
    expect(nextMonth[0]!.dedupeKey).toBe("budget_80:child-1:2026-09");
    expect(nextMonth[0]!.dedupeKey).not.toBe(budgetNotifications(budgetInput)[0]!.dedupeKey);
    expect(budgetNotifications({ ...budgetInput, yearMonth: "2026-09", spentKrw: 1_200_000 })[0]!.dedupeKey).toBe(
      "budget_100:child-1:2026-09"
    );
  });

  it("R19-D: scopes the key per child, so one child's alert never suppresses a sibling's", () => {
    const first = budgetNotifications(budgetInput)[0]!;
    const sibling = budgetNotifications({ ...budgetInput, childId: "child-2" })[0]!;
    expect(sibling.dedupeKey).toBe("budget_80:child-2:2026-08");
    expect(sibling.dedupeKey).not.toBe(first.dedupeKey);
    expect(sibling.childId).toBe("child-2");
  });

  it("R19-D: carries the pre-rename key so an already-notified month is not re-notified", () => {
    // The store drops a candidate whose legacy key is already in the dedupe memory
    // (notification.store.ts addNotifications) -- see its test for the end-to-end behaviour.
    expect(budgetNotifications(budgetInput)[0]!.legacyDedupeKeys).toEqual(["budget_80:2026-08"]);
    expect(budgetNotifications({ ...budgetInput, spentKrw: 2_000_000 })[0]!.legacyDedupeKeys).toEqual([
      "budget_100:2026-08"
    ]);
  });

  it("R19-D: agrees with the home banner on every 80/100 boundary (shared domain judgement)", () => {
    const budgetKrw = 1_000_000;
    for (const spentKrw of [0, 1, 799_999, 800_000, 999_999, 1_000_000, 1_000_001, 3_000_000]) {
      const warning = evaluateBudgetWarning({ budgetKrw, spentKrw });
      const candidates = budgetNotifications({ ...budgetInput, budgetKrw, spentKrw });
      if (!warning) {
        expect(candidates).toEqual([]);
        continue;
      }
      expect(candidates.map((candidate) => candidate.type)).toEqual([
        warning.level === "exceeded" ? "budget_100" : "budget_80"
      ]);
    }
  });
});

describe("NOTI-102 stage_transition generator", () => {
  const base = { childId: "child-1", childName: "다온이", stageLabel: "36개월" };

  it("only records on first sighting (no last-seen stage -> no notification)", () => {
    expect(stageTransitionNotification({ ...base, lastSeenStageLabel: null })).toBeNull();
    expect(stageTransitionNotification({ ...base, lastSeenStageLabel: undefined })).toBeNull();
  });

  it("stays silent while the stage label is unchanged", () => {
    expect(stageTransitionNotification({ ...base, lastSeenStageLabel: "36개월" })).toBeNull();
  });

  it("fires on a stage change with the child name and new stage in the copy", () => {
    const candidate = stageTransitionNotification({ ...base, lastSeenStageLabel: "24개월" });
    expect(candidate).toEqual({
      type: "stage_transition",
      title: "『다온이』이(가) 36개월에 들어섰어요.",
      body: "새 준비템을 확인해보세요.",
      dedupeKey: "stage_transition:child-1:36개월",
      childId: "child-1"
    });
  });

  it("keys on childId + NEW stage so each transition fires once and per child", () => {
    const first = stageTransitionNotification({ ...base, lastSeenStageLabel: "24개월" });
    const again = stageTransitionNotification({ ...base, lastSeenStageLabel: "24개월" });
    expect(again!.dedupeKey).toBe(first!.dedupeKey);
    const otherChild = stageTransitionNotification({ ...base, childId: "child-2", lastSeenStageLabel: "24개월" });
    expect(otherChild!.dedupeKey).not.toBe(first!.dedupeKey);
  });
});

describe("NOTI-102 purchase_pending generator", () => {
  it("fires for pending clicks at least 3 minutes old", () => {
    const candidates = purchasePendingNotifications([followupEntry()], NOW);
    expect(candidates).toEqual([
      {
        type: "purchase_pending",
        title: "『네이처러브 기저귀 팬티형』 구매 확인이 기다리고 있어요.",
        body: "구매하셨다면 지출로 기록해보세요.",
        dedupeKey: `purchase_pending:item-diaper:${NOW - PURCHASE_FOLLOWUP_MIN_AGE_MS}`,
        childId: "child-1"
      }
    ]);
  });

  it("skips clicks younger than 3 minutes (probably still mid-purchase)", () => {
    const fresh = followupEntry({ clickedAt: NOW - PURCHASE_FOLLOWUP_MIN_AGE_MS + 1 });
    expect(purchasePendingNotifications([fresh], NOW)).toEqual([]);
  });

  it("skips stale clicks older than 24 hours (same silence as the COM-108 prompt)", () => {
    // Regression: the generator used to enforce only the 3-minute minimum, so a days-old
    // pending click still produced a '구매 확인이 기다리고 있어요' notification while
    // isPromptEligible correctly kept the prompt silent past PURCHASE_FOLLOWUP_MAX_AGE_MS.
    const twentyFiveHoursOld = followupEntry({ clickedAt: NOW - 25 * 60 * 60 * 1000 });
    expect(purchasePendingNotifications([twentyFiveHoursOld], NOW)).toEqual([]);
    const justPastMaxAge = followupEntry({ clickedAt: NOW - PURCHASE_FOLLOWUP_MAX_AGE_MS - 1 });
    expect(purchasePendingNotifications([justPastMaxAge], NOW)).toEqual([]);
    // Exactly at the max age is still inside the window (<=, matching isPromptEligible).
    const atMaxAge = followupEntry({ clickedAt: NOW - PURCHASE_FOLLOWUP_MAX_AGE_MS });
    expect(purchasePendingNotifications([atMaxAge], NOW)).toHaveLength(1);
  });

  it("skips non-pending entries (done/dismissed/expired)", () => {
    const entries = [
      followupEntry({ itemTemplateId: "item-done", status: "done" }),
      followupEntry({ itemTemplateId: "item-dismissed", status: "dismissed" }),
      followupEntry({ itemTemplateId: "item-expired", status: "expired" })
    ];
    expect(purchasePendingNotifications(entries, NOW)).toEqual([]);
  });

  it("keys per itemTemplateId + clickedAt, so a fresh re-click may notify again", () => {
    const first = purchasePendingDedupeKey({ itemTemplateId: "item-diaper", clickedAt: 100 });
    expect(purchasePendingDedupeKey({ itemTemplateId: "item-diaper", clickedAt: 100 })).toBe(first);
    expect(purchasePendingDedupeKey({ itemTemplateId: "item-diaper", clickedAt: 200 })).not.toBe(first);
    expect(purchasePendingDedupeKey({ itemTemplateId: "item-other", clickedAt: 100 })).not.toBe(first);
  });

  it("recovers the itemTemplateId from the dedupeKey for row-tap routing", () => {
    expect(itemTemplateIdFromPurchaseDedupeKey("purchase_pending:item-diaper:1700000000000")).toBe("item-diaper");
    // Robust to ':' inside the id itself -- clickedAt is always the last segment.
    expect(itemTemplateIdFromPurchaseDedupeKey("purchase_pending:tpl:v2:diaper:1700000000000")).toBe("tpl:v2:diaper");
    expect(itemTemplateIdFromPurchaseDedupeKey("budget_80:2026-08")).toBeNull();
    expect(itemTemplateIdFromPurchaseDedupeKey("purchase_pending:x")).toBeNull();
  });
});

describe("NOTI-103 weekly_summary generator (monthly-pace variant)", () => {
  /** Epoch ms for a Seoul (KST) civil date/time. */
  const kst = (year: number, month1: number, day: number, hour = 12, minute = 0) =>
    Date.UTC(year, month1 - 1, day, hour, minute) - SEOUL_UTC_OFFSET_MS;
  // Thursday 2026-08-20 KST = ISO week 2026-W34 (Seoul calendar).
  const base = {
    childId: "child-1",
    childName: "다온이",
    budgetKrw: 1_000_000,
    spentKrw: 300_000,
    now: kst(2026, 8, 20)
  };

  it("fires with the month-to-date total and budget pace, keyed on the Seoul ISO week", () => {
    expect(weeklySummaryNotification(base)).toEqual({
      type: "weekly_summary",
      title: "이번 달 지금까지 300,000원 · 예산의 30%예요",
      body: "『다온이』 지출 내역을 확인해보세요.",
      dedupeKey: "weekly_summary:child-1:2026-W34",
      childId: "child-1"
    });
  });

  it("rounds the pace percentage to the nearest integer (may exceed 100%)", () => {
    expect(weeklySummaryNotification({ ...base, spentKrw: 333_333 })!.title).toContain("예산의 33%예요");
    expect(weeklySummaryNotification({ ...base, spentKrw: 335_000 })!.title).toContain("예산의 34%예요");
    expect(weeklySummaryNotification({ ...base, spentKrw: 1_200_000 })!.title).toContain("예산의 120%예요");
  });

  it("still fires with total only when no budget is set (amountKrw 0), without a percentage", () => {
    const candidate = weeklySummaryNotification({ ...base, budgetKrw: 0 });
    expect(candidate).toEqual({
      type: "weekly_summary",
      title: "이번 달 지금까지 300,000원을 함께했어요",
      body: "『다온이』 지출 내역을 확인해보세요.",
      dedupeKey: "weekly_summary:child-1:2026-W34",
      childId: "child-1"
    });
    expect(candidate!.title).not.toContain("%");
  });

  it("skips entirely on zero (or invalid) month-to-date spend -- no noise", () => {
    expect(weeklySummaryNotification({ ...base, spentKrw: 0 })).toBeNull();
    expect(weeklySummaryNotification({ ...base, spentKrw: -5_000 })).toBeNull();
    expect(weeklySummaryNotification({ ...base, spentKrw: Number.NaN })).toBeNull();
  });

  it("keeps the dedupeKey stable within a week and rolls it over on Monday 00:00 KST", () => {
    const monday = weeklySummaryNotification({ ...base, now: kst(2026, 8, 17, 0, 0) });
    const sunday = weeklySummaryNotification({ ...base, now: kst(2026, 8, 23, 23, 59) });
    expect(monday!.dedupeKey).toBe("weekly_summary:child-1:2026-W34");
    expect(sunday!.dedupeKey).toBe(monday!.dedupeKey);
    const nextMonday = weeklySummaryNotification({ ...base, now: kst(2026, 8, 24, 0, 0) });
    expect(nextMonday!.dedupeKey).toBe("weekly_summary:child-1:2026-W35");
    // Year boundary: the ISO year (not the calendar year) keys the last/first weeks.
    expect(weeklySummaryNotification({ ...base, now: kst(2024, 12, 30) })!.dedupeKey).toBe(
      "weekly_summary:child-1:2025-W01"
    );
  });

  it("keys per child, so each child of a family gets its own weekly summary", () => {
    expect(weeklySummaryNotification({ ...base, childId: "child-2" })!.dedupeKey).toBe(
      "weekly_summary:child-2:2026-W34"
    );
  });
});

describe("NOTI-102 combined home evaluation", () => {
  it("merges budget, stage, purchase, and weekly-summary candidates from one home snapshot", () => {
    const candidates = evaluateHomeNotifications({
      child: { id: "child-1", nickname: "다온이", stageLabel: "36개월" },
      monthly: { yearMonth: "2026-08", amountKrw: 1_000_000, usedAmountKrw: 1_100_000 },
      lastSeenStageLabel: "24개월",
      followupEntries: [followupEntry()],
      now: NOW
    });
    expect(candidates.map((candidate) => candidate.type)).toEqual([
      "budget_100",
      "stage_transition",
      "purchase_pending",
      "weekly_summary"
    ]);
    expect(candidates.map((candidate) => candidate.dedupeKey)).toEqual([
      "budget_100:child-1:2026-08",
      "stage_transition:child-1:36개월",
      `purchase_pending:item-diaper:${NOW - PURCHASE_FOLLOWUP_MIN_AGE_MS}`,
      // NOW = 2023-11-14T22:13:20Z = 2023-11-15 07:13 KST (Wednesday) -> Seoul 2023-W46.
      "weekly_summary:child-1:2023-W46"
    ]);
  });

  it("emits only the weekly summary for calm data with spend (under budget, same stage, no pending clicks)", () => {
    const candidates = evaluateHomeNotifications({
      child: { id: "child-1", nickname: "다온이", stageLabel: "24개월" },
      monthly: { yearMonth: "2026-08", amountKrw: 1_000_000, usedAmountKrw: 100_000 },
      lastSeenStageLabel: "24개월",
      followupEntries: [],
      now: NOW
    });
    expect(candidates.map((candidate) => candidate.type)).toEqual(["weekly_summary"]);
    expect(candidates[0]!.title).toBe("이번 달 지금까지 100,000원 · 예산의 10%예요");
  });

  it("is entirely silent for calm data with zero spend (weekly summary skips too)", () => {
    const candidates = evaluateHomeNotifications({
      child: { id: "child-1", nickname: "다온이", stageLabel: "24개월" },
      monthly: { yearMonth: "2026-08", amountKrw: 1_000_000, usedAmountKrw: 0 },
      lastSeenStageLabel: "24개월",
      followupEntries: [],
      now: NOW
    });
    expect(candidates).toEqual([]);
  });
});
