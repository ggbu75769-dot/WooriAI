/**
 * 라운드 52 C-02: 분기·연간 추이 차트의 **미래 달 0원 절벽**을 없애는 순수 모듈.
 *
 * ## 무엇이 문제였나
 * 서버의 연간 리포트는 `monthlyTotals`를 언제나 **12개월 전부** 채워 내려준다 — 기록이 없는 달은
 * 0원이다(apps/api/src/onboarding/reporting-store.service.ts의 `getYearlyReport`). 분기 탭도
 * 마찬가지로 그 분기의 세 달을 각각 월간 리포트로 물어보므로, 아직 오지 않은 달은 0원으로 온다.
 * 화면(app/(tabs)/reports.tsx)은 그 배열을 그대로 LineChartCard에 넘겼다.
 *
 * 그래서 8월에 연간 탭을 열면 차트가 **9~12월을 0원으로 그린다**. 선은 8월 이후 바닥으로 떨어져
 * 수평으로 눕고, 그 모양은 "연말에 지출이 뚝 끊겼다"는 사실 주장으로 읽힌다. 실제로는 아직 오지
 * 않은 달일 뿐이다 — 있지도 않은 사실을 그림으로 말하는, 이 앱이 금지하는 허위 표시다.
 * 3분기(7~9월)를 8월에 보면 세 점 중 하나가 같은 이유로 바닥에 붙는다.
 *
 * ## 고치는 방향
 * **서버는 건드리지 않는다.** 12개월 배열은 합계(`totalExpenseKrw`)와 "그 해에 기록이 없는 달"을
 * 구분 없이 표현하는 정직한 계약이고, 0원인 과거 달은 실제로 0원이 맞다. 문제는 소비부가
 * "아직 오지 않은 달"과 "0원 쓴 달"을 같은 점으로 그린다는 것뿐이다. 그래서 화면 쪽에서
 * **서울 달력 기준 현재 달까지만** 자르고, 잘랐다는 사실을 캡션 한 줄로 말한다.
 *
 * - **끝난 연도/분기는 자르지 않는다.** 2025년을 보고 있다면 12월까지 전부 지나간 달이라 0원은
 *   전부 사실이다. 자르는 것은 "현재 진행 중인 기간"뿐이다.
 * - 캡션은 잘랐다는 **사실**만 적는다("1~8월 기준"). 평가·조언·예측을 하지 않는다(DNC-018).
 *
 * ## 점이 2개 미만일 때 (라운드 52 QA P2-3에서 다시 손봄)
 * LineChartCard는 `points`가 2개 미만이면 **장식용 고정 좌표**로 폴백한다(비세션 픽셀락 캡처를
 * 위한 설계다 — src/ui.tsx). 그 폴백은 세션 경로에서도 똑같이 일어나서, 1월에 연간 탭을 열면
 * 점 하나뿐인 데이터가 조용히 **그럴듯한 우상향 장식선**으로 바뀐다. 잘라 내면 이 창이 더 자주
 * 열린다(1월의 연간, 분기 첫 달).
 *
 * 처음에는 그 사실을 캡션 한 줄로 **덧붙이는** 것으로 막았다. 그러나 그림은 여전히 거기 있고,
 * 캡션은 그림 **아래**에 있다 — 우상향 선을 먼저 보고 그것을 자기 기록으로 읽은 사용자에게
 * 아래 한 줄은 늦은 정정이다(그리고 이 앱의 규칙은 "허위 표시 금지"이지 "허위 표시 + 주석"이
 * 아니다). 그래서 이제 **차트 자리 자체를 비운다**: `chartNotice`가 있으면 화면은 점을 넘기지
 * 않고 그 자리에 사실 한 줄만 그린다(app/(tabs)/reports.tsx). 비세션 미리보기의 장식선은
 * 이 판정을 거치지 않으므로 한 픽셀도 바뀌지 않는다(REP-001 픽셀락).
 *
 * ## 끝난 기간의 캡션 (QA P3-7)
 * 잘라 내지 않은 기간의 캡션은 `"1~12월"` **한 덩어리**였다. 아무 서술 없이 범위만 떠 있으면
 * 무엇을 말하는 값인지 알 수 없다(차트 범위인지, 필터인지, 다음에 올 문장의 조각인지).
 * 잘라 낸 기간이 `"1~8월 기준"`으로 스스로를 설명하듯, 끝난 기간도 `"1~12월 전체"`로 적는다 —
 * 사실은 그대로이고 문장만 자기 설명적이다.
 *
 * 순수 모듈인 이유: 리포트 탭은 vitest에서 렌더되지 않는다(react-native 네이티브 바인딩 없음).
 * 월간 탭은 이 모듈을 쓰지 않는다 — 월간 추이(`getTrendReport`)는 선택한 달로 **끝나는** 최근
 * 6개월이라 애초에 미래 달이 들어오지 않는다.
 */

const YEAR_MONTH_PATTERN = /^\d{4}-\d{2}$/;
const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** 차트가 실데이터 선을 그리기 위해 필요한 최소 점 수(src/ui.tsx LineChartCard의 `hasRealData`). */
export const PERIOD_TREND_MIN_REAL_POINTS = 2;

/**
 * 점이 모자라 추이를 그릴 수 없을 때 **차트 자리에** 들어가는 한 줄(QA P2-3).
 *
 * 장식선을 그려 놓고 아래에서 해명하지 않는다 — 그릴 수 없다는 사실을 그 자리에서 말한다.
 */
export const PERIOD_TREND_EMPTY_NOTICE = "기록이 두 달 이상 쌓이면 추이를 보여드려요";

/** 기간 전체가 아직 오지 않았을 때(정상 경로로는 도달하지 않는다 — 아래 주석 참고). */
export const PERIOD_TREND_FUTURE_NOTE = "아직 지나간 달이 없어요";

export type PeriodTrendPointsInput = {
  /** 기간의 **첫 달** "YYYY-MM"(분기 시작 달, 연간이면 그 해 1월). */
  startYearMonth: string;
  /**
   * 서버가 준 기간 전체의 월별 합계(오름차순, 첫 원소가 `startYearMonth`).
   * 아직 안 받았거나(로딩·실패) 실데이터가 없으면 null/undefined — 그때는 화면이 종전과 똑같이
   * 동작해야 하므로 캡션도 만들지 않는다.
   */
  points: readonly number[] | null | undefined;
  /** 서울 기준 오늘 "YYYY-MM-DD"(@wooriai/domain의 getSeoulToday()). */
  todayIso: string;
};

export type PeriodTrendPoints = {
  /** LineChartCard에 그대로 넘기는 점들. 입력이 없으면 undefined(= 종전 동작). */
  points: number[] | undefined;
  /** 서버가 준 점 수(기간의 달 수). */
  monthCount: number;
  /** 잘라 낸 뒤 남은 점 수(= 이미 지나갔거나 진행 중인 달 수). */
  elapsedMonths: number;
  /** 실제로 잘라 냈는가. 끝난 기간에서는 언제나 false. */
  truncated: boolean;
  /** 남은 구간의 달 범위 라벨 — "1~8월" / "8월". 남은 달이 없으면 null. */
  rangeLabel: string | null;
  /** 차트 아래 한 줄. 말할 것이 없으면 null(줄 미렌더). */
  caption: string | null;
  /** 그 줄을 한 요소로 읽어 주는 TalkBack 라벨. */
  accessibilityLabel: string | null;
  /** 차트가 실데이터 선을 그리는가(false면 화면이 아래 `chartNotice`로 차트 자리를 대체한다). */
  rendersRealData: boolean;
  /**
   * 차트 자리에 선 대신 들어갈 한 줄(QA P2-3). null이면 종전대로 선을 그린다.
   *
   * null인 경우는 둘이다: 실데이터 선을 그릴 수 있을 때, 그리고 **아직 데이터가 없을 때**
   * (로딩·실패·비세션 — 그때 화면은 종전과 한 글자도 다르지 않아야 한다).
   */
  chartNotice: string | null;
};

function monthOrdinal(yearMonth: string): number | null {
  if (!YEAR_MONTH_PATTERN.test(yearMonth)) return null;
  const year = Number(yearMonth.slice(0, 4));
  const month = Number(yearMonth.slice(5, 7));
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) return null;
  // 0년 1월을 0으로 두는 통짜 월 인덱스 — 연 경계를 넘는 뺄셈이 그냥 정수 뺄셈이 된다.
  return year * 12 + (month - 1);
}

/** 통짜 월 인덱스 → 그 달의 번호(1~12). */
function monthNumber(ordinal: number): number {
  return (ordinal % 12) + 1;
}

/** "1~8월" / 한 달뿐이면 "8월". */
function rangeLabelFor(startOrdinal: number, elapsedMonths: number): string | null {
  if (elapsedMonths <= 0) return null;
  const firstMonth = monthNumber(startOrdinal);
  const lastMonth = monthNumber(startOrdinal + elapsedMonths - 1);
  return firstMonth === lastMonth ? `${firstMonth}월` : `${firstMonth}~${lastMonth}월`;
}

/**
 * 분기·연간 추이 차트가 그릴 점들과, 그 아래 한 줄을 만든다.
 *
 * 입력이 없으면(로딩·실패·비세션) 모든 표시 필드가 null이라 화면은 종전과 한 글자도 다르지 않다.
 */
export function buildPeriodTrendPoints(input: PeriodTrendPointsInput): PeriodTrendPoints {
  const rawPoints = input.points;
  const empty: PeriodTrendPoints = {
    points: undefined,
    monthCount: 0,
    elapsedMonths: 0,
    truncated: false,
    rangeLabel: null,
    caption: null,
    accessibilityLabel: null,
    rendersRealData: false,
    chartNotice: null
  };
  if (!rawPoints || rawPoints.length === 0) return empty;

  const startOrdinal = monthOrdinal(input.startYearMonth);
  const todayOrdinal = DATE_ONLY_PATTERN.test(input.todayIso) ? monthOrdinal(input.todayIso.slice(0, 7)) : null;
  const monthCount = rawPoints.length;
  // 날짜를 해석하지 못하면 **자르지 않는다**. 모르는 채로 데이터를 지우는 것보다, 종전 동작
  // (서버가 준 그대로)이 안전하다 — 캡션도 만들지 않는다. 다만 그 상태에서도 점이 모자라면
  // 장식선은 여전히 허위 표시이므로 차트 자리 대체는 그대로 건다(QA P2-3).
  if (startOrdinal === null || todayOrdinal === null) {
    const rendersRealData = monthCount >= PERIOD_TREND_MIN_REAL_POINTS;
    return {
      ...empty,
      points: [...rawPoints],
      monthCount,
      elapsedMonths: monthCount,
      rendersRealData,
      chartNotice: rendersRealData ? null : PERIOD_TREND_EMPTY_NOTICE
    };
  }

  // 현재 달까지 포함해서 몇 개가 남는가. 기간이 통째로 과거면 monthCount(자르지 않음),
  // 통째로 미래면 0이다(화면의 "다음" 이동이 현재 기간에서 막혀 있어 정상 경로로는 오지 않지만,
  // 방어적으로 0으로 접는다 — src/period-navigation.ts의 canGoToNextPeriod).
  const elapsedMonths = Math.max(0, Math.min(monthCount, todayOrdinal - startOrdinal + 1));
  const truncated = elapsedMonths < monthCount;
  const points = truncated ? rawPoints.slice(0, elapsedMonths) : [...rawPoints];
  const rendersRealData = points.length >= PERIOD_TREND_MIN_REAL_POINTS;
  const rangeLabel = rangeLabelFor(startOrdinal, elapsedMonths);

  // P3-7: 범위만 홀로 뜨지 않게 두 경우 모두 스스로를 설명한다("1~8월 기준" / "1~12월 전체").
  const parts: string[] = [];
  if (rangeLabel) parts.push(truncated ? `${rangeLabel} 기준` : `${rangeLabel} 전체`);

  // P2-3: 선을 그릴 수 없다는 사실은 차트 **자리**가 말한다(캡션에 덧붙이지 않는다 — 그러면
  // 장식선이 그대로 남고 해명만 늘어난다). 지나간 달이 하나도 없는 기간은 이유가 다르므로
  // 문구도 다르다.
  const chartNotice = rendersRealData
    ? null
    : elapsedMonths === 0
      ? PERIOD_TREND_FUTURE_NOTE
      : PERIOD_TREND_EMPTY_NOTICE;

  const caption = parts.length > 0 ? parts.join(" · ") : null;
  return {
    points,
    monthCount,
    elapsedMonths,
    truncated,
    rangeLabel,
    caption,
    // "·"는 소리로 읽히지 않으므로 쉼표로 푼다(추이 방향 행·요약 줄과 같은 관례).
    accessibilityLabel: caption === null ? null : parts.join(", "),
    rendersRealData,
    chartNotice
  };
}
