import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { persistStorage } from "../stores/persist-storage";

export type AnalyticsConsentState = {
  enabled: boolean;
  setEnabled: (enabled: boolean) => void;
};

/**
 * ANA-101 (round5a-sprint2-plan.md §5): analytics is opt-in and defaults to
 * OFF until ANA-102 (explicit consent UI) ships -- while this is false,
 * nothing in ./client.ts queues or sends a single event. No screen currently
 * calls setEnabled(true); wiring an actual consent toggle is ANA-102's job,
 * out of scope here. Persisted (like the app's other zustand stores) so a
 * future consent choice survives app restarts once ANA-102 lands.
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
