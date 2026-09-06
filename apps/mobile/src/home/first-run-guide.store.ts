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
 *
 * ## 라운드 101 F5 — 시기 전환 회고 카드의 닫음 목록이 같은 스토어에 얹혔다
 *
 * `dismissedStageRetrospectiveKeys`는 홈 회고 카드(src/home/stage-retrospective.ts)를 닫은
 * 전환 식별자 키(`stage_retrospective:{childId}:{전환일}`) 목록이다. 새 스토어를 세우지 않고
 * 여기 얹는 이유: 성질이 정확히 같다 — **홈 안내를 닫았다는 관찰 이력**(사용자가 적은 값이
 * 아니다)이고, 그래서 로그아웃 문구의 비계수 근거(offline/messages.ts
 * `LOGOUT_UNCOUNTED_TEARDOWN_STORES`의 useHomeFirstRunGuideStore 항목)가 그대로 이 목록에도
 * 참이다. 키가 아이별이 아니라 **전환별**인 이유는 회고 모듈 머리말의 멱등 규약 그대로다 —
 * 같은 아이라도 다음 전환의 회고는 새 사실이라 다시 서야 한다.
 */

export type HomeFirstRunGuideState = {
  /** 준비템 안내 카드를 닫은 아이들. */
  dismissedItemsGuideChildIds: string[];
  /** 라운드 101 F5 — 닫은 회고 카드의 전환 식별자 키들(stage-retrospective.ts의 dismissKey). */
  dismissedStageRetrospectiveKeys: string[];
  isItemsGuideDismissed: (childId: string | null | undefined) => boolean;
  dismissItemsGuide: (childId: string | null | undefined) => void;
  dismissStageRetrospective: (dismissKey: string | null | undefined) => void;
  reset: () => void;
};

type PersistedData = Pick<HomeFirstRunGuideState, "dismissedItemsGuideChildIds" | "dismissedStageRetrospectiveKeys">;

function sanitizedStringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];
}

function sanitize(persisted: unknown): PersistedData {
  if (!persisted || typeof persisted !== "object") {
    return { dismissedItemsGuideChildIds: [], dismissedStageRetrospectiveKeys: [] };
  }
  const candidate = persisted as Partial<PersistedData>;
  return {
    dismissedItemsGuideChildIds: sanitizedStringList(candidate.dismissedItemsGuideChildIds),
    // 라운드 101 F5 이전의 blob에는 이 칸이 없다 — 빈 목록으로 읽혀 종전 동작 그대로다.
    dismissedStageRetrospectiveKeys: sanitizedStringList(candidate.dismissedStageRetrospectiveKeys)
  };
}

export const useHomeFirstRunGuideStore = create<HomeFirstRunGuideState>()(
  persist(
    (set, get) => ({
      dismissedItemsGuideChildIds: [],
      dismissedStageRetrospectiveKeys: [],
      isItemsGuideDismissed: (childId) =>
        Boolean(childId) && get().dismissedItemsGuideChildIds.includes(childId as string),
      dismissItemsGuide: (childId) =>
        set((state) => {
          if (!childId || state.dismissedItemsGuideChildIds.includes(childId)) return state;
          return { ...state, dismissedItemsGuideChildIds: [...state.dismissedItemsGuideChildIds, childId] };
        }),
      dismissStageRetrospective: (dismissKey) =>
        set((state) => {
          // 준비템 안내 닫기와 같은 멱등 규칙 — 같은 키를 두 번 닫아도 목록이 늘지 않는다.
          if (!dismissKey || state.dismissedStageRetrospectiveKeys.includes(dismissKey)) return state;
          return {
            ...state,
            dismissedStageRetrospectiveKeys: [...state.dismissedStageRetrospectiveKeys, dismissKey]
          };
        }),
      reset: () => set({ dismissedItemsGuideChildIds: [], dismissedStageRetrospectiveKeys: [] })
    }),
    {
      name: "wooriai-home-first-run-guide",
      storage: createJSONStorage(() => persistStorage),
      version: 1,
      migrate: (persisted) => sanitize(persisted),
      partialize: (state) => ({
        dismissedItemsGuideChildIds: state.dismissedItemsGuideChildIds,
        dismissedStageRetrospectiveKeys: state.dismissedStageRetrospectiveKeys
      }),
      merge: (persisted, current) => ({ ...current, ...sanitize(persisted) })
    }
  )
);
