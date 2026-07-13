import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { persistStorage } from "./persist-storage";

export type SelectedChildState = {
  selectedChildId: string | null;
  setSelectedChildId: (childId: string) => void;
  clearSelectedChildId: () => void;
};

/** Defensive shape check for a persisted blob from an unknown/older app version -- anything that
 * doesn't look like a valid selectedChildId falls back to null instead of feeding a malformed
 * value (wrong type) into the store, where it would silently break every screen's
 * `Boolean(authToken && childId)` gating. */
function sanitizedSelectedChildId(value: unknown): string | null {
  if (value === null) return null;
  if (typeof value === "string" && value.length > 0) return value;
  return null;
}

export const useSelectedChildStore = create<SelectedChildState>()(
  persist(
    (set) => ({
      selectedChildId: null,
      setSelectedChildId: (childId) => set({ selectedChildId: childId }),
      clearSelectedChildId: () => set({ selectedChildId: null })
    }),
    {
      name: "wooriai-selected-child",
      storage: createJSONStorage(() => persistStorage),
      // MOB-107: no structural changes yet, but bumped so a future schema change has a `migrate`
      // hook to run against data written by this version.
      version: 1,
      migrate: (persisted) => ({
        selectedChildId: sanitizedSelectedChildId(
          persisted && typeof persisted === "object" ? (persisted as { selectedChildId?: unknown }).selectedChildId : undefined
        )
      }),
      merge: (persisted, current) => ({
        ...current,
        selectedChildId: sanitizedSelectedChildId(
          persisted && typeof persisted === "object" ? (persisted as { selectedChildId?: unknown }).selectedChildId : undefined
        )
      })
    }
  )
);
