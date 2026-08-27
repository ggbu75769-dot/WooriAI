import { useEffect } from "react";
import type { HomeSummary } from "../api/client";
import { usePurchaseFollowupStore } from "../commerce/purchase-followup.store";
import { evaluateHomeNotifications, type WeeklySpendSnapshot } from "./generators";
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
 *
 * UX-J `weekly`: 홈 주간 카드가 **이미 계산한** 이번 주 합계(src/home/weekly-summary.ts)를 그대로
 * 받는다. 주간 알림이 홈 카드와 같은 숫자를 말하게 하기 위한 것이고, 여기서 새로 가져오는 데이터는
 * 없다(홈이 넘겨준 값만 읽는다). 옵셔널이라 넘기지 않으면 종전 월 페이스 문구로 폴백한다. 호출부는
 * 이 값을 useMemo로 안정화해 넘겨야 한다 -- 렌더마다 새 객체면 아래 effect가 매번 다시 돈다
 * (dedupe 덕에 결과는 같지만 불필요한 작업이다).
 */
export function useHomeNotificationEvaluation(
  home: HomeSummary | undefined,
  weekly?: WeeklySpendSnapshot | null
) {
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
        now: Date.now(),
        weekly: weekly ?? null
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
  }, [home, weekly]);
}
