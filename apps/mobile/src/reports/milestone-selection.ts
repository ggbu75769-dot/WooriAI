import type { MilestoneReportType } from "../api/client";

/**
 * REP-127: 리포트 탭이 어떤 마일스톤 리포트를 부를지 고르는 순수 판정.
 *
 * 왜 필요한가 — 서버에는 `type=first-birthday`(첫돌) 리포트가 완전히 구현돼 있고
 * (apps/api/src/finance/milestone-report.service.ts) 클라 타입·공유 문구 빌더까지 있는데,
 * 화면이 `getMilestoneReport(..., "d100")`을 **하드코딩**해 첫돌이 지난 아이도 영영 100일
 * 리포트만 봤다. 만 한 살이 지난 시점의 사용자에게 100일 리포트는 이미 지난 이야기라, 서버에
 * 있는 기능이 UI에서 도달 불가능했다.
 *
 * 판정 규칙(서울 달력, 날짜 문자열 비교):
 *   첫돌 도달 = todayIso >= (birthDate + 1년)
 * 서버의 첫돌 창은 반열린 구간 [birthDate, birthDate+1년)이므로, 이 시점이면 창이 이미 다
 * 지나 partial=false인 **완결된** 첫돌 리포트가 나온다. 도달 전이라면 종전대로 d100을 부른다
 * (100일 미만이면 서버가 partial로 응답하고, birthDate가 없는 임신 중 아이는 종전과 똑같이
 * 400 MILESTONE_UNAVAILABLE → 카드 숨김).
 *
 * 1년 덧셈은 서버 milestone-report.service.ts의 `addYears`와 **같은 방식**(UTC
 * setUTCFullYear)이라 2월 29일이 윤년이 아닌 해에 3월 1일로 넘어가는 처리까지 일치한다.
 * 두 쪽이 어긋나면 "첫돌 리포트"를 열었는데 서버는 아직 partial을 주는 상태가 생긴다.
 */

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

function toUtcDate(dateOnly: string): Date {
  return new Date(`${dateOnly}T00:00:00.000Z`);
}

/** birthDate + 1 calendar year (첫돌 당일). 형식이 아니면 null. */
export function firstBirthdayOf(birthDate: string | null | undefined): string | null {
  if (!birthDate || !DATE_ONLY.test(birthDate)) return null;
  const date = toUtcDate(birthDate);
  if (Number.isNaN(date.getTime())) return null;
  date.setUTCFullYear(date.getUTCFullYear() + 1);
  return date.toISOString().slice(0, 10);
}

export type MilestoneSelectionInput = {
  /** Child.birthDate (YYYY-MM-DD). 임신 중/미입력이면 null. */
  birthDate: string | null | undefined;
  /** 서울 달력 오늘 (getSeoulToday()). */
  todayIso: string;
};

export function hasReachedFirstBirthday(input: MilestoneSelectionInput): boolean {
  const firstBirthday = firstBirthdayOf(input.birthDate);
  if (!firstBirthday) return false;
  if (!DATE_ONLY.test(input.todayIso)) return false;
  return input.todayIso >= firstBirthday;
}

/** 첫돌이 지났으면 첫돌 리포트를, 아니면(생년월일이 없어도) 종전대로 100일 리포트를 부른다. */
export function selectMilestoneReportType(input: MilestoneSelectionInput): MilestoneReportType {
  return hasReachedFirstBirthday(input) ? "first-birthday" : "d100";
}
