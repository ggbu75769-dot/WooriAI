import { formatKrw } from "../money";
import { countsTowardMonthlyTotal } from "../offline/expense-list-reconciliation";
import { addDays, isDateOnly, mondayOfWeek } from "./day-math";
import { previousYearMonth, type ComparableExpenseRecord } from "./last-month-comparison";

/**
 * UX-A 홈 "이번 주 요약 · 기록 스트릭" 카드 — 순수 계산 + 문구.
 *
 *   "이번 주 84,200원 · 지난주 같은 요일까지보다 12,000원 적게 썼어요."
 *   "이번 주 4일 기록했어요"
 *
 * 매일 열고 싶은 홈이 되려면 "오늘 기록했나?"라는 질문에 홈이 답해야 한다. 이번 주 합계는 이번
 * 달 예산보다 훨씬 짧은 호흡이라 하루하루의 기록이 바로 눈에 보이고, 스트릭 줄이 그 습관을
 * 비난 없이 비춘다.
 *
 * ## 주 경계
 * 주 시작은 **월요일**(한국 관례, 달력 앱들과 동일)이고 날짜는 전부 서울 달력이다. "이번 주"는
 * `[이번 주 월요일, 오늘]`이라는 **부분 구간**이고, 비교 대상인 "지난주"도 같은 길이로 자른
 * `[지난주 월요일, 지난주 같은 요일]`이다 — 지난주 전체(7일)와 비교하면 주 초반에는 늘 "적게
 * 썼어요"가 뜨는 허위 비교가 된다(REP-121의 "같은 시점" 규칙과 같은 이유).
 *
 * ## 데이터 (새 API 없음)
 * 지출 캐시 `["expenses", childId, yearMonth]`를 **달 단위로** 읽는다 — 기록 탭이 쓰는 바로 그
 * 키라 두 화면이 응답을 공유하고, 지출 생성/수정/가져오기가 이미 invalidate하는 `["expenses"]`
 * 프리픽스에 그대로 걸린다. 홈은 이번 달과 지난달 두 벌을 이미 들고 있다(지난달은 REP-121의
 * "지난달 같은 시점 대비" 한 줄이 쓴다).
 *
 * **왜 두 벌이 다 필요한가**: 주는 달 경계를 넘는다. 9월 1일이 화요일이면 이번 주 월요일은
 * 8월 31일이고, 이번 달 캐시만으로 더한 "이번 주"는 하루가 빠진 **틀린 숫자**가 된다. 지난주
 * 구간도 마찬가지로(최대 13일 전) 지난달로 넘어갈 수 있다 — 다만 어떤 달도 28일보다 짧지
 * 않으므로 필요한 범위는 항상 {이번 달, 지난달} 안에 들어온다.
 *
 * 라운드 33 F6 — 화면은 서버 응답 원본이 아니라 **오프라인 재조정을 거친 행**을 넘긴다
 * (`reconcileMonthlyExpenses`, 기록 탭과 같은 함수 — app/(tabs)/index.tsx의
 * `reconciledMonthRecords`). 아직 서버에 올라가지 않은 대기 행이 빠지면 방금 기록한 사용자에게
 * 홈이 "이번 주 첫 기록을 남겨보세요"라고 말하고, 로컬에서 수정/삭제 대기 중인 서버 행을 그대로
 * 더하면 이미 바꾼 값으로 합계를 낸다. 이 모듈은 넘어온 행을 그대로 믿는다.
 *
 * 그래서 규칙은 하나다: **구간을 덮는 달의 캐시가 없으면 그 숫자를 말하지 않는다.**
 *  - 이번 주 월요일이 속한 달이 아직 안 왔으면(지난달 캐시 로딩 중·실패) 카드를 통째로 접는다.
 *    부분 합계에 "이번 주"라는 이름을 붙이는 것이 이 카드가 할 수 있는 가장 나쁜 일이다.
 *  - 지난주 구간이 안 덮이면 비교 문장만 뺀다(이번 주 합계는 정확하므로 그대로 보여준다).
 *
 * ## 금액·기록일 기준
 * - 합계는 `countsTowardMonthlyTotal`(선물·환불 제외, DNC-015)로 거른다 — 홈 히어로의 이번 달
 *   지출·기록 탭 월 합계와 **같은 술어**다.
 * - 스트릭의 "기록한 날"은 반대로 **모든 지출 행**을 센다. 선물로 받은 물건을 남기는 것도
 *   엄연히 기록이라, 그 날을 "기록 없음"으로 세면 사용자가 실제로 한 일을 부정하게 된다.
 *   그래서 "이번 주 0원 · 2일 기록했어요"가 나올 수 있고, 그것이 정확한 서술이다.
 *
 * ## 톤 (DNC-018)
 * 사실만 말한다. 기록이 없는 주에도 "며칠이나 빼먹었어요" 같은 말을 하지 않고 다음 한 걸음만
 * 권한다 — "이번 주 첫 기록을 남겨보세요".
 */

export type WeeklyComparisonDirection = "less" | "more" | "same";

export type WeeklyComparison = {
  direction: WeeklyComparisonDirection;
  /** 지난주 같은 요일까지의 합계(선물 제외). */
  lastWeekToDateKrw: number;
  /** 두 값의 차이(절대값). */
  differenceKrw: number;
  /** 비교 구간의 끝("YYYY-MM-DD", 지난주의 오늘과 같은 요일). */
  comparedThroughIso: string;
};

export type WeeklySummary = {
  /** 이번 주 월요일("YYYY-MM-DD"). */
  weekStartIso: string;
  /** 이번 주 월요일부터 오늘까지의 합계(선물 제외). */
  totalKrw: number;
  /** 이번 주에 지출을 기록한 날의 수(0~7). */
  recordedDayCount: number;
  /** 지난주 같은 요일까지와의 비교. 구간이 안 덮이거나 기준이 0원이면 null. */
  comparison: WeeklyComparison | null;
  /** 카드 첫 줄 — 합계 (+ 비교). */
  text: string;
  /** 카드 둘째 줄 — 기록 스트릭. */
  streakText: string;
  /** TalkBack 문장(두 줄을 한 덩어리로 읽는다). */
  accessibilityLabel: string;
};

export type WeeklySummaryInput = {
  /** 서울 기준 오늘("YYYY-MM-DD"). */
  todayIso: string;
  /** 이번 달 지출 행 — `["expenses", childId, 이번 달]` 캐시. 미로딩/실패면 null. */
  thisMonthRecords: ComparableExpenseRecord[] | null | undefined;
  /** 지난달 지출 행 — `["expenses", childId, 지난달]` 캐시. 미로딩/실패면 null. */
  lastMonthRecords: ComparableExpenseRecord[] | null | undefined;
};

/** 주는 월요일에 시작한다. */
export const WEEK_LENGTH_DAYS = 7;

function inRange(spentOn: string, startIso: string, endIso: string): boolean {
  // date-only 문자열은 사전순 비교 = 날짜순 비교다.
  return isDateOnly(spentOn) && spentOn >= startIso && spentOn <= endIso;
}

function sumRange(records: ComparableExpenseRecord[], startIso: string, endIso: string): number {
  let total = 0;
  for (const record of records) {
    if (!countsTowardMonthlyTotal(record.expenseType)) continue;
    if (!inRange(record.spentOn, startIso, endIso)) continue;
    if (!Number.isFinite(record.amountKrw)) continue;
    total += record.amountKrw;
  }
  return total;
}

/** 구간 안에서 지출 행이 하나라도 있는 날의 수 — 선물/환불 행도 "기록"으로 센다(위 주석 참고). */
function countRecordedDays(records: ComparableExpenseRecord[], startIso: string, endIso: string): number {
  const days = new Set<string>();
  for (const record of records) {
    if (!inRange(record.spentOn, startIso, endIso)) continue;
    days.add(record.spentOn);
  }
  return days.size;
}

function comparisonSentence(comparison: WeeklyComparison): string {
  if (comparison.direction === "same") return "지난주 같은 요일까지와 같아요";
  const word = comparison.direction === "less" ? "적게" : "많이";
  return `지난주 같은 요일까지보다 ${formatKrw(comparison.differenceKrw)} ${word} 썼어요`;
}

/** 홈 주간 카드를 만든다. 정확히 말할 수 없으면 null(화면은 카드를 렌더하지 않는다). */
export function evaluateWeeklySummary(input: WeeklySummaryInput): WeeklySummary | null {
  if (!isDateOnly(input.todayIso)) return null;
  if (!input.thisMonthRecords) return null;

  const thisYearMonth = input.todayIso.slice(0, 7);
  const lastYearMonth = previousYearMonth(input.todayIso);
  const coveredMonths = new Set<string>([thisYearMonth]);
  const records: ComparableExpenseRecord[] = [...input.thisMonthRecords];
  if (lastYearMonth && input.lastMonthRecords) {
    coveredMonths.add(lastYearMonth);
    records.push(...input.lastMonthRecords);
  }
  const covers = (startIso: string, endIso: string) =>
    coveredMonths.has(startIso.slice(0, 7)) && coveredMonths.has(endIso.slice(0, 7));

  const weekStartIso = mondayOfWeek(input.todayIso);
  if (!weekStartIso) return null;
  // 이번 주 구간이 캐시로 다 덮이지 않으면(달을 걸친 주 + 지난달 캐시 없음) 아무 숫자도 말하지
  // 않는다 -- 부분 합계에 "이번 주"라는 이름을 붙이지 않기 위해서다.
  if (!covers(weekStartIso, input.todayIso)) return null;

  const totalKrw = sumRange(records, weekStartIso, input.todayIso);
  const recordedDayCount = countRecordedDays(records, weekStartIso, input.todayIso);

  const lastWeekStartIso = addDays(weekStartIso, -WEEK_LENGTH_DAYS);
  const lastWeekEndIso = addDays(input.todayIso, -WEEK_LENGTH_DAYS);
  let comparison: WeeklyComparison | null = null;
  if (lastWeekStartIso && lastWeekEndIso && covers(lastWeekStartIso, lastWeekEndIso)) {
    const lastWeekToDateKrw = sumRange(records, lastWeekStartIso, lastWeekEndIso);
    // 기준이 0원이면 비율도 문장도 의미가 없다("지난주보다 84,200원 많이"는 사실상 이번 주
    // 합계를 두 번 말하는 것) -- 비교를 아예 만들지 않는다.
    if (lastWeekToDateKrw > 0) {
      const differenceKrw = Math.abs(totalKrw - lastWeekToDateKrw);
      comparison = {
        direction: differenceKrw === 0 ? "same" : totalKrw < lastWeekToDateKrw ? "less" : "more",
        lastWeekToDateKrw,
        differenceKrw,
        comparedThroughIso: lastWeekEndIso
      };
    }
  }

  // 이번 주 지출이 0원이면 비교 문장을 붙이지 않는다 -- 아직 아무 일도 일어나지 않은 주에
  // 지난주 숫자를 들이대는 것은 정보가 아니라 압박이다.
  const text =
    totalKrw > 0
      ? comparison
        ? `이번 주 ${formatKrw(totalKrw)} · ${comparisonSentence(comparison)}`
        : `이번 주 ${formatKrw(totalKrw)}`
      : "이번 주 지출은 아직 없어요";
  const streakText = recordedDayCount > 0 ? `이번 주 ${recordedDayCount}일 기록했어요` : "이번 주 첫 기록을 남겨보세요";

  return {
    weekStartIso,
    totalKrw,
    recordedDayCount,
    comparison: totalKrw > 0 ? comparison : null,
    text,
    streakText,
    accessibilityLabel: `${text}. ${streakText}`
  };
}
