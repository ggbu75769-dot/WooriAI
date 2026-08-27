import { useEffect, useState } from "react";
import { AppState, Platform, Text, View } from "react-native";
import { router } from "expo-router";
import { trackAndFlushAnalyticsEvent } from "../analytics/client";
import { buildPurchaseFollowupAnsweredPayload, type PurchaseFollowupAnswer } from "../analytics/events";
import { LOCAL_SESSION_TOKEN } from "../api/client";
import { useExpenseEntryGate } from "../family/useExpenseEntryGate";
import { useSelectedChildStore } from "../stores/selected-child.store";
import { useSessionStore } from "../stores/session.store";
import { announceForA11y, Card, PrimaryButton, SecondaryButton, TextButton } from "../ui";
import { theme } from "../theme";
import {
  isFollowupForSelectedChild,
  selectPromptEligibleFollowup,
  usePurchaseFollowupStore,
  type PurchaseFollowupEntry
} from "./purchase-followup.store";

/**
 * COM-108 구매 확인 루프: mounted once at the app root (app/_layout.tsx, right after <Stack> so
 * it overlays every screen -- same lifetime pattern as OfflineSyncLifecycle). On cold start
 * (post-rehydration) and on every foreground return (AppState 'active') it checks the persisted
 * purchase-followup store for a pending product-link click that is 3min–24h old and, at most
 * once per app session per click, shows a non-blocking bottom card asking 구매하셨나요?.
 *
 * Never blocks navigation: the overlay wrapper uses pointerEvents="box-none" so only the card
 * itself is touchable, and the component renders null (and attaches no listeners) whenever
 * there is no real/demo session -- preview & logged-out states stay completely inert.
 *
 * 라운드 39 UX-O(아이 스코프): 이 카드는 전역 오버레이라 **아이를 전환해도 그대로 떠 있었다**.
 * 그 상태에서 "샀어요"를 누르면 A의 클릭이 B의 지출로 기록되고 B의 준비템까지 준비 완료가
 * 된다(R19-B). 이제 후보 판정(selectPromptEligibleFollowup)과 렌더 둘 다 지금 선택된 아이를
 * 함께 본다 -- 판정 규칙과 그 근거는 purchase-followup.store.ts의 isFollowupForSelectedChild에.
 */

/** Clicks already prompted in this app session (module-level on purpose: survives remounts of
 * the lifecycle component but resets on every cold start, which is exactly the "not yet
 * prompted this session" gate). Keyed by click identity, so a fresh re-click may prompt again. */
const promptedThisSession = new Set<string>();

function sessionPromptKey(entry: PurchaseFollowupEntry): string {
  return `${entry.itemTemplateId}:${entry.clickedAt}`;
}

const purchaseFollowupOverlayStyle = {
  bottom: 28,
  left: 16,
  position: "absolute",
  right: 16,
  zIndex: 30
} as const;

export function PurchaseFollowupLifecycle() {
  const accessToken = useSessionStore((state) => state.accessToken);
  const isTestSession = useSessionStore((state) => state.isTestSession);
  // Demo/test sessions count too: this is a pure client feature (see the store's doc comment).
  const hasSession = Boolean(accessToken) || isTestSession;
  // UX-R(M): "샀어요"는 지출 생성 화면으로 가는 입구다. 보기 전용 참여자에게는 그 저장이
  // 403으로 막히므로 같은 판정으로 안내한다. 훅이라 아래 조기 반환들보다 위에 있어야 한다.
  const expenseGate = useExpenseEntryGate();
  /**
   * 라운드 27 L-2: 이벤트 발사에 쓰는 토큰은 화면들과 **같은 관례**로 고른다
   * (app/items/[itemTemplateId].tsx, app/(tabs)/records.tsx의 `authToken`).
   *
   * 예전에는 `accessToken`을 그대로 넘겨서, 데모 세션(accessToken=null·isTestSession)에서 누른
   * 답변이 큐에만 쌓였다가 **나중에 실계정으로 로그인한 순간 실토큰으로 전송**될 수 있었다
   * (src/analytics/client.ts의 flushAnalyticsQueue는 큐를 세션별로 나누지 않는다). 데모 세션은
   * 데모 토큰으로 곧바로 flush를 시도하고 실패하면 그 자리에서 버려지는 편이 맞다 --
   * 데모에서 누른 답변이 실계정 통계에 섞이는 것이 훨씬 나쁘다.
   */
  const authToken = accessToken ?? (isTestSession ? LOCAL_SESSION_TOKEN : null);
  /**
   * 지금 선택된 아이. 값이 바뀌면 아래 effect가 다시 돌아 **그 아이의 대기 항목**을 새로
   * 판정한다 -- 아이 전환은 앱 안에서 일어나므로 AppState "active"가 뜨지 않아 이 구독이
   * 없으면 아이로 돌아와도 다음 포그라운드 복귀까지 카드가 나타나지 않는다.
   */
  const selectedChildId = useSelectedChildStore((state) => state.selectedChildId);
  const snoozeFollowup = usePurchaseFollowupStore((state) => state.snoozeFollowup);
  const completeFollowup = usePurchaseFollowupStore((state) => state.completeFollowup);
  const dismissFollowup = usePurchaseFollowupStore((state) => state.dismissFollowup);
  const [activeFollowup, setActiveFollowup] = useState<PurchaseFollowupEntry | null>(null);

  useEffect(() => {
    if (!hasSession) {
      setActiveFollowup(null);
      return;
    }
    const check = () => {
      const candidate = selectPromptEligibleFollowup(
        usePurchaseFollowupStore.getState().entries,
        Date.now(),
        selectedChildId
      );
      if (!candidate || promptedThisSession.has(sessionPromptKey(candidate))) return;
      promptedThisSession.add(sessionPromptKey(candidate));
      setActiveFollowup(candidate);
    };
    // Cold start: only check once the persisted entries have actually rehydrated -- checking the
    // (still-empty) initial state would silently miss the stored click.
    if (usePurchaseFollowupStore.persist.hasHydrated()) check();
    const unsubscribeHydration = usePurchaseFollowupStore.persist.onFinishHydration(() => check());
    const subscription = AppState.addEventListener("change", (status) => {
      if (status === "active") check();
    });
    return () => {
      unsubscribeHydration();
      subscription.remove();
    };
  }, [hasSession, selectedChildId]);

  // A11Y-115: the card overlays the bottom of whatever screen the user is on, so a screen-reader
  // user gets an audible cue when it appears instead of discovering it by chance.
  useEffect(() => {
    if (activeFollowup) announceForA11y(`『${activeFollowup.itemName}』 구매하셨나요?`);
  }, [activeFollowup]);

  if (!hasSession || !activeFollowup) return null;
  /**
   * 렌더 시점의 아이 게이트(라운드 39 UX-O). 후보 판정에서 이미 걸렀지만, 카드가 떠 있는 동안
   * 설정에서 아이를 바꾸면 화면에 남은 카드가 다른 아이의 것이 된다 -- 그 한 프레임에 "샀어요"를
   * 누르면 바로 오기록이므로 그리지 않는다. 상태(activeFollowup)는 일부러 그대로 둔다:
   * 그 아이로 돌아오면 같은 카드가 다시 보이고, 스토어의 대기 항목도 여전히 pending이다.
   */
  if (!isFollowupForSelectedChild(activeFollowup, selectedChildId)) return null;

  const closeWith = (action: (itemTemplateId: string) => void) => {
    action(activeFollowup.itemTemplateId);
    setActiveFollowup(null);
  };

  /**
   * ANA-127: purchase_followup_answered -- the last funnel stage, and until now the only step of
   * the purchase loop with no instrumentation at all, which is what made 링크 클릭 -> 구매 전환율
   * uncomputable. All three answers fire (an "아직이요"/"괜찮아요" is a real answer, and dropping
   * them would silently inflate the purchase rate). Payload is the answer enum plus the clicked
   * link's platform -- never the item name, price band or child id. A no-op without ANA-102
   * consent (src/analytics/flag.ts), same gate every other event goes through.
   */
  const trackAnswer = (answer: PurchaseFollowupAnswer) => {
    trackAndFlushAnalyticsEvent(authToken, {
      eventName: "purchase_followup_answered",
      payload: buildPurchaseFollowupAnsweredPayload({ answer, platform: activeFollowup.platform }),
      platform: Platform.OS === "ios" || Platform.OS === "android" ? Platform.OS : undefined
    });
  };

  return (
    <View pointerEvents="box-none" style={purchaseFollowupOverlayStyle}>
      <Card style={{ backgroundColor: theme.colors.mint }}>
        <Text style={{ color: theme.colors.brown, fontSize: 16, fontWeight: "800" }}>
          {`『${activeFollowup.itemName}』 구매하셨나요?`}
        </Text>
        {activeFollowup.priceBandText ? (
          <Text style={{ color: theme.colors.gray600, fontSize: 12 }}>{activeFollowup.priceBandText}</Text>
        ) : null}
        <PrimaryButton
          label="샀어요"
          onPress={() => {
            // Same route params as the item-detail "지출 기록하고 준비 완료" action, so
            // app/expenses/new.tsx prefills the item name and records the expense with
            // linkedItemTemplateId (analytics source becomes "followup"). Not edited here.
            // R19-B: 그 덕분에 이 "샀어요" 경로도 저장 시 서버가 준비템을 준비 완료로
            // 올리는 동일한 효과를 얻는다 -- 여기서 별도 상태 API를 부르지 않는다.
            // 잠긴 세션에서는 카드를 닫지도, 답변을 기록하지도 않는다 -- 아직 답하지 않은
            // 물음이라 다음에 다시 물어야 하고, "샀어요"는 여기서 실행되지 않았다.
            if (expenseGate.locked) {
              expenseGate.explain();
              return;
            }
            const { itemName, itemTemplateId } = activeFollowup;
            trackAnswer("purchased");
            closeWith(completeFollowup);
            router.push({ pathname: "/expenses/new", params: { itemName, itemTemplateId } });
          }}
        />
        <View style={{ flexDirection: "row", gap: 10 }}>
          <SecondaryButton
            label="아직이요"
            onPress={() => {
              trackAnswer("not_purchased");
              closeWith(snoozeFollowup);
            }}
            style={{ flex: 1 }}
          />
          <TextButton
            label="괜찮아요"
            onPress={() => {
              trackAnswer("dismissed");
              closeWith(dismissFollowup);
            }}
            style={{ flex: 1 }}
          />
        </View>
      </Card>
    </View>
  );
}
