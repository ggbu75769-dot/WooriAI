import { type ChildStageCode, type ChildStageMode, isChildStageCode } from "./enums";

const MANUAL_STAGE_LABELS: Record<ChildStageCode, string> = {
  pregnancy_early: "임신 초기",
  pregnancy_mid: "임신 중기",
  pregnancy_late: "임신 후기",
  newborn_0_3: "0~3개월",
  infant_4_6: "4~6개월",
  infant_7_12: "7~12개월",
  toddler_1_3: "1~3세",
  kid_4_7: "4~7세",
  elementary: "초등",
  middle_school: "중등"
};

type BaseStageInput = {
  stageMode: ChildStageMode;
  today?: string;
};

type PregnantStageInput = BaseStageInput & {
  stageMode: "pregnant";
  dueDate: string;
};

type BornStageInput = BaseStageInput & {
  stageMode: "born";
  birthDate: string;
};

type ManualStageInput = BaseStageInput & {
  stageMode: "manual";
  manualStage: ChildStageCode;
};

export type CalculateChildStageInput = PregnantStageInput | BornStageInput | ManualStageInput;

export type CalculatedChildStage =
  | {
      stageCode: ChildStageCode;
      stageLabel: string;
      pregnancyWeek: number;
    }
  | {
      stageCode: ChildStageCode;
      stageLabel: string;
      ageMonths: number;
    }
  | {
      stageCode: ChildStageCode;
      stageLabel: string;
      manual: true;
      recommendationAccuracyNotice: string;
    };

export function calculateChildStage(input: CalculateChildStageInput): CalculatedChildStage {
  if (input.stageMode === "manual") {
    if (!isChildStageCode(input.manualStage)) {
      throw new Error("CHILD_STAGE_INVALID");
    }

    return {
      stageCode: input.manualStage,
      stageLabel: `수동 선택: ${MANUAL_STAGE_LABELS[input.manualStage]}`,
      manual: true,
      recommendationAccuracyNotice: "수동 단계라 추천 정확도가 조금 낮을 수 있어요."
    };
  }

  const today = input.today ?? toDateOnly(new Date());

  if (input.stageMode === "pregnant") {
    const daysRemaining = differenceInCalendarDays(input.dueDate, today);
    const pregnancyWeek = clamp(Math.floor((280 - daysRemaining) / 7), 0, 42);

    return {
      stageCode: pregnancyWeekToStageCode(pregnancyWeek),
      stageLabel: `임신 ${pregnancyWeek}주차`,
      pregnancyWeek
    };
  }

  const ageMonths = Math.max(0, completedMonthsBetween(input.birthDate, today));

  return {
    stageCode: ageMonthsToStageCode(ageMonths),
    stageLabel: `생후 ${ageMonths}개월`,
    ageMonths
  };
}

function pregnancyWeekToStageCode(week: number): ChildStageCode {
  if (week < 13) {
    return "pregnancy_early";
  }

  if (week < 28) {
    return "pregnancy_mid";
  }

  return "pregnancy_late";
}

function ageMonthsToStageCode(ageMonths: number): ChildStageCode {
  if (ageMonths <= 3) {
    return "newborn_0_3";
  }

  if (ageMonths <= 6) {
    return "infant_4_6";
  }

  if (ageMonths <= 12) {
    return "infant_7_12";
  }

  if (ageMonths <= 47) {
    return "toddler_1_3";
  }

  if (ageMonths <= 95) {
    return "kid_4_7";
  }

  if (ageMonths <= 155) {
    return "elementary";
  }

  return "middle_school";
}

function completedMonthsBetween(fromDate: string, toDate: string): number {
  const from = parseDateOnly(fromDate);
  const to = parseDateOnly(toDate);
  let months = (to.year - from.year) * 12 + (to.month - from.month);

  if (to.day < from.day) {
    months -= 1;
  }

  return months;
}

function differenceInCalendarDays(laterDate: string, earlierDate: string): number {
  const later = dateOnlyToUtcMs(laterDate);
  const earlier = dateOnlyToUtcMs(earlierDate);
  return Math.round((later - earlier) / 86_400_000);
}

function dateOnlyToUtcMs(value: string): number {
  const { year, month, day } = parseDateOnly(value);
  return Date.UTC(year, month - 1, day);
}

function parseDateOnly(value: string): { year: number; month: number; day: number } {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (!match) {
    throw new Error("DATE_INVALID");
  }

  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3])
  };
}

function toDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
