import { useEffect, useRef, useState } from "react";

import { getCategoryReport, type CategoryReport } from "../api/client";
import {
  buildCategoryTrendView,
  buildCategoryTrendWindow,
  planCategoryTrendMonthReads,
  type CategoryTrendMemo,
  type CategoryTrendMonthInput,
  type CategoryTrendView
} from "./category-trend";

/**
 * 기능 라운드 1 트랙 C — 카테고리 월 추이의 **여섯 달 읽기 훅**(판정은 전부 category-trend.ts).
 *
 * ## 왜 react-query 구독이 아니라 직접 fetch인가 — 조회 표면이 세 계약으로 잠겨 있다
 * 이 기능의 자연스러운 모양은 "여섯 달을 `useQueries`로, 기존 `["report","category",…]` 키로"
 * 였다(설계 문서 트랙 C 절). 그런데 저장소의 캐시·조회 스윕 셋이 그 길을 전부 잠근다:
 *  - 리포트 화면 소스에는 `useQueries(`가 금지고 react-query import 한 줄·`useQuery({` 선언
 *    수·`getCategoryReport(` 호출부 1곳이 고정이다(real-session-data-integrity GAP-067 ·
 *    home-payload-consumers 첫 페인트 대장 · period-insight 계약).
 *  - 둘째 파일이 `["report", …` 리터럴 키를 켜면 "report"가 공유 키가 되어 정책 대장 세 곳이
 *    움직여야 하고(shared-cache-policy ⓑ·ⓐ·ⓕ), **리터럴이 아닌 queryKey 선언도 전수 대장**에
 *    이름이 있어야 한다(같은 파일 ⓔ — 사각을 막는 그물이라 우회가 없다).
 * 그 대장들은 이번 라운드 전 트랙 비접촉이다. 스윕이 막는 병(첫 페인트 증가·워터폴 부활·
 * 대장 밖 공유 키)은 이 기능에 없지만, 규율은 스윕 쪽이 진다 — 그래서 react-query 캐시를
 * 늘리지 않고 이 훅이 다섯 달을 직접 읽는다.
 *
 * ## 요청 모양 — 폭주 없음, 신선도는 기존 조회에 묶는다
 * - **온디맨드**: 칩을 골랐을 때만 읽는다. 첫 페인트·기간 이동·세그먼트 전환의 요청 구성은
 *   종전과 바이트 단위로 같다(대장들이 그 사실을 계속 문다).
 * - **보고 있는 달은 다시 읽지 않는다**: 화면이 이미 켜 둔 activeCategory 조회의 응답을 그대로
 *   받아 마지막 막대로 쓴다(여섯 달 = 직접 읽기 5 + 기존 조회 1). 그 조회는 당겨서 새로고침·
 *   아이 전환·지출 쓰기 경로가 이미 무효화한다.
 * - **과거 다섯 달은 병렬로 한 번씩** 읽고 (childId, yearMonth) 단위로 메모한다. 카테고리를
 *   바꿔도 재요청이 0건이다 — 응답이 전 카테고리 분해라 필터는 순수 모듈이 한다.
 * - **신선도 신호**: 메모는 activeCategory의 `dataUpdatedAt`(refreshSignal)이 바뀌면 통째로
 *   버린다. 지출을 적거나 당겨서 새로고침하면 그 조회가 다시 오므로, 차트가 열려 있는 동안
 *   과거 달도 낡은 채 남지 않는다(백데이트 수정·가져오기가 과거 달을 바꿀 수 있다). 달 이동도
 *   신호를 바꿔 다섯 달을 다시 읽는데, 이는 캐시 절약보다 정직(낡은 막대 금지)을 고른 값이다.
 *   ⚠️ 리뷰 M-5(두 시점): 종전 서술은 "달을 옮기는 경로에서만 요청 5"라고 적었지만 실동작은
 *   **10**이었다 — 새 달의 기존 조회가 새 키라 신호가 0에서 시작하고, 종전 판정이 그 0으로
 *   메모를 비우며 곧장 다섯을 쏜 뒤 응답이 신호를 정착시키면 같은 다섯을 다시 쐈다. 이제
 *   발사 판정은 순수 모듈(planCategoryTrendMonthReads — category-trend.ts)이 지고, 신호 0에는
 *   클리어만 하고 발사를 유예해 **요청 5가 보장**된다(그 함수 머리말·category-trend.test.ts의
 *   시퀀스 계약 참고).
 *
 * 로컬 데모 백엔드는 임의 yearMonth를 이미 지원한다(local-backend getCategoryReport — REP-104 ·
 * 신규 엔드포인트 0). 이 훅은 지출을 쓰지 않는 읽기 전용이다.
 */
export type CategoryTrendSubscription = {
  /** 카드가 그릴 것 — 카테고리를 고르지 않았으면 null(카드가 판정 자체를 그리지 않는다). */
  view: CategoryTrendView | null;
  /** 다시 읽는 중 표시(재시도 버튼 비활성) — 다섯 중 하나라도 나가 있는 동안 참. */
  isRefetching: boolean;
  /** 부분 실패의 재시도 — **실패한 달만** 다시 읽는다(성공해 둔 메모를 버릴 이유가 없다). */
  retryFailedMonths: () => void;
};

export function useCategoryTrend(input: {
  authToken: string | null;
  childId: string | null;
  /** 월간 탭인가 — 창은 "보고 있는 달로 끝나는 6개월"이라 분기·연간에는 성립하지 않는다. */
  enabled: boolean;
  /** 보고 있는 달("YYYY-MM") — 창의 마지막 달. */
  endYearMonth: string;
  /** 고른 카테고리(칩). null이면 읽기가 아예 켜지지 않는다(온디맨드). */
  category: { categoryId: string; label: string } | null;
  /** 보고 있는 달의 기존 조회 상태 — 화면의 activeCategory를 그대로 접어 넘긴다. */
  currentMonth: { status: "pending" | "success" | "error"; categories?: CategoryReport["categories"] };
  /** 신선도 신호 — activeCategory의 dataUpdatedAt. 바뀌면 과거 달 메모를 버린다(위 머리말). */
  refreshSignal: number;
}): CategoryTrendSubscription {
  const { authToken, childId, enabled, endYearMonth, category, currentMonth, refreshSignal } = input;
  const active = Boolean(enabled && category && authToken && childId);
  const window = active ? buildCategoryTrendWindow(endYearMonth) : null;

  // (childId, yearMonth) → 상태. ref에 두고 도착만 tick으로 알린다 — 재렌더마다 Map을 다시
  // 만들지 않고, 실패한 달만 골라 다시 읽을 수 있다.
  const storeRef = useRef<CategoryTrendMemo>({
    signal: Number.NaN,
    childId: null,
    months: new Map()
  });
  const [, setTick] = useState(0);
  const [retryNonce, setRetryNonce] = useState(0);

  useEffect(() => {
    if (!active || !authToken || !childId) return;
    // 렌더마다 새 배열인 바깥 window를 deps에 두지 않고, 같은 입력에서 다시 만든다(값 동일).
    const effectWindow = buildCategoryTrendWindow(endYearMonth);
    if (!effectWindow) return;
    const store = storeRef.current;
    // 메모 정리·발사 판정은 순수 모듈 한 벌이다(리뷰 M-5 — planCategoryTrendMonthReads 머리말:
    // 신호/아이 변화의 메모 폐기, 신호 0의 발사 유예, 과거 다섯 달만·없는 달만).
    for (const yearMonth of planCategoryTrendMonthReads(store, { window: effectWindow, childId, refreshSignal })) {
      const expectedSignal = store.signal;
      getCategoryReport(authToken, childId, { yearMonth }).then(
        (report) => {
          const current = storeRef.current;
          // 그 사이 신호/아이가 바뀌었으면 낡은 응답을 버린다(새 메모가 다시 읽는다).
          if (current.signal !== expectedSignal || current.childId !== childId) return;
          current.months.set(yearMonth, { status: "success", categories: report.categories });
          setTick((value) => value + 1);
        },
        () => {
          const current = storeRef.current;
          if (current.signal !== expectedSignal || current.childId !== childId) return;
          current.months.set(yearMonth, { status: "error" });
          setTick((value) => value + 1);
        }
      );
    }
  }, [active, authToken, childId, endYearMonth, refreshSignal, retryNonce]);

  const monthStates: CategoryTrendMonthInput[] = (window ?? []).map((yearMonth, index) => {
    if (index === window!.length - 1) {
      return { yearMonth, status: currentMonth.status, categories: currentMonth.categories };
    }
    const state =
      storeRef.current.childId === childId ? storeRef.current.months.get(yearMonth) : undefined;
    return { yearMonth, status: state?.status ?? "pending", categories: state?.categories };
  });

  const view =
    category && window
      ? buildCategoryTrendView({
          categoryId: category.categoryId,
          categoryLabel: category.label,
          months: monthStates
        })
      : null;

  return {
    view,
    isRefetching: monthStates.some((month) => month.status === "pending"),
    retryFailedMonths: () => {
      const store = storeRef.current;
      for (const [yearMonth, state] of store.months) {
        if (state.status === "error") store.months.delete(yearMonth);
      }
      // 지운 달만 위 효과가 다시 읽는다(effect deps의 retryNonce).
      setRetryNonce((value) => value + 1);
    }
  };
}
