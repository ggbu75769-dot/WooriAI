import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQueries, useQueryClient } from "@tanstack/react-query";

import { listExpenses, type Expense } from "../api/client";
import { fetchMonthExpenses } from "./month-expenses";
import {
  collectSearchScopeMonths,
  rebuildSearchScopeResult,
  type SearchScopeCollectionResult
} from "./records-search-scope";

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
 *    아래 useQueries는 수집 전에는 빈 목록이고, 수집 직후에는 방금 채운 신선한 캐시라 관찰만
 *    붙는다). 탭 한 번 = 수집 한 번이고, 도는 동안의 재탭은 무시한다(겹치는 수집 금지).
 *  - **캐시된 달 요청 0건**: 달마다 `queryClient.ensureQueryData(["expenses", childId, ym], …)` —
 *    화면·홈이 이미 쓰는 그 키·그 전량 페처(fetchMonthExpenses, REC-124 H1)라 캐시가 따뜻한
 *    달은 즉시 돌아오고, 재시도는 같은 호출이다(실패한 달만 실제 요청이 나간다).
 *    ⚠️ 리뷰 M-A2 → **라운드 104 트랙 SEARCH(#1)로 근거가 바뀐 자리(두 시점)**: `retry: 1`을
 *    명시하는 것은 그대로인데, 종전 근거는 *"이 루프가 21개월을 **직렬로** 걷기 때문"*(달마다
 *    재시도가 길면 수집 전체가 그 배수로 늘어진다)이었다. 그 루프는 이제 동시성 4의 워커
 *    풀이라(collectSearchScopeMonths 머리말) 그 근거는 더 이상 참이 아니다. 그래도 `retry: 1`이
 *    남는 근거는 **폭이 재시도를 곱한다**는 쪽으로 바뀌었다: 실패가 회선 단절처럼 전면적일 때
 *    21~33개의 재시도가 넷씩 겹쳐 나가면 IP당 300req/60초(공유 버킷 — 워커 폭의 근거와 같은
 *    자리)를 향해 총량이 곱절로 부푼다. 한 번의 재시도 뒤에도 실패한 달은 결과의 failedMonths로
 *    남아 화면의 부분 실패 고지 + [다시 시도] 몫이다(그 재시도는 사용자가 산다).
 *
 * ## 상태 규칙 — 리뷰 H-2(A-1): 스냅숏이 아니라 **달 목록**을 든다
 *  - 종전에는 수집이 끝난 순간의 지출 배열을 동결 스냅숏으로 들었다. 그 스냅숏은 flush 확정
 *    (["expenses"] 무효화 → refetch)이 캐시를 갈아도 낡은 채 남아, 전체 스코프에서 지운 행이
 *    flush 뒤 **부활**하고 수정이 되돌아가고 신규가 증발했다. 이제 상태는 "수집이 성공한 달
 *    목록 + 실패한 달 목록 + 수집 시점 태그(childId·검색어)"뿐이고, `result`는 매 렌더
 *    `rebuildSearchScopeResult`가 그 달들의 캐시를 **소비 시점에 다시 읽어** 세운다.
 *  - ⚠️ **캐시 갱신이 이 훅을 다시 그리게 하는 것은 아래 useQueries 구독이다.** 오프라인
 *    스냅숏 구독(화면의 childOfflineRows)에 편승하는 안도 쟀는데, 리렌더는 얻어도 **관찰자
 *    없는 달의 캐시는 무효화가 refetch하지 않아**(react-query invalidateQueries의 기본
 *    refetchType은 "active") 다시 읽어도 낡은 값 그대로였다 — 그 실측이
 *    records-search-scope.test.ts의 "관찰자 없는 캐시" 스위트에 있다. 구독이 달 쿼리를
 *    active로 만들어야 flush 확정의 무효화가 그 달들을 실제로 다시 받아 온다(그 refetch가
 *    삭제 행 부활을 막는 바로 그 갱신이다).
 *  - 아이가 바뀌면 이전 아이의 것이라 통째로 버리고(effect + result의 동기 대조 — 리뷰 L-A4),
 *    검색어 삭제의 폐기는 화면이 `reset`으로 진다(스코프 판정 `resolveRecordsSearchScope`와
 *    한 몸인 규칙이라 화면 쪽에 있다).
 *  - 진행 중 `reset`이 오면(아이 전환·검색어 삭제) 그 수집의 완료는 **버려진다**(run 대조) —
 *    사라진 스코프에 낡은 결과가 세워지지 않는다.
 *  - **전량 실패면 아무것도 세우지 않는다**(리뷰 M-2) — 불러온 달이 0인데 스코프가 "전체"로
 *    전환되면 빈 목록이 "전 기간에 없다"로 읽힌다. 화면은 all-failed 갈래로 실패 낭독만 한다.
 */
export type SearchScopeCollectOutcome =
  /** 무시(전제 미충족·겹침) 또는 진행 중 reset으로 폐기 — 화면은 아무것도 하지 않는다. */
  | { status: "discarded" }
  /** 모든 달이 실패 — 스코프는 전환되지 않았다(수집물 0). 화면은 실패 낭독만 한다. */
  | { status: "all-failed"; failedMonths: string[] }
  /** 수집이 화면에 섰다(부분 실패 포함 — failedMonths가 그 목록이다). */
  | { status: "collected"; failedMonths: string[] };

export type UseSearchScopeCollection = {
  /**
   * 수집 완료 달 목록로 캐시를 **소비 시점에 재조립**한 결과. 아직 수집 전(또는 reset 뒤,
   * 아이가 갈린 뒤)이면 null. 캐시가 갈리면(flush 확정 refetch 등) 다음 렌더의 이 값이 새
   * 사실이다 — 동결 스냅숏이 아니다(리뷰 H-2).
   */
  result: SearchScopeCollectionResult<Expense> | null;
  /** 이 수집이 누구의·어떤 검색어의 것인가(리뷰 L-A4·L-A5 — 소비부가 동기 대조한다). */
  collectedFor: { childId: string; searchText: string } | null;
  /** 수집이 도는 동안 true — 화면은 진입 버튼을 잠근다(탭 한 번 = 수집 한 번). */
  collecting: boolean;
  /** 수집 진행(끝난 달 수/전체 달 수). 돌지 않으면 null — 버튼 라벨 "불러오는 중 n/21"의 입력. */
  progress: { done: number; total: number } | null;
  /** 달 목록을 걷는다. searchText는 수집 시점 스냅숏이다(완료 처분의 근거 — 리뷰 L-A5). */
  collect: (months: readonly string[], searchText: string) => Promise<SearchScopeCollectOutcome>;
  /** 수집물 폐기(검색어 삭제 등). 진행 중이던 수집의 완료도 함께 버려진다. */
  reset: () => void;
};

type SearchScopeCollectionState = {
  childId: string;
  searchText: string;
  /** ensureQueryData가 성공해 캐시에 실재하는 달들(최신 달부터 — 걷는 방향 그대로). */
  months: string[];
  failedMonths: string[];
};

export function useSearchScopeCollection(input: {
  authToken: string | null;
  childId: string | null;
}): UseSearchScopeCollection {
  const { authToken, childId } = input;
  const queryClient = useQueryClient();
  const [collection, setCollection] = useState<SearchScopeCollectionState | null>(null);
  const [collecting, setCollecting] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  // 수집 회차 — reset이 올리면 진행 중이던 수집의 완료가 버려진다.
  const runRef = useRef(0);
  // 겹침 잠금은 state가 아니라 ref로 본다 — 같은 프레임의 연타가 state 반영 전에 들어온다.
  const collectingRef = useRef(false);

  const reset = useCallback(() => {
    runRef.current += 1;
    collectingRef.current = false;
    setCollection(null);
    setCollecting(false);
    setProgress(null);
  }, []);

  // 아이가 바뀌면 수집물은 이전 아이의 것이다 — 검색어와 무관하게 버린다.
  useEffect(() => {
    reset();
  }, [childId, reset]);

  const collect = useCallback(
    async (months: readonly string[], searchText: string): Promise<SearchScopeCollectOutcome> => {
      if (!authToken || !childId || months.length === 0) return { status: "discarded" };
      if (collectingRef.current) return { status: "discarded" };
      const run = runRef.current + 1;
      runRef.current = run;
      collectingRef.current = true;
      setCollecting(true);
      setProgress({ done: 0, total: months.length });
      const collected = await collectSearchScopeMonths<Expense>(
        months,
        (yearMonth) =>
          queryClient.ensureQueryData({
            queryKey: ["expenses", childId, yearMonth],
            queryFn: () => fetchMonthExpenses((page) => listExpenses(authToken, childId, yearMonth, page)),
            // 리뷰 M-A2 → 라운드 104(두 시점): 종전 근거는 "직렬 21개월 루프"였고, 지금은
            // "동시성 4가 재시도까지 곱한다"다 — 어느 쪽이든 달당 재시도는 한 번이고 그 뒤의
            // 실패는 failedMonths로 남아 부분 실패 고지 + [다시 시도] 몫이다(머리말 참고).
            retry: 1
          }),
        (done, total) => {
          if (runRef.current === run) setProgress({ done, total });
        }
      );
      // 그 사이 reset(아이 전환·검색어 삭제)이 왔으면 이 완료는 낡은 것이다.
      if (runRef.current !== run) return { status: "discarded" };
      collectingRef.current = false;
      setCollecting(false);
      setProgress(null);
      // 리뷰 M-2: 불러온 달이 0이면 스코프를 세우지 않는다 — 빈 "전체"는 사실이 아니다.
      if (collected.months.length === 0) {
        return { status: "all-failed", failedMonths: collected.failedMonths };
      }
      setCollection({
        // 리뷰 L-A4·L-A5: 수집물에 수집 시점의 아이·검색어를 태깅한다 — 소비부(result의 동기
        // 대조·화면의 완료 처분)가 "지금의 질문"과 같은지 값으로 댄다.
        childId,
        searchText,
        months: collected.months.map((month) => month.yearMonth),
        failedMonths: collected.failedMonths
      });
      return { status: "collected", failedMonths: collected.failedMonths };
    },
    [authToken, childId, queryClient]
  );

  /**
   * 수집 완료 달들의 **활성 구독**(리뷰 H-2 — 머리말의 실측 근거 참고). 수집 전에는 빈 목록이라
   * 첫 페인트 요청 0건 그대로이고, 수집 직후에는 방금 ensureQueryData가 채운 신선한 캐시 위에
   * 관찰자만 붙는다(refetch 없음). 전체 스코프를 보는 동안 지출 쓰기·flush 확정이 ["expenses"]를
   * 무효화하면 이 구독이 그 달들을 active로 세워 둔 덕에 실제 refetch가 돌고, 아래 result가
   * 다음 렌더에 새 캐시를 읽는다 — 삭제 행 부활을 막는 갱신 경로가 바로 이것이다.
   */
  const monthQueries = useQueries({
    queries: (collection?.months ?? []).map((yearMonth) => ({
      queryKey: ["expenses", collection?.childId, yearMonth],
      enabled: Boolean(authToken && collection),
      queryFn: () =>
        fetchMonthExpenses((page) => listExpenses(authToken as string, collection?.childId as string, yearMonth, page))
    }))
  });
  // 달 캐시 중 하나라도 새 데이터를 받으면 바뀌는 값 — result 재조립의 캐시 신선도 열쇠다.
  const monthDataStamp = monthQueries.reduce((sum, query) => sum + query.dataUpdatedAt, 0);

  const result = useMemo(() => {
    if (!collection) return null;
    // 리뷰 L-A4: reset effect(비동기)가 돌기 전의 렌더에서도 이전 아이의 수집물이 서지 않게
    // **동기**로 대조한다 — 태그가 지금의 아이와 다르면 그 수집물은 없는 것이다.
    if (collection.childId !== childId) return null;
    return rebuildSearchScopeResult<Expense>(collection.months, collection.failedMonths, (yearMonth) =>
      queryClient.getQueryData<{ expenses: Expense[] }>(["expenses", collection.childId, yearMonth])
    );
    // monthDataStamp는 몸에서 읽지 않지만 의존성에 둔다 — 캐시가 갈린 렌더에서 재조립을 깨우는
    // 신선도 열쇠다(위 useQueries 주석).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collection, childId, queryClient, monthDataStamp]);

  const collectedFor = useMemo(
    () => (collection && collection.childId === childId ? { childId: collection.childId, searchText: collection.searchText } : null),
    [collection, childId]
  );

  return { result, collectedFor, collecting, progress, collect, reset };
}
