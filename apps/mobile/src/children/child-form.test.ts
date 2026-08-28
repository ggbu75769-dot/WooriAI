import { describe, expect, it } from "vitest";
import { CHILD_STAGE_CODES } from "@wooriai/domain";
import {
  buildCreateChildBody,
  buildUpdateChildBody,
  childDatePickerDirection,
  CHILD_STAGE_LABELS,
  CHILD_STAGE_MODE_OPTIONS,
  computeDateError,
  dateFieldLabel,
  isChildFormValid,
  requiredDateFieldLabel,
  validateChildForm
} from "./child-form";

describe("MOB-118 shared child form validation (reused from ONB-002)", () => {
  it("keeps a Korean label for every domain stage code and all three stage modes", () => {
    for (const code of CHILD_STAGE_CODES) {
      expect(CHILD_STAGE_LABELS[code]).toBeTruthy();
    }
    expect(CHILD_STAGE_MODE_OPTIONS.map((option) => option.mode)).toEqual(["pregnant", "born", "manual"]);
  });

  it("labels the date field per stage mode (optional for onboarding, required for settings edit)", () => {
    expect(dateFieldLabel("pregnant")).toBe("출산 예정일 (선택)");
    expect(dateFieldLabel("born")).toBe("출생일 (선택)");
    expect(dateFieldLabel("manual")).toBeNull();
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
    expect(computeDateError("pregnant", "2999-01-01")).toBeNull();
    expect(childDatePickerDirection("pregnant")).toBe("future");
  });

  it("rejects malformed, impossible, and future birth dates exactly like the onboarding guard", () => {
    expect(computeDateError("born", "2025/01/01")).toBe("날짜는 YYYY-MM-DD 형식으로 입력해 주세요.");
    expect(computeDateError("born", "2026-02-30")).toBe("실제 존재하는 날짜인지 확인해 주세요.");
    expect(computeDateError("born", "2999-01-01")).toBe("출생일은 오늘보다 미래일 수 없어요.");
    expect(computeDateError("born", "2025-06-15")).toBeNull();
    // A pregnant due date may lie in the future (expected) or the past (already gave birth).
    expect(computeDateError("pregnant", "2999-01-01")).toBeNull();
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
