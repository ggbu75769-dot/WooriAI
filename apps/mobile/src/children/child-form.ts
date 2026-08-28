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

/**
 * 라운드 65 F(정찰 P3) — `dateFieldLabel`("출산 예정일 **(선택)**" / "출생일 (선택)")을 **지웠다.**
 *
 * 제품 코드 참조가 0건이었다(모든 폼이 아래 `requiredDateFieldLabel`을 쓴다). 지운 이유는 죽어
 * 있어서만이 아니라 **지금 화면과 반대되는 사실을 말하고 있어서**다: 온보딩(ONB-002)은
 * `validateChildForm(..., { requireDate: true })`로 날짜를 **필수**로 받고, 아이 관리(SET-005)도
 * 같다. 그런데 그 함수의 유일한 소비자였던 `child-form.test.ts`가 "(선택)"을 값으로 못박고
 * 있어서, 남겨 두면 다음 사람이 "이 칸은 선택이었구나"로 읽는 근거가 된다(테스트는 저장소가
 * 자기 사실을 적어 두는 자리다).
 */

/** 날짜 칸의 라벨. 날짜는 세 폼 모두에서 필수라 접미사가 없다 — 단계를 직접 고른 경우엔 칸 자체가 없다. */
export function requiredDateFieldLabel(stageMode: string | null) {
  if (stageMode === "pregnant") return "출산 예정일";
  if (stageMode === "born") return "출생일";
  return null;
}

/**
 * 라운드 65 D — 이 날짜 칸의 달력이 **어느 쪽으로 열리는가**.
 *
 * 온보딩(ONB-002)·아이 관리(SET-005)의 날짜 칸은 지출 화면과 같은 달력 픽커를 쓴다
 * (src/expenses/ExpenseDatePicker.tsx — 달력을 두 벌로 만들지 않는다). 그 픽커는 기본이
 * "미래는 못 고름"인데, **출산 예정일은 미래여야 한다** — 그래서 이 한 줄이 방향을 정한다.
 *
 * 판정 근거는 바로 아래 `computeDateError`와 같다: 출생일만 미래가 금지돼 있고(서버도 같은
 * 규칙이다), 예정일에는 그 금지가 없다. 두 곳이 갈리면 픽커에서 고른 날짜가 저장 직전 가드에
 * 걸리거나, 반대로 가드가 받는 날짜를 달력이 잠그게 된다.
 *
 * 반환 타입은 픽커의 `ExpenseDatePickerDirection`과 같은 두 값이다 — 이 모듈이 지출 폴더를
 * import하지 않도록 리터럴로 적는다(이 파일은 폼 검증의 순수 모듈이다).
 */
export function childDatePickerDirection(stageMode: string | null): "past" | "future" {
  return stageMode === "pregnant" ? "future" : "past";
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
 * Full-form validation shared by the settings edit/add forms **and the onboarding create form**.
 * `requireDate` makes an empty pregnant/born date an error, mirroring the server's own
 * normalizeChildInput messages (그 모드에서는 날짜가 반드시 있어야 한다).
 *
 * 실기기 피드백 1 이후로 온보딩(app/(onboarding)/child-profile.tsx)도 `requireDate: true`로
 * 부른다 -- "날짜 없이 태명만" 만든 아이는 시기를 계산할 수 없어 홈·준비템이 통째로 빈 채로
 * 시작했기 때문이다. 즉 생략(=`requireDate: false`)을 쓰는 화면은 이제 없고, 그 기본값은
 * "빈 날짜는 아직 오류가 아니다"라는 입력 중 검사를 위한 자리로 남아 있다(단위 테스트가 그
 * 동작을 고정한다).
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
