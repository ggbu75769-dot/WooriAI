import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { persistStorage } from "../stores/persist-storage";

export type AnalyticsConsentState = {
  enabled: boolean;
  setEnabled: (enabled: boolean) => void;
  /**
   * 라운드 99 M-1 — PRIV-104 teardown 전용 초기화(계정 정체성 전환에만 발화).
   *
   * 이 동의는 **계정 단위 선택**인데 persist는 기기 단위라, 지우지 않으면 A의 동의가 B의
   * 세션까지 살아남는다. 실제 경로: 로그인 화면의 체크박스는 이 스토어의 현재 값을 따라
   * 미리 켜지고(app/(auth)/login.tsx의 storedAnalyticsEnabled), 손대지 않고 로그인하면
   * 그 값이 B의 세션에 그대로 커밋된다 — A가 준 동의로 B의 이벤트가 나간다.
   * teardown이 지우면 그 체크박스는 미동의 기본(OFF)으로 선다(ANA-101의 opt-in 기본).
   */
  reset: () => void;
};

/**
 * ANA-101/ANA-102 (round5a-sprint2-plan.md §5): analytics is opt-in and
 * defaults to OFF -- while this is false, nothing in ./client.ts queues or
 * sends a single event. ANA-102's consent UI is the "통계 수집 동의(선택)"
 * toggle in app/settings/index.tsx, the only place that calls
 * setEnabled(...). Persisted (like the app's other zustand stores) so the
 * user's consent choice survives app restarts.
 */
export const useAnalyticsConsentStore = create<AnalyticsConsentState>()(
  persist(
    (set) => ({
      enabled: false,
      setEnabled: (enabled) => set({ enabled }),
      // 미동의 기본값으로 되돌린다(위 헤더의 "defaults to OFF" 그대로). persist를 지나므로
      // 저장된 값도 함께 false가 된다 — 다음 부팅에서 A의 동의가 되살아나지 않는다.
      reset: () => set({ enabled: false })
    }),
    {
      name: "wooriai-analytics-consent",
      storage: createJSONStorage(() => persistStorage)
    }
  )
);

export function isAnalyticsEnabled(): boolean {
  return useAnalyticsConsentStore.getState().enabled;
}
