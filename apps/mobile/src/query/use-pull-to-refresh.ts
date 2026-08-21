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

export function usePullToRefresh(refresh: () => Promise<unknown>): {
  refreshing: boolean;
  onRefresh: () => void;
} {
  const [refreshing, setRefreshing] = useState(false);
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;
  // 언마운트 후 setState 경고 방지 + 밸브 타이머 정리.
  const mountedRef = useRef(true);
  const valveRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (valveRef.current) clearTimeout(valveRef.current);
    };
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    const stopSpinner = () => {
      if (valveRef.current) {
        clearTimeout(valveRef.current);
        valveRef.current = null;
      }
      if (mountedRef.current) setRefreshing(false);
    };
    valveRef.current = setTimeout(stopSpinner, PULL_TO_REFRESH_TIMEOUT_MS);
    void (async () => {
      try {
        await refreshRef.current();
      } catch {
        // best-effort: 실패한 쿼리는 자신의 isError UI로 드러난다.
      } finally {
        stopSpinner();
      }
    })();
  }, []);

  return { refreshing, onRefresh };
}
