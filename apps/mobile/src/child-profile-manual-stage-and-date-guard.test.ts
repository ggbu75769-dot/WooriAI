import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CHILD_STAGE_CODES, isFutureSeoulDate, isValidCalendarDate } from "@wooriai/domain";

// PathFormScreens imports React Native transitively, so these remain source-contract checks plus
// direct domain assertions. The ONB-002 route itself must stay a dispatcher with no dormant
// early-create implementation.
const mobileRoot = process.cwd();
const pathFormSource = readFileSync(join(mobileRoot, "src/onboarding/PathFormScreens.tsx"), "utf8");
const childProfileRouteSource = readFileSync(
  join(mobileRoot, "app/(onboarding)/child-profile.tsx"),
  "utf8"
);

describe("ONB-002 V2 manual-stage selection", () => {
  it("does not hardcode manualStage to a fixed stage code", () => {
    expect(pathFormSource).not.toContain('manualStage: draft.stageMode === "manual" ? "infant_4_6"');
  });

  it("renders every domain stage and writes the selected value to the draft", () => {
    expect(pathFormSource).toContain("CHILD_STAGE_CODES.map");
    expect(pathFormSource).toContain("chooseStage(stage)");
    expect(pathFormSource).toContain("manualStage,");
    for (const code of CHILD_STAGE_CODES) expect(pathFormSource).toContain(code);
  });

  it("blocks continuation until stage, name, sex, and a valid date are ready", () => {
    expect(pathFormSource).toContain("draft.manualStage && draft.childName.trim() && draft.sex");
    expect(pathFormSource).toContain("primaryDisabled={!canContinue}");
  });

  it("keeps the route alias as a V2 dispatcher without legacy early child creation", () => {
    expect(childProfileRouteSource).toContain("PathFormScreens.tsx");
    expect(childProfileRouteSource).not.toContain("createChild(");
    expect(childProfileRouteSource).not.toContain("LegacyChildProfileScreen");
  });
});

describe("ONB-002 V2 date guards", () => {
  it("requires calendar-valid due and birth dates", () => {
    expect(pathFormSource).toContain("!draft.birthDate || !isValidCalendarDate(draft.birthDate)");
    expect(pathFormSource).toContain("draft.dueDate && isValidCalendarDate(draft.dueDate)");
  });

  it("uses a local Seoul-today future guard and native picker maximum on born paths", () => {
    expect(pathFormSource).toContain("draft.birthDate > getSeoulToday()");
    expect(pathFormSource).toContain("maximumDate={new Date()}");
    expect(pathFormSource).not.toContain("draft.dueDate > getSeoulToday()");
  });

  it("flags a future birth date in the domain contract", () => {
    expect(isFutureSeoulDate("2999-01-01")).toBe(true);
    expect(isFutureSeoulDate("2000-01-01")).toBe(false);
  });

  it("rejects impossible calendar dates", () => {
    expect(isValidCalendarDate("2026-02-30")).toBe(false);
    expect(isValidCalendarDate("2026-02-14")).toBe(true);
  });
});
