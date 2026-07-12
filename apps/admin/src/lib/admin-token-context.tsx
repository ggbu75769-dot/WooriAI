"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

const STORAGE_KEY = "wooriai_admin_token";

type AdminTokenContextValue = {
  token: string | null;
  isReady: boolean;
  setToken: (token: string) => void;
  clearToken: () => void;
};

const AdminTokenContext = createContext<AdminTokenContextValue | null>(null);

export function AdminTokenProvider({ children }: { children: ReactNode }) {
  const [token, setTokenState] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    try {
      const stored = window.sessionStorage.getItem(STORAGE_KEY);
      if (stored) {
        setTokenState(stored);
      }
    } catch {
      // sessionStorage may be unavailable (e.g. privacy mode); fall back to in-memory only.
    }
    setIsReady(true);
  }, []);

  const setToken = useCallback((next: string) => {
    setTokenState(next);
    try {
      window.sessionStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignore storage failures; the token still works in-memory for this tab session.
    }
  }, []);

  const clearToken = useCallback(() => {
    setTokenState(null);
    try {
      window.sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }, []);

  const value = useMemo<AdminTokenContextValue>(
    () => ({ token, isReady, setToken, clearToken }),
    [token, isReady, setToken, clearToken]
  );

  return <AdminTokenContext.Provider value={value}>{children}</AdminTokenContext.Provider>;
}

export function useAdminToken(): AdminTokenContextValue {
  const context = useContext(AdminTokenContext);
  if (!context) {
    throw new Error("useAdminToken must be used within an AdminTokenProvider");
  }
  return context;
}
