import { formatKrw } from "../money";
import { evaluateHomeBudgetProgress } from "../home/budget-progress";
import { daysInYearMonth } from "../home/last-month-comparison";
import { computeCategoryShares } from "./category-share";

/**
 * UX-F: 리포트 월간 탭 최상단 "이번 달 한 문장" 인사이트 — 순수 조립 모듈.
 *
 * ## 왜 이 모듈인가
 * 리포트 탭은 총액·도넛·추이·누적처럼 **숫자 카드의 나열**이라, 화면을 열고 나서 "그래서 이번
 * 달은 어땠는데?"를 사람이 직접 계산해야 했다. 이 모듈은 화면이 **이미 받아 둔 집계값만**
 * 조합해 1~2문장으로 말한다. 새 API도, 새 집계 규칙도 만들지 않는다(DNC-013/015).
 *
 * ## 입력은 전부 기존 값 (새 계산 규칙 발명 금지)
 * - `totalExpenseKrw` / `categoryTop` / `budgetAmountKrw` = `GET /children/:id/reports/monthly`
 *   응답 그대로. 서버는 `deletedAt: null` + `expenseType: 'expense'`(선물 제외, DNC-015)로
 *   같은 술어에서 총액과 카테고리 분해를 낸다 — 그래서 `sum(categoryTop) === totalExpenseKrw`이고
 *   "전체의 32%"의 분모가 총액과 어긋날 수 없다
 *   (apps/api/src/onboarding/reporting-store.service.ts의 `getMonthlyReport`/`categoryBreakdown`).
 * - 카테고리 퍼센트는 **도넛 범례와 같은 함수**(`computeCategoryShares`)로 낸다. 같은 화면의 두
 *   숫자가 반올림 방식 차이로 1% 어긋나는 일을 막는다.
 * - 예산 퍼센트는 홈 히어로 카드와 **같은 함수**(`evaluateHomeBudgetProgress`)를 쓴다. 다만 그
 *   함수는 초과분을 100%로 물리므로(홈 프로그레스 바용), 초과한 달은 퍼센트 대신 초과 금액을
 *   말한다 — "예산의 100%를 썼어요"로 130%를 감추지 않기 위해서다.
 *
 * ## 비교 문장의 의미 — 왜 "지난달 전체보다"이고, 진행 중인 달에는 없는가
 * 홈의 한 줄(`src/home/last-month-comparison.ts`)은 "이번 달 오늘까지 vs 지난달 같은 일자까지"를
 * 비교한다. 그러려면 **지난달 지출 행 목록**이 필요하다(월간 리포트 API에는 부분 구간 파라미터가
 * 없다). 리포트 화면이 가진 지난달 데이터는 `previousMonth` 쿼리의 **월 전체 합계** 하나뿐이다.
 * 그 값으로 진행 중인 달을 비교하면 매달 1일에는 언제나 "적게 썼어요"가 뜨는 허위 비교가 된다.
 * 그래서:
 * - **이미 끝난 달**을 보고 있을 때만 비교 문장을 넣고, 문구에 비교 대상을 못 박는다 —
 *   "지난달 **전체**보다 12,000원 적게 썼어요"(월 전체 vs 월 전체라 정직하다).
 * - **진행 중인 달**에는 비교 문장을 생략한다. 대신 그 자리에 예산·하루 평균 문장이 들어간다.
 *   같은 시점 비교가 필요하면 홈 화면이 정확한 데이터로 이미 말하고 있다.
 * 문구의 톤(`적게/많이 썼어요`)은 홈과 일치시키고, 기준 구간만 "같은 시점" → "전체"로 바꿨다.
 *
 * ## 문장 규칙 (DNC-018)
 * - 해요체, 사실 서술만. "잘하고 있어요/줄여보세요" 같은 평가·조언·죄책감 유발 문구 금지.
 * - 근거가 없는 문장은 **만들지 않는다**: 카테고리 분해가 없으면 1위 문장 없음, 지난달이 0원이면
 *   비교 문장 없음, 예산 미설정이면 예산 문장 없음, 그리고 이번 달 총액이 0원이면 카드 자체가
 *   렌더되지 않는다(`null` 반환).
 * - 카드는 최대 2문장이다. "한 문장으로 읽히는" 것이 목적이라, 우선순위(카테고리 1위 → 기간별
 *   핵심 → 남은 문장) 순으로 자르고 세 번째 문장은 버린다.
 */

export type MonthlyInsightCategory = {
  categoryId: string;
  amountKrw: number;
};

export type MonthlyInsightInput = {
  /** 화면이 보고 있는 달 "YYYY-MM"(reports.tsx의 reportYearMonth). */
  yearMonth: string;
  /** 서울 기준 오늘 "YYYY-MM-DD"(@wooriai/domain의 getSeoulToday()). */
  todayIso: string;
  /** 월간 리포트 totalExpenseKrw(선물 제외 서버 집계). */
  totalExpenseKrw: number | null | undefined;
  /** 월간 리포트 budgetAmountKrw. null/0이면 예산 미설정. */
  budgetAmountKrw?: number | null;
  /** 월간 리포트 categoryTop(전 카테고리 분해, 금액 내림차순). */
  categoryTop?: readonly MonthlyInsightCategory[] | null;
  /** categoryId → 표시 이름. 화면의 buildCategoryNameLookup을 그대로 넘긴다. */
  categoryLabel: (categoryId: string) => string;
  /** 지난달 **월 전체** 합계. 아직 안 불러왔거나 실패했으면 null/undefined. */
  previousMonthTotalKrw?: number | null;
};

/** 보고 있는 달이 오늘 기준 어디에 있는지. */
export type MonthlyInsightMonthStatus = "in-progress" | "complete" | "future";

export type MonthlyInsight = {
  monthStatus: MonthlyInsightMonthStatus;
  /** 카드 첫 줄. */
  headline: string;
  /** 카드 둘째 줄(없으면 null). */
  detail: string | null;
  /** 렌더 순서 그대로의 문장들(최대 2). */
  sentences: string[];
  /** 카드를 한 요소로 읽어 주는 TalkBack 라벨. */
  accessibilityLabel: string;
  /** 지난달 비교 문장을 실제로 넣었는지(화면의 중복 문구 방지용). */
  hasComparison: boolean;
  /** 하루 평균의 분모로 쓴 경과일(진행 중인 달은 오늘 일자, 끝난 달은 그 달의 마지막 날). */
  elapsedDays: number | null;
  /** 문장에 쓴 하루 평균. 말하지 않았으면 null. */
  dailyAverageKrw: number | null;
};

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const YEAR_MONTH_PATTERN = /^\d{4}-\d{2}$/;

/** 카드가 담는 문장 수 상한 — "숫자 나열"로 되돌아가지 않게. */
export const MONTHLY_INSIGHT_MAX_SENTENCES = 2;

function isValidYearMonth(yearMonth: string): boolean {
  if (!YEAR_MONTH_PATTERN.test(yearMonth)) return false;
  const month = Number(yearMonth.slice(5, 7));
  return month >= 1 && month <= 12;
}

/**
 * 보고 있는 달과 서울 오늘을 비교한다. 문자열 비교로 충분하다("YYYY-MM"은 사전순 = 시간순).
 */
export function resolveMonthStatus(yearMonth: string, todayIso: string): MonthlyInsightMonthStatus | null {
  if (!isValidYearMonth(yearMonth) || !DATE_ONLY_PATTERN.test(todayIso)) return null;
  const currentYearMonth = todayIso.slice(0, 7);
  if (yearMonth === currentYearMonth) return "in-progress";
  return yearMonth < currentYearMonth ? "complete" : "future";
}

/**
 * 하루 평균의 분모. 진행 중인 달은 **서울 달력 기준 오늘까지의 경과일**(1일이면 1), 이미 끝난
 * 달은 그 달의 마지막 날이다. 오늘 일자가 그 달의 길이를 넘을 수는 없지만(같은 달이므로) 방어적
 * 으로 물린다.
 */
export function elapsedDaysInMonth(
  yearMonth: string,
  todayIso: string,
  monthStatus: MonthlyInsightMonthStatus
): number | null {
  if (!isValidYearMonth(yearMonth) || !DATE_ONLY_PATTERN.test(todayIso)) return null;
  const monthLength = daysInYearMonth(yearMonth);
  if (monthStatus === "complete") return monthLength;
  if (monthStatus === "future") return null;
  const todayDay = Number(todayIso.slice(8, 10));
  if (!Number.isInteger(todayDay) || todayDay < 1) return null;
  return Math.min(todayDay, monthLength);
}

function normalizedAmount(value: number | null | undefined): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return null;
  return value;
}

/** "이번 달은" / "8월은" — 지난달을 보면서 "이번 달"이라고 말하지 않기 위해. */
function monthSubjectPhrase(yearMonth: string, monthStatus: MonthlyInsightMonthStatus): string {
  if (monthStatus === "in-progress") return "이번 달은";
  return `${Number(yearMonth.slice(5, 7))}월은`;
}

/**
 * "이번 달은 기저귀/위생에 가장 많이 썼어요 (84,200원 · 전체의 32%)".
 * 카테고리 분해가 비었거나 전부 0원이면 null.
 */
function buildTopCategorySentence(input: MonthlyInsightInput, monthStatus: MonthlyInsightMonthStatus): string | null {
  const entries = input.categoryTop ?? [];
  if (entries.length === 0) return null;

  // 도넛 범례와 같은 함수 = 같은 반올림(최대잔여법, 합계 정확히 100%).
  const shares = computeCategoryShares(
    entries.map((entry) => ({ label: input.categoryLabel(entry.categoryId), amountKrw: entry.amountKrw }))
  );
  if (shares.length === 0) return null;

  // 서버가 금액 내림차순으로 주지만 순서에 기대지 않는다(동률은 먼저 온 항목).
  const top = shares.reduce((best, slice) => (slice.amountKrw > best.amountKrw ? slice : best), shares[0]);
  return `${monthSubjectPhrase(input.yearMonth, monthStatus)} ${top.label}에 가장 많이 썼어요 (${formatKrw(top.amountKrw)} · 전체의 ${top.percentLabel})`;
}

/**
 * "지난달 전체보다 12,000원 적게 썼어요" — 이미 끝난 달에서만. 지난달이 0원이면(첫 달 사용자
 * 포함) 근거가 없으므로 null.
 */
function buildComparisonSentence(
  input: MonthlyInsightInput,
  monthStatus: MonthlyInsightMonthStatus,
  totalExpenseKrw: number
): string | null {
  if (monthStatus !== "complete") return null;
  const previousTotalKrw = normalizedAmount(input.previousMonthTotalKrw);
  if (previousTotalKrw === null || previousTotalKrw <= 0) return null;

  const differenceKrw = Math.abs(totalExpenseKrw - previousTotalKrw);
  if (differenceKrw === 0) return "지난달 전체와 지출이 같아요";
  // 톤은 홈의 한 줄과 같고(적게/많이 썼어요), 기준 구간만 "같은 시점" → "전체"로 다르다.
  const comparisonWord = totalExpenseKrw < previousTotalKrw ? "적게" : "많이";
  return `지난달 전체보다 ${formatKrw(differenceKrw)} ${comparisonWord} 썼어요`;
}

/**
 * "예산의 64%를 썼고, 하루 평균 8,100원이에요".
 *
 * - 예산 미설정이면 예산 절이 빠지고 하루 평균만 남는다.
 * - 예산을 넘긴 달은 퍼센트 대신 초과 금액을 말한다(홈 퍼센트가 100%에서 잘리기 때문).
 * - 하루 평균은 **진행 중인 달**에서만 말한다. 끝난 달의 "하루 평균"은 지금 이 화면에서
 *   행동으로 이어지는 정보가 아니고, 문장 수 상한을 비교 문장에 양보한다.
 */
function buildBudgetSentence(
  input: MonthlyInsightInput,
  totalExpenseKrw: number,
  dailyAverageKrw: number | null
): string | null {
  const budgetKrw = normalizedAmount(input.budgetAmountKrw);
  const progress = evaluateHomeBudgetProgress({ budgetKrw, spentKrw: totalExpenseKrw });

  const dailyClause = dailyAverageKrw === null ? null : `하루 평균 ${formatKrw(dailyAverageKrw)}이에요`;

  if (!progress.hasBudget || progress.percent === null) {
    return dailyClause;
  }

  const overBudgetKrw = budgetKrw !== null && totalExpenseKrw > budgetKrw ? totalExpenseKrw - budgetKrw : 0;
  const budgetStem = overBudgetKrw > 0 ? `예산보다 ${formatKrw(overBudgetKrw)} 많이 썼` : `예산의 ${progress.percent}%를 썼`;
  return dailyClause === null ? `${budgetStem}어요` : `${budgetStem}고, ${dailyClause}`;
}

/**
 * 월간 탭 인사이트 카드 한 장을 만든다. 말할 근거가 없으면 null(카드 미렌더).
 */
export function buildMonthlyInsight(input: MonthlyInsightInput): MonthlyInsight | null {
  const monthStatus = resolveMonthStatus(input.yearMonth, input.todayIso);
  // 아직 오지 않은 달은 "경과일"도 "지난달 전체"도 성립하지 않는다(화면의 다음 이동은 이미
  // 현재 기간에서 막혀 있어 정상 경로로는 도달하지 않는다).
  if (monthStatus === null || monthStatus === "future") return null;

  const totalExpenseKrw = normalizedAmount(input.totalExpenseKrw);
  // 이번 달에 지출이 하나도 없으면 요약할 것이 없다 — 빈 상태 문구는 화면의 몫이다.
  if (totalExpenseKrw === null || totalExpenseKrw <= 0) return null;

  const elapsedDays = elapsedDaysInMonth(input.yearMonth, input.todayIso, monthStatus);
  // 하루 평균은 진행 중인 달에서만 말한다(위 buildBudgetSentence 주석 참고).
  const dailyAverageKrw =
    monthStatus === "in-progress" && elapsedDays !== null && elapsedDays >= 1
      ? Math.round(totalExpenseKrw / elapsedDays)
      : null;
  const topCategorySentence = buildTopCategorySentence(input, monthStatus);
  const comparisonSentence = buildComparisonSentence(input, monthStatus, totalExpenseKrw);
  const budgetSentence = buildBudgetSentence(input, totalExpenseKrw, dailyAverageKrw);

  // 우선순위: 카테고리 1위 → 그 달의 핵심(진행 중이면 예산·하루 평균, 끝난 달이면 지난달 비교)
  // → 남은 문장. 상한(2)을 넘는 문장은 버린다.
  const ordered =
    monthStatus === "in-progress"
      ? [topCategorySentence, budgetSentence, comparisonSentence]
      : [topCategorySentence, comparisonSentence, budgetSentence];
  const sentences = ordered.filter((sentence): sentence is string => Boolean(sentence)).slice(0, MONTHLY_INSIGHT_MAX_SENTENCES);
  if (sentences.length === 0) return null;

  return {
    monthStatus,
    headline: sentences[0],
    detail: sentences[1] ?? null,
    sentences,
    accessibilityLabel: sentences.join(" "),
    hasComparison: comparisonSentence !== null && sentences.includes(comparisonSentence),
    elapsedDays,
    // 예산 문장이 상한에 밀려 빠졌으면 하루 평균도 말하지 않은 것이다.
    dailyAverageKrw: budgetSentence !== null && sentences.includes(budgetSentence) ? dailyAverageKrw : null
  };
}
