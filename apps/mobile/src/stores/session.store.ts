import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { ensureLocalBackendSeeded } from "../api/local-backend";
import { LOCAL_CHILD_ID } from "../api/local-fixtures";
import { secureSessionStorage } from "./secure-session-storage";
import { useSelectedChildStore } from "./selected-child.store";

export type SessionState = {
  accessToken: string | null;
  refreshToken: string | null;
  userId: string | null;
  defaultHouseholdId: string | null;
  isTestSession: boolean;
  setSession: (session: {
    accessToken: string;
    refreshToken: string;
    userId: string;
    defaultHouseholdId?: string | null;
  }) => void;
  setTokens: (accessToken: string, refreshToken: string) => void;
  startTestSession: () => void;
  clearSession: () => void;
};

export const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      userId: null,
      defaultHouseholdId: null,
      isTestSession: false,
      setSession: (session) =>
        set({
          accessToken: session.accessToken,
          refreshToken: session.refreshToken,
          userId: session.userId,
          defaultHouseholdId: session.defaultHouseholdId ?? null,
          isTestSession: false
        }),
      setTokens: (accessToken, refreshToken) => set({ accessToken, refreshToken }),
      startTestSession: () => {
        ensureLocalBackendSeeded();
        if (!useSelectedChildStore.getState().selectedChildId) {
          useSelectedChildStore.getState().setSelectedChildId(LOCAL_CHILD_ID);
        }
        set({
          accessToken: null,
          refreshToken: null,
          userId: null,
          defaultHouseholdId: null,
          isTestSession: true
        });
      },
      clearSession: () =>
        set({
          accessToken: null,
          refreshToken: null,
          userId: null,
          defaultHouseholdId: null,
          isTestSession: false
        })
    }),
    {
      name: "wooriai-session",
      storage: createJSONStorage(() => secureSessionStorage)
    }
  )
);
