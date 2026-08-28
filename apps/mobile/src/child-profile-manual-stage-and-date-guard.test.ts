import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CHILD_STAGE_CODES, isFutureSeoulDate, isValidCalendarDate } from "@wooriai/domain";

// child-profile.tsx (ONB-002) imports "react-native" transitively (via src/ui.tsx), which ships
// untranspiled Flow syntax that Vitest's default parser cannot handle -- see the identical note
// in src/lineChartMath.ts. So these are raw-source contract checks (matching the style already
// used by src/onboarding-flow.test.ts) plus direct unit checks of the domain guard functions the
// screen wires in, rather than a rendered-component test.
const mobileRoot = process.cwd();
const childProfileSource = readFileSync(
  join(mobileRoot, "app/(onboarding)/child-profile.tsx"),
  "utf8"
);
// MOB-118: the date guard (computeDateError) and the stage label map moved verbatim from the
// ONB-002 screen into src/children/child-form.ts so the settings 아이 관리 forms share them.
// The audit contracts below now check the shared module for the moved logic, plus that the
// screen still imports and wires it (rather than growing a divergent local copy back).
const childFormSource = readFileSync(join(mobileRoot, "src/children/child-form.ts"), "utf8");

describe("ONB-002 manual stage selection (audit fix: was hardcoded to infant_4_6)", () => {
  it("no longer hardcodes manualStage to a fixed stage code", () => {
    expect(childProfileSource).not.toContain('manualStage: draft.stageMode === "manual" ? "infant_4_6"');
  });

  it("lets the user pick a manual stage and saves that selection", () => {
    expect(childProfileSource).toContain("useState<ChildStageCode | null>(null)");
    expect(childProfileSource).toContain("CHILD_STAGE_CODES.map");
    expect(childProfileSource).toContain("setManualStage(code)");
    // 실기기 피드백 1: 생성 바디 조립은 설정 화면의 아이 추가와 같은 shared 모듈로 모았다 --
    // 화면은 고른 값을 그 빌더에 넘기고, 모드별 매핑은 빌더 한 곳에만 있다.
    expect(childProfileSource).toContain(
      "buildCreateChildBody(householdId, draft.stageMode, { nickname, dateText, manualStage })"
    );
    expect(childFormSource).toContain('manualStage: stageMode === "manual" ? values.manualStage : undefined');
  });

  it("blocks saving in manual mode until a stage is chosen", () => {
    // 문구·판정은 shared 모듈(validateChildForm)에 있고, 화면은 그 결과로 저장을 막는다.
    expect(childFormSource).toContain("아이 단계를 하나 선택해 주세요.");
    expect(childProfileSource).toContain("validateChildForm(");
    expect(childProfileSource).toContain("!manualStageError");
  });

  it("defines a Korean label for every domain ChildStageCode (shared child-form module)", () => {
    for (const code of CHILD_STAGE_CODES) {
      expect(childFormSource).toContain(code);
    }
    // Spot-check the example label style called for in the audit ("신생아 (0-3개월)").
    expect(childFormSource).toContain("신생아 (0-3개월)");
    // The ONB-002 screen renders the shared map rather than a local copy.
    expect(childProfileSource).toContain("CHILD_STAGE_LABELS");
    expect(childProfileSource).toContain('from "../../src/children/child-form"');
  });
});

describe("ONB-002 birth date must reject future dates (audit fix: only format was checked)", () => {
  it("wires isFutureSeoulDate and isValidCalendarDate from @wooriai/domain into the shared date guard", () => {
    expect(childFormSource).toContain("isFutureSeoulDate");
    expect(childFormSource).toContain("isValidCalendarDate");
    expect(childFormSource).toContain('stageMode === "born" && isFutureSeoulDate(trimmed)');
    expect(childFormSource).toContain("출생일은 오늘보다 미래일 수 없어요.");
    // The ONB-002 screen still runs this guard (imported, not reimplemented) -- now through
    // validateChildForm, which calls computeDateError for both the onboarding and settings forms.
    expect(childProfileSource).toContain("validateChildForm(");
    expect(childFormSource).toContain("computeDateError(stageMode, values.dateText)");
    expect(childProfileSource).not.toContain("function computeDateError");
  });

  it("(domain contract) isFutureSeoulDate flags a birth date in the future", () => {
    const farFutureDate = "2999-01-01";
    expect(isFutureSeoulDate(farFutureDate)).toBe(true);
  });

  it("(domain contract) isFutureSeoulDate allows a past date, which a due date must also accept", () => {
    const pastDate = "2000-01-01";
    expect(isFutureSeoulDate(pastDate)).toBe(false);
  });

  it("(domain contract) isValidCalendarDate rejects an impossible calendar date like Feb 30", () => {
    expect(isValidCalendarDate("2026-02-30")).toBe(false);
    expect(isValidCalendarDate("2026-02-14")).toBe(true);
  });

  it("only applies the future-date rejection to born mode, not pregnant due dates", () => {
    // The guard function only calls isFutureSeoulDate when stageMode === "born"; pregnant mode
    // falls through to the calendar-validity check only, so a past due date is accepted.
    const bornModeGuardOnly = /stageMode === "born" && isFutureSeoulDate/;
    expect(bornModeGuardOnly.test(childFormSource)).toBe(true);
  });
});
