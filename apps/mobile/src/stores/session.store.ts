import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { persistStorage } from "./persist-storage";

export type SessionState = {
  accessToken: string | null;
  refreshToken: string | null;
  userId: string | null;
  defaultHouseholdId: string | null;
  setSession: (session: {
    accessToken: string;
    refreshToken: string;
    userId: string;
    defaultHouseholdId?: string | null;
  }) => void;
  clearSession: () => void;
};

export const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      userId: null,
      defaultHouseholdId: null,
      setSession: (session) =>
        set({
          accessToken: session.accessToken,
          refreshToken: session.refreshToken,
          userId: session.userId,
          defaultHouseholdId: session.defaultHouseholdId ?? null
        }),
      clearSession: () =>
        set({ accessToken: null, refreshToken: null, userId: null, defaultHouseholdId: null })
    }),
    {
      name: "wooriai-session",
      storage: createJSONStorage(() => persistStorage)
    }
  )
);
