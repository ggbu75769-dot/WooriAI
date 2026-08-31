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
// 모으는 것뿐이다. **라운드 86 트랙 D 당시** 그 사실은 이렇게 적혀 있었다: *"⚠️ 정상 응답에서
// 클릭 화면이 그리는 글자는 이 트랙 전후로 **바이트 단위로 같다** — 그 화면에서 바뀌는 것은
// 어디서 값을 만드는가뿐이다."*
//
// ⚠️ **라운드 86 리뷰 M-2가 그 문장을 좁혔다**: 응답에 그릴 수 없는 점이 섞인 **비정상
// 응답**에서는 두 화면에 고지 한 줄(`omissionNotice`)이 더 선다. 그 한 줄이 없으면 표가
// 조용히 짧아지거나(반쯤 맞는 표) 조용히 사라져(침묵) 둘 중 하나가 운영자를 속인다 —
// 바이트 불변은 *정상 응답*의 약속이지 *모든 응답*의 약속이 아니다.
//
// ⚠️⚠️ **두 시점 — 라운드 88 트랙 A 이후 그 약속은 클릭 화면에 대해 더 이상 참이 아니다**
// (라운드 88 리뷰 M-1이 정정한 자리). 트랙 A가 그 화면에 **최대치 한 줄**(`trend.peakSentence`)과
// **`trend.showTable` 갈래 각주**를 세우면서, 값이 있는 **정상 응답**에서도 종전에 없던 줄이 서고
// 각주 문구 자체가 갈렸다(표 이름 `aria-label`도 함께 붙었다). 오늘 클릭 화면에서 바이트 불변으로
// 남는 것은 **표 머리 두 칸 · 카드 제목 · DNC-009 고지 한 줄 · 막대의 색·높이·간격 식**이다 —
// 그 목록이 `analytics-trend-view.test.ts`의 ⓑ절이 오늘 실제로 무는 것이고, 각주·최대치 한 줄·
// 표 이름은 그 절이 아니라 **두 화면 공통 루프**(`TREND_SCREENS`)가 문다.
// ⚠️ 이 모듈 자신은 트랙 A에서 바이트 불변이었다 — 바뀐 것은 화면이고, 이 서술이 늦게 따라왔다.
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

/**
 * 막대 하나. 그릴 수 있는 점의 `label`은 종전 `title` 속성의 문자열과 **바이트 단위로 같다**.
 * 그릴 수 없는 점은 수를 지어내지 않고 `UNRENDERABLE_COUNT_TEXT`로 말한다(아래 `trendBarLabel`).
 */
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
  /** 표의 행 — **그릴 수 있는 점만**. 걸러진 점이 있으면 아래 고지가 그 사실을 말한다. */
  rows: TrendTableRow[];
  /** 표를 세우는가 — 그릴 줄이 하나라도 있거나, 기간 자체가 비어 있을 때. */
  showTable: boolean;
  /** 표에서 뺀 점의 수(0이면 정상 응답). */
  omittedPoints: number;
  /** 뺀 점이 있을 때만 서는 고지 한 줄. 없으면 `null`(정상 응답에서는 새 글자 0건). */
  omissionNotice: string | null;
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
 * 그릴 수 있는 점인가 — **이 모듈에서 그 판정을 내리는 유일한 자리**.
 *
 * 타입은 `date: string`·`count: number`라고 말하지만 이 값은 **네트워크에서 온다**. 날짜가
 * 비었거나 수가 수가 아닌 점을 표에 한 줄로 세우면 화면이 없는 사실을 지어낸다 — 그런 점은
 * 표에서 빼고(아래 `trendTableRows`), 그 사실을 고지 한 줄로 말한다(`analyticsTrendView`).
 *
 * ⚠️ **라운드 86 리뷰 M-1**: 종전에는 이 술어가 표에만 걸렸고 **막대 라벨은 무방비**였다.
 * `count`가 `null`인 응답 한 점이면 `toLocaleString`이 던지고, 그 예외는 화면 하나가 아니라
 * **카드가 선 페이지 전체**를 오류 경계로 떨어뜨린다(종전 화면의 인라인 식도 같은 자리에서
 * 던졌으므로 이 트랙이 만든 결함은 아니지만, 판정을 한 자리로 모은 모듈이 그 자리를 그대로
 * 물려받을 이유는 없다). 그래서 막대 라벨도 **같은 술어**를 지난다 — 위협 모델이 하나면
 * 그것을 막는 술어도 하나여야 한다.
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
 * 그릴 수 없는 점의 라벨이 수 대신 말하는 것. **수를 지어내지 않는다** — `0건`으로 적으면
 * 아무 일도 없던 날이 되고, 원문을 그대로 흘리면 `null건`이 화면에 뜬다.
 */
export const UNRENDERABLE_COUNT_TEXT = "값 없음";

/**
 * 막대 하나에 붙는 라벨(종전 `title` 속성). 형식은 두 화면이 쓰던 것 그대로다:
 * `2026-08-17: 12건`.
 *
 * ⚠️ 그릴 수 없는 점(리뷰 M-1)에서는 **던지지 않고** 날짜만 남긴다 — 라벨 하나를 위해 카드가
 * 선 페이지 전체를 잃지 않는다. 날짜조차 없으면 `값 없음` 한 낱말이다.
 */
export function trendBarLabel(point: TrendPoint, unit: TrendCountUnit): string {
  if (!isRenderablePoint(point)) {
    const date = typeof point?.date === "string" ? point.date.trim() : "";
    return date ? `${date}: ${UNRENDERABLE_COUNT_TEXT}` : UNRENDERABLE_COUNT_TEXT;
  }
  return `${point.date}: ${formatTrendCount(point.count, unit)}`;
}

/**
 * 막대 전수. **점을 거르지 않는다** — 막대는 입력과 같은 수·같은 순서여야 기간의 모양이 그대로
 * 보이고, 그 픽셀은 이 트랙이 손대지 않기로 한 자리다. 거르는 대신 **라벨만** 위 폴백으로
 * 간다(수·색·높이의 원본 값은 화면이 종전대로 읽는다 — 이 모듈은 픽셀을 만들지 않는다).
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
 * 표에서 뺀 점이 있을 때 그 사실을 말하는 한 줄. 없으면 `null`.
 *
 * 수를 함께 적는 이유: 운영자가 막대와 표를 **나란히** 읽기 때문이다. "일부를 못 보여 준다"만
 * 적고 수를 감추면 어느 쪽이 짧은지 세어 보게 되고, 그러다 다시 없는 날을 있다고 읽는다.
 */
export function trendOmissionNotice(omittedPoints: number, barCount: number, rowCount: number): string | null {
  if (omittedPoints <= 0) return null;
  return `일부 값을 표시하지 못했어요 — ${omittedPoints}일이 응답에서 읽히지 않아 표에서 뺐어요 (막대 ${barCount}개 · 표 ${rowCount}줄).`;
}

/**
 * 추이 카드 한 장의 파생 전부.
 *
 * ## 표를 세우는 규칙 (⚠️ 라운드 86 리뷰 M-2가 바꾼 자리)
 *
 * 종전 규칙은 *"행 수와 막대 수가 어긋나면 표를 세우지 않는다"* 였다. 그 규칙이 지키려던 값은
 * 옳았다 — **반쯤 맞는 표**를 그리면 운영자가 둘을 나란히 읽다가 없는 날을 있다고 믿는다.
 * 그런데 그 규칙의 대가가 값보다 컸다: 클릭 화면에서 **표는 값에 닿는 유일한 텍스트 경로**이고,
 * 분석 화면에서도 이 트랙이 새로 낸 유일한 경로다. 점 하나가 깨진 응답에서 그 경로가 **말없이**
 * 사라지면, 그 순간 두 화면은 이 트랙 이전(값이 마우스에만 있던 상태)으로 되돌아간다 —
 * 그리고 **아무도 그 사실을 듣지 못한다**(침묵).
 *
 * 그래서 오늘 규칙은 셋을 함께 지킨다: ⓐ 표에는 **그릴 수 있는 줄만** 선다(지어내지 않는다) ·
 * ⓑ 뺀 줄이 있으면 **고지 한 줄**이 수와 함께 그 사실을 말한다(반쯤 맞는 표로 읽히지 않는다) ·
 * ⓒ 정상 응답에서는 고지가 `null`이라 **그 줄이 서지 않는다**.
 *
 * ⚠️ **두 시점** — 라운드 86 리뷰 M-2 당시 ⓒ는 *"정상 응답에서는 고지가 `null`이라 두 화면의
 * 글자가 **종전 그대로**다"* 라고 적혀 있었다. `omissionNotice`에 대해서는 오늘도 그대로 참이지만
 * *"두 화면의 글자가 종전 그대로"* 는 **라운드 88 트랙 A 이후 거짓**이다 — 그 트랙이 클릭 화면에
 * 최대치 한 줄과 갈래 각주를 세워 정상 응답의 글자가 갈렸다(머리말의 두 시점 항목 참고).
 * 이 줄이 오늘 약속하는 것은 **이 고지 한 줄이 정상 응답에서 서지 않는다**는 것 하나다.
 *
 * `showTable`은 이제 *"그릴 줄이 하나라도 있는가"* 다. 빈 기간(점 0개)에서 참인 이유는 종전
 * 그림을 지키기 위해서다 — 클릭 화면은 그때도 머리만 있는 표를 그렸다. 전 점이 깨진 응답에서만
 * 거짓이고, 그때는 고지 한 줄이 남아 화면이 침묵하지 않는다.
 */
export function analyticsTrendView(points: TrendPoint[], unit: TrendCountUnit): AnalyticsTrendView {
  const bars = trendBars(points, unit);
  const rows = trendTableRows(points, unit);
  const omittedPoints = bars.length - rows.length;
  return {
    bars,
    rows,
    showTable: rows.length > 0 || bars.length === 0,
    omittedPoints,
    omissionNotice: trendOmissionNotice(omittedPoints, bars.length, rows.length),
    peak: trendPeak(points),
    peakSentence: trendPeakSentence(points, unit)
  };
}
