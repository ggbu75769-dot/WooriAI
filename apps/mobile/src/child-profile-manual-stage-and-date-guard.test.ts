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

describe("ONB-002 manual stage selection (audit fix: was hardcoded to infant_4_6)", () => {
  it("no longer hardcodes manualStage to a fixed stage code", () => {
    expect(childProfileSource).not.toContain('manualStage: draft.stageMode === "manual" ? "infant_4_6"');
  });

  it("lets the user pick a manual stage and saves that selection", () => {
    expect(childProfileSource).toContain("useState<ChildStageCode | null>(null)");
    expect(childProfileSource).toContain("CHILD_STAGE_CODES.map");
    expect(childProfileSource).toContain("setManualStage(code)");
    expect(childProfileSource).toContain('manualStage: draft.stageMode === "manual" ? manualStage : undefined');
  });

  it("blocks saving in manual mode until a stage is chosen", () => {
    expect(childProfileSource).toContain("아이 단계를 하나 선택해 주세요.");
    expect(childProfileSource).toContain("!manualStageError");
  });

  it("defines a Korean label for every domain ChildStageCode", () => {
    for (const code of CHILD_STAGE_CODES) {
      expect(childProfileSource).toContain(code);
    }
    // Spot-check the example label style called for in the audit ("신생아 (0-3개월)").
    expect(childProfileSource).toContain("신생아 (0-3개월)");
  });
});

describe("ONB-002 birth date must reject future dates (audit fix: only format was checked)", () => {
  it("wires isFutureSeoulDate and isValidCalendarDate from @wooriai/domain into the date guard", () => {
    expect(childProfileSource).toContain("isFutureSeoulDate");
    expect(childProfileSource).toContain("isValidCalendarDate");
    expect(childProfileSource).toContain('stageMode === "born" && isFutureSeoulDate(trimmed)');
    expect(childProfileSource).toContain("출생일은 오늘보다 미래일 수 없어요.");
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
    expect(bornModeGuardOnly.test(childProfileSource)).toBe(true);
  });
});
