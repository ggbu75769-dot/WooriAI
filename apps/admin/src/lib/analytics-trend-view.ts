// 라운드 86 트랙 D — 운영자 화면 **둘**의 "일별 추이" 카드가 함께 쓰는 순수 표시 로직.
//
// ## 왜 이 모듈이 생겼나
//
// 같은 저장소에 일별 추이 막대가 **두 벌** 있다(분석 `app/analytics/page.tsx` · 클릭 통계
// `app/clicks/page.tsx`). 두 벌의 막대는 글자 하나 다르지 않게 같은 코드였는데, 값을 남기는
// 방식은 갈려 있었다:
//
//  · 클릭 화면은 막대 **아래에 날짜·건수 표**를 함께 그린다 — 값이 텍스트로 남는다.
//  · 분석 화면은 값을 `title` 속성(마우스 호버)에만 줬다 — 키보드·스크린리더·터치에는
//    **어떤 경로로도 그 수에 닿을 수 없었다**. 라운드 85 C가 앱의 추이 차트에 각 점의 이름을
//    돌려준 뒤에도 운영자 도구의 이쪽 절반은 그대로였다.
//
// 그래서 **옳은 형식은 이미 형제 화면에 있었다.** 이 모듈이 하는 일은 그 형식을 새로
// 발명하는 것이 아니라, 두 화면이 **같은 자리에서** 막대 라벨·표 행·최대치 문장을 만들게
// 모으는 것뿐이다. 클릭 화면이 그리는 글자는 이 트랙 전후로 **바이트 단위로 같다** — 그
// 화면에서 바뀌는 것은 *어디서 값을 만드는가*뿐이다.
//
// 화면과 분리해 두는 이유는 `worker-health-view.ts`·`catalog-size-view.ts`와 같다 — 문장이
// 갈리는 자리(전부 0 · 라벨과 막대의 수가 어긋남)를 테스트로 못 박기 위해서다.
//
// ## 이 모듈이 하지 않는 것 (값으로 적어 둔다)
//
//  · **막대의 색·높이·간격 0건.** 그 계산은 화면의 인라인 스타일에 그대로 남는다. 여기로
//    옮기면 두 화면의 픽셀이 이 모듈의 판정에 매이는데, 이 트랙이 고치려는 것은 픽셀이 아니라
//    **값에 닿는 경로**다.
//  · **상호작용 0건.** 막대를 포커스 가능하게 만들거나 툴팁을 새로 세우지 않는다 — 표가
//    이미 그 값을 텍스트로 준다. 새 상호작용 표면은 이 트랙의 값이 아니다.
//  · **서버 0건.** `dailyTotals`는 두 요약 API가 이미 내려주는 배열이고, 새 파라미터·집계는
//    없다. 이 모듈은 그 배열을 읽기만 한다.
//  · **모바일과의 공유 0건.** `apps/mobile/src/reports/trend-point-labels.ts`가 형식이
//    비슷하지만 **축이 다르다**(그쪽은 달, 이쪽은 날짜). 옮겨 쓰지 않는다.

/** 요약 API 둘이 공통으로 내려주는 추이 한 점(`dailyTotals`의 원소). */
export type TrendPoint = {
  /** 서울 기준 날짜(`YYYY-MM-DD`). 서버가 만든 문자열을 그대로 쓴다. */
  date: string;
  count: number;
};

/**
 * 수 뒤에 붙는 단위. 두 화면이 세는 것이 다르다 — 분석은 이벤트(건), 클릭 통계는 클릭(회).
 * 닫힌 유니온이라 새 화면이 붙을 때 이 자리가 먼저 갈린다.
 */
export type TrendCountUnit = "건" | "회";

/** 막대 하나. `label`이 종전 `title` 속성의 문자열과 **바이트 단위로 같다**. */
export type TrendBar = {
  date: string;
  count: number;
  label: string;
};

/** 표의 한 행. 최근 날짜가 위로 온다. */
export type TrendTableRow = {
  date: string;
  countText: string;
};

/** 기간 안의 최대치. 값이 전부 0이면 이 값 자체가 없다(`null`). */
export type TrendPeak = {
  /** 최대치인 날 중 **가장 이른** 날. */
  date: string;
  count: number;
  /** 같은 최대치인 날의 수(1이면 유일). */
  tiedDays: number;
};

/** 추이 카드 한 장이 그리는 것 전부. */
export type AnalyticsTrendView = {
  /** 막대 전수 — 입력과 **같은 수·같은 순서**다(막대는 시간순 그대로). */
  bars: TrendBar[];
  /** 표의 행. 표를 그릴 수 없을 때는 비어 있다. */
  rows: TrendTableRow[];
  /** 표를 그려도 되는가 — 행 수가 막대 수와 같을 때만. */
  showTable: boolean;
  peak: TrendPeak | null;
  /** 최대치 문장. 값이 전부 0이면 `null`(지어내지 않는다). */
  peakSentence: string | null;
};

/**
 * 이 모듈에서 **수를 글자로 만드는 유일한 자리**.
 *
 * 두 화면이 각자 한국어 로케일 표기를 적고 있었고, 그래서 천 단위 구분이 한쪽에서만 빠지는
 * 일이 언제든 가능했다. 표기 규칙을 새로 만들지 않고(종전과 같은 한 줄) 자리만 하나로
 * 모은다 — 이 파일에서 수를 글자로 바꾸는 호출은 **아래 한 줄뿐**이다.
 */
export function formatTrendCount(count: number, unit: TrendCountUnit): string {
  return `${count.toLocaleString("ko-KR")}${unit}`;
}

/**
 * 표에 세울 수 있는 점인가.
 *
 * 타입은 `date: string`·`count: number`라고 말하지만 이 값은 **네트워크에서 온다**. 날짜가
 * 비었거나 수가 수가 아닌 점을 표에 한 줄로 세우면 화면이 없는 사실을 지어낸다 — 그런 점은
 * 표에서 뺀다(그리고 그 순간 행 수가 막대 수와 어긋나 표 자체가 서지 않는다. 아래
 * `analyticsTrendView` 참고).
 */
function isRenderablePoint(point: TrendPoint): boolean {
  return (
    typeof point?.date === "string" &&
    point.date.trim().length > 0 &&
    typeof point.count === "number" &&
    Number.isFinite(point.count)
  );
}

/**
 * 막대 하나에 붙는 라벨(종전 `title` 속성). 형식은 두 화면이 쓰던 것 그대로다:
 * `2026-08-17: 12건`.
 */
export function trendBarLabel(point: TrendPoint, unit: TrendCountUnit): string {
  return `${point.date}: ${formatTrendCount(point.count, unit)}`;
}

/**
 * 막대 전수. **거르지 않는다** — 막대는 입력과 같은 수·같은 순서여야 기간의 모양이 그대로
 * 보이고, 그 픽셀은 이 트랙이 손대지 않기로 한 자리다.
 */
export function trendBars(points: TrendPoint[], unit: TrendCountUnit): TrendBar[] {
  return points.map((point) => ({ date: point.date, count: point.count, label: trendBarLabel(point, unit) }));
}

/**
 * 표의 행. **최근 날짜가 위로 오게 뒤집는다**(막대는 시간순 그대로다 — 운영자가 먼저 보고 싶은
 * 것은 어제·오늘이라 클릭 화면이 처음부터 이 순서였고, 분석 화면도 같은 순서를 물려받는다).
 */
export function trendTableRows(points: TrendPoint[], unit: TrendCountUnit): TrendTableRow[] {
  return [...points]
    .reverse()
    .filter(isRenderablePoint)
    .map((point) => ({ date: point.date, countText: formatTrendCount(point.count, unit) }));
}

/**
 * 기간 안의 최대치. **전부 0이면 `null`** — 0이 최대인 기간에 "가장 많은 날"을 지목하면
 * 아무 일도 없던 날 하나가 봉우리로 읽힌다. 음수(있을 수 없지만 응답이 그렇게 오면)도 같다.
 */
export function trendPeak(points: TrendPoint[]): TrendPeak | null {
  const usable = points.filter(isRenderablePoint);
  if (usable.length === 0) return null;
  const max = Math.max(...usable.map((point) => point.count));
  if (max <= 0) return null;
  const tied = usable.filter((point) => point.count === max);
  return { date: tied[0].date, count: max, tiedDays: tied.length };
}

/**
 * 최대치 한 줄. 없으면 `null`(문장 자체를 붙이지 않는다).
 *
 * 같은 최대치인 날이 여럿이면 **그 사실을 적는다** — 그중 하나만 골라 "가장 많은 날은 X"라고
 * 적으면 나머지 날이 사라진다.
 */
export function trendPeakSentence(points: TrendPoint[], unit: TrendCountUnit): string | null {
  const peak = trendPeak(points);
  if (!peak) return null;
  const countText = formatTrendCount(peak.count, unit);
  if (peak.tiedDays > 1) {
    return `가장 많은 날이 ${peak.tiedDays}일 있어요 (각 ${countText}, 가장 이른 날은 ${peak.date}).`;
  }
  return `가장 많은 날은 ${peak.date} 하루예요 (${countText}).`;
}

/**
 * 추이 카드 한 장의 파생 전부.
 *
 * `showTable`이 하는 일: 행 수와 막대 수가 어긋나면 표를 세우지 않는다. 어긋나는 경우는 위
 * `isRenderablePoint`가 거른 점이 있을 때뿐인데, 그때 표를 그대로 그리면 **막대는 N개인데
 * 표는 N-1줄**이라 운영자가 둘을 나란히 읽다가 없는 날을 있다고 믿게 된다. 반쯤 맞는 표보다
 * 표가 없는 편이 낫다(그때도 막대와 라벨은 종전 그대로 남는다).
 */
export function analyticsTrendView(points: TrendPoint[], unit: TrendCountUnit): AnalyticsTrendView {
  const bars = trendBars(points, unit);
  const rows = trendTableRows(points, unit);
  const showTable = rows.length === bars.length;
  return {
    bars,
    rows: showTable ? rows : [],
    showTable,
    peak: trendPeak(points),
    peakSentence: trendPeakSentence(points, unit)
  };
}
