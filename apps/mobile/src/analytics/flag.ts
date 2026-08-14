import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { persistStorage } from "../stores/persist-storage";

export type AnalyticsConsentState = {
  enabled: boolean;
  setEnabled: (enabled: boolean) => void;
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
      setEnabled: (enabled) => set({ enabled })
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
