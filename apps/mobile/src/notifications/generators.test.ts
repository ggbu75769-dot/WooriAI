import { beforeEach, describe, expect, it } from "vitest";
import {
  PURCHASE_FOLLOWUP_MAX_AGE_MS,
  PURCHASE_FOLLOWUP_MIN_AGE_MS,
  type PurchaseFollowupEntry
} from "../commerce/purchase-followup.store";
import { evaluateBudgetWarning } from "../home/budget-warning";
import { evaluateWeeklySummary } from "../home/weekly-summary";
import {
  budgetNotifications,
  evaluateHomeNotifications,
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
