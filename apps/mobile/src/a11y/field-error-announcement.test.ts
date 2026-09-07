import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { requiredDateFieldLabel, validateChildForm } from "../children/child-form";
import { amountFieldAccessibilityValue, formatAmountDigits } from "../money";

/**
 * A11Y-115 — **필드 검증 오류가 소리로 나가고, 금액·날짜 칸이 단위를 읽는다** (지출 수정 · 예산 저장).
 *
 * ## 과제 1 — 침묵하던 검증 오류
 *
 * 저장소 전체의 검증 오류 문장 **열셋** 가운데 낭독 출구가 있던 곳은 셋뿐이었다
 * (`app/(auth)/login.tsx`의 실패 카드 · `app/expenses/recurring.tsx`의 저장 실패 줄 ·
 * `app/expenses/new.tsx`의 날짜 손타이핑 오류). 나머지 **열**은 맨 `<Text>`였고, 그중 **여섯**이
 * 이 트랙의 두 화면이다(지출 수정 다섯 · 예산 저장 하나). 남은 넷은 `app/(onboarding)/**`이라
 * 다른 트랙 소유이고 이번 걸음이 손대지 않았다(이월).
 *
 * ⚠️ **두 시점(라운드 109 — 그 이월을 닫는 걸음).** 위 마지막 문장은 그때는 참이었다. 이제
 * 그 넷도 같은 훅 한 벌을 진다(`app/(onboarding)/child-profile.tsx` 셋 ·
 * `app/(onboarding)/budget.tsx` 하나) — 아래 **ⓕ**가 그 자리를 전수로 판다. 함께 닫는 자리가
 * 둘 더 있다: 예산 화면 카테고리 카드의 저장 잠금 오류 두 줄은 프롭 쌍만 들고 있어 **iOS에서
 * 조용했는데**(라운드 102 리뷰 L-a11y가 세운 그 쌍은 안드로이드의 답이다), 아래 **ⓖ**가 그 둘도
 * 같은 훅을 지나게 한 것을 문다. T20이 *"고치는 날 빨개지는 핀"*을 남기지 않은 자리라, 이
 * 걸음이 그 핀을 세운다 — 다음 사람이 이 배선을 지우면 ⓕ·ⓖ가 먼저 빨개진다.
 *
 * ⚠️ **기존 스윕이 이 여섯을 못 잡은 이유는 그물이 성겨서가 아니라 모집단이 달라서다.**
 * 라운드 79·80의 낭독 스윕 넷은 모집단을 `mutationTriggerSitesOf`로 만드는데, 그 함수는 danger 색
 * 글자를 감싼 **최내곽 JSX 갈래**가 `useMutation`/`useQuery` 바인딩에 닿을 때만 자리로 센다(닿지
 * 않으면 `continue` — 그 자리는 아예 버려진다). 이 여섯의 가드는 전부 TextInput 상태에서 파생한
 * **순수 계산**(`amountError`·`itemNameError`·…)이라 그 모집단 밖이었다. 그래서 그 스윕들의
 * *"침묵 0건"* 이라는 초록은 이 여섯에 대해서는 **아무 말도 하지 않는 초록**이었다.
 *
 * ## 과제 2 — 단위를 잃던 금액 칸과 ISO를 읽던 날짜 칸
 *
 * 금액 칸은 값과 '원'을 다른 노드로 그린다(FMT-127). 빠른 기록 시트만 `accessibilityValue`로
 * 접미사 붙은 표기를 넘기고 있었고, 지출 수정·예산 총액·카테고리 행의 금액 칸 셋은 "38,500"만
 * 읽혔다. 손타이핑 날짜 칸은 ISO 원문을 그대로 읽었다 — 이 앱이 다른 자리에서 `formatSpentOn`으로
 * 만드는 그 규칙 밖이다.
 *
 * ## 이 계약이 무는 것
 *
 * ⓐ 순수 판정(`amountFieldAccessibilityValue`)의 값 — 리터럴로.
 * ⓑ 두 화면의 danger 글자 자리를 **전수로 파생해**, 실패 문장이면 예외 없이 낭독 출구가 있을 것.
 * ⓒ 낭독 규율(같은 문장 재낭독 금지 · 갈래가 닫히면 기억을 지운다)이 모듈 한 곳에 있을 것.
 * ⓓ 소유 밖 바이트 핀이 살아 있을 것 — 네 자리가 컨테이너 모양을 고른 **이유**가 산문이 아니라
 *    자기 무효화되는 값으로 설 것(핀이 풀리는 날 이 줄이 먼저 빨개져 모양을 다시 보게 한다).
 *
 * ⚠️ **소스 대조이지 런타임이 아니다.** 훅 모듈은 `src/ui.tsx`(→ react-native)를 지나므로 vitest가
 * **불러올 수 없다** — 이 저장소의 모바일 UI 계약이 전부 소스 대조인 것과 같은 이유이고, 그래서
 * 낭독 배선은 소스로, 순수 판정은 값으로 문다. TalkBack/VoiceOver가 실제로 읽는지, 안드로이드에서
 * 라이브 리전과 announce가 겹쳐 두 번 들리는지는 기기만 답한다
 * (`docs/qa/runtime-verification-required.md` §1-1 #131 ⓖ · #157 ⓓ · #162 ⓑ · #164 ⓓ가 이미 같은
 * 질문을 열어 두고 있다 — 이 트랙이 새 질문을 만들지 않는다).
 */

const source = (relativePath: string) => readFileSync(join(process.cwd(), relativePath), "utf8");

const EDIT_EXPENSE = "app/expenses/[expenseId].tsx";
const BUDGET = "app/budget.tsx";
const HOOK_MODULE = "src/a11y/use-field-error-announcement.ts";

/**
 * 주석을 지우되 **자리(인덱스)는 그대로 둔다** — `src/a11y-contract.test.ts`의 `maskComments`와 같은
 * 함수다. 이 트랙이 두 화면에 남긴 두 시점 주석은 핀 바이트를 그대로 인용하고 있어, 지우지 않으면
 * 아래 전수 파생이 **유령 자리**를 센다(주석이 계약을 통과시키는 자리를 만들지 않는다).
 */
function maskComments(sourceText: string): string {
  return sourceText
    .replace(/\/\*[\s\S]*?\*\//g, (block) => block.replace(/[^\n]/g, " "))
    .replace(/(^|[^:])(\/\/[^\n]*)/g, (_all, prefix: string, line: string) => prefix + line.replace(/./g, " "));
}

/** 여는 태그의 끝 `>` — 중괄호·따옴표 안의 `>`는 세지 않는다(같은 파일의 그 규칙). */
function openingTagEnd(masked: string, tagStart: number): number {
  let depth = 0;
  let quote: string | null = null;
  for (let i = tagStart; i < masked.length; i += 1) {
    const char = masked[i];
    if (quote) {
      if (char === quote) quote = null;
      continue;
    }
    if (char === '"' || char === "'" || char === "`") {
      quote = char;
      continue;
    }
    if (char === "{") depth += 1;
    else if (char === "}") depth -= 1;
    else if (char === ">" && depth === 0) return i;
  }
  return -1;
}

const ALERT_PROPS = ['accessibilityRole="alert"', 'accessibilityLiveRegion="polite"'] as const;

/** 프롭 쌍이 문장 자신에 걸렸는가(`bare`) · 감싼 alert 컨테이너에 걸렸는가(`contained`) · 없는가. */
type DangerTextExit = "bare" | "contained" | "silent";

/**
 * 한 화면에서 **danger 색 글자 자리**를 전수로 판다(손 목록 금지 — 자리가 하나 늘거나 줄면 빨개진다).
 *
 * 바늘은 `src/a11y-contract.test.ts`의 그것과 같다: 여는 태그가 `theme.colors.danger`를 직접 실었거나,
 * 그 색으로 정의된 **이 파일의 스타일 이름**을 실은 `<Text>`.
 */
function dangerTextExitsOf(file: string): DangerTextExit[] {
  const masked = maskComments(source(file));
  const dangerStyleNames = new Set<string>();
  const stylePattern = /(?:const\s+([A-Za-z0-9_$]+)\s*=|\b([A-Za-z0-9_$]+)\s*:)\s*\{([^{}]|\{[^{}]*\})*\}/g;
  let styleFound: RegExpExecArray | null;
  while ((styleFound = stylePattern.exec(masked))) {
    if (styleFound[0].includes("theme.colors.danger")) dangerStyleNames.add(styleFound[1] ?? styleFound[2]);
  }
  const styleNames = Array.from(dangerStyleNames);

  const exits: DangerTextExit[] = [];
  const pattern = /<Text(?![A-Za-z0-9_])/g;
  let found: RegExpExecArray | null;
  while ((found = pattern.exec(masked))) {
    const end = openingTagEnd(masked, found.index);
    if (end < 0) continue;
    const openTag = masked.slice(found.index, end + 1);
    const isDanger =
      openTag.includes("theme.colors.danger") || styleNames.some((name) => new RegExp(`\\b${name}\\b`).test(openTag));
    if (!isDanger) continue;
    // alert 컨테이너는 문장 **바로 위** 한 겹에 선다(`app/(auth)/login.tsx`의 그 모양).
    const before = masked.slice(Math.max(0, found.index - 200), found.index);
    exits.push(
      ALERT_PROPS.every((prop) => openTag.includes(prop))
        ? "bare"
        : ALERT_PROPS.every((prop) => before.includes(prop))
          ? "contained"
          : "silent"
    );
  }
  return exits;
}

/**
 * ⚠️ **오늘 낭독 출구 없이 서 있는 danger 글자 — 이유가 적힌 값으로만 남는다.**
 *
 * 비면 아래 부정 단언이 빈 모집단 위에서 영원히 초록이 되므로, 이 값과 그 형식은 비어도 남는다.
 * 오늘 한 자리이고 그것은 실패 문장이 아니다 — `app/family/index.tsx`의 파괴적 버튼 라벨 넷을 같은
 * 이유로 제외하는 `src/a11y-contract.test.ts`의 판정과 **글자 그대로 같은 사유**다.
 */
const DANGER_TEXT_NOT_A_FAILURE_SENTENCE: Readonly<Record<string, string>> = {
  "app/expenses/[expenseId].tsx 이 지출 삭제하기":
    "실패 문장이 아니라 **파괴적 동작의 버튼 라벨**이다(감싼 Pressable이 자기 role로 읽힌다). danger 색을 입어 이 바늘에 걸릴 뿐이고, 조작을 끊고 자동으로 읽어야 할 새 사실이 아니다 — 끼어들면 DNC-018이 막는 그 재촉이 된다."
};

describe("A11Y-115 ⓐ 금액 칸이 단위를 읽는다 (순수 판정 · 표기의 단일 소스)", () => {
  it("자릿수에 '원'을 붙인 표기를 넘긴다", () => {
    expect(amountFieldAccessibilityValue("38500")).toEqual({ text: "38,500원" });
    expect(amountFieldAccessibilityValue("300000")).toEqual({ text: "300,000원" });
    expect(amountFieldAccessibilityValue("1")).toEqual({ text: "1원" });
    // 상한(int4)까지 자릿수가 늘어도 같은 규칙이다.
    expect(amountFieldAccessibilityValue("2147483647")).toEqual({ text: "2,147,483,647원" });
  });

  it("사람이 친 0은 사실이다 — '0원'으로 읽고, 눈에 보이는 글자와 같은 값을 말한다", () => {
    expect(formatAmountDigits("0")).toBe("0");
    expect(amountFieldAccessibilityValue("0")).toEqual({ text: "0원" });
  });

  it("⚠️ 빈 칸에는 넘길 사실이 없다 — undefined이지 '0원'이 아니다", () => {
    // 눈에 빈 칸이면 귀에도 빈 칸이다: 같은 입력에서 보이는 글자도 빈 문자열이다.
    expect(formatAmountDigits("")).toBe("");
    expect(amountFieldAccessibilityValue("")).toBeUndefined();
  });

  it("'₩'를 만들지 않는다 — 표기를 여기서 다시 짓지 않는다 (D0 금액 규칙)", () => {
    expect(amountFieldAccessibilityValue("38500")!.text).not.toContain("₩");
    // 새 포맷 사본 0건: 이 판정은 같은 모듈의 formatKrw 한 곳을 지난다.
    expect(source("src/money.ts")).toContain("return { text: formatKrw(Number(digits)) };");
  });
});

describe("A11Y-115 ⓑ 두 화면의 danger 글자 전수 — 실패 문장은 예외 없이 소리로 나간다", () => {
  it("지출 수정 화면의 자리 여섯 — 다섯이 검증 오류이고 다섯 다 출구를 가진다", () => {
    const exits = dangerTextExitsOf(EDIT_EXPENSE);
    // 유령 방지: 바늘이 실제로 이 화면을 걷는다(모집단이 0건이 아니다).
    expect(exits.length, "지출 수정 화면의 danger 글자 자리").toBe(6);
    // 넷은 컨테이너(소유 밖 바이트 핀 때문 — 아래 ⓓ), 하나는 맨 문장(핀 밖 · new.tsx와 같은 모양),
    // 하나는 실패 문장이 아니라 버튼 라벨이다(위 제외 값).
    expect(exits.slice().sort()).toEqual(["bare", "contained", "contained", "contained", "contained", "silent"]);
  });

  it("예산 저장 화면의 자리 셋은 전부 맨 문장에 프롭 쌍을 진다", () => {
    const exits = dangerTextExitsOf(BUDGET);
    expect(exits.length, "예산 저장 화면의 danger 글자 자리").toBe(3);
    expect(exits).toEqual(["bare", "bare", "bare"]);
  });

  it("⚠️ 부정 단언 — 출구 없는 자리는 이유가 적힌 값 하나뿐이다", () => {
    const silent = [...dangerTextExitsOf(EDIT_EXPENSE), ...dangerTextExitsOf(BUDGET)].filter(
      (exit) => exit === "silent"
    );
    expect(silent.length, "낭독 출구 없는 danger 글자").toBe(Object.keys(DANGER_TEXT_NOT_A_FAILURE_SENTENCE).length);
    for (const [key, why] of Object.entries(DANGER_TEXT_NOT_A_FAILURE_SENTENCE)) {
      expect(why.length, `${key}가 제외되는 이유`).toBeGreaterThan(40);
    }
    // 그 한 자리가 실재하는지 소스에서 다시 확인한다(제외가 유령을 가리키지 않는다).
    expect(source(EDIT_EXPENSE)).toContain('{remove.isPending ? "삭제하는 중" : "이 지출 삭제하기"}');
  });
});

describe("A11Y-115 ⓒ 낭독 규율 — 한 벌이 소유하고, 새로 생긴 오류만 읽는다", () => {
  it("여섯 자리 전부가 같은 훅 한 벌을 지난다 (화면에 배선 사본 0건)", () => {
    const editSource = source(EDIT_EXPENSE);
    for (const field of ["itemNameError", "merchantError", "memoError", "amountError", "dateInputError"]) {
      expect(editSource, field).toContain(`useFieldErrorAnnouncement(${field});`);
    }
    expect(source(BUDGET)).toContain("useFieldErrorAnnouncement(amountError);");
    // 낭독 통로는 모듈 하나다 — 화면이 직접 부르면 규율이 두 벌이 된다.
    expect(editSource).not.toContain("announceForA11y(");
    expect(source(BUDGET)).not.toContain("announceForA11y(");
  });

  it("크로스플랫폼 출구는 저장소의 그 한 벌이다 (프롭 둘은 안드로이드 한정)", () => {
    const moduleSource = source(HOOK_MODULE);
    expect(moduleSource).toContain('import { announceForA11y } from "../ui";');
    expect(moduleSource).toContain("announceForA11y(message);");
  });

  it("⚠️ 재낭독 금지 — 같은 문장이면 조용하고, 갈래가 닫히면 기억을 지운다", () => {
    const moduleSource = source(HOOK_MODULE);
    expect(moduleSource).toContain("if (announced.current === message) return;");
    expect(moduleSource).toContain("announced.current = message;");
    expect(moduleSource).toContain("      announced.current = null;");
    expect(moduleSource).toContain("  }, [message]);");
    // 발명 0건의 근거 — 본보기(라운드 90 트랙 A)가 오늘도 같은 모양으로 서 있다.
    const paritySource = source("src/preparation/PreparationListParity.tsx");
    expect(paritySource).toContain("if (announcedSearchResult.current === announcement) return;");
    expect(paritySource).toContain("      announcedSearchResult.current = null;");
  });

  it("⚠️ 새 한국어 문장 0건 — 훅 모듈은 문구를 짓지 않는다", () => {
    // 주석을 지운 뒤 남는 코드에 한글이 한 글자도 없다(읽히는 것은 화면이 이미 그리는 문자열이다).
    expect(maskComments(source(HOOK_MODULE))).not.toMatch(/[가-힣]/);
  });
});

describe("A11Y-115 ⓓ 소유 밖 바이트 핀 — 컨테이너 모양을 고른 이유가 값으로 선다", () => {
  it("색 계약이 붙든 여는 태그 넷이 한 바이트도 움직이지 않았다", () => {
    const editSource = source(EDIT_EXPENSE);
    // `src/expenses/auto-fill-wiring.test.ts`(소유 밖)가 이 네 바이트를 그대로 붙든다. 프롭을 태그
    // 안에 한 칸 더하면 그 핀이 먼저 빨개지므로, 네 자리는 프롭 쌍을 **감싼 컨테이너**에 진다
    // (a11y-contract가 인정하는 둘째 모양 · 본보기는 app/(auth)/login.tsx의 실패 카드).
    for (const field of ["itemNameError", "merchantError", "memoError", "amountError"]) {
      expect(editSource, field).toContain(
        `<Text style={{ color: theme.colors.danger, fontSize: theme.typography.caption.fontSize }}>{${field}}</Text>`
      );
    }
    // 그 핀이 실재한다는 것도 함께 문다 — 핀이 풀리는 날 이 줄이 컨테이너를 다시 보게 한다.
    expect(source("src/expenses/auto-fill-wiring.test.ts")).toContain(
      '<Text style={{ color: theme.colors.danger, fontSize: theme.typography.caption.fontSize }}>{${field}}</Text>'
    );
  });

  it("컨테이너는 스타일이 없다 — 보이는 화면은 한 픽셀도 달라지지 않는다", () => {
    const editSource = source(EDIT_EXPENSE);
    expect(editSource.match(/<View accessibilityRole="alert" accessibilityLiveRegion="polite">/g) ?? []).toHaveLength(
      4
    );
  });

  it("핀 밖 한 자리는 관례의 기본형이고, 같은 오류의 형제 자리와 모양이 같다", () => {
    // 같은 문장(같은 순수 모듈 validateExpenseDateInput이 만든다)이 빠른 기록 시트에서 이미 이
    // 모양으로 선다 — 두 화면이 같은 오류를 다른 모양으로 말하지 않는다.
    expect(source("app/expenses/new.tsx")).toContain('accessibilityRole="alert"\n                    accessibilityLiveRegion="polite"');
    expect(source(EDIT_EXPENSE)).toContain(
      'accessibilityRole="alert"\n                            accessibilityLiveRegion="polite"'
    );
  });
});

describe("A11Y-115 ⓔ 금액·날짜 칸이 값을 사람의 말로 넘긴다 (과제 2)", () => {
  it("금액 칸 셋이 같은 판정 한 벌을 지난다", () => {
    expect(source(EDIT_EXPENSE)).toContain("accessibilityValue={amountFieldAccessibilityValue(amountDigits)}");
    expect(source(BUDGET)).toContain("accessibilityValue={amountFieldAccessibilityValue(amountDigits)}");
    expect(source(BUDGET)).toContain(
      'accessibilityValue={amountFieldAccessibilityValue(categoryDraft[row.categoryId] ?? "")}'
    );
    // 화면이 표기를 스스로 조립하지 않는다(문자열 리터럴 accessibilityValue 0건).
    expect(source(BUDGET)).not.toContain("accessibilityValue={{ text:");
  });

  it("손타이핑 날짜 칸은 기존 포맷터를 재사용한다 — 새 날짜 문법 0건", () => {
    const editSource = source(EDIT_EXPENSE);
    expect(editSource).toContain(
      "const customDateSpokenLabel = customDateText.length > 0 && !dateInputError ? formatSpentOn(customDateText) : null;"
    );
    expect(editSource).toContain(
      "accessibilityValue={customDateSpokenLabel ? { text: customDateSpokenLabel } : undefined}"
    );
    // 포맷터는 홈·기록 행 부제가 쓰는 그 함수다(이 화면이 사람이 읽는 날짜를 새로 짓지 않는다).
    expect(editSource).toContain('} from "../../src/expenses/records-list-view";');
    expect(editSource).not.toContain("function formatSpentOn(");
  });

  it("라벨은 한 글자도 바뀌지 않았다 — 값만 더한다", () => {
    expect(source(EDIT_EXPENSE)).toContain('accessibilityLabel="지출 금액 입력"');
    expect(source(EDIT_EXPENSE)).toContain('accessibilityLabel="날짜 직접 입력"');
    expect(source(BUDGET)).toContain('accessibilityLabel="새 예산 입력"');
    expect(source(BUDGET)).toContain("accessibilityLabel={row.inputAccessibilityLabel}");
  });
});

/**
 * ⓕ **이월 넷 — 온보딩 두 화면**(라운드 109).
 *
 * T20이 여섯을 닫으며 소유 밖으로 남긴 그 넷이다. 모양은 발명하지 않는다: T20이 고른 둘 가운데
 * **맨 문장**(프롭 쌍을 `<Text>` 자신에 건다)이 관례의 기본형이고, 둘째 모양인 **alert 컨테이너**는
 * 여는 태그가 소유 밖 계약에 바이트로 핀돼 있을 때만 쓴다(위 ⓓ — `auto-fill-wiring.test.ts`가
 * 지출 수정 화면 넷을 붙드는 그 사정). 이 두 화면의 네 여는 태그를 붙드는 핀은 오늘 0건이라
 * 기본형이 그대로 선다.
 *
 * ⚠️ **한 줄로 닫히지 않는 자리가 셋 중 둘이었다.** 온보딩 아이 프로필의 앞 두 줄은 touched
 * 게이트 뒤에서만 그려진다("아직 손대지 않은 칸을 빨갛게 꾸짖지 않는다" — 그 화면의 주석).
 * 훅에 오류 값만 그대로 넘기면 **첫 렌더에서** 눈에 없는 문장이 귀에만 들린다(빈 칸으로 시작하는
 * 화면이라 `nicknameError`는 처음부터 서 있다). 그래서 훅에 넘기는 값은 "오류가 있는가"가 아니라
 * **"화면이 그 줄을 그리는가"** 여야 하고, 아래 부정 단언이 그 순진한 한 줄을 막는다.
 */
const CHILD_PROFILE = "app/(onboarding)/child-profile.tsx";
const ONBOARDING_BUDGET = "app/(onboarding)/budget.tsx";

describe("A11Y-115 ⓕ 이월 넷 — 온보딩 검증 오류도 소리로 나간다", () => {
  it("온보딩 두 화면의 danger 글자 전수 넷 — 넷 다 맨 문장에 프롭 쌍을 진다", () => {
    const profileExits = dangerTextExitsOf(CHILD_PROFILE);
    // 유령 방지: 바늘이 실제로 이 화면을 걷는다(모집단이 0건이 아니다).
    expect(profileExits.length, "아이 프로필의 danger 글자 자리").toBe(3);
    expect(profileExits).toEqual(["bare", "bare", "bare"]);

    const budgetExits = dangerTextExitsOf(ONBOARDING_BUDGET);
    expect(budgetExits.length, "온보딩 예산의 danger 글자 자리").toBe(1);
    expect(budgetExits).toEqual(["bare"]);
  });

  it("넷 다 같은 훅 한 벌을 지난다 (화면에 배선 사본 0건)", () => {
    const profileSource = source(CHILD_PROFILE);
    expect(profileSource).toContain("useFieldErrorAnnouncement(nicknameTouched ? nicknameError : null);");
    expect(profileSource).toContain("useFieldErrorAnnouncement(dateTouched ? dateError : null);");
    expect(profileSource).toContain("useFieldErrorAnnouncement(manualStageError);");
    expect(source(ONBOARDING_BUDGET)).toContain("useFieldErrorAnnouncement(amountError);");
    // 낭독 통로는 모듈 하나다 — 화면이 직접 부르면 규율이 두 벌이 된다(위 ⓒ와 같은 단언).
    expect(profileSource).not.toContain("announceForA11y(");
    expect(source(ONBOARDING_BUDGET)).not.toContain("announceForA11y(");
  });

  it("⚠️ 훅이 받는 값 = 화면이 그 줄을 그리는 조건 (눈에 없는 문장을 귀에만 들려주지 않는다)", () => {
    const profileSource = maskComments(source(CHILD_PROFILE));
    // 앞 둘의 JSX 갈래가 touched 게이트를 지고 있고,
    expect(profileSource).toContain("{nicknameTouched && nicknameError ? (");
    expect(profileSource).toContain("{dateTouched && dateError ? (");
    // 훅 호출도 **그 게이트 그대로**를 진다 — 순진한 한 줄(`useFieldErrorAnnouncement(오류)`)은 없다.
    expect(profileSource).not.toContain("useFieldErrorAnnouncement(nicknameError)");
    expect(profileSource).not.toContain("useFieldErrorAnnouncement(dateError)");
    // 셋째는 게이트가 필요 없다: 판정 자체가 manual일 때만 문장을 만든다(그 사실을 값으로 문다).
    expect(source("src/children/child-form.ts")).toContain(
      'const manualStageError = stageMode === "manual" && !values.manualStage ? "아이 단계를 하나 선택해 주세요." : null;'
    );
    // 온보딩 예산도 같은 이유로 게이트가 없다 — 판정이 이미 `amountDigits.length > 0`을 진다.
    expect(maskComments(source(ONBOARDING_BUDGET))).toContain("amountDigits.length > 0 && amountKrw <= 0");
  });

  it("⚠️ 새 한국어 문장 0건 — 넷 다 이미 있던 문구를 읽는다", () => {
    // 아이 프로필 셋의 문장은 전부 순수 모듈이 만든다(화면에 문구 리터럴이 없다).
    const formSource = source("src/children/child-form.ts");
    // 화면 쪽은 **주석을 지운 뒤** 본다 — 이 라운드가 남긴 두 시점 주석이 그 문장을 인용하고 있어,
    // 지우지 않으면 주석이 계약을 통과시키는(또는 여기서는 깨뜨리는) 자리를 만든다(위 maskComments 주석).
    const profileCode = maskComments(source(CHILD_PROFILE));
    for (const sentence of [
      "태명 또는 별명을 입력해 주세요.",
      "출산 예정일을 입력해 주세요.",
      "아이 생년월일을 입력해 주세요.",
      "아이 단계를 하나 선택해 주세요."
    ]) {
      expect(formSource, sentence).toContain(sentence);
      expect(profileCode, sentence).not.toContain(sentence);
    }
    // 온보딩 예산의 두 문장은 예산 수정 화면과 **같은 두 문장**이다(한 쪽만 바뀌면 여기가 빨개진다).
    expect(source(ONBOARDING_BUDGET)).toContain('"0보다 큰 금액을 입력해 주세요."');
    expect(source(BUDGET)).toContain('"0보다 큰 금액을 입력해 주세요."');
    expect(source(ONBOARDING_BUDGET)).toContain("amountOverLimitMessage()");
    expect(source(BUDGET)).toContain("amountOverLimitMessage()");
  });
});

/**
 * ⓖ **예산 화면 카테고리 오류 둘 — iOS 침묵을 닫는다**(라운드 102가 연 자리 · 라운드 109가 닫는다).
 *
 * 위 ⓑ는 이 화면의 danger 글자 셋이 전부 `bare`(프롭 쌍이 문장에 걸림)라는 것만 물었다. 프롭 쌍은
 * **안드로이드의 답**이고 iOS의 답은 `announceForA11y`라, 셋 가운데 훅을 지나는 것이 총액 하나뿐인
 * 동안 나머지 둘은 iOS에서 조용했다. 이제 셋 다 지난다.
 */
describe("A11Y-115 ⓖ 예산 카테고리 오류 둘 — 세 줄이 같은 훅을 지난다", () => {
  it("총액 하나 + 카테고리 둘 = 셋", () => {
    const budgetSource = source(BUDGET);
    expect(budgetSource).toContain("useFieldErrorAnnouncement(amountError);");
    expect(budgetSource).toContain(
      "useFieldErrorAnnouncement(categoryForm?.rows.find((row) => row.errorText !== null)?.errorText ?? null);"
    );
    expect(budgetSource).toContain("useFieldErrorAnnouncement(categoryForm?.formError ?? null);");
    // 자리 수가 danger 글자 수(ⓑ의 셋)와 같다 — 하나가 늘면 배선도 함께 늘어야 한다.
    expect(
      (maskComments(budgetSource).match(/useFieldErrorAnnouncement\(/g) ?? []).length,
      "예산 화면의 낭독 배선"
    ).toBe(dangerTextExitsOf(BUDGET).length);
  });

  it("⚠️ '행 오류는 첫 줄 하나' 가 성립하는 근거 — 행 문구에 행 이름이 들어가지 않는다", () => {
    // 훅은 값 하나를 받고 행은 map 안이라 행마다 부를 수 없다(FIX-A). 그것이 절충이 아닌 이유는
    // 조립기가 **모든 행에 같은 한 문장**을 싣기 때문이다. 문구가 행별로 갈리는 날 이 줄이 먼저
    // 빨개져 그 배선을 다시 보게 한다.
    expect(source("src/expenses/category-budget-form.ts")).toContain(
      "errorText: isAmountOverLimit(amountKrw) ? amountOverLimitMessage() : null"
    );
  });
});

/**
 * ⓗ **아이 관리(SET-005) — 이 계열에 마지막으로 남아 있던 침묵**(라운드 110).
 *
 * ⓕ가 온보딩 넷을 닫은 뒤에도 `app/settings/children.tsx`의 검증 오류 셋은 맨 `<Text>`였다:
 * 태명(:ChildFormFields) · 날짜(:ChildDateField) · 단계 칩(:ChildFormFields). 화면에는 정직하게
 * 그려졌지만(전부 `showErrors && …` 뒤에 선다) 포커스는 입력칸에 남으므로 소리로만 쓰는 사람에게는
 * [저장]·[출생일로 바꾸기]가 왜 잠겼는지 도달할 길이 없었다.
 *
 * ## 이 화면이 앞의 여섯 화면과 다른 세 가지
 *
 * ⓘ **훅이 화면이 아니라 컴포넌트 안에 산다.** 앞의 화면들은 폼이 하나뿐이라 최상단 한 줄이면
 * 됐다. 여기는 갈래가 셋(편집 · 출생 전환 · 추가)이고 그중 둘이 `ChildFormFields`를 공유한다.
 * 최상단에 놓으면 어느 폼의 오류인지 구분되지 않고, 폼이 닫힌 뒤에도 `showErrors`가 참으로
 * 남아(닫기·취소는 그 값을 되돌리지 않는다) **사라진 폼의 오류**를 읽는다. 컴포넌트 안이 정확한
 * 근거는 아래 두 번째 단언이 값으로 진다 — 세 입구가 서로를 반드시 닫으므로 동시에 열린 폼이 없고,
 * 따라서 살아 있는 훅도 언제나 하나다.
 *
 * ⓙ **touched 게이트가 없다 — 그리고 그것이 온보딩과 어긋나는 것이 아니다.**
 * `app/(onboarding)/child-profile.tsx`는 제출 전에도 오류를 그리므로 touched가 곧 "화면이 그 줄을
 * 그리는가"였다(위 ⓕ). 이 화면의 `showErrors`는 **제출 핸들러에서만** 참이 되므로 그 값 자체가
 * 이미 같은 게이트다. 규칙은 두 화면에서 하나다 — *훅이 받는 값 = 화면이 그 줄을 그리는 조건*.
 *
 * ⓚ **프롭 쌍은 더하지 않는다.** 이 화면의 `accessibilityLiveRegion="polite" accessibilityRole="alert"`
 * 셋은 **뮤테이션 저장 실패** 자리의 것이고 그 수는 소유 밖 대장(`src/a11y-contract.test.ts`)이
 * 값으로 붙들고 있다. 검증 오류 셋에 프롭을 더하면 그 대장이 먼저 빨개지고, 무엇보다 안드로이드에서
 * 라이브 리전과 announce가 겹친다(훅 모듈 머리말의 그 물음). 훅 하나로 두 플랫폼이 답하므로
 * 프롭은 필요하지 않다 — 아래 마지막 단언이 그 셋을 그대로 붙든다.
 */
const MANAGE_CHILDREN = "app/settings/children.tsx";

/** 이 화면의 화살표 핸들러 한 덩어리(선언 줄부터 두 칸 들여쓴 `};`까지). */
function handlerBodyOf(masked: string, declaration: string): string {
  const start = masked.indexOf(declaration);
  if (start < 0) throw new Error(`${MANAGE_CHILDREN}에 ${declaration}가 없다`);
  const end = masked.indexOf("\n  };", start);
  if (end < 0) throw new Error(`${declaration}의 끝을 찾지 못했다`);
  return masked.slice(start, end);
}

describe("A11Y-115 ⓗ 아이 관리(SET-005) 폼 셋 — 검증 오류가 소리로 나간다", () => {
  it("폼 갈래는 셋이고, 오류를 그리는 조건이 소스에 그대로 있다 (편집·추가는 상태를 공유한다)", () => {
    const masked = maskComments(source(MANAGE_CHILDREN));
    // 상태는 둘 — 편집/추가가 함께 쓰는 `showErrors` 하나, 출생 전환 카드의 `bornShowErrors` 하나.
    expect(masked).toContain("const [showErrors, setShowErrors] = useState(false);");
    expect(masked).toContain("const [bornShowErrors, setBornShowErrors] = useState(false);");
    // 그리는 자리 셋(공유 컴포넌트 둘 안에 있다).
    expect(masked).toContain(
      "{showErrors && errors.nicknameError ? <Text style={fieldErrorStyle}>{errors.nicknameError}</Text> : null}"
    );
    expect(masked).toContain("{showErrors && error ? <Text style={fieldErrorStyle}>{error}</Text> : null}");
    expect(masked).toContain(
      "{showErrors && errors.manualStageError ? <Text style={fieldErrorStyle}>{errors.manualStageError}</Text> : null}"
    );
    // 세 갈래의 렌더 게이트 — 하나가 사라지면 위 ⓘ의 근거가 함께 흔들린다.
    expect(masked).toContain("{editingChild && editingChild.id === child.id ? (");
    expect(masked).toContain("{canEditChildren && bornChildId === child.id ? (");
    expect(masked).toContain("{hasSession && canAddChild && !isDemoSession && addOpen ? (");
  });

  it("⚠️ 세 입구가 서로를 반드시 닫는다 — 동시에 열린 폼이 없다(훅이 컴포넌트 안에 사는 근거)", () => {
    const masked = maskComments(source(MANAGE_CHILDREN));
    const openers = [
      { declaration: "const startEdit = (child: Child) => {", closes: ["setAddOpen(false);", "setBornChildId(null);"] },
      {
        declaration: "const startBornTransition = (child: Child) => {",
        closes: ["setAddOpen(false);", "setEditingChildId(null);"]
      },
      { declaration: "const startAdd = () => {", closes: ["setEditingChildId(null);", "setBornChildId(null);"] }
    ] as const;
    for (const opener of openers) {
      const body = handlerBodyOf(masked, opener.declaration);
      for (const close of opener.closes) {
        expect(body, `${opener.declaration} 가 ${close} 로 다른 갈래를 닫는다`).toContain(close);
      }
    }
    // 그래서 살아 있는 훅도 언제나 하나다 — 이 화면의 훅 호출은 **폼 필드를 소유한 컴포넌트마다
    // 한 번**, 모두 둘이다(ChildFormFields · ChildDateField). 셋째가 생기면 여기가 먼저 빨개진다.
    expect((masked.match(/useFieldErrorAnnouncement\(/g) ?? []).length, "이 화면의 낭독 배선").toBe(2);
  });

  it("⚠️ showErrors가 곧 게이트다 — 참이 되는 자리는 제출 핸들러뿐이다 (온보딩과 다른 결론의 근거)", () => {
    const masked = maskComments(source(MANAGE_CHILDREN));
    // 전수: `setShowErrors(true)`는 편집 제출 · 추가 제출 둘뿐이고, `setBornShowErrors(true)`는
    // 출생 전환 제출 하나뿐이다. 입력 중에는 어떤 오류도 그려지지 않으므로 touched가 필요 없다.
    expect((masked.match(/setShowErrors\(true\)/g) ?? []).length, "showErrors가 참이 되는 자리").toBe(2);
    expect((masked.match(/setBornShowErrors\(true\)/g) ?? []).length, "bornShowErrors가 참이 되는 자리").toBe(1);
    expect(handlerBodyOf(masked, "const submitEdit = (child: Child) => {")).toContain("setShowErrors(true);");
    expect(handlerBodyOf(masked, "const submitAdd = () => {")).toContain("setShowErrors(true);");
    expect(handlerBodyOf(masked, "const submitBornTransition = (child: Child) => {")).toContain(
      "setBornShowErrors(true);"
    );
    // 온보딩 쪽 결론이 오늘도 그 화면의 사실 위에 서 있다(둘이 갈리는 이유가 실재한다).
    expect(maskComments(source(CHILD_PROFILE)), "온보딩은 제출 전에도 그린다").toContain(
      "{nicknameTouched && nicknameError ? ("
    );
    expect(maskComments(source(CHILD_PROFILE))).not.toContain("setShowErrors(true)");
  });

  it("훅이 받는 값 = 화면이 그 줄을 그리는 조건 (눈에 없는 문장을 귀에만 들려주지 않는다)", () => {
    const masked = maskComments(source(MANAGE_CHILDREN));
    expect(masked).toContain(
      "useFieldErrorAnnouncement(showErrors ? (errors.nicknameError ?? errors.manualStageError) : null);"
    );
    expect(masked).toContain("useFieldErrorAnnouncement(announceError && showErrors ? error : null);");
    // ⚠️ 순진한 한 줄 금지 — 이 화면 몫(위 ⓕ가 온보딩에 세운 그 핀과 같은 사유). 제출 전에 이미
    // 서 있는 오류(빈 태명·빈 날짜)를 낭독해 버리는 형태들이다.
    expect(masked).not.toContain("useFieldErrorAnnouncement(errors.nicknameError)");
    expect(masked).not.toContain("useFieldErrorAnnouncement(errors.dateError)");
    expect(masked).not.toContain("useFieldErrorAnnouncement(errors.manualStageError)");
    expect(masked).not.toContain("useFieldErrorAnnouncement(error)");
  });

  it("⚠️ 동시에 여러 칸이 틀리면 첫 오류 하나 — 날짜 칸은 앞줄(태명)이 성할 때만 읽는다", () => {
    const masked = maskComments(source(MANAGE_CHILDREN));
    // 폼 안의 날짜 칸: 앞줄이 틀린 동안 침묵한다(예산 화면의 `rows.find(…)`와 같은 규칙).
    expect(masked).toContain("announceError={!errors.nicknameError}");
    // 출생 전환 카드의 날짜 칸에는 앞줄이 없다 — 언제나 읽는다(약칭 프롭 = true).
    const bornDateField = masked.slice(
      masked.indexOf("showErrors={bornShowErrors}"),
      masked.indexOf("onChange={setBornDateText}")
    );
    expect(bornDateField, "출생 전환 카드의 날짜 칸").toContain("announceError");
    expect(bornDateField, "출생 전환 카드의 날짜 칸").not.toContain("announceError={");
    // 선례가 오늘도 그 모양이다(발명 0건).
    expect(source(BUDGET)).toContain(
      "useFieldErrorAnnouncement(categoryForm?.rows.find((row) => row.errorText !== null)?.errorText ?? null);"
    );
  });

  it("⚠️ 태명·단계 둘만 이어 붙이면 되는 근거 — 날짜 칸과 단계 칩은 같은 폼에 함께 서지 않는다", () => {
    // 값으로 판다(소스 대조가 아니다): manual 폼에는 날짜 칸 자체가 없고,
    expect(requiredDateFieldLabel("manual")).toBeNull();
    expect(requiredDateFieldLabel("pregnant")).toBe("출산 예정일");
    expect(requiredDateFieldLabel("born")).toBe("출생일");
    // 그 폼의 판정은 날짜 오류를 만들지 않으며(칸이 없으니 값도 비어 있다),
    expect(validateChildForm("manual", { nickname: "", dateText: "", manualStage: null }, { requireDate: true })).toEqual(
      {
        nicknameError: "태명 또는 별명을 입력해 주세요.",
        dateError: null,
        manualStageError: "아이 단계를 하나 선택해 주세요."
      }
    );
    // 반대로 날짜가 있는 폼에서는 단계 오류가 생기지 않는다 — 둘은 배타다.
    expect(
      validateChildForm("born", { nickname: "", dateText: "", manualStage: null }, { requireDate: true })
    ).toEqual({
      nicknameError: "태명 또는 별명을 입력해 주세요.",
      dateError: "아이 생년월일을 입력해 주세요.",
      manualStageError: null
    });
  });

  it("⚠️ 새 한국어 문장 0건 — 셋 다 순수 모듈이 짓는 문장을 읽는다", () => {
    const code = maskComments(source(MANAGE_CHILDREN));
    const formSource = source("src/children/child-form.ts");
    for (const sentence of [
      "태명 또는 별명을 입력해 주세요.",
      "출산 예정일을 입력해 주세요.",
      "아이 생년월일을 입력해 주세요.",
      "아이 단계를 하나 선택해 주세요."
    ]) {
      expect(formSource, sentence).toContain(sentence);
      expect(code, sentence).not.toContain(sentence);
    }
  });

  it("⚠️ 프롭 쌍은 한 개도 더하지 않았다 — 대장이 붙든 셋은 뮤테이션 실패 자리의 것이다 (ⓚ)", () => {
    const screenSource = source(MANAGE_CHILDREN);
    expect(
      (screenSource.match(/accessibilityLiveRegion="polite" accessibilityRole="alert"/g) ?? []).length,
      "아이 관리 화면의 프롭 쌍"
    ).toBe(3);
    // 그 셋이 검증 오류가 아니라 저장 실패 셋이라는 사실 — 검증 오류 셋은 맨 `<Text>` 그대로다.
    for (const variable of ["bornFailedText", "editFailedText", "addFailedText"]) {
      expect(screenSource, variable).toContain(
        `<Text accessibilityLiveRegion="polite" accessibilityRole="alert" style={{ color: theme.colors.danger }}>{${variable}}</Text>`
      );
    }
    // 이 화면은 위 ⓒ·ⓕ의 두 화면과 달리 `announceForA11y(`를 **정당하게** 계속 쓴다 — 아이 전환 ·
    // 출생 전환 성공 · 추가 성공, 그리고 저장 실패 셋의 effect다. 전부 필드 검증 오류가 아니므로
    // 훅의 소관이 아니고, 그 배선은 소유 밖 대장(src/a11y-contract.test.ts)이 따로 붙든다.
    expect(screenSource).toContain("announceForA11y(");
    expect(maskComments(screenSource)).not.toMatch(/announceForA11y\((?:errors\.|error\b)/);
  });
});
