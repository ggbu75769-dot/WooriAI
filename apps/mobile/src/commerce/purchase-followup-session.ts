import {
  isFollowupForSelectedChild,
  selectPromptEligibleFollowup,
  type PurchaseFollowupEntry
} from "./purchase-followup.store";

/**
 * COM-108의 **앱 세션 게이트**(한 클릭당 한 세션에 한 번만 묻는다) + 아이 전환 시의 판정.
 *
 * 왜 모듈로 나왔나: 판정이 PurchaseFollowupPrompt.tsx 안의 모듈 지역 `Set`과 effect에 섞여
 * 있어서, "A에서 카드를 봤다 → B로 옮겨 B의 카드를 봤다 → A로 돌아온다"는 왕복을 테스트할
 * 방법이 없었다(이 저장소의 화면은 vitest에서 렌더할 수 없다). 그리고 그 자리에 라운드 39 I-3의
 * 버그가 있었다.
 *
 * ## 라운드 39 I-3 — A로 돌아와도 카드가 세션 내내 다시 뜨지 않던 문제
 *
 * 세션 키가 아이와 무관해서(`itemTemplateId:clickedAt`), A의 카드를 띄우는 순간 그 키가 잠긴다.
 * 그 상태에서 B로 전환하면 effect가 다시 돌아 B의 후보로 카드를 **갈아치우고**, 다시 A로 돌아오면
 * A의 항목은 이미 잠긴 키라 후보 판정을 통과하고도 노출에서 걸러진다 — 스토어에서는 여전히
 * pending인데 이번 앱 세션에는 두 번 다시 보이지 않는다. PurchaseFollowupPrompt.tsx의 렌더 게이트
 * 주석이 약속한 "그 아이로 돌아오면 같은 카드가 다시 보인다"가 지켜지지 않았다.
 *
 * 고치는 방향: **답을 받지 못한 채 화면에서 내려가는 항목은 세션 슬롯을 돌려준다**(`returnSlot`).
 * 아이 전환으로 가려진 카드는 "물었지만 답이 없는" 것이 아니라 애초에 **묻지 못한** 것이므로,
 * 그 아이로 돌아왔을 때 다시 묻는 편이 맞다. 세 답변(샀어요/아직이요/괜찮아요)은 스토어 상태를
 * 바꾸므로(completed/snoozed/dismissed) 슬롯을 돌려주더라도 후보로 다시 올라오지 않는다.
 *
 * ## 라운드 40 J-8 — 그 슬롯 반환에 상한이 없었다
 *
 * 반환이 무제한이라, 답하지 않은 카드 하나로 A↔B를 오갈 때마다 같은 물음이 계속 다시 떴다
 * (전환 열 번이면 열 번). 게이트의 이름과 약속은 "한 클릭당 한 세션에 한 번"인데 실제 예산은
 * 사실상 무한이었던 셈이고, 답하지 않는다는 것 자체가 지금은 묻지 말라는 신호에 가깝다.
 * 그래서 **표출 횟수**를 세고 `PURCHASE_FOLLOWUP_MAX_SESSION_PROMPTS`(= 최초 1회 + 가려짐 뒤
 * 재표출 1회)에서 멈춘다. 한 항목은 처음부터 한 아이의 것이므로(`entry.childId`) 이 횟수는 곧
 * 아이별 표출 기록이기도 하다.
 *
 * ## 예산 두 가지를 섞지 않는다
 *
 * 여기서 세는 것은 **이번 앱 세션의 표출 횟수**이고, 스토어의 `promptCount`는 **"아직이요"를
 * 누른 횟수**다(applySnooze만 올린다 — purchase-followup.store.ts). 가려졌다가 다시 뜬 것은
 * 답이 아니므로 `promptCount`를 만들지 않는다. 둘을 섞으면 아이를 몇 번 오갔는지에 따라
 * 대기 항목이 조기에 expired로 굳는다.
 *
 * react/react-native에 의존하지 않는다(vitest 단위 테스트 대상).
 */

/**
 * 한 클릭을 **이번 앱 세션에** 화면에 띄울 수 있는 최대 횟수: 최초 1회 + 아이 전환으로 가려진
 * 뒤의 재표출 1회. 스토어의 `PURCHASE_FOLLOWUP_MAX_PROMPTS`(= "아직이요" 답변 예산)와는 다른
 * 축이다 — 위 주석 참고.
 */
export const PURCHASE_FOLLOWUP_MAX_SESSION_PROMPTS = 2;

/**
 * 한 항목의 세션 키. 같은 준비템이라도 **새 클릭**이면 다시 물을 수 있어야 하므로 클릭 시각까지
 * 넣는다. 아이는 넣지 않는다 — 한 항목은 처음부터 한 아이의 것이라(`entry.childId`) 키에 넣어도
 * 구분이 늘지 않고, 위 왕복 문제도 해결되지 않는다(잠긴 키는 여전히 같은 키다).
 */
export function followupSessionKey(entry: Pick<PurchaseFollowupEntry, "itemTemplateId" | "clickedAt">): string {
  return `${entry.itemTemplateId}:${entry.clickedAt}`;
}

export type PurchaseFollowupSessionGate = {
  /**
   * 이번 앱 세션에 아직 묻지 않았고 표출 예산이 남은 항목이면 슬롯을 잡고 true.
   * 이미 떠 있거나 예산을 다 썼으면 false.
   */
  takeSlot: (entry: PurchaseFollowupEntry) => boolean;
  /** 답을 받지 못한 채 내려가는 항목의 슬롯을 되돌려준다(다시 물을 수 있게). */
  returnSlot: (entry: PurchaseFollowupEntry) => void;
  /** 이 항목의 슬롯이 지금 잡혀 있는가(테스트·디버깅용 조회). */
  hasSlot: (entry: PurchaseFollowupEntry) => boolean;
  /** 이번 앱 세션에 이 항목을 몇 번 띄웠는가(테스트·디버깅용 조회). */
  promptedCount: (entry: PurchaseFollowupEntry) => number;
};

/**
 * 앱 세션 하나짜리 게이트. 화면 컴포넌트는 이것을 **모듈 지역**에 하나 두므로 리마운트에는
 * 살아남고 콜드 스타트에는 비워진다 — 그것이 곧 "이번 앱 세션"의 정의다.
 *
 * 슬롯 반환(`returnSlot`)은 "지금 떠 있다"는 표시만 내린다. **표출 횟수는 되돌리지 않는다** —
 * 그것이 라운드 40 J-8의 상한이 실제로 걸리는 자리다(반환이 횟수까지 지우면 왕복마다 예산이
 * 새로 생겨 종전의 무상한 재표출로 되돌아간다).
 */
export function createPurchaseFollowupSessionGate(): PurchaseFollowupSessionGate {
  const prompted = new Set<string>();
  const promptCounts = new Map<string, number>();
  const countFor = (key: string) => promptCounts.get(key) ?? 0;
  return {
    takeSlot: (entry) => {
      const key = followupSessionKey(entry);
      if (prompted.has(key)) return false;
      if (countFor(key) >= PURCHASE_FOLLOWUP_MAX_SESSION_PROMPTS) return false;
      prompted.add(key);
      promptCounts.set(key, countFor(key) + 1);
      return true;
    },
    returnSlot: (entry) => {
      prompted.delete(followupSessionKey(entry));
    },
    hasSlot: (entry) => prompted.has(followupSessionKey(entry)),
    promptedCount: (entry) => countFor(followupSessionKey(entry))
  };
}

export type FollowupPromptEvaluation = {
  gate: PurchaseFollowupSessionGate;
  /** 지금 화면에 떠 있는 카드(없으면 null). */
  active: PurchaseFollowupEntry | null;
  entries: PurchaseFollowupEntry[];
  now: number;
  selectedChildId: string | null;
};

/**
 * 한 번의 판정(콜드 스타트·포그라운드 복귀·아이 전환에서 같은 함수가 돈다) → 화면에 있어야 할
 * 카드, 또는 null(카드를 내린다).
 *
 * 순서가 규칙 그 자체다:
 *  1. 떠 있던 카드가 **지금 아이의 것이 아니면** 내리고 슬롯을 돌려준다(위 I-3). 렌더 게이트가
 *     어차피 그리지 않는 카드라 화면은 달라지지 않고, 그 아이로 돌아왔을 때 다시 물을 수 있게 된다.
 *  2. 지금 아이의 후보를 고른다(자격 3분~24시간은 스토어 selector가 판정한다).
 *  3. 이번 세션에 아직 묻지 않았고 **표출 예산이 남은** 후보만 띄운다(라운드 40 J-8 — 가려짐
 *     뒤 재표출은 클릭당 한 번까지다). 그렇지 않으면 1의 결과를 그대로 둔다.
 */
export function evaluateFollowupPrompt({
  gate,
  active,
  entries,
  now,
  selectedChildId
}: FollowupPromptEvaluation): PurchaseFollowupEntry | null {
  let current = active;
  if (current && !isFollowupForSelectedChild(current, selectedChildId)) {
    gate.returnSlot(current);
    current = null;
  }
  const candidate = selectPromptEligibleFollowup(entries, now, selectedChildId);
  if (!candidate || !gate.takeSlot(candidate)) return current;
  return candidate;
}
