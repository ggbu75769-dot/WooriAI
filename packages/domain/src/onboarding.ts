import { CHILD_STAGE_CODES, CHILD_STAGE_MODES, type ChildStageCode, type ChildStageMode } from "./enums";
import { getSeoulToday, isValidCalendarDate } from "./money-date";

export const CHILD_SEX_VALUES = ["male", "female", "unknown"] as const;
export type ChildSex = (typeof CHILD_SEX_VALUES)[number];

export const PREPARED_STEP_STATES = ["not_started", "selected", "skipped", "completed_none"] as const;
export type PreparedStepState = (typeof PREPARED_STEP_STATES)[number];
const FINAL_PREPARED_STEP_STATES = ["selected", "skipped", "completed_none"] as const;
export const DEFAULT_MONTHLY_BUDGET_WON = 500_000;

export type OnboardingCurrentStep =
  | "child-status"
  | "pregnant"
  | "born"
  | "direct-stage"
  | "prepared-items"
  | "budget"
  | "review";

export type OnboardingDraft = {
  schemaVersion: 3;
  version: number;
  userId: string;
  householdId: string;
  selectedPath: ChildStageMode | null;
  childName: string;
  dueDate: string | null;
  birthDate: string | null;
  manualStage: ChildStageCode | null;
  stageOverride: boolean;
  sex: ChildSex | null;
  preparedItemIds: string[];
  preparedStepState: PreparedStepState;
  monthlyBudgetWon: number | null;
  monthlyBudgetEdited: boolean;
  currentStep: OnboardingCurrentStep;
  finalSubmitIdempotencyKey: string;
  updatedAt: string;
  expiresAt: string;
};

export type OnboardingCompletionInput = {
  householdId: string;
  draftVersion: number;
  child: {
    nickname: string;
    stageMode: ChildStageMode;
    dueDate?: string;
    birthDate?: string;
    manualStage?: ChildStageCode;
    stageOverride: boolean;
    gender: ChildSex;
  };
  prepared: {
    state: Exclude<PreparedStepState, "not_started">;
    itemDefinitionIds: string[];
  };
  budget: { yearMonth: string; amountKrw: number } | null;
};

export type OnboardingReadiness = {
  ready: boolean;
  errors: string[];
};

export class OnboardingDraftNotReadyError extends Error {
  readonly code = "ONBOARDING_DRAFT_INCOMPLETE";

  constructor(readonly errors: string[]) {
    super(`ONBOARDING_DRAFT_INCOMPLETE:${errors.join(",")}`);
    this.name = "OnboardingDraftNotReadyError";
  }
}

export type OnboardingContractErrorCode =
  | "ONBOARDING_DRAFT_CONFLICT"
  | "ONBOARDING_PATH_INVALID"
  | "CHILD_NAME_REQUIRED"
  | "CHILD_NAME_INVALID"
  | "CHILD_SEX_INVALID"
  | "BIRTH_DATE_INVALID"
  | "DUE_DATE_INVALID"
  | "ONBOARDING_PATH_FIELDS_INCOMPATIBLE"
  | "MANUAL_STAGE_REQUIRED"
  | "MANUAL_STAGE_INVALID"
  | "BUDGET_INVALID"
  | "PREPARED_STATE_INVALID";

export class OnboardingContractError extends Error {
  constructor(readonly code: OnboardingContractErrorCode) {
    super(code);
    this.name = "OnboardingContractError";
  }
}

export type OnboardingStarterRankInput = {
  id: string;
  code: string;
  lifecycleRelevance: number;
  onboardingPriority: number;
  necessity: "required" | "recommended" | "conditional" | "optional";
};

const ONBOARDING_NECESSITY_RANK = { required: 0, recommended: 1, conditional: 2, optional: 3 } as const;

export function rankOnboardingStarterItems<T extends OnboardingStarterRankInput>(items: readonly T[]): T[] {
  return [...items].sort((left, right) =>
    right.lifecycleRelevance - left.lifecycleRelevance ||
    right.onboardingPriority - left.onboardingPriority ||
    ONBOARDING_NECESSITY_RANK[left.necessity] - ONBOARDING_NECESSITY_RANK[right.necessity] ||
    left.code.localeCompare(right.code)
  );
}

export function onboardingStarterAvailability(eligibleCount: number, minimum = 10) {
  return eligibleCount >= minimum
    ? { availability: "available" as const, blockerCode: null }
    : { availability: "external_blocked" as const, blockerCode: "EXTERNAL_BLOCKED_ONBOARDING_CATALOG" as const };
}

export function createEmptyOnboardingDraft(
  userId: string,
  householdId: string,
  seed: { nowIso: string; expiresAt: string; idempotencyKey: string } = {
    nowIso: "2000-01-01T00:00:00.000Z",
    expiresAt: "2099-01-01T00:00:00.000Z",
    idempotencyKey: "onboarding-final-test-seed"
  }
): OnboardingDraft {
  return {
    schemaVersion: 3,
    version: 1,
    userId,
    householdId,
    selectedPath: null,
    childName: "",
    dueDate: null,
    birthDate: null,
    manualStage: null,
    stageOverride: false,
    sex: null,
    preparedItemIds: [],
    preparedStepState: "not_started",
    monthlyBudgetWon: DEFAULT_MONTHLY_BUDGET_WON,
    monthlyBudgetEdited: false,
    currentStep: "child-status",
    finalSubmitIdempotencyKey: seed.idempotencyKey,
    updatedAt: seed.nowIso,
    expiresAt: seed.expiresAt
  };
}

export function normalizeOnboardingPathChange(
  draft: OnboardingDraft,
  selectedPath: ChildStageMode | null,
  nowIso = draft.updatedAt
): OnboardingDraft {
  const pathChanged = selectedPath !== draft.selectedPath;
  const currentStep: OnboardingCurrentStep =
    selectedPath === "pregnant"
      ? "pregnant"
      : selectedPath === "born"
        ? "born"
        : selectedPath === "manual"
          ? "direct-stage"
          : "child-status";

  return {
    ...draft,
    version: draft.version + 1,
    selectedPath,
    dueDate: selectedPath === "pregnant" ? draft.dueDate : null,
    birthDate: selectedPath === "born" || selectedPath === "manual" ? draft.birthDate : null,
    manualStage: selectedPath === "manual" ? draft.manualStage : null,
    stageOverride: selectedPath === "manual" ? draft.stageOverride : false,
    preparedItemIds: pathChanged ? [] : draft.preparedItemIds,
    preparedStepState: pathChanged ? "not_started" : draft.preparedStepState,
    currentStep,
    updatedAt: nowIso
  };
}

export function normalizeOnboardingCompletionInput(
  input: OnboardingCompletionInput,
  today = getSeoulToday()
): OnboardingCompletionInput {
  if (!Number.isInteger(input.draftVersion) || input.draftVersion < 1) {
    throw new OnboardingContractError("ONBOARDING_DRAFT_CONFLICT");
  }
  if (!CHILD_STAGE_MODES.includes(input.child.stageMode)) {
    throw new OnboardingContractError("ONBOARDING_PATH_INVALID");
  }
  const nickname = input.child.nickname.trim();
  if (!nickname) throw new OnboardingContractError("CHILD_NAME_REQUIRED");
  if (nickname.length > 60) throw new OnboardingContractError("CHILD_NAME_INVALID");
  if (!CHILD_SEX_VALUES.includes(input.child.gender)) {
    throw new OnboardingContractError("CHILD_SEX_INVALID");
  }
  if (input.child.manualStage && !CHILD_STAGE_CODES.includes(input.child.manualStage)) {
    throw new OnboardingContractError("MANUAL_STAGE_INVALID");
  }
  if (input.child.birthDate && (!isValidCalendarDate(input.child.birthDate) || input.child.birthDate > today)) {
    throw new OnboardingContractError("BIRTH_DATE_INVALID");
  }
  if (input.child.dueDate && !isValidCalendarDate(input.child.dueDate)) {
    throw new OnboardingContractError("DUE_DATE_INVALID");
  }

  if (input.child.stageMode === "pregnant") {
    if (!input.child.dueDate || input.child.birthDate || input.child.manualStage || input.child.stageOverride) {
      throw new OnboardingContractError("ONBOARDING_PATH_FIELDS_INCOMPATIBLE");
    }
  } else if (input.child.stageMode === "born") {
    if (!input.child.birthDate || input.child.dueDate || input.child.manualStage || input.child.stageOverride) {
      throw new OnboardingContractError("ONBOARDING_PATH_FIELDS_INCOMPATIBLE");
    }
  } else {
    if (!input.child.manualStage || !input.child.stageOverride) {
      throw new OnboardingContractError("MANUAL_STAGE_REQUIRED");
    }
    const pregnancyStage = input.child.manualStage.startsWith("pregnancy_");
    if (pregnancyStage ? !input.child.dueDate || Boolean(input.child.birthDate) : !input.child.birthDate || Boolean(input.child.dueDate)) {
      throw new OnboardingContractError("ONBOARDING_PATH_FIELDS_INCOMPATIBLE");
    }
  }

  const selectedIds = [...new Set(input.prepared.itemDefinitionIds)];
  if (!FINAL_PREPARED_STEP_STATES.includes(input.prepared.state)
    || selectedIds.length > 12
    || (input.prepared.state === "selected") !== (selectedIds.length > 0)) {
    throw new OnboardingContractError("PREPARED_STATE_INVALID");
  }
  if (input.budget && (!/^\d{4}-(0[1-9]|1[0-2])$/.test(input.budget.yearMonth)
    || !Number.isInteger(input.budget.amountKrw)
    || input.budget.amountKrw < 1)) {
    throw new OnboardingContractError("BUDGET_INVALID");
  }
  return {
    ...input,
    child: { ...input.child, nickname },
    prepared: { ...input.prepared, itemDefinitionIds: selectedIds }
  };
}

export function formatChildAgeKorean(birthDate: string, today = getSeoulToday()): string {
  const from = parseDateOnly(birthDate);
  const to = parseDateOnly(today);
  const days = calendarDayDifference(from, to);
  if (days < 0) throw new Error("BIRTH_DATE_FUTURE");
  if (days < 31) return `생후 ${days}일`;

  const months = completedMonths(from, to);
  if (months < 24) return `생후 ${months}개월`;
  return `만 ${completedYears(from, to)}세`;
}

export function validateOnboardingDraft(draft: OnboardingDraft, today = getSeoulToday()): string[] {
  const errors: string[] = [];
  if (!draft.selectedPath) return ["ONBOARDING_PATH_REQUIRED"];
  if (!draft.childName.trim()) errors.push("CHILD_NAME_REQUIRED");
  if (!draft.sex) errors.push("CHILD_SEX_REQUIRED");

  if (draft.selectedPath === "pregnant") {
    if (!draft.dueDate || !isValidCalendarDate(draft.dueDate)) errors.push("DUE_DATE_REQUIRED");
    if (draft.birthDate) errors.push("BIRTH_DATE_INCOMPATIBLE");
  }

  if (draft.selectedPath === "born") {
    if (!draft.birthDate || !isValidCalendarDate(draft.birthDate)) errors.push("BIRTH_DATE_REQUIRED");
    else if (draft.birthDate > today) errors.push("BIRTH_DATE_FUTURE");
    if (draft.dueDate) errors.push("DUE_DATE_INCOMPATIBLE");
  }

  if (draft.selectedPath === "manual") {
    if (!draft.manualStage) errors.push("MANUAL_STAGE_REQUIRED");
    if (!draft.stageOverride) errors.push("MANUAL_STAGE_OVERRIDE_REQUIRED");
    const pregnancyStage = draft.manualStage?.startsWith("pregnancy_") ?? false;
    if (pregnancyStage && (!draft.dueDate || !isValidCalendarDate(draft.dueDate))) errors.push("DUE_DATE_REQUIRED");
    if (!pregnancyStage && (!draft.birthDate || !isValidCalendarDate(draft.birthDate))) errors.push("BIRTH_DATE_REQUIRED");
    if (!pregnancyStage && draft.birthDate && draft.birthDate > today) errors.push("BIRTH_DATE_FUTURE");
    if (pregnancyStage && draft.birthDate) errors.push("BIRTH_DATE_INCOMPATIBLE");
    if (!pregnancyStage && draft.dueDate) errors.push("DUE_DATE_INCOMPATIBLE");
  }

  return [...new Set(errors)];
}

export function getOnboardingReadiness(draft: OnboardingDraft, today = getSeoulToday()): OnboardingReadiness {
  const errors = validateOnboardingDraft(draft, today);
  const preparedIds = [...new Set(draft.preparedItemIds)];

  if (draft.preparedStepState === "not_started") errors.push("PREPARED_STEP_REQUIRED");
  if (draft.preparedStepState === "selected" && (preparedIds.length === 0 || preparedIds.length > 12)) {
    errors.push("PREPARED_STATE_INVALID");
  }
  if ((draft.preparedStepState === "skipped" || draft.preparedStepState === "completed_none") && preparedIds.length > 0) {
    errors.push("PREPARED_STATE_INVALID");
  }

  if (draft.monthlyBudgetWon === null) {
    if (!draft.monthlyBudgetEdited) errors.push("BUDGET_DECISION_REQUIRED");
  } else if (!Number.isSafeInteger(draft.monthlyBudgetWon) || draft.monthlyBudgetWon < 1) {
    errors.push("BUDGET_INVALID");
  }

  const uniqueErrors = [...new Set(errors)];
  return { ready: uniqueErrors.length === 0, errors: uniqueErrors };
}

export function buildOnboardingCompletionInput(
  draft: OnboardingDraft,
  today = getSeoulToday()
): OnboardingCompletionInput {
  const readiness = getOnboardingReadiness(draft, today);
  if (!readiness.ready || !draft.selectedPath || !draft.sex || draft.preparedStepState === "not_started") {
    throw new OnboardingDraftNotReadyError(readiness.errors);
  }

  return normalizeOnboardingCompletionInput({
    householdId: draft.householdId,
    draftVersion: draft.version,
    child: {
      nickname: draft.childName.trim(),
      stageMode: draft.selectedPath,
      ...(draft.dueDate ? { dueDate: draft.dueDate } : {}),
      ...(draft.birthDate ? { birthDate: draft.birthDate } : {}),
      ...(draft.manualStage ? { manualStage: draft.manualStage } : {}),
      stageOverride: draft.stageOverride,
      gender: draft.sex
    },
    prepared: {
      state: draft.preparedStepState,
      itemDefinitionIds: draft.preparedStepState === "selected" ? draft.preparedItemIds : []
    },
    budget: draft.monthlyBudgetWon === null
      ? null
      : { yearMonth: today.slice(0, 7), amountKrw: draft.monthlyBudgetWon }
  }, today);
}

function parseDateOnly(value: string): { year: number; month: number; day: number } {
  if (!isValidCalendarDate(value)) throw new Error("DATE_INVALID");
  const [year, month, day] = value.split("-").map(Number);
  return { year: year!, month: month!, day: day! };
}

function calendarDayDifference(
  from: { year: number; month: number; day: number },
  to: { year: number; month: number; day: number }
): number {
  return Math.round(
    (Date.UTC(to.year, to.month - 1, to.day) - Date.UTC(from.year, from.month - 1, from.day)) / 86_400_000
  );
}

function completedMonths(
  from: { year: number; month: number; day: number },
  to: { year: number; month: number; day: number }
): number {
  let months = (to.year - from.year) * 12 + to.month - from.month;
  if (to.day < from.day) months -= 1;
  return Math.max(0, months);
}

function completedYears(
  from: { year: number; month: number; day: number },
  to: { year: number; month: number; day: number }
): number {
  let years = to.year - from.year;
  if (to.month < from.month || (to.month === from.month && to.day < from.day)) years -= 1;
  return Math.max(0, years);
}
