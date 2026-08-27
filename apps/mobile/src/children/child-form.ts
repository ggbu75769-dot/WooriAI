import {
  isFutureSeoulDate,
  isValidCalendarDate,
  type ChildStageCode,
  type ChildStageMode
} from "@wooriai/domain";
import type { UpdateChildBody } from "../api/client";

/**
 * MOB-118: shared child-profile form logic, extracted verbatim from the onboarding
 * child-profile screen (app/(onboarding)/child-profile.tsx, ONB-002) so the settings "아이 관리"
 * screen's edit/add forms validate exactly the same way the onboarding form does. The screen
 * keeps its own wiring (state, chips, submit) and imports these pure pieces.
 */

export const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;

// Domain's stage.ts defines an equivalent MANUAL_STAGE_LABELS map but does not export it from
// the package entrypoint, so this module defines its own Korean label mapping to reuse the
// domain's ChildStageCode values as the manual-selection chip list (moved here from ONB-002).
export const CHILD_STAGE_LABELS: Record<ChildStageCode, string> = {
  pregnancy_early: "임신 초기",
  pregnancy_mid: "임신 중기",
  pregnancy_late: "임신 후기",
  newborn_0_3: "신생아 (0-3개월)",
  infant_4_6: "영아 (4-6개월)",
  infant_7_12: "영아 (7-12개월)",
  toddler_1_3: "유아 (1-3세)",
  kid_4_7: "유아 (4-7세)",
  elementary: "초등학생",
  middle_school: "중학생"
};

/** Korean labels for the three stage modes, mirroring the onboarding ONB-001 option titles. */
export const CHILD_STAGE_MODE_OPTIONS: Array<{ mode: ChildStageMode; label: string }> = [
  { mode: "pregnant", label: "임신 중이에요" },
  { mode: "born", label: "아이가 태어났어요" },
  { mode: "manual", label: "단계를 직접 선택할게요" }
];

export function dateFieldLabel(stageMode: string | null) {
  if (stageMode === "pregnant") return "출산 예정일 (선택)";
  if (stageMode === "born") return "출생일 (선택)";
  return null;
}

/** Same as dateFieldLabel but without the "(선택)" suffix, for forms where the date is required
 * (editing an existing child: the server always has a date for pregnant/born children and
 * normalizeChildInput refuses to lose it). */
export function requiredDateFieldLabel(stageMode: string | null) {
  if (stageMode === "pregnant") return "출산 예정일";
  if (stageMode === "born") return "출생일";
  return null;
}

// Birth dates (stageMode "born") must not be in the future -- a due date (stageMode "pregnant")
// is expected to be in the future and is allowed to be in the past too (the parent may already
// have given birth), so only the calendar-validity check applies there.
export function computeDateError(stageMode: string | null, rawValue: string): string | null {
  const trimmed = rawValue.trim();
  if (trimmed.length === 0) return null;
  if (!isoDatePattern.test(trimmed)) return "날짜는 YYYY-MM-DD 형식으로 입력해 주세요.";
  if (!isValidCalendarDate(trimmed)) return "실제 존재하는 날짜인지 확인해 주세요.";
  if (stageMode === "born" && isFutureSeoulDate(trimmed)) return "출생일은 오늘보다 미래일 수 없어요.";
  return null;
}

export type ChildFormValues = {
  nickname: string;
  dateText: string;
  manualStage: ChildStageCode | null;
};

export type ChildFormErrors = {
  nicknameError: string | null;
  dateError: string | null;
  manualStageError: string | null;
};

/**
 * Full-form validation shared by the settings edit/add forms. `requireDate` makes an empty
 * pregnant/born date an error (used when editing: the server's normalizeChildInput always keeps
 * a date for those modes, so the form mirrors the server's own messages); the onboarding create
 * form's optional-date behavior corresponds to `requireDate: false`.
 */
export function validateChildForm(
  stageMode: ChildStageMode | null,
  values: ChildFormValues,
  options: { requireDate?: boolean } = {}
): ChildFormErrors {
  const nicknameError = values.nickname.trim().length === 0 ? "태명 또는 별명을 입력해 주세요." : null;
  let dateError = computeDateError(stageMode, values.dateText);
  if (!dateError && options.requireDate && values.dateText.trim().length === 0) {
    if (stageMode === "pregnant") dateError = "출산 예정일을 입력해 주세요.";
    if (stageMode === "born") dateError = "아이 생년월일을 입력해 주세요.";
  }
  const manualStageError = stageMode === "manual" && !values.manualStage ? "아이 단계를 하나 선택해 주세요." : null;
  return { nicknameError, dateError, manualStageError };
}

export function isChildFormValid(errors: ChildFormErrors): boolean {
  return !errors.nicknameError && !errors.dateError && !errors.manualStageError;
}

/**
 * CHILD-127: the PATCH body type, widened by the one field client.ts's `UpdateChildBody` does not
 * carry yet. `updateChild(token, id, body)` accepts this because the extra property arrives on a
 * typed value (not a fresh object literal), so TypeScript's excess-property check does not apply
 * and the field is serialized as-is.
 */
export type UpdateChildRequestBody = UpdateChildBody & { stageMode?: ChildStageMode };

/**
 * CHILD-127: which stage-mode transitions the server accepts on PATCH /children/:childId.
 * Only `pregnant → born` (the baby was actually born); the server answers anything else with
 * CHILD_STAGE_MODE_TRANSITION_NOT_ALLOWED, so the UI must never offer it.
 */
export function canTransitionStageMode(from: ChildStageMode | null, to: ChildStageMode): boolean {
  return from === "pregnant" && to === "born";
}

/** Copy for the 아이가 태어났어요 action and its confirmation (DNC-018 해요체). */
export const BORN_TRANSITION_ACTION_LABEL = "아이가 태어났어요";
export const BORN_TRANSITION_CONFIRM_TITLE = "출생일 기준으로 바꿀까요?";
export const BORN_TRANSITION_CONFIRM_MESSAGE =
  "출산예정일 기준으로 보여주던 화면이 출생일 기준으로 바뀌어요. 100일·첫돌 리포트도 볼 수 있게 돼요. 임신 중으로 되돌릴 수는 없어요.";
export const BORN_TRANSITION_CONFIRM_CTA = "네, 바꿀게요";

/**
 * Builds the PATCH /children/:childId body from the edit form. Only the field that matters for
 * the child's stageMode is sent alongside the nickname -- sending e.g. a dueDate for a born-mode
 * child would be rejected by the server's normalizeChildInput/whitelist contract.
 * An empty date is omitted (keep the stored one) rather than sent as "".
 *
 * CHILD-127: stageMode is no longer immutable, but it is also not a plain form field -- it only
 * moves through the explicit 아이가 태어났어요 action, which passes
 * `options.transitionToStageMode`. In that mode the body carries `stageMode` plus the new
 * birthDate (the server requires both in one request) and leaves dueDate untouched so the stored
 * due date survives the transition. Every other combination is a caller bug, not a user error, so
 * it throws rather than silently sending a body the server will reject.
 */
export function buildUpdateChildBody(
  stageMode: ChildStageMode,
  values: ChildFormValues,
  options: { transitionToStageMode?: ChildStageMode } = {}
): UpdateChildRequestBody {
  const trimmedDate = values.dateText.trim();
  const target = options.transitionToStageMode;

  if (target !== undefined && target !== stageMode) {
    if (!canTransitionStageMode(stageMode, target)) {
      throw new Error(`허용되지 않은 아이 상태 전환이에요: ${stageMode} -> ${target}`);
    }
    return {
      nickname: values.nickname.trim(),
      stageMode: target,
      ...(trimmedDate ? { birthDate: trimmedDate } : {})
    };
  }

  return {
    nickname: values.nickname.trim(),
    ...(stageMode === "pregnant" && trimmedDate ? { dueDate: trimmedDate } : {}),
    ...(stageMode === "born" && trimmedDate ? { birthDate: trimmedDate } : {}),
    ...(stageMode === "manual" && values.manualStage ? { manualStage: values.manualStage } : {})
  };
}

/** Builds the POST /children body from the add form -- same field mapping the onboarding
 * ONB-002 submit uses (see app/(onboarding)/child-profile.tsx). */
export function buildCreateChildBody(
  householdId: string,
  stageMode: ChildStageMode,
  values: ChildFormValues
): {
  householdId: string;
  nickname: string;
  stageMode: string;
  dueDate?: string;
  birthDate?: string;
  manualStage?: string | null;
} {
  const trimmedDate = values.dateText.trim();
  return {
    householdId,
    nickname: values.nickname.trim(),
    stageMode,
    dueDate: stageMode === "pregnant" && trimmedDate ? trimmedDate : undefined,
    birthDate: stageMode === "born" && trimmedDate ? trimmedDate : undefined,
    manualStage: stageMode === "manual" ? values.manualStage : undefined
  };
}
