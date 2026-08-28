import { PREGNANCY_OVERDUE_GRACE_DAYS } from "./baby-counter";
import { daysBetween, isDateOnly } from "./day-math";

/**
 * GAP-061 #10 — **임신 42주 고착**의 표시층 봉합.
 *
 * ## 무엇이 문제였나
 *
 * 단계 라벨은 서버(도메인)가 만든다: `calculateChildStage`가 예정일에서 주차를 세고
 * `임신 ${week}주차`를 돌려준다(packages/domain/src/stage.ts). 그 주차는 40주(=280일)를 기준으로
 * 세고 **42주에서 clamp**된다:
 *
 *   week = clamp(floor((280 - 남은 일수) / 7), 0, 42)
 *
 * 즉 예정일에서 **14일**이 지나면 week가 42에 닿고, 그 뒤로는 아무리 시간이 흘러도 값이 변하지
 * 않는다. 출생 전환을 하지 않은 프로필(예정일이 지났는데 여전히 `stageMode === "pregnant"`)에서는
 * 홈 헤더·설정 요약·아이 목록이 **몇 달이고 "임신 42주차"를 되풀이한다.** 이건 계산이 틀린 게
 * 아니라 **말하지 말아야 할 것을 계속 말하는** 문제다: 42주차는 그 사람의 지금이 아니라 우리가
 * 셀 수 있는 마지막 칸일 뿐인데, 화면은 그걸 현재 상태인 양 단언한다(허위 표시 금지).
 *
 * ## 규칙
 *
 * 유예(`PREGNANCY_OVERDUE_GRACE_DAYS` = 14일)를 넘긴 임신 프로필에서는 **주차를 표기하지 않고**
 * 달력 사실 한 줄로 바꾼다 — "예정일이 지났어요".
 *
 * 경계를 새로 만들지 않고 `baby-counter.ts`의 유예 판정을 그대로 재사용한다. 두 값이 우연히
 * 맞는 게 아니라 **같은 자리**다: 카운터가 "…를 곧 만나요"를 접는 날(D+15)이 곧 주차가 42에
 * 고착돼 더 이상 아무 정보도 싣지 못하게 되는 날이다. 그날부터 홈에는 카운터 대신 출생 전환
 * 입구(`evaluateBirthTransitionPrompt`의 `pregnancy-overdue-prompt`)만 남으므로, 헤더의 라벨도
 * 같은 시점에 같은 사실("예정일이 지났어요")을 말하게 된다.
 *
 * ## 하지 않는 것 (경계)
 *
 * - **도메인은 손대지 않는다.** `stageCode`(pregnancy_late)·주차 계산·서버 DTO는 그대로다.
 *   추천·준비템 밴드·리포트는 전부 stageCode로 돌아가므로 **기능은 한 칸도 달라지지 않는다** —
 *   준비템의 시기 밴드("0-6개월")도, "출산 전" 칩도 전환 전에는 여전히 참이라 그대로 산다.
 *   여기서 바꾸는 것은 **사람에게 읽어 주는 문장 하나**뿐이다.
 * - **경과 일수를 세지 않는다**(DNC-020). "예정일이 37일 지났어요"는 만들지 않는다 — 숫자를
 *   붙이는 순간 그건 달력 사실이 아니라 압박이 된다. 의료적 해석("41주가 넘으면 …")도 없다.
 * - **재촉·질책하지 않는다**(DNC-018). "아직 전환 안 하셨어요"가 아니라 일어난 일만 말한다.
 *   무엇을 할지는 홈의 전환 입구 한 줄이 이미 권하고 있고, 그 라벨은 사용자가 스스로 말하는
 *   형태("아이가 태어났어요")다.
 * - **출생 전환 입구(UX-T)는 불변**이다. 이 모듈은 판정을 새로 만들지 않고 라벨만 고른다.
 */

/** 유예를 넘긴 임신 프로필의 단계 라벨. 주차도, 경과 일수도 싣지 않는 달력 사실 한 줄. */
export const PREGNANCY_OVERDUE_STAGE_LABEL = "예정일이 지났어요";

export type StageDisplayLabelInput = {
  /** Child.stageMode — "pregnant" | "born" | "manual". */
  stageMode: string | null | undefined;
  /** Child.dueDate ("YYYY-MM-DD") — 임신 중이 아니면 null. */
  dueDate?: string | null;
  /** 서울 기준 오늘("YYYY-MM-DD") — 화면은 getSeoulToday()를 넘긴다. */
  todayIso: string;
  /** 서버/도메인이 계산한 단계 라벨. 여기서 다시 계산하지 않는다(단일 소스). */
  stageLabel: string | null | undefined;
};

/**
 * 주차 표기가 **더 이상 아무것도 말해 주지 않는 상태**인가. 임신 중이고 예정일이 유예를 넘겨
 * 지났을 때만 참이다. 날짜를 모르면(형식이 깨졌거나 비어 있으면) 항상 거짓 — 모르는 것을 근거로
 * 문장을 바꾸지 않는다.
 */
export function isPregnancyWeekLabelStale(input: Omit<StageDisplayLabelInput, "stageLabel">): boolean {
  if (input.stageMode !== "pregnant") return false;
  if (!isDateOnly(input.todayIso) || !isDateOnly(input.dueDate)) return false;
  const daysUntilDue = daysBetween(input.todayIso, input.dueDate);
  if (daysUntilDue === null) return false;
  return -daysUntilDue > PREGNANCY_OVERDUE_GRACE_DAYS;
}

/**
 * 화면에 그릴 단계 라벨 한 줄. 평소에는 서버가 준 `stageLabel`을 **그대로** 돌려주고, 유예를
 * 넘긴 임신 프로필에서만 주차 없는 사실 문구로 바꾼다.
 *
 * 라벨 자체가 비어 있으면 빈 문자열을 돌려준다 — 화면이 `null`을 그리려다 "null"을 찍는 일이
 * 없게 문자열 하나로 고정한다.
 */
export function resolveStageDisplayLabel(input: StageDisplayLabelInput): string {
  const label = typeof input.stageLabel === "string" ? input.stageLabel.trim() : "";
  if (!isPregnancyWeekLabelStale(input)) return label;
  return PREGNANCY_OVERDUE_STAGE_LABEL;
}
