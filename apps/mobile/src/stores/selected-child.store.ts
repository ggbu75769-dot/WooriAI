import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { persistStorage } from "./persist-storage";

export type SelectedChildState = {
  selectedChildId: string | null;
  setSelectedChildId: (childId: string) => void;
  clearSelectedChildId: () => void;
};

export const useSelectedChildStore = create<SelectedChildState>()(
  persist(
    (set) => ({
      selectedChildId: null,
      setSelectedChildId: (childId) => set({ selectedChildId: childId }),
      clearSelectedChildId: () => set({ selectedChildId: null })
    }),
    {
      name: "wooriai-selected-child",
      storage: createJSONStorage(() => persistStorage)
    }
  )
);
