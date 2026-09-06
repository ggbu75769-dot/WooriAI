import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { listExpenses, type Expense } from "../api/client";
import { fetchMonthExpenses } from "./month-expenses";
import { collectSearchScopeMonths, type SearchScopeCollectionResult } from "./records-search-scope";

/**
 * 라운드 101 트랙 A — 전체 기간 검색의 **수집 훅**(판정·루프는 전부 records-search-scope.ts).
 *
 * ## 왜 화면(records.tsx)이 아니라 여기인가
 * 기록 탭의 `listExpenses(authToken!` 호출 지점은 소스 계약이 **딱 둘**로 물고 있다
 * (src/records-list-virtualization.test.ts — 이번 달 + 지난달, "호출 지점은 딱 이 둘까지만
 * 허용한다"). 이 수집은 세 번째 호출부이므로 그 계약의 뜻(화면이 임의로 조회 표면을 늘리지
 * 않는다)을 지키는 자리는 화면 밖이다 — 페처·키·수집 규칙이 이 파일 한 곳에 모인다.
 *
 * ## 요청 모양
 *  - **온디맨드**: 화면의 "[전체 기간에서 찾기]" 탭에서만 `collect`가 돈다(첫 페인트 요청 0건 —
 *    이 파일에는 useQuery 선언이 없다). 탭 한 번 = 수집 한 번이고, 도는 동안의 재탭은
 *    무시한다(겹치는 수집 금지).
 *  - **캐시된 달 요청 0건**: 달마다 `queryClient.ensureQueryData(["expenses", childId, ym], …)` —
 *    화면·홈이 이미 쓰는 그 키·그 전량 페처(fetchMonthExpenses, REC-124 H1)라 캐시가 따뜻한
 *    달은 즉시 돌아오고, 재시도는 같은 호출이다(실패한 달만 실제 요청이 나간다).
 *  - **낡음 신호는 기존 경로 그대로**: 이 훅은 무효화를 하나도 더하지 않는다. 지출 쓰기 경로가
 *    이미 `["expenses"]` 접두를 무효화하므로(shared-cache-policy의 EXPENSE_WRITE_LEDGER) 수집
 *    스냅숏이 낡는 창은 "다른 기기가 그 사이 과거 달을 고친" 경우뿐이고, 그때도 화면의
 *    재조정(reconcileMonthlyExpenses + 오프라인 행)이 이 기기의 변경은 계속 반영한다.
 *
 * ## 상태 규칙
 *  - `result`는 **한 번의 수집이 낸 스냅숏**이다(성공 달 + 실패 달). 아이가 바뀌면 이전 아이의
 *    것이라 통째로 버리고(effect), 검색어 삭제의 폐기는 화면이 `reset`으로 진다(스코프 판정
 *    `resolveRecordsSearchScope`와 한 몸인 규칙이라 화면 쪽에 있다).
 *  - 진행 중 `reset`이 오면(아이 전환·검색어 삭제) 그 수집의 완료는 **버려진다**(run 대조) —
 *    사라진 스코프에 낡은 결과가 세워지지 않는다.
 */
export type UseSearchScopeCollection = {
  /** 마지막 수집의 스냅숏. 아직 수집 전(또는 reset 뒤)이면 null. */
  result: SearchScopeCollectionResult<Expense> | null;
  /** 수집이 도는 동안 true — 화면은 진입 버튼을 잠근다(탭 한 번 = 수집 한 번). */
  collecting: boolean;
  /** 달 목록을 걷는다. 완료가 화면에 반영됐으면 true(무시·폐기됐으면 false). */
  collect: (months: readonly string[]) => Promise<boolean>;
  /** 수집물 폐기(검색어 삭제 등). 진행 중이던 수집의 완료도 함께 버려진다. */
  reset: () => void;
};

export function useSearchScopeCollection(input: {
  authToken: string | null;
  childId: string | null;
}): UseSearchScopeCollection {
  const { authToken, childId } = input;
  const queryClient = useQueryClient();
  const [result, setResult] = useState<SearchScopeCollectionResult<Expense> | null>(null);
  const [collecting, setCollecting] = useState(false);
  // 수집 회차 — reset이 올리면 진행 중이던 수집의 완료가 버려진다.
  const runRef = useRef(0);
  // 겹침 잠금은 state가 아니라 ref로 본다 — 같은 프레임의 연타가 state 반영 전에 들어온다.
  const collectingRef = useRef(false);

  const reset = useCallback(() => {
    runRef.current += 1;
    collectingRef.current = false;
    setResult(null);
    setCollecting(false);
  }, []);

  // 아이가 바뀌면 수집물은 이전 아이의 것이다 — 검색어와 무관하게 버린다.
  useEffect(() => {
    reset();
  }, [childId, reset]);

  const collect = useCallback(
    async (months: readonly string[]) => {
      if (!authToken || !childId || months.length === 0) return false;
      if (collectingRef.current) return false;
      const run = runRef.current + 1;
      runRef.current = run;
      collectingRef.current = true;
      setCollecting(true);
      const collected = await collectSearchScopeMonths<Expense>(months, (yearMonth) =>
        queryClient.ensureQueryData({
          queryKey: ["expenses", childId, yearMonth],
          queryFn: () => fetchMonthExpenses((page) => listExpenses(authToken, childId, yearMonth, page))
        })
      );
      // 그 사이 reset(아이 전환·검색어 삭제)이 왔으면 이 완료는 낡은 것이다.
      if (runRef.current !== run) return false;
      collectingRef.current = false;
      setResult(collected);
      setCollecting(false);
      return true;
    },
    [authToken, childId, queryClient]
  );

  return { result, collecting, collect, reset };
}
