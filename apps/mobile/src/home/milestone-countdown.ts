import { formatKrw } from "../money";
import { firstBirthdayOf } from "../reports/milestone-selection";
import { displayNickname } from "./baby-counter";
import { addDays, daysBetween, isDateOnly } from "./day-math";

/**
 * UX-A 홈 "100일 · 첫돌 카운트다운" 카드 — 순수 판정 + 문구.
 *
 *   "100일까지 D-13 · 지금까지 함께한 지출 1,245,700원"
 *
 * 탭하면 리포트 탭으로 간다(그 탭이 100일/첫돌 마일스톤 리포트를 이미 연다 —
 * `selectMilestoneReportType`, app/(tabs)/reports.tsx). 홈은 "그날이 다가온다"는 사실만 알리고,
 * 실제 리포트는 기존 화면이 낸다.
 *
 * ## 날짜 규칙 (기존 계산 재사용)
 * - 첫돌 = `firstBirthdayOf(birthDate)` — 리포트 탭이 어떤 마일스톤 리포트를 부를지 정할 때 쓰는
 *   **바로 그 함수**를 import한다(수정하지 않는다). 서버의 첫돌 창
 *   `[birthDate, birthDate + 1년)`과 같은 덧셈이라 홈의 "첫돌까지 D-1"과 리포트가 여는 창이
 *   어긋나지 않는다.
 * - 100일 = `birthDate + 99일`. 태어난 날을 1일로 세는 한국 관례이고(baby-counter.ts 참고),
 *   서버의 100일 리포트 창 `[birthDate, birthDate + 100일)`의 **마지막 날**과 정확히 같다.
 *
 * ## 표시 규칙
 * - 100일 당일까지는 100일 카운트다운, 그 다음 날부터는 첫돌 카운트다운으로 자동 전환.
 * - 첫돌이 지나면(첫돌 다음 날부터) 카드를 숨긴다 — 홈에 남길 다음 마일스톤이 없다.
 * - 당일(D-0)은 "D-0"이라 쓰지 않고 축하 한 줄로 바꾼다. 숫자가 0이 되는 순간이 이 카드가 가장
 *   할 말이 많은 날이다.
 * - 출생 전(pregnant/manual)에는 아예 만들지 않는다 — 100일은 태어난 뒤의 이야기다.
 * - 생년월일이 미래면(데이터 오류) 만들지 않는다.
 *
 * ## 금액 규칙
 * 부제의 금액은 홈 캐시가 이미 들고 있는 `HomeSummary.totalExpenseKrw`(서버 누적 집계, DNC-015에
 * 따라 선물·환불 제외)를 **그대로** 쓴다. 새 API도, 클라이언트 재집계도 없다. 기록이 아직 없으면
 * "0원"을 크게 말하는 대신 다음 행동을 권하는 한 줄로 바꾼다(죄책감 문구 금지, DNC-018).
 */

/** 100일은 태어난 날을 1일로 세어 100번째 날 = 생일 + 99일. */
export const HUNDREDTH_DAY_OFFSET = 99;

/** 100일 당일("YYYY-MM-DD"). 생년월일 형식이 아니면 null. */
export function hundredthDayOf(birthDate: string | null | undefined): string | null {
  if (!isDateOnly(birthDate)) return null;
  return addDays(birthDate, HUNDREDTH_DAY_OFFSET);
}

export type HomeMilestone = "d100" | "first-birthday";

export type HomeMilestoneCountdown = {
  milestone: HomeMilestone;
  /** 마일스톤 당일("YYYY-MM-DD"). */
  targetDateIso: string;
  /** 오늘부터 남은 날. 당일이면 0. */
  daysRemaining: number;
  /** 카드 제목 — "100일까지 D-13" / "오늘은 다온이의 100일이에요". */
  title: string;
  /** 카드 부제 — "지금까지 함께한 지출 1,245,700원". */
  subtitle: string;
  /** TalkBack 문장("D-13"을 소리로 풀어 읽고, 눌렀을 때 무슨 일이 생기는지까지 말한다). */
  accessibilityLabel: string;
};

export type HomeMilestoneCountdownInput = {
  /** Child.stageMode — "born"이 아니면 카드가 없다. */
  stageMode: string | null | undefined;
  /** Child.birthDate ("YYYY-MM-DD"). */
  birthDate?: string | null;
  /** Child.nickname. */
  nickname: string | null | undefined;
  /** 서울 기준 오늘("YYYY-MM-DD"). */
  todayIso: string;
  /** HomeSummary.totalExpenseKrw (누적 지출, 선물 제외). */
  totalExpenseKrw: number | null | undefined;
};

const MILESTONE_LABEL: Record<HomeMilestone, string> = {
  d100: "100일",
  "first-birthday": "첫돌"
};

function totalSubtitle(totalExpenseKrw: number | null | undefined): string {
  if (typeof totalExpenseKrw !== "number" || !Number.isFinite(totalExpenseKrw) || totalExpenseKrw <= 0) {
    return "기록을 남기면 그날까지의 지출을 함께 모아드릴게요.";
  }
  return `지금까지 함께한 지출 ${formatKrw(totalExpenseKrw)}`;
}

/** 홈 마일스톤 카드를 만든다. 보여줄 마일스톤이 없으면 null. */
export function evaluateMilestoneCountdown(input: HomeMilestoneCountdownInput): HomeMilestoneCountdown | null {
  if (input.stageMode !== "born") return null;
  if (!isDateOnly(input.todayIso) || !isDateOnly(input.birthDate)) return null;
  // 미래 생년월일(데이터 오류)에는 카운트다운을 만들지 않는다.
  const elapsed = daysBetween(input.birthDate, input.todayIso);
  if (elapsed === null || elapsed < 0) return null;

  const hundredthDay = hundredthDayOf(input.birthDate);
  const firstBirthday = firstBirthdayOf(input.birthDate);
  if (!hundredthDay || !firstBirthday) return null;

  const milestone: HomeMilestone | null =
    input.todayIso <= hundredthDay ? "d100" : input.todayIso <= firstBirthday ? "first-birthday" : null;
  // 첫돌까지 지났다 — 홈에서 셀 다음 마일스톤이 없으므로 카드를 숨긴다.
  if (!milestone) return null;

  const targetDateIso = milestone === "d100" ? hundredthDay : firstBirthday;
  const daysRemaining = daysBetween(input.todayIso, targetDateIso);
  if (daysRemaining === null || daysRemaining < 0) return null;

  const label = MILESTONE_LABEL[milestone];
  const subtitle = totalSubtitle(input.totalExpenseKrw);
  const name = displayNickname(input.nickname);
  const title = daysRemaining === 0 ? `오늘은 ${name}의 ${label}이에요` : `${label}까지 D-${daysRemaining}`;
  const spokenTitle = daysRemaining === 0 ? title : `${label}까지 ${daysRemaining}일 남았어요`;

  return {
    milestone,
    targetDateIso,
    daysRemaining,
    title,
    subtitle,
    accessibilityLabel: `${spokenTitle}. ${subtitle}. 리포트 보기`
  };
}
