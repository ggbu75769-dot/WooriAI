"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { adminMe, type AdminProfile } from "./admin-api";

// SEC-102: replaces the previous browser-storage-held Bearer/legacy-token
// context. Auth now lives entirely in the HttpOnly `admin_session` cookie set
// by the API (see admin-cookies.ts on the backend) — nothing secret is held in
// browser storage or JS memory here. `session` is just a client-side cache of
// "am I logged in, and has this admin finished MFA enrollment", refreshed via
// GET /admin/auth/me (which itself relies on the ambient cookie).
/**
 * GAP-064 #7: `mfaRecoveryCodesRemaining`은 **남은 복구 코드 장수**다(값도 해시도 아니다 —
 * 서버가 개수만 보낸다). 로그인을 마친 세션에만 실리므로 이 캐시에 두는 것이 안전하다:
 * 복구 코드는 추측 대상이 아니라 소지 대상이고, 잔량은 "몇 번 더 시도할 수 있나"가 아니라
 * "지금 재등록해야 하나"에 답하는 값이다.
 *
 * optional인 이유는 이 필드 이전 응답과 섞여도 화면이 깨지지 않게 하기 위해서다 — 그때는
 * 잔량 줄을 그리지 않는다(모르는 것을 0으로 단정하지 않는다 — recovery-codes-view.ts).
 */
export type AdminSession = { admin: AdminProfile; mfaEnabled: boolean; mfaRecoveryCodesRemaining?: number };

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
      setSessionState({
        admin: me.admin,
        mfaEnabled: me.mfaEnabled,
        mfaRecoveryCodesRemaining: me.mfaRecoveryCodesRemaining
      });
    } catch {
      setSessionState(null);
    } finally {
      setIsReady(true);
    }
  }, []);

  useEffect(() => {
    refresh();
    // Only on mount: the cookie itself (not this effect) is the source of
    // truth for whether the browser is still authenticated.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
