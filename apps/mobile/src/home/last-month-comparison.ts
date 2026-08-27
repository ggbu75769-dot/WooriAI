import { formatKrw } from "../money";

/**
 * REP-121 홈 "지난달 같은 시점 대비" 인사이트 한 줄 — 순수 계산 + 문구.
 *
 * ## 왜 클라이언트 계산인가 (데이터 경로 근거)
 *
 * 이 한 줄이 정직하려면 "이번 달 오늘까지"와 "지난달 같은 일자까지"라는 **같은 길이의 두 구간**을
 * 비교해야 한다. 코드 현실은 이렇다:
 *
 * - `GET /home`(apps/api/src/finance/home.controller.ts)은 이번 달만 내려준다 — 지난달 값 없음.
 * - `GET /children/:id/reports/monthly`는 `yearMonth`만 받고 **월 전체 합계**를 돌려준다
 *   (apps/api/src/onboarding/reporting-store.service.ts의 getMonthlyReport → getSeoulMonthRange).
 *   `endDate` 같은 부분 구간 파라미터는 없다. 이 값으로 "지난달보다 12% 적게" 를 만들면 월초에는
 *   항상 "적게 썼어요"가 뜨는 **허위 비교**가 된다.
 * - 오프라인 델타 동기화(src/offline/*)의 `local_expenses`는 전체 이력의 완전한 사본이 아니라
 *   베스트-에포트 스냅샷이라, 여기서 합계를 내면 조용히 과소 집계될 수 있다.
 *
 * 그래서 홈은 지난달 지출 **행**을 한 번 더 조회하고(`listExpenses(childId, 지난달 yearMonth)` —
 * 기록 탭과 같은 `["expenses", childId, yearMonth]` 캐시 키를 공유한다) 같은 일자까지의 부분
 * 합계를 여기서 계산한다. 서버 API 변경 없이도 **정확한 같은-시점 비교**가 가능한 유일한 경로다.
 *
 * ## 비교 기준 정합성
 * - 이번 달 값은 `HomeSummary.monthly.usedAmountKrw`(서버 집계, DNC-015에 따라 선물 제외)를 그대로
 *   쓴다. 지난달 부분 합계도 `expenseType === "expense"` 행만 더해 **같은 기준**을 맞춘다
 *   (서버 sumExpenses / totalExpenseKrw와 동일한 필터).
 * - 지난달이 이번 달보다 짧으면(예: 3/31 → 2월) 지난달 마지막 날로 잘라 비교한다.
 *
 * ## 문구 규칙 (DNC-018 해요체 / 과잉 해석 금지)
 * - 사실 서술만 한다. "잘하고 있어요", "줄여보세요" 같은 평가·조언은 넣지 않는다.
 * - 퍼센트는 **내림(floor)** 이라 표시값이 실제 차이를 과장하지 않는다. 1% 미만이면 퍼센트 대신
 *   금액 차이를 그대로 말한다("0% 적게 썼어요" 같은 무의미/오해 문구 금지).
 * - 지난달에 기록 자체가 없으면(첫 달 사용자 포함) 아무것도 렌더하지 않는다(null).
 */

/** 비교에 필요한 최소 지출 행 — src/api/client.ts의 Expense가 그대로 만족한다. */
export type ComparableExpenseRecord = {
  amountKrw: number;
  /** "YYYY-MM-DD" (서버 toExpenseDto의 date-only 포맷). */
  spentOn: string;
  expenseType: string;
};

export type LastMonthComparisonDirection =
  /** 이번 달이 지난달 같은 시점보다 적다. */
  | "less"
  /** 이번 달이 지난달 같은 시점보다 많다. */
  | "more"
  /** 두 값이 정확히 같다. */
  | "same"
  /** 이번 달은 아직 기록이 없다(지난달 같은 시점에는 있었다). */
  | "no-spending-yet"
  /** 지난달 같은 시점까지는 기록이 없었다(그 뒤에는 있었다). */
  | "no-baseline";

export type LastMonthComparison = {
  direction: LastMonthComparisonDirection;
  /** 비교 대상이 된 지난달 yearMonth("YYYY-MM"). */
  lastYearMonth: string;
  /** 지난달에서 실제로 잘라 쓴 마지막 일자(1-31). */
  comparedThroughDay: number;
  /** 지난달 같은 시점까지의 선물 제외 합계. */
  lastMonthToDateKrw: number;
  /** 이번 달 오늘까지의 선물 제외 합계(= HomeSummary.monthly.usedAmountKrw). */
  thisMonthToDateKrw: number;
  /** 두 값의 차이(절대값). */
  differenceKrw: number;
  /** 내림한 변화율(%). 기준이 0이거나 1% 미만이면 null. */
  percent: number | null;
  /** 화면에 그대로 그리는 한 줄. */
  text: string;
};

export type LastMonthComparisonInput = {
  /** 서울 기준 오늘("YYYY-MM-DD") — 화면은 @wooriai/domain의 getSeoulToday()를 넘긴다. */
  todayIso: string;
  /** HomeSummary.monthly.usedAmountKrw (선물 제외 이번 달 합계, DNC-015). */
  thisMonthToDateKrw: number | null | undefined;
  /** 지난달 한 달치 지출 행. 아직 안 불러왔거나 실패했으면 null/undefined. */
  lastMonthRecords: ComparableExpenseRecord[] | null | undefined;
};

const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/** "YYYY-MM-DD" | "YYYY-MM" → 직전 달의 "YYYY-MM". 형식이 깨졌으면 null. */
export function previousYearMonth(todayIso: string): string | null {
  const year = Number(todayIso.slice(0, 4));
  const month = Number(todayIso.slice(5, 7));
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) return null;
  const previousMonth = month === 1 ? 12 : month - 1;
  const previousYear = month === 1 ? year - 1 : year;
  return `${previousYear}-${String(previousMonth).padStart(2, "0")}`;
}

/** 해당 달의 마지막 일자(윤년 포함). */
export function daysInYearMonth(yearMonth: string): number {
  const year = Number(yearMonth.slice(0, 4));
  const month = Number(yearMonth.slice(5, 7));
  // Date.UTC(year, month, 0) = 그 달의 마지막 날.
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/**
 * `yearMonth` 달의 1일부터 `throughDay`까지 지출 합계. 선물/환불은 제외하고
 * (`expenseType === "expense"`만) 다른 달 행이 섞여 들어와도 무시한다.
 */
export function sumMonthExpensesThroughDay(
  records: ComparableExpenseRecord[],
  yearMonth: string,
  throughDay: number
): number {
  let total = 0;
  for (const record of records) {
    if (record.expenseType !== "expense") continue;
    const matched = DATE_ONLY_PATTERN.exec(record.spentOn);
    if (!matched) continue;
    if (record.spentOn.slice(0, 7) !== yearMonth) continue;
    if (Number(matched[3]) > throughDay) continue;
    if (!Number.isFinite(record.amountKrw)) continue;
    total += record.amountKrw;
  }
  return total;
}

function normalizedAmount(value: number | null | undefined): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return null;
  return value;
}

/**
 * 홈 한 줄을 만든다. 렌더할 것이 없으면 null(첫 달 사용자·미로딩·입력 이상 포함).
 */
export function evaluateLastMonthComparison(input: LastMonthComparisonInput): LastMonthComparison | null {
  if (!DATE_ONLY_PATTERN.test(input.todayIso)) return null;
  const records = input.lastMonthRecords;
  if (!records) return null;

  const thisMonthToDateKrw = normalizedAmount(input.thisMonthToDateKrw);
  if (thisMonthToDateKrw === null) return null;

  const lastYearMonth = previousYearMonth(input.todayIso);
  if (!lastYearMonth) return null;

  const lastMonthLength = daysInYearMonth(lastYearMonth);
  const todayDay = Number(input.todayIso.slice(8, 10));
  // 지난달이 더 짧으면(3/31 → 2월) 지난달 마지막 날까지로 잘라 비교한다.
  const comparedThroughDay = Math.min(todayDay, lastMonthLength);

  const lastMonthWholeKrw = sumMonthExpensesThroughDay(records, lastYearMonth, lastMonthLength);
  // 지난달 기록이 아예 없다 = 첫 달 사용자이거나 지난달을 통째로 안 썼다. 둘을 구분할 근거가
  // 없으므로 아무 문장도 만들지 않는다(요구사항: 지난달 데이터 없으면 렌더 안 함).
  if (lastMonthWholeKrw <= 0) return null;

  const lastMonthToDateKrw = sumMonthExpensesThroughDay(records, lastYearMonth, comparedThroughDay);
  const base = {
    lastYearMonth,
    comparedThroughDay,
    lastMonthToDateKrw,
    thisMonthToDateKrw
  } as const;

  if (lastMonthToDateKrw === 0) {
    // 지난달 같은 시점까지는 0원이었다(기록은 그달 뒤쪽에만 있었다). 비율의 기준이 0이라
    // 퍼센트를 만들 수 없으므로 사실만 말한다.
    return {
      ...base,
      direction: "no-baseline",
      differenceKrw: thisMonthToDateKrw,
      percent: null,
      text: "지난달 같은 시점까지는 지출 기록이 없었어요."
    };
  }

  if (thisMonthToDateKrw === 0) {
    return {
      ...base,
      direction: "no-spending-yet",
      differenceKrw: lastMonthToDateKrw,
      percent: null,
      // "100% 적게 썼어요"는 산술적으로만 맞고 읽는 사람에게는 과장이라 기준값만 말한다.
      text: `지난달 같은 시점까지는 ${formatKrw(lastMonthToDateKrw)}을 썼어요.`
    };
  }

  const differenceKrw = Math.abs(thisMonthToDateKrw - lastMonthToDateKrw);
  if (differenceKrw === 0) {
    return {
      ...base,
      direction: "same",
      differenceKrw: 0,
      percent: null,
      text: "지난달 같은 시점과 지출이 같아요."
    };
  }

  const direction: LastMonthComparisonDirection = thisMonthToDateKrw < lastMonthToDateKrw ? "less" : "more";
  const comparisonWord = direction === "less" ? "적게" : "많이";
  // 내림: 12.9%는 12%로 말한다 — 표시값이 실제 차이보다 커지는 일이 없다.
  const flooredPercent = Math.floor((differenceKrw * 100) / lastMonthToDateKrw);
  if (flooredPercent < 1) {
    return {
      ...base,
      direction,
      differenceKrw,
      percent: null,
      text: `지난달 같은 시점보다 ${formatKrw(differenceKrw)} ${comparisonWord} 썼어요.`
    };
  }

  return {
    ...base,
    direction,
    differenceKrw,
    percent: flooredPercent,
    text: `지난달 같은 시점보다 ${flooredPercent}% ${comparisonWord} 썼어요.`
  };
}
