import { useEffect, useState } from "react";
import { AppState, Text, View } from "react-native";
import { router } from "expo-router";
import { useSessionStore } from "../stores/session.store";
import { Card, PrimaryButton, SecondaryButton, TextButton } from "../ui";
import { theme } from "../theme";
import {
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
      const candidate = selectPromptEligibleFollowup(usePurchaseFollowupStore.getState().entries, Date.now());
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
  }, [hasSession]);

  if (!hasSession || !activeFollowup) return null;

  const closeWith = (action: (itemTemplateId: string) => void) => {
    action(activeFollowup.itemTemplateId);
    setActiveFollowup(null);
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
            // Same route params as the item-detail "지출도 기록하기" action, so
            // app/expenses/new.tsx prefills the item name and records the expense with
            // linkedItemTemplateId (analytics source becomes "followup"). Not edited here.
            const { itemName, itemTemplateId } = activeFollowup;
            closeWith(completeFollowup);
            router.push({ pathname: "/expenses/new", params: { itemName, itemTemplateId } });
          }}
        />
        <View style={{ flexDirection: "row", gap: 10 }}>
          <SecondaryButton label="아직이요" onPress={() => closeWith(snoozeFollowup)} style={{ flex: 1 }} />
          <TextButton label="괜찮아요" onPress={() => closeWith(dismissFollowup)} style={{ flex: 1 }} />
        </View>
      </Card>
    </View>
  );
}
