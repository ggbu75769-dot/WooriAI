"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

const STORAGE_KEY = "wooriai_admin_token";

// The exposed `token` stays a single opaque string so every admin-api.ts call site
// (listItemTemplates(token), createItemTemplate(token, ...), etc.) is unaffected by
// the auth mode. Internally it's prefixed with "jwt:" or "legacy:" so admin-api.ts's
// request() helper knows whether to send it as `Authorization: Bearer` (the real
// per-admin JWT from POST /admin/auth/login) or the legacy dev/test-only
// `x-admin-token` header.
const JWT_PREFIX = "jwt:";
const LEGACY_PREFIX = "legacy:";

type AdminTokenContextValue = {
  token: string | null;
  isReady: boolean;
  isLegacyToken: boolean;
  setJwtToken: (token: string) => void;
  setLegacyToken: (token: string) => void;
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

  const persist = useCallback((next: string) => {
    setTokenState(next);
    try {
      window.sessionStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignore storage failures; the token still works in-memory for this tab session.
    }
  }, []);

  const setJwtToken = useCallback((next: string) => persist(`${JWT_PREFIX}${next}`), [persist]);
  const setLegacyToken = useCallback((next: string) => persist(`${LEGACY_PREFIX}${next}`), [persist]);

  const clearToken = useCallback(() => {
    setTokenState(null);
    try {
      window.sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }, []);

  const value = useMemo<AdminTokenContextValue>(
    () => ({
      token,
      isReady,
      isLegacyToken: token?.startsWith(LEGACY_PREFIX) ?? false,
      setJwtToken,
      setLegacyToken,
      clearToken
    }),
    [token, isReady, setJwtToken, setLegacyToken, clearToken]
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
