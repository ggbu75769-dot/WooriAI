import { describe, expect, it } from "vitest";
import {
  createPurchaseFollowupSessionGate,
  evaluateFollowupPrompt,
  followupSessionKey
} from "./purchase-followup-session";
import type { PurchaseFollowupEntry } from "./purchase-followup.store";

/**
 * 라운드 39 I-3 — 아이 A↔B 왕복에서 A의 카드가 세션 내내 다시 뜨지 않던 문제.
 *
 * 세션 게이트 키가 아이와 무관해서, A의 카드를 한 번 띄우면 그 키가 잠긴다. B로 옮기면 판정이
 * B의 후보로 카드를 갈아치우고, A로 돌아오면 A의 항목은 후보로는 뽑히지만 잠긴 키에 걸려
 * 노출되지 않는다(스토어에서는 계속 pending). 답을 받지 못한 채 내려간 카드는 슬롯을 돌려주도록
 * 고쳤고, 그 왕복을 여기서 고정한다.
 */

const NOW = Date.parse("2026-08-27T12:00:00.000Z");
/** 자격 창(3분~24시간) 한가운데. */
const CLICKED_AT = NOW - 60 * 60 * 1000;

function entry(partial: Partial<PurchaseFollowupEntry> & { itemTemplateId: string; childId: string }): PurchaseFollowupEntry {
  return {
    itemName: "유모차",
    clickedAt: CLICKED_AT,
    status: "pending",
    promptCount: 0,
    ...partial
  } as PurchaseFollowupEntry;
}

const forA = entry({ itemTemplateId: "item-a", childId: "child-a", itemName: "기저귀" });
const forB = entry({ itemTemplateId: "item-b", childId: "child-b", itemName: "분유" });

describe("세션 게이트 (createPurchaseFollowupSessionGate)", () => {
  it("한 클릭에는 슬롯이 하나뿐이고, 돌려주면 다시 잡을 수 있다", () => {
    const gate = createPurchaseFollowupSessionGate();

    expect(gate.takeSlot(forA)).toBe(true);
    expect(gate.hasSlot(forA)).toBe(true);
    expect(gate.takeSlot(forA)).toBe(false);

    gate.returnSlot(forA);
    expect(gate.hasSlot(forA)).toBe(false);
    expect(gate.takeSlot(forA)).toBe(true);
  });

  it("같은 준비템이라도 새 클릭(clickedAt)이면 다른 슬롯이다", () => {
    const gate = createPurchaseFollowupSessionGate();
    const reclicked = { ...forA, clickedAt: CLICKED_AT + 1_000 };

    expect(gate.takeSlot(forA)).toBe(true);
    expect(gate.takeSlot(reclicked)).toBe(true);
    expect(followupSessionKey(forA)).not.toBe(followupSessionKey(reclicked));
  });
});

describe("evaluateFollowupPrompt — 아이 A↔B 왕복 (I-3)", () => {
  it("A 표시 → B 후보 표시 → A 복귀 시 A 카드가 다시 뜬다", () => {
    const gate = createPurchaseFollowupSessionGate();
    const entries = [forA, forB];

    // 1) A를 보고 있다: A의 카드가 뜬다.
    const first = evaluateFollowupPrompt({ gate, active: null, entries, now: NOW, selectedChildId: "child-a" });
    expect(first).toBe(forA);

    // 2) B로 전환: 가려진 A는 슬롯을 돌려받고 내려가며, B의 후보가 뜬다.
    const second = evaluateFollowupPrompt({ gate, active: first, entries, now: NOW, selectedChildId: "child-b" });
    expect(second).toBe(forB);
    expect(gate.hasSlot(forA)).toBe(false);

    // 3) A로 복귀: 같은 카드가 다시 보인다(종전에는 세션 내내 null이었다).
    const third = evaluateFollowupPrompt({ gate, active: second, entries, now: NOW, selectedChildId: "child-a" });
    expect(third).toBe(forA);
  });

  it("B에 후보가 없어도 A로 돌아오면 다시 뜬다", () => {
    const gate = createPurchaseFollowupSessionGate();
    const entries = [forA];

    const first = evaluateFollowupPrompt({ gate, active: null, entries, now: NOW, selectedChildId: "child-a" });
    expect(first).toBe(forA);
    // B에는 대기 항목이 없다 -- 카드는 내려가고 슬롯만 돌아온다.
    const onB = evaluateFollowupPrompt({ gate, active: first, entries, now: NOW, selectedChildId: "child-b" });
    expect(onB).toBeNull();
    expect(evaluateFollowupPrompt({ gate, active: onB, entries, now: NOW, selectedChildId: "child-a" })).toBe(forA);
  });

  it("같은 아이에서 다시 판정(포그라운드 복귀)하면 한 번만 묻는다", () => {
    const gate = createPurchaseFollowupSessionGate();
    const entries = [forA];

    const first = evaluateFollowupPrompt({ gate, active: null, entries, now: NOW, selectedChildId: "child-a" });
    expect(first).toBe(forA);
    // 카드가 떠 있는 채로 다시 돌아도 그대로다(슬롯을 돌려주지 않는다).
    expect(evaluateFollowupPrompt({ gate, active: first, entries, now: NOW, selectedChildId: "child-a" })).toBe(forA);

    // 답을 하면(스토어가 pending을 벗어난다) 슬롯이 잡힌 채로 남아 다시 묻지 않는다.
    const answered = [{ ...forA, status: "done" as const }];
    expect(
      evaluateFollowupPrompt({ gate, active: null, entries: answered, now: NOW, selectedChildId: "child-a" })
    ).toBeNull();
    // 같은 클릭이 pending으로 되돌아오는 경로는 없지만, 있더라도 세션 예산은 그대로 1회다.
    expect(
      evaluateFollowupPrompt({ gate, active: null, entries, now: NOW, selectedChildId: "child-a" })
    ).toBeNull();
  });

  it("아이를 아직 고르지 않았으면 아무것도 묻지 않는다 (보수적 기본값)", () => {
    const gate = createPurchaseFollowupSessionGate();
    expect(
      evaluateFollowupPrompt({ gate, active: null, entries: [forA], now: NOW, selectedChildId: null })
    ).toBeNull();
    expect(gate.hasSlot(forA)).toBe(false);
  });
});
