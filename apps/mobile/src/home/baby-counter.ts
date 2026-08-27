import { BORN_TRANSITION_ACTION_LABEL } from "../children/child-form";
import { daysBetween, isDateOnly } from "./day-math";

/**
 * UX-A 홈 최상단 "아기 카운터" — 순수 판정 + 문구.
 *
 * 홈을 여는 사람이 가장 먼저 보고 싶은 것은 이번 달 예산 숫자가 아니라 **자기 아기**다. 그래서
 * 인사말 자리에 아이 이름이 들어간 한 줄을 세운다:
 *
 *   임신 중  → "다온이를 만나기까지 D-32"   (출산 예정일 기준)
 *   출생 후  → "다온이와 함께한 지 87일"    (생년월일 기준)
 *   수동 단계 → (문구 없음 — 기존 "닉네임 + 단계 라벨" 헤더 그대로)
 *
 * ## 날짜 규칙
 * - 입력은 전부 서울 달력 date-only 문자열이다(`getSeoulToday()`, 서버 Child DTO의
 *   dueDate/birthDate). 일수 차이는 `day-math.ts`가 UTC 자정 기준으로 센다.
 * - **태어난 날 = 1일차**(한국 관례: 갓난아기를 "오늘 1일"이라 부르고, 100일은 태어난 날을
 *   포함해 100번째 날이다). 그래서 `함께한 일수 = 오늘 - 생일 + 1`이고, 태어난 당일이 "1일"이
 *   된다. 서버의 100일 리포트 창도 같은 관례다 — `[birthDate, birthDate + 100일)`
 *   (apps/api/src/finance/milestone-report.service.ts). 두 관례가 갈리면 홈의 "100일" 카운트다운이
 *   리포트 탭이 여는 100일 리포트와 하루 어긋난다.
 *
 * ## 경계 처리(허위·불안 문구 금지)
 * - **출산 예정일 당일**: D-0은 사람이 읽기에 어색하고("D-0일"), "오늘 태어나요"는 사실이 아니다
 *   (예정일에 태어나는 비율은 낮다). 날짜 사실만 말한다 — "오늘은 다온이의 출산 예정일이에요".
 * - **예정일이 지난 경우**: 며칠 지났는지를 세어 보여주면 그 자체가 압박이 된다. DNC-020(의료
 *   조언 금지)에 걸리지 않는 범위에서 기다림의 톤만 유지한다 — "다온이를 곧 만나요".
 * - **예정일이 크게 지났는데 아직 pregnant**: 출생 전환을 안 한 채 방치된 프로필이다. 언제까지나
 *   "곧 만나요"라고 말하는 편이 오히려 이상하므로, 유예 기간이 지나면 카운터를 접고 기존 헤더로
 *   돌아간다(문구를 만들지 않는다). 대신 그 자리에 아래 `evaluateBirthTransitionPrompt`가
 *   출생 전환 입구 한 줄을 내놓는다(라운드 41 UX-T).
 * - **생년월일이 미래**: 데이터 오류다. "-3일째"나 "0일째" 같은 숫자를 만들지 않고 접는다.
 * - 날짜 형식이 깨졌거나 비어 있으면 항상 null — 화면은 기존 헤더를 그대로 쓴다.
 *
 * 발달·건강에 대한 어떤 해석도 넣지 않는다(DNC-020). 여기서 말하는 것은 달력 사실뿐이다.
 */

/** 예정일이 지난 뒤 "곧 만나요"를 유지하는 기간(일). 이후에는 카운터를 접는다. */
export const PREGNANCY_OVERDUE_GRACE_DAYS = 14;

/** 닉네임이 비어 있을 때의 대체 호칭 — 문장이 "를 만나기까지"로 시작하지 않게 한다. */
export const FALLBACK_NICKNAME = "우리 아이";

export type BabyCounterVariant =
  /** 출산 예정일까지 남은 날 */
  | "pregnancy-countdown"
  /** 오늘이 출산 예정일 */
  | "pregnancy-due-today"
  /** 예정일이 지났고 아직 유예 기간 안 */
  | "pregnancy-due-passed"
  /** 태어난 뒤 함께한 날 */
  | "days-together";

export type BabyCounter = {
  variant: BabyCounterVariant;
  /** 화면에 그대로 그리는 한 줄. */
  title: string;
  /**
   * TalkBack용 문장. 화면 문구의 "D-32"는 스크린리더가 "디 마이너스 삼십이"처럼 읽어 뜻이
   * 흐려지므로, 소리로 들을 때 자연스러운 문장을 따로 준다.
   */
  accessibilityLabel: string;
  /**
   * 문구가 말하는 일수. 임신 중이면 예정일까지 남은 날(예정일 당일 0, 지났으면 음수),
   * 출생 후면 함께한 날(태어난 날 = 1).
   */
  days: number;
};

export type BabyCounterInput = {
  /** Child.stageMode — "pregnant" | "born" | "manual". */
  stageMode: string | null | undefined;
  /** Child.nickname (태명/별명). */
  nickname: string | null | undefined;
  /** Child.dueDate ("YYYY-MM-DD") — 임신 중이 아니면 null. */
  dueDate?: string | null;
  /** Child.birthDate ("YYYY-MM-DD") — 태어나기 전이면 null. */
  birthDate?: string | null;
  /** 서울 기준 오늘("YYYY-MM-DD") — 화면은 getSeoulToday()를 넘긴다. */
  todayIso: string;
};

const HANGUL_SYLLABLE_START = 0xac00;
const HANGUL_SYLLABLE_END = 0xd7a3;

/**
 * 마지막 글자에 받침이 있는지. 한글 음절이 아니면(영문/숫자/이모지 태명) null —
 * 호출부는 받침 없는 형태("를"/"와")를 기본으로 쓴다. 한국어 이름 뒤 조사를 잘못 붙이면
 * ("민준를") 따뜻하기는커녕 어색해서, 판정이 서지 않을 때는 안전한 쪽으로 떨어진다.
 */
export function hasFinalConsonant(word: string): boolean | null {
  const lastChar = word.trim().slice(-1);
  if (!lastChar) return null;
  const code = lastChar.charCodeAt(0);
  if (code < HANGUL_SYLLABLE_START || code > HANGUL_SYLLABLE_END) return null;
  return (code - HANGUL_SYLLABLE_START) % 28 !== 0;
}

/** 목적격 조사(을/를). */
export function objectParticle(word: string): string {
  return hasFinalConsonant(word) === true ? "을" : "를";
}

/** 공동격 조사(와/과). */
export function withParticle(word: string): string {
  return hasFinalConsonant(word) === true ? "과" : "와";
}

/** 화면에 쓸 호칭. 비어 있으면 대체 호칭으로 떨어진다(마일스톤 카드도 같은 규칙을 쓴다). */
export function displayNickname(nickname: string | null | undefined): string {
  const trimmed = typeof nickname === "string" ? nickname.trim() : "";
  return trimmed.length > 0 ? trimmed : FALLBACK_NICKNAME;
}

function pregnancyCounter(name: string, daysUntilDue: number): BabyCounter | null {
  if (daysUntilDue > 0) {
    return {
      variant: "pregnancy-countdown",
      title: `${name}${objectParticle(name)} 만나기까지 D-${daysUntilDue}`,
      accessibilityLabel: `${name}${objectParticle(name)} 만나기까지 ${daysUntilDue}일 남았어요`,
      days: daysUntilDue
    };
  }
  if (daysUntilDue === 0) {
    const title = `오늘은 ${name}의 출산 예정일이에요`;
    return { variant: "pregnancy-due-today", title, accessibilityLabel: title, days: 0 };
  }
  if (-daysUntilDue > PREGNANCY_OVERDUE_GRACE_DAYS) return null;
  const title = `${name}${objectParticle(name)} 곧 만나요`;
  return { variant: "pregnancy-due-passed", title, accessibilityLabel: title, days: daysUntilDue };
}

function bornCounter(name: string, daysTogether: number): BabyCounter {
  return {
    variant: "days-together",
    title: `${name}${withParticle(name)} 함께한 지 ${daysTogether}일`,
    accessibilityLabel: `${name}${withParticle(name)} 함께한 지 ${daysTogether}일째예요`,
    days: daysTogether
  };
}

/** 홈 헤더의 카운터 한 줄을 만든다. 만들 수 없으면 null(화면은 기존 헤더 유지). */
export function evaluateBabyCounter(input: BabyCounterInput): BabyCounter | null {
  if (!isDateOnly(input.todayIso)) return null;
  const name = displayNickname(input.nickname);

  if (input.stageMode === "pregnant") {
    if (!isDateOnly(input.dueDate)) return null;
    const daysUntilDue = daysBetween(input.todayIso, input.dueDate);
    if (daysUntilDue === null) return null;
    return pregnancyCounter(name, daysUntilDue);
  }

  if (input.stageMode === "born") {
    if (!isDateOnly(input.birthDate)) return null;
    const elapsed = daysBetween(input.birthDate, input.todayIso);
    if (elapsed === null) return null;
    // 미래 생년월일(데이터 오류) 방어: 0일째·음수일째 같은 숫자를 만들지 않는다.
    if (elapsed < 0) return null;
    // 태어난 날 = 1일차 (위 "날짜 규칙" 참고).
    return bornCounter(name, elapsed + 1);
  }

  // manual(수동 단계) 및 알 수 없는 stageMode: 단계 라벨만 있는 기존 헤더를 그대로 둔다.
  return null;
}

/**
 * 라운드 41 UX-T(A): 홈의 **출생 전환 입구** 한 줄.
 *
 * 무엇이 문제였나 — 임신 → 출생 전환은 이 앱에서 가장 큰 전환점이다(전환해야 준비템 밴드·
 * 마일스톤 카드·100일 리포트가 살아난다). 그런데 그 입구가 설정 → 아이 관리의 버튼 하나뿐이라
 * 홈에서 네 단계 깊이에 숨어 있었고, 홈은 정작 예정일 당일에 "오늘은 …의 출산 예정일이에요"
 * 라고 말한 뒤 유예 기간이 지나면 카운터를 **조용히 접기만** 했다. 전환을 안 한 사용자에게는
 * 앱이 아무 말도 하지 않은 채 기능 절반이 비활성인 상태가 이어졌다.
 *
 * 그래서 예정일에 닿은 순간부터 홈에 **같은 문구의 링크 한 줄**을 둔다. 라벨은 설정 화면의
 * 버튼과 **한 글자도 다르지 않은** `BORN_TRANSITION_ACTION_LABEL`이다 — 홈에서 누른 것과 아이
 * 관리 화면에서 볼 것이 같은 단어여야 "이게 그거였구나"가 설명 없이 통한다. 실제 전환(생년월일
 * 입력·확인·PATCH)은 종전대로 아이 관리 화면 한 곳에서만 일어난다: 여기는 **입구**일 뿐이다.
 *
 * 톤 규칙(이 파일의 다른 문구와 같다):
 * - **DNC-020**: 경과 일수를 세지 않고 의료적 해석도 하지 않는다. "예정일이 N일 지났어요",
 *   "곧 진통이 와요" 같은 문장은 만들지 않는다 — 변형(variant)만 다르고 문구는 셋 다 같은
 *   한 줄이라, 숫자가 끼어들 자리 자체가 없다.
 * - **DNC-018**: 재촉·질책 톤 금지. "아직 안 하셨네요", "지금 바꿔주세요" 대신 사용자가 스스로
 *   말하는 형태("아이가 태어났어요")를 그대로 쓴다. 닫기·배지·강조도 없다.
 *
 * 판정 시점은 카운터와 **같은 경계**에서 나온다(같은 상수 `PREGNANCY_OVERDUE_GRACE_DAYS`):
 *   D-1 이전  → null                      (아직 이르다 — 카운터는 "D-32")
 *   예정일 당일 → "pregnancy-due-today"    (카운터: "오늘은 …의 출산 예정일이에요")
 *   유예 기간 안 → "pregnancy-due-passed"  (카운터: "…를 곧 만나요")
 *   유예 초과   → "pregnancy-overdue-prompt" (카운터는 null — 이 줄만 남는다)
 * 변형 이름을 카운터와 공유하는 것은 화면이 "카운터 아래" / "카운터 대신" 어느 자리에 그리는지를
 * 두 값의 조합으로 알 수 있게 하기 위해서다(화면은 링크만 그리고 판정은 여기서 끝난다).
 */
export type BirthTransitionPromptVariant =
  /** 오늘이 출산 예정일 — 카운터 아래 한 줄. */
  | "pregnancy-due-today"
  /** 예정일이 지났고 아직 유예 기간 안 — 카운터 아래 한 줄. */
  | "pregnancy-due-passed"
  /** 유예 기간을 넘겨 카운터가 접힌 자리 — 이 한 줄만 남는다. */
  | "pregnancy-overdue-prompt";

/** 전환 입구가 가리키는 화면. 실제 전환 폼은 여기 한 곳에만 있다. */
export const BIRTH_TRANSITION_PROMPT_ROUTE = "/settings/children" as const;

/** 홈 링크의 라벨 — 아이 관리 화면의 전환 버튼과 같은 문자열(단일 소스). */
export const BIRTH_TRANSITION_PROMPT_LABEL = BORN_TRANSITION_ACTION_LABEL;

/**
 * TalkBack용 문장. 보이는 라벨만 읽어 주면 눌렀을 때 무엇이 일어나는지 알 수 없어서, 목적지를
 * 문장 안에 넣는다. 재촉이 아니라 안내다(DNC-018).
 */
export const BIRTH_TRANSITION_PROMPT_ACCESSIBILITY_LABEL = `${BORN_TRANSITION_ACTION_LABEL}, 출생일 입력하러 가기`;

export type BirthTransitionPrompt = {
  variant: BirthTransitionPromptVariant;
  /** 화면에 그대로 그리는 링크 라벨. */
  label: string;
  accessibilityLabel: string;
  route: typeof BIRTH_TRANSITION_PROMPT_ROUTE;
};

/**
 * 카운터와 같은 입력에서 전환 입구를 낼지 판정한다(호칭·생년월일은 쓰지 않으므로 세 필드만 받는다
 * — `BabyCounterInput`을 그대로 넘겨도 된다).
 */
export type BirthTransitionPromptInput = Pick<BabyCounterInput, "stageMode" | "dueDate" | "todayIso">;

export function evaluateBirthTransitionPrompt(input: BirthTransitionPromptInput): BirthTransitionPrompt | null {
  // 이미 출생으로 바꾼 아이(born)·수동 단계에는 권할 것이 없다.
  if (input.stageMode !== "pregnant") return null;
  // 날짜를 모르면 아무 말도 하지 않는다 — 카운터와 같은 방어다.
  if (!isDateOnly(input.todayIso) || !isDateOnly(input.dueDate)) return null;
  const daysUntilDue = daysBetween(input.todayIso, input.dueDate);
  if (daysUntilDue === null) return null;
  // 예정일 전에는 띄우지 않는다. D-1에 "아이가 태어났어요"를 권하면 그것 자체가 재촉이다.
  if (daysUntilDue > 0) return null;

  const variant: BirthTransitionPromptVariant =
    daysUntilDue === 0
      ? "pregnancy-due-today"
      : -daysUntilDue > PREGNANCY_OVERDUE_GRACE_DAYS
        ? "pregnancy-overdue-prompt"
        : "pregnancy-due-passed";

  return {
    variant,
    // 세 변형의 문구가 같다 = 며칠 지났는지가 문구에 드러나지 않는다(DNC-020/DNC-018).
    label: BIRTH_TRANSITION_PROMPT_LABEL,
    accessibilityLabel: BIRTH_TRANSITION_PROMPT_ACCESSIBILITY_LABEL,
    route: BIRTH_TRANSITION_PROMPT_ROUTE
  };
}
