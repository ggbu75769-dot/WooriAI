import { describe, expect, it } from "vitest";
import {
  PURCHASE_FOLLOWUP_MIN_AGE_MS,
  type PurchaseFollowupEntry
} from "../commerce/purchase-followup.store";
import {
  budgetNotifications,
  evaluateHomeNotifications,
  itemTemplateIdFromPurchaseDedupeKey,
  purchasePendingDedupeKey,
  purchasePendingNotifications,
  stageTransitionNotification
} from "./generators";

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
  it("stays silent with no budget set (amountKrw 0 means unset, never '초과')", () => {
    expect(budgetNotifications({ yearMonth: "2026-08", budgetKrw: 0, spentKrw: 999_999 })).toEqual([]);
  });

  it("stays silent under 80% usage", () => {
    expect(budgetNotifications({ yearMonth: "2026-08", budgetKrw: 1_000_000, spentKrw: 799_999 })).toEqual([]);
  });

  it("fires budget_80 from exactly 80% with a month-scoped dedupeKey", () => {
    const candidates = budgetNotifications({ yearMonth: "2026-08", budgetKrw: 1_000_000, spentKrw: 800_000 });
    expect(candidates).toEqual([
      {
        type: "budget_80",
        title: "이번 달 예산의 80%를 사용했어요",
        body: "남은 예산을 확인해보세요.",
        dedupeKey: "budget_80:2026-08"
      }
    ]);
  });

  it("treats spending exactly the budget as budget_80 territory, not 초과 (strict >, like home)", () => {
    const candidates = budgetNotifications({ yearMonth: "2026-08", budgetKrw: 1_000_000, spentKrw: 1_000_000 });
    expect(candidates.map((candidate) => candidate.type)).toEqual(["budget_80"]);
  });

  it("fires only budget_100 once spending exceeds the budget (never both at once)", () => {
    const candidates = budgetNotifications({ yearMonth: "2026-08", budgetKrw: 1_000_000, spentKrw: 1_000_001 });
    expect(candidates).toEqual([
      {
        type: "budget_100",
        title: "이번 달 예산을 초과했어요",
        body: "이번 달 지출을 확인해 볼까요?",
        dedupeKey: "budget_100:2026-08"
      }
    ]);
  });

  it("keeps dedupeKeys stable across re-evaluation but re-arms on month rollover", () => {
    const input = { yearMonth: "2026-08", budgetKrw: 1_000_000, spentKrw: 850_000 };
    expect(budgetNotifications(input)[0]!.dedupeKey).toBe(budgetNotifications(input)[0]!.dedupeKey);
    const nextMonth = budgetNotifications({ ...input, yearMonth: "2026-09" });
    expect(nextMonth[0]!.dedupeKey).toBe("budget_80:2026-09");
    expect(nextMonth[0]!.dedupeKey).not.toBe(budgetNotifications(input)[0]!.dedupeKey);
    expect(
      budgetNotifications({ yearMonth: "2026-09", budgetKrw: 1_000_000, spentKrw: 1_200_000 })[0]!.dedupeKey
    ).toBe("budget_100:2026-09");
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
      dedupeKey: "stage_transition:child-1:36개월"
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
        dedupeKey: `purchase_pending:item-diaper:${NOW - PURCHASE_FOLLOWUP_MIN_AGE_MS}`
      }
    ]);
  });

  it("skips clicks younger than 3 minutes (probably still mid-purchase)", () => {
    const fresh = followupEntry({ clickedAt: NOW - PURCHASE_FOLLOWUP_MIN_AGE_MS + 1 });
    expect(purchasePendingNotifications([fresh], NOW)).toEqual([]);
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

describe("NOTI-102 combined home evaluation", () => {
  it("merges budget, stage, and purchase candidates from one home snapshot", () => {
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
      "purchase_pending"
    ]);
    expect(candidates.map((candidate) => candidate.dedupeKey)).toEqual([
      "budget_100:2026-08",
      "stage_transition:child-1:36개월",
      `purchase_pending:item-diaper:${NOW - PURCHASE_FOLLOWUP_MIN_AGE_MS}`
    ]);
  });

  it("is entirely silent for calm data (under budget, same stage, no pending clicks)", () => {
    const candidates = evaluateHomeNotifications({
      child: { id: "child-1", nickname: "다온이", stageLabel: "24개월" },
      monthly: { yearMonth: "2026-08", amountKrw: 1_000_000, usedAmountKrw: 100_000 },
      lastSeenStageLabel: "24개월",
      followupEntries: [],
      now: NOW
    });
    expect(candidates).toEqual([]);
  });
});
