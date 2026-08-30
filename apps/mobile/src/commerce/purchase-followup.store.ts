import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { persistStorage } from "../stores/persist-storage";

/**
 * COM-108 구매 확인 루프: today the commerce loop dies at "link click" -- we open the affiliate
 * link and never hear back. This store remembers each outbound product-link click as a
 * "pending purchase check" so the app can ask 『…』 구매하셨나요? on the next foreground return /
 * cold start (see PurchaseFollowupPrompt.tsx) and funnel a "샀어요" answer straight into the
 * existing quick-expense sheet (source: "followup").
 *
 * Pure client feature: nothing here talks to the server, so it works identically for a real
 * session and the demo/test session. All decision logic lives in the exported pure functions
 * below (unit-tested in purchase-followup.store.test.ts); the store actions are thin wrappers.
 */

export type PurchaseFollowupStatus = "pending" | "done" | "dismissed" | "expired";

/** Mirrors ProductLink["platform"] (src/api/client.ts) -- kept as a local literal union so this
 * store stays a plain, dependency-free module. */
export type PurchaseFollowupPlatform = "coupang" | "naver" | "custom";

export type PurchaseFollowupEntry = {
  itemTemplateId: string;
  itemName: string;
  childId: string;
  priceBandText?: string;
  /** ANA-127: the clicked link's product platform, so purchase_followup_answered can report the
   * same `platform` dimension affiliate_link_clicked does and the 링크 클릭 -> 구매 전환율이
   * 플랫폼별로 나뉜다. Optional because entries persisted by a pre-ANA-127 build have none --
   * the prompt omits the field rather than guessing one. */
  platform?: PurchaseFollowupPlatform;
  /**
   * 라운드 49 C-06(a): 눌린 제휴 링크의 id(product_links.id). "샀어요"가 그대로 지출 생성에
   * 넘겨 `linkedProductLinkId`로 저장되면, "링크 클릭 → 구매 → 기록"이 같은 링크를 가리키는
   * 하나의 사슬이 된다(지금까지는 기록 쪽에서 그 사슬이 끊겨 있었다).
   *
   * **optional인 이유**: persist v1 blob에는 이 키가 아예 없다 -- 아래 sanitizedEntries가
   * 방어적으로 걸러 undefined로 둔다(ANA-127의 platform과 같은 취급: 값 하나가 없다고 멀쩡한
   * 대기 항목을 버리지 않는다). 기록부(app/items/[itemTemplateId].tsx의
   * handleProductLinkPress)는 같은 라운드에 배선을 마쳐 이제 `productLinkId: link.id`를 실제로
   * 넘긴다 -- 즉 새로 쌓이는 대기 항목에는 값이 있고, 예전 blob에서 되살아난 항목에만 없다.
   *
   * ⚠️ DNC-009: 기록·정산용 식별자다. 추천 점수·정렬(src/items/item-ranking.ts)에 유입 금지.
   */
  productLinkId?: string;
  /** Date.now() at click time -- passed in by the caller so the pure logic stays clock-free. */
  clickedAt: number;
  status: PurchaseFollowupStatus;
  /** How many times the user answered "아직이요" to a prompt for this entry. */
  promptCount: number;
};

export type PurchaseFollowupClick = {
  itemTemplateId: string;
  itemName: string;
  childId: string;
  priceBandText?: string;
  platform?: PurchaseFollowupPlatform;
  /** 라운드 49 C-06(a): 눌린 링크의 id — 위 엔트리 필드와 같은 값·같은 optional 사유. */
  productLinkId?: string;
  clickedAt: number;
};

/**
 * 라운드 49 C-06(b): 대기 항목이 아는 플랫폼 → "샀어요"가 빠른 기록 시트에 프리필할 **판매처
 * 문구**, 또는 말할 수 있는 것이 없을 때 `undefined`.
 *
 * 사실만 말한다: 쿠팡 링크를 눌렀다는 것은 판매처가 쿠팡이라는 뜻이므로 그대로 적어 준다.
 * 반대로 `custom`(우리가 등록한 임의 링크)과 값 없음(구 blob)에서는 **상호를 모른다** --
 * 그럴듯한 이름을 지어내느니 빈 칸으로 두고 사용자가 적게 한다. 이 앱의 다른 라벨 판정과
 * 같은 규칙이다(src/expenses/expense-detail-rows.ts의 "모르면 행을 만들지 않는다").
 *
 * 프리필일 뿐이라 사용자가 지우거나 고쳐 쓸 수 있고, 저장되는 값은 사용자가 화면에서 본
 * 그 문자열이다.
 */
export const PURCHASE_FOLLOWUP_MERCHANT_LABELS: Partial<Record<PurchaseFollowupPlatform, string>> = {
  coupang: "쿠팡",
  naver: "네이버"
};

export function purchaseFollowupMerchantLabel(platform?: PurchaseFollowupPlatform | null): string | undefined {
  if (!platform) return undefined;
  return PURCHASE_FOLLOWUP_MERCHANT_LABELS[platform];
}

/** Only the most recent N clicks are remembered (oldest dropped first). */
export const PURCHASE_FOLLOWUP_MAX_ENTRIES = 5;
/** A click younger than this is probably still mid-purchase -- don't nag. */
export const PURCHASE_FOLLOWUP_MIN_AGE_MS = 3 * 60 * 1000;
/** A click older than this is stale -- silently stop asking. */
export const PURCHASE_FOLLOWUP_MAX_AGE_MS = 24 * 60 * 60 * 1000;
/**
 * **답변 예산**: 한 항목에 대해 사용자가 답을 주고도 대기가 pending으로 남는 일은 최대 이
 * 횟수까지만 일어난다. 그 상한에 닿으면 항목이 expired로 굳어 다시 묻지 않는다.
 *
 * 라운드 40 J-8 — 이 값이 세는 것은 **표출 횟수가 아니라 답변 횟수**다. 카드가 아이 전환으로
 * 가려졌다가 다시 뜨는 것은 답이 아니므로 여기에 세지 않는다 — 세면 아이를 몇 번 오갔는지에
 * 따라 대기 항목이 조기에 expired로 굳는다. 한 앱 세션 안의 표출 상한은 다른 축이고, 그쪽은
 * src/commerce/purchase-followup-session.ts가 든다(PURCHASE_FOLLOWUP_MAX_SESSION_PROMPTS).
 *
 * 라운드 60 리뷰(P2-10) — 예산을 쓰는 답이 **둘**로 늘었다.
 *  1. "아직이요"(applySnooze) — 종전 그대로.
 *  2. "샀어요"를 누르고 기록 시트를 그냥 닫은 경우(applyPurchaseIntent). 라운드 60 트랙 B가
 *     done 확정을 저장 자리로 옮기면서(PurchaseFollowupPrompt.tsx), 이탈한 항목은 pending으로
 *     남아 **다음 앱 세션에 같은 물음이 다시 뜬다**. 그 재질문이 아무 예산도 쓰지 않으면 24시간
 *     창이 닫힐 때까지 몇 번이고 되풀이된다 — "한 클릭당 한 세션에 한 번"이라는 이 기능의
 *     약속이 세션 축에서만 지켜지고 항목 축에서는 무한이 되는, 라운드 40 J-8과 같은 모양의
 *     구멍이다. 저장이 실제로 확정되면 항목은 done이 되므로(resolvePurchaseFollowupForExpense)
 *     이 예산은 **이탈한 경우에만** 소진된다.
 *
 * 그래서 상한은 이렇게 읽는다: 한 클릭에 대해 사용자가 답을 주고도 기록이 남지 않는 일은
 * 최대 두 번까지 봐 주고, 세 번째는 없다.
 */
export const PURCHASE_FOLLOWUP_MAX_PROMPTS = 2;

/**
 * Records a click: keeps only the most recent click per itemTemplateId (a re-click replaces the
 * old entry entirely, resetting status/promptCount) and caps the whole list at
 * PURCHASE_FOLLOWUP_MAX_ENTRIES, dropping the oldest clicks first.
 */
export function applyPurchaseLinkClick(
  entries: PurchaseFollowupEntry[],
  click: PurchaseFollowupClick
): PurchaseFollowupEntry[] {
  const next = entries.filter((entry) => entry.itemTemplateId !== click.itemTemplateId);
  next.push({ ...click, status: "pending", promptCount: 0 });
  next.sort((a, b) => a.clickedAt - b.clickedAt);
  return next.slice(-PURCHASE_FOLLOWUP_MAX_ENTRIES);
}

/** An entry may be shown as a prompt: still pending, inside the 3min–24h window, under the
 * "아직이요" budget. (앱 세션 단위 게이트·표출 상한은 src/commerce/purchase-followup-session.ts에
 * 있다 -- 런타임 상태라 저장하지 않는다.)
 *
 * 시간·상태 게이트만 본다. "지금 선택된 아이의 클릭인가"는 별도 게이트로,
 * isFollowupForSelectedChild가 판정하고 selectPromptEligibleFollowup이 둘을 함께 적용한다. */
export function isPromptEligible(entry: PurchaseFollowupEntry, now: number): boolean {
  if (entry.status !== "pending") return false;
  if (entry.promptCount >= PURCHASE_FOLLOWUP_MAX_PROMPTS) return false;
  const age = now - entry.clickedAt;
  return age >= PURCHASE_FOLLOWUP_MIN_AGE_MS && age <= PURCHASE_FOLLOWUP_MAX_AGE_MS;
}

/**
 * 라운드 39 UX-O: 이 대기 항목이 **지금 선택돼 있는 아이의 것인가**.
 *
 * 클릭은 처음부터 childId와 함께 기록되는데(recordLinkClick), 노출 판정은 그것을 보지 않았다.
 * 카드가 app/_layout.tsx에 걸린 전역 오버레이라, A의 링크를 누르고 설정에서 B로 전환한 뒤에도
 * 같은 카드가 그대로 떠 있었고 "샀어요"를 누르면 **B의 지출**로 기록되며 서버는 그 지출에 딸린
 * B의 준비템까지 준비 완료로 바꾼다(R19-B). 즉 A에서 한 행동이 B의 데이터를 바꾼다 --
 * 형제 기능인 준비템 → 지출 프롬프트가 scope.childId로 이미 막아 둔 것과 같은 사고다
 * (src/items/expense-link-prompt.ts의 ExpenseLinkPromptScope 주석 참고). 같은 원칙을 적용한다.
 *
 * 보수적으로 판정하는 두 경우 -- 둘 다 "잘못된 아이에게 기록될 수 있으면 묻지 않는다":
 * - `selectedChildId`가 null: 아직 아이를 고르지 않았거나 selected-child 스토어가 rehydrate
 *   되기 전이다. 이때 "샀어요"가 어느 아이로 갈지 알 수 없으므로 띄우지 않는다. 스토어가
 *   복구되면 lifecycle이 다시 판정하므로 대기 항목은 그대로 살아 있다.
 * - 항목에 childId가 없다(레거시): 지금 persist 계약에서는 사실상 오지 않는 경우다 --
 *   sanitizedEntries가 `typeof entry.childId === "string"`을 요구해서 childId 없는 옛 blob은
 *   rehydrate 단계에서 이미 걸러진다. 그래도 방어적으로 미노출을 택한다. 마이그레이션(예: 지금
 *   선택된 아이로 소급 배정)은 하지 않는다 -- 어느 아이의 클릭인지 모르는 항목을 지금 아이의
 *   것으로 단정하면 이 과제가 막으려는 바로 그 오기록을 우리 손으로 만드는 셈이고, 대기 항목은
 *   최대 24시간이면 스스로 만료된다(PURCHASE_FOLLOWUP_MAX_AGE_MS).
 */
export function isFollowupForSelectedChild(
  entry: PurchaseFollowupEntry,
  selectedChildId: string | null
): boolean {
  if (!selectedChildId) return false;
  if (!entry.childId) return false;
  return entry.childId === selectedChildId;
}

/**
 * The single entry to prompt for right now (most recent eligible click **for the currently
 * selected child**), or null.
 *
 * selectedChildId는 선택 인자가 아니라 필수다 -- 빠뜨리면 아이를 안 보던 예전 동작으로 조용히
 * 되돌아가므로, 호출부가 항상 "지금 어느 아이인가"를 함께 넘기도록 타입으로 강제한다.
 * 다른 아이의 항목은 여기서 걸러질 뿐 상태는 그대로 pending이다 -- 그 아이로 돌아오면 자격
 * 시간(3분~24시간) 안인 한 다시 후보가 된다.
 */
export function selectPromptEligibleFollowup(
  entries: PurchaseFollowupEntry[],
  now: number,
  selectedChildId: string | null
): PurchaseFollowupEntry | null {
  let best: PurchaseFollowupEntry | null = null;
  for (const entry of entries) {
    if (!isPromptEligible(entry, now)) continue;
    if (!isFollowupForSelectedChild(entry, selectedChildId)) continue;
    if (!best || entry.clickedAt >= best.clickedAt) best = entry;
  }
  return best;
}

/**
 * 라운드 81 트랙 B — **자격 창이 열리기까지 남은 시간**(밀리초), 없으면 null.
 *
 * 왜 필요한가: 자격은 시간 두 개(`PURCHASE_FOLLOWUP_MIN_AGE_MS`·`PURCHASE_FOLLOWUP_MAX_AGE_MS`)로
 * 정의되는데, 그 시간이 지나는 것을 보고 있는 자리가 없었다. 판정(`isPromptEligible`)은 콜드
 * 스타트·포그라운드 복귀·아이 전환에만 돌기 때문에, 링크를 누르고 **3분 안에 앱으로 돌아온**
 * 사용자에게는 그 세션 내내 카드가 오지 않았다 — 90초 뒤 복귀하면 "아직 3분 전"으로 떨어지고,
 * 그 뒤 앱 안에서 20분을 써도 `"active"`는 다시 오지 않는다. MIN_AGE가 존재하는 이유
 * (*"아직 구매 중일 수 있다"*)는 사용자가 앱으로 돌아온 순간 이미 소멸했는데, 판정이 그것을
 * 알 방법이 없었다.
 *
 * 이 함수는 **판정을 한 글자도 바꾸지 않는다** — "언제 다시 물어볼까"만 답한다. 답을 받은
 * 호출부(PurchaseFollowupPrompt.tsx)는 그 시각에 같은 판정을 한 번 더 세울 뿐이고, 실제로
 * 카드가 뜰지는 여전히 세션 슬롯(purchase-followup-session.ts)·아이 게이트·앱 잠금 보류가
 * 정한다.
 *
 * 세는 대상은 **지금 선택된 아이의 pending 항목 중 아직 창에 들지 않은 것**뿐이다.
 *  - 이미 자격을 갖춘 항목: 남은 시간이 0 이하라 세지 않는다(지금 판정이 이미 본다).
 *  - 24시간을 넘긴 항목: 마찬가지로 0 이하다 — 기다려도 자격은 다시 생기지 않는다.
 *  - 답변 예산을 다 쓴 항목(`promptCount >= MAX_PROMPTS`)·pending이 아닌 항목·다른 아이의
 *    항목: 그 시각에 깨워도 후보가 될 수 없으므로 세지 않는다(헛도는 깨움 0건).
 *
 * ⚠️ **상한이 자기 안에 있다**: 답은 언제나 `PURCHASE_FOLLOWUP_MIN_AGE_MS` 이하다. 기기 시계가
 * 뒤로 가거나 클릭 시각이 미래인 blob(clickedAt > now)이라도 그 상한으로 잘라, 호출부가 몇
 * 시간짜리 타이머를 걸고 앉아 있는 일이 없다.
 */
export function nextPromptEligibleDelayMs(
  entries: PurchaseFollowupEntry[],
  now: number,
  selectedChildId: string | null
): number | null {
  let best: number | null = null;
  for (const entry of entries) {
    if (entry.status !== "pending") continue;
    if (entry.promptCount >= PURCHASE_FOLLOWUP_MAX_PROMPTS) continue;
    if (!isFollowupForSelectedChild(entry, selectedChildId)) continue;
    // 남은 시간이 0 이하면 기다릴 것이 없다 -- 이미 창 안이거나(지금 판정이 본다) 창을 지났다.
    const remaining = entry.clickedAt + PURCHASE_FOLLOWUP_MIN_AGE_MS - now;
    if (remaining <= 0) continue;
    const capped = Math.min(remaining, PURCHASE_FOLLOWUP_MIN_AGE_MS);
    if (best === null || capped < best) best = capped;
  }
  return best;
}

export type PurchaseFollowupEligibilityTimer = {
  /**
   * 지금 상태로 **다음 자격 도래 시각에 한 번** 깨우도록 다시 건다. 걸려 있던 타이머는 반드시
   * 먼저 해제하므로 동시에 살아 있는 타이머는 언제나 최대 하나다. 깨울 이유가 없으면
   * (술어가 null) 아무것도 걸지 않는다.
   */
  schedule: (entries: PurchaseFollowupEntry[], now: number, selectedChildId: string | null) => void;
  /** 걸린 타이머를 해제한다(언마운트·의존성 변화의 cleanup). */
  clear: () => void;
  /** 지금 타이머가 걸려 있는가(테스트·디버깅용 조회). */
  isArmed: () => boolean;
};

/**
 * 라운드 81 트랙 B — 위 술어를 실제 시계에 꽂는 **일회용 타이머 하나**.
 *
 * 화면(PurchaseFollowupPrompt.tsx)은 판정을 effect 안에서 돌리는데, 그 effect가 다시 도는
 * 계기는 하이드레이션·`AppState "active"`·의존성 셋뿐이다. 그래서 "그때 다시 물어본다"를
 * 맡을 자리가 필요하고, 그 자리는 **화면이 아니라 여기**다 — 화면은 vitest에서 렌더할 수
 * 없어서(react-native import) 타이머가 화면 안에 있으면 "제때 깨우는가·중복으로 걸지 않는가·
 * cleanup에서 풀리는가"를 단위로 물을 방법이 없다. 세션 게이트를 순수 모듈로 떼어 낸
 * 라운드 39 I-3과 같은 이유·같은 모양(팩토리 하나 · 실행 상태는 클로저)이다.
 *
 * 규칙 판정은 한 줄도 여기에 없다 — 언제 깨울지는 `nextPromptEligibleDelayMs`가, 깨운 뒤
 * 무엇을 띄울지는 `evaluateFollowupPrompt`가 정한다. 이 팩토리가 아는 것은 setTimeout 하나뿐이다.
 */
export function createPurchaseFollowupEligibilityTimer(onDue: () => void): PurchaseFollowupEligibilityTimer {
  let handle: ReturnType<typeof setTimeout> | null = null;
  const clear = () => {
    if (handle === null) return;
    clearTimeout(handle);
    handle = null;
  };
  return {
    schedule: (entries, now, selectedChildId) => {
      // 다시 걸기 전에 반드시 해제한다: 포그라운드 복귀·아이 전환처럼 판정이 여러 번 도는
      // 경로에서 타이머가 겹쳐 쌓이면 같은 시각에 판정이 여러 번 돈다(중복 발화).
      clear();
      const delay = nextPromptEligibleDelayMs(entries, now, selectedChildId);
      if (delay === null) return;
      handle = setTimeout(() => {
        // 일회용이다 -- 발화한 타이머는 스스로 표시를 내리고, 다음 타이머는 그 판정이 다시 건다.
        handle = null;
        onDue();
      }, delay);
    },
    clear,
    isArmed: () => handle !== null
  };
}

/**
 * 답변 예산을 한 칸 쓴다: 그 답이 상한에 닿으면 항목은 expired로 굳어 다시 묻지 않는다.
 * pending이 아닌 항목은 이미 답이 끝난 것이라 건드리지 않는다.
 *
 * 라운드 60 리뷰(P2-10): 이 본체를 부르는 곳이 둘이다(아래 두 함수) -- 규칙을 두 벌로 적으면
 * 한쪽 상한만 고쳐지는 날 "샀어요 이탈"이 다시 무한 재질문이 된다.
 */
function consumePromptBudget(entries: PurchaseFollowupEntry[], itemTemplateId: string): PurchaseFollowupEntry[] {
  return entries.map((entry) => {
    if (entry.itemTemplateId !== itemTemplateId || entry.status !== "pending") return entry;
    const promptCount = entry.promptCount + 1;
    return {
      ...entry,
      promptCount,
      status: promptCount >= PURCHASE_FOLLOWUP_MAX_PROMPTS ? "expired" : "pending"
    };
  });
}

/** "아직이요": counts the prompt that was just answered; the 2nd one auto-expires the entry so
 * we never nag more than PURCHASE_FOLLOWUP_MAX_PROMPTS times per click. */
export function applySnooze(entries: PurchaseFollowupEntry[], itemTemplateId: string): PurchaseFollowupEntry[] {
  return consumePromptBudget(entries, itemTemplateId);
}

/**
 * 라운드 60 리뷰(P2-10) — "샀어요"를 눌러 기록 시트를 연 순간.
 *
 * 항목은 여기서 done이 되지 않는다(done은 저장이 확정된 자리에서만 붙는다 — 라운드 60 트랙 B).
 * 사용자가 시트를 그냥 닫으면 항목은 pending으로 남아 다음 앱 세션에 다시 물어야 하는데, 그
 * 재질문이 예산을 쓰지 않으면 24시간 창이 닫힐 때까지 끝없이 되풀이된다. 그래서 **답을 준
 * 순간** 한 칸을 쓴다 -- "아직이요"와 같은 축이다(둘 다 답이고, 둘 다 기록을 남기지 않았다).
 *
 * 저장이 실제로 확정되면 `resolvePurchaseFollowupForExpense` → `completeFollowup`이 상태를
 * done으로 덮으므로(applyStatus는 상태를 가리지 않는다) 이 소진은 이탈한 경우에만 남는다.
 */
export function applyPurchaseIntent(
  entries: PurchaseFollowupEntry[],
  itemTemplateId: string
): PurchaseFollowupEntry[] {
  return consumePromptBudget(entries, itemTemplateId);
}

export function applyStatus(
  entries: PurchaseFollowupEntry[],
  itemTemplateId: string,
  status: "done" | "dismissed"
): PurchaseFollowupEntry[] {
  return entries.map((entry) => (entry.itemTemplateId === itemTemplateId ? { ...entry, status } : entry));
}

/**
 * 라운드 62 트랙 B(#5) — **삭제된 아이 한 명분**의 대기 항목을 지운다.
 *
 * 아이 프로필 삭제의 뒤처리는 지금 쿼리 캐시 무효화뿐이라, 이 기기에는 사라진 아이의 링크 클릭이
 * 최대 24시간 동안 남는다. 그 항목이 실제로 카드를 띄우지는 않지만(`isFollowupForSelectedChild`가
 * 지금 아이의 것만 고른다 — 그 아이는 이제 선택될 수 없다), **남길 이유도 없다**: 이 blob이
 * 들고 있는 것은 삭제된 아이의 id와 그 아이를 위해 무엇을 사려 했는지(itemName)다. 아이를 지운
 * 사람에게는 그 흔적이 기기에서 사라지는 것이 약속에 맞다.
 *
 * `resetAll`(PRIV-104 세션 teardown)과 섞지 않는 **별도 액션**이다 — 그쪽은 정체성이 바뀔 때
 * 전부 지우고, 이쪽은 같은 사람이 로그인한 채 아이 하나만 지운 경우다.
 *
 * 빈 childId로는 아무것도 지우지 않는다(childId를 모르는 옛 항목까지 쓸어 버리지 않는다).
 * 바뀌는 것이 없으면 **같은 배열**을 돌려준다(이 모듈의 no-op 관례).
 */
export function clearPurchaseFollowupsForChild(
  entries: PurchaseFollowupEntry[],
  childId: string
): PurchaseFollowupEntry[] {
  const target = childId.trim();
  if (target.length === 0) return entries;
  if (!entries.some((entry) => entry.childId === target)) return entries;
  return entries.filter((entry) => entry.childId !== target);
}

export type PurchaseFollowupState = {
  entries: PurchaseFollowupEntry[];
  recordLinkClick: (click: PurchaseFollowupClick) => void;
  /** "아직이요" */
  snoozeFollowup: (itemTemplateId: string) => void;
  /**
   * 라운드 60 리뷰(P2-10) "샀어요"를 눌러 기록 시트로 간 순간 — 답변 예산 한 칸.
   * 확정(done)은 저장 자리에서 completeFollowup이 붙인다.
   */
  intendPurchaseFollowup: (itemTemplateId: string) => void;
  /** 저장이 확정된 지출이 대기의 답이었을 때(app/expenses/new.tsx의 onSuccess) */
  completeFollowup: (itemTemplateId: string) => void;
  /** "괜찮아요" */
  dismissFollowup: (itemTemplateId: string) => void;
  /**
   * 라운드 62 트랙 B(#5): **아이 하나가 삭제됐을 때** 그 아이의 대기 항목을 지운다(규칙은 위
   * `clearPurchaseFollowupsForChild` 주석). PRIV-104 teardown(`resetAll`)과는 별개 액션이다.
   */
  clearForChild: (childId: string) => void;
  /** PRIV-104 session teardown: drops every persisted entry (clicked items, child ids) so the
   * next account on this device never gets prompted about the previous account's clicks. Called
   * from src/offline/session-teardown.ts on logout / account switch / demo toggle. */
  resetAll: () => void;
};

const VALID_STATUSES: readonly PurchaseFollowupStatus[] = ["pending", "done", "dismissed", "expired"];
const VALID_PLATFORMS: readonly PurchaseFollowupPlatform[] = ["coupang", "naver", "custom"];

/** Defensive shape check for a persisted blob from an unknown/older app version (mirrors the
 * convention in src/stores/*.store.ts): anything that doesn't look like a valid entry list falls
 * back to [] instead of feeding malformed values into the prompt logic. */
function sanitizedEntries(value: unknown): PurchaseFollowupEntry[] {
  const list = value && typeof value === "object" ? (value as { entries?: unknown }).entries : undefined;
  if (!Array.isArray(list)) return [];
  const entries: PurchaseFollowupEntry[] = [];
  for (const candidate of list) {
    if (!candidate || typeof candidate !== "object") continue;
    const entry = candidate as Record<string, unknown>;
    if (
      typeof entry.itemTemplateId === "string" &&
      entry.itemTemplateId.length > 0 &&
      typeof entry.itemName === "string" &&
      typeof entry.childId === "string" &&
      (entry.priceBandText === undefined || typeof entry.priceBandText === "string") &&
      typeof entry.clickedAt === "number" &&
      Number.isFinite(entry.clickedAt) &&
      typeof entry.status === "string" &&
      (VALID_STATUSES as readonly string[]).includes(entry.status) &&
      typeof entry.promptCount === "number" &&
      Number.isFinite(entry.promptCount)
    ) {
      // ANA-127: an unknown/absent platform only costs one analytics dimension, so it is
      // stripped rather than dropping an otherwise valid pending purchase check with it.
      const platformValid =
        typeof entry.platform === "string" && (VALID_PLATFORMS as readonly string[]).includes(entry.platform);
      /**
       * 라운드 49 C-06(a): `productLinkId`는 persist v1 blob에 **없는 키**다(이 필드가 생기기
       * 전에 저장된 대기 항목). platform과 같은 취급으로, 없거나 문자열이 아니면 undefined로
       * 두고 항목 자체는 살린다 -- 이 값이 없다고 해서 "샀어요"로 지출을 남기지 못할 이유가
       * 없다(그때는 linkedProductLinkId 없이 저장될 뿐이다). version은 그대로 1이다: 저장된
       * 데이터를 고쳐 쓰는 마이그레이션이 아니라 없는 값을 없는 대로 읽는 것뿐이다.
       */
      const productLinkIdValid = typeof entry.productLinkId === "string" && entry.productLinkId.length > 0;
      entries.push({
        ...(candidate as PurchaseFollowupEntry),
        platform: platformValid ? (entry.platform as PurchaseFollowupPlatform) : undefined,
        productLinkId: productLinkIdValid ? (entry.productLinkId as string) : undefined
      });
    }
  }
  return entries.slice(-PURCHASE_FOLLOWUP_MAX_ENTRIES);
}

export const usePurchaseFollowupStore = create<PurchaseFollowupState>()(
  persist(
    (set) => ({
      entries: [],
      recordLinkClick: (click) => set((state) => ({ entries: applyPurchaseLinkClick(state.entries, click) })),
      snoozeFollowup: (itemTemplateId) => set((state) => ({ entries: applySnooze(state.entries, itemTemplateId) })),
      intendPurchaseFollowup: (itemTemplateId) =>
        set((state) => ({ entries: applyPurchaseIntent(state.entries, itemTemplateId) })),
      completeFollowup: (itemTemplateId) =>
        set((state) => ({ entries: applyStatus(state.entries, itemTemplateId, "done") })),
      dismissFollowup: (itemTemplateId) =>
        set((state) => ({ entries: applyStatus(state.entries, itemTemplateId, "dismissed") })),
      clearForChild: (childId) =>
        set((state) => {
          const entries = clearPurchaseFollowupsForChild(state.entries, childId);
          // 지울 것이 없으면 같은 상태를 유지한다(구독자가 헛돌지 않게).
          return entries === state.entries ? state : { entries };
        }),
      resetAll: () => set({ entries: [] })
    }),
    {
      name: "wooriai-purchase-followup",
      storage: createJSONStorage(() => persistStorage),
      version: 1,
      migrate: (persisted) => ({ entries: sanitizedEntries(persisted) }),
      merge: (persisted, current) => ({ ...current, entries: sanitizedEntries(persisted) })
    }
  )
);
