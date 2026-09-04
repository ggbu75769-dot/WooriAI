import { formatKrw } from "../money";

/**
 * 기능 라운드 1 트랙 C — **카테고리별 월 추이**(리포트 탭)의 판정·문구 순수 모듈.
 *
 * ## 무엇을 더하나
 * 카테고리 비중 카드는 **한 기간의 스냅샷**만 말한다 — "기저귀가 달마다 어떻게 변했나"는
 * 화면 어디에도 없었다. 이 모듈은 사용자가 고른 카테고리 하나의 **최근 6개월 월별 지출**
 * (보고 있는 달 포함)을 미니 막대 차트로 그릴 수 있게 창(월 목록)·막대·문구·낭독 문장을
 * 만든다. 화면(app/(tabs)/reports.tsx)은 그리기만 한다.
 *
 * ## 데이터는 어디서 오나 — 새 엔드포인트 0
 * 기존 `getCategoryReport(childId, { yearMonth })`를 창의 여섯 달에 대해 `useQueries`로
 * **탭했을 때만** 병렬 발사한다(리포트 진입 비용 0 유지 — REP-128이 이 파일에서 없앤
 * 워터폴을 재도입하지 않는다). queryKey는 기존 `["report","category",childId,{yearMonth}]`
 * 꼴 그대로라 월간 탭 카테고리 카드와 캐시를 공유하고, 로컬 데모 백엔드도 임의 yearMonth를
 * 이미 지원한다(local-backend getCategoryReport — REP-104).
 *
 * ## 이 모듈이 지는 규칙 (라운드 85 차트 낭독 관례를 따른다 — trend-point-labels.ts)
 * - **시각 전용 정보 금지.** 막대가 말하는 달·금액 전부가 낭독 한 문장에 들어간다.
 *   낭독은 "달 + 금액"의 되풀이이고 델타·평가·예측은 넣지 않는다(DNC-018).
 * - **부분 차트를 그리지 않는다.** 여섯 달 중 하나라도 실패하면 다섯 달짜리 차트 대신
 *   실패 사실 한 줄을 그린다 — 반쯤 그린 추이는 "그 달에 0원"이라는 거짓 주장이 된다.
 * - **지어내지 않는다.** 달 라벨은 yearMonth에서만 나오고, 형식이 어긋나면 전체를 포기한다.
 * - **기록 0원과 기록 없음을 구분한다.** 그 달에 기록 자체가 없으면 막대는 0으로 그리되
 *   낭독은 "기록 없음"이라 말하고, 보이는 쪽에는 구분 문구 한 줄이 선다.
 * - 금액 표기는 `formatKrw` 하나다(src/money.ts D0 규칙 — 새 표기 규칙 0건).
 *
 * ## 하지 않는 것
 * 추이 점 → 기록 드릴다운(기존 드릴다운은 기간 카드 소유 — 후속) · 카테고리 다중 비교.
 * `category-share.ts`·`category-drilldown.ts`는 비접촉이다 — 비중·드릴다운 판정은 그대로고
 * 추이는 이 별도 모듈이 진다.
 *
 * 순수 모듈인 이유: 리포트 탭은 vitest에서 렌더되지 않는다(react-native 네이티브 바인딩
 * 없음) — 이 저장소의 확립된 규율 그대로, 판정·문구는 여기서 단위 테스트한다.
 */

const YEAR_MONTH_PATTERN = /^\d{4}-\d{2}$/;

/** 추이 창의 크기(보고 있는 달 포함). 월간 탭 총액 추이(MONTHLY_TREND_MONTHS)와 같은 6이다. */
export const CATEGORY_TREND_MONTH_COUNT = 6;

/** 섹션 제목(카테고리 비중 카드 아래 자기 카드). */
export const CATEGORY_TREND_SECTION_TITLE = "카테고리 월 추이";
/** 칩을 고르기 전의 안내 한 줄(DNC-018 해요체). */
export const CATEGORY_TREND_SECTION_GUIDE = "카테고리를 고르면 최근 6개월 흐름을 보여드려요.";
/** 여섯 달 전부 0원일 때 — 빈 막대 여섯 개 대신 서는 사실 한 줄. */
export const CATEGORY_TREND_EMPTY_TEXT = "최근 6개월 동안 이 카테고리 지출 기록이 없어요.";
/**
 * 기록 자체가 없는 달이 창에 섞였을 때의 구분 문구(0원 막대가 전부 사실은 아니라는 고지).
 *
 * 리뷰 L-4(두 시점): 종전 "기록이 없는 달도 0원으로 그렸어요."는 그렸다는 사실만 말하고 그
 * 막대가 무엇이 **아닌지**는 말하지 않았다 — 기록 없는 0원과 기록 있는 0원이 시각적으로
 * 같으니, 그 구분은 이 문장이 온전히 져야 한다. 시각 구분(빗금·점선)은 차트 스타일 추가
 * 비용이 더 커서 구현 비용이 작은 쪽(문구 강화)을 골랐다 — 낭독의 "기록 없음"과 같은 사실.
 */
export const CATEGORY_TREND_NO_RECORD_NOTE =
  "기록이 없는 달도 0원 막대로 그렸어요. 그 달에 지출이 없었다는 뜻은 아니에요.";

/** 화면 배선·수동 확인용 testID(자리는 화면이, 값은 이 모듈이 소유한다 — 기존 관례). */
export const CATEGORY_TREND_CARD_TEST_ID = "reports-category-trend-card";
export const CATEGORY_TREND_CHART_TEST_ID = "reports-category-trend-chart";

/**
 * "2026-01"로 끝나는 오름차순 `count`개월 창. 연 경계를 넘는 계산은 `Date.UTC`로 한다
 * (iso-week.ts 규율 — 라이브러리 없이, 달력 산술은 UTC 필드로).
 *
 * 형식이 어긋난 endYearMonth는 null — 어긋난 입력으로 창을 지어내지 않는다.
 */
export function buildCategoryTrendWindow(
  endYearMonth: string,
  count: number = CATEGORY_TREND_MONTH_COUNT
): string[] | null {
  if (typeof endYearMonth !== "string" || !YEAR_MONTH_PATTERN.test(endYearMonth)) return null;
  const year = Number(endYearMonth.slice(0, 4));
  const month = Number(endYearMonth.slice(5, 7));
  if (!Number.isInteger(month) || month < 1 || month > 12) return null;
  if (!Number.isInteger(count) || count < 1) return null;

  const window: string[] = [];
  for (let back = count - 1; back >= 0; back -= 1) {
    const date = new Date(Date.UTC(year, month - 1 - back, 1));
    window.push(`${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`);
  }
  return window;
}

export type CategoryTrendChip = {
  categoryId: string;
  label: string;
};

/**
 * 비중 카드가 그리는 조각 배열 → 추이 칩 목록.
 *
 * 비중 계산(computeCategoryShares)이 떨어뜨리는 것과 같은 조각(0원·음수·비정상 금액)을
 * 떨어뜨리고, `categoryId`가 없는 조각도 뺀다 — id 없이는 여섯 달을 물을 수 없다.
 * 순서는 입력 그대로다(비중 카드 범례와 같은 순서로 서게).
 */
export function buildCategoryTrendChips(
  segments: ReadonlyArray<{ label: string; amountKrw: number; categoryId?: string }> | null | undefined
): CategoryTrendChip[] {
  if (!segments) return [];
  const chips: CategoryTrendChip[] = [];
  for (const segment of segments) {
    if (typeof segment.categoryId !== "string" || segment.categoryId.length === 0) continue;
    if (!Number.isFinite(segment.amountKrw) || segment.amountKrw <= 0) continue;
    chips.push({ categoryId: segment.categoryId, label: segment.label });
  }
  return chips;
}

export type CategoryTrendMonthInput = {
  /** 창이 만든 "YYYY-MM"(오름차순, 마지막이 보고 있는 달). */
  yearMonth: string;
  /** 그 달 조회의 상태 — react-query 결과에서 화면이 접어 넘긴다. */
  status: "pending" | "success" | "error";
  /** 성공한 달의 카테고리 분해(getCategoryReport 응답의 categories). */
  categories?: ReadonlyArray<{ categoryId: string; amountKrw: number; count?: number }> | null;
};

export type CategoryTrendBar = {
  yearMonth: string;
  /** "8월" — yearMonth에서만 나온다. */
  monthLabel: string;
  amountKrw: number;
  /** 그 달에 (어느 카테고리든) 기록이 하나라도 있었는가 — 0원 막대의 두 뜻을 가른다. */
  hasRecords: boolean;
  /** 최대 금액 대비 0..1 — 화면은 이 값에 플롯 높이만 곱한다(판정 없음). */
  heightRatio: number;
};

export type CategoryTrendView =
  | { kind: "loading" }
  /**
   * 여섯 달 중 하나라도 실패 — 부분 차트를 그리지 않는다(다섯 달짜리 추이는 "그 달 0원"이라는
   * 거짓 주장이 된다). **문구는 이 모듈이 만들지 않는다**: 실패 문장은 화면의 세 오류 카드와
   * 같은 공용 단일 소스(useLoadErrorCopy)에서 온다 — 모듈 층의 실패 문구는 대장이 전수로
   * 묶여 있고(src/offline/messages.test.ts 라운드 76 A), 한 화면 안 같은 원인의 실패가 서로
   * 다르게 읽히면 안 된다(UX-N · DNC-018 톤 일관성).
   */
  | { kind: "error" }
  | { kind: "empty"; text: string }
  | {
      kind: "ready";
      bars: CategoryTrendBar[];
      /** "2026년 3월~8월 합계 123,000원" — 창이 해를 넘으면 양끝에 해를 다 적는다. */
      summaryText: string;
      /** 기록 없는 달이 섞였을 때만 서는 구분 문구(없으면 null — 화면이 한 줄도 늘지 않는다). */
      emptyMonthNote: string | null;
      /** 차트 한 덩어리의 낭독 문장 — 달·금액 전부(기록 없는 달은 "기록 없음"). */
      accessibilityLabel: string;
    };

/** 과거 달 메모 한 칸 — 훅(use-category-trend.ts)이 (childId, yearMonth) 단위로 든다. */
export type CategoryTrendMonthMemoState = {
  status: "pending" | "success" | "error";
  categories?: CategoryTrendMonthInput["categories"];
};

/** 훅의 과거 달 메모 전체 — 신선도 신호·아이·달별 상태(뮤테이션은 planCategoryTrendMonthReads가 한다). */
export type CategoryTrendMemo = {
  /** 마지막으로 반영한 신선도 신호(activeCategory.dataUpdatedAt). NaN이면 아직 반영 전. */
  signal: number;
  childId: string | null;
  months: Map<string, CategoryTrendMonthMemoState>;
};

/**
 * 효과 한 번의 **발사 판정** — 메모를 신선도에 맞춰 정리하고, 지금 읽어야 할 과거 달 목록을
 * 돌려준다(마지막 달은 언제나 기존 조회의 몫이라 제외). 돌려준 달은 pending으로 표시된다.
 *
 * 리뷰 M-5(두 시점): 종전에는 이 판정이 훅의 effect 안에 인라인이었고, **신호 0을 정착한
 * 신호처럼 다뤘다.** 차트를 연 채 월을 옮기면 새 달의 기존 조회(react-query)가 새 키라
 * `dataUpdatedAt`이 0에서 시작하는데, 종전 판정은 그 0으로 메모를 비우고 곧장 다섯 달을
 * 쏜 뒤 — 응답이 도착해 신호가 실제 값으로 바뀌면 메모를 또 비우고 같은 다섯 달을 다시
 * 쐈다(월 이동 한 번에 요청 10). 이제 **신호 0 = 보고 있는 달의 첫 응답이 아직**이므로
 * 메모만 비우고 발사를 유예한다 — 응답이 신호를 정착시키는 effect 재실행에서 한 번만
 * 다섯을 읽는다(요청 5 보장). 신선도 규율(신호·아이가 바뀌면 통째로 버린다)은 그대로다.
 */
export function planCategoryTrendMonthReads(
  memo: CategoryTrendMemo,
  input: { window: readonly string[]; childId: string; refreshSignal: number }
): string[] {
  // 신호(신선도)나 아이가 바뀌면 메모를 통째로 버린다 — 낡은 막대를 이어 그리지 않는다.
  if (memo.signal !== input.refreshSignal || memo.childId !== input.childId) {
    memo.signal = input.refreshSignal;
    memo.childId = input.childId;
    memo.months = new Map();
  }
  // 신호 0 = 보고 있는 달의 조회가 아직 첫 응답 전(react-query dataUpdatedAt의 초기값) —
  // 지금 쏘면 그 응답이 신호를 바꿔 같은 다섯 달을 곧바로 다시 읽는다(리뷰 M-5의 요청 10).
  // 메모는 위에서 비워 둔 채 발사만 유예한다: 응답이 오면 신호가 정착해 한 번만 읽는다.
  if (input.refreshSignal === 0) return [];
  const reads: string[] = [];
  for (const yearMonth of input.window.slice(0, -1)) {
    if (memo.months.has(yearMonth)) continue;
    memo.months.set(yearMonth, { status: "pending" });
    reads.push(yearMonth);
  }
  return reads;
}

/** "2026-08" → { year: 2026, label: "8월" }. 형식이 어긋나면 null(지어내지 않는다). */
function parseYearMonth(yearMonth: string): { year: number; label: string } | null {
  if (typeof yearMonth !== "string" || !YEAR_MONTH_PATTERN.test(yearMonth)) return null;
  const month = Number(yearMonth.slice(5, 7));
  if (!Number.isInteger(month) || month < 1 || month > 12) return null;
  return { year: Number(yearMonth.slice(0, 4)), label: `${month}월` };
}

/** 창 양끝 라벨. 해가 같으면 "2026년 3월~8월", 다르면 "2025년 11월~2026년 4월". */
function rangeLabelOf(first: { year: number; label: string }, last: { year: number; label: string }): string {
  if (first.year === last.year) return `${first.year}년 ${first.label}~${last.label}`;
  return `${first.year}년 ${first.label}~${last.year}년 ${last.label}`;
}

/**
 * 여섯 달 조회 결과 → 카드가 그릴 것 하나.
 *
 * 우선순위: 실패가 하나라도 있으면 error(부분 차트 금지) → 아직 다 안 왔으면 loading →
 * 전부 0원이면 empty → ready. 금액은 그 달 응답에서 `categoryId`가 일치하는 항목의 합이고
 * (비정상 금액은 더하지 않는다), 항목이 없으면 0원 — 그 달의 정직한 사실이다.
 */
export function buildCategoryTrendView(input: {
  categoryId: string;
  categoryLabel: string;
  months: readonly CategoryTrendMonthInput[];
}): CategoryTrendView {
  const { categoryId, categoryLabel, months } = input;
  if (months.length === 0) return { kind: "loading" };
  if (months.some((month) => month.status === "error")) return { kind: "error" };
  if (months.some((month) => month.status !== "success")) return { kind: "loading" };

  const parsed = months.map((month) => parseYearMonth(month.yearMonth));
  // 한 달이라도 읽을 수 없으면 차트 전체를 포기한다(반쯤 지어낸 축은 없는 축보다 나쁘다 —
  // trend-point-labels.ts와 같은 판정). 창은 이 모듈이 만들므로 실사용에서는 닿지 않는 갈래다.
  if (parsed.some((entry) => entry === null)) return { kind: "error" };

  const amounts = months.map((month) => {
    let sum = 0;
    for (const entry of month.categories ?? []) {
      if (entry.categoryId !== categoryId) continue;
      if (!Number.isFinite(entry.amountKrw) || entry.amountKrw <= 0) continue;
      sum += entry.amountKrw;
    }
    return sum;
  });
  const recorded = months.map((month) =>
    (month.categories ?? []).some(
      (entry) => (Number.isFinite(entry.amountKrw) && entry.amountKrw > 0) || (entry.count ?? 0) > 0
    )
  );

  const maxAmount = Math.max(...amounts);
  if (maxAmount <= 0) return { kind: "empty", text: CATEGORY_TREND_EMPTY_TEXT };

  const bars: CategoryTrendBar[] = months.map((month, index) => ({
    yearMonth: month.yearMonth,
    monthLabel: parsed[index]!.label,
    amountKrw: amounts[index],
    hasRecords: recorded[index],
    heightRatio: amounts[index] / maxAmount
  }));

  const total = amounts.reduce((sum, amount) => sum + amount, 0);
  const rangeLabel = rangeLabelOf(parsed[0]!, parsed[parsed.length - 1]!);
  const hasEmptyMonth = recorded.some((value) => !value);
  // 낭독은 라운드 85 관례 그대로 "달 + 금액"의 되풀이다. 기록 자체가 없는 달은 0원 대신
  // "기록 없음"이라 말해, 보이는 구분 문구와 소리가 같은 사실을 말한다.
  const series = bars
    .map((bar) => (bar.hasRecords ? `${bar.monthLabel} ${formatKrw(bar.amountKrw)}` : `${bar.monthLabel} 기록 없음`))
    .join(", ");

  return {
    kind: "ready",
    bars,
    summaryText: `${rangeLabel} 합계 ${formatKrw(total)}`,
    emptyMonthNote: hasEmptyMonth ? CATEGORY_TREND_NO_RECORD_NOTE : null,
    accessibilityLabel: `${categoryLabel} 월별 추이 차트, ${rangeLabel}, ${series}`
  };
}
