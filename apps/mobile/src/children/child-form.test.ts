import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  calculateChildStage,
  getEntryDateFloor,
  getSeoulToday,
  CHILD_STAGE_CODES,
  ENTRY_DATE_MAX_PAST_MONTHS,
  ENTRY_DATE_MAX_PAST_YEARS
} from "@wooriai/domain";
import {
  buildCreateChildBody,
  buildUpdateChildBody,
  childDatePickerDirection,
  CHILD_BIRTH_DATE_TOO_OLD_ERROR,
  CHILD_DUE_DATE_BEYOND_TERM_ERROR,
  CHILD_DUE_DATE_MAX_FUTURE_DAYS,
  CHILD_DUE_DATE_MAX_FUTURE_WEEKS,
  CHILD_STAGE_LABELS,
  CHILD_STAGE_MODE_OPTIONS,
  computeDateError,
  isChildFormValid,
  requiredDateFieldLabel,
  validateChildForm
} from "./child-form";
import {
  canGoToPreviousExpenseDatePickerMonth,
  EXPENSE_DATE_PICKER_FUTURE_DIRECTION_HINT,
  EXPENSE_DATE_PICKER_MAX_FUTURE_DAYS,
  EXPENSE_DATE_PICKER_MAX_FUTURE_WEEKS,
  EXPENSE_DATE_PICKER_MAX_PAST_MONTHS,
  isExpenseDatePickerDateSelectable
} from "../expenses/date-picker-month";
import { EXPENSE_DATE_TOO_OLD_ERROR } from "../expenses/entry-form-guards";

describe("MOB-118 shared child form validation (reused from ONB-002)", () => {
  it("keeps a Korean label for every domain stage code and all three stage modes", () => {
    for (const code of CHILD_STAGE_CODES) {
      expect(CHILD_STAGE_LABELS[code]).toBeTruthy();
    }
    expect(CHILD_STAGE_MODE_OPTIONS.map((option) => option.mode)).toEqual(["pregnant", "born", "manual"]);
  });

  /**
   * 라운드 65 F(정찰 P3): 종전 이 케이스는 `dateFieldLabel`의 "(선택)" 접미사를 함께 못박고
   * 있었는데, 날짜는 세 폼 모두에서 **필수**다(`requireDate: true`) — 죽은 함수가 화면과 반대되는
   * 사실을 테스트로 고정하고 있던 자리라 함수와 함께 지웠다.
   */
  it("labels the date field per stage mode (날짜는 필수라 접미사가 없다)", () => {
    expect(requiredDateFieldLabel("pregnant")).toBe("출산 예정일");
    expect(requiredDateFieldLabel("born")).toBe("출생일");
    expect(requiredDateFieldLabel("manual")).toBeNull();
  });

  /**
   * 라운드 65 D — 달력이 열리는 쪽은 **손타이핑 가드와 같은 근거**에서 나온다.
   *
   * 출생일만 미래가 금지돼 있고(바로 아래 케이스), 예정일에는 그 금지가 없다. 두 판정이 갈리면
   * 픽커에서 고른 날짜가 저장 직전에 막히거나(넓은 쪽) 손으로는 칠 수 있는 날짜를 달력만
   * 잠근다(좁은 쪽).
   */
  it("고를 수 있는 쪽이 stageMode에서 나온다 (예정일만 미래로 열린다)", () => {
    expect(childDatePickerDirection("pregnant")).toBe("future");
    expect(childDatePickerDirection("born")).toBe("past");
    expect(childDatePickerDirection("manual")).toBe("past");
    expect(childDatePickerDirection(null)).toBe("past");
    // 방향과 가드가 같은 사실을 말한다: 미래를 막는 모드는 달력도 미래를 열지 않는다.
    expect(computeDateError("born", "2999-01-01")).not.toBeNull();
    expect(childDatePickerDirection("born")).toBe("past");
    // 라운드 67 B: 예정일도 미래 쪽이 무한하지는 않다 — 달력이 만삭에서 잠그는 그 경계를
    // 가드도 갖게 됐다(아래 전용 describe). 여기서는 방향이 여전히 "future"라는 것만 본다.
    expect(computeDateError("pregnant", "2026-09-01")).toBeNull();
    expect(childDatePickerDirection("pregnant")).toBe("future");
  });

  it("rejects malformed, impossible, and future birth dates exactly like the onboarding guard", () => {
    expect(computeDateError("born", "2025/01/01")).toBe("날짜는 YYYY-MM-DD 형식으로 입력해 주세요.");
    expect(computeDateError("born", "2026-02-30")).toBe("실제 존재하는 날짜인지 확인해 주세요.");
    expect(computeDateError("born", "2999-01-01")).toBe("출생일은 오늘보다 미래일 수 없어요.");
    expect(computeDateError("born", "2025-06-15")).toBeNull();
    // A pregnant due date may lie in the future (expected) or the past (already gave birth).
    // 라운드 67 B: 미래 쪽은 만삭까지만이다(아래 전용 describe가 경계 세 값을 고정한다) —
    // 종전 이 자리가 "2999-01-01도 통과"를 고정하고 있었고, 그것이 바로 없던 상한이다.
    expect(computeDateError("pregnant", "2999-01-01")).toBe(CHILD_DUE_DATE_BEYOND_TERM_ERROR);
    expect(computeDateError("pregnant", "2020-01-01")).toBeNull();
    // Empty is not a format error (requiredness is handled separately by validateChildForm).
    expect(computeDateError("born", "  ")).toBeNull();
  });

  it("requires a nickname", () => {
    const errors = validateChildForm("born", { nickname: "   ", dateText: "2025-06-15", manualStage: null });
    expect(errors.nicknameError).toBe("태명 또는 별명을 입력해 주세요.");
    expect(isChildFormValid(errors)).toBe(false);
  });

  it("requires the date in requireDate mode with the server's own messages", () => {
    const born = validateChildForm("born", { nickname: "튼튼이", dateText: "", manualStage: null }, { requireDate: true });
    expect(born.dateError).toBe("아이 생년월일을 입력해 주세요.");
    const pregnant = validateChildForm(
      "pregnant",
      { nickname: "튼튼이", dateText: "", manualStage: null },
      { requireDate: true }
    );
    expect(pregnant.dateError).toBe("출산 예정일을 입력해 주세요.");
    // Onboarding-style optional date: empty stays valid.
    const optional = validateChildForm("born", { nickname: "튼튼이", dateText: "", manualStage: null });
    expect(optional.dateError).toBeNull();
    expect(isChildFormValid(optional)).toBe(true);
  });

  it("requires a manual stage selection in manual mode", () => {
    const errors = validateChildForm("manual", { nickname: "튼튼이", dateText: "", manualStage: null }, { requireDate: true });
    expect(errors.manualStageError).toBe("아이 단계를 하나 선택해 주세요.");
    const ok = validateChildForm(
      "manual",
      { nickname: "튼튼이", dateText: "", manualStage: "infant_4_6" },
      { requireDate: true }
    );
    expect(isChildFormValid(ok)).toBe(true);
  });

  it("builds a PATCH body with only the stage-mode-appropriate field", () => {
    expect(buildUpdateChildBody("born", { nickname: " 튼튼이 ", dateText: " 2025-06-15 ", manualStage: null })).toEqual({
      nickname: "튼튼이",
      birthDate: "2025-06-15"
    });
    expect(buildUpdateChildBody("pregnant", { nickname: "콩이", dateText: "2026-12-01", manualStage: null })).toEqual({
      nickname: "콩이",
      dueDate: "2026-12-01"
    });
    expect(buildUpdateChildBody("manual", { nickname: "콩이", dateText: "", manualStage: "toddler_1_3" })).toEqual({
      nickname: "콩이",
      manualStage: "toddler_1_3"
    });
    // An emptied date is omitted (keep the stored value) -- never sent as "".
    expect(buildUpdateChildBody("born", { nickname: "콩이", dateText: "", manualStage: null })).toEqual({
      nickname: "콩이"
    });
    // Never leaks a cross-mode field (server whitelist/normalizeChildInput would reject it).
    expect(buildUpdateChildBody("born", { nickname: "콩이", dateText: "2025-06-15", manualStage: "toddler_1_3" })).toEqual({
      nickname: "콩이",
      birthDate: "2025-06-15"
    });
  });

  it("라운드 67 B — 만삭보다 먼 예정일은 폼 전체가 막는다", () => {
    const errors = validateChildForm(
      "pregnant",
      { nickname: "다온이", dateText: "2062-11-14", manualStage: null },
      { requireDate: true }
    );
    expect(errors.dateError).toBe(CHILD_DUE_DATE_BEYOND_TERM_ERROR);
    expect(isChildFormValid(errors)).toBe(false);
  });

  it("builds a POST body matching the onboarding ONB-002 field mapping", () => {
    expect(
      buildCreateChildBody("household-1", "pregnant", { nickname: " 콩이 ", dateText: "2026-12-01", manualStage: null })
    ).toEqual({
      householdId: "household-1",
      nickname: "콩이",
      stageMode: "pregnant",
      dueDate: "2026-12-01",
      birthDate: undefined,
      manualStage: undefined
    });
    expect(
      buildCreateChildBody("household-1", "manual", { nickname: "콩이", dateText: "", manualStage: "newborn_0_3" })
    ).toEqual({
      householdId: "household-1",
      nickname: "콩이",
      stageMode: "manual",
      dueDate: undefined,
      birthDate: undefined,
      manualStage: "newborn_0_3"
    });
  });
});

/**
 * 라운드 67 B — **출산 예정일의 위쪽 경계(만삭)**.
 *
 * 이 자리에 오래 구멍이 있었던 이유는 "없는 것을 잡는 단언은 존재할 수 없어서"다: 모든 유효
 * 날짜가 통과하는 것이 종전 계약이었고(위 두 케이스가 `2999-01-01`을 그렇게 고정하고 있었다),
 * 달력 픽커만 만삭에서 잠갔다. 그래서 여기서 고정하는 것은 값 하나가 아니라 **두 자리가 같은
 * 사실을 말하는가**다 — 픽커가 잠그는 날과 폼이 거절하는 날이 같은 날인지, 두 문장이 같은
 * 경계를 같은 이름으로 부르는지.
 *
 * "오늘"은 실제 오늘이다(`computeDateError`는 픽커와 달리 기준일 인자를 받지 않는다 — 출생일
 * 갈래가 종전대로 `isFutureSeoulDate(trimmed)`를 그대로 쓰기 때문이다). 그래서 경계 날짜도
 * 오늘에서 만들어 쓴다: 달력의 계약(`isExpenseDatePickerDateSelectable`)에도 같은 오늘을 넘겨
 * 두 판정이 같은 기준 위에서 비교되게 한다.
 */
describe("라운드 67 B 출산 예정일 상한(만삭)", () => {
  const TODAY = getSeoulToday();

  /** ISO 날짜를 며칠 옮긴다(테스트 전용 — 제품 코드는 도메인 기준 비교만 쓴다). */
  function shiftDays(iso: string, days: number): string {
    const shifted = new Date(`${iso}T00:00:00Z`);
    shifted.setUTCDate(shifted.getUTCDate() + days);
    return shifted.toISOString().slice(0, 10);
  }

  const FULL_TERM_DAY = shiftDays(TODAY, CHILD_DUE_DATE_MAX_FUTURE_DAYS);
  const ONE_DAY_TOO_FAR = shiftDays(TODAY, CHILD_DUE_DATE_MAX_FUTURE_DAYS + 1);

  it("상한을 새로 짓지 않고 도메인의 임신 주차 규칙에서 읽는다", () => {
    // 도메인은 "예정일이 곧 오늘"이면 만삭 주차를 답한다(packages/domain/src/stage.ts).
    const fullTerm = calculateChildStage({ stageMode: "pregnant", dueDate: TODAY, today: TODAY });
    expect("pregnancyWeek" in fullTerm && fullTerm.pregnancyWeek).toBe(CHILD_DUE_DATE_MAX_FUTURE_WEEKS);
    expect(CHILD_DUE_DATE_MAX_FUTURE_DAYS).toBe(CHILD_DUE_DATE_MAX_FUTURE_WEEKS * 7);
    // 0이면 가드가 쉰다(모르면 지어내지 않는다) — 그 상태가 조용히 굳지 않도록 하한을 건다.
    expect(CHILD_DUE_DATE_MAX_FUTURE_WEEKS, "만삭 주차가 0이면 이 상한은 아무것도 막지 않는다").toBeGreaterThan(0);

    // 그리고 그 값은 **소스에서도** 도메인을 거쳐 들어온다 — 주차도 날수도 여기 다시 적히지 않고,
    // 이 순수 폼 모듈은 지출 폴더를 import하지 않는다(픽커의 상수를 끌어오지 않는다는 규율).
    const source = readFileSync(join(process.cwd(), "src/children/child-form.ts"), "utf8");
    expect(source).toContain('calculateChildStage({ stageMode: "pregnant", dueDate: probeIso, today: probeIso })');
    expect(source).not.toMatch(/\b280\b/);
    expect(source).not.toMatch(/\b40\b/);
    expect(source).not.toContain('from "../expenses');
  });

  it("경계 세 값 — 오늘 통과 · 만삭 당일 통과 · 하루 넘김 거부", () => {
    expect(computeDateError("pregnant", TODAY)).toBeNull();
    expect(computeDateError("pregnant", FULL_TERM_DAY)).toBeNull();
    expect(computeDateError("pregnant", ONE_DAY_TOO_FAR)).toBe(CHILD_DUE_DATE_BEYOND_TERM_ERROR);
    // 실패 시나리오 그대로: 2026을 2062로 친 오타(형식도 맞고 실존하는 날짜다).
    expect(computeDateError("pregnant", "2062-11-14")).toBe(CHILD_DUE_DATE_BEYOND_TERM_ERROR);
  });

  it("정상 예정일과 출생일 갈래는 종전과 한 글자도 다르지 않다", () => {
    // 오늘~만삭 사이는 전부 통과한다(가장 흔한 입력이 이 구간이다).
    for (const days of [1, 7, 100, 200, CHILD_DUE_DATE_MAX_FUTURE_DAYS - 1]) {
      expect(computeDateError("pregnant", shiftDays(TODAY, days)), String(days)).toBeNull();
    }
    // 지난 예정일은 여전히 정상 입력이다(이미 출산한 사람 — 출생 전환 입구가 받는 갈래).
    expect(computeDateError("pregnant", shiftDays(TODAY, -1))).toBeNull();
    expect(computeDateError("pregnant", "2020-01-01")).toBeNull();
    // 출생일·형식·실존 검사는 그대로다.
    expect(computeDateError("born", "2999-01-01")).toBe("출생일은 오늘보다 미래일 수 없어요.");
    expect(computeDateError("born", "2025-06-15")).toBeNull();
    expect(computeDateError("pregnant", "2026-02-30")).toBe("실제 존재하는 날짜인지 확인해 주세요.");
    expect(computeDateError("pregnant", "2062/11/14")).toBe("날짜는 YYYY-MM-DD 형식으로 입력해 주세요.");
    expect(computeDateError("pregnant", "  ")).toBeNull();
    // 단계를 직접 고른 모드엔 날짜 칸 자체가 없고, 이 상한도 걸리지 않는다.
    expect(computeDateError("manual", "2062-11-14")).toBeNull();
    expect(computeDateError(null, "2062-11-14")).toBeNull();
  });

  it("달력 픽커와 폼이 **같은 경계를 같은 이름으로** 부른다", () => {
    // 값: 두 모듈이 각자 도메인에 물어 읽은 답이 같은 값이다(상수를 끌어오지 않고도 갈리지 않는다).
    expect(CHILD_DUE_DATE_MAX_FUTURE_WEEKS).toBe(EXPENSE_DATE_PICKER_MAX_FUTURE_WEEKS);
    expect(CHILD_DUE_DATE_MAX_FUTURE_DAYS).toBe(EXPENSE_DATE_PICKER_MAX_FUTURE_DAYS);
    // 문장: 픽커의 안내 뒷문장이 폼의 오류 문구와 글자까지 같다.
    expect(EXPENSE_DATE_PICKER_FUTURE_DIRECTION_HINT.endsWith(CHILD_DUE_DATE_BEYOND_TERM_ERROR)).toBe(true);
    // 날: 픽커가 마지막으로 열어 주는 날을 폼도 받고, 픽커가 잠그는 첫 날을 폼도 거절한다.
    expect(isExpenseDatePickerDateSelectable(FULL_TERM_DAY, TODAY, "future")).toBe(true);
    expect(computeDateError("pregnant", FULL_TERM_DAY)).toBeNull();
    expect(isExpenseDatePickerDateSelectable(ONE_DAY_TOO_FAR, TODAY, "future")).toBe(false);
    expect(computeDateError("pregnant", ONE_DAY_TOO_FAR)).toBe(CHILD_DUE_DATE_BEYOND_TERM_ERROR);
  });

  it("서버도 같은 문장으로 거절한다(양쪽이 다른 말로 설명하지 않는다)", () => {
    // 서버 e2e(apps/api/test/child-stage-transition.e2e.test.ts)가 이 문장을 응답에서 못박고,
    // 여기서는 앱이 내는 문장이 그 문장인지를 못박는다 — 두 자리가 같은 문자열을 든다.
    expect(CHILD_DUE_DATE_BEYOND_TERM_ERROR).toBe(`만삭(${CHILD_DUE_DATE_MAX_FUTURE_WEEKS}주)보다 먼 날은 고를 수 없어요.`);
  });
});

/**
 * 라운드 68 A — **출생일의 아래쪽 경계(20년)**.
 *
 * 라운드 67 B의 반대 방향이고, 구멍이 있던 이유도 같다: 모든 유효 과거 날짜가 통과하는 것이
 * 종전 계약이었고(위 스위트가 `2020-01-01`·`2025-06-15`를 그렇게 고정하고 있다), **같은 칸의
 * 달력 픽커만** 20년에서 잠겨 있었다. 그래서 여기서 고정하는 것도 값 하나가 아니라 **두 자리가
 * 같은 사실을 말하는가**다 — 픽커가 더는 내려가지 못하는 달과 폼이 거절하는 날이 맞물리는지,
 * 지출 폼과 이 폼이 같은 경계를 같은 문장으로 부르는지.
 */
describe("라운드 68 A 출생일 하한(20년)", () => {
  const TODAY = getSeoulToday();
  const FLOOR = getEntryDateFloor();

  function shiftDays(iso: string, days: number): string {
    const shifted = new Date(`${iso}T00:00:00Z`);
    shifted.setUTCDate(shifted.getUTCDate() + days);
    return shifted.toISOString().slice(0, 10);
  }

  it("경계 세 값 — 하한 당일 통과 · 하루 넘김 거부 · 오늘 통과", () => {
    expect(computeDateError("born", FLOOR)).toBeNull();
    expect(computeDateError("born", shiftDays(FLOOR, -1))).toBe(CHILD_BIRTH_DATE_TOO_OLD_ERROR);
    expect(computeDateError("born", TODAY)).toBeNull();
  });

  it("실패 시나리오: 홈이 '생후 1,197개월'을 그리던 오타를 폼이 먼저 막는다", () => {
    expect(computeDateError("born", "1926-08-14")).toBe(CHILD_BIRTH_DATE_TOO_OLD_ERROR);
    // 필드 전체 검증에서도 같은 문장이 그대로 올라온다(화면이 보는 자리는 이쪽이다).
    const errors = validateChildForm("born", { nickname: "콩이", dateText: "1926-08-14", manualStage: null });
    expect(errors.dateError).toBe(CHILD_BIRTH_DATE_TOO_OLD_ERROR);
    expect(isChildFormValid(errors)).toBe(false);
  });

  it("정상 출생일과 예정일 갈래는 종전과 한 글자도 다르지 않다", () => {
    // 이 앱이 실제로 다루는 구간(임신~첫돌, 넉넉히 잡아 몇 해)은 전부 통과한다.
    for (const days of [0, -1, -30, -365, -3650]) {
      expect(computeDateError("born", shiftDays(TODAY, days)), String(days)).toBeNull();
    }
    expect(computeDateError("born", "2999-01-01")).toBe("출생일은 오늘보다 미래일 수 없어요.");
    // **과거 예정일 허용은 무변경**이다 — 하한은 출생일 갈래에만 붙는다.
    expect(computeDateError("pregnant", "1926-08-14")).toBeNull();
    expect(computeDateError("pregnant", shiftDays(FLOOR, -1))).toBeNull();
    // 단계를 직접 고른 모드엔 날짜 칸 자체가 없다.
    expect(computeDateError("manual", "1926-08-14")).toBeNull();
    expect(computeDateError(null, "1926-08-14")).toBeNull();
  });

  it("달력 픽커와 폼이 **같은 경계**를 쓴다(달력은 잠기고 옆 칸은 안 잠기던 비대칭을 없앤다)", () => {
    // 픽커의 과거 바닥은 달 단위다(‹ 가 20년에서 멈춘다). 그 마지막 달의 1일이 곧 폼의 하한이다.
    expect(FLOOR.slice(8)).toBe("01");
    expect(canGoToPreviousExpenseDatePickerMonth(FLOOR.slice(0, 7), TODAY)).toBe(false);
    expect(isExpenseDatePickerDateSelectable(FLOOR, TODAY)).toBe(true);
    expect(computeDateError("born", FLOOR)).toBeNull();
    // 값: 이 폼도 픽커도 도메인의 같은 상수 하나에서 답을 얻는다.
    expect(EXPENSE_DATE_PICKER_MAX_PAST_MONTHS).toBe(ENTRY_DATE_MAX_PAST_MONTHS);
  });

  it("지출 폼·서버와 **같은 문장**으로 거절한다", () => {
    // 같은 경계를 두 이름으로 부르지 않는다(라운드 67 B의 계약). 서버 e2e가 응답에서 같은
    // 문장을 못박고, 여기서는 앱이 내는 문장이 그 문장인지를 못박는다.
    expect(CHILD_BIRTH_DATE_TOO_OLD_ERROR).toBe(`${ENTRY_DATE_MAX_PAST_YEARS}년보다 오래된 날은 고를 수 없어요.`);
    expect(CHILD_BIRTH_DATE_TOO_OLD_ERROR).toBe(EXPENSE_DATE_TOO_OLD_ERROR);
  });
});
