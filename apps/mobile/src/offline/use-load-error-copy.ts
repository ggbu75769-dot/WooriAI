import { useEffect, useState } from "react";
import { isCurrentlyOnline } from "./connectivity";
import { resolveLoadErrorCopy, type LoadErrorCopy } from "./messages";

/**
 * UX-N 조회 실패 카드 공용 훅. 화면의 "지금 에러 상태인가"를 받아, 에러로 **전환되는 순간에만**
 * 연결 상태를 한 번 확인하고 그 결과로 문구를 고른다(판정 로직 자체는 순수 함수
 * resolveLoadErrorCopy — src/offline/messages.ts에 있고 단위 테스트 대상이다).
 *
 * 왜 별도 파일인가: messages.ts는 문자열만 담은 순수 모듈이라 vitest(node 환경)에서 그대로
 * import된다. isCurrentlyOnline은 expo-network를 들고 있어 그 환경에서 import조차 되지 않으므로
 * (connectivity.ts 헤더 참고), 네이티브를 건드리는 얇은 배선층만 여기로 분리한다 —
 * app-refetch.ts / install-app-refetch.ts가 쓰는 것과 같은 관례.
 *
 * 폴은 point-in-time 1회다. 15초 폴러를 하나 더 돌리지 않는 이유: 이 카드가 떠 있는 동안
 * 화면이 스스로 복구되는 경로는 어차피 없고(FIX-118A로 재연결 자동 재조회는 배선돼 있지 않다),
 * 사용자의 다음 행동은 [다시 시도]를 누르거나 앱을 나갔다 오는 것이다. 후자는 포그라운드 복귀
 * 재조회에 걸려 이 카드가 통째로 사라진다.
 *
 * 기본값이 `true`(온라인)인 이유: 폴이 끝나기 전 첫 프레임과, 연결 상태를 보고할 수 없는
 * 플랫폼(web — isCurrentlyOnline이 항상 true를 돌려준다) 모두에서 기존 문구가 그대로 나온다.
 * 새 문구는 "오프라인이라고 확인된" 경우에만 대체한다.
 */
export function useLoadErrorCopy(isError: boolean): LoadErrorCopy {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    if (!isError) {
      // 에러가 풀리면 판정을 초기값으로 되돌린다 — 다음 실패는 그때의 연결 상태로 다시 판정한다.
      setIsOnline(true);
      return;
    }
    let cancelled = false;
    void isCurrentlyOnline().then((online) => {
      if (!cancelled) setIsOnline(online);
    });
    return () => {
      cancelled = true;
    };
  }, [isError]);

  return resolveLoadErrorCopy({ isOnline });
}
