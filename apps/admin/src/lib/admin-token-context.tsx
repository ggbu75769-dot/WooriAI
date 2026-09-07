"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { adminMe, isAuthError, type AdminProfile } from "./admin-api";
import type { AdminSessionEndReason } from "./session-end-copy";

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

/**
 * 라운드 107 트랙 J — **세션이 끝난 이유를 로그인 화면까지 나르는 채널.**
 *
 * ⚠️ 두 시점. 종전 이 값에는 `session`·`isReady` 둘밖에 없었고 **그때는 그것으로 충분해
 * 보였다**: 어드민의 모든 화면이 401을 받으면 `clearSession()`만 부르고 끝났으므로 이유를
 * 물어보는 소비자가 0건이었다. 그 침묵이 곧 결함이었다 — 아래 두 필드가 그 이유를 값으로
 * 들고, `AdminShell`의 로그인 화면이 그것을 읽어 문장 하나를 세운다.
 *
 * 형식은 모바일이 AUTH-127에서 이미 고른 것을 그대로 빌렸다(`session.store.ts`의
 * `lastEndReason` ← `clearSession(reason)`). 문장은 빌리지 않는다 — 이유는
 * `session-end-copy.ts` 머리말에 있다.
 */
type AdminSessionContextValue = {
  session: AdminSession | null;
  isReady: boolean;
  /**
   * 세션 캐시가 마지막으로 비워진 이유. 아직 한 번도 비워지지 않았으면 null이다.
   *
   * ⚠️ **`refresh()`의 401은 여기에 적히지 않는다.** 앱을 처음 여는 사람과 쿠키가 만료된 채
   * 새로고침한 사람은 클라이언트에서 **구별되지 않는다**(둘 다 `adminMe()`가 401이다 — 어드민
   * 세션은 메모리에만 살아 새로고침을 넘기지 못한다). 그 자리에서 "만료됐어요"라고 말하면
   * 처음 오는 모든 사람에게 거짓을 말하게 되므로, 그 갈래는 종전처럼 조용하다.
   */
  lastEndReason: AdminSessionEndReason | null;
  /**
   * 세션 확인이 **401이 아닌 이유로** 실패했는가(연결 실패·타임아웃·5xx). 참인 동안 세션의
   * 생사는 모르는 상태이고, 로그인 화면이 그 사실을 말한다.
   */
  sessionCheckFailed: boolean;
  refresh: () => Promise<void>;
  setSession: (session: AdminSession) => void;
  /**
   * 기본값이 `"rejected"`인 것이 이 배선의 본체다.
   *
   * 이 함수를 부르는 자리는 오늘 서른둘이고 그중 서른이 `isAuthError(error)` 갈래 안 —
   * 즉 **서버가 토큰을 거절했다**는 뜻이다. 남은 둘만이 운영자가 스스로 누른 로그아웃이고
   * (`AdminShell`의 `LogoutButton`·`switchAccount`), 그 둘이 `"logout"`을 명시한다.
   *
   * ⚠️ 반대로(기본값 `"logout"` + 서른 자리에 인자 추가) 두지 않은 이유는 둘이다. ⓐ 그러면
   * 서른 자리의 바이트가 움직여 `admin-load-error-copy.test.ts`·`admin-write-error-copy.test.ts`가
   * *"401 갈래는 `clearSession()` 하나로 끝난다"* 를 무는 자리들이 함께 빨개진다 — 그 계약이
   * 지키는 사실(401 앞에 아무것도 끼우지 않는다)은 이 라운드가 바꾸려는 것이 아니다.
   * ⓑ 새 화면이 401 갈래를 옆에서 베껴 오면 인자 없이도 옳은 값이 되고, 잊어서 틀리는 쪽은
   * 로그아웃 버튼을 새로 만드는 라운드뿐인데 그 자리는 오늘 둘이고 한 파일에 붙어 있다.
   * ⚠️ 그 둘이 인자를 잃으면 "스스로 누른 로그아웃"에 만료 안내가 서므로,
   * `src/lib/admin-session-notice.test.ts`가 그 두 자리를 값으로 문다.
   */
  clearSession: (reason?: AdminSessionEndReason) => void;
};

const AdminSessionContext = createContext<AdminSessionContextValue | null>(null);

export function AdminTokenProvider({ children }: { children: ReactNode }) {
  const [session, setSessionState] = useState<AdminSession | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [lastEndReason, setLastEndReason] = useState<AdminSessionEndReason | null>(null);
  const [sessionCheckFailed, setSessionCheckFailed] = useState(false);

  /**
   * 라운드 107 트랙 J — **모든 실패를 로그아웃으로 접던 `catch {}`를 401과 그 밖으로 가른다.**
   *
   * ⚠️ 두 시점. 종전 몸통은 `catch { setSessionState(null); }` 한 줄이었고, **그때 그 한 줄이
   * 하는 말은 하나뿐이었다**: "확인에 실패했으면 로그인 화면으로." 그래서 401(진짜 거절)과
   * 읽기 타임아웃(10초)·연결 실패·5xx가 **한 값**이 됐고, API가 잠깐 죽었을 뿐인데 앱에 들어온
   * 운영자에게 설명 없는 로그인 화면이 떴다.
   *
   * 이제 갈래가 둘이다.
   *  · **401** — 서버가 토큰을 받지 않는다. 종전 그대로 세션 캐시를 비운다. ⚠️ 이유는 적지
   *    않는다(위 `lastEndReason` 주석: 처음 오는 사람과 구별할 수 없다).
   *  · **그 밖** — 세션의 생사를 **모른다**. 그래서 세션을 버리지 않는다(`setSessionState`를
   *    부르지 않는다). 오늘 이 자리에 살아 있는 세션이 실제로 담기는 경로는 아직 없지만
   *    (`refresh()`는 마운트와 로그인 2단계 되돌리기에서만 불리고 그때 세션은 이미 null이다),
   *    버리지 **않는** 것이 이 갈래의 계약이라 모양을 먼저 옳게 둔다.
   *
   * ⚠️ 무엇을 대신 보여 줄 것인가 — **전용 오류 화면을 세우지 않고 로그인 화면에 한 줄을
   * 얹는 쪽**을 골랐다. 전용 화면으로 갈라 두면 API의 `/admin/auth/me` 하나만 고장 난 날
   * 운영자가 **멀쩡한 로그인 폼에 닿지 못한 채** [다시 시도]만 누르게 된다. 한 화면에 두면
   * 출구가 둘(재시도 · 지금 바로 로그인)이고, 어느 쪽이 맞는지 모르는 상태에서 둘 다 열어
   * 두는 것이 정직하다.
   */
  const refresh = useCallback(async () => {
    setSessionCheckFailed(false);
    try {
      const me = await adminMe();
      setSessionState({
        admin: me.admin,
        mfaEnabled: me.mfaEnabled,
        mfaRecoveryCodesRemaining: me.mfaRecoveryCodesRemaining
      });
      setLastEndReason(null);
    } catch (error) {
      if (isAuthError(error)) {
        setSessionState(null);
        return;
      }
      setSessionCheckFailed(true);
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

  // 라운드 107 트랙 J: 로그인이 성공한 순간 지난 이유는 더 이상 사실이 아니다 —
  // 그 문장을 지우지 않으면 다음에 스스로 로그아웃했을 때 옛 안내가 다시 선다.
  const setSession = useCallback((next: AdminSession) => {
    setSessionState(next);
    setLastEndReason(null);
    setSessionCheckFailed(false);
  }, []);
  // 라운드 107 트랙 J: 기본값이 "rejected"인 근거는 위 타입 선언의 주석에 있다.
  // 확인 실패 표시를 함께 내리는 이유: 세션이 끝났다는 것은 확인이 끝났다는 뜻이라,
  // "아직 모른다"와 "거절당했다"가 한 화면에 같이 서면 둘 중 하나는 거짓이다.
  const clearSession = useCallback((reason: AdminSessionEndReason = "rejected") => {
    setSessionState(null);
    setLastEndReason(reason);
    setSessionCheckFailed(false);
  }, []);

  const value = useMemo<AdminSessionContextValue>(
    () => ({ session, isReady, lastEndReason, sessionCheckFailed, refresh, setSession, clearSession }),
    [session, isReady, lastEndReason, sessionCheckFailed, refresh, setSession, clearSession]
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
