import { useCallback, useEffect, useRef, useState } from "react";

/**
 * MOB-117 당겨서 새로고침 공용 훅. 화면별 refresh 함수(해당 화면 쿼리 invalidate/refetch)를
 * 받아 RefreshControl에 넘길 { refreshing, onRefresh }를 만든다. invalidateQueries는 활성
 * 쿼리의 refetch가 끝나야 resolve되므로 스피너가 실제 완료 시점에 맞춰 닫힌다.
 *
 * refresh를 ref로 들고 있는 이유: 화면들이 인라인 화살표 함수를 그대로 넘겨도(렌더마다 새
 * 참조) onRefresh 콜백 자체는 안정적으로 유지되어 RefreshControl prop이 불필요하게 바뀌지
 * 않는다. 실패해도 스피너만 닫는다 -- 에러 표시는 각 쿼리의 isError 상태가 담당한다.
 */

/**
 * FIX-118A 안전밸브: app/index.tsx의 3초 밸브들과 같은 관례. refresh가 영원히 settle되지 않으면
 * (react-query가 어떤 이유로든 쿼리를 pause시키거나, 응답도 에러도 오지 않는 hung request)
 * RefreshControl 스피너가 영원히 돌아 화면이 고장난 것처럼 보인다. 그 상태를 만들던 원인
 * (onlineManager 배선)은 같은 티켓에서 제거했지만, 스피너는 사용자가 직접 되돌릴 방법이 없는
 * UI라 밸브를 하나 둔다. 네트워크 왕복 한 번보다 넉넉한 10초 -- 정상 새로고침이 이 값에 걸려
 * 조기 종료될 일은 없다. 늦게 도착한 결과는 그대로 쿼리 캐시에 반영되므로 데이터는 안전하다.
 */
export const PULL_TO_REFRESH_TIMEOUT_MS = 10_000;

/**
 * T10(토스급) — 스피너 **최소 표시** 시간.
 *
 * 캐시가 신선해 refresh가 수십 ms에 settle되면 스피너가 한 프레임 깜빡이고 사라져,
 * "새로고침이 실제로 일어났는지"를 눈으로 확인할 수 없었다(고장처럼 보이는 것은 무한
 * 스피너만이 아니다 — 아무 일도 없어 보이는 당김도 같다). 450ms는 스피너 회전이 한 번은
 * 눈에 잡히는 길이이고, 정상 네트워크 왕복(수백 ms~수 초)에는 아무 지연도 더하지 않는다
 * (완료가 450ms보다 늦으면 종전과 완전히 같은 시점에 닫힌다). 데이터는 이 값과 무관하게
 * settle 즉시 캐시에 반영된다 — 늦춰지는 것은 스피너가 닫히는 프레임뿐이다.
 */
const PULL_TO_REFRESH_MIN_VISIBLE_MS = 450;

/**
 * 스피너의 두 타이머(10초 안전밸브 + 450ms 최소 표시)를 한 곳에서 관리하는 팩토리.
 *
 * 훅 밖으로 뽑은 이유는 use-pull-to-refresh.test.ts가 이 타이머 규칙(최소 표시 경계 ·
 * 밸브 보존 · clear()의 타이머 정리)을 fake timer로 직접 물기 위해서다 — vitest에는
 * react-native 렌더가 없어 훅 자체는 세울 수 없다(소스 계약은 refresh-wiring-contract가 본다).
 *
 * 시계 주입 규율과의 관계: 시각을 읽지 않는다(Date.now 0건) — 타이머 두 개가 전부다.
 */
export function createRefreshSpinnerTimer(onStop: () => void): {
  /**
   * 당김 시작: 밸브·최소 표시 타이머를 걸고(이전 사이클이 남아 있으면 먼저 정리) 이
   * 사이클의 토큰을 돌려준다 — settle은 그 토큰과 함께만 유효하다.
   */
  start: () => number;
  /** refresh가 settle됐다: 최소 표시가 지났으면 즉시, 아니면 450ms 시점에 스피너를 닫는다.
   * ⚠️ 두 시점(토스 리뷰 M): 종전에는 인자가 없어 사이클 정체성이 없었다 — refresh1이 hang →
   * 밸브가 닫음 → 재당김(사이클2) → hang이던 refresh1의 finally가 settle()을 부르면 settled가
   * 남아 사이클2가 자기 refresh 완료와 무관하게 450ms에 닫혔다. 이제 자기 start()가 돌려준
   * 토큰의 settle만 유효하고, 이전 사이클의 늦은 settle은 무시된다. */
  settle: (token: number) => void;
  /** 언마운트: onStop을 부르지 않고 타이머만 정리한다(사라진 화면에 setState를 걸지 않게). */
  clear: () => void;
} {
  let valveTimer: ReturnType<typeof setTimeout> | null = null;
  let minVisibleTimer: ReturnType<typeof setTimeout> | null = null;
  let minVisibleElapsed = false;
  let settled = false;
  // 한 사이클에 onStop은 한 번이다 — 밸브가 먼저 닫은 뒤 뒤늦은 settle이 와도 요동하지 않는다.
  let stopped = false;
  // 사이클 토큰: start()마다 오르고, settle은 현재 사이클의 토큰일 때만 선다.
  let cycle = 0;

  const clearTimers = () => {
    if (valveTimer) {
      clearTimeout(valveTimer);
      valveTimer = null;
    }
    if (minVisibleTimer) {
      clearTimeout(minVisibleTimer);
      minVisibleTimer = null;
    }
  };

  const stopSpinner = () => {
    if (stopped) return;
    stopped = true;
    clearTimers();
    onStop();
  };

  return {
    start: () => {
      clearTimers();
      cycle += 1;
      minVisibleElapsed = false;
      settled = false;
      stopped = false;
      // FIX-118A 안전밸브 배선은 그대로다(리터럴·형태 모두 refresh-wiring-contract가 문다).
      valveTimer = setTimeout(stopSpinner, PULL_TO_REFRESH_TIMEOUT_MS);
      minVisibleTimer = setTimeout(() => {
        minVisibleTimer = null;
        minVisibleElapsed = true;
        if (settled) stopSpinner();
      }, PULL_TO_REFRESH_MIN_VISIBLE_MS);
      return cycle;
    },
    settle: (token) => {
      // 이전 사이클의 늦은 settle(예: 밸브가 닫은 뒤에도 진행 중이던 refresh의 finally)은
      // 새 사이클의 스피너를 조기 종료시키면 안 된다 — 모듈 머리말("스피너가 실제 완료
      // 시점에 맞춰 닫힌다")의 약속이다.
      if (token !== cycle) return;
      settled = true;
      if (minVisibleElapsed) stopSpinner();
    },
    clear: clearTimers
  };
}

export function usePullToRefresh(refresh: () => Promise<unknown>): {
  refreshing: boolean;
  onRefresh: () => void;
} {
  const [refreshing, setRefreshing] = useState(false);
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;
  // 언마운트 후 setState 경고 방지 + 밸브/최소 표시 타이머 정리.
  const mountedRef = useRef(true);
  const spinnerTimerRef = useRef<ReturnType<typeof createRefreshSpinnerTimer> | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      spinnerTimerRef.current?.clear();
    };
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    if (!spinnerTimerRef.current) {
      spinnerTimerRef.current = createRefreshSpinnerTimer(() => {
        if (mountedRef.current) setRefreshing(false);
      });
    }
    // 토스 리뷰 M: 각 onRefresh 클로저는 자기 start()가 돌려준 사이클 토큰으로만 settle한다 —
    // 이전 당김의 늦은 finally가 다음 당김의 스피너를 조기 종료시키지 않는다.
    const cycleToken = spinnerTimerRef.current.start();
    void (async () => {
      try {
        await refreshRef.current();
      } catch {
        // best-effort: 실패한 쿼리는 자신의 isError UI로 드러난다.
      } finally {
        spinnerTimerRef.current?.settle(cycleToken);
      }
    })();
  }, []);

  return { refreshing, onRefresh };
}
