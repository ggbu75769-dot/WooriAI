import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  applyPurchaseIntent,
  applyPurchaseLinkClick,
  applySnooze,
  applyStatus,
  clearPurchaseFollowupsForChild,
  createPurchaseFollowupEligibilityTimer,
  isFollowupForSelectedChild,
  isPromptEligible,
  nextPromptEligibleDelayMs,
  PURCHASE_FOLLOWUP_MAX_AGE_MS,
  PURCHASE_FOLLOWUP_MAX_ENTRIES,
  PURCHASE_FOLLOWUP_MAX_PROMPTS,
  PURCHASE_FOLLOWUP_MIN_AGE_MS,
  purchaseFollowupMerchantLabel,
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

/**
 * 라운드 60 리뷰(P2-10) — "샀어요" 이탈 재질문도 같은 예산을 쓴다.
 *
 * 트랙 B가 done 확정을 저장 자리로 옮긴 뒤, "샀어요"를 누르고 기록 시트를 그냥 닫으면 항목은
 * pending으로 남아 **다음 앱 세션에 다시** 뜬다. 그 재표출이 아무 예산도 쓰지 않으면 24시간
 * 창이 닫힐 때까지 되풀이된다(라운드 40 J-8이 세션 축에서 막은 것과 같은 모양의 구멍).
 */
describe("'샀어요' 이탈 재질문 상한 (라운드 60 리뷰 P2-10)", () => {
  const eligibleAt = NOW - 10 * 60 * 1000;

  it("첫 '샀어요'는 예산 한 칸만 쓰고 pending으로 남는다 (이탈하면 한 번 더 물을 수 있다)", () => {
    const once = applyPurchaseIntent([pendingEntry({ clickedAt: eligibleAt })], "item-diaper");
    expect(once[0]).toMatchObject({ status: "pending", promptCount: 1 });
    expect(isPromptEligible(once[0]!, NOW)).toBe(true);
  });

  it("두 번째에서 만료된다 — 세 번째 재질문은 없다", () => {
    let entries = applyPurchaseIntent([pendingEntry({ clickedAt: eligibleAt })], "item-diaper");
    entries = applyPurchaseIntent(entries, "item-diaper");
    expect(entries[0]).toMatchObject({ status: "expired", promptCount: PURCHASE_FOLLOWUP_MAX_PROMPTS });
    expect(selectPromptEligibleFollowup(entries, NOW, "child-1")).toBeNull();
  });

  it("'아직이요'와 같은 축을 센다 — 둘을 섞어도 상한은 하나다", () => {
    let entries = applySnooze([pendingEntry({ clickedAt: eligibleAt })], "item-diaper");
    entries = applyPurchaseIntent(entries, "item-diaper");
    expect(entries[0]).toMatchObject({ status: "expired", promptCount: PURCHASE_FOLLOWUP_MAX_PROMPTS });
  });

  it("저장이 확정되면 done이 이긴다 — 이 소진은 이탈한 경우에만 남는다", () => {
    const intended = applyPurchaseIntent([pendingEntry({ clickedAt: eligibleAt })], "item-diaper");
    const saved = applyStatus(intended, "item-diaper", "done");
    expect(saved[0]).toMatchObject({ status: "done" });
    expect(selectPromptEligibleFollowup(saved, NOW, "child-1")).toBeNull();
  });

  it("겨냥한 pending 항목만 건드린다 (다른 아이·다른 항목·이미 답한 항목 불변)", () => {
    const other = pendingEntry({ itemTemplateId: "item-other" });
    const done = pendingEntry({ itemTemplateId: "item-done", status: "done" });
    expect(applyPurchaseIntent([other, done], "item-done")).toEqual([other, done]);
  });

  it("스토어 액션이 그 순수 규칙을 그대로 쓴다", () => {
    usePurchaseFollowupStore.setState({ entries: [pendingEntry({ clickedAt: eligibleAt })] });
    usePurchaseFollowupStore.getState().intendPurchaseFollowup("item-diaper");
    expect(usePurchaseFollowupStore.getState().entries[0]).toMatchObject({ status: "pending", promptCount: 1 });
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

/**
 * 라운드 49 C-06 — "샀어요"가 아는 사실을 기록 화면에 넘기기 위해 대기 항목이 들고 있어야
 * 하는 두 값(플랫폼 → 판매처 문구, 눌린 링크 id)의 판정.
 */
describe("라운드 49 C-06 구매 확인 → 지출 기록으로 넘기는 사실", () => {
  it("아는 플랫폼만 판매처 문구가 된다 -- custom/미상은 지어내지 않는다", () => {
    expect(purchaseFollowupMerchantLabel("coupang")).toBe("쿠팡");
    expect(purchaseFollowupMerchantLabel("naver")).toBe("네이버");
    // 우리가 등록한 임의 링크는 상호를 모른다. 빈 칸으로 두고 사용자가 적게 한다.
    expect(purchaseFollowupMerchantLabel("custom")).toBeUndefined();
    // 구 blob(ANA-127 이전)에는 platform 자체가 없다.
    expect(purchaseFollowupMerchantLabel(undefined)).toBeUndefined();
    expect(purchaseFollowupMerchantLabel(null)).toBeUndefined();
  });

  it("클릭에 담긴 productLinkId가 대기 항목에 그대로 남는다", () => {
    const entries = applyPurchaseLinkClick([], click({ productLinkId: "link-9", platform: "coupang" }));
    expect(entries).toEqual([
      expect.objectContaining({ productLinkId: "link-9", platform: "coupang", status: "pending" })
    ]);
  });

  /**
   * persist v1 blob에는 `productLinkId` 키가 아예 없다. 값 하나가 없다고 멀쩡한 대기 항목을
   * 버리면 사용자는 방금 누른 링크에 대한 물음을 잃는다 -- ANA-127이 platform에서 이미 세운
   * 판단과 같다. 없으면 undefined로 두고 항목은 살린다(그때는 linkedProductLinkId 없이 저장).
   */
  it("productLinkId가 없는 옛 blob도 rehydrate에서 살아남고, 그 값만 undefined가 된다", async () => {
    await persistStorage.setItem(
      "wooriai-purchase-followup",
      JSON.stringify({
        state: {
          entries: [
            pendingEntry({ itemTemplateId: "item-old" }),
            pendingEntry({ itemTemplateId: "item-new", productLinkId: "link-9" }),
            // 문자열이 아닌 쓰레기 값은 통째로 믿지 않는다(항목 자체는 살린다).
            { ...pendingEntry({ itemTemplateId: "item-junk" }), productLinkId: 7 }
          ]
        },
        version: 1
      })
    );
    await usePurchaseFollowupStore.persist.rehydrate();
    const byId = Object.fromEntries(
      usePurchaseFollowupStore.getState().entries.map((entry) => [entry.itemTemplateId, entry.productLinkId])
    );
    expect(byId).toEqual({ "item-old": undefined, "item-new": "link-9", "item-junk": undefined });
    await persistStorage.removeItem("wooriai-purchase-followup");
  });
});

/**
 * 라운드 62 트랙 B(#5) — 삭제한 아이의 **기기 잔재** 정리.
 *
 * 아이를 지워도 이 기기에는 그 아이를 위해 무엇을 사려 했는지(itemName)와 그 아이의 id가 최대
 * 24시간 남는다. 카드가 뜨지는 않지만(`isFollowupForSelectedChild` — 그 아이는 이제 선택될 수
 * 없다) 남길 이유도 없다. 배선(finishChildRemoval에서의 호출)은 이 트랙 밖이다.
 */
describe("라운드 62 B(#5) 아이 단위 정리 clearForChild", () => {
  beforeEach(() => {
    usePurchaseFollowupStore.getState().resetAll();
  });

  it("그 아이의 대기 항목만 지우고 다른 아이의 것은 그대로 둔다", () => {
    const entries = [
      pendingEntry({ itemTemplateId: "item-a", childId: "child-1" }),
      pendingEntry({ itemTemplateId: "item-b", childId: "child-2" }),
      pendingEntry({ itemTemplateId: "item-c", childId: "child-1", status: "done" })
    ];
    expect(clearPurchaseFollowupsForChild(entries, "child-1").map((entry) => entry.itemTemplateId)).toEqual([
      "item-b"
    ]);
  });

  it("빈 childId로는 아무것도 지우지 않고, 지울 것이 없으면 같은 배열을 돌려준다", () => {
    const entries = [pendingEntry({ childId: "child-1" })];
    expect(clearPurchaseFollowupsForChild(entries, "")).toBe(entries);
    expect(clearPurchaseFollowupsForChild(entries, "   ")).toBe(entries);
    expect(clearPurchaseFollowupsForChild(entries, "child-gone")).toBe(entries);
  });

  it("스토어 액션은 그 아이의 항목만 지운다 (resetAll과 다른 별개 액션)", () => {
    const store = usePurchaseFollowupStore.getState();
    store.recordLinkClick(click({ itemTemplateId: "item-a", childId: "child-1" }));
    store.recordLinkClick(click({ itemTemplateId: "item-b", childId: "child-2" }));
    usePurchaseFollowupStore.getState().clearForChild("child-1");
    expect(usePurchaseFollowupStore.getState().entries.map((entry) => entry.itemTemplateId)).toEqual(["item-b"]);
    usePurchaseFollowupStore.getState().resetAll();
    expect(usePurchaseFollowupStore.getState().entries).toEqual([]);
  });
});

/**
 * 라운드 81 트랙 B — **자격 창이 열리기까지 남은 시간**.
 *
 * 자격은 시간 두 개로 정의되는데(3분~24시간), 그 시간이 지나는 것을 보고 있는 자리가 없었다:
 * 판정은 콜드 스타트·포그라운드 복귀·아이 전환에만 돌아서, 링크를 누르고 90초 만에 앱으로
 * 돌아온 사용자는 그 세션 내내 카드를 보지 못했다(자격은 90초 뒤에 갖춰졌는데도).
 *
 * 이 술어가 답하는 것은 "언제 다시 물어볼까" 하나이고, **판정 규칙은 한 글자도 바뀌지 않는다** --
 * 그 시각에 실제로 카드가 뜨는지는 여전히 세션 슬롯·아이 게이트·앱 잠금이 정한다.
 */
describe("라운드 81 B 자격 도래까지 남은 시간 (nextPromptEligibleDelayMs)", () => {
  it("재현: 클릭 90초 뒤 복귀 -- 지금은 후보가 없고, 남은 90초가 지나면 같은 스냅샷이 후보를 낸다", () => {
    const clickedAt = NOW - 90 * 1000;
    const entries = [pendingEntry({ clickedAt })];
    // 오늘의 답: 아직 3분 전이라 후보가 없다(그리고 그 세션에는 판정이 다시 서지 않았다).
    expect(selectPromptEligibleFollowup(entries, NOW, "child-1")).toBeNull();
    const delay = nextPromptEligibleDelayMs(entries, NOW, "child-1");
    expect(delay).toBe(PURCHASE_FOLLOWUP_MIN_AGE_MS - 90 * 1000);
    // 그 시각에 다시 물으면 같은 항목이 후보가 된다 -- 술어가 가리킨 자리가 정확히 창의 문턱이다.
    expect(selectPromptEligibleFollowup(entries, NOW + (delay ?? 0), "child-1")?.itemTemplateId).toBe("item-diaper");
    // 1밀리초 앞은 아직 문턱 밖이다(창 상수는 이 트랙에서 한 글자도 바뀌지 않는다).
    expect(selectPromptEligibleFollowup(entries, NOW + (delay ?? 0) - 1, "child-1")).toBeNull();
  });

  /**
   * 라운드 81 리뷰(M-4) — **미래 클릭은 깨움을 만들지 않는다.**
   *
   * 종전에는 남은 시간을 `Math.min`으로 MIN_AGE에 잘랐다. 상한 자체는 지켜졌지만 그 3분 뒤에
   * 깨어난 판정이 **여전히 자격 없는 같은 항목**을 보고 또 3분을 걸어, 6시간 미래의 blob 하나가
   * 3분 주기 폴링이 됐다("헛도는 깨움 0건"의 정반대다). 이제 그런 항목은 세지 않는다 -- 시간이
   * 실제로 흘러 창에 가까워지면 그때의 판정이 정상적인 깨움을 건다.
   */
  it("부정: 미래 clickedAt(시계 역행 blob)은 깨움을 만들지 않는다 -- 3분 주기 폴링 0건", () => {
    const future = [pendingEntry({ clickedAt: NOW + 6 * 60 * 60 * 1000 })];
    expect(nextPromptEligibleDelayMs(future, NOW, "child-1")).toBeNull();
    // 그 시각에 깨워 봐야 후보가 될 수 없다는 사실이 이 부정의 근거다.
    expect(selectPromptEligibleFollowup(future, NOW + PURCHASE_FOLLOWUP_MIN_AGE_MS, "child-1")).toBeNull();
    // 1밀리초만 미래여도 같다(경계는 "지금"이다).
    expect(nextPromptEligibleDelayMs([pendingEntry({ clickedAt: NOW + 1 })], NOW, "child-1")).toBeNull();
    // 실제로 시간이 흘러 그 클릭이 과거가 되면 그때는 평소대로 깨움을 만든다.
    const later = NOW + 6 * 60 * 60 * 1000 + 60 * 1000;
    expect(nextPromptEligibleDelayMs(future, later, "child-1")).toBe(PURCHASE_FOLLOWUP_MIN_AGE_MS - 60 * 1000);
    // 정상 항목이 함께 있으면 그 항목의 답은 미래 blob에 가려지지 않는다.
    const mixed = [...future, pendingEntry({ itemTemplateId: "item-soon", clickedAt: NOW - 150 * 1000 })];
    expect(nextPromptEligibleDelayMs(mixed, NOW, "child-1")).toBe(PURCHASE_FOLLOWUP_MIN_AGE_MS - 150 * 1000);
  });

  it("파생 상한: 답은 언제나 MIN_AGE 이하다", () => {
    expect(nextPromptEligibleDelayMs([pendingEntry({ clickedAt: NOW })], NOW, "child-1")).toBe(
      PURCHASE_FOLLOWUP_MIN_AGE_MS
    );
    for (const offset of [0, 1, 1000, PURCHASE_FOLLOWUP_MIN_AGE_MS - 1]) {
      const delay = nextPromptEligibleDelayMs([pendingEntry({ clickedAt: NOW - offset })], NOW, "child-1");
      expect(delay).not.toBeNull();
      expect(delay).toBeGreaterThan(0);
      expect(delay).toBeLessThanOrEqual(PURCHASE_FOLLOWUP_MIN_AGE_MS);
    }
  });

  it("부정: 이미 자격을 갖춘 항목은 깨움을 만들지 않는다 (기존 경로 무변화)", () => {
    const eligible = [pendingEntry({ clickedAt: NOW - 10 * 60 * 1000 })];
    expect(selectPromptEligibleFollowup(eligible, NOW, "child-1")).not.toBeNull();
    expect(nextPromptEligibleDelayMs(eligible, NOW, "child-1")).toBeNull();
    // 창의 문턱에 정확히 선 항목도 마찬가지다(이미 창 안이다).
    expect(
      nextPromptEligibleDelayMs([pendingEntry({ clickedAt: NOW - PURCHASE_FOLLOWUP_MIN_AGE_MS })], NOW, "child-1")
    ).toBeNull();
  });

  it("부정: 다른 아이·아이 미선택 항목은 깨움을 만들지 않는다", () => {
    const entries = [pendingEntry({ childId: "child-1", clickedAt: NOW - 30 * 1000 })];
    expect(nextPromptEligibleDelayMs(entries, NOW, "child-2")).toBeNull();
    expect(nextPromptEligibleDelayMs(entries, NOW, null)).toBeNull();
    // 그 아이로 돌아오면 그때 다시 센다 -- 상태는 아무것도 바뀌지 않았다.
    expect(nextPromptEligibleDelayMs(entries, NOW, "child-1")).toBe(PURCHASE_FOLLOWUP_MIN_AGE_MS - 30 * 1000);
  });

  it("부정: 예산을 다 쓴 항목·pending이 아닌 항목·24시간을 넘긴 항목은 깨움을 만들지 않는다", () => {
    const fresh = { clickedAt: NOW - 30 * 1000 };
    expect(
      nextPromptEligibleDelayMs(
        [pendingEntry({ ...fresh, promptCount: PURCHASE_FOLLOWUP_MAX_PROMPTS })],
        NOW,
        "child-1"
      )
    ).toBeNull();
    for (const status of ["done", "dismissed", "expired"] as const) {
      expect(nextPromptEligibleDelayMs([pendingEntry({ ...fresh, status })], NOW, "child-1")).toBeNull();
    }
    // 24시간을 넘긴 항목은 기다려도 자격이 다시 생기지 않는다(조용히 만료된 채로 둔다).
    expect(
      nextPromptEligibleDelayMs(
        [pendingEntry({ clickedAt: NOW - PURCHASE_FOLLOWUP_MAX_AGE_MS - 1 })],
        NOW,
        "child-1"
      )
    ).toBeNull();
    expect(nextPromptEligibleDelayMs([], NOW, "child-1")).toBeNull();
  });

  it("여럿이면 가장 먼저 자격을 얻는 하나를 고른다 (깨움도 하나다)", () => {
    const soon = pendingEntry({ itemTemplateId: "item-soon", clickedAt: NOW - 150 * 1000 });
    const later = pendingEntry({ itemTemplateId: "item-later", clickedAt: NOW - 10 * 1000 });
    const otherChild = pendingEntry({ itemTemplateId: "item-other", childId: "child-2", clickedAt: NOW - 179 * 1000 });
    expect(nextPromptEligibleDelayMs([soon, later, otherChild], NOW, "child-1")).toBe(
      PURCHASE_FOLLOWUP_MIN_AGE_MS - 150 * 1000
    );
  });
});

/**
 * 라운드 81 트랙 B — 그 술어를 실제 시계에 꽂는 **일회용 타이머 하나**.
 *
 * 화면(PurchaseFollowupPrompt.tsx)은 vitest에서 렌더할 수 없어서(react-native import) 타이머가
 * 화면 안에만 있으면 "제때 깨우는가 · 중복으로 걸지 않는가 · cleanup에서 풀리는가"를 물을
 * 방법이 없다. 세션 게이트를 순수 모듈로 떼어 낸 라운드 39 I-3과 같은 이유다.
 */
describe("라운드 81 B 자격 도래 타이머 (createPurchaseFollowupEligibilityTimer)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("① MIN_AGE 이전 복귀: 자격 도래 시각에 딱 한 번 판정을 다시 세운다", () => {
    const onDue = vi.fn();
    const timer = createPurchaseFollowupEligibilityTimer(onDue);
    const clickedAt = NOW - 90 * 1000;
    timer.schedule([pendingEntry({ clickedAt })], NOW, "child-1");
    expect(timer.isArmed()).toBe(true);

    const delay = PURCHASE_FOLLOWUP_MIN_AGE_MS - 90 * 1000;
    vi.advanceTimersByTime(delay - 1);
    expect(onDue).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onDue).toHaveBeenCalledTimes(1);
    // 일회용이다 -- 발화한 타이머는 스스로 표시를 내리고, 다음 깨움은 그 판정이 다시 건다.
    expect(timer.isArmed()).toBe(false);
    vi.advanceTimersByTime(PURCHASE_FOLLOWUP_MAX_AGE_MS);
    expect(onDue).toHaveBeenCalledTimes(1);
  });

  it("② cleanup(언마운트·의존성 변화): 걸린 타이머가 해제되고 다시 깨우지 않는다", () => {
    const onDue = vi.fn();
    const timer = createPurchaseFollowupEligibilityTimer(onDue);
    timer.schedule([pendingEntry({ clickedAt: NOW - 30 * 1000 })], NOW, "child-1");
    expect(vi.getTimerCount()).toBe(1);
    timer.clear();
    expect(timer.isArmed()).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
    vi.advanceTimersByTime(PURCHASE_FOLLOWUP_MIN_AGE_MS * 2);
    expect(onDue).not.toHaveBeenCalled();
    // 두 번 풀어도 안전하다(cleanup이 겹쳐 도는 경로).
    timer.clear();
    expect(timer.isArmed()).toBe(false);
  });

  it("③ 이미 자격이 있으면 타이머를 만들지 않는다 (기존 경로 무변화 · 헛도는 깨움 0건)", () => {
    const onDue = vi.fn();
    const timer = createPurchaseFollowupEligibilityTimer(onDue);
    timer.schedule([pendingEntry({ clickedAt: NOW - 10 * 60 * 1000 })], NOW, "child-1");
    expect(timer.isArmed()).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
    // 다른 아이·예산 소진·빈 목록도 같다.
    timer.schedule([pendingEntry({ clickedAt: NOW - 30 * 1000 })], NOW, "child-2");
    timer.schedule([pendingEntry({ clickedAt: NOW - 30 * 1000, promptCount: PURCHASE_FOLLOWUP_MAX_PROMPTS })], NOW, "child-1");
    timer.schedule([], NOW, "child-1");
    expect(vi.getTimerCount()).toBe(0);
    vi.advanceTimersByTime(PURCHASE_FOLLOWUP_MIN_AGE_MS * 2);
    expect(onDue).not.toHaveBeenCalled();
  });

  it("④ 중복 타이머 없음: 판정이 여러 번 돌아도 살아 있는 깨움은 언제나 하나다", () => {
    const onDue = vi.fn();
    const timer = createPurchaseFollowupEligibilityTimer(onDue);
    const entries = [pendingEntry({ clickedAt: NOW - 60 * 1000 })];
    // 포그라운드 복귀·아이 전환처럼 판정이 잇달아 도는 경로.
    timer.schedule(entries, NOW, "child-1");
    timer.schedule(entries, NOW, "child-1");
    timer.schedule(entries, NOW, "child-1");
    expect(vi.getTimerCount()).toBe(1);
    vi.advanceTimersByTime(PURCHASE_FOLLOWUP_MIN_AGE_MS);
    expect(onDue).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
    // 자격을 갖춘 뒤의 재판정은 깨움을 새로 만들지 않는다(같은 항목으로 무한히 돌지 않는다).
    timer.schedule(entries, NOW + PURCHASE_FOLLOWUP_MIN_AGE_MS, "child-1");
    expect(vi.getTimerCount()).toBe(0);
  });
});
