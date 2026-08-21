/**
 * A11Y-117 — 기록/리포트 기간 이동(월·분기·연)의 순수 로직.
 *
 * 두 화면(app/(tabs)/records.tsx, app/(tabs)/reports.tsx) 모두 "offset 0 = 현재 기간"인 정수
 * 오프셋 하나로 기간을 이동한다. 이 모듈은 그 오프셋에 대한 두 가지 계산만 담당한다:
 *
 * 1. 미래 상한 판정 — 현재 기간(이번 달/분기/연) 이후로는 "다음" 이동을 막는다(미래의 빈
 *    화면으로 무한히 넘어가는 문제 제거). 화면은 이 판정으로 다음 화살표를
 *    disabled(accessibilityState + 시각적 dim) 처리한다.
 * 2. 오프셋 → 한국어 기간 라벨 — 화면에 보이는 라벨("2026년 8월"/"2026년 3분기"/"2026년")과
 *    동일한 문자열을 임의 오프셋에 대해 계산한다. 이동 직후 announceForA11y로 새 기간을
 *    읽어줄 때, 아직 state에 반영되지 않은 "다음 오프셋"의 라벨이 필요하기 때문이다.
 *
 * React/날짜 라이브러리/저장소 의존이 없는 순수 계산이므로 vitest 단위 테스트 대상이다
 * (src/period-navigation.test.ts).
 */

export type PeriodUnit = "month" | "quarter" | "year";

/**
 * "다음" 이동이 허용되는지 판정한다. offset 0이 현재 기간이므로, 음수(과거)에서만 앞으로
 * 이동할 수 있고 0(현재)에서는 미래로 넘어갈 수 없다.
 */
export function canGoToNextPeriod(offset: number): boolean {
  return offset < 0;
}

/**
 * baseDate(현재 기간이 속한 날짜)와 단위 오프셋으로 화면 표시용 한국어 기간 라벨을 만든다.
 * records/reports가 인라인으로 계산하던 라벨과 동일한 형식을 유지한다:
 * - month:   "2026년 8월"
 * - quarter: "2026년 3분기" (baseDate가 속한 분기의 시작 + offset분기)
 * - year:    "2026년"
 */
export function periodLabelForOffset(baseDate: Date, unit: PeriodUnit, offset: number): string {
  if (unit === "month") {
    const date = new Date(baseDate.getFullYear(), baseDate.getMonth() + offset, 1);
    return `${date.getFullYear()}년 ${date.getMonth() + 1}월`;
  }
  if (unit === "quarter") {
    const quarterStartMonth = Math.floor(baseDate.getMonth() / 3) * 3;
    const date = new Date(baseDate.getFullYear(), quarterStartMonth + offset * 3, 1);
    return `${date.getFullYear()}년 ${Math.floor(date.getMonth() / 3) + 1}분기`;
  }
  return `${baseDate.getFullYear() + offset}년`;
}
