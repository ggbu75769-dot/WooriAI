import { useEffect } from "react";
import type { HomeSummary } from "../api/client";
import { usePurchaseFollowupStore } from "../commerce/purchase-followup.store";
import { evaluateHomeNotifications } from "./generators";
import { useNotificationStore } from "./notification.store";

/**
 * NOTI-102 evaluation hook: mounted in app/(tabs)/index.tsx where the home query already has
 * budget + spent + child stage, so no new data fetching is needed. Re-evaluates the pure
 * generators whenever the resolved home data changes (initial load, refetch, child switch) and
 * ingests any new candidates -- the store's dedupeKey memory makes repeated evaluation safe.
 *
 * Session-gated by the caller: `home` must only be passed for a real or demo/test session
 * (undefined otherwise), so the logged-out preview stays completely inert. Waits for the
 * persisted store to rehydrate before evaluating (same discipline as PurchaseFollowupPrompt) --
 * ingesting into the pre-hydration empty state would be clobbered by the rehydration merge.
 */
export function useHomeNotificationEvaluation(home: HomeSummary | undefined) {
  useEffect(() => {
    if (!home) return;
    const evaluate = () => {
      const store = useNotificationStore.getState();
      const candidates = evaluateHomeNotifications({
        child: { id: home.child.id, nickname: home.child.nickname, stageLabel: home.child.stageLabel },
        monthly: home.monthly,
        lastSeenStageLabel: store.lastSeenStageByChild[home.child.id] ?? null,
        // Read-only peek at the COM-108 click log -- purchase_pending candidates only.
        followupEntries: usePurchaseFollowupStore.getState().entries,
        now: Date.now()
      });
      store.ingest(candidates, Date.now());
      store.recordSeenStage(home.child.id, home.child.stageLabel);
    };
    if (useNotificationStore.persist.hasHydrated()) {
      evaluate();
      return;
    }
    const unsubscribe = useNotificationStore.persist.onFinishHydration(() => evaluate());
    return () => unsubscribe();
  }, [home]);
}
