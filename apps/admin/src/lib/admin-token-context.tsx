"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { adminMe, type AdminProfile } from "./admin-api";

// SEC-102: replaces the previous browser-storage-held Bearer/legacy-token
// context. Auth now lives entirely in the HttpOnly `admin_session` cookie set
// by the API (see admin-cookies.ts on the backend) — nothing secret is held in
// browser storage or JS memory here. `session` is just a client-side cache of
// "am I logged in, and has this admin finished MFA enrollment", refreshed via
// GET /admin/auth/me (which itself relies on the ambient cookie).
export type AdminSession = { admin: AdminProfile; mfaEnabled: boolean };

type AdminSessionContextValue = {
  session: AdminSession | null;
  isReady: boolean;
  refresh: () => Promise<void>;
  setSession: (session: AdminSession) => void;
  clearSession: () => void;
};

const AdminSessionContext = createContext<AdminSessionContextValue | null>(null);

export function AdminTokenProvider({ children }: { children: ReactNode }) {
  const [session, setSessionState] = useState<AdminSession | null>(null);
  const [isReady, setIsReady] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const me = await adminMe();
      setSessionState({ admin: me.admin, mfaEnabled: me.mfaEnabled });
    } catch {
      setSessionState(null);
    } finally {
      setIsReady(true);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const setSession = useCallback((next: AdminSession) => setSessionState(next), []);
  const clearSession = useCallback(() => setSessionState(null), []);

  const value = useMemo<AdminSessionContextValue>(
    () => ({ session, isReady, refresh, setSession, clearSession }),
    [session, isReady, refresh, setSession, clearSession]
  );

  return <AdminSessionContext.Provider value={value}>{children}</AdminSessionContext.Provider>;
}

export function useAdminSession(): AdminSessionContextValue {
  const context = useContext(AdminSessionContext);
  if (!context) {
    throw new Error("useAdminSession must be used within an AdminTokenProvider");
  }
  return context;
}
