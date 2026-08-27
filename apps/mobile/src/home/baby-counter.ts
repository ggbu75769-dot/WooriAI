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
 *   돌아간다(문구를 만들지 않는다).
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
