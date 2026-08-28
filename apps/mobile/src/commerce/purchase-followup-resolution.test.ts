import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  isPurchaseFollowupHeldByAppLock,
  resolvePurchaseFollowupForExpense
} from "./purchase-followup-resolution";
import {
  PURCHASE_FOLLOWUP_MAX_AGE_MS,
  type PurchaseFollowupEntry
} from "./purchase-followup.store";
import { resolveAppLockGateStatus, type AppLockGateStatus } from "../security/app-lock";

const mobileRoot = process.cwd();
function source(relativePath: string): string {
  const filePath = join(mobileRoot, relativePath);
  expect(existsSync(filePath), `${relativePath} should exist`).toBe(true);
  return readFileSync(filePath, "utf8");
}

const NOW = 1_700_000_000_000;

function pendingEntry(overrides: Partial<PurchaseFollowupEntry> = {}): PurchaseFollowupEntry {
  return {
    itemTemplateId: "item-diaper",
    itemName: "네이처러브 기저귀 팬티형",
    childId: "child-1",
    priceBandText: "42,900원 ~ 48,900원",
    clickedAt: NOW,
    status: "pending",
    promptCount: 0,
    ...overrides
  };
}

/**
 * 라운드 60 트랙 B(GAP-060 #2) — 기록이 대기를 해소한다.
 *
 * 고치는 문제: completeFollowup을 부르는 곳이 카드의 "샀어요" 하나뿐이라, 사용자가 **실제로
 * 지출을 기록해도** 그 클릭은 pending으로 남아 다음 포그라운드 복귀에 같은 물음이 다시 떴고
 * purchase_pending 알림도 계속 새로 생겼다.
 */
describe("#2 저장된 지출이 어느 구매 확인 대기의 답인가", () => {
  it("같은 아이·같은 준비템의 pending 대기를 답으로 지목한다", () => {
    expect(
      resolvePurchaseFollowupForExpense({
        entries: [pendingEntry()],
        childId: "child-1",
        linkedItemTemplateId: "item-diaper"
      })
    ).toBe("item-diaper");
  });

  it("준비템과 이어지지 않은 기록(linkedItemTemplateId 없음)은 어느 대기의 답도 아니다", () => {
    // 이름이 같아도 마찬가지다 -- 이름 추측으로 대기를 닫으면 사용자가 답한 적 없는 물음이
    // 앱 판단으로 답해진 것으로 굳는다(허위 데이터 금지).
    for (const linkedItemTemplateId of [undefined, null, ""]) {
      expect(
        resolvePurchaseFollowupForExpense({
          entries: [pendingEntry()],
          childId: "child-1",
          linkedItemTemplateId
        })
      ).toBeNull();
    }
  });

  it("다른 아이의 대기는 해소하지 않는다 (A의 클릭이 B의 기록으로 닫히지 않는다)", () => {
    expect(
      resolvePurchaseFollowupForExpense({
        entries: [pendingEntry({ childId: "child-2" })],
        childId: "child-1",
        linkedItemTemplateId: "item-diaper"
      })
    ).toBeNull();
    // 아이를 모르면(선택 전·rehydrate 전) 아무것도 닫지 않는다 -- 카드 판정과 같은 보수적 기본값.
    expect(
      resolvePurchaseFollowupForExpense({
        entries: [pendingEntry()],
        childId: null,
        linkedItemTemplateId: "item-diaper"
      })
    ).toBeNull();
  });

  it("다른 준비템의 대기는 건드리지 않는다", () => {
    expect(
      resolvePurchaseFollowupForExpense({
        entries: [pendingEntry({ itemTemplateId: "item-bottle" })],
        childId: "child-1",
        linkedItemTemplateId: "item-diaper"
      })
    ).toBeNull();
  });

  it("이미 답이 있는 항목(done·dismissed·expired)은 되살리지 않는다", () => {
    for (const status of ["done", "dismissed", "expired"] as const) {
      expect(
        resolvePurchaseFollowupForExpense({
          entries: [pendingEntry({ status })],
          childId: "child-1",
          linkedItemTemplateId: "item-diaper"
        })
      ).toBeNull();
    }
  });

  it("나이는 보지 않는다 -- 창 밖의 오래된 클릭도 기록이 남으면 닫힌다", () => {
    // 3분~24시간 창은 "물을 만한가"의 축이지 "답이 됐는가"의 축이 아니다.
    const stale = pendingEntry({ clickedAt: NOW - PURCHASE_FOLLOWUP_MAX_AGE_MS - 1 });
    expect(
      resolvePurchaseFollowupForExpense({
        entries: [stale],
        childId: "child-1",
        linkedItemTemplateId: "item-diaper"
      })
    ).toBe("item-diaper");
  });

  it("여러 대기 중 그 준비템의 것만 고른다", () => {
    expect(
      resolvePurchaseFollowupForExpense({
        entries: [
          pendingEntry({ itemTemplateId: "item-bottle" }),
          pendingEntry({ itemTemplateId: "item-diaper" }),
          pendingEntry({ itemTemplateId: "item-wipes" })
        ],
        childId: "child-1",
        linkedItemTemplateId: "item-diaper"
      })
    ).toBe("item-diaper");
  });

  it("빈 목록에서도 안전하다", () => {
    expect(
      resolvePurchaseFollowupForExpense({ entries: [], childId: "child-1", linkedItemTemplateId: "item-diaper" })
    ).toBeNull();
  });
});

/**
 * 라운드 60 트랙 B(GAP-060 #6) — 잠금 중 낭독 보류.
 */
describe("#6 잠금 게이트가 덮고 있는 동안 카드를 보류한다", () => {
  it("오버레이가 떠 있는 세 상태에서 보류한다", () => {
    for (const status of ["loading", "locked", "recovery"] as const) {
      expect(isPurchaseFollowupHeldByAppLock(status), status).toBe(true);
    }
  });

  it("잠글 대상이 없거나 이미 푼 상태에서는 보류하지 않는다", () => {
    expect(isPurchaseFollowupHeldByAppLock("inactive")).toBe(false);
    expect(isPurchaseFollowupHeldByAppLock("unlocked")).toBe(false);
  });

  it("여집합이라, 게이트 상태가 새로 생기면 기본값이 보류다(안전한 쪽으로 틀린다)", () => {
    expect(isPurchaseFollowupHeldByAppLock("future-status" as AppLockGateStatus)).toBe(true);
  });

  it("잠금을 켜 둔 콜드 스타트·재잠금이 실제로 보류로 판정된다", () => {
    // 판정표는 저장소의 단일 소스에서 온다 -- 여기서 규칙을 다시 적지 않는다.
    const locked = resolveAppLockGateStatus({
      pixelLockMode: false,
      hasSession: true,
      recordStatus: "loaded",
      enabled: true,
      unlockedThisForeground: false
    });
    expect(isPurchaseFollowupHeldByAppLock(locked)).toBe(true);

    // 부팅 직후 아직 기록을 읽지 못한 순간(loading)도 오버레이가 떠 있는 상태다.
    const booting = resolveAppLockGateStatus({
      pixelLockMode: false,
      hasSession: true,
      recordStatus: "unknown",
      enabled: false,
      unlockedThisForeground: false
    });
    expect(isPurchaseFollowupHeldByAppLock(booting)).toBe(true);

    // PIN을 걸지 않은 대다수 사용자·픽셀락 캡처는 종전과 완전히 같다.
    const noLock = resolveAppLockGateStatus({
      pixelLockMode: false,
      hasSession: true,
      recordStatus: "loaded",
      enabled: false,
      unlockedThisForeground: false
    });
    expect(isPurchaseFollowupHeldByAppLock(noLock)).toBe(false);
  });
});

/**
 * 화면은 vitest에서 렌더할 수 없으므로(react-native import) 배선은 이 저장소의 관례대로 소스
 * 계약으로 고정한다.
 */
describe("라운드 60 트랙 B 배선 계약", () => {
  it("빠른 기록 시트의 저장 성공이 대기를 해소한다 (호출은 onSuccess 안에만 있다)", () => {
    const expenseSource = source("app/expenses/new.tsx");
    expect(expenseSource).toContain(
      'import { resolvePurchaseFollowupForExpense } from "../../src/commerce/purchase-followup-resolution";'
    );
    expect(expenseSource).toContain("const answeredFollowupItemTemplateId = resolvePurchaseFollowupForExpense({");
    expect(expenseSource).toContain("usePurchaseFollowupStore.getState().completeFollowup(answeredFollowupItemTemplateId);");
    // 저장이 확정된 뒤에만 닫는다 -- onError 쪽은 대기를 건드리지 않는다(실패한 기록은 답이 아니다).
    const successIndex = expenseSource.indexOf("onSuccess: async () => {");
    const resolveIndex = expenseSource.indexOf("const answeredFollowupItemTemplateId = resolvePurchaseFollowupForExpense({");
    const errorIndex = expenseSource.indexOf("onError: (error) => {");
    expect(successIndex).toBeGreaterThan(-1);
    expect(errorIndex).toBeGreaterThan(-1);
    expect(resolveIndex).toBeGreaterThan(successIndex);
    expect(expenseSource.slice(errorIndex, successIndex > errorIndex ? successIndex : undefined)).not.toContain(
      "completeFollowup"
    );
    // 판정 재료는 저장 payload와 같은 두 값이다(다른 아이·다른 준비템으로 새지 않는다).
    const call = expenseSource.slice(resolveIndex, expenseSource.indexOf("});", resolveIndex));
    expect(call).toContain("entries: usePurchaseFollowupStore.getState().entries");
    expect(call).toContain("childId,");
    expect(call).toContain("linkedItemTemplateId");
  });

  it('"샀어요"는 더 이상 그 자리에서 done을 확정하지 않는다 (이탈하면 대기가 남는다)', () => {
    const promptSource = source("src/commerce/PurchaseFollowupPrompt.tsx");
    // 카드는 닫히지만 스토어 상태는 그대로 pending이다 -- 저장이 확정되는 자리에서만 done이 된다.
    expect(promptSource).not.toContain("closeWith(completeFollowup)");
    expect(promptSource).not.toContain("state.completeFollowup");
    expect(promptSource).toContain("closeCard();");
    // 답의 기록(계측)은 그대로 남는다 -- 사용자는 실제로 "샀어요"라고 답했고, 그 답과
    // expense_recorded 사이의 간격이 곧 이탈률이다.
    expect(promptSource).toContain('trackAnswer("purchased");');
    // 나머지 두 답은 종전 그대로 스토어 상태를 바꾼다.
    expect(promptSource).toContain("closeWith(snoozeFollowup)");
    expect(promptSource).toContain("closeWith(dismissFollowup)");
  });

  it("카드가 잠금 게이트를 **읽기만** 하고 판정을 두 벌로 만들지 않는다", () => {
    const promptSource = source("src/commerce/PurchaseFollowupPrompt.tsx");
    expect(promptSource).toContain('import { resolveAppLockGateStatus } from "../security/app-lock";');
    expect(promptSource).toContain('import { useAppLockStore } from "../stores/app-lock.store";');
    expect(promptSource).toContain("isPurchaseFollowupHeldByAppLock(");
    // 읽기만 한다: 잠금 상태를 바꾸는 호출이 없다.
    expect(promptSource).not.toContain("lockNow(");
    expect(promptSource).not.toContain("submitPin(");
    expect(promptSource).not.toContain("useAppLockStore.setState");
    // 잠금 규칙을 커머스 쪽에 다시 적지 않는다(상태 리터럴 비교 금지).
    expect(promptSource).not.toContain('recordStatus === "');
    expect(promptSource).not.toContain('status === "locked"');
    expect(promptSource).not.toContain('status === "recovery"');
  });

  it("보류는 판정·낭독·렌더 세 곳 모두에 걸리고, 풀리면 다시 판정한다", () => {
    const promptSource = source("src/commerce/PurchaseFollowupPrompt.tsx");
    // 판정 자체를 하지 않는다 -- 세션 표출 예산(takeSlot)이 사용자가 못 본 물음으로 소진되지 않는다.
    expect(promptSource).toContain("if (appLockHeld) return;");
    // 낭독 보류(A11Y-115의 문장은 그대로다). 잠금 보류는 **기억을 지우지 않고** 건너뛴다 --
    // 풀린 뒤 같은 카드가 두 번 읽히지 않게 하는 것이 이 억제의 목적이다.
    expect(promptSource).toContain("if (appLockHeld) return;\n    const key = followupSessionKey(activeFollowup);");
    expect(promptSource).toContain("announceForA11y(`『${activeFollowup.itemName}』 구매하셨나요?`)");
    // 렌더도 물러난다.
    expect(promptSource).toContain("if (appLockHeld) return null;");
    // 잠금이 풀리면 effect가 다시 돌아 그때 판정한다.
    expect(promptSource).toContain("}, [hasSession, selectedChildId, appLockHeld]);");
    expect(promptSource).toContain("}, [activeFollowup, appLockHeld]);");
    // 같은 카드를 두 번 읽지 않는다(잠금이 걸렸다 풀리는 것만으로 새 물음처럼 들리지 않게).
    expect(promptSource).toContain("announcedKeyRef");
  });

  /**
   * 라운드 60 리뷰(P2-1) — 낭독 억제의 **범위**는 잠금 전이 하나다.
   *
   * 종전에는 키가 한 번 기억되면 앱 세션 내내 남아서, 아이 전환으로 내려갔다가 그 아이로
   * 돌아와 **다시 선** 카드도 낭독되지 않았다(라운드 39 I-3이 세션 슬롯을 돌려주며 되살린
   * 바로 그 재표출이다). 화면에 새로 뜬 물음을 스크린리더 사용자만 듣지 못하는 상태였다.
   */
  it("카드가 내려가면 낭독 기억을 지운다 — 아이 전환 재표출은 다시 읽힌다", () => {
    const promptSource = source("src/commerce/PurchaseFollowupPrompt.tsx");
    // 카드가 내려간 순간(= 다음에 다시 서면 새 물음이다) 기억을 비운다.
    expect(promptSource).toContain("if (!activeFollowup) {\n      announcedKeyRef.current = null;\n      return;\n    }");
    // 잠금 보류는 그 아래에서 **기억을 남긴 채** 건너뛴다(순서가 규칙이다).
    expect(promptSource.indexOf("announcedKeyRef.current = null;")).toBeLessThan(
      promptSource.indexOf("if (appLockHeld) return;\n    const key = followupSessionKey(activeFollowup);")
    );
    // 종전의 넓은 억제(카드가 내려가도 기억이 남던 형태)로 되돌아가지 않는다.
    expect(promptSource).not.toContain("if (!activeFollowup || appLockHeld) return;");
  });

  /**
   * 라운드 60 리뷰(P2-10) — "샀어요" 이탈 재질문에도 상한이 있다.
   *
   * 트랙 B가 done 확정을 저장 자리로 옮기면서 이탈한 항목은 pending으로 남는다. 그 재표출이
   * 아무 예산도 쓰지 않으면 24시간 창이 닫힐 때까지 되풀이된다 — 라운드 40 J-8과 같은 모양의
   * 구멍이 항목 축에 생긴 것이다.
   */
  it("'샀어요'는 답변 예산을 한 칸 쓴다 (확정은 여전히 저장 자리에서만)", () => {
    const promptSource = source("src/commerce/PurchaseFollowupPrompt.tsx");
    expect(promptSource).toContain("intendPurchaseFollowup(itemTemplateId);");
    // done 확정을 이 자리로 되돌리지 않는다(트랙 B의 계약).
    expect(promptSource).not.toContain("closeWith(completeFollowup)");
    expect(promptSource).not.toContain("state.completeFollowup");
  });
});
