import { describe, expect, it } from "vitest";
import {
  createPurchaseFollowupSessionGate,
  evaluateFollowupPrompt,
  followupSessionKey,
  PURCHASE_FOLLOWUP_MAX_SESSION_PROMPTS
} from "./purchase-followup-session";
import {
  applySnooze,
  PURCHASE_FOLLOWUP_MAX_PROMPTS,
  type PurchaseFollowupEntry
} from "./purchase-followup.store";

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

/**
 * 라운드 40 J-8 — 슬롯 반환에 상한이 없어서, 답하지 않은 카드 하나가 아이를 오갈 때마다
 * 무한히 다시 떴다. 그리고 그 왕복이 스토어의 "아직이요" 예산까지 갉아먹으면 대기 항목이
 * 조기에 expired로 굳는다. 두 예산은 서로 다른 축이어야 한다.
 */
describe("라운드 40 J-8 왕복 재표출 상한", () => {
  it("가려짐 뒤 재표출은 클릭당 세션 내 1회까지다", () => {
    const gate = createPurchaseFollowupSessionGate();
    const entries = [forA];

    // 1) A에서 최초 표출.
    let active = evaluateFollowupPrompt({ gate, active: null, entries, now: NOW, selectedChildId: "child-a" });
    expect(active).toBe(forA);
    expect(gate.promptedCount(forA)).toBe(1);

    // 2) B로 갔다가 A로 복귀 -> 재표출 1회(라운드 39 I-3이 지키는 동작).
    active = evaluateFollowupPrompt({ gate, active, entries, now: NOW, selectedChildId: "child-b" });
    expect(active).toBeNull();
    active = evaluateFollowupPrompt({ gate, active, entries, now: NOW, selectedChildId: "child-a" });
    expect(active).toBe(forA);
    expect(gate.promptedCount(forA)).toBe(PURCHASE_FOLLOWUP_MAX_SESSION_PROMPTS);

    // 3) 또 왕복 -- 이제는 다시 뜨지 않는다(답하지 않는다는 것은 지금 묻지 말라는 신호다).
    active = evaluateFollowupPrompt({ gate, active, entries, now: NOW, selectedChildId: "child-b" });
    expect(active).toBeNull();
    active = evaluateFollowupPrompt({ gate, active, entries, now: NOW, selectedChildId: "child-a" });
    expect(active).toBeNull();
    // 네 번, 다섯 번을 더 오가도 마찬가지다.
    for (let round = 0; round < 3; round += 1) {
      active = evaluateFollowupPrompt({ gate, active, entries, now: NOW, selectedChildId: "child-b" });
      active = evaluateFollowupPrompt({ gate, active, entries, now: NOW, selectedChildId: "child-a" });
      expect(active).toBeNull();
    }
    expect(gate.promptedCount(forA)).toBe(PURCHASE_FOLLOWUP_MAX_SESSION_PROMPTS);

    // 스토어는 손대지 않았다 -- 대기 항목은 여전히 pending이고 예산도 그대로다.
    expect(forA.status).toBe("pending");
    expect(forA.promptCount).toBe(0);
  });

  it("상한은 항목별이다 -- 한 항목이 다 썼다고 다른 항목이 막히지 않는다", () => {
    const gate = createPurchaseFollowupSessionGate();
    const entries = [forA, forB];

    let active = evaluateFollowupPrompt({ gate, active: null, entries, now: NOW, selectedChildId: "child-a" });
    active = evaluateFollowupPrompt({ gate, active, entries, now: NOW, selectedChildId: "child-b" });
    expect(active).toBe(forB);
    active = evaluateFollowupPrompt({ gate, active, entries, now: NOW, selectedChildId: "child-a" });
    expect(active).toBe(forA);
    // A는 예산을 다 썼지만 B는 아직 한 번 남아 있다.
    active = evaluateFollowupPrompt({ gate, active, entries, now: NOW, selectedChildId: "child-b" });
    expect(active).toBe(forB);
    expect(gate.promptedCount(forA)).toBe(2);
    expect(gate.promptedCount(forB)).toBe(2);
  });

  it("가려짐은 '아직이요' 예산(promptCount)을 쓰지 않는다 -- 조기 만료 없음", () => {
    const gate = createPurchaseFollowupSessionGate();
    let entries = [forA];

    // 표출 -> 아이 전환으로 가려짐 -> 복귀 재표출: 여기까지 답변은 0회다.
    let active = evaluateFollowupPrompt({ gate, active: null, entries, now: NOW, selectedChildId: "child-a" });
    active = evaluateFollowupPrompt({ gate, active, entries, now: NOW, selectedChildId: "child-b" });
    active = evaluateFollowupPrompt({ gate, active, entries, now: NOW, selectedChildId: "child-a" });
    expect(active).toBe(forA);
    expect(entries[0].promptCount).toBe(0);

    // 이제 "아직이요" 한 번 -- 예산이 1 줄지만 아직 만료가 아니다.
    entries = applySnooze(entries, forA.itemTemplateId);
    expect(entries[0].promptCount).toBe(1);
    expect(entries[0].status).toBe("pending");
    expect(PURCHASE_FOLLOWUP_MAX_PROMPTS).toBe(2);

    // 답을 받은 항목은 이번 세션에 다시 뜨지 않는다(슬롯이 잡힌 채 남는다).
    expect(
      evaluateFollowupPrompt({ gate, active: null, entries, now: NOW, selectedChildId: "child-a" })
    ).toBeNull();
    // 다음 앱 세션(새 게이트)에서 다시 물을 수 있고, 그때의 "아직이요"가 두 번째다.
    const nextSession = createPurchaseFollowupSessionGate();
    expect(
      evaluateFollowupPrompt({ gate: nextSession, active: null, entries, now: NOW, selectedChildId: "child-a" })
    ).toBe(entries[0]);
    expect(applySnooze(entries, forA.itemTemplateId)[0].status).toBe("expired");
  });
});
