import { formatKrw } from "../money";
import { firstBirthdayOf, selectMilestoneReportType } from "../reports/milestone-selection";
import { displayNickname } from "./baby-counter";
import { addDays, daysBetween, isDateOnly } from "./day-math";

/**
 * UX-A 홈 "100일 · 첫돌 카운트다운" 카드 — 순수 판정 + 문구.
 *
 *   "100일까지 D-13 · 지금까지 총 지출 1,245,700원 · 100일 리포트 보기"
 *
 * 탭하면 리포트 탭으로 간다(그 탭이 100일/첫돌 마일스톤 리포트를 이미 연다 —
 * `selectMilestoneReportType`, app/(tabs)/reports.tsx). 홈은 "그날이 다가온다"는 사실만 알리고,
 * 실제 리포트는 기존 화면이 낸다.
 *
 * ## CTA 라벨은 리포트 탭의 판정을 그대로 따른다 (라운드 33 F1)
 * 카운트다운 문구와 **눌렀을 때 열리는 리포트는 서로 다른 임계값**을 쓴다.
 *  - 카운트다운: 100일 **다음 날**부터 "첫돌까지 D-N"으로 넘어간다(아래 표시 규칙).
 *  - 리포트 탭: `selectMilestoneReportType`이 **첫돌 당일**부터 first-birthday를 부른다.
 * 그래서 100일 다음 날 ~ 첫돌 전날의 약 9개월 동안 카드는 "첫돌까지 D-N"인데 눌러서 열리는
 * 것은 **100일 리포트**다. 예전에는 부제·a11y가 그냥 "리포트 보기"라, 첫돌 이야기를 기대하고
 * 눌렀다가 100일 리포트를 보게 되는 오해가 남았다.
 *
 * 고치는 방향은 기능 축소(카운트다운 문구 변경)가 아니라 **예고를 사실과 맞추는 것**이다:
 * CTA 라벨을 `selectMilestoneReportType`을 **import해서** 만든다 — 첫돌 도달 전에는
 * "100일 리포트 보기"(완결된 100일 리포트가 열린다는 정확한 예고), 첫돌 도달 후에는
 * "첫돌 리포트 보기". 판정 함수가 한 벌이라 임계값이 갈릴 수 없다.
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
 *
 * 라운드 33 F5 — 이 금액은 **임신기를 포함한 전 기간 누적**이라 카드를 눌러서 열리는 마일스톤
 * 리포트의 창 합계(100일 = [출생일, 출생일+100일), 첫돌 = [출생일, 출생일+1년))와 당연히 다르다.
 * 예전 문구 "지금까지 함께한 지출"은 그 "지금까지"가 어느 구간인지 말하지 않아 카드 금액과 리포트
 * 숫자가 같아야 할 것처럼 읽혔다. 그래서 **"지금까지 총 지출"**로 바꿨다 — 전체 누적임이 문구에서
 * 드러나고, CTA가 "100일 리포트 보기"라고 창을 따로 예고하므로 두 숫자가 다른 것이 자연스럽게
 * 읽힌다. 창 합계를 여기서 다시 계산하지는 않는다: 홈에는 지출 행이 아니라 서버 누적 집계 하나만
 * 있어서, 재계산하면 근거 없는 숫자를 지어내는 셈이 된다.
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
  /** 카드 부제 — "지금까지 총 지출 1,245,700원"(전 기간 누적, 위 금액 규칙 참고). */
  subtitle: string;
  /**
   * 지금 이 카드를 누르면 리포트 탭이 실제로 여는 마일스톤 — `selectMilestoneReportType`이
   * 정한다. 카운트다운이 가리키는 `milestone`과 다를 수 있다(100일 다음 날 ~ 첫돌 전날).
   *
   * 라운드 34 L10 관례: 화면은 이 값을 그리지 않는다(홈이 렌더하는 것은 `ctaLabel` 한 줄뿐이다,
   * app/(tabs)/index.tsx). **테스트 전용 검산값**으로 남긴다 — 카드가 예고한 리포트와 리포트
   * 탭이 실제로 여는 리포트가 같은지를 milestone-countdown.test.ts가 이 필드로 대조하기
   * 때문이다. 지우면 `ctaLabel` 문자열을 되파싱하지 않고서는 그 검산이 사라진다.
   */
  reportMilestone: HomeMilestone;
  /** 카드 CTA 라벨 — "100일 리포트 보기" / "첫돌 리포트 보기". 여는 리포트를 그대로 예고한다. */
  ctaLabel: string;
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

/**
 * 라운드 48 B2 — 이 카드의 부제가 **실제로 누적 총액을 말하는가**.
 *
 * 카드가 떠 있어도 기록이 없는 달에는 부제가 금액이 아니라 권유 한 줄이다. 홈의 누적 총액
 * 카드(src/home/cumulative-total.ts)는 "이미 말하고 있으면 접는다"는 중복 방지 규칙을 쓰는데,
 * 그 판정이 이 파일의 문구 규칙과 갈리면 같은 금액이 홈에 두 번 뜨거나 아무 데도 안 뜬다.
 * 그래서 조건을 여기 한 곳에 두고 아래 `totalSubtitle`과 그 카드가 **같은 함수**를 본다.
 */
export function milestoneSubtitleShowsTotal(totalExpenseKrw: number | null | undefined): totalExpenseKrw is number {
  return typeof totalExpenseKrw === "number" && Number.isFinite(totalExpenseKrw) && totalExpenseKrw > 0;
}

function totalSubtitle(totalExpenseKrw: number | null | undefined): string {
  if (!milestoneSubtitleShowsTotal(totalExpenseKrw)) {
    return "기록을 남기면 그날까지의 지출을 함께 모아드릴게요.";
  }
  // "함께한"이 아니라 "총" — 임신기부터의 전 기간 누적임을 문구가 스스로 말한다(F5).
  return `지금까지 총 지출 ${formatKrw(totalExpenseKrw)}`;
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

  // F1: 눌렀을 때 열릴 리포트는 카운트다운이 아니라 **리포트 탭의 판정**이 정한다. 같은 함수를
  // 쓰므로 임계값이 갈릴 수 없고, CTA가 그 결과를 그대로 예고한다.
  const reportMilestone: HomeMilestone = selectMilestoneReportType({
    birthDate: input.birthDate,
    todayIso: input.todayIso
  });
  const ctaLabel = `${MILESTONE_LABEL[reportMilestone]} 리포트 보기`;

  return {
    milestone,
    targetDateIso,
    daysRemaining,
    title,
    subtitle,
    reportMilestone,
    ctaLabel,
    accessibilityLabel: `${spokenTitle}. ${subtitle}. ${ctaLabel}`
  };
}
