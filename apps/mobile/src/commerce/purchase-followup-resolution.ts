import { isFollowupForSelectedChild, type PurchaseFollowupEntry } from "./purchase-followup.store";
import type { AppLockGateStatus } from "../security/app-lock";

/**
 * 라운드 60 트랙 B(GAP-060 #2·#6) — 구매 확인 루프가 **기록과 잠금을 알게 하는** 순수 판정 두 개.
 *
 * 두 판정이 한 파일에 있는 이유: 둘 다 "지금 이 대기 항목에 무엇을 해야 하는가"를 답하는
 * 클록·리액트 없는 함수이고, 화면(app/expenses/new.tsx · PurchaseFollowupPrompt.tsx)에서는
 * 호출 두 줄로만 나타나야 하기 때문이다. 이 저장소의 화면은 vitest에서 렌더할 수 없으므로
 * (purchase-followup-session.ts 머리말 참고) 규칙은 늘 이렇게 밖으로 나온다.
 */

/**
 * ## #2 — 기록이 대기를 해소한다
 *
 * 여태 `completeFollowup`을 부르는 곳은 카드의 "샀어요" 하나뿐이었다. 그래서 사용자가 실제로
 * **지출을 기록해도** 그 클릭은 여전히 pending으로 남았고, 다음 포그라운드 복귀에 같은 물음이
 * 다시 떴다("『젖병 소독기』 구매하셨나요?" — 방금 기록한 그 물건이다). 알림 쪽도 같은 pending을
 * 읽으므로(src/notifications/generators.ts의 purchasePendingNotifications) purchase_pending
 * 알림이 계속 새로 생겼다. 답을 이미 받아 놓고 다시 묻는 셈이라, 루프의 마지막 칸이 비어 있었다.
 *
 * 이 함수는 **저장된 지출 한 건이 어느 대기 항목의 답인가**를 판정한다. 답이면 그 항목의
 * itemTemplateId를, 아니면 null을 돌려준다(호출부는 그 값으로 completeFollowup 한 번).
 *
 * ### 사실만 본다 — 이름 추측 금지
 *
 * 지출과 준비템을 잇는 **사실**은 `linkedItemTemplateId` 하나뿐이다("샀어요" 경로와 준비템
 * 상세의 "지출 기록하고 준비 완료"가 이 파라미터를 싣는다 — app/expenses/new.tsx). 품목명이
 * 비슷하다는 이유로 대기를 해소하지 않는다: 그러면 사용자가 답한 적 없는 물음이 앱 판단으로
 * 답해진 것으로 굳고(status: done), 되돌릴 화면도 없다. 정기 지출의 이름 기반 판정이 오탐을
 * 안고 가는 것과 달리(known-limitations I절), 여기서는 틀리면 **사용자의 답을 지어내는** 것이
 * 되므로 모르면 아무것도 하지 않는다.
 *
 * ### 아이 게이트는 한 벌뿐이다
 *
 * "이 대기 항목이 이 아이의 것인가"는 카드 판정이 쓰는 그 함수(isFollowupForSelectedChild)를
 * 그대로 쓴다 — 규칙(아이 모름·항목의 childId 없음이면 false)이 두 벌이 되면 한쪽만 고쳐지는
 * 날 A의 클릭이 B의 기록으로 해소된다.
 *
 * ### 나이는 보지 않는다
 *
 * 3분~24시간 창(PURCHASE_FOLLOWUP_MIN/MAX_AGE_MS)은 "**물을 만한가**"의 축이지 "답이
 * 됐는가"의 축이 아니다. 창 밖의 오래된 클릭이라도 그 준비템의 지출이 실제로 남았다면 그
 * 물음은 끝난 것이므로 done으로 닫는다(이미 조용해진 항목이라 화면·알림은 달라지지 않고,
 * 남는 차이는 그 클릭이 다시는 되살아나지 않는다는 것뿐이다).
 *
 * pending이 아닌 항목(done·dismissed·expired)은 이미 답이 있으므로 건드리지 않는다 —
 * 사용자가 "괜찮아요"로 닫아 둔 물음을 기록 한 건으로 되살리지 않는다.
 */
export type PurchaseFollowupResolutionInput = {
  entries: readonly PurchaseFollowupEntry[];
  /** 이 지출이 기록된 아이(선택된 아이). 모르면 판정하지 않는다. */
  childId: string | null | undefined;
  /** 이 지출이 잇고 있는 준비템 — 이 값이 없는 기록은 어느 대기의 답도 아니다. */
  linkedItemTemplateId: string | null | undefined;
};

export function resolvePurchaseFollowupForExpense({
  entries,
  childId,
  linkedItemTemplateId
}: PurchaseFollowupResolutionInput): string | null {
  if (!childId || !linkedItemTemplateId) return null;
  for (const entry of entries) {
    if (entry.status !== "pending") continue;
    if (entry.itemTemplateId !== linkedItemTemplateId) continue;
    if (!isFollowupForSelectedChild(entry, childId)) continue;
    return entry.itemTemplateId;
  }
  return null;
}

/**
 * ## #6 — 잠금 오버레이가 떠 있는 동안 구매 확인 카드를 **보류**한다
 *
 * 구매 확인 카드는 앱 전역 오버레이라 콜드 스타트·포그라운드 복귀에 **스스로** 뜬다. 그 두
 * 순간은 앱 잠금이 PIN을 묻는 바로 그 순간이기도 해서, 잠긴 화면 뒤에서 카드가 판정되고
 * `announceForA11y("『…』 구매하셨나요?")`가 나갔다. 오버레이는 화면을 덮고 방패
 * (AppLockScreenShield)는 접근성 트리를 가리지만, 명령형 낭독은 트리를 거치지 않으므로
 * 둘 다 통과한다 — 잠긴 폰에서 **품목명 원문**이 소리로 새어 나간 것이다
 * (known-limitations I절 4번의 반례였고, 이 라운드에서 그 문장을 정정했다).
 *
 * 여기서 판정하는 것은 "지금 잠금 게이트가 화면을 덮고 있는가" 하나다. 게이트 상태 자체는
 * **저장소의 단일 판정 함수**(src/security/app-lock.ts의 resolveAppLockGateStatus)가 내고,
 * 호출부는 그 결과를 넘기기만 한다 — 잠금 규칙을 커머스 쪽에 두 벌로 적지 않는다
 * (라운드 52 QA P3-4의 판정표 이중화 금지).
 *
 * **여집합으로 쓴 이유**: 카드를 그려도 되는 상태는 "잠글 대상이 없다(inactive)"와 "이번
 * 포그라운드에서 이미 풀었다(unlocked)" 둘뿐이고, 나머지(loading·locked·recovery)는 전부
 * 오버레이가 떠 있는 상태다. 열거하지 않고 여집합으로 두면 나중에 게이트 상태가 하나 늘어도
 * 기본값이 **보류**로 떨어진다 — 안전한 쪽으로 틀린다.
 *
 * 보류일 뿐 취소가 아니다: 스토어의 대기 항목은 그대로 pending이고, 잠금이 풀리면 호출부가
 * 다시 판정해 조건이 여전하면 그때 카드가 뜬다(세션 표출 예산도 그때 처음 쓰인다 — 잠긴 동안
 * 슬롯을 잡아 버리면 사용자가 본 적 없는 물음이 "이미 물었다"로 소진된다).
 */
export function isPurchaseFollowupHeldByAppLock(status: AppLockGateStatus): boolean {
  return status !== "inactive" && status !== "unlocked";
}
