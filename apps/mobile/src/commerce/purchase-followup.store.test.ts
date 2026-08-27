import { beforeEach, describe, expect, it } from "vitest";
import {
  applyPurchaseLinkClick,
  applySnooze,
  applyStatus,
  isFollowupForSelectedChild,
  isPromptEligible,
  PURCHASE_FOLLOWUP_MAX_AGE_MS,
  PURCHASE_FOLLOWUP_MAX_ENTRIES,
  PURCHASE_FOLLOWUP_MAX_PROMPTS,
  PURCHASE_FOLLOWUP_MIN_AGE_MS,
  selectPromptEligibleFollowup,
  usePurchaseFollowupStore,
  type PurchaseFollowupClick,
  type PurchaseFollowupEntry
} from "./purchase-followup.store";
import { persistStorage } from "../stores/persist-storage";

const NOW = 1_700_000_000_000;

function click(overrides: Partial<PurchaseFollowupClick> = {}): PurchaseFollowupClick {
  return {
    itemTemplateId: "item-diaper",
    itemName: "네이처러브 기저귀 팬티형",
    childId: "child-1",
    priceBandText: "42,900원 ~ 48,900원",
    clickedAt: NOW,
    ...overrides
  };
}

function pendingEntry(overrides: Partial<PurchaseFollowupEntry> = {}): PurchaseFollowupEntry {
  return { ...click(), status: "pending", promptCount: 0, ...overrides };
}

describe("COM-108 purchase-followup click recording", () => {
  it("records a click as a pending entry with a zeroed prompt budget", () => {
    const entries = applyPurchaseLinkClick([], click());
    expect(entries).toEqual([
      {
        itemTemplateId: "item-diaper",
        itemName: "네이처러브 기저귀 팬티형",
        childId: "child-1",
        priceBandText: "42,900원 ~ 48,900원",
        clickedAt: NOW,
        status: "pending",
        promptCount: 0
      }
    ]);
  });

  it("keeps only the most recent click per itemTemplateId, resetting status and prompt budget", () => {
    const stale = pendingEntry({ clickedAt: NOW - 1000, status: "expired", promptCount: 2 });
    const entries = applyPurchaseLinkClick([stale], click({ clickedAt: NOW }));
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ clickedAt: NOW, status: "pending", promptCount: 0 });
  });

  it("caps the list, dropping the oldest clicks first", () => {
    let entries: PurchaseFollowupEntry[] = [];
    for (let index = 0; index < PURCHASE_FOLLOWUP_MAX_ENTRIES + 2; index += 1) {
      entries = applyPurchaseLinkClick(entries, click({ itemTemplateId: `item-${index}`, clickedAt: NOW + index }));
    }
    expect(entries).toHaveLength(PURCHASE_FOLLOWUP_MAX_ENTRIES);
    const ids = entries.map((entry) => entry.itemTemplateId);
    expect(ids).not.toContain("item-0");
    expect(ids).not.toContain("item-1");
    expect(ids).toContain(`item-${PURCHASE_FOLLOWUP_MAX_ENTRIES + 1}`);
  });
});

describe("COM-108 prompt eligibility window (3min–24h)", () => {
  it("is not eligible before 3 minutes have passed (user is probably still mid-purchase)", () => {
    const entry = pendingEntry({ clickedAt: NOW - PURCHASE_FOLLOWUP_MIN_AGE_MS + 1 });
    expect(isPromptEligible(entry, NOW)).toBe(false);
  });

  it("is eligible from exactly 3 minutes up to exactly 24 hours", () => {
    expect(isPromptEligible(pendingEntry({ clickedAt: NOW - PURCHASE_FOLLOWUP_MIN_AGE_MS }), NOW)).toBe(true);
    expect(isPromptEligible(pendingEntry({ clickedAt: NOW - 60 * 60 * 1000 }), NOW)).toBe(true);
    expect(isPromptEligible(pendingEntry({ clickedAt: NOW - PURCHASE_FOLLOWUP_MAX_AGE_MS }), NOW)).toBe(true);
  });

  it("silently expires past 24 hours", () => {
    const entry = pendingEntry({ clickedAt: NOW - PURCHASE_FOLLOWUP_MAX_AGE_MS - 1 });
    expect(isPromptEligible(entry, NOW)).toBe(false);
  });

  it("selects the most recent eligible entry when several are in the window", () => {
    const older = pendingEntry({ itemTemplateId: "item-a", clickedAt: NOW - 2 * 60 * 60 * 1000 });
    const newer = pendingEntry({ itemTemplateId: "item-b", clickedAt: NOW - 10 * 60 * 1000 });
    const tooFresh = pendingEntry({ itemTemplateId: "item-c", clickedAt: NOW - 1000 });
    expect(selectPromptEligibleFollowup([older, newer, tooFresh], NOW, "child-1")?.itemTemplateId).toBe("item-b");
  });

  it("returns null when nothing is eligible", () => {
    expect(selectPromptEligibleFollowup([], NOW, "child-1")).toBeNull();
    expect(selectPromptEligibleFollowup([pendingEntry({ clickedAt: NOW })], NOW, "child-1")).toBeNull();
  });
});

/**
 * 라운드 39 UX-O: 구매 확인 카드는 전역 오버레이라 아이를 전환해도 그대로 떠 있었고, 거기서
 * 누른 "샀어요"는 **지금 선택된 아이**의 지출로 기록되며 서버가 그 아이의 준비템까지 준비
 * 완료로 올렸다(R19-B). 노출 판정이 클릭에 이미 박혀 있던 childId를 보게 한다 --
 * 형제 기능(src/items/expense-link-prompt.ts의 scope.childId)과 같은 원칙.
 */
describe("라운드 39 UX-O 구매 확인 프롬프트의 아이 스코프", () => {
  const eligibleAt = NOW - 10 * 60 * 1000;

  it("같은 아이를 보고 있으면 그대로 띄운다", () => {
    const entry = pendingEntry({ childId: "child-1", clickedAt: eligibleAt });
    expect(isFollowupForSelectedChild(entry, "child-1")).toBe(true);
    expect(selectPromptEligibleFollowup([entry], NOW, "child-1")?.itemTemplateId).toBe("item-diaper");
  });

  it("다른 아이를 보고 있으면 띄우지 않는다 (오기록 방지)", () => {
    const entry = pendingEntry({ childId: "child-1", clickedAt: eligibleAt });
    expect(isFollowupForSelectedChild(entry, "child-2")).toBe(false);
    expect(selectPromptEligibleFollowup([entry], NOW, "child-2")).toBeNull();
  });

  it("다른 아이의 대기 항목은 숨겨질 뿐 상태가 바뀌지 않아, 그 아이로 돌아오면 다시 나온다", () => {
    const entries = [pendingEntry({ childId: "child-1", clickedAt: eligibleAt })];
    // B를 보는 동안 미노출 -- 판정은 순수 함수라 entries를 건드리지 않는다.
    expect(selectPromptEligibleFollowup(entries, NOW, "child-2")).toBeNull();
    expect(entries[0]).toMatchObject({ status: "pending", promptCount: 0 });
    // A로 복귀: 자격 시간(3분~24시간) 안이면 그대로 다시 후보가 된다.
    expect(selectPromptEligibleFollowup(entries, NOW, "child-1")?.itemTemplateId).toBe("item-diaper");
    // 24시간이 지나 자격을 잃은 뒤에 돌아오면 아이가 맞아도 조용히 만료된 채로 둔다.
    expect(selectPromptEligibleFollowup(entries, eligibleAt + PURCHASE_FOLLOWUP_MAX_AGE_MS + 1, "child-1")).toBeNull();
  });

  it("여러 아이의 대기 항목이 섞여 있으면 지금 아이의 것 중 가장 최근 것만 고른다", () => {
    const mine = pendingEntry({ itemTemplateId: "item-mine", childId: "child-1", clickedAt: NOW - 30 * 60 * 1000 });
    const others = pendingEntry({ itemTemplateId: "item-other", childId: "child-2", clickedAt: NOW - 5 * 60 * 1000 });
    expect(selectPromptEligibleFollowup([mine, others], NOW, "child-1")?.itemTemplateId).toBe("item-mine");
    expect(selectPromptEligibleFollowup([mine, others], NOW, "child-2")?.itemTemplateId).toBe("item-other");
  });

  it("아이가 아직 선택되지 않았으면(rehydrate 전 포함) 묻지 않는다", () => {
    const entry = pendingEntry({ childId: "child-1", clickedAt: eligibleAt });
    expect(isFollowupForSelectedChild(entry, null)).toBe(false);
    expect(selectPromptEligibleFollowup([entry], NOW, null)).toBeNull();
  });

  it("childId 없는 레거시 항목은 보수적으로 미노출 (지금 아이의 것으로 소급 배정하지 않는다)", () => {
    // 실제로는 sanitizedEntries가 childId 없는 옛 blob을 rehydrate에서 이미 걸러내므로 이
    // 경우는 방어선이다 -- 아래 "childId 없는 옛 blob은 rehydrate 단계에서 걸러진다"가 그 사실을
    // 함께 못박는다.
    const legacy = { ...pendingEntry({ clickedAt: eligibleAt }), childId: undefined } as unknown as PurchaseFollowupEntry;
    expect(isFollowupForSelectedChild(legacy, "child-1")).toBe(false);
    expect(selectPromptEligibleFollowup([legacy], NOW, "child-1")).toBeNull();
    // 시간·상태 게이트 자체는 통과한다 -- 걸러 낸 이유가 오직 아이라는 것을 분명히 한다.
    expect(isPromptEligible(legacy, NOW)).toBe(true);
  });
});

describe("COM-108 snooze (아직이요) -- max 2 prompts total, then auto-expire", () => {
  it("keeps the entry pending after the first snooze so one re-prompt is allowed", () => {
    const eligibleAt = NOW - 10 * 60 * 1000;
    const once = applySnooze([pendingEntry({ clickedAt: eligibleAt })], "item-diaper");
    expect(once[0]).toMatchObject({ status: "pending", promptCount: 1 });
    expect(isPromptEligible(once[0]!, NOW)).toBe(true);
  });

  it("auto-expires on the 2nd snooze (2 prompts total), never prompting again", () => {
    const eligibleAt = NOW - 10 * 60 * 1000;
    let entries = applySnooze([pendingEntry({ clickedAt: eligibleAt })], "item-diaper");
    entries = applySnooze(entries, "item-diaper");
    expect(entries[0]).toMatchObject({ status: "expired", promptCount: PURCHASE_FOLLOWUP_MAX_PROMPTS });
    expect(selectPromptEligibleFollowup(entries, NOW, "child-1")).toBeNull();
  });

  it("only touches the targeted pending entry", () => {
    const other = pendingEntry({ itemTemplateId: "item-other" });
    const done = pendingEntry({ itemTemplateId: "item-done", status: "done" });
    const entries = applySnooze([other, done], "item-done");
    expect(entries).toEqual([other, done]);
  });
});

describe("COM-108 done (샀어요) and dismiss (괜찮아요)", () => {
  it("marks the entry done so it never prompts again", () => {
    const eligibleAt = NOW - 10 * 60 * 1000;
    const entries = applyStatus([pendingEntry({ clickedAt: eligibleAt })], "item-diaper", "done");
    expect(entries[0]!.status).toBe("done");
    expect(selectPromptEligibleFollowup(entries, NOW, "child-1")).toBeNull();
  });

  it("dismisses the entry permanently", () => {
    const eligibleAt = NOW - 10 * 60 * 1000;
    const entries = applyStatus([pendingEntry({ clickedAt: eligibleAt })], "item-diaper", "dismissed");
    expect(entries[0]!.status).toBe("dismissed");
    expect(selectPromptEligibleFollowup(entries, NOW, "child-1")).toBeNull();
  });
});

/**
 * ANA-127: 프롬프트의 purchase_followup_answered가 affiliate_link_clicked와 같은 platform
 * 차원을 실을 수 있으려면 클릭 시점의 플랫폼이 답변 시점까지 살아 있어야 한다.
 */
describe("ANA-127 clicked-link platform survives to the answer", () => {
  it("carries the platform onto the recorded entry", () => {
    const entries = applyPurchaseLinkClick([], click({ platform: "coupang" }));
    expect(entries[0].platform).toBe("coupang");
  });

  it("keeps the platform through snooze and through done/dismissed transitions", () => {
    let entries = applyPurchaseLinkClick([], click({ platform: "naver" }));
    entries = applySnooze(entries, "item-diaper");
    expect(entries[0]).toMatchObject({ platform: "naver", promptCount: 1 });
    entries = applyStatus(entries, "item-diaper", "done");
    expect(entries[0]).toMatchObject({ platform: "naver", status: "done" });
  });

  it("leaves the platform absent for a click recorded by a pre-ANA-127 build (never invented)", () => {
    const entries = applyPurchaseLinkClick([], click());
    expect(entries[0].platform).toBeUndefined();
    expect(Object.keys(entries[0])).not.toContain("platform");
  });

  it("re-clicking through a different platform replaces the remembered platform", () => {
    let entries = applyPurchaseLinkClick([], click({ platform: "coupang" }));
    entries = applyPurchaseLinkClick(entries, click({ platform: "custom", clickedAt: NOW + 1000 }));
    expect(entries).toHaveLength(1);
    expect(entries[0].platform).toBe("custom");
  });
});

describe("COM-108 persisted store wiring", () => {
  beforeEach(() => {
    usePurchaseFollowupStore.setState({ entries: [] });
  });

  it("records, snoozes, completes, and dismisses through the store actions", () => {
    const store = usePurchaseFollowupStore.getState();
    store.recordLinkClick(click({ itemTemplateId: "item-a" }));
    store.recordLinkClick(click({ itemTemplateId: "item-b", clickedAt: NOW + 1 }));
    expect(usePurchaseFollowupStore.getState().entries).toHaveLength(2);

    usePurchaseFollowupStore.getState().snoozeFollowup("item-a");
    expect(usePurchaseFollowupStore.getState().entries.find((entry) => entry.itemTemplateId === "item-a")).toMatchObject(
      { status: "pending", promptCount: 1 }
    );

    usePurchaseFollowupStore.getState().completeFollowup("item-a");
    expect(usePurchaseFollowupStore.getState().entries.find((entry) => entry.itemTemplateId === "item-a")?.status).toBe(
      "done"
    );

    usePurchaseFollowupStore.getState().dismissFollowup("item-b");
    expect(usePurchaseFollowupStore.getState().entries.find((entry) => entry.itemTemplateId === "item-b")?.status).toBe(
      "dismissed"
    );
  });

  /**
   * 라운드 39 UX-O 마이그레이션 판단의 근거: childId 없는 항목은 **rehydrate 단계에서 이미
   * 사라진다**(sanitizedEntries가 childId를 필수 문자열로 본다). 그래서 노출 판정에 childId
   * 게이트를 넣어도 "옛 항목이 통째로 안 뜨게 되는" 회귀가 실제 사용자에게 생기지 않고,
   * 별도 마이그레이션(소급 배정)도 필요 없다.
   */
  it("childId 없는 옛 blob은 rehydrate 단계에서 걸러진다", async () => {
    await persistStorage.setItem(
      "wooriai-purchase-followup",
      JSON.stringify({
        state: {
          entries: [
            {
              itemTemplateId: "item-legacy",
              itemName: "옛 클릭",
              clickedAt: NOW,
              status: "pending",
              promptCount: 0
              // childId intentionally absent -- childId를 쓰기 전 빌드가 남긴 모양.
            },
            { ...pendingEntry({ itemTemplateId: "item-current" }) }
          ]
        },
        version: 1
      })
    );
    await usePurchaseFollowupStore.persist.rehydrate();
    expect(usePurchaseFollowupStore.getState().entries.map((entry) => entry.itemTemplateId)).toEqual(["item-current"]);
    await persistStorage.removeItem("wooriai-purchase-followup");
  });

  it("re-clicking a done item re-arms a fresh pending entry", () => {
    const store = usePurchaseFollowupStore.getState();
    store.recordLinkClick(click());
    usePurchaseFollowupStore.getState().completeFollowup("item-diaper");
    usePurchaseFollowupStore.getState().recordLinkClick(click({ clickedAt: NOW + 5000 }));
    expect(usePurchaseFollowupStore.getState().entries).toEqual([
      expect.objectContaining({ itemTemplateId: "item-diaper", clickedAt: NOW + 5000, status: "pending", promptCount: 0 })
    ]);
  });
});
