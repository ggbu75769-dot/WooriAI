import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import {
  PURCHASE_FOLLOWUP_MAX_AGE_MS,
  PURCHASE_FOLLOWUP_MIN_AGE_MS,
  type PurchaseFollowupEntry
} from "../commerce/purchase-followup.store";
import { hasPendingMonthAdjustments, resolveThisMonthUsedKrw } from "../home/budget-edit";
import { evaluateBudgetWarning } from "../home/budget-warning";
import { evaluateWeeklySummary } from "../home/weekly-summary";
import type { LocalExpenseRow } from "../offline/types";
import {
  RECOVERABLE_PENDING_SYNC_STATES,
  budgetNotifications,
  evaluateHomeNotifications,
  hasPendingRecordsForChild,
  hasRecoverablePendingRecordsForMonth,
  itemTemplateIdFromPurchaseDedupeKey,
  purchasePendingDedupeKey,
  purchasePendingNotifications,
  resolveWeeklySpendForNotification,
  stageTransitionNotification,
  weeklySummaryNotification,
  type WeeklySpendResolution
} from "./generators";
import { useNotificationStore } from "./notification.store";
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
  // 라운드 37 G-1: `weekly: null` = "지출 캐시가 확정 실패해 주간 숫자를 못 낸다" -- 월 페이스
  // 폴백이 서는 유일한 경우다(아직 로딩 중이면 undefined이고, 그때는 후보 자체를 만들지 않는다).
  const base = {
    childId: "child-1",
    childName: "다온이",
    budgetKrw: 1_000_000,
    spentKrw: 300_000,
    now: kst(2026, 8, 20),
    weekly: null
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

  /**
   * 라운드 38 H-3 — 홈이 99%라 말하는 달에 알림만 100%였다.
   *
   * 홈 히어로·넛지는 "아직 다 쓰지 않았는데 반올림만으로 100%가 되는 구간"을 99로 캡한다
   * (budget-progress.ts G-2). 이 폴백 문구는 그 규칙을 몰라서, 남은 예산이 5,000원 있는 달에도
   * "예산의 100%예요"라고 말했다. 이제 두 곳이 같은 함수를 쓴다.
   */
  it("H-3: 미소진 구간의 반올림 100%는 홈과 같은 규칙으로 99%가 된다", () => {
    const boundary = { ...base, budgetKrw: 1_000_000 };
    // 99.4% -- 반올림해도 100이 아니다(종전과 동일).
    expect(weeklySummaryNotification({ ...boundary, spentKrw: 994_000 })!.title).toContain("예산의 99%예요");
    // 99.5% / 99.99% -- 종전에는 여기서만 알림이 "100%"였다.
    expect(weeklySummaryNotification({ ...boundary, spentKrw: 995_000 })!.title).toContain("예산의 99%예요");
    expect(weeklySummaryNotification({ ...boundary, spentKrw: 999_900 })!.title).toContain("예산의 99%예요");
    // 실제로 다 쓴 달에만 100%다.
    expect(weeklySummaryNotification({ ...boundary, spentKrw: 1_000_000 })!.title).toContain("예산의 100%예요");
    // 초과 구간은 종전대로 그대로 말한다(여기에는 프로그레스 바가 없다).
    expect(weeklySummaryNotification({ ...boundary, spentKrw: 1_200_000 })!.title).toContain("예산의 120%예요");
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

describe("UX-J weekly_summary -- 홈 주간 카드와 같은 실제 주간 숫자", () => {
  /** Epoch ms for a Seoul (KST) civil date/time. */
  const kst = (year: number, month1: number, day: number, hour = 12, minute = 0) =>
    Date.UTC(year, month1 - 1, day, hour, minute) - SEOUL_UTC_OFFSET_MS;
  // 2026-08-20(목) KST = Seoul ISO 2026-W34.
  const base = {
    childId: "child-1",
    childName: "다온이",
    budgetKrw: 1_000_000,
    spentKrw: 300_000,
    now: kst(2026, 8, 20),
    weekly: null
  };

  it("주간 값이 있으면 홈 카드 첫 줄을 그대로 제목으로 쓴다 (비교 있음: 적게)", () => {
    const candidate = weeklySummaryNotification({
      ...base,
      weekly: { totalKrw: 84_200, text: "이번 주 84,200원 · 지난주 같은 요일까지보다 12,000원 적게 썼어요" }
    });

    expect(candidate).toEqual({
      type: "weekly_summary",
      title: "이번 주 84,200원 · 지난주 같은 요일까지보다 12,000원 적게 썼어요",
      body: "『다온이』 지출 내역을 확인해보세요.",
      // 키는 UX-J에서도 그대로다(서울 ISO 주 · 아이별).
      dedupeKey: "weekly_summary:child-1:2026-W34",
      childId: "child-1"
    });
    // 월 누적 문구가 섞이지 않는다 -- 홈 주간 카드와 어긋나던 원인.
    expect(candidate!.title).not.toContain("이번 달");
    // 부분 주 비교라는 사실을 문장이 스스로 밝힌다(허위 비교 금지).
    expect(candidate!.title).toContain("같은 요일까지");
  });

  it("지난주보다 많이 쓴 주와 비교가 없는 주도 홈 카드 문구를 따른다", () => {
    expect(
      weeklySummaryNotification({
        ...base,
        weekly: { totalKrw: 100_000, text: "이번 주 100,000원 · 지난주 같은 요일까지보다 60,000원 많이 썼어요" }
      })!.title
    ).toBe("이번 주 100,000원 · 지난주 같은 요일까지보다 60,000원 많이 썼어요");

    // 지난주 구간이 캐시에 없거나 지난주가 0원이면 홈 카드도 합계만 말한다 -- 알림도 같다.
    expect(weeklySummaryNotification({ ...base, weekly: { totalKrw: 42_000, text: "이번 주 42,000원" } })!.title).toBe(
      "이번 주 42,000원"
    );
  });

  it("이번 주 지출이 0원이면 알리지 않는다 -- 그 주에 지출이 생기면 그때 발화한다", () => {
    // 키가 아직 쓰이지 않았으므로(candidate 자체를 안 만든다) 같은 주 뒤 평가에서 뜬다.
    expect(
      weeklySummaryNotification({ ...base, weekly: { totalKrw: 0, text: "이번 주 지출은 아직 없어요" } })
    ).toBeNull();
  });

  it("주간 값을 확정적으로 못 내면(null) 종전 월 페이스 문구로 폴백한다 -- 알림이 통째로 사라지지 않는다", () => {
    const candidate = weeklySummaryNotification({ ...base, weekly: null });
    expect(candidate!.title).toBe("이번 달 지금까지 300,000원 · 예산의 30%예요");
    expect(candidate!.dedupeKey).toBe("weekly_summary:child-1:2026-W34");
    // 예산이 없는 달의 폴백 문구도 그대로다.
    expect(weeklySummaryNotification({ ...base, budgetKrw: 0, weekly: null })!.title).toBe(
      "이번 달 지금까지 300,000원을 함께했어요"
    );
    // 폴백 경로의 "월 누적 0원이면 침묵" 규칙도 그대로다.
    expect(weeklySummaryNotification({ ...base, spentKrw: 0, weekly: null })).toBeNull();
  });

  it("라운드 37 G-1: 주간 판정 불가(undefined)면 후보 자체를 만들지 않는다 -- 폴백으로 키를 태우지 않는다", () => {
    // 콜드 스타트에서 /home만 먼저 도착한 그 첫 평가. 종전에는 여기서 월 페이스 문구가 발화해
    // 그 주의 dedupeKey가 소진됐고, 잠시 뒤 도착한 진짜 주간 문구는 dedupe에 막혀 못 떴다.
    expect(weeklySummaryNotification({ ...base, weekly: undefined })).toBeNull();
    // 월 누적이 넉넉해 폴백 문구를 만들 수 있는 상황에서도 만들지 않는다 -- 미루는 것이 요지다.
    expect(weeklySummaryNotification({ ...base, spentKrw: 900_000, weekly: undefined })).toBeNull();
  });

  it("망가진 주간 값(NaN 합계·빈 문구)은 폴백으로 보낸다 -- 빈 제목 알림 금지", () => {
    expect(weeklySummaryNotification({ ...base, weekly: { totalKrw: Number.NaN, text: "이번 주 ?" } })!.title).toBe(
      "이번 달 지금까지 300,000원 · 예산의 30%예요"
    );
    expect(weeklySummaryNotification({ ...base, weekly: { totalKrw: 84_200, text: "" } })!.title).toBe(
      "이번 달 지금까지 300,000원 · 예산의 30%예요"
    );
  });

  it("주 경계·아이별 키는 UX-J에서도 변하지 않는다", () => {
    const weekly = { totalKrw: 84_200, text: "이번 주 84,200원" };
    expect(weeklySummaryNotification({ ...base, weekly, now: kst(2026, 8, 24, 0, 0) })!.dedupeKey).toBe(
      "weekly_summary:child-1:2026-W35"
    );
    expect(weeklySummaryNotification({ ...base, weekly, childId: "child-2" })!.dedupeKey).toBe(
      "weekly_summary:child-2:2026-W34"
    );
  });

  it("홈 카드 모듈의 결과를 그대로 넘기면 두 화면의 문장이 같아진다 (정합 계약)", () => {
    // 홈이 실제로 하는 일: evaluateWeeklySummary 결과를 그대로 알림 평가에 넘긴다.
    const summary = evaluateWeeklySummary({
      todayIso: "2026-08-27", // 목요일
      thisMonthRecords: [
        { spentOn: "2026-08-24", amountKrw: 30_000, expenseType: "expense" },
        { spentOn: "2026-08-25", amountKrw: 24_200, expenseType: "expense" },
        { spentOn: "2026-08-26", amountKrw: 20_000, expenseType: "expense" },
        { spentOn: "2026-08-27", amountKrw: 10_000, expenseType: "expense" },
        { spentOn: "2026-08-17", amountKrw: 50_000, expenseType: "expense" },
        { spentOn: "2026-08-19", amountKrw: 46_200, expenseType: "expense" }
      ],
      lastMonthRecords: []
    });

    const candidate = weeklySummaryNotification({ ...base, now: kst(2026, 8, 27), weekly: summary });
    expect(candidate!.title).toBe(summary!.text);
    expect(candidate!.title).toBe("이번 주 84,200원 · 지난주 같은 요일까지보다 12,000원 적게 썼어요");
  });
});

describe("NOTI-102 combined home evaluation", () => {
  it("merges budget, stage, purchase, and weekly-summary candidates from one home snapshot", () => {
    const candidates = evaluateHomeNotifications({
      child: { id: "child-1", nickname: "다온이", stageLabel: "36개월" },
      monthly: { yearMonth: "2026-08", amountKrw: 1_000_000, usedAmountKrw: 1_100_000 },
      lastSeenStageLabel: "24개월",
      followupEntries: [followupEntry()],
      now: NOW,
      weekly: null
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
      now: NOW,
      weekly: null
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
      now: NOW,
      weekly: null
    });
    expect(candidates).toEqual([]);
  });

  it("UX-J: 홈이 넘긴 주간 값이 주간 알림까지 그대로 흐른다 (다른 알림은 그대로)", () => {
    const home = {
      child: { id: "child-1", nickname: "다온이", stageLabel: "24개월" },
      monthly: { yearMonth: "2026-08", amountKrw: 1_000_000, usedAmountKrw: 100_000 },
      lastSeenStageLabel: "24개월",
      followupEntries: [],
      now: NOW,
      weekly: null
    };

    const withWeekly = evaluateHomeNotifications({
      ...home,
      weekly: { totalKrw: 84_200, text: "이번 주 84,200원 · 지난주 같은 요일까지보다 12,000원 적게 썼어요" }
    });
    expect(withWeekly.map((candidate) => candidate.type)).toEqual(["weekly_summary"]);
    expect(withWeekly[0]!.title).toBe("이번 주 84,200원 · 지난주 같은 요일까지보다 12,000원 적게 썼어요");
    // 키는 인자 유무와 무관하게 같다 -- 한 주에 두 번 뜨지 않는다.
    expect(withWeekly[0]!.dedupeKey).toBe(evaluateHomeNotifications(home)[0]!.dedupeKey);

    // 이번 주 0원이면 주간 알림만 빠지고, 나머지 알림 경로는 영향을 받지 않는다.
    const quietWeek = evaluateHomeNotifications({
      ...home,
      monthly: { yearMonth: "2026-08", amountKrw: 1_000_000, usedAmountKrw: 900_000 },
      weekly: { totalKrw: 0, text: "이번 주 지출은 아직 없어요" }
    });
    expect(quietWeek.map((candidate) => candidate.type)).toEqual(["budget_80"]);
  });
});

describe("라운드 37 G-1: 콜드 스타트 경합 (스토어 통합)", () => {
  /** Epoch ms for a Seoul (KST) civil date/time. */
  const kst = (year: number, month1: number, day: number, hour = 12, minute = 0) =>
    Date.UTC(year, month1 - 1, day, hour, minute) - SEOUL_UTC_OFFSET_MS;
  // 2026-08-20(목) KST = Seoul ISO 2026-W34.
  const now = kst(2026, 8, 20);
  const home = {
    child: { id: "child-1", nickname: "다온이", stageLabel: "24개월" },
    monthly: { yearMonth: "2026-08", amountKrw: 1_000_000, usedAmountKrw: 300_000 },
    lastSeenStageLabel: "24개월",
    followupEntries: [],
    now
  };
  const realWeekly = { totalKrw: 84_200, text: "이번 주 84,200원 · 지난주 같은 요일까지보다 12,000원 적게 썼어요" };

  /** 홈 화면이 하는 일 그대로: 평가 -> 스토어 ingest. */
  const evaluateAndIngest = (weekly: WeeklySpendResolution) =>
    useNotificationStore.getState().ingest(evaluateHomeNotifications({ ...home, weekly }), now);
  const weeklyEntries = () =>
    useNotificationStore.getState().entries.filter((entry) => entry.type === "weekly_summary");

  beforeEach(() => {
    useNotificationStore.getState().resetAll();
  });

  it("resolveWeeklySpendForNotification가 세 상태를 가른다", () => {
    // 값이 있으면 로딩/실패 여부와 무관하게 그 값이다(홈 카드가 이미 그 숫자를 그리고 있다).
    expect(resolveWeeklySpendForNotification({ weekly: realWeekly, expensesFailed: false })).toBe(realWeekly);
    expect(resolveWeeklySpendForNotification({ weekly: realWeekly, expensesFailed: true })).toBe(realWeekly);
    // 값이 없을 때만 갈린다: 로딩 중이면 "아직 모른다", 확정 실패면 "못 낸다".
    expect(resolveWeeklySpendForNotification({ weekly: null, expensesFailed: false })).toBeUndefined();
    expect(resolveWeeklySpendForNotification({ weekly: null, expensesFailed: true })).toBeNull();
  });

  it("지출 캐시가 늦게 와도 그 주의 주간 알림은 실제 주간 문구로 뜬다", () => {
    // 1차: /home만 도착했다(지출 쿼리 pending) -> 판정 불가.
    evaluateAndIngest(resolveWeeklySpendForNotification({ weekly: null, expensesFailed: false }));
    expect(weeklyEntries()).toEqual([]);
    // 키를 쓰지 않았으므로 dedupe 메모리에도 남지 않는다 -- 다음 평가가 막히지 않는다.
    expect(useNotificationStore.getState().seenDedupeKeys).not.toContain("weekly_summary:child-1:2026-W34");

    // 2차: 지출 캐시가 도착해 홈 주간 카드와 같은 값이 나왔다.
    evaluateAndIngest(resolveWeeklySpendForNotification({ weekly: realWeekly, expensesFailed: false }));
    expect(weeklyEntries().map((entry) => entry.title)).toEqual([realWeekly.text]);
    expect(weeklyEntries()[0]!.dedupeKey).toBe("weekly_summary:child-1:2026-W34");

    // 3차(같은 주 재평가): dedupe가 그대로 막아 한 주에 한 번만 뜬다.
    evaluateAndIngest(resolveWeeklySpendForNotification({ weekly: realWeekly, expensesFailed: false }));
    expect(weeklyEntries()).toHaveLength(1);
  });

  it("결함 재현 방지: 폴백을 먼저 흘려보내면 그 주 내내 월 페이스 문구가 남는다", () => {
    // 종전 동작(1차 평가에 null을 넘김)을 그대로 재현해 둔다 -- 왜 undefined가 필요한지의 근거.
    evaluateAndIngest(null);
    expect(weeklyEntries().map((entry) => entry.title)).toEqual(["이번 달 지금까지 300,000원 · 예산의 30%예요"]);
    evaluateAndIngest(realWeekly);
    // 진짜 주간 값이 와도 키가 이미 소진돼 목록은 바뀌지 않는다.
    expect(weeklyEntries().map((entry) => entry.title)).toEqual(["이번 달 지금까지 300,000원 · 예산의 30%예요"]);
  });

  it("지출 캐시가 확정 실패한 경우에만 월 페이스로 폴백한다", () => {
    evaluateAndIngest(resolveWeeklySpendForNotification({ weekly: null, expensesFailed: true }));
    expect(weeklyEntries().map((entry) => entry.title)).toEqual(["이번 달 지금까지 300,000원 · 예산의 30%예요"]);
  });

  it("주간 알림을 미뤄도 나머지 알림은 그 평가에서 평소대로 뜬다", () => {
    useNotificationStore
      .getState()
      .ingest(
        evaluateHomeNotifications({
          ...home,
          monthly: { yearMonth: "2026-08", amountKrw: 1_000_000, usedAmountKrw: 900_000 },
          weekly: undefined
        }),
        now
      );
    expect(useNotificationStore.getState().entries.map((entry) => entry.type)).toEqual(["budget_80"]);
  });
});

/**
 * 라운드 51 #7 — 예산 알림 입력은 **서버 확정값**을 유지한다(의도된 예외).
 *
 * 같은 라운드에서 홈 화면(히어로 금액·진행바·경고 배너·넛지)은 오프라인 대기 행까지 재조정한
 * 사용액으로 바뀌었다(src/home/budget-warning.test.ts의 "라운드 51 #7" 절). 그런데 알림만은
 * 종전대로 `/home` 응답의 서버 집계(`monthly.usedAmountKrw`)를 받는다. 두 표면의 성질이 다르기
 * 때문이다:
 *
 *  - 배너·진행바는 **라이브**다. 대기 행이 동기화 전에 지워지면 다음 프레임에 사라진다.
 *  - 알림은 **스냅숏**이다(이 파일 헤더). 목록에 남고, dedupeKey가 `budget_80:{child}:{month}`
 *    하나뿐이라 그 달에 한 번만 발화한다 — 잠정치로 조기 발화하면 되돌릴 수도, 다시 알릴 수도
 *    없다.
 *
 * 비용은 "조금 늦게"뿐이다: 대기 행이 동기화되면 서버 집계가 그만큼 오르고, 아직 쓰지 않은
 * 키로 정확히 한 번 뜬다. 아래 테스트가 그 두 갈래(정상 경로 · 되돌릴 수 없는 허위 경고)를
 * 스토어까지 재생해 고정한다. 라운드 37 G-1(주간 알림이 잠정값으로 키를 태우지 않게 미룬 판단)과
 * 같은 규율이다.
 *
 * ⚠️ 라운드 79 B(이 파일의 마지막 절)가 그 판단의 **다른 한 쪽**을 마저 세운다: 입력을 서버
 * 확정값으로 두면, 대기 행이 있는 동안 화면(재조정 값)과 알림이 서로 다른 수를 보게 된다.
 * 그래서 **입력을 바꾸는 대신**(그러면 위 "되돌릴 수 없는 허위 경고"가 되살아난다) 대기 행이
 * 있는 동안에는 아예 말하지 않는다 — 형제 알림 둘이 이미 지고 있는 규율이다.
 */
describe("라운드 51 #7: 예산 알림은 확정(서버) 사용액으로만 발화한다", () => {
  const kst = (year: number, month1: number, day: number, hour = 12) =>
    Date.UTC(year, month1 - 1, day, hour) - SEOUL_UTC_OFFSET_MS;
  const now = kst(2026, 8, 20);
  const BUDGET = 1_000_000;
  /** 서버가 아는 값 750,000원(75%) / 이 기기가 아는 잠정값 810,000원(81%). */
  const SERVER_USED = 750_000;
  const RECONCILED_USED = 810_000;

  const homeInput = (usedAmountKrw: number) => ({
    child: { id: "child-1", nickname: "다온이", stageLabel: "24개월" },
    monthly: { yearMonth: "2026-08", amountKrw: BUDGET, usedAmountKrw },
    lastSeenStageLabel: "24개월",
    followupEntries: [],
    now,
    // 주간 알림은 이 절의 관심사가 아니다 -- 판정 불가로 두어 후보를 만들지 않는다(G-1).
    weekly: undefined as WeeklySpendResolution
  });
  const budgetEntries = () =>
    useNotificationStore.getState().entries.filter((entry) => entry.type.startsWith("budget_"));

  beforeEach(() => {
    useNotificationStore.getState().resetAll();
  });

  it("두 값이 실제로 다른 답을 낸다(서버 75% 침묵 / 잠정 81% 발화)", () => {
    const base = { childId: "child-1", yearMonth: "2026-08", budgetKrw: BUDGET };
    expect(budgetNotifications({ ...base, spentKrw: SERVER_USED })).toEqual([]);
    expect(budgetNotifications({ ...base, spentKrw: RECONCILED_USED }).map((c) => c.type)).toEqual(["budget_80"]);
  });

  it("정상 경로: 동기화가 끝나 서버가 확정한 순간 정확히 한 번 뜬다(알림이 사라지지 않는다)", () => {
    // 1차: 오프라인 기록 직후. 서버는 아직 75%만 안다 -> 알림 없음, 키도 쓰지 않는다.
    useNotificationStore.getState().ingest(evaluateHomeNotifications(homeInput(SERVER_USED)), now);
    expect(budgetEntries()).toEqual([]);
    expect(useNotificationStore.getState().seenDedupeKeys).not.toContain("budget_80:child-1:2026-08");

    // 2차: 동기화 완료 -> 서버 집계가 81%로 올라온다. 키가 살아 있으므로 그대로 발화한다.
    useNotificationStore.getState().ingest(evaluateHomeNotifications(homeInput(RECONCILED_USED)), now);
    expect(budgetEntries().map((entry) => entry.type)).toEqual(["budget_80"]);

    // 3차(재평가): dedupe가 막아 한 달에 한 번이다.
    useNotificationStore.getState().ingest(evaluateHomeNotifications(homeInput(RECONCILED_USED)), now);
    expect(budgetEntries()).toHaveLength(1);
  });

  it("결함 재현 방지: 잠정치로 먼저 발화하면 확정 뒤에도 되돌릴 수 없다", () => {
    // 만약 홈이 재조정된 잠정 사용액을 알림 입력으로 넘겼다면 이렇게 된다.
    useNotificationStore.getState().ingest(evaluateHomeNotifications(homeInput(RECONCILED_USED)), now);
    expect(budgetEntries().map((entry) => entry.type)).toEqual(["budget_80"]);

    // 그런데 그 대기 행이 동기화 전에 지워져(또는 충돌로 값이 바뀌어) 서버가 75%로 확정했다.
    // 배너는 다음 프레임에 사라지지만, 알림 목록에는 "80%를 사용했어요"가 그대로 남고
    // dedupeKey도 이미 소진돼 이번 달에 다시 알릴 수도 없다 -- 취소할 수 없는 허위 경고다.
    useNotificationStore.getState().ingest(evaluateHomeNotifications(homeInput(SERVER_USED)), now);
    expect(budgetEntries().map((entry) => entry.title)).toEqual(["이번 달 예산의 80%를 사용했어요"]);
    expect(useNotificationStore.getState().seenDedupeKeys).toContain("budget_80:child-1:2026-08");
  });

  it("홈 배선 계약: 알림 훅에는 재조정 값(monthlyUsed)이 아니라 /home 응답이 그대로 간다", () => {
    const homeSource = readFileSync(join(process.cwd(), "app/(tabs)/index.tsx"), "utf8");
    // 라운드 66 적대 리뷰(S-2)에서 인자가 다섯이 되며 호출이 여러 줄로 나뉘었다 — 첫 인자는
    // 그대로 /home 응답이다.
    expect(homeSource).toContain("useHomeNotificationEvaluation(\n    hasSession ? home.data : undefined,");
    // 훅 호출에 재조정 값이 섞여 들어가지 않는다(호출 전체에 monthlyUsed가 없다).
    const callAt = homeSource.indexOf("useHomeNotificationEvaluation(\n");
    const call = homeSource.slice(callAt, homeSource.indexOf(");", callAt));
    expect(call).not.toContain("monthlyUsed");
  });
});

/**
 * 라운드 79 B (GAP-079 #2) — **같은 함수, 다른 입력**: 예산 알림은 서버가 모르는 사실 위에서
 * 단언하지 않는다.
 *
 * 위 라운드 51 #7이 고정한 판단("알림 입력은 서버 확정값이다")은 그대로다. 이번 라운드가 세는
 * 것은 그 판단의 **다른 한 쪽**이다: 같은 화면의 예산 배너·진행바·히어로는 대기 행까지 재조정한
 * 값(`resolveThisMonthUsedKrw` — src/home/budget-edit.ts)을 읽으므로, 대기 행이 있는 순간 두
 * 표면이 서로 다른 "이번 달"을 본다. 판정 함수는 세 표면이 공유한다(@wooriai/domain의
 * `reachedBudgetBoundaries` — 서버 푸시·홈 배너·인앱 알림. apps/api/src/push/push-dispatch.
 * service.ts가 *"규칙이 갈라질 수 없다"* 고 적어 둔 그 함수다). ⚠️ **갈라지는 것은 규칙이 아니라
 * 입력이다.**
 *
 * 답은 형제 알림 둘이 이미 갖고 있었다 — record_gap(라운드 54 P1-3)과 monthly_wrapup(GAP-066 #8)은
 * `hasPendingLocalRecords`가 참이면 **발화하지 않는다**(*"서버 스냅샷이 모르는 기록을 두고
 * 단언하지 않는다"*). 예산이 **같은 갈래 형식**으로 그 규율에 든다. 배선은 0건이다: 그 값은
 * P1-3부터 이미 `evaluateHomeNotifications`의 입력에 있고, 홈 화면은 한 글자도 바뀌지 않는다
 * (이 파일의 "홈 배선 계약" 테스트가 그 사실을 계속 지킨다).
 *
 * 이 절이 고정하는 다섯:
 *  ⓐ 대기 행이 있으면 `budget_80`·`budget_100` 후보가 **0건**(형제 둘과 같은 갈래).
 *  ⓑ 억제가 **키를 태우지 않는다** — 동기화 뒤 다음 평가가 **정확히 한 번** 발화한다.
 *  ⓒ 대기 행이 0건이면 답이 **종전과 바이트 불변**(오늘 대다수 경로다).
 *  ⓓ 두 표면의 입력이 실제로 갈린다는 **오늘의 사실**(양방향 — 값으로 재현한다).
 *  ⓔ 주간 요약은 이 게이트 **밖**이라는 대조(1순위가 화면이 만든 재조정 값이다).
 */
describe("라운드 79 B: 예산 알림은 그 달의 회복 가능한 대기 행이 있는 동안 침묵한다", () => {
  const kst = (year: number, month1: number, day: number, hour = 12) =>
    Date.UTC(year, month1 - 1, day, hour) - SEOUL_UTC_OFFSET_MS;
  /** 2026-08-03(월) KST — 8월 초라 지난달 정리(7월)도 함께 평가되는 시점이다. */
  const now = kst(2026, 8, 3);
  const BUDGET = 1_000_000;
  const base = { childId: "child-1", yearMonth: "2026-08", budgetKrw: BUDGET };
  /** 7월 캐시 두 건(합계 1,245,700원) — 지난달 정리가 실제로 발화하는 값. */
  const julyRecords = [
    { amountKrw: 84_200, spentOn: "2026-07-02", expenseType: "expense" },
    { amountKrw: 1_161_500, spentOn: "2026-07-28", expenseType: "expense" }
  ];
  /** 다섯 종류가 **동시에** 후보가 되는 홈 입력(주간만 판정 불가로 빼 둔다 — G-1). */
  const noisyHome = {
    child: { id: "child-1", nickname: "다온이", stageLabel: "24개월" },
    monthly: { yearMonth: "2026-08", amountKrw: BUDGET, usedAmountKrw: 900_000 },
    lastSeenStageLabel: "12개월",
    followupEntries: [followupEntry({ clickedAt: now - PURCHASE_FOLLOWUP_MIN_AGE_MS })],
    now,
    weekly: undefined as WeeklySpendResolution,
    lastRecordedOn: "2026-07-20",
    lastMonthRecords: julyRecords
  };

  beforeEach(() => {
    useNotificationStore.getState().resetAll();
  });

  it("ⓐ 대기 행이 있으면 예산 후보가 0건이다 (80% · 정확히 100% · 초과 전부)", () => {
    for (const spentKrw of [800_000, 999_999, 1_000_000, 1_000_001, 3_000_000]) {
      expect(budgetNotifications({ ...base, spentKrw, hasRecoverablePendingMonthRecords: true })).toEqual([]);
    }
  });

  it("ⓐ 형제 둘과 같은 갈래다: 서버 스냅샷을 근거로 하는 셋만 함께 침묵한다", () => {
    // 대기 행이 없을 때는 다섯 종류가 모두 후보가 된다(평가 순서는 evaluateHomeNotifications 그대로).
    expect(evaluateHomeNotifications(noisyHome).map((candidate) => candidate.type)).toEqual([
      "budget_80",
      "stage_transition",
      "purchase_pending",
      "record_gap",
      "monthly_wrapup"
    ]);
    // 대기 행이 있으면 **서버가 모르는 수를 말하는 셋**만 빠진다. 시기 전환·구매 확인은 서버
    // 집계와 무관한 사실(단계 라벨 · 이 기기의 클릭 로그)이라 종전 그대로 말한다.
    expect(
      evaluateHomeNotifications({
        ...noisyHome,
        hasPendingLocalRecords: true,
        hasRecoverablePendingMonthRecords: true
      }).map((candidate) => candidate.type)
    ).toEqual(["stage_transition", "purchase_pending"]);
  });

  it("ⓑ 억제는 키를 태우지 않는다: 동기화가 끝난 다음 평가가 정확히 한 번 발화한다", () => {
    const budgetEntries = () =>
      useNotificationStore.getState().entries.filter((entry) => entry.type.startsWith("budget_"));
    // 이 절의 관심사는 예산 하나다 — 나머지 넷은 후보가 되지 않게 둔다.
    const home = {
      ...noisyHome,
      lastSeenStageLabel: "24개월",
      followupEntries: [],
      lastRecordedOn: undefined,
      lastMonthRecords: undefined
    };

    // 1차: 지하철에서 세 건을 오프라인으로 적은 직후. 서버 집계는 이미 90%지만 이 기기에는 아직
    // 올라가지 않은 행이 있다 -> 아무 말도 하지 않고, 키도 쓰지 않는다.
    useNotificationStore
      .getState()
      .ingest(evaluateHomeNotifications({ ...home, hasRecoverablePendingMonthRecords: true }), now);
    expect(budgetEntries()).toEqual([]);
    expect(useNotificationStore.getState().seenDedupeKeys).not.toContain("budget_80:child-1:2026-08");

    // 2차: 아웃박스가 확정돼 대기 행이 사라졌다 -> 키가 살아 있으므로 그대로 발화한다.
    useNotificationStore
      .getState()
      .ingest(evaluateHomeNotifications({ ...home, hasRecoverablePendingMonthRecords: false }), now);
    expect(budgetEntries().map((entry) => entry.title)).toEqual(["이번 달 예산의 80%를 사용했어요"]);

    // 3차(같은 달 재평가): dedupe가 막아 한 달에 한 번이다 — 미뤄진 것이지 두 번 뜨는 것이 아니다.
    useNotificationStore
      .getState()
      .ingest(evaluateHomeNotifications({ ...home, hasRecoverablePendingMonthRecords: false }), now);
    expect(budgetEntries()).toHaveLength(1);
  });

  it("ⓒ 대기 행이 0건이면 답이 종전과 바이트 불변이다 (false·미전달 둘 다)", () => {
    for (const spentKrw of [0, 799_999, 800_000, 999_999, 1_000_000, 1_000_001, 3_000_000]) {
      const answer = budgetNotifications({ ...base, spentKrw });
      expect(budgetNotifications({ ...base, spentKrw, hasRecoverablePendingMonthRecords: false })).toEqual(answer);
      expect(budgetNotifications({ ...base, spentKrw, hasRecoverablePendingMonthRecords: undefined })).toEqual(answer);
    }
    // 문구·키·legacy 키까지 한 글자도 바뀌지 않았다(게이트는 갈래를 하나 더할 뿐이다).
    expect(budgetNotifications({ ...base, spentKrw: 800_000, hasRecoverablePendingMonthRecords: false })).toEqual([
      {
        type: "budget_80",
        title: "이번 달 예산의 80%를 사용했어요",
        body: "남은 예산을 확인해보세요.",
        dedupeKey: "budget_80:child-1:2026-08",
        legacyDedupeKeys: ["budget_80:2026-08"],
        childId: "child-1"
      }
    ]);
    expect(budgetNotifications({ ...base, spentKrw: 1_000_000, hasRecoverablePendingMonthRecords: false })).toEqual([
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

  /**
   * ⓓ **오늘의 사실을 값으로.** 두 표면의 입력이 실제로 갈리는지를 산문이 아니라 두 모듈을
   * 나란히 돌려서 확인한다 — 배너는 `resolveThisMonthUsedKrw`(재조정), 알림은 `/home`의
   * `monthly.usedAmountKrw`(서버 집계).
   */
  describe("ⓓ 배너와 알림이 서로 다른 '이번 달'을 본다 (양방향 재현)", () => {
    const yearMonth = "2026-08";
    /** 오프라인 저장소 행 하나(src/home/budget-edit.test.ts와 같은 관례). */
    const offlineRow = (partial: {
      localId: string;
      canonicalId?: string | null;
      syncState?: LocalExpenseRow["syncState"];
      pendingDelete?: boolean;
      spentOn: string;
      amountKrw: number;
    }): LocalExpenseRow => ({
      localId: partial.localId,
      canonicalId: partial.canonicalId ?? null,
      childId: "child-1",
      payload: {
        childId: "child-1",
        categoryId: "c0a7e901-0000-4c01-8c01-c47e900ec001",
        amountKrw: partial.amountKrw,
        spentOn: partial.spentOn,
        itemName: "기저귀",
        expenseType: "expense"
      },
      version: null,
      syncState: partial.syncState ?? "pending",
      pendingDelete: partial.pendingDelete ?? false,
      conflictCurrent: null,
      lastError: null,
      createdAt: "2026-08-01T00:00:00.000Z",
      updatedAt: "2026-08-01T00:00:00.000Z"
    });

    it("오프라인 기록 방향: 배너는 82%로 서는데 서버 집계는 79%라 알림이 없다", () => {
      const serverUsedKrw = 790_000;
      const cachedExpenses = [{ id: "expense-1", amountKrw: serverUsedKrw, expenseType: "expense" }];
      const pendingRow = offlineRow({ localId: "local-1", amountKrw: 30_000, spentOn: "2026-08-02" });

      const monthlyUsed = resolveThisMonthUsedKrw({
        cachedExpenses,
        offline: { rows: [pendingRow], childId: "child-1", yearMonth },
        homeUsedKrw: serverUsedKrw
      });
      expect(monthlyUsed).toBe(820_000);
      // 화면(배너)은 재조정 값을 본다 -> 경고가 선다.
      expect(evaluateBudgetWarning({ budgetKrw: BUDGET, spentKrw: monthlyUsed! })?.level).toBe("approaching");
      // 같은 순간의 알림은 서버 집계를 본다 -> 침묵. 게이트 유무와 무관하게 같은 답이고,
      // 이 방향의 대가는 "하루 늦게"뿐이다(라운드 51 #7의 판단 그대로).
      expect(budgetNotifications({ ...base, spentKrw: serverUsedKrw })).toEqual([]);
      expect(budgetNotifications({ ...base, spentKrw: serverUsedKrw, hasRecoverablePendingMonthRecords: true })).toEqual([]);
    });

    it("삭제 대기 방향(더 나쁜 쪽): 배너는 서지 않는데 알림만 뜨고 그 달의 키를 태우던 자리", () => {
      const serverUsedKrw = 800_000;
      const cachedExpenses = [
        { id: "expense-1", amountKrw: 770_000, expenseType: "expense" },
        { id: "expense-2", amountKrw: 30_000, expenseType: "expense" }
      ];
      // 서버에는 아직 살아 있는 30,000원 지출의 삭제가 이 기기에서 대기 중이다.
      const pendingDelete = offlineRow({
        localId: "local-2",
        canonicalId: "expense-2",
        amountKrw: 30_000,
        spentOn: "2026-08-02",
        pendingDelete: true
      });

      const monthlyUsed = resolveThisMonthUsedKrw({
        cachedExpenses,
        offline: { rows: [pendingDelete], childId: "child-1", yearMonth },
        homeUsedKrw: serverUsedKrw
      });
      expect(monthlyUsed).toBe(770_000);
      // 배너는 서지 않는다(77%).
      expect(evaluateBudgetWarning({ budgetKrw: BUDGET, spentKrw: monthlyUsed! })).toBeNull();
      // 게이트가 없던 종전에는 같은 순간 알림이 떴고, 그 달의 dedupeKey를 태워 **나중에 진짜로
      // 80%를 넘겨도 다시 오지 않았다**. 게이트가 그 자리를 침묵으로 바꾼다.
      expect(budgetNotifications({ ...base, spentKrw: serverUsedKrw }).map((candidate) => candidate.type)).toEqual([
        "budget_80"
      ]);
      expect(budgetNotifications({ ...base, spentKrw: serverUsedKrw, hasRecoverablePendingMonthRecords: true })).toEqual([]);
    });

    it("화면 배선의 오늘 값: 배너·진행바가 읽는 것은 재조정 값이다 (읽기만 — 홈은 무접촉)", () => {
      const homeSource = readFileSync(join(process.cwd(), "app/(tabs)/index.tsx"), "utf8");
      expect(homeSource).toContain("  const monthlyUsed = hasSession\n    ? resolveThisMonthUsedKrw({");
      expect(homeSource).toContain(
        "  const budgetWarning = hasSession ? evaluateBudgetWarning({ budgetKrw: budget, spentKrw: monthlyUsed }) : null;"
      );
      // 알림 쪽 입력(= /home 응답 그대로)은 위 "홈 배선 계약" 테스트가 이미 고정한다.
    });
  });

  it("ⓔ 대조: 주간 요약은 이 게이트 밖이다 (1순위가 화면이 만든 재조정 값이라 이미 정합이다)", () => {
    const weekly = { totalKrw: 84_200, text: "이번 주 84,200원 · 지난주 같은 요일까지보다 12,000원 적게 썼어요" };
    const candidates = evaluateHomeNotifications({
      ...noisyHome,
      lastSeenStageLabel: "24개월",
      followupEntries: [],
      lastRecordedOn: undefined,
      lastMonthRecords: undefined,
      hasPendingLocalRecords: true,
      hasRecoverablePendingMonthRecords: true,
      weekly
    });
    // 예산은 침묵하지만 주간 요약은 그대로 뜬다 — 그 문구의 숫자는 홈 주간 카드가 대기 행까지
    // 재조정해 이미 만든 값이라, 화면과 다른 수를 말할 자리가 없다.
    expect(candidates.map((candidate) => candidate.type)).toEqual(["weekly_summary"]);
    expect(candidates[0]!.title).toBe(weekly.text);
  });

  /**
   * ⚠️ **라운드 79 리뷰(M-3·S-1) — 게이트의 단위가 형제 둘과 다르다.**
   *
   * 트랙 B는 형제 둘이 쓰던 술어(`hasPendingRecordsForChild`)를 예산에도 그대로 먹였다. 그
   * 술어는 ⓐ `syncState !== "synced"` **전부**를 세고 ⓑ **달을 가리지 않는다**. 두 성질이
   * 예산에서만 서술을 거짓으로 만든다.
   *  - **종점 상태**: `failed`·`conflict`는 사용자가 재시도하거나 폐기할 때까지 영구히 남는다.
   *    그러면 대가가 *"지연"* 이 아니라 **그 달 전체 손실**이다(예산 dedupeKey는 달 단위라
   *    그 달에 다시 오지 않는다 — 주 단위인 record_gap과 성질이 다르다).
   *  - **달**: 3월에 실패한 행이 8월 경계를 막을 이유가 없다.
   * 그래서 예산 게이트는 **회복 가능한 상태 × 그 달**로 좁혔고, 그 달 단위는 배너가 재조정
   * 캐시를 고르는 조건(`hasPendingMonthAdjustments`)과 **같다**.
   */
  describe("ⓕ 게이트의 단위: 회복 가능한 상태 × 그 달 (M-3·S-1)", () => {
    /** 술어가 실제로 읽는 세 칸만 가진 최소 행(구조 호환 — 알림 층의 규율). */
    const row = (partial: { syncState: string; spentOn: string; childId?: string }) => ({
      childId: partial.childId ?? "child-1",
      syncState: partial.syncState,
      payload: { spentOn: partial.spentOn }
    });
    /** 배너 쪽 술어와 나란히 돌리기 위한 온전한 로컬 행. */
    const offlineRowFor = (partial: { syncState: LocalExpenseRow["syncState"]; spentOn: string }): LocalExpenseRow => ({
      localId: `local-${partial.syncState}-${partial.spentOn}`,
      canonicalId: null,
      childId: "child-1",
      payload: {
        childId: "child-1",
        categoryId: "c0a7e901-0000-4c01-8c01-c47e900ec001",
        amountKrw: 30_000,
        spentOn: partial.spentOn,
        itemName: "기저귀",
        expenseType: "expense"
      },
      version: null,
      syncState: partial.syncState,
      pendingDelete: false,
      conflictCurrent: null,
      lastError: null,
      createdAt: "2026-08-01T00:00:00.000Z",
      updatedAt: "2026-08-01T00:00:00.000Z"
    });

    it("회복 가능한 둘만 센다 — 종점 상태(failed·conflict)는 세지 않는다", () => {
      expect([...RECOVERABLE_PENDING_SYNC_STATES]).toEqual(["pending", "syncing"]);
      for (const state of RECOVERABLE_PENDING_SYNC_STATES) {
        expect(hasRecoverablePendingRecordsForMonth([row({ syncState: state, spentOn: "2026-08-02" })], "child-1", "2026-08"), state).toBe(true);
      }
      for (const state of ["failed", "conflict", "synced"]) {
        expect(
          hasRecoverablePendingRecordsForMonth([row({ syncState: state, spentOn: "2026-08-02" })], "child-1", "2026-08"),
          state
        ).toBe(false);
        // ⚠️ 형제 둘의 술어는 종점 상태를 **센다** — 두 술어가 실제로 다르다는 사실이 값으로 선다
        // (그쪽 의미는 그대로다: "서버가 모르는 기록이 있다"에는 실패·충돌도 든다).
        expect(hasPendingRecordsForChild([row({ syncState: state, spentOn: "2026-08-02" })], "child-1"), state).toBe(
          state !== "synced"
        );
      }
    });

    it("그 달의 행만 센다 — 배너가 재조정 캐시를 고르는 조건과 같은 달 단위다", () => {
      const otherMonth = [row({ syncState: "pending", spentOn: "2026-03-11" })];
      expect(hasRecoverablePendingRecordsForMonth(otherMonth, "child-1", "2026-08")).toBe(false);
      expect(hasRecoverablePendingRecordsForMonth(otherMonth, "child-1", "2026-03")).toBe(true);
      // 다른 아이·달 모름·행 없음은 전부 false다(모르는 것을 참으로 세지 않는다).
      expect(hasRecoverablePendingRecordsForMonth(otherMonth, "child-2", "2026-03")).toBe(false);
      expect(hasRecoverablePendingRecordsForMonth(otherMonth, "child-1", null)).toBe(false);
      expect(hasRecoverablePendingRecordsForMonth(null, "child-1", "2026-08")).toBe(false);
      expect(hasRecoverablePendingRecordsForMonth([null, undefined, {}], "child-1", "2026-08")).toBe(false);
      // spentOn이 없으면 그 달의 행인지 알 수 없다 — 배너의 재조정도 그 행을 더하지 않는다.
      expect(hasRecoverablePendingRecordsForMonth([{ childId: "child-1", syncState: "pending" }], "child-1", "2026-08")).toBe(
        false
      );
    });

    it("달 단위가 배너의 술어와 실제로 같다 (같은 행을 나란히 돌린다)", () => {
      const thisMonth = offlineRowFor({ syncState: "pending", spentOn: "2026-08-02" });
      const otherMonth = offlineRowFor({ syncState: "pending", spentOn: "2026-03-11" });
      for (const [label, rows, expected] of [
        ["이번 달 대기", [thisMonth], true],
        ["다른 달 대기", [otherMonth], false],
        ["둘 다", [otherMonth, thisMonth], true],
        ["없음", [], false]
      ] as const) {
        expect(hasRecoverablePendingRecordsForMonth(rows, "child-1", "2026-08"), label).toBe(expected);
        // 배너(재조정) 쪽 술어도 같은 답을 낸다 — 두 표면이 같은 "이번 달"을 본다.
        expect(hasPendingMonthAdjustments({ rows: [...rows], childId: "child-1", yearMonth: "2026-08" }), label).toBe(
          expected
        );
      }
      // ⚠️ **오늘 두 술어가 갈리는 자리는 상태 하나뿐이다**(달 단위는 같다): 배너는 종점 상태도
      // 재조정에 넣지만(그 행은 화면에서 여전히 보인다) 게이트는 세지 않는다. 그 차이가 의도이고,
      // 그래서 값으로 적는다.
      const failedThisMonth = [offlineRowFor({ syncState: "failed", spentOn: "2026-08-02" })];
      expect(hasPendingMonthAdjustments({ rows: failedThisMonth, childId: "child-1", yearMonth: "2026-08" })).toBe(true);
      expect(hasRecoverablePendingRecordsForMonth(failedThisMonth, "child-1", "2026-08")).toBe(false);
    });

    it("종점 상태 행만 남은 달에는 예산 알림이 **발화한다** (침묵의 끝이 사용자의 폐기가 아니다)", () => {
      // 실패한 행 하나가 그 달 내내 남아 있는 기기. 종전 게이트는 여기서 영영 침묵했다 —
      // 예산 dedupeKey가 달 단위라 그 달에는 다시 올 기회 자체가 없었다.
      const failedOnly = [offlineRowFor({ syncState: "failed", spentOn: "2026-08-02" })];
      const gate = hasRecoverablePendingRecordsForMonth(failedOnly, "child-1", "2026-08");
      expect(gate).toBe(false);
      expect(
        budgetNotifications({ ...base, spentKrw: 900_000, hasRecoverablePendingMonthRecords: gate }).map(
          (candidate) => candidate.type
        )
      ).toEqual(["budget_80"]);
      // 충돌 행도 같다(둘 다 큐가 스스로 풀지 못하는 종점이다).
      const conflictOnly = [offlineRowFor({ syncState: "conflict", spentOn: "2026-08-02" })];
      expect(hasRecoverablePendingRecordsForMonth(conflictOnly, "child-1", "2026-08")).toBe(false);
    });

    it("다른 달 대기 행은 이번 달 경계를 막지 않는다", () => {
      const marchPending = [offlineRowFor({ syncState: "pending", spentOn: "2026-03-11" })];
      expect(
        budgetNotifications({
          ...base,
          spentKrw: 900_000,
          hasRecoverablePendingMonthRecords: hasRecoverablePendingRecordsForMonth(marchPending, "child-1", "2026-08")
        }).map((candidate) => candidate.type)
      ).toEqual(["budget_80"]);
    });

    it("훅·화면 배선: 예산 게이트는 이번 달을 보고, 형제 둘의 값은 종전 그대로다", () => {
      const homeSource = readFileSync(join(process.cwd(), "app/(tabs)/index.tsx"), "utf8");
      expect(homeSource).toContain(
        "const hasRecoverablePendingMonthRecords = hasRecoverablePendingRecordsForMonth(\n    offlineSyncSnapshot.rows,\n    childId,\n    thisYearMonth\n  );"
      );
      // 형제 둘의 값은 한 글자도 바뀌지 않았다(그쪽 의미 유지 — 라운드 54 P1-3).
      expect(homeSource).toContain(
        "const hasPendingLocalRecords = hasPendingRecordsForChild(offlineSyncSnapshot.rows, childId);"
      );
      // 배너가 쓰는 달과 **같은 값**이다(같은 변수 하나에서 나온다).
      expect(homeSource).toContain("offline: { rows: offlineSyncSnapshot.rows, childId, yearMonth: thisYearMonth }");
      // 알림 층은 홈 층 모듈을 import하지 않는다(순수 모듈 규율 — 순환 없음).
      const generatorsSource = readFileSync(join(process.cwd(), "src/notifications/generators.ts"), "utf8");
      expect(generatorsSource).not.toMatch(/^import .*from "\.\.\/home\/budget-edit"/m);
    });
  });
});
