import type { ChildStageCode, ChildStageMode } from "./enums";
import {
  childLifecycleCodes,
  motherLifecycleCodes,
  type CatalogScenarioCode,
  type Release4LifecycleCode
} from "./release4-catalog";
import { isValidCalendarDate } from "./money-date";

export type PreparationLifecycleInput = {
  stageMode: ChildStageMode;
  dueDate?: string | null;
  birthDate?: string | null;
  manualStage?: ChildStageCode | null;
  today: string;
};

export type PreparationLifecycleResult =
  | {
      available: true;
      axis: "mother" | "child";
      code: Release4LifecycleCode;
      nextCode: Release4LifecycleCode | null;
    }
  | {
      available: false;
      reason: "INSUFFICIENT_STAGE_DATA";
    };

export type PreparationRecommendationReasonCode =
  | "DUE_WINDOW"
  | "LIFECYCLE_MATCH"
  | "FIRST_CHILD_CONTEXT"
  | "REPLACEMENT_DUE"
  | "RECURRING_PURCHASE_DUE"
  | "USER_SELECTED_BUNDLE";

export type PreparationRecommendationReasonParams = {
  lifecycleLabel?: string;
  nextLifecycleLabel?: string;
  dueWindowLabel?: string;
  contextLabels?: string[];
  bundleName?: string;
};

export type PreparationRecommendationReason = {
  recommendationReasonCode: PreparationRecommendationReasonCode;
  recommendationReasonParams: PreparationRecommendationReasonParams;
  recommendationReason: string;
};

const lifecycleLabels: Record<Release4LifecycleCode, string> = {
  pregnancy_planning: "임신 준비",
  pregnancy_early: "임신 초기",
  pregnancy_mid: "임신 중기",
  pregnancy_late: "임신 후기",
  labor_delivery: "출산",
  postpartum_0_6w: "산후 0~6주",
  postpartum_7_12w: "산후 7~12주",
  postpartum_3_12m: "산후 3~12개월",
  feeding_ongoing: "수유 중",
  newborn_0_3m: "신생아 0~3개월",
  infant_4_6m: "영아 4~6개월",
  infant_7_12m: "영아 7~12개월",
  toddler_1_2y: "유아 1세",
  toddler_2_3y: "유아 2~3세",
  preschool_4_5y: "유치원 4~5세",
  preschool_6_7y: "취학 전 6~7세",
  elementary_lower: "초등 저학년",
  elementary_upper: "초등 고학년",
  middle_school: "중학생"
};

const scenarioLabels: Record<CatalogScenarioCode, string> = {
  first_child: "첫째 아이",
  second_or_later: "둘째 이상",
  multiple_birth: "다태아",
  preterm_or_nicu: "미숙아·NICU",
  vaginal_delivery: "질식 분만",
  cesarean_delivery: "제왕절개",
  breastfeeding: "모유수유",
  formula_feeding: "분유수유",
  mixed_feeding: "혼합수유",
  daycare: "어린이집",
  kindergarten: "유치원",
  school: "학교",
  car_primary: "차량 이동",
  public_transport_primary: "대중교통 이동",
  no_car: "차량 없음",
  no_elevator: "엘리베이터 없음",
  small_home: "작은 집",
  pet_household: "반려동물과 생활",
  secondhand_preferred: "중고 선호",
  rental_preferred: "대여 선호",
  frequent_travel: "잦은 여행",
  summer_birth: "여름 출산·생일",
  winter_birth: "겨울 출산·생일",
  budget_saving: "절약 중심"
};

const manualLifecycle: Record<ChildStageCode, Release4LifecycleCode> = {
  pregnancy_early: "pregnancy_early",
  pregnancy_mid: "pregnancy_mid",
  pregnancy_late: "pregnancy_late",
  newborn_0_3: "newborn_0_3m",
  infant_4_6: "infant_4_6m",
  infant_7_12: "infant_7_12m",
  toddler_1_3: "toddler_1_2y",
  kid_4_7: "preschool_4_5y",
  elementary: "elementary_lower",
  middle_school: "middle_school"
};

export function calculatePreparationLifecycle(input: PreparationLifecycleInput): PreparationLifecycleResult {
  assertDate(input.today);

  if (input.stageMode === "pregnant") {
    if (!input.dueDate) return { available: false, reason: "INSUFFICIENT_STAGE_DATA" };
    assertDate(input.dueDate);
    const gestationalDays = 280 - differenceInCalendarDays(input.dueDate, input.today);
    const code = gestationalDays < 98
      ? "pregnancy_early"
      : gestationalDays < 196
        ? "pregnancy_mid"
        : gestationalDays < 259
          ? "pregnancy_late"
          : "labor_delivery";
    return lifecycleResult("mother", code);
  }

  if (input.stageMode === "born") {
    if (!input.birthDate) return { available: false, reason: "INSUFFICIENT_STAGE_DATA" };
    assertDate(input.birthDate);
    const ageMonths = Math.max(0, completedMonthsBetween(input.birthDate, input.today));
    const code = ageMonths < 4
      ? "newborn_0_3m"
      : ageMonths < 7
        ? "infant_4_6m"
        : ageMonths < 13
          ? "infant_7_12m"
          : ageMonths < 24
            ? "toddler_1_2y"
            : ageMonths < 48
              ? "toddler_2_3y"
              : ageMonths < 72
                ? "preschool_4_5y"
                : ageMonths < 96
                  ? "preschool_6_7y"
                  : ageMonths < 132
                    ? "elementary_lower"
                    : ageMonths < 156
                      ? "elementary_upper"
                      : "middle_school";
    return lifecycleResult("child", code);
  }

  if (!input.manualStage) return { available: false, reason: "INSUFFICIENT_STAGE_DATA" };
  const code = manualLifecycle[input.manualStage];
  return lifecycleResult(code.startsWith("pregnancy_") ? "mother" : "child", code);
}

export function lifecycleLabelKo(code: Release4LifecycleCode | null | undefined): string | null {
  return code ? lifecycleLabels[code] : null;
}

export function scenarioLabelKo(code: CatalogScenarioCode): string {
  return scenarioLabels[code];
}

export function buildPreparationRecommendationReason(input: {
  lifecycleCode: Release4LifecycleCode;
  nextLifecycleCode: Release4LifecycleCode | null;
  matchedContextCodes: CatalogScenarioCode[];
  bucket: "this_week" | "this_month" | "next_stage" | "overdue" | "completed" | "not_needed";
  dueWindow: { label: string; derivedFrom: "lifecycle" | "user_due" | "replacement" | "repeat_purchase" };
}): PreparationRecommendationReason {
  const contextLabels = input.matchedContextCodes.map(scenarioLabelKo);
  const params: PreparationRecommendationReasonParams = {
    lifecycleLabel: lifecycleLabelKo(input.lifecycleCode) ?? undefined,
    nextLifecycleLabel: lifecycleLabelKo(input.nextLifecycleCode) ?? undefined,
    dueWindowLabel: input.dueWindow.label,
    ...(contextLabels.length ? { contextLabels } : {})
  };
  const recommendationReasonCode = input.dueWindow.derivedFrom === "replacement"
    ? "REPLACEMENT_DUE"
    : input.dueWindow.derivedFrom === "repeat_purchase"
      ? "RECURRING_PURCHASE_DUE"
      : input.dueWindow.derivedFrom === "user_due"
        ? "DUE_WINDOW"
        : input.matchedContextCodes.includes("first_child")
          ? "FIRST_CHILD_CONTEXT"
          : "LIFECYCLE_MATCH";
  return {
    recommendationReasonCode,
    recommendationReasonParams: params,
    recommendationReason: formatPreparationRecommendationReasonKo(recommendationReasonCode, params, input.bucket)
  };
}

export function formatPreparationRecommendationReasonKo(
  code: PreparationRecommendationReasonCode,
  params: PreparationRecommendationReasonParams,
  bucket?: "this_week" | "this_month" | "next_stage" | "overdue" | "completed" | "not_needed"
): string {
  const contextSuffix = params.contextLabels?.length ? ` ${params.contextLabels.join(", ")} 상황에도 맞아요.` : "";
  if (code === "REPLACEMENT_DUE") return `${params.dueWindowLabel ?? "교체 예정일"}이 가까워졌어요.${contextSuffix}`;
  if (code === "RECURRING_PURCHASE_DUE") return `${params.dueWindowLabel ?? "다음 구매일"}에 다시 준비할 품목이에요.${contextSuffix}`;
  if (code === "DUE_WINDOW") return `${params.dueWindowLabel ?? "정한 날짜"}에 맞춰 준비해 주세요.${contextSuffix}`;
  if (code === "FIRST_CHILD_CONTEXT") return `첫째 아이 준비 항목으로 추천했어요.${contextSuffix}`;
  if (code === "USER_SELECTED_BUNDLE") return `${params.bundleName ?? "선택한 준비 묶음"}에 포함된 항목이에요.`;
  if (bucket === "next_stage" && params.nextLifecycleLabel) {
    return `${params.nextLifecycleLabel} 단계에 미리 확인할 항목이에요.${contextSuffix}`;
  }
  return `${params.lifecycleLabel ?? "현재 성장"} 단계에 필요한 항목이에요.${contextSuffix}`;
}

function lifecycleResult(
  axis: "mother" | "child",
  code: Release4LifecycleCode
): Extract<PreparationLifecycleResult, { available: true }> {
  const order = axis === "mother" ? motherLifecycleCodes : childLifecycleCodes;
  const index = (order as readonly Release4LifecycleCode[]).indexOf(code);
  return {
    available: true,
    axis,
    code,
    nextCode: index >= 0 ? order[index + 1] ?? null : null
  };
}

function completedMonthsBetween(fromDate: string, toDate: string): number {
  const from = parseDate(fromDate);
  const to = parseDate(toDate);
  let months = (to.year - from.year) * 12 + to.month - from.month;
  if (to.day < from.day) months -= 1;
  return months;
}

function differenceInCalendarDays(laterDate: string, earlierDate: string): number {
  return Math.round((dateOnlyToUtcMs(laterDate) - dateOnlyToUtcMs(earlierDate)) / 86_400_000);
}

function dateOnlyToUtcMs(value: string): number {
  const { year, month, day } = parseDate(value);
  return Date.UTC(year, month - 1, day);
}

function parseDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return { year, month, day };
}

function assertDate(value: string) {
  if (!isValidCalendarDate(value)) throw new Error("DATE_INVALID");
}
