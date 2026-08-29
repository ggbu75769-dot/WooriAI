import {
  calculateChildStage,
  getSeoulToday,
  isBeforeEntryDateFloor,
  isFutureSeoulDate,
  isValidCalendarDate,
  ENTRY_DATE_MAX_PAST_YEARS,
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

/**
 * 라운드 67 B — 출산 예정일의 **위쪽 경계**(만삭).
 *
 * 없던 규칙이다. 달력 픽커는 라운드 65 D부터 미래 쪽을 만삭까지만 열어 두는데
 * (src/expenses/date-picker-month.ts), **그 옆의 손타이핑 칸은 그 경계를 몰랐다** — 형식과
 * 실존 달력만 지나면 `2062-11-14`도 그대로 저장됐다(온보딩 ONB-002의 안드로이드 키보드는 일반
 * 키보드라 하이픈을 찾아 열 글자를 친다). 그렇게 들어온 값은 조용히 뭉개진다: 도메인의 주차
 * 계산이 0으로 clamp되면서(packages/domain/src/stage.ts) **임신 0주차**가 되고, 홈의 D 카운트와
 * 준비템 밴드가 임신 초기에 영영 고정되는데 무엇이 틀렸는지 말해 주는 자리가 없었다.
 *
 * ## 숫자를 여기서 짓지 않는다
 * 주차도 날수도 이 파일에 적지 않고 **도메인에 물어 읽는다**: "예정일이 곧 오늘"이면 도메인이
 * 만삭 주차를 답하고(남은 날이 없으면 만삭이다), 그 답은 곧 "예정일이 오늘로부터 가장 멀 수
 * 있는 거리"이기도 하다. 픽커도 **같은 질문을 자기 자리에서 따로** 던진다 — 이 모듈은 폼 검증의
 * 순수 모듈이라 지출 폴더를 import하지 않는 것이 계약이고(위 `childDatePickerDirection` 주석),
 * 상수를 끌어오면 그 규율이 깨진다. 두 자리가 같은 값을 말한다는 사실은 계약 테스트가 붙든다
 * (child-form.test.ts — 같은 경계를 두 이름으로 부르지 않는다). 서버도 같은 규칙을 자기 층에서
 * 한 벌 갖는다(apps/api/src/onboarding/onboarding-core.service.ts의
 * `assertDueDateWithinFullTerm` — 폼을 우회한 API 호출을 막는 것이 그 자리의 존재 이유다).
 *
 * ## 만삭을 못 읽으면 **막지 않는다**
 * 도메인 응답에 주차가 없으면 이 값이 0이 되는데, 그때도 상한을 적용하면 정상 예정일이 전부
 * 거절된다. 픽커는 좁아지는 쪽이라 잠가도 되지만(못 고를 뿐 손으로 칠 수 있다) 가드는 반대다 —
 * 모르면 지어내지 않고 종전처럼 통과시킨다.
 */
function readFullTermPregnancyWeeks(): number {
  const probeIso = getSeoulToday();
  const fullTerm = calculateChildStage({ stageMode: "pregnant", dueDate: probeIso, today: probeIso });
  return "pregnancyWeek" in fullTerm ? Math.max(0, fullTerm.pregnancyWeek) : 0;
}

/** 만삭 주차(도메인에서 읽은 값). 오류 문구도 이 숫자를 그대로 읽는다. */
export const CHILD_DUE_DATE_MAX_FUTURE_WEEKS = readFullTermPregnancyWeeks();

/** 예정일이 오늘로부터 떨어질 수 있는 최대 날수. 0이면 "모른다"는 뜻이라 가드가 쉰다(위 주석). */
export const CHILD_DUE_DATE_MAX_FUTURE_DAYS = CHILD_DUE_DATE_MAX_FUTURE_WEEKS * 7;

/**
 * 상한을 넘긴 예정일의 오류 문구. 픽커가 같은 경계를 설명하는 문장
 * (`EXPENSE_DATE_PICKER_FUTURE_DIRECTION_HINT`의 뒷문장)과 **글자까지 같고**, 서버가 같은 값을
 * 거절할 때 내는 문장과도 같다. DNC-018 해요체.
 */
export const CHILD_DUE_DATE_BEYOND_TERM_ERROR = `만삭(${CHILD_DUE_DATE_MAX_FUTURE_WEEKS}주)보다 먼 날은 고를 수 없어요.`;

/**
 * 이 예정일이 만삭보다 먼가.
 *
 * 비교는 **도메인 함수 그대로**다 — 기준 시각을 오늘에서 만삭 날짜로 옮길 뿐 "이 날짜가 저
 * 날짜보다 뒤인가"를 새로 적지 않는다(픽커의 `latestSelectableIso`가 같은 자리에서 내린 판단).
 * 오늘을 서울 정오로 놓는 이유도 픽커와 같다: 그 시각의 도메인 "오늘"은 어떤 기기 타임존에서도
 * 정확히 오늘이다(자정을 쓰면 UTC 해석이 하루 앞뒤로 흔들린다).
 *
 * "오늘"을 인자로 받지 않는 것은 바로 위 출생일 갈래와 같은 형태를 지키기 위해서다 — 한 함수
 * 안에서 두 갈래가 서로 다른 오늘을 보면 안 된다.
 */
function isBeyondFullTermDueDate(dateIso: string): boolean {
  if (CHILD_DUE_DATE_MAX_FUTURE_DAYS <= 0) return false;
  const fullTermReference = new Date(
    new Date(`${getSeoulToday()}T12:00:00+09:00`).getTime() + CHILD_DUE_DATE_MAX_FUTURE_DAYS * 86_400_000
  );
  return isFutureSeoulDate(dateIso, fullTermReference);
}

/**
 * 라운드 68 A — 출생일의 **아래쪽 경계**(20년).
 *
 * 라운드 67 B가 예정일의 위쪽만 막았고, 출생일의 과거 쪽에는 경계가 없었다. 그런데 **같은 칸의
 * 달력 픽커는 20년에서 잠긴다**(`childDatePickerDirection` → `direction: "past"` →
 * `EXPENSE_DATE_PICKER_MAX_PAST_MONTHS`). 즉 달력은 잠기고 그 옆 손타이핑 칸은 안 잠기는
 * 비대칭이 과거 쪽에 그대로 남아 있었다 — 라운드 67 #1이 미래 쪽에서 고친 것과 같은 모양이다.
 *
 * 막지 않으면 `2026` → `2016` 한 자리 오타가 저장되고, 홈은 **"생후 117개월"** 을 그리며 단계가
 * `elementary`로 굳는다(더 먼 오타면 "생후 1,197개월"이다 — `ageMonthsToStageCode`의 마지막
 * 밴드에 상한이 없어 전부 `middle_school` 하나로 받는다). 값이 대놓고 이상한데도 무엇이 틀렸는지
 * 말해 주는 자리가 없었다.
 *
 * ## 숫자도 문장도 여기서 짓지 않는다
 * 20은 도메인의 `ENTRY_DATE_MAX_PAST_YEARS`이고, 그 값은 지출 날짜 하한·달력 픽커·기록 탭
 * 딥링크가 쓰는 **같은 하나**다. 문장은 지출 폼(`src/expenses/entry-form-guards.ts`의
 * `EXPENSE_DATE_TOO_OLD_ERROR`)과 **글자까지 같다** — 이 모듈은 지출 폴더를 import하지 않는 것이
 * 계약이라(위 `childDatePickerDirection` 주석) 상수를 끌어오는 대신 같은 값을 자기 자리에서
 * 읽어 같은 문장을 만들고, 두 자리가 같은 문장을 말한다는 사실은 계약 테스트가 붙든다
 * (라운드 67 B가 만삭 문구에 쓴 그 형태 그대로). 서버도 같은 규칙을 자기 층에 한 벌 갖는다
 * (apps/api/src/onboarding/onboarding-core.service.ts).
 *
 * ## 밴드는 건드리지 않는다
 * `ageMonthsToStageCode`의 열린 마지막 밴드를 닫는 것은 DNC-007이 지키는 도메인 의미 변경이고
 * 스테이지 코드를 쓰는 모든 자리를 건드린다. 여기서 하는 일은 **폼이 값을 받지 않는 것**뿐이다.
 *
 * ## 예정일에는 적용하지 않는다
 * 과거 예정일 허용은 무변경이다(라운드 67 B ⓒ) — 이미 출산한 사람이 예정일을 적는 것은 정상
 * 입력이고, 그 값은 홈이 "예정일이 지났어요"로 읽는다(src/home/stage-display-label.ts).
 */
export const CHILD_BIRTH_DATE_TOO_OLD_ERROR = `${ENTRY_DATE_MAX_PAST_YEARS}년보다 오래된 날은 고를 수 없어요.`;

// Birth dates (stageMode "born") must not be in the future -- a due date (stageMode "pregnant")
// is expected to be in the future and is allowed to be in the past too (the parent may already
// have given birth), so only the calendar-validity check applies there.
//
// 라운드 67 B: 그 미래에도 끝이 있다 — 예정일은 만삭보다 멀 수 없다(바로 위 주석). 나머지 세
// 갈래는 한 글자도 바뀌지 않았다: 형식·실존 검사, 출생일의 미래 금지, 그리고 **과거 예정일
// 허용**(이미 출산한 사람이 예정일을 적는 것은 정상 입력이고, 그 갈래는 출생 전환 입구가 받는다).
//
// 라운드 68 A: 출생일에는 **아래쪽 끝**도 생겼다(20년 — 바로 위 CHILD_BIRTH_DATE_TOO_OLD_ERROR).
// 예정일 갈래·미래 갈래·과거 예정일 허용은 여기서도 무변경이다.
export function computeDateError(stageMode: string | null, rawValue: string): string | null {
  const trimmed = rawValue.trim();
  if (trimmed.length === 0) return null;
  if (!isoDatePattern.test(trimmed)) return "날짜는 YYYY-MM-DD 형식으로 입력해 주세요.";
  if (!isValidCalendarDate(trimmed)) return "실제 존재하는 날짜인지 확인해 주세요.";
  if (stageMode === "born" && isFutureSeoulDate(trimmed)) return "출생일은 오늘보다 미래일 수 없어요.";
  if (stageMode === "born" && isBeforeEntryDateFloor(trimmed)) return CHILD_BIRTH_DATE_TOO_OLD_ERROR;
  if (stageMode === "pregnant" && isBeyondFullTermDueDate(trimmed)) return CHILD_DUE_DATE_BEYOND_TERM_ERROR;
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
