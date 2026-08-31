import { formatKrw } from "../money";

/**
 * 라운드 85 트랙 C: 추이 차트가 **어느 달의 얼마인지** 말하게 하는 순수 모듈.
 *
 * ## 무엇이 문제였나
 * 서버의 추이 응답은 달마다 `{ yearMonth, totalExpenseKrw }` **둘**을 준다
 * (`TrendReport.months` · `YearlyReport.monthlyTotals` — src/api/client.ts). 그런데 화면
 * (app/(tabs)/reports.tsx)은 `totalExpenseKrw`만 뽑아 `number[]`로 접어 카드에 넘겼고,
 * `yearMonth`는 그 자리에서 버려졌다. 그래서 차트에는
 *
 * - **x축 라벨이 0건**이었다 — 점 여섯 개가 어느 달인지 그림 어디에도 적혀 있지 않았다.
 * - **낭독에도 계열이 0건**이었다 — TalkBack은 "총 지출 추이 차트, 합계 …"까지만 읽고
 *   멈췄다. 접근성 체크리스트 13행의 "추세를 문장으로 듣는다"는 그만큼 과장이었다.
 *
 * 데이터는 이미 응답 안에 있었다. 새 요청도, 새 집계도 필요 없다 — 버리지만 않으면 된다.
 *
 * ## 이 모듈이 지는 규칙
 * - **라벨은 `yearMonth`에서만 나온다.** 인덱스로 "1월, 2월 …"을 지어내지 않는다. 형식이
 *   어긋난 달이 하나라도 있으면 **전체를 포기한다**(반쯤 지어낸 축은 없는 축보다 나쁘다).
 * - **라벨 수 ≠ 점 수면 그리지 않는다.** 분기·연간은 라운드 52 C-02가 미래 달을 잘라 내므로
 *   (src/reports/period-trend-points.ts) 잘린 뒤의 점과 라벨이 어긋날 수 있다. 어긋나면
 *   그리지 않는 쪽이 정직하다 — 8월 점 위에 12월이라 적힌 축은 허위 표시다.
 * - **금액 표기는 `formatKrw` 하나**다(src/money.ts의 D0 규칙 — 새 표기 규칙 0건).
 *
 * 순수 모듈인 이유: 리포트 탭과 `src/ui.tsx`는 vitest에서 렌더되지 않는다(react-native
 * 네이티브 바인딩 없음). 월간·분기·연간 **세 갈래가 같은 이 모듈**을 지난다.
 */

const YEAR_MONTH_PATTERN = /^\d{4}-\d{2}$/;

export type TrendPointLabels = {
  /**
   * x축에 점 순서대로 그릴 달 라벨("8월"). 만들 수 없으면 null이고, 그때 카드는 축을
   * **그리지 않는다**(종전 렌더 그대로).
   */
  labels: string[] | null;
  /**
   * 낭독 라벨 뒤에 이어 붙일 계열 한 조각("3월 120,000원, 4월 98,000원, …").
   * `labels`가 null이면 이것도 null이다.
   */
  accessibilitySeries: string | null;
};

/** 라벨을 만들 수 없을 때의 값. 카드가 이 값을 받으면 종전과 한 픽셀도 다르지 않게 그린다. */
export const EMPTY_TREND_POINT_LABELS: TrendPointLabels = { labels: null, accessibilitySeries: null };

/** "2026-08" → "8월". 형식이 어긋나면 null(지어내지 않는다). */
function monthLabelOf(yearMonth: string): string | null {
  if (typeof yearMonth !== "string" || !YEAR_MONTH_PATTERN.test(yearMonth)) return null;
  const month = Number(yearMonth.slice(5, 7));
  if (!Number.isInteger(month) || month < 1 || month > 12) return null;
  return `${month}월`;
}

export type TrendPointLabelsInput = {
  /**
   * 차트가 그리는 점과 **같은 순서·같은 개수**의 "YYYY-MM" 목록. 아직 못 받았거나(로딩·실패·
   * 비세션) 화면이 자른 뒤의 목록을 만들 수 없으면 null/undefined.
   */
  yearMonths: readonly string[] | null | undefined;
  /** 차트가 실제로 그리는 값들(자른 뒤). 카드에 넘기지 않는 경우와 같은 조건으로 비운다. */
  points: readonly number[] | null | undefined;
};

/**
 * 추이 차트의 달 라벨과 낭독 계열을 만든다.
 *
 * 입력이 없거나 라벨과 점이 1:1로 맞지 않으면 두 값 모두 null이라, 호출부는 종전과 똑같이
 * 동작한다(점 2개 미만 갈래·비세션 갈래는 애초에 여기까지 오지 않는다).
 */
export function buildTrendPointLabels(input: TrendPointLabelsInput): TrendPointLabels {
  const { yearMonths, points } = input;
  if (!yearMonths || !points) return EMPTY_TREND_POINT_LABELS;
  // 점이 없으면 라벨도 없다. 그리고 수가 다르면 **어느 쪽도** 그리지 않는다 — 짝이 맞지 않는
  // 축은 어느 점이 어느 달인지 틀리게 말한다(C-02가 잘라 낸 미래 달이 정확히 이 자리다).
  if (points.length === 0 || yearMonths.length !== points.length) return EMPTY_TREND_POINT_LABELS;

  const labels: string[] = [];
  for (const yearMonth of yearMonths) {
    const label = monthLabelOf(yearMonth);
    // 한 달이라도 읽을 수 없으면 축 전체를 포기한다(부분 축은 나머지 점의 달을 틀리게 만든다).
    if (label === null) return EMPTY_TREND_POINT_LABELS;
    labels.push(label);
  }

  return {
    labels,
    // 낭독은 "달 + 금액"의 되풀이다. 델타·평가·예측은 여기에 들어가지 않는다(DNC-018).
    accessibilitySeries: labels.map((label, index) => `${label} ${formatKrw(points[index])}`).join(", ")
  };
}
