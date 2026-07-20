import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { zustandPersistStorage } from "./persist-storage";

type CatalogSearchState = {
  recentSearches: string[];
  addRecentSearch: (query: string) => void;
  clearRecentSearches: () => void;
};

function sanitize(value: unknown) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0 && entry.length <= 80).map((entry) => entry.trim()))].slice(0, 10);
}

export const useCatalogSearchStore = create<CatalogSearchState>()(persist((set) => ({
  recentSearches: [],
  addRecentSearch: (query) => set((state) => {
    const normalized = query.trim();
    return normalized ? { recentSearches: [normalized, ...state.recentSearches.filter((entry) => entry !== normalized)].slice(0, 10) } : state;
  }),
  clearRecentSearches: () => set({ recentSearches: [] })
}), {
  name: "wooriai-catalog-recent-searches",
  storage: createJSONStorage(() => zustandPersistStorage),
  version: 1,
  partialize: (state) => ({ recentSearches: state.recentSearches }),
  merge: (persisted, current) => ({ ...current, recentSearches: sanitize(persisted && typeof persisted === "object" ? (persisted as { recentSearches?: unknown }).recentSearches : undefined) })
}));
