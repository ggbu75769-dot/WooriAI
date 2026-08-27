import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { persistStorage } from "../stores/persist-storage";

/**
 * UX-G — 홈 준비템 안내 카드(`first-items`, src/home/first-run-guide.ts)의 "이미 봤다" 플래그.
 *
 * 왜 persist하는가: 이 카드는 **1회성 안내**다. 세션 상태로만 들고 있으면 앱을 켤 때마다 다시
 * 떠서 안내가 아니라 잔소리가 된다. 축하 배너(first-record-celebration.ts)와 달리 사용자가
 * 명시적으로 닫는 대상이므로, 그 의사는 기기에 남아야 한다.
 *
 * 왜 아이(childId)별인가: 둘째가 생기면 그 아이의 지금 시기 준비물은 처음 보는 목록이다.
 * 첫째에서 닫았다고 둘째의 안내까지 삼키면 안내가 닿아야 할 순간을 놓친다.
 *
 * 저장 형태는 배열(childId 목록)이다 — persist된 blob이 JSON 객체 키 순서에 의존하지 않고,
 * 예전 버전이 남긴 값이 들어와도 `sanitize`가 문자열만 걸러 낸다(onboarding-progress.store.ts의
 * MOB-107 관례).
 */

export type HomeFirstRunGuideState = {
  /** 준비템 안내 카드를 닫은 아이들. */
  dismissedItemsGuideChildIds: string[];
  isItemsGuideDismissed: (childId: string | null | undefined) => boolean;
  dismissItemsGuide: (childId: string | null | undefined) => void;
  reset: () => void;
};

type PersistedData = Pick<HomeFirstRunGuideState, "dismissedItemsGuideChildIds">;

function sanitize(persisted: unknown): PersistedData {
  if (!persisted || typeof persisted !== "object") return { dismissedItemsGuideChildIds: [] };
  const candidate = persisted as Partial<PersistedData>;
  const ids = Array.isArray(candidate.dismissedItemsGuideChildIds)
    ? candidate.dismissedItemsGuideChildIds.filter((id): id is string => typeof id === "string")
    : [];
  return { dismissedItemsGuideChildIds: ids };
}

export const useHomeFirstRunGuideStore = create<HomeFirstRunGuideState>()(
  persist(
    (set, get) => ({
      dismissedItemsGuideChildIds: [],
      isItemsGuideDismissed: (childId) =>
        Boolean(childId) && get().dismissedItemsGuideChildIds.includes(childId as string),
      dismissItemsGuide: (childId) =>
        set((state) => {
          if (!childId || state.dismissedItemsGuideChildIds.includes(childId)) return state;
          return { ...state, dismissedItemsGuideChildIds: [...state.dismissedItemsGuideChildIds, childId] };
        }),
      reset: () => set({ dismissedItemsGuideChildIds: [] })
    }),
    {
      name: "wooriai-home-first-run-guide",
      storage: createJSONStorage(() => persistStorage),
      version: 1,
      migrate: (persisted) => sanitize(persisted),
      partialize: (state) => ({ dismissedItemsGuideChildIds: state.dismissedItemsGuideChildIds }),
      merge: (persisted, current) => ({ ...current, ...sanitize(persisted) })
    }
  )
);
