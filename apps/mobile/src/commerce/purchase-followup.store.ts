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
  clickedAt: number;
};

/** Only the most recent N clicks are remembered (oldest dropped first). */
export const PURCHASE_FOLLOWUP_MAX_ENTRIES = 5;
/** A click younger than this is probably still mid-purchase -- don't nag. */
export const PURCHASE_FOLLOWUP_MIN_AGE_MS = 3 * 60 * 1000;
/** A click older than this is stale -- silently stop asking. */
export const PURCHASE_FOLLOWUP_MAX_AGE_MS = 24 * 60 * 60 * 1000;
/**
 * "아직이요" 답변 예산: 한 번 미루면 나중에 한 번 더 묻고, 두 번째 "아직이요"에서 항목이
 * 만료된다(applySnooze).
 *
 * 라운드 40 J-8 — 이름과 달리 이 값이 세는 것은 **표출 횟수가 아니라 "아직이요" 답변 횟수**다
 * (promptCount를 올리는 곳은 applySnooze 하나뿐이다). 카드가 아이 전환으로 가려졌다가 다시
 * 뜨는 것은 답이 아니므로 여기에 세지 않는다 — 세면 아이를 몇 번 오갔는지에 따라 대기 항목이
 * 조기에 expired로 굳는다. 한 앱 세션 안의 표출 상한은 다른 축이고, 그쪽은
 * src/commerce/purchase-followup-session.ts가 든다(PURCHASE_FOLLOWUP_MAX_SESSION_PROMPTS).
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

/** "아직이요": counts the prompt that was just answered; the 2nd one auto-expires the entry so
 * we never nag more than PURCHASE_FOLLOWUP_MAX_PROMPTS times per click. */
export function applySnooze(entries: PurchaseFollowupEntry[], itemTemplateId: string): PurchaseFollowupEntry[] {
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

export function applyStatus(
  entries: PurchaseFollowupEntry[],
  itemTemplateId: string,
  status: "done" | "dismissed"
): PurchaseFollowupEntry[] {
  return entries.map((entry) => (entry.itemTemplateId === itemTemplateId ? { ...entry, status } : entry));
}

export type PurchaseFollowupState = {
  entries: PurchaseFollowupEntry[];
  recordLinkClick: (click: PurchaseFollowupClick) => void;
  /** "아직이요" */
  snoozeFollowup: (itemTemplateId: string) => void;
  /** "샀어요" */
  completeFollowup: (itemTemplateId: string) => void;
  /** "괜찮아요" */
  dismissFollowup: (itemTemplateId: string) => void;
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
      entries.push(
        platformValid
          ? (candidate as PurchaseFollowupEntry)
          : ({ ...(candidate as PurchaseFollowupEntry), platform: undefined })
      );
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
      completeFollowup: (itemTemplateId) =>
        set((state) => ({ entries: applyStatus(state.entries, itemTemplateId, "done") })),
      dismissFollowup: (itemTemplateId) =>
        set((state) => ({ entries: applyStatus(state.entries, itemTemplateId, "dismissed") })),
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
