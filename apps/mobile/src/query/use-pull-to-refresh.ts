import { useCallback, useRef, useState } from "react";

/**
 * MOB-117 당겨서 새로고침 공용 훅. 화면별 refresh 함수(해당 화면 쿼리 invalidate/refetch)를
 * 받아 RefreshControl에 넘길 { refreshing, onRefresh }를 만든다. invalidateQueries는 활성
 * 쿼리의 refetch가 끝나야 resolve되므로 스피너가 실제 완료 시점에 맞춰 닫힌다.
 *
 * refresh를 ref로 들고 있는 이유: 화면들이 인라인 화살표 함수를 그대로 넘겨도(렌더마다 새
 * 참조) onRefresh 콜백 자체는 안정적으로 유지되어 RefreshControl prop이 불필요하게 바뀌지
 * 않는다. 실패해도 스피너만 닫는다 -- 에러 표시는 각 쿼리의 isError 상태가 담당한다.
 */
export function usePullToRefresh(refresh: () => Promise<unknown>): {
  refreshing: boolean;
  onRefresh: () => void;
} {
  const [refreshing, setRefreshing] = useState(false);
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void (async () => {
      try {
        await refreshRef.current();
      } catch {
        // best-effort: 실패한 쿼리는 자신의 isError UI로 드러난다.
      } finally {
        setRefreshing(false);
      }
    })();
  }, []);

  return { refreshing, onRefresh };
}
